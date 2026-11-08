const api = require('../../utils/api');
const TYPES = { post:'帖子', comment:'评论', idle:'闲置', event:'活动', message:'聊天消息', merchant:'商家服务' };
Page({
  data: { loading: false, busy: false, error: '', rows: [], hasMore: true, status: 'pending' },
  onShow() { this.load(true); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  async load(reset = false) {
    this.setData({ loading: true, error: '' });
    try {
      const result = await api.call('content', 'listReports', { status: this.data.status, offset: reset ? 0 : this.data.rows.length }, { loading: false, silent: true });
      const rows = result.list.map(item => ({ ...item, typeLabel: TYPES[item.targetType] || item.targetType }));
      this.setData({ rows: reset ? rows : [...this.data.rows, ...rows], hasMore: result.hasMore });
    } catch (error) { this.setData({ error: error.message || '举报列表加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  chooseStatus(event) { this.setData({ status: event.currentTarget.dataset.status }); this.load(true); },
  openChat(event) {
    const row = this.data.rows[event.currentTarget.dataset.index];
    wx.navigateTo({ url: '/admin/chat/chat?caseType=report&reportId=' + encodeURIComponent(row._id) });
  },
  async resolve(event) {
    const row = this.data.rows[event.currentTarget.dataset.index];
    const status = event.currentTarget.dataset.status;
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('content', 'resolveReport', { reportId: row._id, status }); await this.load(true); }
    catch (error) { this.setData({ error: error.message || '提交审核结果失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async moderate(event) {
    const row = this.data.rows[event.currentTarget.dataset.index];
    const kind = event.currentTarget.dataset.kind;
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      if (kind === 'hide' || kind === 'show') await api.call('content', 'moderateContent', {
        targetType: row.targetType, targetId: row.targetId, communityId: row.communityId, hidden: kind === 'hide' });
      else if (row.authorUserId) await api.call('content', 'moderateUser', { userId: row.authorUserId,
        operation: kind === 'mute' ? 'mute' : 'block', hours: 24 });
      else throw new Error('无法定位内容发布者账号');
      await this.load(true);
    } catch (error) { this.setData({ error: error.message || '内容管理操作失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
