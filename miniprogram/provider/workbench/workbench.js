const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display, slotText } = require('../../utils/time');
Page({
  data: { loading: true, busy: false, error: '', provider: null, tasks: [], todayCount: 0, todayIncome: '0.00' },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('provider', 'myStatus', {}, { loading: false });
      this.setData({ provider: result.provider, todayCount: result.todayCount, todayIncome: yuan(result.todayIncome),
        insuranceText: result.provider ? display(result.provider.insuranceUntil).slice(0, 10) : '' });
      if (result.provider && result.provider.status === 'approved') {
        const tasks = await api.call('provider', 'myTasks', {}, { loading: false });
        this.setData({ tasks: tasks.list.map(order => ({ ...order, amountText: yuan(order.pricing.payAmount + order.pricing.goodsCap),
          createdText: display(order.createdAt), slotText: slotText(order.slot) })), hasMore: tasks.hasMore });
      }
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  async more() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const result = await api.call('provider', 'myTasks', { offset: this.data.tasks.length });
      this.setData({ tasks: [...this.data.tasks, ...result.list.map(order => ({ ...order,
        amountText: yuan(order.pricing.payAmount + order.pricing.goodsCap), createdText: display(order.createdAt), slotText: slotText(order.slot) }))], hasMore: result.hasMore });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loading: false }); }
  },
  async duty(event) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('provider', 'setDuty', { on: event.detail.value }); await this.load(); }
    catch (error) { this.setData({ error: error.message, 'provider.onDuty': !event.detail.value }); }
    finally { this.setData({ busy: false }); }
  },
  task(event) { wx.navigateTo({ url: '/provider/task/task?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
