const api = require('../../utils/api');
Page({
  data: { loading: true, error: '', user: null, community: null, provider: null, merchant: null, manage: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const app = getApp();
      const user = await app.ensureSession(true);
      let unreadTotal = 0;
      try { unreadTotal = (await api.call('chat', 'list', {}, { loading: false, silent: true })).unreadTotal || 0; } catch (_) {}
      let merchant = null;
      if (app.globalData.community && app.globalData.community.features.merchants) {
        try { merchant = (await api.call('merchant', 'myApplication', {}, { loading: false, silent: true })).merchant; } catch (_) {}
      }
      this.setData({ user, community: app.globalData.community, provider: app.globalData.provider, merchant, unreadTotal,
        manage: user.roles.includes('admin') || user.roles.includes('property'),
        canManageEvents: user.roles.includes('admin') || user.roles.includes('property') || user.roles.includes('merchant') });
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  callHotline() {
    const phoneNumber = getApp().globalData.community && getApp().globalData.community.hotline;
    if (phoneNumber && phoneNumber !== '400-000-0000') wx.makePhoneCall({ phoneNumber });
    else wx.showToast({ title: '请在首页查看客服电话', icon: 'none' });
  }
});
