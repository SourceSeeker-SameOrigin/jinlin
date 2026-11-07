const api = require('../../utils/api');
Page({
  data: { loading: true, busy: false, error: '', categories: [
    { code: 'paper', name: '纸类', selected: false }, { code: 'plastic', name: '塑料', selected: false },
    { code: 'metal', name: '金属', selected: false }, { code: 'clothing', name: '衣物', selected: false },
    { code: 'appliance', name: '小家电', selected: false }
  ], note: '', slots: [], slotIndex: 0, pricing: null },
  async onLoad() {
    try {
      const user = await getApp().ensureSession();
      this.communityId = user.communityId;
    } catch (error) { this.setData({ error: error.message || '登录状态不可用' }); }
    finally { this.setData({ loading: false }); }
  },
  async category(event) {
    const code = event.currentTarget.dataset.code;
    const categories = this.data.categories.map(item => item.code === code ? { ...item, selected: !item.selected } : item);
    this.setData({ categories, pricing: null, error: '' });
    if (!categories.some(item => item.selected)) return;
    try {
      const result = await api.call('order', 'quote', { serviceCode: 'recycle', communityId: this.communityId,
        detail: { categories: categories.filter(item => item.selected).map(item => item.code), note: this.data.note }, metadata: true },
      { loading: false, silent: true });
      const slotIndex = Math.min(this.data.slotIndex, Math.max(0, result.slots.length - 1));
      this.setData({ slots: result.slots, slotIndex, pricing: result.pricing,
        error: result.validationMessage || (result.slots.length ? '' : '暂无可预约时段') });
    } catch (error) { this.setData({ error: error.message || '暂时无法报价' }); }
  },
  note(event) { this.setData({ note: event.detail.value }); },
  selectSlot(event) { this.setData({ slotIndex: Number(event.detail.value) }); },
  async create() {
    if (this.data.busy) return;
    const categories = this.data.categories.filter(item => item.selected).map(item => item.code);
    if (!categories.length || !this.data.slots.length) { this.setData({ error: '请选择回收类别和可预约时段' }); return; }
    this.setData({ busy: true, error: '' });
    try {
      const slot = this.data.slots[this.data.slotIndex];
      const result = await api.call('order', 'create', { serviceCode: 'recycle', communityId: this.communityId,
        detail: { categories, note: this.data.note }, slot,
        requestId: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) });
      wx.redirectTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(result.orderId) });
    } catch (error) { this.setData({ error: error.message || '预约失败，请重试' }); }
    finally { this.setData({ busy: false }); }
  }
});
