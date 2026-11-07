const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display, slotText } = require('../../utils/time');
const { pay } = require('../../utils/payment');
const statuses = { pending_pay: '待支付', paid: '待接单', accepted: '已接单', in_service: '服务中', delivered: '待确认',
  completed: '已完成', disputed: '售后处理中', refunded: '已退款', cancelled: '已取消', closed: '已关闭' };
Page({
  data: { loading: true, error: '', order: null, busy: false, timeline: [], detailRows: [],
    ratingScore: '5', ratingText: '', complaintIndex: 0, complaintText: '',
    complaintReasons: ['未上门', '物品损坏或丢失', '态度', '其他'] },
  onLoad(options) { this.orderId = options.id; },
  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const order = await api.call('order', 'detail', { orderId: this.orderId }, { loading: false, silent: true });
      let unread = 0;
      if (order.canChat) {
        try {
          const chat = await api.call('chat', 'open', { orderId: this.orderId }, { loading: false, silent: true });
          this.chatConversationId = chat.conversationId;
          unread = chat.unread;
        } catch (_) { this.chatConversationId = null; }
      }
      const labels = { stationCode: '驿站', pickupCodes: '取件码', largeCount: '大件数', placement: '交付方式', bags: '袋数',
        sorted: '已分类', shop: '店名', items: '清单', goodsCap: '商品预付', category: '类别', desc: '描述', blocks: '时长块数',
        title: '悬赏任务', needEnterHome: '需要进入家中' };
      const values = { door: '放门口', hand: '当面交', carry: '搬重物', elder: '陪老人办事', other: '其他' };
      const detailRows = Object.entries(order.detail || {}).filter(([key]) => labels[key]).map(([key, value]) => ({ label: labels[key],
        value: key === 'goodsCap' ? '¥' + yuan(value) : Array.isArray(value) ? value.join('、') : typeof value === 'boolean' ? (value ? '是' : '否') : values[value] || String(value) }));
      this.setData({ order, detailRows, unread, amount: yuan(order.pricing.payAmount + order.pricing.goodsCap),
        couponDiscountText: yuan(order.pricing.couponDiscount || 0), pointsRedeemed: order.pricing.pointsRedeemed || 0,
        mapMarkers: order.providerLocation ? [{ id: 1, latitude: order.providerLocation.latitude, longitude: order.providerLocation.longitude,
          title: '服务员', width: 36, height: 36 }] : [],
        slotText: slotText(order.slot), timeline: order.timeline.map(item => ({ text: statuses[item.status], time: display(item.at) })),
        refunds: order.refunds.map(item => ({ ...item, amountText: yuan(item.amount),
          statusText: { success: '已退款', processing: '退款处理中', failed: '退款失败，请联系客服' }[item.status] })) });
    } catch (error) { this.setData({ error: error.message || '订单加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  async cancel() {
    if (this.data.busy) return;
    const answer = await new Promise(resolve => wx.showModal({ title: '取消订单', content: '确认取消这笔订单吗？已支付且未接单的订单将全额退款。', success: resolve }));
    if (!answer.confirm) return;
    this.setData({ busy: true });
    try { await api.call('order', 'cancel', { orderId: this.orderId }); await this.load(); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  async pay() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try { await pay(await api.call('order', 'retryPayment', { orderId: this.orderId })); await this.load(); }
    catch (error) { this.setData({ error: error.message || '支付未完成，可重试' }); }
    finally { this.setData({ busy: false }); }
  },
  callProvider() {
    const provider = this.data.order && this.data.order.provider;
    if (provider && provider.canCall) wx.makePhoneCall({ phoneNumber: provider.phone });
  },
  openChat() {
    if (this.data.order && this.data.order.canChat) wx.navigateTo({ url: '/chat/room/room?conversationId=' + encodeURIComponent(this.chatConversationId || '') +
      '&orderId=' + encodeURIComponent(this.orderId) });
  },
  form(event) {
    const field = event.currentTarget.dataset.field;
    if (['ratingScore', 'ratingText', 'complaintIndex', 'complaintText'].includes(field)) this.setData({ [field]: event.detail.value });
  },
  async serviceAction(event) {
    const action = event.currentTarget.dataset.action;
    if (this.data.busy || !['confirm', 'rate', 'complain'].includes(action)) return;
    if (action === 'confirm') {
      const answer = await new Promise(resolve => wx.showModal({ title: '确认完成', content: '请确认服务已经完成。', success: resolve }));
      if (!answer.confirm) return;
    }
    this.setData({ busy: true, error: '' });
    try {
      await api.call('order', action, { orderId: this.orderId, score: Number(this.data.ratingScore),
        text: action === 'rate' ? this.data.ratingText : this.data.complaintText,
        reason: this.data.complaintReasons[Number(this.data.complaintIndex)] });
      await this.load();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  preview(event) { wx.previewImage({ current: event.currentTarget.dataset.url, urls: this.data.order.photos }); }
});
