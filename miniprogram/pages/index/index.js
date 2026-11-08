const api = require('../../utils/api');
const serviceCatalog = require('../../utils/service-catalog');
const CORE_SERVICES = [
  { code: 'express', name: '代取快递', icon: 'express', subtitle: '取件送到门口' },
  { code: 'trash', name: '代扔垃圾', icon: 'trash', subtitle: '省心清理日常' },
  { code: 'buy', name: '周边代买', icon: 'buy', subtitle: '生活所需代买' },
  { code: 'help', name: '帮把手', icon: 'help', subtitle: '搬运与生活协助' }
];
Page({
  data: { loading: true, error: '', community: null, firstOrder: false,
    notice: null, ads: [], needsBinding: true, eventsEnabled: false,
    services: CORE_SERVICES, serviceCatalog },
  onShow() { return this.load(); },
  async load() {
    this.setData({ loading: true, error: '', community: null, notice: null, ads: [],
      firstOrder: false, eventsEnabled: false, services: CORE_SERVICES });
    try {
      const app = getApp();
      const user = await app.ensureSession();
      if (!user.communityId || !user.buildingId) {
        app.globalData.community = null;
        this.setData({ needsBinding: true, services: CORE_SERVICES.map(item => ({ ...item, url: '/pages/bind/bind' })) });
        return;
      }
      const community = await api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true });
      app.globalData.community = community;
      let homeContent = { notice: null, ads: [] };
      try { homeContent = await api.call('content', 'homeContent', { communityId: community._id }, { loading: false, silent: true }); } catch (_) {}
      const services = [...CORE_SERVICES];
      if (community.enabledFeatures && community.enabledFeatures.recycle) services.push({ code: 'recycle', name: '回收上门', icon: 'recycle', subtitle: '预约分类回收', url: '/recycle/order/order' });
      this.setData({ community, needsBinding: false, firstOrder: !user.firstPaidAt, services, eventsEnabled: community.enabledFeatures && community.enabledFeatures.events === true,
        notice: homeContent.notice, ads: homeContent.ads || [] });
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  introduce(event) {
    const item = serviceCatalog.find(service => service.code === event.currentTarget.dataset.code);
    if (!item) return;
    wx.showModal({ title: item.name, content: item.description + '\n开通情况以所选小区为准。', showCancel: false, confirmText: '知道了', confirmColor: '#1F7A5C' });
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
  openNotices() { wx.navigateTo({ url: '/notices/list/list' }); }
});
