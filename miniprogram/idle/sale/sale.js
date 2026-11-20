const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { uploadPhotos } = require('../../utils/media');
Page({
  data: { missingRecord: false, loading: true, busy: false, error: '', order: null, photos: [], note: '' },
  onLoad(options = {}) {
    this.orderId = typeof options.id === 'string' ? options.id.trim() : '';
    this.setData({ missingRecord: !this.orderId, loading: !!this.orderId });
  },
  onShow() { this.load(); },
  async load() {
    if (!this.orderId) return;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const order = await api.call('order', 'detail', { orderId: this.orderId }, { loading: false, silent: true });
      if (!order.idleSale || !order.idleSale.seller) throw new Error('无权查看此担保订单');
      this.setData({ order, priceText: yuan(order.idleSale.price), payoutText: yuan(order.idleSale.sellerAmount) });
    } catch (error) { this.setData({ error: error.message || '订单加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async accept() {
    if (!this.orderId) return;
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('idle', 'acceptSale', { orderId: this.orderId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '接单失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async photos() {
    if (!this.orderId) return;
    try { this.setData({ photos: await uploadPhotos('idle-delivery/' + this.orderId, 3) }); }
    catch (error) { this.setData({ error: error.message || '交付凭证上传失败' }); }
  },
  note(event) { this.setData({ note: event.detail.value }); },
  async deliver() {
    if (!this.orderId) return;
    if (this.data.busy) return;
    if (!this.data.photos.length) { this.setData({ error: '请先拍摄交付凭证' }); return; }
    this.setData({ busy: true, error: '' });
    try { await api.call('idle', 'deliverSale', { orderId: this.orderId, photos: this.data.photos, note: this.data.note }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '提交交付失败' }); }
    finally { this.setData({ busy: false }); }
  },
  preview(event) {
    if (!this.orderId) return; require('../../utils/media-links').preview({ current: event.currentTarget.dataset.url, urls: this.data.photos }); }
});
