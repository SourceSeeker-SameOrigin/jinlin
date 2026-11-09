const api = require('../../utils/api');
const { pay } = require('../../utils/payment');
Page({
  data: { missingRecord: false, busy: false, error: '', requirement: '', addresses: [], addressIndex: 0 },
  onLoad(options = {}) {
    this.serviceId = typeof options.serviceId === 'string' ? options.serviceId.trim() : '';
    this.setData({ missingRecord: !this.serviceId, loading: !!this.serviceId });
  },
  async onShow() {
    if (!this.serviceId) return;
    try { const user = await getApp().ensureSession(); const addresses = user.addresses || [];
      this.setData({ addresses: addresses.map(item => ({ ...item, label: [item.buildingName, item.unit, item.room, item.contactName].filter(value => typeof value === 'string' && value.trim()).join(' · ') || '已绑定地址' })) });
    } catch (error) { this.setData({ error: error.message || '地址加载失败' }); }
  },
  input(event) { this.setData({ requirement: event.detail.value }); },
  address(event) { this.setData({ addressIndex: Number(event.detail.value) }); },
  openOrder() {
    if (!this.serviceId) return; wx.redirectTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(this.orderId) }); },
  async submit() {
    if (!this.serviceId) return;
    if (this.data.busy) return;
    if (this.orderId) { this.openOrder(); return; }
    this.setData({ busy: true, error: '' });
    try {
      const selectedAddress = this.data.addresses[this.data.addressIndex];
      const payload = { serviceId: this.serviceId, requirement: this.data.requirement.trim(),
        ...(selectedAddress ? { addressId: selectedAddress.id } : {}) };
      const key = JSON.stringify(payload);
      if (!this.pendingRequest || this.pendingRequest.key !== key) this.pendingRequest = { key,
        requestId: 'merchant_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9) };
      const result = await api.call('merchant', 'createBooking', { ...payload, requestId: this.pendingRequest.requestId });
      if (!result.orderId) throw new Error('订单结果暂不可用，请重试确认');
      this.orderId = result.orderId;
      if (result.status === 'pending_quote') {
        wx.showToast({ title: '已提交，等待商家报价', icon: 'success' });
      } else {
        if (result.paymentError) {
          wx.showToast({ title: '订单已建立，请在详情重试支付', icon: 'none' });
          this.openOrder();
          return;
        }
        const paid = await pay(result);
        if (paid) wx.showToast({ title: '预约已提交', icon: 'success' });
      }
      this.openOrder();
    } catch (error) {
      this.setData({ error: error.message || '预约未完成，请重试' });
      if (this.orderId) this.openOrder();
    }
    finally { this.setData({ busy: false }); }
  }
});
