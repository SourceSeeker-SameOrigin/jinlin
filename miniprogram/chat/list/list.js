const api = require('../../utils/api');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, error: '', list: [], unreadTotal: 0 },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('chat', 'list', {}, { loading: false, silent: true });
      this.setData({ unreadTotal: result.unreadTotal, list: result.list.map(item => ({ ...item,
        lastText: item.lastMessage || '开始聊天', timeText: item.lastAt ? display(item.lastAt) : '' })) });
    } catch (error) { this.setData({ error: error.message || '消息加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  open(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: '/chat/room/room?conversationId=' + encodeURIComponent(id) });
  }
});
