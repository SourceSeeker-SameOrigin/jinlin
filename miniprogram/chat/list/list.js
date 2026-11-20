const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { lifecycle, readList } = require('../../utils/visible-list');

Page({
  ...lifecycle,
  data: { loading: false, error: '', list: [], unreadTotal: 0 },
  load() {
    return readList(this, { list: [], unreadTotal: 0 }, '消息加载失败', async (user, options) => {
      const result = await api.call('chat', 'list', {}, options);
      return { unreadTotal: result.unreadTotal, list: result.list.map(item => ({ ...item,
        lastText: item.lastMessage || '开始聊天', timeText: item.lastAt ? display(item.lastAt) : '' })) };
    });
  },
  open(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: '/chat/room/room?conversationId=' + encodeURIComponent(id) });
  }
});
