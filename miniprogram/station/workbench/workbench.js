const api = require('../../utils/api');
const { display } = require('../../utils/time');
Page({
  data: { loading: true, error: '', batches: [], hasMore: true, exporting: false },
  onLoad() { const today = new Date(); this.setData({ month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` }); },
  onShow() { this.visible = true; this.load(true); },
  onHide() { this.visible = false; },
  onUnload() { this.visible = false; },
  onReachBottom() { if (!this.data.loading && this.data.hasMore) this.load(); },
  async load(reset = false) {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('station', 'listMyBatches', { offset: reset ? 0 : this.data.batches.length },
        { loading: false, silent: true });
      if (!this.visible) return;
      const batches = result.list.map(batch => ({ ...batch, createdText: display(batch.createdAt).slice(0, 16) }));
      this.setData({ batches: reset ? batches : [...this.data.batches, ...batches], hasMore: result.hasMore });
    } catch (error) { if (this.visible) this.setData({ error: error.message || '批次加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  monthChange(event) { this.setData({ month: event.detail.value }); },
  async exportStatement() {
    if (this.data.exporting) return;
    const [year, month] = this.data.month.split('-').map(Number);
    const from = `${this.data.month}-01`;
    const to = `${this.data.month}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
    this.setData({ exporting: true, error: '' });
    try {
      const result = await api.call('station', 'exportStatement', { from, to });
      await new Promise((resolve, reject) => wx.setClipboardData({ data: result.tempFileURL,
        success: () => resolve(), fail: reject }));
      wx.showModal({ title: '对账CSV已生成', content: `${result.count} 个批次，应付 ¥${(result.gross / 100).toFixed(2)}。下载链接已复制，可在浏览器打开。`,
        showCancel: false });
    } catch (error) { this.setData({ error: error.message || '对账导出失败' }); }
    finally { this.setData({ exporting: false }); }
  }
});
