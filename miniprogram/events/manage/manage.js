const api = require('../../utils/api');
const formDefaults = { title: '', desc: '', location: '', type: 'interest', fee: '0', capacity: '20',
  startDate: '', startTime: '10:00', endDate: '', endTime: '12:00', deadlineDate: '', deadlineTime: '23:59',
  sponsorName: '', sponsorAmount: '0', sponsorNote: '' };
const { ymd } = require('../../utils/time');
const { eventStatusNames, signupStatusNames, refundJobStatusNames } = require('../../utils/status-labels');

function amountFen(value, field) {
  const match = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(String(value));
  if (!match) throw new Error(field + '最多保留两位小数');
  const amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100000000) throw new Error(field + '超出范围');
  return amount;
}

Page({
  data: { loading: true, error: '', errorFromForm: false, list: [], scanCode: '', title: '', desc: '', location: '', type: 'interest', fee: '0', capacity: '20',
    startDate: '', startTime: '10:00', endDate: '', endTime: '12:00', deadlineDate: '', deadlineTime: '23:59',
    types: ['interest', 'charity'], typeLabels: ['兴趣活动', '公益活动'], eventStatusNames, signupStatusNames, refundJobStatusNames,
    sponsorName: '', sponsorAmount: '0', sponsorNote: '', attendees: [], isAdmin: false, busy: false,
    eventOffset: 0, eventMore: false, eventLoading: false, eventError: '',
    rosterId: '', rosterTitle: '', rosterMore: false, rosterLoading: false, rosterError: '', rosterOffset: 0,
    communities: [], communityIndex: 0, communityId: '', ready: false, recovery: '', recoveryStatus: '', recoveryTitle: '' },
  onShow() { this.inactive = false; return this.load(); },
  onHide() { this.inactive = true; this.invalidateReads(); this.setData({ ready: false }); },
  onUnload() { this.inactive = true; this.invalidateReads(); },
  invalidateReads() {
    this.loadSequence = (this.loadSequence || 0) + 1;
    this.rosterSequence = (this.rosterSequence || 0) + 1;
  },
  async load() {
    if (this.inactive) return;
    this.invalidateReads();
    const sequence = this.loadSequence;
    let loadingUserId;
    const current = () => !this.inactive && sequence === this.loadSequence &&
      (!loadingUserId || getApp().globalData.user?._id === loadingUserId);
    this.setData({ loading: true, ready: false, busy: false, recovery: '', error: '', errorFromForm: false, list: [], attendees: [], scanCode: '',
      eventOffset: 0, eventMore: false, eventLoading: false, eventError: '',
      rosterId: '', rosterTitle: '', rosterMore: false, rosterLoading: false, rosterError: '', rosterOffset: 0 });
    try {
      const user = await getApp().ensureSession();
      if (!current()) return;
      if (!user || !user._id) throw new Error('登录状态不可用，请重试');
      loadingUserId = user._id;
      if (!current()) return;
      if (this.userId && this.userId !== user._id) this.setData({ ...formDefaults, communityId: '' });
      this.userId = user._id;
      this.storageKey = 'event-creation:' + encodeURIComponent(user._id);
      this.receipt = wx.getStorageSync(this.storageKey) || null;
      if (this.receipt) this.setData({ ...this.receipt.form, recovery: 'lookup', recoveryTitle: this.receipt.input.title });
      const isAdmin = user.roles.includes('admin');
      if (!isAdmin && !user.roles.some(role => ['property', 'merchant'].includes(role))) throw new Error('仅管理员、物业或商家可管理活动');
      const communities = [];
      if (isAdmin) {
        let result;
        do {
          result = await api.call('catalog', 'listCommunities', { offset: communities.length }, { loading: false, silent: true });
          communities.push(...result.list);
        } while (result.hasMore);
      } else {
        if (!user.communityId) throw new Error('尚未分配活动管理小区');
        communities.push(await api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true }));
      }
      if (!current() || getApp().globalData.user?._id !== user._id) return;
      const selectedId = isAdmin ? this.receipt?.input.communityIds[0] || this.data.communityId || user.communityId : user.communityId;
      const communityIndex = Math.max(0, communities.findIndex(item => item._id === selectedId));
      const communityId = (communities[communityIndex] || {})._id || '';
      this.setData({ isAdmin, communities, communityIndex, communityId });
      if (!communityId) throw new Error('请先配置并选择管理小区');
      const result = await api.call('event', 'adminList', { communityId }, { loading: false, silent: true });
      if (!current() || getApp().globalData.user?._id !== user._id) return;
      this.setData({ list: result.list, ready: true,
        eventOffset: result.list.length, eventMore: result.hasMore === true && result.list.length > 0 });
      if (this.receipt) await this.lookupPending(current);
    } catch (error) { if (current()) this.setData({ error: error.message || '活动管理加载失败' }); }
    finally { if (current()) this.setData({ loading: false }); }
  },
  async loadMoreEvents() {
    const { ready, communityId, eventOffset, eventMore, eventLoading } = this.data;
    if (this.inactive || !ready || !eventMore || eventLoading) return;
    const sequence = this.loadSequence;
    this.setData({ eventLoading: true, eventError: '' });
    try {
      const result = await api.call('event', 'adminList', { communityId, offset: eventOffset }, { loading: false, silent: true });
      if (sequence !== this.loadSequence) return;
      const seen = new Set(this.data.list.map(item => item._id));
      const additions = result.list.filter(item => !seen.has(item._id) && seen.add(item._id));
      this.setData({ list: this.data.list.concat(additions), eventOffset: eventOffset + result.list.length,
        eventMore: result.hasMore === true && result.list.length > 0 });
    } catch (error) {
      if (sequence === this.loadSequence) this.setData({ eventError: error.message || '活动续页加载失败' });
    } finally {
      if (sequence === this.loadSequence) this.setData({ eventLoading: false });
    }
  },
  async chooseCommunity(event) {
    if (!this.data.isAdmin || this.data.loading || this.data.busy || this.receipt) return;
    const community = this.data.communities[Number(event.detail.value)];
    if (!community || community._id === this.data.communityId) return;
    this.setData({ communityId: community._id });
    await this.load();
  },
  async publish(event) {
    await this.action('publish', event.currentTarget.dataset.id);
  },
  async cancel(event) { await this.action('cancelEvent', event.currentTarget.dataset.id); },
  async retryCancellation(event) { await this.action('retryCancellation', event.currentTarget.dataset.id); },
  async action(action, eventId) {
    if (this.inactive || this.data.busy || this.data.loading || !this.data.ready) return;
    if (!this.userId || getApp().globalData.user?._id !== this.userId) return this.load();
    const item = this.data.list.find(row => row._id === eventId);
    const allowed = item && (action === 'publish' ? item.status === 'draft' :
      action === 'cancelEvent' || action === 'checkin' ? item.status === 'published' :
      action === 'retryCancellation' && item.cancelRefund?.status === 'attention' && item.cancelRefund.failedCount > 0);
    if (!allowed) return this.setData({ error: '活动状态已变化，请重新读取后操作', errorFromForm: false });
    if (action === 'checkin' && !this.data.scanCode) return this.setData({ error: '请先扫描活动签到码', errorFromForm: false });
    const sequence = this.loadSequence, userId = this.userId, communityId = this.data.communityId;
    const current = () => !this.inactive && this.data.ready && !this.data.loading && sequence === this.loadSequence &&
      this.data.communityId === communityId && getApp().globalData.user?._id === userId;
    const payload = { eventId, ...(action === 'checkin' ? { checkinCode: this.data.scanCode } : {}) };
    this.setData({ busy: true, error: '', errorFromForm: false });
    try {
      const user = await getApp().ensureSession();
      if (!current() || user?._id !== userId) return;
      if (action === 'publish' && user.roles.includes('admin') && item.reviewRequested) {
        action = 'review';
        payload.approved = true;
      }
      await api.call('event', action, payload, { loading: false, silent: true, redirectOnForbidden: false, isActive: current });
      if (!current()) return;
      if (action === 'checkin') this.setData({ scanCode: '', error: '' });
      else await this.load();
    } catch (error) {
      if (current()) this.setData({ error: error.message || '操作失败，请重新读取活动核对结果', errorFromForm: false });
    } finally {
      if (current()) this.setData({ busy: false });
      else if (!this.inactive && sequence === this.loadSequence) await this.load();
    }
  },
  canEditCreation() {
    return !this.inactive && this.data.ready && !this.data.loading && !this.data.busy &&
      getApp().globalData.user?._id === this.userId && (!this.receipt || this.data.recovery === 'confirm');
  },
  input(event) {
    const field = event.currentTarget.dataset.field;
    if (Object.prototype.hasOwnProperty.call(formDefaults, field) && this.canEditCreation()) this.setData({ [field]: event.detail.value });
  },
  typeChange(event) {
    if (this.canEditCreation()) this.setData({ type: this.data.types[Number(event.detail.value)] || 'interest' });
  },
  async lookupPending(current) {
    const receipt = this.receipt;
    const result = await api.call('event', 'lookupCreation', { requestId: receipt.requestId },
      { silent: true, loading: false, redirectOnForbidden: false, isActive: current });
    if (!current() || getApp().globalData.user?._id !== this.userId) return null;
    if (!result || (result.eventId !== null && !result.eventId)) throw new Error('原活动结果暂不可用，请重试核对');
    const done = result.eventId && (result.status !== 'draft' || result.reviewRequired);
    this.setData({ recovery: !result.eventId ? 'confirm' : done ? 'done' : 'submit',
      recoveryStatus: done ? result.status === 'draft' ? '已提交管理员审核' : eventStatusNames[result.status] || '已保存' : '',
      recoveryTitle: receipt.input.title });
    return result;
  },
  newActivity() {
    if (this.inactive || this.data.busy || this.data.loading || this.data.recovery !== 'done' ||
      getApp().globalData.user?._id !== this.userId) return;
    const saved = wx.getStorageSync(this.storageKey);
    if (saved?.requestId !== this.receipt?.requestId) return this.load();
    wx.removeStorageSync(this.storageKey);
    this.receipt = null;
    this.setData({ ...formDefaults, recovery: '', recoveryStatus: '', recoveryTitle: '', error: '' });
  },
  creationInput(user) {
    const toDate = (date, time, label) => {
      if (!date) throw new Error('请选择' + label + '日期');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(label + '日期或时间不正确');
      const value = new Date(date + 'T' + time + ':00+08:00');
      if (!Number.isFinite(value.getTime()) || ymd(value) !== date) throw new Error(label + '日期不存在');
      return value.toISOString();
    };
    return { title: this.data.title, desc: this.data.desc, location: this.data.location, type: this.data.type,
      fee: this.data.type === 'charity' ? 0 : amountFen(this.data.fee, '活动费用'), capacity: Number(this.data.capacity),
      communityIds: [user.roles.includes('admin') ? this.data.communityId : user.communityId],
      sponsors: user.roles.includes('admin') && this.data.sponsorName && Number(this.data.sponsorAmount) > 0 ?
        [{ name: this.data.sponsorName, amount: amountFen(this.data.sponsorAmount, '赞助金额'), note: this.data.sponsorNote }] : [],
      startAt: toDate(this.data.startDate, this.data.startTime, '活动开始'),
      endAt: toDate(this.data.endDate, this.data.endTime, '活动结束'),
      signupDeadline: toDate(this.data.deadlineDate, this.data.deadlineTime, '报名截止') };
  },
  async createActivity() {
    if (this.inactive || this.data.busy || this.data.loading || !this.data.ready || !this.data.communityId || this.data.recovery === 'done') return;
    if (!this.userId || getApp().globalData.user?._id !== this.userId) return this.load();
    const sequence = this.loadSequence, userId = this.userId;
    const current = () => !this.inactive && sequence === this.loadSequence && getApp().globalData.user?._id === userId;
    const options = { silent: true, redirectOnForbidden: false, isActive: current };
    this.setData({ busy: true, error: '', errorFromForm: true });
    try {
      const user = await getApp().ensureSession();
      if (!current() || user._id !== userId) return;
      const saved = wx.getStorageSync(this.storageKey);
      if (saved?.requestId !== this.receipt?.requestId) { await this.load(); return; }
      let created;
      if (this.receipt) {
        const wasConfirmedAbsent = this.data.recovery === 'confirm';
        created = await this.lookupPending(current);
        if (!current() || !created || this.data.recovery === 'done') return;
        // A failed lookup never authorizes another write. A confirmed miss needs an explicit click.
        if (!created.eventId && !wasConfirmedAbsent) return;
      }
      if (!created?.eventId) {
        const input = this.creationInput(user);
        const form = Object.fromEntries(Object.keys(formDefaults).map(key => [key, this.data[key]]));
        const receipt = { requestId: this.receipt?.requestId || 'event_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10), input, form };
        wx.setStorageSync(this.storageKey, receipt);
        this.receipt = receipt;
        this.setData({ recovery: 'lookup', recoveryTitle: input.title });
        created = await api.call('event', 'create', { ...input, requestId: receipt.requestId }, options);
        if (!current()) return;
        if (!created?.eventId) throw new Error('活动保存结果暂不可用，请核对原活动');
      }
      if (created.status === 'draft' && !created.reviewRequired) {
        await api.call('event', 'publish', { eventId: created.eventId }, options);
        if (!current()) return;
      }
      await this.load();
    } catch (error) {
      if (current()) this.setData({ error: error.message || '活动提交结果待核对', errorFromForm: true,
        recovery: this.receipt ? 'lookup' : '' }, () => wx.pageScrollTo({ scrollTop: 0, duration: 200 }));
    } finally {
      if (current()) this.setData({ busy: false });
      else if (!this.inactive && sequence === this.loadSequence) await this.load();
    }
  },
  async scan() {
    try {
      const result = await new Promise((resolve, reject) => wx.scanCode({ onlyFromCamera: true, success: resolve, fail: reject }));
      let code = result.scene || result.result || '';
      if (!code && result.path) code = decodeURIComponent((result.path.split('scene=')[1] || '').split('&')[0]);
      if (code.startsWith('e=')) code = code.slice(2);
      this.setData({ scanCode: code || '' });
    } catch (error) { this.setData({ error: error.errMsg || '扫码失败', errorFromForm: false }); }
  },
  async checkin(event) {
    await this.action('checkin', event.currentTarget.dataset.id);
  },
  async showSignups(event) {
    if (this.inactive || !this.data.ready || this.data.loading) return;
    const id = event.currentTarget.dataset.id;
    const activity = this.data.list.find(row => row._id === id && row.status === 'published');
    if (!activity || (id === this.data.rosterId && this.data.rosterLoading)) return;
    this.rosterSequence = (this.rosterSequence || 0) + 1;
    this.setData({ rosterId: id, rosterTitle: activity.title, attendees: [], rosterOffset: 0,
      rosterMore: false, rosterLoading: false, rosterError: '' });
    return this.readRosterPage();
  },
  loadMoreSignups() {
    if (this.data.rosterMore) return this.readRosterPage();
  },
  retrySignups() {
    if (this.data.rosterError) return this.readRosterPage();
  },
  async readRosterPage() {
    const { rosterId, rosterOffset, rosterLoading, ready } = this.data;
    if (this.inactive || !ready || !rosterId || rosterLoading) return;
    const sequence = this.rosterSequence;
    this.setData({ rosterLoading: true, rosterError: '' });
    try {
      const result = await api.call('event', 'listSignups', { eventId: rosterId, offset: rosterOffset }, { loading: false, silent: true });
      if (sequence !== this.rosterSequence) return;
      const rows = result.list;
      const seen = new Set(this.data.attendees.map(row => row.signupId));
      const additions = rows.filter(row => !seen.has(row.signupId) && seen.add(row.signupId));
      this.setData({ attendees: this.data.attendees.concat(additions), rosterOffset: rosterOffset + rows.length,
        rosterMore: rows.length > 0 && result.hasMore === true });
    } catch (error) {
      if (sequence === this.rosterSequence) this.setData({ rosterError: error.message || '报名名单加载失败' });
    } finally {
      if (sequence === this.rosterSequence) this.setData({ rosterLoading: false });
    }
  }
});
