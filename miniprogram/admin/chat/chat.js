const api = require('../../utils/api');
const { display } = require('../../utils/time');

function emptyView() {
  return { messages: [], lastId: '', hasMore: false, auditConfirmed: false, pageError: '' };
}

function networkFailure(error) {
  return error.code === 'E_NETWORK' || (!error.code && /network|timeout|网络|超时/i.test(error.errMsg || error.message || ''));
}

Page({
  data: { ...emptyView(), loading: false, error: '' },
  onLoad(options) {
    this.caseType = options.caseType || 'complaint';
    this.orderId = options.orderId || '';
    this.reportId = options.reportId || '';
  },
  onShow() { this.inactive = false; return this.load(); },
  onHide() {
    this.inactive = true;
    this.setData({ ...emptyView(), loading: false, error: '' });
  },
  onUnload() { this.inactive = true; },
  load() { return this.read(false); },
  loadMore() { return this.read(true); },
  async read(append) {
    if (this.inactive || (append && (this.data.loading || !this.data.hasMore))) return;
    const sequence = this.loadSequence = (this.loadSequence || 0) + 1;
    const isActive = () => !this.inactive && sequence === this.loadSequence;
    const afterId = append ? this.data.lastId : '';
    this.setData({ ...(append ? {} : emptyView()), loading: true, error: '', pageError: '' });
    try {
      await getApp().ensureSession();
      if (!isActive()) return;
      const result = await api.call('chat', 'adminPull', { caseType: this.caseType,
        ...(this.orderId ? { orderId: this.orderId } : {}), ...(this.reportId ? { reportId: this.reportId } : {}),
        ...(append ? { afterId } : {}) }, { loading: false, silent: true, isActive, redirectOnForbidden: false });
      if (!isActive()) return;
      if (result.hasMore && (!result.lastId || result.lastId <= afterId)) throw new Error('消息分页位置异常，请刷新重试');
      const byId = new Map((append ? this.data.messages : []).map(item => [item._id, item]));
      for (const item of result.list) {
        byId.set(item._id, { ...item, timeText: display(item.createdAt),
          contentText: item.content || (item.type === 'image' ? (item.status === 'pending' ? '图片审核中' : '图片') : '') });
      }
      // adminPull can include the reported message ahead of its chronological page.
      const messages = [...byId.values()].sort((a, b) => a._id.localeCompare(b._id));
      this.setData({ auditConfirmed: true, messages, lastId: result.lastId || '', hasMore: !!result.hasMore });
    } catch (error) {
      if (!isActive()) return;
      const message = error.message || '聊天记录读取失败，请重试';
      if (append && networkFailure(error)) this.setData({ pageError: message });
      else this.setData({ ...emptyView(), error: message });
    } finally {
      if (isActive()) this.setData({ loading: false });
    }
  },
  preview(event) {
    const url = event.currentTarget.dataset.url;
    if (this.inactive || !url || !this.data.messages.some(item => item.fileId === url)) return;
    return require('../../utils/media-links').preview({ current: url, urls: [url] });
  }
});
