const api = require('../../utils/api');
const TYPES = { post:'帖子', comment:'评论', idle:'闲置', event:'活动', message:'聊天消息', merchant:'商家服务' };
Page({
  data: { loading: false, busy: false, error: '', rows: [], hasMore: true, status: 'pending' },
  onShow() { this._hidden = false; return this.load(true); },
  onHide() { this._hidden = true; this.sequence = (this.sequence || 0) + 1; },
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
      const result = await api.call('content', 'listReports', { status: this.data.status, offset }, { loading: false, silent: true, isActive });
      if (!isActive()) return;
      const rows = result.list.map(item => ({ ...item, typeLabel: TYPES[item.targetType] || item.targetType }));
      this.setData({ rows: reset ? rows : [...this.data.rows, ...rows], hasMore: result.hasMore });
    } catch (error) { if (isActive()) this.setData({ error: error.message || '举报列表加载失败' }); }
    finally { if (isActive()) this.setData({ loading: false }); }
  },
  chooseStatus(event) { if (this._closed || this.data.busy) return; this.setData({ status: event.currentTarget.dataset.status }); this.load(true); },
  openChat(event) {
    if (this._closed || this.data.loading || this.data.busy) return;
    const row = this.data.rows[event.currentTarget.dataset.index];
    if (!row) return;
    wx.navigateTo({ url: '/admin/chat/chat?caseType=report&reportId=' + encodeURIComponent(row._id) });
  },
  async resolve(event) {
    const row = this.data.rows[event.currentTarget.dataset.index];
    const status = event.currentTarget.dataset.status;
    if (this._closed || this.data.busy || this.data.loading || !row) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('content', 'resolveReport', { reportId: row._id, status }); await this.load(true); }
    catch (error) { if (!this._closed) this.setData({ error: error.message || '提交审核结果失败' }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  },
  async moderate(event) {
    const row = this.data.rows[event.currentTarget.dataset.index];
    const kind = event.currentTarget.dataset.kind;
    if (this._closed || this.data.busy || this.data.loading || !row) return;
    this.setData({ busy: true, error: '' });
    try {
      if (kind === 'hide' || kind === 'show') await api.call('content', 'moderateContent', {
        targetType: row.targetType, targetId: row.targetId, communityId: row.communityId, hidden: kind === 'hide' });
      else if (row.authorUserId) await api.call('content', 'moderateUser', { userId: row.authorUserId,
        operation: kind === 'mute' ? 'mute' : 'block', hours: 24 });
      else throw new Error('无法定位内容发布者账号');
      await this.load(true);
    } catch (error) { if (!this._closed) this.setData({ error: error.message || '内容管理操作失败' }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  }
});
