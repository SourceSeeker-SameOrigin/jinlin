const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { yuan } = require('../../utils/money');
Page({
  data: { missingRecord: false, loading: true, busy: false, error: '', post: null, comments: [], commentText: '' },
  onLoad(options = {}) {
    this.postId = typeof options.id === 'string' ? options.id.trim() : '';
    this.setData({ missingRecord: !this.postId, loading: !!this.postId });
  },
  onShow() { this.load(); },
  async load() {
    if (!this.postId) return;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('board', 'detail', { postId: this.postId }, { loading: false, silent: true });
      const post = { ...result.post, timeText: display(result.post.createdAt), imageUrls: result.post.images,
        departText: result.post.carry ? display(result.post.carry.departAt) : '',
        returnText: result.post.carry && result.post.carry.returnAt ? display(result.post.carry.returnAt) : '',
        rewardText: result.post.reward ? yuan(result.post.reward) : '',
        slotText: result.post.slot ? result.post.slot.date + ' ' + result.post.slot.start + '—' + result.post.slot.end : '',
        statusText: result.post.status === 'pending_pay' ? '待支付' : result.post.status === 'open' ? '待接单' :
          result.post.status === 'taken' ? '服务处理中' : result.post.status === 'done' ? '已完成' : '已关闭' };
      this.setData({ post, comments: result.comments.map(item => ({ ...item, timeText: display(item.createdAt) })) });
      wx.setNavigationBarTitle({ title: post.type === 'task' ? '悬赏详情' : post.type === 'carry' ? '出行帮带' : '求助详情' });
    } catch (error) { this.setData({ error: error.message || '内容加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  input(event) { this.setData({ commentText: event.detail.value }); },
  async comment() {
    if (!this.postId) return;
    if (this.data.busy || !this.data.commentText.trim()) return;
    this.commentRequestId = this.commentRequestId || Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    this.setData({ busy: true, error: '' });
    try {
      await api.call('board', 'comment', { postId: this.postId,
        requestId: this.commentRequestId, content: this.data.commentText });
      this.commentRequestId = null;
      this.setData({ commentText: '' }); await this.load();
    } catch (error) { this.setData({ error: error.message || '评论失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async report() {
    if (!this.postId) return;
    const answer = await new Promise(resolve => wx.showModal({ title: '举报内容', content: '确认举报这条内容吗？', success: resolve }));
    if (!answer.confirm) return;
    try {
      await api.call('board', 'report', { targetType: 'post', targetId: this.postId, reason: '不当内容', text: '' });
      wx.showToast({ title: '已提交举报', icon: 'success' });
    } catch (error) { this.setData({ error: error.message || '举报失败' }); }
  },
  async reportComment(event) {
    if (!this.postId) return;
    const commentId = event.currentTarget.dataset.id;
    const answer = await new Promise(resolve => wx.showModal({ title: '举报评论', content: '确认举报这条评论吗？', success: resolve }));
    if (!answer.confirm) return;
    try {
      await api.call('board', 'report', { targetType: 'comment', targetId: commentId, reason: '不当内容', text: '' });
      wx.showToast({ title: '已提交举报', icon: 'success' });
    } catch (error) { this.setData({ error: error.message || '举报失败' }); }
  },
  async close() {
    if (!this.postId) return;
    const answer = await new Promise(resolve => wx.showModal({ title: '关闭内容', content: '关闭后将不再接受评论。确定吗？', success: resolve }));
    if (!answer.confirm) return;
    try { await api.call('board', 'close', { postId: this.postId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '关闭失败' }); }
  },
  continuePayment() {
    if (!this.postId) return; if (this.data.post && this.data.post.orderId) wx.navigateTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(this.data.post.orderId) }); },
  preview(event) {
    if (!this.postId) return; require('../../utils/media-links').preview({ current: event.currentTarget.dataset.url, urls: this.data.post.imageUrls }); },
  onShareAppMessage() {
    if (!this.postId) return { title: '需求广场', path: '/board/list/list' }; return { title: this.data.post && this.data.post.title || '近邻帮需求',
    path: '/board/detail/detail?id=' + encodeURIComponent(this.postId) }; }
});
