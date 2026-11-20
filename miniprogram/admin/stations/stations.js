const api = require('../../utils/api');
Page({
  data: { loading: true, busy: false, error: '', rows: [], hasMore: true },
  onShow() { this._hidden = false; return this.load(true); },
  onHide() {
    this._hidden = true;
    this.sequence = (this.sequence || 0) + 1;
  },
  onUnload() { this._closed = true; this.sequence = (this.sequence || 0) + 1; },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  retry() { return this.load(this._failedReset !== false); },
  async load(reset = false) {
    if (this._closed || this._hidden || (!reset && (this.data.loading || this.data.busy || !this.data.hasMore))) return;
    const sequence = this.sequence = (this.sequence || 0) + 1;
    const isActive = () => !this._closed && !this._hidden && sequence === this.sequence;
    const offset = reset ? 0 : this.data.rows.length;
    this._failedReset = reset;
    this.setData({ loading: true, error: '', ...(reset ? { rows: [], hasMore: true } : {}) });
    try {
      await getApp().ensureSession();
      if (!isActive()) return;
      const result = await api.call('station', 'listApplications', { status: 'pending', offset }, { loading: false, silent: true, isActive });
      if (!isActive()) return;
      this.setData({ rows: reset ? result.list : this.data.rows.concat(result.list), hasMore: result.hasMore });
    } catch (error) { if (isActive()) this.setData({ error: error.message || '驿站申请加载失败' }); }
    finally { if (isActive()) this.setData({ loading: false }); }
  },
  async review(event) {
    if (this._closed || this.data.busy || this.data.loading) return;
    const row = this.data.rows[event.currentTarget.dataset.index];
    if (!row) return;
    const sequence = this.sequence;
    const status = event.currentTarget.dataset.status;
    let reviewNote = '';
    if (status === 'rejected') {
      const answer = await new Promise(resolve => wx.showModal({ title: '拒绝申请', editable: true, placeholderText: '填写原因（选填）', success: resolve }));
      if (!answer.confirm) return;
      reviewNote = answer.content || '';
    } else {
      const answer = await new Promise(resolve => wx.showModal({ title: '通过申请', content: `确认授予 ${row.stationName} 驿站账号权限吗？`, success: resolve }));
      if (!answer.confirm) return;
    }
    if (this._closed || this.data.busy || this.data.loading || sequence !== this.sequence) return;
    this.setData({ busy: true, error: '' });
    try {
      await api.call('station', 'reviewApplication', { applicationId: row._id, status, reviewNote });
      if (this._closed) return;
      wx.showToast({ title: status === 'approved' ? '已通过' : '已拒绝', icon: 'success' });
      await this.load(true);
    } catch (error) { if (!this._closed) this.setData({ error: error.message || '审核操作失败' }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  }
});
