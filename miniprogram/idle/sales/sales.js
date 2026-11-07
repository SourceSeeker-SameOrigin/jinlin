const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, error: '', list: [] },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('idle', 'sales', {}, { loading: false, silent: true });
      const statusText = { pending_pay: '待付款', paid: '待接单', accepted: '待交付', delivered: '待买家确认',
        completed: '已完成', cancelled: '已取消', refunded: '已退款', closed: '已关闭' };
      this.setData({ list: result.list.map(item => ({ ...item, priceText: yuan(item.price), timeText: display(item.createdAt),
        statusText: statusText[item.status] || item.status })) });
    } catch (error) { this.setData({ error: error.message || '订单加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  open(event) { wx.navigateTo({ url: '/idle/sale/sale?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
