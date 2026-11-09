const reportAction = require('../../utils/report');
const api = require('../../utils/api');
Page({
  data: { missingRecord: false, loading: true, error: '', merchant: null, list: [] },
  onLoad(options = {}) {
    this.merchantId = typeof options.merchantId === 'string' ? options.merchantId.trim() : '';
    this.setData({ missingRecord: !this.merchantId, loading: !!this.merchantId });
  },
  onShow() { this.load(); },
  async reportContent(event) {
    if (!this.merchantId) return;
    if(this.reporting)return;this.reporting=true;
    try { await reportAction.submit('merchant',this.merchantId); }
    catch(error){this.setData({error:error.message||'举报提交失败'});}
    finally{this.reporting=false;}
  },
  async load() {
    if (!this.merchantId) return;
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
  book(event) {
    if (!this.merchantId) return; wx.navigateTo({ url: '/shops/booking/booking?serviceId=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
