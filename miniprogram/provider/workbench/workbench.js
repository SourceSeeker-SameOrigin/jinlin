const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display, slotText } = require('../../utils/time');
const subscriptions = require('../../utils/subscriptions');
Page({
  data: { loading: true, busy: false, error: '', provider: null, tasks: [], todayCount: 0, todayIncome: '0.00' },
  onShow() { this.load(); },
  async load() {
    this.setData({ remainingReminders: subscriptions.remaining() });
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('provider', 'myStatus', {}, { loading: false });
      this.setData({ provider: result.provider, todayCount: result.todayCount, todayIncome: yuan(result.todayIncome),
        stationDeliveryEnabled: Boolean(getApp().globalData.community && getApp().globalData.community.features &&
          getApp().globalData.community.features.stationDelivery),
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
    try {
      await api.call('provider', 'setDuty', { on: event.detail.value });
      if (event.detail.value) {
        const result = await subscriptions.request(['newTask']);
        const count = subscriptions.remaining();
        this.setData({ remainingReminders: count, reminderHint: count < 3 ? '提醒次数少于 3 次，可再次点击订阅补充' : '' });
      }
      await this.load();
    }
    catch (error) { this.setData({ error: error.message, 'provider.onDuty': !event.detail.value }); }
    finally { this.setData({ busy: false }); }
  },
  async subscribeMore() {
    await subscriptions.request(['newTask']);
    const count = subscriptions.remaining();
    this.setData({ remainingReminders: count, reminderHint: count < 3 ? '提醒次数少于 3 次，可再次点击订阅补充' : '' });
  },
  async saveReferralPoster() {
    try {
      const result = await api.call('provider', 'referralPoster');
      wx.downloadFile({ url: result.tempFileURL, success: file => {
        if (file.statusCode !== 200) { this.setData({ error: '推荐码下载失败' }); return; }
        wx.saveImageToPhotosAlbum({ filePath: file.tempFilePath,
          success: () => wx.showToast({ title: '推荐码已保存', icon: 'success' }),
          fail: error => this.setData({ error: error.errMsg || '保存失败，请检查相册权限' }) });
      }, fail: error => this.setData({ error: error.errMsg || '下载失败' }) });
    } catch (error) { this.setData({ error: error.message || '生成推荐码失败' }); }
  },
  task(event) { wx.navigateTo({ url: '/provider/task/task?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
