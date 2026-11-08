const api = require('../../utils/api');

Page({
  data: { loading: true, saving: false, authorizing: false, error: '', phoneError: '', communities: [], buildings: [], units: [],
    communityIndex: 0, buildingIndex: 0, unitIndex: 0, room: '', phone: '', contactName: '', contactPhone: '', agreed: false, locationHint: '' },
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
      const explicitCommunity = Boolean(user.communityId || wx.getStorageSync('scene'));
      if (!explicitCommunity && communities.some(item => item.location)) {
        try {
          const current = await new Promise((resolve, reject) => wx.getLocation({ type: 'gcj02', success: resolve, fail: reject }));
          const candidates = [];
          let nearbyPage, offset = 0;
          do {
            nearbyPage = await api.call('catalog', 'nearbyCommunities', {
              location: { lat: current.latitude, lng: current.longitude }, offset
            }, { loading: false, silent: true });
            candidates.push(...nearbyPage.list);
            offset = nearbyPage.nextOffset;
          } while (nearbyPage.hasMore);
          candidates.sort((a, b) => a.distanceKm - b.distanceKm);
          if (candidates.length) communities.splice(0, communities.length, ...candidates);
          else this.setData({ locationHint: '附近 3 公里内暂未找到已配置定位的小区，可在完整列表中选择' });
        } catch (_) { this.setData({ locationHint: '定位或附近查询暂不可用，已显示小区列表，可手动选择' }); }
      }
      communities.forEach(item => { item.displayName = Number.isFinite(item.distanceKm) ? `${item.name} · ${item.distanceKm.toFixed(1)} 公里` : item.name; });
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
  contactNameChange(event) { this.setData({ contactName: event.detail.value }); },
  contactPhoneChange(event) { this.setData({ contactPhone: event.detail.value }); },
  agreementChange(event) { this.setData({ agreed: event.detail.value.includes('agree') }); },
  async phone(event) {
    if (this.data.authorizing || this.data.saving) return;
    const code = event.detail && event.detail.code;
    if (!code) { this.setData({ phoneError: '未取得手机号授权，可重试或返回首页稍后绑定' }); return; }
    this.setData({ authorizing: true, phoneError: '' });
    try {
      const user = await api.call('user', 'bindPhone', { code });
      getApp().globalData.user = user;
      this.setData({ phone: user.phone, phoneError: '' });
    } catch (error) { this.setData({ phoneError: error.message || '手机号授权失败，请重试' }); }
    finally { this.setData({ authorizing: false }); }
  },
  backHome() { wx.switchTab({ url: '/pages/index/index' }); },
  async save() {
    if (this.data.saving || this.data.authorizing) return;
    if (!this.data.agreed || !this.data.phone || !this.data.room.trim()) {
      this.setData({ error: '请先阅读并同意协议、授权手机号并填写门牌号' }); return;
    }
    const { communities, communityIndex, buildings, buildingIndex, units, unitIndex, room, agreed } = this.data;
    if (!communities[communityIndex] || !buildings[buildingIndex] || !units[unitIndex]) {
      this.setData({ error: '请先选择有效的小区、楼栋和单元' }); return;
    }
    this.setData({ saving: true, error: '' });
    try {
      const user = await api.call('user', 'setAddress', { communityId: communities[communityIndex]._id,
        buildingId: buildings[buildingIndex]._id, unit: units[unitIndex], room, contactName: this.data.contactName,
        contactPhone: this.data.contactPhone, privacyAgreed: agreed });
      getApp().globalData.user = user;
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  }
});
