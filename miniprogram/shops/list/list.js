const api = require('../../utils/api');
Page({
  data: { loading: true, error: '', list: [] },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
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
