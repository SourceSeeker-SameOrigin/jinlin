const api = require('../../utils/api');
const { pay } = require('../../utils/payment');
Page({
  data: { busy: false, error: '', requirement: '', addresses: [], addressIndex: 0 },
  onLoad(options) { this.serviceId = options.serviceId; },
  async onShow() {
    try { const user = await getApp().ensureSession(); const addresses = user.addresses || [];
      this.setData({ addresses: addresses.map(item => ({ ...item, label: item.label + ' · ' + item.room + ' · ' + item.contactName })) });
    } catch (error) { this.setData({ error: error.message || '地址加载失败' }); }
  },
  input(event) { this.setData({ requirement: event.detail.value }); },
  address(event) { this.setData({ addressIndex: Number(event.detail.value) }); },
  async submit() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const requestId = 'merchant_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
      const selectedAddress = this.data.addresses[this.data.addressIndex];
      const result = await api.call('merchant', 'createBooking', { serviceId: this.serviceId, requestId, requirement: this.data.requirement,
        ...(selectedAddress ? { addressId: selectedAddress.id } : {}) });
      if (result.status === 'pending_quote') {
        wx.showToast({ title: '已提交，等待商家报价', icon: 'success' });
      } else {
        if (result.paymentError) {
          wx.showToast({ title: '订单已建立，请在详情重试支付', icon: 'none' });
          wx.redirectTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(result.orderId) });
          return;
        }
        await pay(result);
        wx.showToast({ title: '预约已提交', icon: 'success' });
      }
      wx.redirectTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(result.orderId) });
    } catch (error) { this.setData({ error: error.message || '预约未完成，请重试' }); }
    finally { this.setData({ busy: false }); }
  }
});
