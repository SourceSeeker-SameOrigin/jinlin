const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
const { lifecycle, readList } = require('../../utils/visible-list');

Page({
  ...lifecycle,
  data: { loading: true, error: '', list: [], hasMore: true },
  onPullDownRefresh() {
    return this.load(true).finally(() => wx.stopPullDownRefresh());
  },
  onReachBottom() {
    if (!this.data.loading && this.data.hasMore) return this.load(false);
  },
  load(reset = true) {
    const append = reset === false;
    const list = this.data.list;
    return readList(this, append ? {} : { list: [], hasMore: false }, '活动加载失败', async (user, options) => {
      const sameList = append && this.listCommunityId === user.communityId;
      if (append && !sameList) this.setData({ list: [], hasMore: false });
      const previous = sameList ? list : [];
      const result = await api.call('event', 'list', { offset: previous.length }, options);
      if (!options.isActive()) return;
      this.listCommunityId = user.communityId;
      const rows = result.list.map(item => ({ ...item, feeText: item.fee ? '¥' + yuan(item.fee) : '免费', startText: display(item.startAt) }));
      return { list: previous.concat(rows), hasMore: result.hasMore };
    });
  },
  open(event) { wx.navigateTo({ url: '/events/detail/detail?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
