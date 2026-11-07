const api = require('../../utils/api');
Page({
  data: { loading: true, error: '', merchant: null, list: [] },
  onLoad(options) { this.merchantId = options.merchantId; },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      const result = await api.call('merchant', 'servicesForMerchant', { merchantId: this.merchantId, communityId: user.communityId }, { loading: false, silent: true });
      const merchant = result.merchant;
      this.setData({ merchant: { ...merchant, ratingText: merchant.ratingCount ? (merchant.ratingSum / merchant.ratingCount).toFixed(1) : '暂无评价' },
        list: (result.list || []).map(item => ({ ...item, priceText: '¥' + (item.price / 100).toFixed(2) })) });
    } catch (error) { this.setData({ error: error.message || '商家详情加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  book(event) { wx.navigateTo({ url: '/shops/booking/booking?serviceId=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
