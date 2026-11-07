const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { slotText } = require('../../utils/time');
const { toFen, yuan } = require('../../utils/money');
Page({
  data: { loading: true, busy: false, error: '', order: null, photos: [], receiptPhoto: '', goodsYuan: '' },
  onLoad(options) { this.orderId = options.id; },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const order = await api.call('order', 'detail', { orderId: this.orderId }, { loading: false });
      this.setData({ order, slotText: slotText(order.slot), goodsCap: yuan(order.pricing.goodsCap),
        pickupText: order.detail && order.detail.pickupCodes ? order.detail.pickupCodes.join('、') : '' });
    } catch (error) { this.setData({ error: error.message || '任务加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  goods(event) { this.setData({ goodsYuan: event.detail.value }); },
  async photo(event) {
    try {
      const receipt = event.currentTarget.dataset.type === 'receipt';
      const files = await uploadPhotos('orders/' + this.orderId, receipt ? 1 : 3);
      this.setData(receipt ? { receiptPhoto: files[0] } : { photos: files });
    } catch (error) { this.setData({ error: error.message || '未完成拍照上传，请重试' }); }
  },
  async act(event) {
    const action = event.currentTarget.dataset.action;
    if (this.data.busy || !['start', 'release', 'deliver'].includes(action)) return;
    if (action === 'release') {
      const answer = await new Promise(resolve => wx.showModal({ title: '放弃任务', content: '放弃后，你将不能再次接取这笔订单。确认放弃吗？', success: resolve }));
      if (!answer.confirm) return;
    }
    this.setData({ busy: true, error: '' });
    try {
      await api.call('provider', action, { orderId: this.orderId, photos: this.data.photos,
        receiptPhoto: this.data.receiptPhoto, goodsActual: toFen(this.data.goodsYuan) });
      if (action === 'release') wx.redirectTo({ url: '/provider/workbench/workbench' });
      else await this.load();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  callResident() { if (this.data.order.canCallResident) wx.makePhoneCall({ phoneNumber: this.data.order.userPhone }); },
  openChat() { wx.navigateTo({ url: '/chat/room/room?orderId=' + encodeURIComponent(this.orderId) }); }
});
