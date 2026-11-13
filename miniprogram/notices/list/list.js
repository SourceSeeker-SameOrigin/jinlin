const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { lifecycle, readList } = require('../../utils/visible-list');

function firstPage() {
  return { list: [], offset: 0, hasMore: false, listCommunityId: null };
}

Page({
  ...lifecycle,
  data: { ...firstPage(), loading: true, error: '' },

  load(reset = true) {
    const append = reset === false;
    return readList(this, append ? {} : firstPage(), '公告加载失败', async (user, options) => {
      const communityId = user.communityId;
      const sameList = append && this.data.listCommunityId === communityId;
      if (append && !sameList) this.setData(firstPage());
      const offset = sameList ? this.data.offset : 0;
      const result = await api.call('content', 'listNotices', { communityId, offset }, options);
      const rows = (result.list || []).map(item => ({ ...item, createdText: display(item.createdAt) }));
      return {
        list: sameList ? this.data.list.concat(rows) : rows,
        listCommunityId: communityId,
        offset: offset + rows.length,
        hasMore: result.hasMore
      };
    });
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loading) return this.load(false);
  }
});
