const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { slotText } = require('../../utils/time');
const { toFen, yuan } = require('../../utils/money');
const vacantItems = [{ key: 'windows', label: '门窗检查' }, { key: 'utilities', label: '水电燃气' },
  { key: 'leakMold', label: '漏水与霉斑' }, { key: 'ventilation', label: '开窗通风 30 分钟' },
  { key: 'mail', label: '代收快递信件' }, { key: 'photos', label: '巡检拍照' }];
Page({
  data: { loading: true, busy: false, error: '', order: null, photos: [], receiptPhoto: '', goodsYuan: '',
    weightsTenths: {}, visitChecks: { mental: false, diet: false, utilities: false, doors: false, medical: false }, visitNotes: '', visitAttention: false, attentionCallConfirmed: false,
    vacantItems, checklist: {}, photoByItem: {}, vacantNotes: '', vacantAttention: false, entryText: '' },
  onLoad(options) { this.orderId = options.id; },
  onShow() { this.visible = true; this.load(); },
  onHide() { this.visible = false; this.stopLocationTimer(); },
  onUnload() { this.visible = false; this.stopLocationTimer(); },
  stopLocationTimer() { if (this.locationTimer) clearInterval(this.locationTimer); this.locationTimer = null; },
  async load() {
    this.setData({ loading: true, error: '' });
    this.stopLocationTimer();
    try {
      await getApp().ensureSession();
      const order = await api.call('order', 'detail', { orderId: this.orderId }, { loading: false });
      const entryText = order.detail && ({ password: '门锁密码（点击当天读取）', key_handover: '钥匙交接', property_keybox: '物业钥匙柜' }[order.detail.entry] || '');
      const categoryNames = { paper: '纸类', plastic: '塑料', metal: '金属', clothing: '衣物', appliance: '小家电' };
      this.setData({ order, recycleRows: order.serviceCode === 'recycle' ? order.detail.categories.map(code => ({ code, name: categoryNames[code], value: '' })) : [], slotText: slotText(order.slot), goodsCap: yuan(order.pricing.goodsCap),
        pickupText: order.detail && order.detail.pickupCodes ? order.detail.pickupCodes.join('、') : '', entryText });
      if (order.canShareLocation && this.visible) {
        this.uploadLocation();
        this.locationTimer = setInterval(() => this.uploadLocation(), 30000);
      }
    } catch (error) { this.setData({ error: error.message || '任务加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async uploadLocation() {
    const order = this.data.order;
    if (!order || !order.canShareLocation || !['accepted','in_service'].includes(order.status) || this.locationBusy) return;
    this.locationBusy = true;
    try {
      const point = await new Promise((resolve, reject) => wx.getLocation({ type: 'gcj02', success: resolve, fail: reject }));
      await api.call('provider', 'updateLocation', { orderId: this.orderId, lat: point.latitude, lng: point.longitude }, { loading: false, silent: true });
    } catch (_) { /* 用户拒绝定位或定位暂不可用时，不影响订单操作。 */ }
    finally { this.locationBusy = false; }
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
    const key = event.currentTarget.dataset.key;
    try {
      const files = await uploadPhotos('vacant/' + this.orderId + '/' + key, 1);
      this.setData({ ['photoByItem.' + key]: [...(this.data.photoByItem[key] || []), ...files] });
    } catch (error) { this.setData({ error: error.message || '照片上传失败，请重试' }); }
  },
  async revealEntry() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const result = await api.call('vacant', 'revealEntry', { orderId: this.orderId });
      wx.showModal({ title: '门锁密码', content: result.entry, showCancel: false });
    } catch (error) { this.setData({ error: error.message || '无法读取入户信息' }); }
    finally { this.setData({ busy: false }); }
  },
  async submitVacantReport() {
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
    try {
      const receipt = event.currentTarget.dataset.type === 'receipt';
      const files = await uploadPhotos('orders/' + this.orderId, receipt ? 1 : 3);
      this.setData(receipt ? { receiptPhoto: files[0] } : { photos: files });
    } catch (error) { this.setData({ error: error.message || '未完成拍照上传，请重试' }); }
  },
  async act(event) {
    const action = event.currentTarget.dataset.action;
    if (this.data.busy || !['start', 'release', 'deliver'].includes(action)) return;
    if (action === 'release') {
      const answer = await new Promise(resolve => wx.showModal({ title: '放弃任务', content: '放弃后，你将不能再次接取这笔订单。确认放弃吗？', success: resolve }));
      if (!answer.confirm) return;
    }
    this.setData({ busy: true, error: '' });
    try {
      const actionData = this.data.order.serviceCode === 'recycle' && action === 'deliver' ? { orderId: this.orderId, weightsTenths: this.data.weightsTenths } : { orderId: this.orderId, photos: this.data.photos,
        receiptPhoto: this.data.receiptPhoto, goodsActual: toFen(this.data.goodsYuan),
        visitReport: this.data.order.serviceCode === 'visit' ? { checks: this.data.visitChecks, notes: this.data.visitNotes,
          attention: this.data.visitAttention, attentionCallConfirmed: this.data.attentionCallConfirmed } : undefined };
      await api.call('provider', action, actionData);
      if (action === 'release') wx.redirectTo({ url: '/provider/workbench/workbench' });
      else await this.load();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  callResident() { if (this.data.order.canCallResident) wx.makePhoneCall({ phoneNumber: this.data.order.userPhone,
    success: () => { if (this.data.order.serviceCode === 'visit' && this.data.visitAttention) this.setData({ attentionCallConfirmed: true }); } }); },
  openChat() { wx.navigateTo({ url: '/chat/room/room?orderId=' + encodeURIComponent(this.orderId) }); }
  ,openPetTasks() { wx.navigateTo({ url: '/pet/work?id=' + encodeURIComponent(this.orderId) }); }
});
