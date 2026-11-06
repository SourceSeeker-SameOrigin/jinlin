const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { STATUS_TEXT } = require('../../utils/status');
Page({
  data: { loading: true, error: '', metrics: null, communities: [], communityIndex: 0 },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin') && !user.roles.includes('property')) throw new Error('无权查看管理看板');
      if (user.roles.includes('admin')) {
        const list = await api.call('catalog', 'listCommunities', {}, { loading: false, silent: true });
        this.setData({ communities: list.list, communityIndex: Math.max(0, list.list.findIndex(item => item._id === user.communityId)) });
        const templates = await api.call('admin', 'notificationTemplates', {}, { loading: false, silent: true });
        if (templates.unaccepted) await new Promise(resolve => wx.requestSubscribeMessage({ tmplIds: [templates.unaccepted], success: resolve, fail: resolve }));
      }
      this.user = user;
      await this.refresh();
    } catch (error) { this.setData({ error: error.message || '看板加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async refresh() {
    const communityId = this.user.roles.includes('admin') ? this.data.communities[this.data.communityIndex]._id : this.user.communityId;
    if (!communityId) throw new Error('没有可查看的小区');
    const metrics = await api.call('admin', 'dashboard', { communityId }, { loading: false, silent: true });
    this.setData({ metrics: { ...metrics, turnoverYuan: yuan(metrics.serviceFeeTurnover), actualYuan: yuan(metrics.actualIncome),
      refundYuan: yuan(metrics.refundTotal), acceptRateText: (metrics.acceptRate15m / 100).toFixed(1) + '%',
      statusRows: Object.entries(metrics.orders).map(([status, count]) => ({ status, count, label: STATUS_TEXT[status] || status })) } });
  },
  chooseCommunity(event) { this.setData({ communityIndex: Number(event.detail.value) }); this.refresh().catch(error => this.setData({ error: error.message })); }
});
