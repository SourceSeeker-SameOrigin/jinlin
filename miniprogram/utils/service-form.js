const api = require('./api');
const { yuan, toFen } = require('./money');
const { slotText } = require('./time');
const { pay } = require('./payment');

const defaults = { express: { pickupText: '', largeCount: '0', stationIndex: 0, placementIndex: 0 },
  trash: { bags: '1', sorted: false }, buy: { shop: '就近便利店', items: '', goodsYuan: '50' },
  help: { categoryIndex: 0, desc: '', blocks: '1' } };

module.exports = function serviceForm(serviceCode) {
  return {
    data: { serviceCode, loading: true, error: '', quoteError: '', saving: false, quoteLoading: false,
      community: null, addressText: '', form: { ...defaults[serviceCode], note: '' }, slots: [], slotIndex: 0,
      quote: null, amount: '--', placements: ['放门口', '当面交'], categories: ['搬重物 / 桶装水上楼', '陪老人线下办事', '其他'] },
    onShow() { this.load(); },
    onHide() { clearTimeout(this.quoteTimer); this.quoteSequence = (this.quoteSequence || 0) + 1; },
    onUnload() { this.unloaded = true; clearTimeout(this.quoteTimer); },
    async load() {
      this.setData({ loading: true, error: '' });
      try {
        const user = await getApp().ensureSession();
        if (!user.buildingId) { wx.navigateTo({ url: '/pages/bind/bind' }); return; }
        this.draftKey = 'orderDraft:' + user._id + ':' + serviceCode;
        this.restoreDraft(user);
        const community = await api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true });
        const building = community.buildings.find(item => item._id === user.buildingId);
        this.setData({ community, addressText: community.name + ' ' + (building ? building.name : '') + ' ' + user.unit + ' ' + user.room });
        await this.refreshQuote();
      } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
      finally { if (!this.unloaded) this.setData({ loading: false }); }
    },
    restoreDraft(user) {
      const draft = wx.getStorageSync(this.draftKey);
      if (!draft || draft.userId !== user._id || draft.communityId !== user.communityId || Date.now() - draft.savedAt > 86400000) {
        if (draft) wx.removeStorageSync(this.draftKey);
        this.request = null;
        return;
      }
      this.setData({ form: { ...this.data.form, ...(draft.form || {}) }, restoredDraft: true });
      this.pendingSlot = draft.slot;
      this.request = draft.request || null;
    },
    saveDraft() {
      const user = getApp().globalData.user;
      if (!this.draftKey || !user || !user._id) return;
      const slot = this.data.slots[this.data.slotIndex] && this.data.slots[this.data.slotIndex].value;
      wx.setStorageSync(this.draftKey, { userId: user._id, communityId: user.communityId, savedAt: Date.now(),
        form: this.data.form, slot, request: this.request });
    },
    address() { wx.navigateTo({ url: '/pages/bind/bind' }); },
    change(event) {
      const key = event.currentTarget.dataset.field;
      if (!Object.prototype.hasOwnProperty.call(this.data.form, key)) return;
      const value = key === 'sorted' ? event.detail.value.includes('sorted') : event.detail.value;
      this.setData({ ['form.' + key]: value, quote: null, amount: '--', quoteError: '' });
      this.saveDraft();
      this.queueQuote();
    },
    slotChange(event) { this.setData({ slotIndex: Number(event.detail.value), quote: null, amount: '--' }); this.saveDraft(); this.queueQuote(); },
    queueQuote() {
      clearTimeout(this.quoteTimer);
      this.quoteSequence = (this.quoteSequence || 0) + 1;
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
      if (serviceCode === 'help') detail = { category: ['carry', 'elder', 'other'][Number(form.categoryIndex)], desc: form.desc, blocks: Number(form.blocks) };
      return { communityId: community._id, serviceCode, detail, note: form.note,
        slot: this.data.slots[this.data.slotIndex] ? this.data.slots[this.data.slotIndex].value : undefined };
    },
    async refreshQuote() {
      if (!this.data.community) return;
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
          dutyHint: result.onDutyCount > 0 ? '' : slots.length ? '现在没有服务员值班，最早 ' + slots[0].label + ' 上门' : '暂时没有可预约时段',
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
    retryQuote() { this.refreshQuote(); },
    async submit() {
      if (this.data.saving || !this.data.quote || this.data.quoteLoading) return;
      this.setData({ saving: true, error: '' });
      try {
        const params = this.params();
        const signature = JSON.stringify(params);
        if (!this.request || this.request.signature !== signature) this.request = {
          signature, id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) };
        this.saveDraft();
        const created = await api.call('order', 'create', { ...params, requestId: this.request.id });
        this.request = null;
        if (this.draftKey) wx.removeStorageSync(this.draftKey);
        try { await pay(created); }
        catch (error) { wx.showToast({ title: error.message || '支付未完成，可到订单详情继续支付', icon: 'none' }); }
        wx.redirectTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(created.orderId) });
      } catch (error) { this.setData({ error: error.message || '下单失败，请重试' }); }
      finally { if (!this.unloaded) this.setData({ saving: false }); }
    }
  };
};
