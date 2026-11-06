const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display, slotText } = require('../../utils/time');
Page({
  data: { loading: true, busy: false, error: '', order: null, readOnly: true, providers: [], providerIndex: 0 },
  onLoad(options) { this.orderId = options.id; },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      const readOnly = !user.roles.includes('admin');
      const order = await api.call('order', 'detail', { orderId: this.orderId }, { loading: false });
      const details = Object.entries(order.detail || {}).map(([key, value]) => ({ key,
        label: ({ stationCode: '驿站', pickupCodes: '取件码', largeCount: '大件数', placement: '交付方式', bags: '袋数', sorted: '已分类', shop: '店名', items: '代买清单', goodsCap: '商品预付（分）', category: '类别', desc: '描述', blocks: '时长块数' })[key] || key,
        value: Array.isArray(value) ? value.join('、') : typeof value === 'boolean' ? (value ? '是' : '否') : String(value) }));
      this.setData({ order, readOnly, details, slotText: slotText(order.slot), amount: yuan(order.pricing.payAmount + order.pricing.goodsCap),
        canCancel: ['pending_pay', 'paid', 'accepted', 'in_service'].includes(order.status),
        refunds: order.refunds.map(item => ({ ...item, amountText: yuan(item.amount), statusText: { failed: '失败', processing: '处理中', success: '成功' }[item.status], time: display(item.at) })) });
      if (!readOnly && order.status === 'paid') {
        const providers = []; let page;
        do { page = await api.call('admin', 'listProviders', { status: 'approved', communityId: order.communityId, offset: providers.length }); providers.push(...page.list); } while (page.hasMore);
        this.setData({ providers, providerIndex: 0 });
      }
    } catch (error) { this.setData({ error: error.message || '订单加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  provider(event) { this.setData({ providerIndex: Number(event.detail.value) }); },
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
  async perform(action, data = {}) {
    if (this.data.busy || this.data.readOnly) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('admin', action, { orderId: this.orderId, ...data }); await this.load(); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  preview(event) { wx.previewImage({ current: event.currentTarget.dataset.url, urls: [event.currentTarget.dataset.url] }); }
});
