const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, error: '', rows: [], pending: '0.00', settled: '0.00', hasMore: true },
  onShow() { this.load(true); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  retry() { this.load(true); },
  async load(reset = false) {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('provider', 'earnings', { offset: reset ? 0 : this.data.rows.length }, { loading: false, silent: true });
      const rows = result.list.map(row => ({ ...row, amountText: yuan(row.amount), time: display(row.createdAt) }));
      this.setData({ rows: reset ? rows : [...this.data.rows, ...rows], pending: yuan(result.pending), settled: yuan(result.settled), hasMore: result.hasMore });
    } catch (error) { this.setData({ error: error.message || '收入加载失败' }); }
    finally { this.setData({ loading: false }); }
  }
});
