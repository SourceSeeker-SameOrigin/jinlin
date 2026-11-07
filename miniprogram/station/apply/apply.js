const api = require('../../utils/api');
const STATUS = { pending: '审核中', approved: '已通过', rejected: '未通过' };
Page({
  data: { loading: true, busy: false, error: '', communities: [], communityIndex: 0, stationIndex: 0, application: null },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const [options, mine] = await Promise.all([
        api.call('station', 'applicationOptions', {}, { loading: false, silent: true }),
        api.call('station', 'myApplication', {}, { loading: false, silent: true })
      ]);
      const communities = options.list || [];
      this.setData({ communities, application: mine.application,
        communityIndex: Math.max(0, communities.findIndex(item => item._id === (mine.application && mine.application.communityId))), stationIndex: 0 });
    } catch (error) { this.setData({ error: error.message || '驿站申请信息加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  chooseCommunity(event) { this.setData({ communityIndex: Number(event.detail.value), stationIndex: 0 }); },
  chooseStation(event) { this.setData({ stationIndex: Number(event.detail.value) }); },
  async submit() {
    if (this.data.busy) return;
    const community = this.data.communities[this.data.communityIndex];
    const station = community && community.stations[this.data.stationIndex];
    if (!community || !station) { this.setData({ error: '请选择小区和驿站' }); return; }
    this.setData({ busy: true, error: '' });
    try {
      await api.call('station', 'apply', { communityId: community._id, stationCode: station.code });
      wx.showToast({ title: '申请已提交', icon: 'success' });
      await this.load();
    } catch (error) { this.setData({ error: error.message || '申请提交失败' }); }
    finally { this.setData({ busy: false }); }
  },
  statusText(status) { return STATUS[status] || status; }
});
