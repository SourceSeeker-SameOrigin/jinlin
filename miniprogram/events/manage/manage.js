const api = require('../../utils/api');

function amountFen(value, field) {
  const match = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(String(value));
  if (!match) throw new Error(field + '最多保留两位小数');
  const amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100000000) throw new Error(field + '超出范围');
  return amount;
}

Page({
  data: { loading: true, error: '', list: [], scanCode: '', title: '', desc: '', location: '', type: 'interest', fee: '0', capacity: '20',
    startDate: '2026-12-01', startTime: '10:00', endDate: '2026-12-01', endTime: '12:00', deadlineDate: '2026-11-30', deadlineTime: '23:59',
    types: ['interest', 'charity'], sponsorName: '', sponsorAmount: '0', sponsorNote: '', attendees: [], isAdmin: false, busy: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      const result = await api.call('event', 'adminList', {}, { loading: false, silent: true });
      this.setData({ list: result.list, isAdmin: user.roles.includes('admin') });
    } catch (error) { this.setData({ error: error.message || '活动管理加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async publish(event) {
    const item = this.data.list.find(row => row._id === event.currentTarget.dataset.id);
    if (item && getApp().globalData.user.roles.includes('admin') && item.reviewRequested) {
      try { await api.call('event', 'review', { eventId: item._id, approved: true }); await this.load(); }
      catch (error) { this.setData({ error: error.message || '审核失败' }); }
    } else await this.action('publish', event.currentTarget.dataset.id);
  },
  async cancel(event) { await this.action('cancelEvent', event.currentTarget.dataset.id); },
  async retryCancellation(event) { await this.action('retryCancellation', event.currentTarget.dataset.id); },
  async action(action, eventId) {
    try { await api.call('event', action, { eventId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '操作失败' }); }
  },
  input(event) { const field = event.currentTarget.dataset.field; this.setData({ [field]: event.detail.value }); },
  typeChange(event) { this.setData({ type: this.data.types[Number(event.detail.value)] || 'interest' }); },
  async createActivity() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      const toDate = (date, time) => new Date(date + 'T' + time + ':00+08:00');
      const created = await api.call('event', 'create', { title: this.data.title, desc: this.data.desc, location: this.data.location,
        type: this.data.type, fee: this.data.type === 'charity' ? 0 : amountFen(this.data.fee, '活动费用'), capacity: Number(this.data.capacity), communityIds: [user.communityId],
        sponsors: user.roles.includes('admin') && this.data.sponsorName && Number(this.data.sponsorAmount) > 0 ? [{ name: this.data.sponsorName,
          amount: amountFen(this.data.sponsorAmount, '赞助金额'), note: this.data.sponsorNote }] : [],
        startAt: toDate(this.data.startDate, this.data.startTime), endAt: toDate(this.data.endDate, this.data.endTime),
        signupDeadline: toDate(this.data.deadlineDate, this.data.deadlineTime) });
      await api.call('event', 'publish', { eventId: created.eventId });
      this.setData({ title: '', desc: '', location: '' }); await this.load();
    } catch (error) { this.setData({ error: error.message || '活动创建失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async scan() {
    try {
      const result = await new Promise((resolve, reject) => wx.scanCode({ onlyFromCamera: true, success: resolve, fail: reject }));
      let code = result.scene || result.result || '';
      if (!code && result.path) code = decodeURIComponent((result.path.split('scene=')[1] || '').split('&')[0]);
      if (code.startsWith('e=')) code = code.slice(2);
      this.setData({ scanCode: code || '' });
    } catch (error) { this.setData({ error: error.errMsg || '扫码失败' }); }
  },
  async checkin(event) {
    const eventId = event.currentTarget.dataset.id;
    if (!this.data.scanCode) return this.setData({ error: '请先扫描活动签到码' });
    try { await api.call('event', 'checkin', { eventId, checkinCode: this.data.scanCode }); this.setData({ scanCode: '', error: '' }); }
    catch (error) { this.setData({ error: error.message || '签到失败' }); }
  },
  async showSignups(event) {
    try {
      const result = await api.call('event', 'listSignups', { eventId: event.currentTarget.dataset.id }, { loading: false, silent: true });
      this.setData({ attendees: result.list || [] });
    } catch (error) { this.setData({ error: error.message || '报名名单加载失败' }); }
  }
});
