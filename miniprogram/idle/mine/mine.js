const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
Page({
  data: { loading: false, error: '', list: [] },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await api.call('idle', 'mine', {}, { loading: false, silent: true });
      const statusText = { on_sale: '在售', reserved: '交易中', sold: '已售', removed: '已下架', hidden: '审核中' };
      this.setData({ list: result.list.map(item => ({ ...item, priceText: yuan(item.price),
        statusText: item.moderationHidden ? '审核中' : statusText[item.status] || item.status })) });
    } catch (error) { this.setData({ error: error.message || '闲置加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  open(event) { wx.navigateTo({ url: '/idle/detail/detail?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  sales() { wx.navigateTo({ url: '/idle/sales/sales' }); },
  income() { wx.navigateTo({ url: '/idle/income/income' }); },
  create() { wx.navigateTo({ url: '/idle/create/create' }); }
});
