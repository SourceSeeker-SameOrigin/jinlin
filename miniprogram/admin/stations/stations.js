const api = require('../../utils/api');
Page({
  data: { loading: true, busy: false, error: '', rows: [], hasMore: true },
  onShow() { this.load(true); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  async load(reset = false) {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('station', 'listApplications', { status: 'pending', offset: reset ? 0 : this.data.rows.length }, { loading: false, silent: true });
      this.setData({ rows: reset ? result.list : this.data.rows.concat(result.list), hasMore: result.hasMore });
    } catch (error) { this.setData({ error: error.message || '驿站申请加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async review(event) {
    if (this.data.busy) return;
    const row = this.data.rows[event.currentTarget.dataset.index];
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
    this.setData({ busy: true, error: '' });
    try {
      await api.call('station', 'reviewApplication', { applicationId: row._id, status, reviewNote });
      wx.showToast({ title: status === 'approved' ? '已通过' : '已拒绝', icon: 'success' });
      await this.load(true);
    } catch (error) { this.setData({ error: error.message || '审核操作失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
