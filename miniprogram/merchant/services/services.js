const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { yuan } = require('../../utils/money');
Page({
  data: { ready: false, loadError: false, loading: true, busy: false, error: '', list: [], title: '', desc: '', priceTypeIndex: 0, types: ['固定价', '预约后报价'], price: '', unit: '次', images: [] },
  onShow() { this.load(); },
  async load() {
    if (this.loadInFlight) return;
    this.loadInFlight = true;
    this.setData({ loading: true, ready: false, loadError: false, error: '' });
    try {
    const result = await api.call('merchant', 'myServices', {}, { loading: false, silent: true });
    this.setData({ list: (result.list || []).map(item => ({ ...item, priceText: yuan(item.price) })) });
    this.setData({ ready: true });
    } catch (error) { this.setData({ loadError: true, error: error.message || '服务加载失败' }); } finally { this.loadInFlight = false; this.setData({ loading: false }); } },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  chooseType(event) { this.setData({ priceTypeIndex: Number(event.detail.value) }); },
  async photos() {
    if (!this.data.ready || this.data.loading || this.data.busy) return;
    try {
    const user = await getApp().ensureSession();
    const images = await uploadPhotos('merchant-services/' + user._id, 3);
    this.setData({ images: [...this.data.images, ...images].slice(0, 9), error: '' });
  } catch (error) { this.setData({ error: error.message || '图片上传失败' }); } },
  async save() { if (!this.data.ready || this.data.loading || this.data.busy) return; this.setData({ busy: true, error: '' }); try {
    const type = this.data.priceTypeIndex ? 'quote' : 'fixed';
    await api.call('merchant', 'upsertService', { title: this.data.title, desc: this.data.desc, priceType: type,
      price: type === 'fixed' ? Math.round(Number(this.data.price) * 100) : 0, unit: this.data.unit, status: 'off', images: this.data.images });
    this.setData({ title: '', desc: '', price: '', images: [] }); await this.load();
  } catch (error) { this.setData({ error: error.message || '服务保存失败' }); } finally { this.setData({ busy: false }); } }
});
