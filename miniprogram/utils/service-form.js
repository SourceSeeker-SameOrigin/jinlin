const api = require('./api');
const { yuan, toFen } = require('./money');
const { slotText } = require('./time');
const { pay } = require('./payment');

const defaults = { express: { pickupText: '', largeCount: '0', stationIndex: 0, placementIndex: 0 },
  trash: { bags: '1', sorted: false }, buy: { shop: '就近便利店', items: '', goodsYuan: '50' },
  meal: { canteenIndex: 0, items: '', goodsYuan: '50' },
  escort: { hospital: '', department: '', date: '', start: '09:00', blocks: '1', pickup: false },
  help: { categoryIndex: 0, desc: '', blocks: '1' },
  pet: { dates: [], visitsPerDay: '1', catCount: '1', dogCount: '0', otherCount: '0', tasks: ['feed','water'], entryIndex: 1, entryPassword: '' } };

// Only known, non-secret fields may survive a page session.
function draftForm(serviceCode, form) {
  const keys = Object.keys(defaults[serviceCode]).filter(key => key !== 'entryPassword').concat('note');
  return Object.fromEntries(keys.filter(key => Object.prototype.hasOwnProperty.call(form, key)).map(key => [key, form[key]]));
}

module.exports = function serviceForm(serviceCode) {
  return {
    data: { serviceCode, loading: true, error: '', quoteError: '', saving: false, quoteLoading: false,
      createdOrderId: '', navigating: false, navigationError: '',
      community: null, addressText: '', addresses: [], addressIndex: 0, form: { ...defaults[serviceCode], note: '' }, slots: [], slotIndex: 0,
      quote: null, amount: '--', couponOptions: [], couponsEnabled: false, pointsEnabled: false, pointsBalance: 0,
      pointsToUse: 0, visitsPerDayOptions: [1,2], entryMethods: ['门锁密码','当面交钥匙','物业钥匙盒'],
      taskChoices: [{ value: 'feed', label: '喂食', checked: true }, { value: 'water', label: '换水', checked: true },
        { value: 'litter', label: '清理猫砂', checked: false }, { value: 'walk', label: '遛狗', checked: false }, { value: 'play', label: '陪玩', checked: false }],
      today: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10), placements: ['放门口', '当面交'], categories: ['搬重物 / 桶装水上楼', '陪老人线下办事', '其他'] },
    onLoad(options) {
      if (serviceCode === 'help' && options && options.idleTitle) {
        const title = options.idleTitle;
        const desc = options.idleDesc || '';
        this.idlePrefill = { categoryIndex: 0,
          desc: ('请帮忙搬运：' + title + (desc ? '。' + desc : '')).slice(0, 200) };
      }
    },
    onShow() { this.hidden = false; this.load(); },
    invalidateRequests() {
      clearTimeout(this.quoteTimer);
      this.quoteSequence = (this.quoteSequence || 0) + 1;
      this.addressSequence = (this.addressSequence || 0) + 1;
      this.loadSequence = (this.loadSequence || 0) + 1;
    },
    onHide() { this.hidden = true; this.invalidateRequests(); },
    onUnload() { this.unloaded = true; this.invalidateRequests(); },
    async load() {
      this.invalidateRequests();
      const sequence = this.loadSequence;
      this.setData({ loading: true, error: '', community: null, quote: null, amount: '--' });
      try {
        const user = await getApp().ensureSession();
        if (sequence !== this.loadSequence || this.hidden || this.unloaded) return;
        if (!user.buildingId) { wx.redirectTo({ url: '/pages/bind/bind' }); return; }
        this.draftKey = 'orderDraft:' + user._id + ':' + serviceCode;
        if (serviceCode === 'escort' && !this.data.form.date) {
          const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
          const date = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, '0'), String(tomorrow.getDate()).padStart(2, '0')].join('-');
          this.setData({ 'form.date': date, escortDateStart: this.dateOffset(0), escortDateEnd: this.dateOffset(30) });
        }
        this.restoreDraft(user);
        if (this.createdOrderId) return;
        if (this.idlePrefill) this.setData({ form: { ...this.data.form, ...this.idlePrefill } });
        const addresses = user.addresses && user.addresses.length ? user.addresses : [{ id: '', communityId: user.communityId,
          buildingId: user.buildingId, buildingName: user.buildingName, unit: user.unit, room: user.room,
          contactName: '', contactPhone: user.phone, isDefault: true }];
        const selected = this.data.addresses[this.data.addressIndex];
        const previousIndex = selected ? addresses.findIndex(item => item.id === selected.id && item.communityId === selected.communityId) : -1;
        const addressIndex = previousIndex >= 0 ? previousIndex : Math.max(0, addresses.findIndex(item => item.isDefault));
        this.setData({ addresses, addressIndex });
        await this.addressChange({ detail: { value: addressIndex } });
      } catch (error) { if (sequence === this.loadSequence && !this.hidden && !this.unloaded) this.setData({ error: error.message || '加载失败，请重试' }); }
      finally { if (sequence === this.loadSequence && !this.hidden && !this.unloaded) this.setData({ loading: false }); }
    },
    restoreDraft(user) {
      if (this.createdOrderId) { this.setData({ createdOrderId: this.createdOrderId, navigating: false }); return; }
      const draft = wx.getStorageSync(this.draftKey);
      if (draft && draft.userId === user._id && typeof draft.createdOrderId === 'string' && draft.createdOrderId) {
        this.createdOrderId = draft.createdOrderId;
        this.setData({ createdOrderId: draft.createdOrderId });
        return;
      }
      if (!draft || draft.userId !== user._id || draft.communityId !== user.communityId || Date.now() - draft.savedAt > 86400000) {
        if (draft) wx.removeStorageSync(this.draftKey);
        this.request = null;
        return;
      }
      const form = draftForm(serviceCode, draft.form || {});
      // Pet request signatures can contain a lock password; never restore or persist them.
      const request = serviceCode === 'pet' ? null : draft.request || null;
      wx.setStorageSync(this.draftKey, { userId: draft.userId, communityId: draft.communityId,
        savedAt: draft.savedAt, form, slot: draft.slot, request });
      this.setData({ form: { ...this.data.form, ...form }, restoredDraft: true });
      this.pendingSlot = draft.slot;
      if (serviceCode !== 'pet') this.request = request;
    },
    saveDraft() {
      const user = getApp().globalData.user;
      if (!this.draftKey || !user || !user._id) return;
      if (this.createdOrderId) {
        wx.setStorageSync(this.draftKey, { userId: user._id, createdOrderId: this.createdOrderId });
        return;
      }
      const slot = this.data.slots[this.data.slotIndex] && this.data.slots[this.data.slotIndex].value;
      wx.setStorageSync(this.draftKey, { userId: user._id, communityId: user.communityId, savedAt: Date.now(),
        form: draftForm(serviceCode, this.data.form), slot, request: serviceCode === 'pet' ? null : this.request });
    },
    address() { wx.navigateTo({ url: '/pages/bind/bind' }); },
    couponChange(event) {
      this.couponChoiceSet = true;
      this.couponId = event.detail.value === '__auto' ? undefined : event.detail.value;
      this.queueQuote();
    },
    pointsChange(event) {
      const value = event.detail.value === '' ? 0 : Number(event.detail.value);
      this.setData({ pointsToUse: value, quote: null, amount: '--' });
      this.saveDraft();
      this.queueQuote();
    },
    dateOffset(days) { const date = new Date(); date.setDate(date.getDate() + days); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); },
    async addressChange(event) {
      const addressIndex = Number(event.detail.value);
      const address = this.data.addresses[addressIndex];
      if (!address) return;
      clearTimeout(this.quoteTimer);
      this.quoteSequence = (this.quoteSequence || 0) + 1;
      const sequence = this.addressSequence = (this.addressSequence || 0) + 1;
      const current = () => sequence === this.addressSequence && !this.hidden && !this.unloaded;
      this.setData({ addressIndex, community: null, quote: null, amount: '--', addressText: '',
        slots: [], slotIndex: 0, error: '', quoteError: '', quoteLoading: true });
      try {
        const community = await api.call('catalog', 'getCommunity', { communityId: address.communityId }, { loading: false, silent: true });
        if (!current()) return;
        this.setData({ community, addressText: community.name + ' ' + address.buildingName + ' ' + address.unit + ' ' + address.room });
        this.queueQuote();
      } catch (error) {
        if (current()) this.setData({ error: error.message || '地址加载失败', quoteLoading: false });
      }
    },
    change(event) {
      const key = event.currentTarget.dataset.field;
      if (!Object.prototype.hasOwnProperty.call(this.data.form, key)) return;
      const value = key === 'sorted' ? event.detail.value.includes('sorted') :
        key === 'visitsPerDay' ? String(Number(event.detail.value) + 1) :
        key === 'entryIndex' ? Number(event.detail.value) : event.detail.value;
      this.setData({ ['form.' + key]: value, quote: null, amount: '--', quoteError: '' });
      if (key === 'tasks') this.setData({ taskChoices: this.data.taskChoices.map(item => ({ ...item, checked: value.includes(item.value) })) });
      this.saveDraft();
      this.queueQuote();
    },
    addPetDate(event) {
      if (serviceCode !== 'pet') return;
      const date = event.detail.value;
      if (!date || this.data.form.dates.includes(date)) return;
      if (this.data.form.dates.length >= 15) { this.setData({ quoteError: '最多选择 15 个服务日期' }); return; }
      const dates = [...this.data.form.dates, date].sort();
      this.setData({ 'form.dates': dates, quote: null, amount: '--', quoteError: '' }); this.saveDraft(); this.queueQuote();
    },
    removePetDate(event) {
      const dates = this.data.form.dates.filter(date => date !== event.currentTarget.dataset.date);
      this.setData({ 'form.dates': dates, quote: null, amount: '--' }); this.saveDraft(); this.queueQuote();
    },
    slotChange(event) { this.setData({ slotIndex: Number(event.detail.value), quote: null, amount: '--' }); this.saveDraft(); this.queueQuote(); },
    queueQuote() {
      clearTimeout(this.quoteTimer);
      this.quoteSequence = (this.quoteSequence || 0) + 1;
      this.setData({ quote: null, amount: '--', quoteLoading: true });
      this.quoteTimer = setTimeout(() => this.refreshQuote(), 300);
    },
    params() {
      const form = this.data.form;
      const community = this.data.community;
      let detail;
      if (serviceCode === 'express') detail = { stationCode: (community.stations[Number(form.stationIndex)] || {}).code || '',
        pickupCodes: form.pickupText.split(/[\n,，]/).map(value => value.trim()).filter(Boolean),
        largeCount: Number(form.largeCount), placement: Number(form.placementIndex) === 1 ? 'hand' : 'door' };
      if (serviceCode === 'trash') detail = { bags: Number(form.bags), sorted: form.sorted, placement: 'door' };
      if (serviceCode === 'buy') detail = { shop: form.shop, items: form.items, goodsCap: toFen(form.goodsYuan) };
      if (serviceCode === 'meal') detail = { canteenCode: (community.canteens[Number(form.canteenIndex)] || {}).code || '',
        items: form.items, goodsCap: toFen(form.goodsYuan) };
      if (serviceCode === 'escort') detail = { hospital: form.hospital, department: form.department, date: form.date,
        start: form.start, blocks: Number(form.blocks), pickup: form.pickup };
      if (serviceCode === 'pet') {
        const pets = [{ kind: 'cat', count: Number(form.catCount) }, { kind: 'dog', count: Number(form.dogCount) },
          { kind: 'other', count: Number(form.otherCount) }].filter(item => item.count > 0);
        detail = { dates: form.dates, visitsPerDay: Number(form.visitsPerDay), pets, tasks: form.tasks,
          entry: ['password','key_handover','property_keybox'][Number(form.entryIndex)], entryPassword: form.entryPassword };
      }
      if (serviceCode === 'help') {
        const help = community.prices && community.prices.help || {};
        detail = { category: ['carry', 'elder', 'other'][Number(form.categoryIndex)], desc: form.desc,
          ...(help.billingMode === 'per_visit' ? { billingMode: 'per_visit', includedMinutes: help.includedMinutes } : { blocks: Number(form.blocks) }) };
      }
      const address = this.data.addresses[this.data.addressIndex];
      const params = { communityId: community._id, addressId: address && address.id || undefined, serviceCode, detail, note: form.note,
        slot: serviceCode === 'escort' ? undefined : (this.data.slots[this.data.slotIndex] ? this.data.slots[this.data.slotIndex].value : undefined) };
      if (this.couponChoiceSet && this.couponId !== undefined) params.couponId = this.couponId;
      if (this.data.pointsEnabled) params.pointsToUse = Number(this.data.pointsToUse || 0);
      return params;
    },
    async refreshQuote() {
      if (!this.data.community || this.hidden || this.unloaded) return;
      const sequence = (this.quoteSequence || 0) + 1;
      this.quoteSequence = sequence;
      this.setData({ quoteLoading: true, quoteError: '' });
      try {
        // metadata 模式允许未填完表单时先取得有效时段及月卡提示，不生成订单。
        const result = await api.call('order', 'quote', { ...this.params(), metadata: true }, { loading: false, silent: true });
        if (sequence !== this.quoteSequence || this.unloaded) return;
        const selected = this.data.slots[this.data.slotIndex];
        const slots = (result.onDutyCount > 0 ? [{ label: '尽快上门', value: null }] : [])
          .concat(result.slots.map(value => ({ label: slotText(value), value })));
        const sameSlot = selected ? slots.findIndex(item => JSON.stringify(item.value) === JSON.stringify(selected.value)) : 0;
        this.setData({ slots, slotIndex: Math.max(0, sameSlot), hasTrashMembership: result.hasTrashMembership,
          couponOptions: (result.couponOptions || []).map(item => ({ ...item, label: item.name + ' · 减 ¥' + yuan(item.discount) })),
          couponsEnabled: result.couponsEnabled === true, pointsEnabled: result.pointsEnabled === true,
          pointsBalance: result.pointsBalance || 0,
          dutyHint: result.onDutyCount > 0 ? '' : slots.length ? '当前暂无服务员值班，可选择服务时段预约，实际服务以接单确认为准' : '暂时没有可预约时段',
          quote: result.pricing, amount: result.pricing ? yuan(result.pricing.payAmount + result.pricing.goodsCap) : '--', quoteError: result.validationMessage || '' });
        if (this.pendingSlot) {
          const restoredIndex = slots.findIndex(item => JSON.stringify(item.value) === JSON.stringify(this.pendingSlot));
          if (restoredIndex >= 0) this.setData({ slotIndex: restoredIndex });
          this.pendingSlot = null;
        }
      } catch (error) {
        if (sequence === this.quoteSequence && !this.unloaded) this.setData({ quote: null, amount: '--', quoteError: error.message || '报价失败，请重试' });
      } finally { if (sequence === this.quoteSequence && !this.unloaded) this.setData({ quoteLoading: false }); }
    },
    retryQuote() { return this.data.community ? this.refreshQuote() : this.addressChange({ detail: { value: this.data.addressIndex } }); },
    openCreatedOrder() {
      if (!this.createdOrderId || this.data.navigating || this.hidden || this.unloaded) return;
      this.setData({ navigating: true, navigationError: '' });
      const failed = () => {
        if (!this.hidden && !this.unloaded) this.setData({ navigating: false,
          navigationError: '订单已创建，暂未打开详情，请点击下方按钮重试。不会重复下单。' });
      };
      try {
        wx.redirectTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(this.createdOrderId),
          success: () => {
            // A newer page may already own this draft key. Only clear our own receipt.
            try {
              const saved = this.draftKey && wx.getStorageSync(this.draftKey);
              if (saved && saved.createdOrderId === this.createdOrderId) wx.removeStorageSync(this.draftKey);
            } catch (_) { /* Keep the receipt for recovery if local storage is unavailable. */ }
          }, fail: failed });
      } catch (_) { failed(); }
    },
    async submit() {
      if (this.data.saving || this.hidden || this.unloaded) return;
      if (this.createdOrderId) { this.openCreatedOrder(); return; }
      if (!this.data.quote || this.data.quoteLoading) return;
      this.setData({ saving: true, error: '' });
      try {
        const params = this.params();
        const signature = JSON.stringify(params);
        if (!this.request || this.request.signature !== signature) this.request = {
          signature, id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) };
        this.saveDraft();
        const created = await api.call('order', 'create', { ...params, requestId: this.request.id });
        if (!created || typeof created.orderId !== 'string' || !created.orderId) throw Error('未取得订单编号，请重试');
        this.createdOrderId = created.orderId;
        this.request = null;
        // Once confirmed, persist only the receipt, never the form or entry password.
        try { this.saveDraft(); } catch (_) { /* The in-memory receipt still prevents another create. */ }
        if (this.unloaded || this.hidden) return;
        this.setData({ createdOrderId: created.orderId, navigationError: '' });
        try { await pay(created); }
        catch (error) { if (!this.unloaded && !this.hidden) wx.showToast({ title: error.message || '支付未完成，可到订单详情继续支付', icon: 'none' }); }
        this.openCreatedOrder();
      } catch (error) { if (!this.unloaded && !this.hidden) this.setData({ error: error.message || '下单失败，请重试' }); }
      finally { if (!this.unloaded) this.setData({ saving: false }); }
    }
  };
};
