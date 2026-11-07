const api = require('../../utils/api');
Page({
  data: { loading: true, error: '', community: null, firstOrder: false,
    services: [{ code: 'express', name: '代取快递', icon: '📦' }, { code: 'trash', name: '代扔垃圾', icon: '♻️' },
      { code: 'buy', name: '周边代买', icon: '🛒' }, { code: 'help', name: '帮把手', icon: '🤝' }] },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const app = getApp();
      const user = await app.ensureSession();
      if (!user.communityId || !user.buildingId) { wx.navigateTo({ url: '/pages/bind/bind' }); return; }
      const community = await api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true });
      app.globalData.community = community;
      this.setData({ community, firstOrder: !user.firstPaidAt, eventsEnabled: community.enabledFeatures && community.enabledFeatures.events === true });
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  callHotline() {
    const phoneNumber = this.data.community && this.data.community.hotline;
    if (phoneNumber && phoneNumber !== '400-000-0000') wx.makePhoneCall({ phoneNumber });
    else wx.showToast({ title: '客服电话暂未配置', icon: 'none' });
  }
});
