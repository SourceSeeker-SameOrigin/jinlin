const api = require('../utils/api');
Page({
  data: { loading: true, error: '', visits: [] },
  onLoad(options) { this.orderId = options.id; },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('pet', 'listVisits', { orderId: this.orderId }, { loading: false, silent: true });
      this.setData({ visits: result.list || [] });
    } catch (error) { this.setData({ error: error.message || '记录加载失败' }); }
    finally { this.setData({ loading: false }); }
  }
});
