const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display, slotText } = require('../../utils/time');
const subscriptions = require('../../utils/subscriptions');
Page({
  data: { ready: false, loading: true, busy: false, error: '', provider: null, tasks: [], todayCount: 0, todayIncome: '0.00' },
  onShow() { this.visible = true; return this.load(); },
  clearContext() {
    this.context = null; this.operation = null; this.read = (this.read || 0) + 1;
    this.setData({ ready: false, busy: false, provider: null, tasks: [], hasMore: false,
      todayCount: 0, todayIncome: '0.00', insuranceText: '', stationDeliveryEnabled: false, reminderHint: '' });
  },
  onHide() { this.visible = false; this.clearContext(); },
  onUnload() { this.onHide(); },
  current(context) {
    return Boolean(context && this.visible && this.read === context.read &&
      getApp().globalData.user?._id === context.userId);
  },
  rows(list) { return list.map(order => ({ ...order, amountText: yuan(order.pricing.payAmount + order.pricing.goodsCap),
    createdText: display(order.createdAt), slotText: slotText(order.slot) })); },
  async load() {
    if (!this.visible) return;
    this.clearContext();
    this.pageError = false;
    const read = this.read;
    let userId;
    const current = () => this.visible && this.read === read && (!userId || getApp().globalData.user?._id === userId);
    const options = { loading: false, silent: true, redirectOnForbidden: false, isActive: current };
    this.setData({ remainingReminders: subscriptions.remaining() });
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!current()) return;
      userId = user?._id;
      if (!userId) throw Error('登录资料暂不可用，请重试');
      if (!current()) return;
      const result = await api.call('provider', 'myStatus', {}, options);
      if (!current()) return;
      let tasks = { list: [], hasMore: false };
      if (result.provider?.status === 'approved') {
        tasks = await api.call('provider', 'myTasks', {}, options);
        if (!current()) return;
      }
      this.setData({ provider: result.provider, todayCount: result.todayCount, todayIncome: yuan(result.todayIncome),
        tasks: this.rows(tasks.list), hasMore: tasks.hasMore,
        stationDeliveryEnabled: Boolean(getApp().globalData.community && getApp().globalData.community.features &&
          getApp().globalData.community.features.stationDelivery),
        insuranceText: result.provider ? display(result.provider.insuranceUntil).slice(0, 10) : '' });
      this.context = { userId, read };
      this.setData({ ready: true });
    } catch (error) { if (current()) this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { if (current()) this.setData({ loading: false }); }
  },
  retry() { return this.pageError ? this.more() : this.load(); },
  async more() {
    if (!this.visible || this.data.loading || this.data.busy || !this.data.hasMore) return;
    if (!this.current(this.context)) return this.load();
    const context = this.context = { ...this.context, read: ++this.read };
    const current = () => this.context === context && this.current(context);
    this.pageError = false;
    this.setData({ loading: true, ready: false, error: '' });
    try {
      const result = await api.call('provider', 'myTasks', { offset: this.data.tasks.length },
        { loading: false, silent: true, redirectOnForbidden: false, isActive: current });
      if (current()) this.setData({ tasks: [...this.data.tasks, ...this.rows(result.list)], hasMore: result.hasMore, ready: true });
    } catch (error) { if (current()) {
      this.pageError = error.code !== 'E_FORBIDDEN';
      if (!this.pageError) this.clearContext();
      this.setData({ loading: false, error: error.message });
    } }
    finally { if (current()) this.setData({ loading: false }); }
  },
  async duty(event) {
    if (!this.visible || this.data.loading || this.data.busy || !this.data.ready) return;
    const context = this.context;
    if (!this.current(context)) return this.load();
    if (this.data.provider?.status !== 'approved') return;
    const operation = this.operation = {};
    const current = () => this.operation === operation && this.context === context && this.current(context) && this.data.ready;
    const on = Boolean(event.detail.value);
    this.setData({ busy: true, error: '' });
    try {
      await api.call('provider', 'setDuty', { on }, { loading: false, silent: true, redirectOnForbidden: false, isActive: current });
      if (!current()) return;
      if (on) {
        await subscriptions.request(['newTask'], { isActive: current });
        if (!current()) return;
        const count = subscriptions.remaining();
        this.setData({ remainingReminders: count, reminderHint: count < 3 ? '提醒次数少于 3 次，可再次点击订阅补充' : '' });
      }
      await this.load();
    }
    catch (error) { if (current()) this.setData({ error: error.message, 'provider.onDuty': !on }); }
    finally { if (current()) { this.operation = null; this.setData({ busy: false }); } }
  },
  async subscribeMore() {
    if (!this.visible || this.data.loading || this.data.busy || !this.data.ready) return;
    const context = this.context;
    if (!this.current(context)) return this.load();
    if (this.data.provider?.status !== 'approved') return;
    const current = () => this.context === context && this.current(context) && this.data.ready;
    await subscriptions.request(['newTask'], { isActive: current });
    if (!current()) return;
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
  task(event) {
    if (!this.visible || this.data.loading || !this.data.ready) return;
    if (!this.current(this.context)) return this.load();
    const id = event.currentTarget.dataset.id;
    if (this.data.tasks.some(task => task._id === id)) wx.navigateTo({ url: '/provider/task/task?id=' + encodeURIComponent(id) });
  }
});
