const api = require('../../utils/api');
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
    communities: [], communityIndex: 0, communityId: '', ready: false },
  onShow() { this.inactive = false; return this.load(); },
  onHide() { this.inactive = true; this.invalidateReads(); },
  onUnload() { this.inactive = true; this.invalidateReads(); },
  invalidateReads() {
    this.loadSequence = (this.loadSequence || 0) + 1;
    this.rosterSequence = (this.rosterSequence || 0) + 1;
  },
  async load() {
    if (this.inactive) return;
    this.invalidateReads();
    const sequence = this.loadSequence;
    this.setData({ loading: true, ready: false, error: '', errorFromForm: false, list: [], attendees: [], scanCode: '',
      eventOffset: 0, eventMore: false, eventLoading: false, eventError: '',
      rosterId: '', rosterTitle: '', rosterMore: false, rosterLoading: false, rosterError: '', rosterOffset: 0 });
    try {
      const user = await getApp().ensureSession();
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
      if (sequence !== this.loadSequence) return;
      const selectedId = isAdmin ? this.data.communityId || user.communityId : user.communityId;
      const communityIndex = Math.max(0, communities.findIndex(item => item._id === selectedId));
      const communityId = (communities[communityIndex] || {})._id || '';
      this.setData({ isAdmin, communities, communityIndex, communityId });
      if (!communityId) throw new Error('请先配置并选择管理小区');
      const result = await api.call('event', 'adminList', { communityId }, { loading: false, silent: true });
      if (sequence === this.loadSequence) this.setData({ list: result.list, ready: true,
        eventOffset: result.list.length, eventMore: result.hasMore === true && result.list.length > 0 });
    } catch (error) { if (sequence === this.loadSequence) this.setData({ error: error.message || '活动管理加载失败' }); }
    finally { if (sequence === this.loadSequence) this.setData({ loading: false }); }
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
    if (!this.data.isAdmin || this.data.loading || this.data.busy) return;
    const community = this.data.communities[Number(event.detail.value)];
    if (!community || community._id === this.data.communityId) return;
    this.setData({ communityId: community._id });
    await this.load();
  },
  async publish(event) {
    const item = this.data.list.find(row => row._id === event.currentTarget.dataset.id);
    if (item && getApp().globalData.user.roles.includes('admin') && item.reviewRequested) {
      try { await api.call('event', 'review', { eventId: item._id, approved: true }); await this.load(); }
      catch (error) { this.setData({ error: error.message || '审核失败', errorFromForm: false }); }
    } else await this.action('publish', event.currentTarget.dataset.id);
  },
  async cancel(event) { await this.action('cancelEvent', event.currentTarget.dataset.id); },
  async retryCancellation(event) { await this.action('retryCancellation', event.currentTarget.dataset.id); },
  async action(action, eventId) {
    try { await api.call('event', action, { eventId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '操作失败', errorFromForm: false }); }
  },
  input(event) { const field = event.currentTarget.dataset.field; this.setData({ [field]: event.detail.value }); },
  typeChange(event) { this.setData({ type: this.data.types[Number(event.detail.value)] || 'interest' }); },
  async createActivity() {
    if (this.data.busy || this.data.loading || !this.data.ready || !this.data.communityId) return;
    const communityId = this.data.communityId;
    this.setData({ busy: true, error: '', errorFromForm: true });
    try {
      const toDate = (date, time, label) => {
        if (!date) throw new Error('请选择' + label + '日期');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(label + '日期或时间不正确');
        const value = new Date(date + 'T' + time + ':00+08:00');
        if (!Number.isFinite(value.getTime()) || ymd(value) !== date) throw new Error(label + '日期不存在');
        return value;
      };
      const startAt = toDate(this.data.startDate, this.data.startTime, '活动开始');
      const endAt = toDate(this.data.endDate, this.data.endTime, '活动结束');
      const signupDeadline = toDate(this.data.deadlineDate, this.data.deadlineTime, '报名截止');
      const user = await getApp().ensureSession();
      const created = await api.call('event', 'create', { title: this.data.title, desc: this.data.desc, location: this.data.location,
        type: this.data.type, fee: this.data.type === 'charity' ? 0 : amountFen(this.data.fee, '活动费用'), capacity: Number(this.data.capacity), communityIds: [user.roles.includes('admin') ? communityId : user.communityId],
        sponsors: user.roles.includes('admin') && this.data.sponsorName && Number(this.data.sponsorAmount) > 0 ? [{ name: this.data.sponsorName,
          amount: amountFen(this.data.sponsorAmount, '赞助金额'), note: this.data.sponsorNote }] : [],
        startAt, endAt, signupDeadline });
      await api.call('event', 'publish', { eventId: created.eventId });
      this.setData({ title: '', desc: '', location: '' }); await this.load();
    } catch (error) {
      this.setData({ error: error.message || '活动创建失败', errorFromForm: true }, () => {
        wx.pageScrollTo({ scrollTop: 0, duration: 200 });
      });
    }
    finally { this.setData({ busy: false }); }
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
    if (this.data.busy || this.data.loading || !this.data.ready) return;
    const eventId = event.currentTarget.dataset.id;
    const item = this.data.list.find(row => row._id === eventId);
    if (!item || item.status !== 'published') return this.setData({ error: '活动未发布或已结束，不能签到', errorFromForm: false });
    if (!this.data.scanCode) return this.setData({ error: '请先扫描活动签到码', errorFromForm: false });
    this.setData({ busy: true, error: '', errorFromForm: false });
    try { await api.call('event', 'checkin', { eventId, checkinCode: this.data.scanCode }); this.setData({ scanCode: '', error: '' }); }
    catch (error) { this.setData({ error: error.message || '签到失败', errorFromForm: false }); }
    finally { this.setData({ busy: false }); }
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
