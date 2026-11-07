const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display, slotText } = require('../../utils/time');
Page({
  data: { groups: [{ code: 'ongoing', name: '进行中' }, { code: 'done', name: '已完成' }, { code: 'aftersale', name: '售后' }],
    group: 'ongoing', orders: [], loading: false, error: '', hasMore: true },
  onShow() { this.load(true); this.refreshUnread(); },
  onPullDownRefresh() { this.load(true).finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  groupChange(event) { this.setData({ group: event.currentTarget.dataset.group }); this.load(true); },
  retry() { this.load(this.data.orders.length === 0); },
  async refreshUnread() {
    try {
      const result = await api.call('chat', 'list', {}, { loading: false, silent: true });
      if (result.unreadTotal > 0) wx.setTabBarBadge({ index: 1, text: String(Math.min(result.unreadTotal, 99)) });
      else wx.removeTabBarBadge({ index: 1 });
    } catch (_) { wx.removeTabBarBadge({ index: 1 }); }
  },
  async load(reset = false) {
    const sequence = (this.sequence || 0) + 1;
    this.sequence = sequence;
    this.setData({ loading: true, error: '', ...(reset ? { orders: [], hasMore: true } : {}) });
    try {
      await getApp().ensureSession();
      const result = await api.call('order', 'listMine', { group: this.data.group, offset: this.data.orders.length }, { loading: false, silent: true });
      if (sequence !== this.sequence) return;
      const list = result.list.map(order => ({ ...order, amountText: yuan(order.pricing.payAmount + order.pricing.goodsCap),
        slotText: slotText(order.slot), createdText: display(order.createdAt) }));
      this.setData({ orders: reset ? list : [...this.data.orders, ...list], hasMore: result.hasMore });
    } catch (error) { if (sequence === this.sequence) this.setData({ error: error.message || '订单加载失败' }); }
    finally { if (sequence === this.sequence) this.setData({ loading: false }); }
  }
});
