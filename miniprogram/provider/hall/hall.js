const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { slotText } = require('../../utils/time');
Page({
  data: { loading: false, busy: false, error: '', tasks: [], hasMore: true },
  onShow() { this.visible = true; this.load(true); this.timer = setInterval(() => { if (!this.data.loading && !this.data.busy) this.load(true); }, 15000); },
  onHide() { this.visible = false; clearInterval(this.timer); },
  onUnload() { this.visible = false; clearInterval(this.timer); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  retry() { this.load(true); },
  async load(reset = false) {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('provider', 'hall', { offset: reset ? 0 : this.data.tasks.length }, { loading: false, silent: true });
      if (!this.visible) return;
      const tasks = result.list.map(item => ({ ...item, income: yuan(item.estimatedIncome), slotText: slotText(item.slot) }));
      this.setData({ tasks: reset ? tasks : [...this.data.tasks, ...tasks], hasMore: result.hasMore });
    } catch (error) { if (this.visible) this.setData({ error: error.message || '任务加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async accept(event) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try { const result = await api.call('provider', 'accept', { orderId: event.currentTarget.dataset.id });
      wx.navigateTo({ url: '/provider/task/task?id=' + encodeURIComponent(result.orderId) }); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  }
});
