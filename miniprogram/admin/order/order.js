const api = require('../../utils/api');
const { yuan, toFen } = require('../../utils/money');
const { display, slotText } = require('../../utils/time');
Page({
  data: { loading: true, busy: false, error: '', order: null, readOnly: true, providers: [], providerIndex: 0,
    serviceRefundYuan: '0', goodsRefundYuan: '0', refundTotal: '0.00', providerLiable: false, resolutionNote: '', voidRefundYuan: '0', voidNote: '' },
  onLoad(options) { this.orderId = options.id; },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      const readOnly = !user.roles.includes('admin');
      const order = await api.call('order', 'detail', { orderId: this.orderId }, { loading: false });
      const details = Object.entries(order.detail || {}).map(([key, value]) => ({ key,
        label: ({ stationCode: '驿站', pickupCodes: '取件码', largeCount: '大件数', placement: '交付方式', bags: '袋数', sorted: '已分类', shop: '店名', items: '代买清单', goodsCap: '商品预付（分）', category: '类别', desc: '描述', blocks: '时长块数', billingMode: '计价方式', includedMinutes: '包含时长（分钟）', overtimePolicy: '超时规则' })[key] || key,
        value: Array.isArray(value) ? value.join('、') : typeof value === 'boolean' ? (value ? '是' : '否') : ({per_visit:'按次计价',per15min:'每15分钟计价',new_order:'不自动扣费，另行确认新订单'})[value] || String(value) }));
      this.setData({ order, readOnly, details, slotText: slotText(order.slot), amount: yuan(order.pricing.payAmount + order.pricing.goodsCap),
        canCancel: ['pending_pay', 'paid', 'accepted', 'in_service'].includes(order.status) &&
          (order.kind !== 'membership_purchase' || order.status === 'pending_pay'),
        refunds: order.refunds.map(item => ({ ...item, amountText: yuan(item.amount), statusText: { failed: '失败', processing: '处理中', success: '成功' }[item.status], time: display(item.at) })) });
      if (!readOnly && order.status === 'paid' && order.kind !== 'membership_purchase') {
        const providers = []; let page;
        do { page = await api.call('admin', 'listProviders', { status: 'approved', communityId: order.communityId, offset: providers.length }); providers.push(...page.list); } while (page.hasMore);
        this.setData({ providers, providerIndex: 0 });
      }
    } catch (error) { this.setData({ error: error.message || '订单加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  provider(event) { this.setData({ providerIndex: Number(event.detail.value) }); },
  openChat() {
    wx.navigateTo({ url: '/admin/chat/chat?caseType=complaint&orderId=' + encodeURIComponent(this.orderId) });
  },
  async assign() {
    const provider = this.data.providers[this.data.providerIndex];
    if (!provider) { this.setData({ error: '请选择服务员' }); return; }
    await this.perform('assign', { providerId: provider._id });
  },
  async cancel() {
    const answer = await new Promise(resolve => wx.showModal({ title: '强制取消', content: '确认取消订单并退还剩余已付款项吗？', success: resolve }));
    if (answer.confirm) await this.perform('forceCancel');
  },
  retryRefund(event) { this.perform('retryRefund', { outRefundNo: event.currentTarget.dataset.no }); },
  resolutionField(event) {
    const field = event.currentTarget.dataset.field;
    if (!['serviceRefundYuan', 'goodsRefundYuan', 'resolutionNote', 'voidRefundYuan', 'voidNote'].includes(field)) return;
    this.setData({ [field]: event.detail.value });
    const service = toFen(this.data.serviceRefundYuan), goods = toFen(this.data.goodsRefundYuan);
    this.setData({ refundTotal: service === null || goods === null ? '--' : yuan(service + goods) });
  },
  liable(event) { this.setData({ providerLiable: event.detail.value.includes('liable') }); },
  async resolve() {
    const serviceRefundAmount = toFen(this.data.serviceRefundYuan);
    const goodsRefundAmount = this.data.order.serviceCode === 'buy' ? toFen(this.data.goodsRefundYuan) : 0;
    if (serviceRefundAmount === null || goodsRefundAmount === null) { this.setData({ error: '退款金额请填写最多两位小数的元数' }); return; }
    const answer = await new Promise(resolve => wx.showModal({ title: '确认处理投诉',
      content: '服务费退款 ¥' + yuan(serviceRefundAmount) + '，商品款退款 ¥' + yuan(goodsRefundAmount) +
        '，合计 ¥' + yuan(serviceRefundAmount + goodsRefundAmount) + '。确认提交吗？', success: resolve }));
    if (answer.confirm) await this.perform('resolveComplaint', { serviceRefundAmount, goodsRefundAmount,
      providerLiable: this.data.providerLiable, note: this.data.resolutionNote });
  },
  async voidCard() {
    const amount = toFen(this.data.voidRefundYuan);
    if (amount === null) { this.setData({ error: '请填写有效退款金额' }); return; }
    const answer = await new Promise(resolve => wx.showModal({ title: '作废月卡',
      content: '将停止整张月卡及续期权益，并按本购买订单退款 ¥' + yuan(amount) + '。已接单任务需另行处理。确认吗？', success: resolve }));
    if (answer.confirm) await this.perform('voidMembership', { refundAmount: amount, note: this.data.voidNote });
  },
  async perform(action, data = {}) {
    if (this.data.busy || this.data.readOnly) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('admin', action, { orderId: this.orderId, ...data }); await this.load(); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  preview(event) { require('../../utils/media-links').preview({ current: event.currentTarget.dataset.url, urls: [event.currentTarget.dataset.url] }); }
});
