const reportAction = require('../../utils/report');
const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { display } = require('../../utils/time');
Page({
  data: { loading: true, ready: false, loadError: false, sending: false, error: '', messages: [], content: '', readOnly: false },
  onLoad(options) { this.orderId = options.orderId || ''; this.conversationId = options.conversationId || ''; this.afterId = ''; },
  onShow() { this.start(); },
  onHide() { this.stop(); },
  onUnload() { this.stop(); },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.polling = false;
    this.generation = (this.generation || 0) + 1; this.setData({ ready: false }); },
  async start() {
    this.stop();
    const generation = this.generation;
    this.setData({ loading: true, ready: false, loadError: false, error: '' });
    try {
      await getApp().ensureSession();
      if (generation !== this.generation) return;
      if (!this.conversationId && this.orderId) {
        const opened = await api.call('chat', 'open', { orderId: this.orderId }, { loading: false, silent: true });
        if (generation !== this.generation) return;
        this.conversationId = opened.conversationId;
      }
      if (!this.conversationId) throw new Error('聊天会话不存在');
      const loaded = await this.pull();
      if (loaded && generation === this.generation) this.timer = setInterval(() => this.pull(), 3000);
    } catch (error) { if (generation === this.generation) this.setData({ ready: false, loadError: true, error: error.message || '聊天加载失败' }); }
    finally { if (generation === this.generation) this.setData({ loading: false }); }
  },
  async pull() {
    if (this.polling || !this.conversationId) return;
    this.polling = true;
    const generation = this.generation;
    try {
      const result = await api.call('chat', 'pull', { conversationId: this.conversationId, afterId: this.afterId },
        { loading: false, silent: true });
      if (generation !== this.generation) return false;
      if (result.lastId) this.afterId = result.lastId;
      if (result.list.length) {
        const messages = [...this.data.messages, ...result.list].map(item => ({ ...item, timeText: display(item.createdAt) }));
        this.setData({ messages, scrollTarget: 'message-' + messages[messages.length - 1]._id });
      }
      if (result.unread > 0) await api.call('chat', 'markRead', { conversationId: this.conversationId },
        { loading: false, silent: true });
      if (generation !== this.generation) return false;
      this.setData({ ready: true, loadError: false, readOnly: result.readOnly, unread: result.unread, error: '' });
      return true;
    } catch (error) { if (generation === this.generation) this.setData({ ready: false, loadError: true, error: error.message || '消息刷新失败' }); return false; }
    finally { if (generation === this.generation) this.polling = false; }
  },
  async reportContent(event) {
    if(this.reporting)return;this.reporting=true;
    try { await reportAction.submit('message',event.currentTarget.dataset.id); }
    catch(error){this.setData({error:error.message||'举报提交失败'});}
    finally{this.reporting=false;}
  },
  input(event) { this.setData({ content: event.detail.value }); },
  async send() {
    if (!this.data.ready || this.data.loading || this.data.sending || this.data.readOnly) return;
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
    if (!this.data.ready || this.data.loading || this.data.sending || this.data.readOnly) return;
    try {
      const files = await uploadPhotos('chat/' + this.conversationId, 1);
      await this.sendMessage({ type: 'image', fileId: files[0] });
    } catch (error) { this.setData({ error: error.message || '图片发送失败' }); }
  },
  async sendMessage(data) {
    if (!this.data.ready || this.data.loading || this.data.sending || this.data.readOnly || !this.conversationId) return;
    this.setData({ sending: true, error: '' });
    try {
      await api.call('chat', 'send', { conversationId: this.conversationId, ...data }, { loading: false });
      this.setData({ content: '' });
      await this.pull();
    } catch (error) { this.setData({ error: error.message || '发送失败' }); }
    finally { this.setData({ sending: false }); }
  }
});
