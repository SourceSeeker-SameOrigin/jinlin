const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { lifecycle, readList } = require('../../utils/visible-list');

Page({
  ...lifecycle,
  data: { loading: true, error: '', list: [], offset: 0, hasMore: false },
  load(reset = true) {
    const offset = reset ? 0 : this.data.offset;
    return readList(this, {}, '公告加载失败', async (user, options) => {
      const result = await api.call('content', 'listNotices', { communityId: user.communityId, offset }, options);
      const rows = (result.list || []).map(item => ({ ...item, createdText: display(item.createdAt) }));
      return { list: reset ? rows : this.data.list.concat(rows), offset: offset + rows.length, hasMore: result.hasMore };
    });
  },
  loadMore() {
    if (this.data.hasMore && !this.data.loading) return this.load(false);
  }
});
