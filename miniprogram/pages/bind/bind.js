const api = require('../../utils/api');

Page({
  data: { loading: true, saving: false, error: '', communities: [], buildings: [], units: [],
    communityIndex: 0, buildingIndex: 0, unitIndex: 0, room: '', phone: '', agreed: false },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      const communities = [];
      let page;
      do {
        page = await api.call('catalog', 'listCommunities', { offset: communities.length }, { loading: false, silent: true });
        communities.push(...page.list);
      } while (page.hasMore);
      let selected = { communityId: user.communityId, buildingId: user.buildingId };
      const scene = wx.getStorageSync('scene');
      if (!user.communityId && scene) {
        try { selected = await api.call('catalog', 'resolveScene', { scene }, { loading: false, silent: true }); }
        catch (error) {
          if (error.code !== 'E_INVALID_PARAM') throw error;
          wx.removeStorageSync('scene');
          this.setData({ error: '二维码已失效，请手动选择小区和楼栋' });
        }
      }
      const communityIndex = Math.max(0, communities.findIndex(item => item._id === selected.communityId));
      this.setData({ communities, communityIndex, room: user.room || '', phone: user.phone || '' });
      if (communities.length) await this.loadBuildings(communities[communityIndex]._id, selected.buildingId, user.unit);
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  async loadBuildings(communityId, buildingId, unit) {
    const request = (this.buildingRequest || 0) + 1;
    this.buildingRequest = request;
    this.setData({ buildings: [], units: [] });
    const community = await api.call('catalog', 'getCommunity', { communityId });
    if (request !== this.buildingRequest) return;
    const buildings = community.buildings;
    const buildingIndex = Math.max(0, buildings.findIndex(item => item._id === buildingId));
    const units = buildings[buildingIndex] && buildings[buildingIndex].units || [];
    this.setData({ buildings, buildingIndex, units, unitIndex: Math.max(0, units.indexOf(unit)) });
  },
  async communityChange(event) {
    const communityIndex = Number(event.detail.value);
    this.setData({ communityIndex, error: '' });
    try { await this.loadBuildings(this.data.communities[communityIndex]._id); }
    catch (error) { this.setData({ error: error.message }); }
  },
  buildingChange(event) {
    const buildingIndex = Number(event.detail.value);
    this.setData({ buildingIndex, units: this.data.buildings[buildingIndex].units, unitIndex: 0 });
  },
  unitChange(event) { this.setData({ unitIndex: Number(event.detail.value) }); },
  roomChange(event) { this.setData({ room: event.detail.value }); },
  agreementChange(event) { this.setData({ agreed: event.detail.value.includes('agree') }); },
  async phone(event) {
    if (!event.detail.code) { this.setData({ error: '未取得手机号授权，可重新点击授权' }); return; }
    try {
      const user = await api.call('user', 'bindPhone', { code: event.detail.code });
      getApp().globalData.user = user;
      this.setData({ phone: user.phone, error: '' });
    } catch (error) { this.setData({ error: error.message }); }
  },
  async save() {
    if (this.data.saving) return;
    const { communities, communityIndex, buildings, buildingIndex, units, unitIndex, room, agreed } = this.data;
    if (!communities[communityIndex] || !buildings[buildingIndex] || !units[unitIndex]) {
      this.setData({ error: '请先选择有效的小区、楼栋和单元' }); return;
    }
    this.setData({ saving: true, error: '' });
    try {
      const user = await api.call('user', 'setAddress', { communityId: communities[communityIndex]._id,
        buildingId: buildings[buildingIndex]._id, unit: units[unitIndex], room, privacyAgreed: agreed });
      getApp().globalData.user = user;
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  }
});
