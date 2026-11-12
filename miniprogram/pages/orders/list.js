const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display, slotText } = require('../../utils/time');
Page({
  data: { groups: [{ code: 'ongoing', name: '进行中' }, { code: 'done', name: '已完成' }, { code: 'aftersale', name: '售后' }],
    group: 'ongoing', orders: [], loading: false, error: '', hasMore: true },
  onShow() { this._hidden = false; if (this._closed) return; return Promise.all([this.load(true), this.refreshUnread()]); },
  onHide() { this._hidden = true; this.invalidateReads(); },
  onUnload() { this._closed = true; this.invalidateReads(); },
  invalidateReads() { this.sequence = (this.sequence || 0) + 1; this.unreadSequence = (this.unreadSequence || 0) + 1; },
  visible() { return !this._closed && !this._hidden; },
  onPullDownRefresh() {
    const pending = this.load(true), sequence = this.sequence;
    return pending.finally(() => { if (this.visible() && sequence === this.sequence) wx.stopPullDownRefresh(); });
  },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  groupChange(event) {
    const group = event.currentTarget.dataset.group;
    if (!this.visible() || !this.data.groups.some(item => item.code === group)) return;
    this.setData({ group }); return this.load(true);
  },
  retry() { return this.load(this.data.orders.length === 0); },
  async refreshUnread() {
    if (!this.visible()) return;
    const sequence = this.unreadSequence = (this.unreadSequence || 0) + 1;
    const current = () => this.visible() && sequence === this.unreadSequence;
    try {
      const result = await api.call('chat', 'list', {}, { loading: false, silent: true, isActive: current });
      if (!current()) return;
      if (result.unreadTotal > 0) wx.setTabBarBadge({ index: 1, text: String(Math.min(result.unreadTotal, 99)) });
      else wx.removeTabBarBadge({ index: 1 });
    } catch (_) { if (current()) wx.removeTabBarBadge({ index: 1 }); }
  },
  async load(reset = false) {
    if (!this.visible() || (!reset && (this.data.loading || !this.data.hasMore))) return;
    const sequence = (this.sequence || 0) + 1;
    this.sequence = sequence;
    const current = () => this.visible() && sequence === this.sequence;
    const group = this.data.group, offset = reset ? 0 : this.data.orders.length;
    this.setData({ loading: true, error: '', ...(reset ? { orders: [], hasMore: true } : {}) });
    try {
      await getApp().ensureSession();
      if (!current()) return;
      const result = await api.call('order', 'listMine', { group, offset }, { loading: false, silent: true, isActive: current });
      if (!current()) return;
      const list = result.list.map(order => ({ ...order, amountText: yuan(order.pricing.payAmount + order.pricing.goodsCap),
        slotText: slotText(order.slot), createdText: display(order.createdAt) }));
      this.setData({ orders: reset ? list : [...this.data.orders, ...list], hasMore: result.hasMore });
    } catch (error) { if (current()) this.setData({ error: error.message || '订单加载失败' }); }
    finally { if (current()) this.setData({ loading: false }); }
  }
});
