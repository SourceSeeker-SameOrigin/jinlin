const api = require('../../utils/api');
Page({
  data: { loading: true, error: '', user: null, community: null, provider: null, merchant: null, stationApplication: null, manage: false, doorDeliveryBusy: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const app = getApp();
      const user = await app.ensureSession(true);
      let unreadTotal = 0;
      try { unreadTotal = (await api.call('chat', 'list', {}, { loading: false, silent: true })).unreadTotal || 0; } catch (_) {}
      let merchant = null;
      let stationApplication = null;
      if (app.globalData.community && app.globalData.community.enabledFeatures.merchants) {
        try { merchant = (await api.call('merchant', 'myApplication', {}, { loading: false, silent: true })).merchant; } catch (_) {}
      }
      if (app.globalData.community && app.globalData.community.enabledFeatures.stationDelivery && !user.roles.includes('station')) {
        try { stationApplication = (await api.call('station', 'myApplication', {}, { loading: false, silent: true })).application; } catch (_) {}
      }
      this.setData({ user, community: app.globalData.community, provider: app.globalData.provider, merchant, stationApplication, unreadTotal,
        doorDelivery: Boolean(user.prefs && user.prefs.doorDelivery), isStation: user.roles.includes('station'),
        isAdmin: user.roles.includes('admin'), isProperty: user.roles.includes('property'), isMerchant: user.roles.includes('merchant'),
        manage: user.roles.includes('admin') || user.roles.includes('property'),
        canManageEvents: user.roles.includes('admin') || user.roles.includes('property') || user.roles.includes('merchant') });
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  openWorkspace(event) {
    const code = event.currentTarget.dataset.code;
    const user = this.data.user;
    if (!user) return;
    const features = this.data.community && this.data.community.enabledFeatures || {};
    const routes = { provider: '/provider/workbench/workbench', merchant: '/merchant/workbench/workbench', station: '/station/workbench/workbench', admin: '/admin/dashboard/dashboard', property: '/admin/dashboard/dashboard' };
    const permitted = code === 'provider' ? this.data.provider && this.data.provider.status === 'approved' : user.roles.includes(code);
    if (permitted && routes[code]) { wx.navigateTo({ url: routes[code] }); return; }
    if (code === 'admin' || code === 'property') {
      wx.showModal({ title: code === 'admin' ? '管理员资格' : '物业资格', content: '由运营方核验身份并分配角色及小区范围，扫码不会自动获得权限。请联系运营方。', showCancel: false }); return;
    }
    if (!user.communityId || !user.buildingId) { wx.navigateTo({ url: '/pages/bind/bind' }); return; }
    const feature = code === 'merchant' ? 'merchants' : code === 'station' ? 'stationDelivery' : null;
    if (feature && !features[feature]) {
      wx.showModal({ title: '本小区暂未开通', content: '该工作台需先开放对应服务，再提交申请并由管理员审核。请联系运营方。', showCancel: false }); return;
    }
    const apply = { provider: '/provider/apply/apply', merchant: '/merchant/apply/apply', station: '/station/apply/apply' };
    if (apply[code]) wx.navigateTo({ url: apply[code] });
  },
  callHotline() {
    const phoneNumber = getApp().globalData.community && getApp().globalData.community.hotline;
    if (phoneNumber && phoneNumber !== '400-000-0000') wx.makePhoneCall({ phoneNumber });
    else wx.showToast({ title: '请在首页查看客服电话', icon: 'none' });
  },
  async doorDeliveryChange(event) {
    if (this.data.doorDeliveryBusy) return;
    this.setData({ doorDeliveryBusy: true, error: '' });
    try {
      await api.call('station', 'setDoorDelivery', { enabled: event.detail.value === true });
      const user = await getApp().ensureSession(true);
      this.setData({ user, doorDelivery: Boolean(user.prefs && user.prefs.doorDelivery) });
    } catch (error) {
      this.setData({ error: error.message || '保存失败，请重试' });
      await this.load();
    } finally { this.setData({ doorDeliveryBusy: false }); }
  }
});
