const api = require('../../utils/api');
Page({
  data: { loading: true, error: '', merchant: null },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('merchant', 'myApplication', {}, { loading: false, silent: true });
      this.setData({ merchant: result.merchant });
    } catch (error) { this.setData({ error: error.message || '工作台加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  apply() { wx.navigateTo({ url: '/merchant/apply/apply' }); },
  services() { wx.navigateTo({ url: '/merchant/services/services' }); },
  orders() { wx.navigateTo({ url: '/merchant/orders/orders' }); }
});
