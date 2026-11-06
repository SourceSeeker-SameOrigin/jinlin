const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, error: '', rows: [], hasMore: true, statusIndex: 0,
    statuses: ['全部', '待支付', '待接单', '已接单', '服务中', '待确认', '已完成', '售后处理中', '已退款', '已取消', '已关闭'] },
  onShow() { this.load(true); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  retry() { this.load(true); },
  filter(event) { this.setData({ statusIndex: Number(event.detail.value) }); this.load(true); },
  async load(reset = false) {
    const sequence = (this.sequence || 0) + 1; this.sequence = sequence;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('admin', 'listOrders', { status: ['', 'pending_pay', 'paid', 'accepted', 'in_service', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled', 'closed'][this.data.statusIndex],
        offset: reset ? 0 : this.data.rows.length }, { loading: false, silent: true });
      if (sequence !== this.sequence) return;
      const rows = result.list.map(order => ({ ...order, amount: yuan(order.pricing.payAmount + order.pricing.goodsCap), createdText: display(order.createdAt) }));
      this.setData({ rows: reset ? rows : [...this.data.rows, ...rows], hasMore: result.hasMore, readOnly: result.readOnly });
    } catch (error) { if (sequence === this.sequence) this.setData({ error: error.message || '订单加载失败' }); }
    finally { if (sequence === this.sequence) this.setData({ loading: false }); }
  },
  open(event) { wx.navigateTo({ url: '/admin/order/order?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
