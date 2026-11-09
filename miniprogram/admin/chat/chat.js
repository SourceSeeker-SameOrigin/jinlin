const api = require('../../utils/api');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, error: '', messages: [], auditConfirmed: false },
  onLoad(options) {
    this.caseType = options.caseType || 'complaint';
    this.orderId = options.orderId || '';
    this.reportId = options.reportId || '';
  },
  onShow() { this.load(); },
  async load() {
    const sequence = this.loadSequence = (this.loadSequence || 0) + 1;
    this.setData({ loading: true, error: '', auditConfirmed: false });
    try {
      await getApp().ensureSession();
      const result = await api.call('chat', 'adminPull', { caseType: this.caseType,
        ...(this.orderId ? { orderId: this.orderId } : {}), ...(this.reportId ? { reportId: this.reportId } : {}) },
      { loading: false, silent: true });
      if (sequence !== this.loadSequence) return;
      this.setData({ auditConfirmed: true, messages: result.list.map(item => ({ ...item, timeText: display(item.createdAt),
        contentText: item.content || (item.type === 'image' ? (item.status === 'pending' ? '图片审核中' : '图片') : '') })) });
    } catch (error) { if (sequence === this.loadSequence) this.setData({ error: error.message || '聊天记录加载失败' }); }
    finally { if (sequence === this.loadSequence) this.setData({ loading: false }); }
  },
  preview(event) { require('../../utils/media-links').preview({ current: event.currentTarget.dataset.url, urls: [event.currentTarget.dataset.url] }); }
});
