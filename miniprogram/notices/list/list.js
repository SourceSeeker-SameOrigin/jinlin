const api = require('../../utils/api');
const { display } = require('../../utils/time');
Page({
  data: { loading: true, error: '', list: [], offset: 0, hasMore: false },
  onLoad() { this.load(true); },
  async load(reset = true) {
    const offset = reset ? 0 : this.data.offset;
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      const result = await api.call('content', 'listNotices', { communityId: user.communityId, offset }, { loading: false, silent: true });
      const list = (result.list || []).map(item => ({ ...item, createdText: display(item.createdAt) }));
      this.setData({ list: reset ? list : this.data.list.concat(list), offset: offset + list.length, hasMore: result.hasMore });
    } catch (error) { this.setData({ error: error.message || '公告加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  loadMore() { if (this.data.hasMore && !this.data.loading) this.load(false); }
});
