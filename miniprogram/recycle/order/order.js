const api = require('../../utils/api');
Page({
  data: { loading: true, busy: false, error: '', createdOrderId: '', navigating: false, navigationError: '', categories: [
    { code: 'paper', name: '纸类', selected: false }, { code: 'plastic', name: '塑料', selected: false },
    { code: 'metal', name: '金属', selected: false }, { code: 'clothing', name: '衣物', selected: false },
    { code: 'appliance', name: '小家电', selected: false }
  ], note: '', slots: [], slotIndex: 0, pricing: null },
  onLoad() { return this.load(); },
  onShow() {
    if (!this.hidden) return;
    this.hidden = false;
    this.setData({ busy: !!this.creating });
    return this.load();
  },
  onHide() { this.hidden = true; this.invalidateReads(); },
  onUnload() { this.closed = true; this.invalidateReads(); },
  invalidateReads() {
    this.loadSequence = (this.loadSequence || 0) + 1;
    this.quoteSequence = (this.quoteSequence || 0) + 1;
    this.initializing = false;
  },
  async load() {
    if (this.closed || this.hidden || this.initializing || this.creating) return;
    const sequence = this.loadSequence = (this.loadSequence || 0) + 1;
    const current = () => !this.closed && !this.hidden && sequence === this.loadSequence;
    this.quoteSequence = (this.quoteSequence || 0) + 1;
    this.initializing = true;
    this.setData({ loading: true, error: '', pricing: null, quoting: false });
    try {
      const user = await getApp().ensureSession();
      if (!current()) return;
      if (this.userId && this.userId !== user._id) this.request = null;
      this.userId = user._id;
      this.receiptKey = 'recycleOrderReceipt:' + user._id;
      if (this.receipt && this.receipt.userId !== user._id) this.receipt = null;
      if (!this.receipt) {
        try {
          const saved = wx.getStorageSync(this.receiptKey);
          if (saved && saved.userId === user._id && typeof saved.orderId === 'string' && saved.orderId) this.receipt = { userId: saved.userId, orderId: saved.orderId };
        } catch (_) { /* In-memory recovery remains available if storage cannot be read. */ }
      }
      this.setData({ createdOrderId: this.receipt ? this.receipt.orderId : '', navigating: false, navigationError: '' });
      if (this.receipt) return;
      this.communityId = user.communityId;
      await this.refreshQuote();
    } catch (error) { if (current()) this.setData({ error: error.message || '登录状态不可用' }); }
    finally { if (current()) { this.initializing = false; this.setData({ loading: false }); } }
  },
  async category(event) {
    if (this.closed || this.hidden || this.data.loading || this.data.busy || this.receipt) return;
    const code = event.currentTarget.dataset.code;
    const categories = this.data.categories.map(item => item.code === code ? { ...item, selected: !item.selected } : item);
    this.setData({ categories, pricing: null, error: '' });
    return this.refreshQuote();
  },
  async refreshQuote() {
    if (this.closed || this.hidden || this.receipt) return;
    const sequence = this.quoteSequence = (this.quoteSequence || 0) + 1;
    const current = () => !this.closed && !this.hidden && !this.receipt && sequence === this.quoteSequence;
    const categories = this.data.categories;
    this.setData({ pricing: null, slots: [], error: '', quoting: false });
    if (!categories.some(item => item.selected)) return;
    if (!this.communityId) { this.setData({ error: '请先选择小区并重新加载' }); return; }
    this.setData({ quoting: true });
    try {
      const result = await api.call('order', 'quote', { serviceCode: 'recycle', communityId: this.communityId,
        detail: { categories: categories.filter(item => item.selected).map(item => item.code), note: this.data.note }, metadata: true },
      { loading: false, silent: true });
      if (!current()) return;
      const slotIndex = Math.min(this.data.slotIndex, Math.max(0, result.slots.length - 1));
      this.setData({ slots: result.slots, slotIndex, pricing: result.pricing,
        error: result.validationMessage || (result.slots.length ? '' : '暂无可预约时段') });
    } catch (error) { if (current()) this.setData({ error: error.message || '暂时无法报价' }); }
    finally { if (current()) this.setData({ quoting: false }); }
  },
  note(event) { if (!this.closed && !this.hidden && !this.data.busy && !this.receipt) this.setData({ note: event.detail.value }); },
  selectSlot(event) { if (!this.closed && !this.hidden && !this.data.busy && !this.receipt) this.setData({ slotIndex: Number(event.detail.value) }); },
  openCreatedOrder() {
    const receipt = this.receipt;
    if (!receipt || receipt.userId !== this.userId || this.closed || this.hidden || this.data.navigating) return;
    const key = 'recycleOrderReceipt:' + receipt.userId;
    this.setData({ navigating: true, navigationError: '' });
    const fail = () => {
      if (!this.closed && !this.hidden) this.setData({ navigating: false,
        navigationError: '预约已创建，暂未打开详情，请点击下方按钮重试。不会重复预约。' });
    };
    try {
      wx.redirectTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(receipt.orderId), fail,
        success: () => {
          try {
            const saved = wx.getStorageSync(key);
            if (saved && saved.userId === receipt.userId && saved.orderId === receipt.orderId) wx.removeStorageSync(key);
          } catch (_) { /* A retained receipt can safely reopen the existing order. */ }
        } });
    } catch (_) { fail(); }
  },
  async create() {
    if (this.closed || this.hidden || this.data.busy) return;
    if (this.receipt) { this.openCreatedOrder(); return; }
    if (this.data.loading || this.data.quoting || !this.data.pricing || !this.userId) return;
    const categories = this.data.categories.filter(item => item.selected).map(item => item.code);
    const slot = this.data.slots[this.data.slotIndex];
    if (!categories.length || !slot) { this.setData({ error: '请选择回收类别和可预约时段' }); return; }
    const userId = this.userId, receiptKey = this.receiptKey;
    this.creating = true;
    this.setData({ busy: true, error: '' });
    try {
      const payload = { serviceCode: 'recycle', communityId: this.communityId,
        detail: { categories, note: this.data.note }, slot };
      const signature = JSON.stringify(payload);
      if (!this.request || this.request.signature !== signature) this.request = {
        signature, requestId: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) };
      const result = await api.call('order', 'create', { ...payload, requestId: this.request.requestId });
      if (!result || typeof result.orderId !== 'string' || !result.orderId) throw Error('未取得预约编号，请重试');
      const receipt = { userId, orderId: result.orderId };
      if (this.userId === userId) this.receipt = receipt;
      this.request = null;
      try { wx.setStorageSync(receiptKey, receipt); } catch (_) { /* Keep the in-memory creation lock. */ }
      if (this.closed || this.hidden || this.userId !== userId) return;
      this.setData({ createdOrderId: receipt.orderId, navigationError: '' });
      this.openCreatedOrder();
    } catch (error) { if (!this.closed && !this.hidden) this.setData({ error: error.message || '预约失败，请重试' }); }
    finally { this.creating = false; if (!this.closed && !this.hidden) this.setData({ busy: false }); }
  }
});
