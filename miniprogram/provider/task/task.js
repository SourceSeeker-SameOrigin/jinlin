const entryDisplay = require('../../utils/entry-display');
const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { slotText } = require('../../utils/time');
const { toFen, yuan } = require('../../utils/money');
const vacantItems = [{ key: 'windows', label: '门窗检查' }, { key: 'utilities', label: '水电燃气' },
  { key: 'leakMold', label: '漏水与霉斑' }, { key: 'ventilation', label: '开窗通风 30 分钟' },
  { key: 'mail', label: '代收快递信件' }, { key: 'photos', label: '巡检拍照' }];
Page({
  data: { taskReady: false, readingEntry: false, entryPassword: '', missingRecord: false, loading: true, busy: false, error: '', order: null, photos: [], receiptPhoto: '', goodsYuan: '',
    weightsTenths: {}, visitChecks: { mental: false, diet: false, utilities: false, doors: false, medical: false }, visitNotes: '', visitAttention: false, attentionCallConfirmed: false,
    vacantItems, checklist: {}, photoByItem: {}, vacantNotes: '', vacantAttention: false, entryText: '' },
  onLoad(options = {}) {
    this.orderId = typeof options.id === 'string' ? options.id.trim() : '';
    this.setData({ missingRecord: !this.orderId, loading: !!this.orderId });
  },
  onShow() { this.visible = true; return this.load(); },
  leavePage() {
    this.visible = false; this.taskRead = (this.taskRead || 0) + 1;
    this.clearTaskContext();
    entryDisplay.clear(this);
    this.stopLocationTimer();
  },
  onHide() { this.leavePage(); },
  onUnload() { this.leavePage(); },
  stopLocationTimer() { if (this.locationTimer) clearInterval(this.locationTimer); this.locationTimer = null; },
  clearTaskContext() {
    this.taskContext = null; this.locationRequest = null; this.locationBusy = false;
    this.setData({ taskReady: false, order: null });
    if (this.releaseRequest) { this.releaseRequest = null; this.setData({ busy: false }); }
    if (this.workRequest) { this.workRequest = null; this.setData({ busy: false }); }
  },
  async load() {
    this.clearTaskContext();
    this.stopLocationTimer();
    if (!this.orderId || !this.visible) return;
    const token = this.taskRead = (this.taskRead || 0) + 1;
    const orderId = this.orderId;
    let userId;
    const current = () => this.visible && this.taskRead === token && this.orderId === orderId &&
      (!userId || getApp().globalData.user?._id === userId);
    entryDisplay.clear(this);
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!current()) return;
      userId = user && user._id;
      if (!userId) throw new Error('登录资料暂不可用，请重试');
      if (!current()) return;
      if (this.draftOwner?.userId !== userId || this.draftOwner?.orderId !== orderId) {
        this.setData({ photos: [], receiptPhoto: '', goodsYuan: '', weightsTenths: {},
          visitChecks: { mental: false, diet: false, utilities: false, doors: false, medical: false },
          visitNotes: '', visitAttention: false, attentionCallConfirmed: false,
          checklist: {}, photoByItem: {}, vacantNotes: '', vacantAttention: false });
        this.draftOwner = { userId, orderId };
      }
      const order = await api.call('order', 'detail', { orderId },
        { loading: false, silent: true, redirectOnForbidden: false, isActive: current });
      if (!current() || !userId || getApp().globalData.user?._id !== userId) return;
      const entryText = order.detail && ({ password: '门锁密码（点击当天读取）', key_handover: '钥匙交接', property_keybox: '物业钥匙柜' }[order.detail.entry] || '');
      const categoryNames = { paper: '纸类', plastic: '塑料', metal: '金属', clothing: '衣物', appliance: '小家电' };
      this.setData({ order, recycleRows: order.serviceCode === 'recycle' ? order.detail.categories.map(code => ({ code, name: categoryNames[code],
        value: Object.prototype.hasOwnProperty.call(this.data.weightsTenths, code) ? String(this.data.weightsTenths[code] / 10) : '' })) : [], slotText: slotText(order.slot), goodsCap: yuan(order.pricing.goodsCap),
        pickupText: order.detail && order.detail.pickupCodes ? order.detail.pickupCodes.join('、') : '', entryText });
      this.taskContext = { userId, orderId, read: token };
      this.setData({ taskReady: true });
      if (order.canShareLocation && ['accepted', 'in_service'].includes(order.status)) {
        this.uploadLocation();
        this.locationTimer = setInterval(() => this.uploadLocation(), 30000);
      }
    } catch (error) { if (current()) this.setData({ error: error.message || '任务加载失败' }); }
    finally { if (current()) this.setData({ loading: false }); }
  },
  async uploadLocation() {
    const context = this.taskContext;
    const current = () => context && this.taskContext === context && this.visible &&
      this.taskRead === context.read && this.orderId === context.orderId &&
      getApp().globalData.user?._id === context.userId && this.data.order?.canShareLocation &&
      ['accepted', 'in_service'].includes(this.data.order.status);
    if (!current() || this.locationBusy) return;
    const request = this.locationRequest = {};
    this.locationBusy = true;
    try {
      const point = await new Promise((resolve, reject) => wx.getLocation({ type: 'gcj02', success: resolve, fail: reject }));
      if (!current() || this.locationRequest !== request) return;
      await api.call('provider', 'updateLocation', { orderId: context.orderId, lat: point.latitude, lng: point.longitude }, { loading: false, silent: true });
    } catch (_) { /* 用户拒绝定位或定位暂不可用时，不影响订单操作。 */ }
    finally { if (this.locationRequest === request) { this.locationRequest = null; this.locationBusy = false; } }
  },
  goods(event) { this.setData({ goodsYuan: event.detail.value }); },
  weight(event) { const v = event.detail.value; const value = /^\d{1,5}(?:\.\d)?$/.test(v) ? Math.round(Number(v) * 10) : 0;
    this.setData({ ['weightsTenths.' + event.currentTarget.dataset.code]: value,
      recycleRows: this.data.recycleRows.map(row => row.code === event.currentTarget.dataset.code ? { ...row, value: v } : row) }); },
  visitCheck(event) {
    const checked = new Set(event.detail.value || []);
    this.setData({ weightsTenths: {}, visitChecks: { mental: checked.has('mental'), diet: checked.has('diet'),
      utilities: checked.has('utilities'), doors: checked.has('doors'), medical: checked.has('medical') } });
  },
  visitNotes(event) { this.setData({ visitNotes: event.detail.value }); },
  visitAttention(event) { this.setData({ visitAttention: event.detail.value, attentionCallConfirmed: false }); },
  checklist(event) { this.setData({ ['checklist.' + event.currentTarget.dataset.key]: Boolean((event.detail.value || []).length) }); },
  vacantNotes(event) { this.setData({ vacantNotes: event.detail.value }); },
  vacantAttention(event) { this.setData({ vacantAttention: event.detail.value }); },
  async vacantPhoto(event) {
    if (!this.orderId) return;
    const key = event.currentTarget.dataset.key;
    try {
      const files = await uploadPhotos('vacant/' + this.orderId + '/' + key, 1);
      this.setData({ ['photoByItem.' + key]: [...(this.data.photoByItem[key] || []), ...files] });
    } catch (error) { this.setData({ error: error.message || '照片上传失败，请重试' }); }
  },
  revealEntry() {
    const order = this.data.order;
    if (!this.orderId || this.data.busy || order?.serviceCode !== 'vacant' || order.detail?.entry !== 'password') return;
    return entryDisplay.reveal(this, () => api.call('vacant', 'revealEntry', { orderId: this.orderId }));
  },
  closeSecret() { entryDisplay.clear(this); },
  async submitVacantReport() {
    if (!this.orderId) return;
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      await api.call('vacant', 'recordReport', { orderId: this.orderId, checklist: this.data.checklist,
        photoByItem: this.data.photoByItem, notes: this.data.vacantNotes, attention: this.data.vacantAttention });
      wx.showToast({ title: this.data.vacantAttention ? '报告已提交，请关注异常' : '巡检报告已提交' });
      await this.load();
    } catch (error) { this.setData({ error: error.message || '报告提交失败，请检查清单和照片' }); }
    finally { this.setData({ busy: false }); }
  },
  async photo(event) {
    if (!this.orderId) return;
    try {
      const receipt = event.currentTarget.dataset.type === 'receipt';
      const files = await uploadPhotos('orders/' + this.orderId, receipt ? 1 : 3);
      this.setData(receipt ? { receiptPhoto: files[0] } : { photos: files });
    } catch (error) { this.setData({ error: error.message || '未完成拍照上传，请重试' }); }
  },
  async releaseTask() {
    if (!this.visible || this.data.loading || !this.data.taskReady || this.data.busy || this.releaseRequest) return;
    const context = this.taskContext;
    if (!context || getApp().globalData.user?._id !== context.userId) return this.load();
    const current = () => this.visible && this.taskContext === context && this.taskRead === context.read &&
      this.orderId === context.orderId && getApp().globalData.user?._id === context.userId &&
      this.data.taskReady && !this.data.loading && this.data.order?.status === 'accepted';
    if (!current()) return;
    const request = this.releaseRequest = {};
    const active = () => this.releaseRequest === request && current();
    this.setData({ busy: true, error: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: '放弃任务',
        content: '放弃后，你将不能再次接取这笔订单。确认放弃吗？', success: resolve, fail: reject }));
      if (!active() || !answer.confirm) return;
      await api.call('provider', 'release', { orderId: context.orderId },
        { loading: false, silent: true, redirectOnForbidden: false, isActive: active });
      if (!active()) return;
      wx.redirectTo({ url: '/provider/workbench/workbench' });
    } catch (error) {
      if (active()) this.setData({ error: error.message || '放弃任务未完成，请刷新核对后重试' });
    } finally {
      if (this.releaseRequest === request && this.visible && this.taskContext === context &&
        this.orderId === context.orderId && getApp().globalData.user?._id === context.userId) {
        this.releaseRequest = null;
        this.setData({ busy: false });
      }
    }
  },
  async act(event) {
    if (!this.orderId) return;
    const action = event.currentTarget.dataset.action;
    if (this.data.busy || !['start', 'release', 'deliver'].includes(action)) return;
    if (action === 'release') return this.releaseTask();
    if (!this.visible || this.data.loading || !this.data.taskReady || this.workRequest) return;
    const context = this.taskContext;
    if (!context || getApp().globalData.user?._id !== context.userId || this.orderId !== context.orderId) return this.load();
    const current = () => this.visible && this.taskContext === context && this.taskRead === context.read &&
      this.orderId === context.orderId && getApp().globalData.user?._id === context.userId &&
      this.data.taskReady && !this.data.loading && this.data.order?.featureEnabled &&
      this.data.order.status === (action === 'start' ? 'accepted' : 'in_service') &&
      !(action === 'deliver' && this.data.order.serviceCode === 'vacant');
    if (!current()) return;
    const request = this.workRequest = {};
    const active = () => this.workRequest === request && current();
    this.setData({ busy: true, error: '' });
    try {
      const actionData = this.data.order.serviceCode === 'recycle' && action === 'deliver' ? { orderId: context.orderId, weightsTenths: this.data.weightsTenths } : { orderId: context.orderId, photos: this.data.photos,
        receiptPhoto: this.data.receiptPhoto, goodsActual: toFen(this.data.goodsYuan),
        visitReport: this.data.order.serviceCode === 'visit' ? { checks: this.data.visitChecks, notes: this.data.visitNotes,
          attention: this.data.visitAttention, attentionCallConfirmed: this.data.attentionCallConfirmed } : undefined };
      await api.call('provider', action, actionData,
        { loading: false, silent: true, redirectOnForbidden: false, isActive: active });
      if (active()) await this.load();
    } catch (error) { if (active()) this.setData({ error: error.message || '操作未完成，请刷新核对后重试' }); }
    finally {
      if (this.workRequest === request && this.visible && this.taskContext === context &&
        this.orderId === context.orderId && getApp().globalData.user?._id === context.userId) {
        this.workRequest = null;
        this.setData({ busy: false });
      }
    }
  },
  callResident() {
    if (!this.orderId) return; if (this.data.order?.canCallResident) wx.makePhoneCall({ phoneNumber: this.data.order.userPhone,
    success: () => { if (this.data.order?.serviceCode === 'visit' && this.data.visitAttention) this.setData({ attentionCallConfirmed: true }); } }); },
  openChat() {
    if (!this.orderId) return; wx.navigateTo({ url: '/chat/room/room?orderId=' + encodeURIComponent(this.orderId) }); }
  ,openPetTasks() {
    if (!this.orderId) return; wx.navigateTo({ url: '/pet/work?id=' + encodeURIComponent(this.orderId) }); }
});
