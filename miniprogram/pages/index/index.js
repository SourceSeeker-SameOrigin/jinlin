const api = require('../../utils/api');
Page({
  data: { loading: true, error: '', community: null, firstOrder: false,
    notice: null, ads: [],
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
      let homeContent = { notice: null, ads: [] };
      try { homeContent = await api.call('content', 'homeContent', { communityId: community._id }, { loading: false, silent: true }); } catch (_) {}
      this.setData({ community, firstOrder: !user.firstPaidAt, eventsEnabled: community.enabledFeatures && community.enabledFeatures.events === true,
        notice: homeContent.notice, ads: homeContent.ads || [] });
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  callHotline() {
    const phoneNumber = this.data.community && this.data.community.hotline;
    if (phoneNumber && phoneNumber !== '400-000-0000') wx.makePhoneCall({ phoneNumber });
    else wx.showToast({ title: '客服电话暂未配置', icon: 'none' });
  },
  recordAd(event) {
    const adId = event.currentTarget.dataset.id;
    const type = event.type === 'tap' ? 'ad_click' : 'ad_view';
    const communityId = this.data.community && this.data.community._id;
    if (adId && communityId) api.call('content', 'adEvent', { adId, communityId, type }, { loading: false, silent: true }).catch(() => {});
  },
  openAd(event) {
    const ad = this.data.ads.find(item => item._id === event.currentTarget.dataset.id);
    if (!ad || !ad.target) return;
    this.recordAd(event);
    if (ad.target.type === 'page' && ad.target.path) wx.navigateTo({ url: ad.target.path });
    else if (ad.target.type === 'merchant' && ad.target.id) wx.navigateTo({ url: '/shops/detail/detail?merchantId=' + encodeURIComponent(ad.target.id) });
    else if (ad.target.type === 'event' && ad.target.id) wx.navigateTo({ url: '/events/detail/detail?id=' + encodeURIComponent(ad.target.id) });
    else wx.showToast({ title: '该广告目标暂不可用', icon: 'none' });
  },
  openNotices() { wx.navigateTo({ url: '/pages/notices/list' }); }
});
