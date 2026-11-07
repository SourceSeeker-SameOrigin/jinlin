const api = require('../../utils/api');
const { yuan } = require('../../utils/money');

Page({
  data: { loading: false, busy: false, error: '', list: [], hasMore: true },
  onShow() { this.visible = true; this.load(true); },
  onHide() { this.visible = false; },
  onUnload() { this.visible = false; },
  onReachBottom() { if (!this.data.loading && this.data.hasMore) this.load(); },
  async load(reset = false) {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('station', 'providerHall', { offset: reset ? 0 : this.data.list.length }, { loading: false, silent: true });
      if (!this.visible) return;
      this.setData({ list: reset ? result.list.map(item => ({ ...item, incomeText: yuan(item.estimatedIncome) })) :
        [...this.data.list, ...result.list.map(item => ({ ...item, incomeText: yuan(item.estimatedIncome) }))], hasMore: result.hasMore });
    } catch (error) { if (this.visible) this.setData({ error: error.message || '批次加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async accept(event) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const result = await api.call('station', 'acceptBatch', { batchId: event.currentTarget.dataset.id });
      wx.navigateTo({ url: '/station/batch/batch?id=' + encodeURIComponent(result.batchId) });
    } catch (error) { this.setData({ error: error.message || '接单失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
