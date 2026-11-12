const api = require('../../utils/api');
const { pay } = require('../../utils/payment');
Page({
  data: { missingRecord: false, ready: false, loading: true, loadError: false,
    busy: false, error: '', requirement: '', addresses: [], addressIndex: 0 },
  onLoad(options = {}) {
    this.serviceId = typeof options.serviceId === 'string' ? options.serviceId.trim() : '';
    this.setData({ missingRecord: !this.serviceId, loading: !!this.serviceId });
  },
  onShow() {
    this.hidden = false;
    this.setData({ busy: !!this.submitting });
    return this.load();
  },
  onHide() { this.hidden = true; this.invalidateReads(); },
  onUnload() { this.closed = true; this.invalidateReads(); },
  invalidateReads() {
    this.viewVersion = (this.viewVersion || 0) + 1;
    this.loadSequence = (this.loadSequence || 0) + 1;
    this.initializing = false;
  },
  async load() {
    if (!this.serviceId || this.closed || this.hidden || this.initializing || this.submitting) return;
    const sequence = this.loadSequence = (this.loadSequence || 0) + 1;
    const current = () => !this.closed && !this.hidden && sequence === this.loadSequence;
    const selected = this.data.addresses[this.data.addressIndex];
    this.initializing = true;
    this.setData({ ready: false, loading: true, loadError: false, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!current()) return;
      if (!user || !user._id) throw new Error('登录状态不可用，请重试');
      const addresses = user.addresses || [];
      if (!Array.isArray(addresses)) throw new Error('地址加载失败，请重试');
      const userChanged = this.userId && this.userId !== user._id;
      if (userChanged) { this.pendingRequest = null; this.orderId = ''; }
      this.userId = user._id;
      const selectedIndex = !userChanged && selected ? addresses.findIndex(item => item.id === selected.id) : 0;
      this.setData({ ready: true, addressIndex: Math.max(0, selectedIndex),
        addresses: addresses.map(item => ({ ...item, label: [item.buildingName, item.unit, item.room, item.contactName]
          .filter(value => typeof value === 'string' && value.trim()).join(' · ') || '已绑定地址' })) });
    } catch (error) {
      if (current()) this.setData({ loadError: true, error: error.message || '地址加载失败' });
    } finally {
      if (current()) { this.initializing = false; this.setData({ loading: false }); }
    }
  },
  canEdit() { return !this.closed && !this.hidden && this.data.ready && !this.data.loading && !this.data.busy; },
  input(event) { if (this.canEdit()) this.setData({ requirement: event.detail.value }); },
  address(event) {
    const addressIndex = Number(event.detail.value);
    if (this.canEdit() && Number.isInteger(addressIndex) && this.data.addresses[addressIndex]) this.setData({ addressIndex });
  },
  openOrder() {
    if (!this.serviceId || !this.orderId || this.closed || this.hidden) return;
    wx.redirectTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(this.orderId) });
  },
  async submit() {
    if (!this.serviceId || !this.canEdit()) return;
    if (this.orderId) { this.openOrder(); return; }
    const viewVersion = this.viewVersion || 0;
    const current = () => !this.closed && !this.hidden && (this.viewVersion || 0) === viewVersion;
    this.submitting = true;
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
      if (!current()) return;
      if (result.status === 'pending_quote') {
        wx.showToast({ title: '已提交，等待商家报价', icon: 'success' });
      } else {
        if (result.paymentError) {
          wx.showToast({ title: '订单已建立，请在详情重试支付', icon: 'none' });
          this.openOrder();
          return;
        }
        const paid = await pay(result);
        if (!current()) return;
        if (paid) wx.showToast({ title: '预约已提交', icon: 'success' });
      }
      this.openOrder();
    } catch (error) {
      if (!current()) return;
      this.setData({ error: error.message || '预约未完成，请重试' });
      if (this.orderId) this.openOrder();
    }
    finally {
      this.submitting = false;
      if (!this.closed && !this.hidden) {
        this.setData({ busy: false });
        if (!current()) await this.load();
      }
    }
  }
});
