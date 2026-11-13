const ads = require('../../utils/ads');
const api = require('../../utils/api');
const { lifecycle, readList } = require('../../utils/visible-list');

Page({
  ...lifecycle,
  data: { ads: [], adError: '', loading: true, error: '', list: [] },
  retryAds() { return ads.load(this, 'shops_top', this.adCommunityId); },
  recordAd(event) { ads.record(this,event.currentTarget.dataset.id,'ad_view'); },
  openAd(event) { ads.open(this,event); },
  load() {
    ads.clear(this);
    return readList(this, { list: [] }, '商家列表加载失败', async (user, options) => {
      const communityId = user.communityId;
      await ads.load(this, 'shops_top', communityId, options.isActive);
      if (!options.isActive()) return;
      const result = await api.call('merchant', 'listForCommunity', { communityId }, options);
      return { list: (result.list || []).map(item => ({ ...item,
        ratingText: item.ratingCount ? (item.ratingSum / item.ratingCount).toFixed(1) : '暂无评价' })) };
    });
  },
  open(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: '/shops/detail/detail?merchantId=' + encodeURIComponent(id) });
  }
});
