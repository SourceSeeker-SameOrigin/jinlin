const api = require('../../utils/api');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, error: '', messages: [] },
  onLoad(options) {
    this.caseType = options.caseType || 'complaint';
    this.orderId = options.orderId || '';
    this.reportId = options.reportId || '';
  },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('chat', 'adminPull', { caseType: this.caseType,
        ...(this.orderId ? { orderId: this.orderId } : {}), ...(this.reportId ? { reportId: this.reportId } : {}) },
      { loading: false, silent: true });
      this.setData({ messages: result.list.map(item => ({ ...item, timeText: display(item.createdAt),
        contentText: item.content || (item.type === 'image' ? (item.status === 'pending' ? '图片审核中' : '图片') : '') })) });
    } catch (error) { this.setData({ error: error.message || '聊天记录加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  preview(event) { wx.previewImage({ current: event.currentTarget.dataset.url, urls: [event.currentTarget.dataset.url] }); }
});
