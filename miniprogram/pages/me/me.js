Page({
  data: { loading: true, error: '', user: null, community: null, provider: null, manage: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const app = getApp();
      const user = await app.ensureSession(true);
      this.setData({ user, community: app.globalData.community, provider: app.globalData.provider,
        manage: user.roles.includes('admin') || user.roles.includes('property') });
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  callHotline() {
    const phoneNumber = getApp().globalData.community && getApp().globalData.community.hotline;
    if (phoneNumber && phoneNumber !== '400-000-0000') wx.makePhoneCall({ phoneNumber });
    else wx.showToast({ title: '请在首页查看客服电话', icon: 'none' });
  }
});
