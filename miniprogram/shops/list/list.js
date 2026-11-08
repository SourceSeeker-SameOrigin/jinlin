const ads = require('../../utils/ads');
const api = require('../../utils/api');
Page({
  data: { ads: [], adError: '', loading: true, error: '', list: [] },
  retryAds() { return ads.load(this, 'shops_top', this.adCommunityId); },
  recordAd(event) { ads.record(this,event.currentTarget.dataset.id,'ad_view'); },
  openAd(event) { ads.open(this,event); },
  onShow() { this.load(); },
  onHide() { ads.clear(this); },
  async load() {
    ads.clear(this);
    this.setData({ loading: true, error: '', list: [] });
    try {
      const user = await getApp().ensureSession();
      await ads.load(this, 'shops_top', user.communityId);
      const result = await api.call('merchant', 'listForCommunity', { communityId: user.communityId }, { loading: false, silent: true });
      this.setData({ list: (result.list || []).map(item => ({ ...item,
        ratingText: item.ratingCount ? (item.ratingSum / item.ratingCount).toFixed(1) : '暂无评价' })) });
    } catch (error) { this.setData({ error: error.message || '商家列表加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  open(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: '/shops/detail/detail?merchantId=' + encodeURIComponent(id) });
  }
});
