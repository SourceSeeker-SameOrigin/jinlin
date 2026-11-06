const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { display } = require('../../utils/time');
Page({
  data: { loading: true, sending: false, error: '', messages: [], content: '', readOnly: false },
  onLoad(options) { this.orderId = options.orderId || ''; this.conversationId = options.conversationId || ''; this.afterId = ''; },
  onShow() { this.start(); },
  onHide() { this.stop(); },
  onUnload() { this.stop(); },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.polling = false; },
  async start() {
    this.stop();
    try {
      await getApp().ensureSession();
      if (!this.conversationId && this.orderId) {
        const opened = await api.call('chat', 'open', { orderId: this.orderId }, { loading: false, silent: true });
        this.conversationId = opened.conversationId;
      }
      if (!this.conversationId) throw new Error('聊天会话不存在');
      await this.pull();
      this.timer = setInterval(() => this.pull(), 3000);
    } catch (error) { this.setData({ error: error.message || '聊天加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async pull() {
    if (this.polling || !this.conversationId) return;
    this.polling = true;
    try {
      const result = await api.call('chat', 'pull', { conversationId: this.conversationId, afterId: this.afterId },
        { loading: false, silent: true });
      if (result.lastId) this.afterId = result.lastId;
      if (result.list.length) {
        const messages = [...this.data.messages, ...result.list].map(item => ({ ...item, timeText: display(item.createdAt) }));
        this.setData({ messages, scrollTarget: 'message-' + messages[messages.length - 1]._id });
      }
      if (result.unread > 0) await api.call('chat', 'markRead', { conversationId: this.conversationId },
        { loading: false, silent: true });
      this.setData({ readOnly: result.readOnly, unread: result.unread, error: '' });
    } catch (error) { this.setData({ error: error.message || '消息刷新失败' }); }
    finally { this.polling = false; }
  },
  input(event) { this.setData({ content: event.detail.value }); },
  async send() {
    if (this.data.sending || this.data.readOnly) return;
    const content = this.data.content.trim();
    if (!content) return;
    const needsPrivacyConfirm = /(?:\d{11}|微信号?|wechat)/i.test(content);
    if (needsPrivacyConfirm) {
      const answer = await new Promise(resolve => wx.showModal({ title: '隐私提醒',
        content: '为保护隐私，建议不要发送手机号或微信号。仍要发送吗？', success: resolve }));
      if (!answer.confirm) return;
    }
    await this.sendMessage({ type: 'text', content });
  },
  async image() {
    if (this.data.sending || this.data.readOnly) return;
    try {
      const files = await uploadPhotos('chat/' + this.conversationId, 1);
      await this.sendMessage({ type: 'image', fileId: files[0] });
    } catch (error) { this.setData({ error: error.message || '图片发送失败' }); }
  },
  async sendMessage(data) {
    this.setData({ sending: true, error: '' });
    try {
      await api.call('chat', 'send', { conversationId: this.conversationId, ...data }, { loading: false });
      this.setData({ content: '' });
      await this.pull();
    } catch (error) { this.setData({ error: error.message || '发送失败' }); }
    finally { this.setData({ sending: false }); }
  }
});
