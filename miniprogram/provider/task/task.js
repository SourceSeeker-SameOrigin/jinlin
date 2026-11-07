const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { slotText } = require('../../utils/time');
const { toFen, yuan } = require('../../utils/money');
Page({
  data: { loading: true, busy: false, error: '', order: null, photos: [], receiptPhoto: '', goodsYuan: '',
    visitChecks: { mental: false, diet: false, utilities: false, doors: false, medical: false }, visitNotes: '', visitAttention: false, attentionCallConfirmed: false },
  onLoad(options) { this.orderId = options.id; },
  onShow() { this.visible = true; this.load(); },
  onHide() { this.visible = false; this.stopLocationTimer(); },
  onUnload() { this.visible = false; this.stopLocationTimer(); },
  stopLocationTimer() { if (this.locationTimer) clearInterval(this.locationTimer); this.locationTimer = null; },
  async load() {
    this.setData({ loading: true, error: '' });
    this.stopLocationTimer();
    try {
      await getApp().ensureSession();
      const order = await api.call('order', 'detail', { orderId: this.orderId }, { loading: false });
      this.setData({ order, slotText: slotText(order.slot), goodsCap: yuan(order.pricing.goodsCap),
        pickupText: order.detail && order.detail.pickupCodes ? order.detail.pickupCodes.join('、') : '' });
      if (order.canShareLocation && this.visible) {
        this.uploadLocation();
        this.locationTimer = setInterval(() => this.uploadLocation(), 30000);
      }
    } catch (error) { this.setData({ error: error.message || '任务加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async uploadLocation() {
    const order = this.data.order;
    if (!order || !order.canShareLocation || !['accepted','in_service'].includes(order.status) || this.locationBusy) return;
    this.locationBusy = true;
    try {
      const point = await new Promise((resolve, reject) => wx.getLocation({ type: 'gcj02', success: resolve, fail: reject }));
      await api.call('provider', 'updateLocation', { orderId: this.orderId, lat: point.latitude, lng: point.longitude }, { loading: false, silent: true });
    } catch (_) { /* 用户拒绝定位或定位暂不可用时，不影响订单操作。 */ }
    finally { this.locationBusy = false; }
  },
  goods(event) { this.setData({ goodsYuan: event.detail.value }); },
  visitCheck(event) {
    const checked = new Set(event.detail.value || []);
    this.setData({ visitChecks: { mental: checked.has('mental'), diet: checked.has('diet'),
      utilities: checked.has('utilities'), doors: checked.has('doors'), medical: checked.has('medical') } });
  },
  visitNotes(event) { this.setData({ visitNotes: event.detail.value }); },
  visitAttention(event) { this.setData({ visitAttention: event.detail.value, attentionCallConfirmed: false }); },
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
        receiptPhoto: this.data.receiptPhoto, goodsActual: toFen(this.data.goodsYuan),
        visitReport: this.data.order.serviceCode === 'visit' ? { checks: this.data.visitChecks, notes: this.data.visitNotes,
          attention: this.data.visitAttention, attentionCallConfirmed: this.data.attentionCallConfirmed } : undefined });
      if (action === 'release') wx.redirectTo({ url: '/provider/workbench/workbench' });
      else await this.load();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  callResident() { if (this.data.order.canCallResident) wx.makePhoneCall({ phoneNumber: this.data.order.userPhone,
    success: () => { if (this.data.order.serviceCode === 'visit' && this.data.visitAttention) this.setData({ attentionCallConfirmed: true }); } }); },
  openChat() { wx.navigateTo({ url: '/chat/room/room?orderId=' + encodeURIComponent(this.orderId) }); }
});
