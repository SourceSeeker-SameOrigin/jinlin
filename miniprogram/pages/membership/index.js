const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
const { pay } = require('../../utils/payment');
Page({
  data: { loading: true, busy: false, error: '', plans: [], cards: [], slots: ['早班', '中班', '晚班'], slotIndex: 2 },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.buildingId) { wx.navigateTo({ url: '/pages/bind/bind' }); return; }
      const [plans, mine] = await Promise.all([api.call('membership', 'plans', {}, { loading: false, silent: true }),
        api.call('membership', 'mine', {}, { loading: false, silent: true })]);
      this.setData({ plans: plans.list.map(plan => ({ ...plan, priceText: yuan(plan.payAmount), originalText: yuan(plan.price) })),
        cards: mine.list.map(card => ({ ...card, startText: display(card.startAt), endText: display(card.endAt),
          statusText: { active: '使用中', expired: '已到期', refunded: '已作废' }[card.status] })) });
    } catch (error) { this.setData({ error: error.message || '月卡加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  slot(event) { this.setData({ slotIndex: Number(event.detail.value) }); },
  async buy(event) {
    if (this.data.busy) return;
    const planCode = event.currentTarget.dataset.code;
    const slot = ['morning', 'afternoon', 'evening'][this.data.slotIndex];
    this.setData({ busy: true, error: '' });
    try {
      if (!this.request || this.request.planCode !== planCode || this.request.slot !== slot) this.request = {
        planCode, slot, requestId: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) };
      const created = await api.call('membership', 'buy', this.request);
      this.request = null;
      try { await pay(created); } catch (error) { wx.showToast({ title: error.message || '支付未完成，可到订单页重试', icon: 'none' }); }
      await this.load();
      wx.navigateTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(created.orderId) });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  async skip(event) {
    if (this.data.busy) return;
    const answer = await new Promise(resolve => wx.showModal({ title: '今天不用来', content: '仅能跳过尚未接单的今日垃圾月卡任务。确认今天不用上门吗？', success: resolve }));
    if (!answer.confirm) return;
    this.setData({ busy: true });
    try { await api.call('membership', 'skipToday', { membershipId: event.currentTarget.dataset.id }); await this.load(); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  }
});
