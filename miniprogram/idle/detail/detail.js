const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { yuan } = require('../../utils/money');
const { pay } = require('../../utils/payment');
Page({
  data: { loading: true, busy: false, error: '', item: null },
  onLoad(options) { this.itemId = options.id; },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('idle', 'detail', { itemId: this.itemId }, { loading: false, silent: true });
      const item = result.item;
      const conditionText = { new: '全新', like_new: '几乎全新', used: '有使用痕迹' }[item.condition] || item.condition;
      this.setData({ item: { ...item, timeText: display(item.createdAt), priceText: yuan(item.price), conditionText } });
      wx.setNavigationBarTitle({ title: item.title });
    } catch (error) { this.setData({ error: error.message || '商品加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  preview(event) { require('../../utils/media-links').preview({ current: event.currentTarget.dataset.url, urls: this.data.item.images }); },
  async contact() {
    try {
      const result = await api.call('idle', 'contact', { itemId: this.itemId });
      wx.makePhoneCall({ phoneNumber: result.phone });
    } catch (error) { this.setData({ error: error.message || '暂时无法联系卖家' }); }
  },
  async want() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const result = await api.call('chat', 'openIdle', { itemId: this.itemId });
      wx.navigateTo({ url: '/chat/room/room?conversationId=' + encodeURIComponent(result.conversationId) });
    } catch (error) { this.setData({ error: error.message || '无法打开聊天' }); }
    finally { this.setData({ busy: false }); }
  },
  async buy() {
    if (this.data.busy) return;
    const answer = await new Promise(resolve => wx.showModal({ title: '担保交易',
      content: '支付后商品将为你保留；收到商品后请在 72 小时内确认。', success: resolve }));
    if (!answer.confirm) return;
    this.setData({ busy: true, error: '' });
    try {
      const requestId = 'idle_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
      const result = await api.call('idle', 'buy', { itemId: this.itemId, requestId });
      if (result.paymentError) throw new Error('支付暂不可用，请在订单页重试');
      await pay(result);
      wx.navigateTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(result.orderId) });
      await this.load();
    } catch (error) { this.setData({ error: error.message || '担保交易未完成' }); }
    finally { this.setData({ busy: false }); }
  },
  carry() {
    const item = this.data.item;
    wx.navigateTo({ url: '/pages/service/help?idleTitle=' + encodeURIComponent(item.title) +
      '&idleDesc=' + encodeURIComponent(item.desc) });
  },
  edit() { wx.navigateTo({ url: '/idle/create/create?id=' + encodeURIComponent(this.itemId) }); },
  sales() { wx.navigateTo({ url: '/idle/sales/sales' }); },
  async markSold() {
    const answer = await new Promise(resolve => wx.showModal({ title: '标记已售', content: '确认此商品已经线下售出？', success: resolve }));
    if (!answer.confirm) return;
    try { await api.call('idle', 'markSold', { itemId: this.itemId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '操作失败' }); }
  },
  async remove() {
    const answer = await new Promise(resolve => wx.showModal({ title: '下架闲置', content: '下架后邻居将看不到此商品。确定吗？', success: resolve }));
    if (!answer.confirm) return;
    try { await api.call('idle', 'remove', { itemId: this.itemId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '操作失败' }); }
  },
  async report() {
    const answer = await new Promise(resolve => wx.showModal({ title: '举报内容', content: '确认举报此闲置？', success: resolve }));
    if (!answer.confirm) return;
    try { await api.call('idle', 'report', { itemId: this.itemId, reason: '不当内容' }); wx.showToast({ title: '已提交举报', icon: 'success' }); }
    catch (error) { this.setData({ error: error.message || '举报失败' }); }
  },
  onShareAppMessage() { return { title: this.data.item && this.data.item.title || '邻居闲置',
    path: '/idle/detail/detail?id=' + encodeURIComponent(this.itemId) }; }
});
