const api = require('../../utils/api');
Page({
  data: { loading: true, saving: false, error: '', communities: [], communityIndex: 0, community: null, unitsText: '',
    stationsText: '', pricesText: '', dutyText: '', blacklistText: '', name: '' },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可以修改小区配置');
      const page = await api.call('catalog', 'listCommunities', {}, { loading: false, silent: true });
      this.setData({ communities: page.list });
      const index = Math.max(0, page.list.findIndex(item => item._id === user.communityId));
      await this.selectCommunity(index);
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async selectCommunity(index) {
    const item = this.data.communities[index];
    if (!item) return;
    const community = await api.call('catalog', 'getCommunity', { communityId: item._id }, { loading: false, silent: true });
    this.setData({ communityIndex: index, community, name: community.name,
      unitsText: community.buildings.map(building => building.name + ':' + building.units.join(',')).join('\n'),
      stationsText: JSON.stringify(community.stations, null, 2), pricesText: JSON.stringify(community.prices, null, 2),
      dutyText: JSON.stringify(community.dutyWindows, null, 2) });
  },
  chooseCommunity(event) { this.selectCommunity(Number(event.detail.value)).catch(error => this.setData({ error: error.message })); },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  async saveCommunity() {
    if (this.data.saving) return;
    this.setData({ saving: true, error: '' });
    try {
      const stations = JSON.parse(this.data.stationsText);
      const prices = JSON.parse(this.data.pricesText);
      const dutyWindows = JSON.parse(this.data.dutyText);
      await api.call('admin', 'updateCommunity', { communityId: this.data.community._id, name: this.data.name,
        stations, prices, dutyWindows });
      wx.showToast({ title: '配置已保存', icon: 'success' });
      await this.selectCommunity(this.data.communityIndex);
    } catch (error) { this.setData({ error: error.message || '配置格式不正确，请检查 JSON' }); }
    finally { this.setData({ saving: false }); }
  },
  async addBuilding() {
    const parts = this.data.unitsText.split('\n').filter(Boolean);
    const line = parts[parts.length - 1] || '';
    const [name, units = ''] = line.split(':');
    if (!name || !units) { this.setData({ error: '在单元列表末尾按“楼栋名称:1单元,2单元”填写后再添加' }); return; }
    try {
      await api.call('admin', 'upsertBuilding', { communityId: this.data.community._id, name, units: units.split(',') });
      wx.showToast({ title: '楼栋已添加', icon: 'success' }); await this.selectCommunity(this.data.communityIndex);
    } catch (error) { this.setData({ error: error.message }); }
  }
});
