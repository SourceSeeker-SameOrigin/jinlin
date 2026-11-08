const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
const { pay } = require('../../utils/payment');
Page({
  data: { loading: true, busy: false, error: '', plans: [], cards: [], addresses: [], addressIndex: 0,
    slots: ['早班', '中班', '晚班'], slotIndex: 2, entryOptions: ['密码入户', '交接钥匙', '物业钥匙柜'], entry: 'password', entryPassword: '' },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.buildingId && !(user.addresses && user.addresses.length)) { wx.redirectTo({ url: '/pages/bind/bind' }); return; }
      const addresses = user.addresses && user.addresses.length ? user.addresses : [{ id: '', communityId: user.communityId,
        buildingId: user.buildingId, buildingName: user.buildingName, unit: user.unit, room: user.room, isDefault: true }];
      addresses.forEach(address => { address.pickerLabel = this.addressLabel(address); });
      const addressIndex = Math.max(0, addresses.findIndex(item => item.isDefault));
      this.setData({ addresses, addressIndex, addressText: this.addressLabel(addresses[addressIndex]) });
      const [plans, mine] = await Promise.all([api.call('membership', 'plans', { addressId: addresses[addressIndex].id || undefined }, { loading: false, silent: true }),
        api.call('membership', 'mine', {}, { loading: false, silent: true })]);
      this.setData({ plans: plans.list.map(plan => ({ ...plan, priceText: yuan(plan.payAmount), originalText: yuan(plan.price) })),
        cards: mine.list.map(card => ({ ...card, startText: display(card.startAt), endText: display(card.endAt),
          statusText: { active: '使用中', expired: '已到期', refunded: '已作废' }[card.status] })) });
    } catch (error) { this.setData({ error: error.message || '月卡加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  addressLabel(address) {
    return [address.buildingName, address.unit, address.room].filter(Boolean).join(' ');
  },
  async addressChange(event) {
    const addressIndex = Number(event.detail.value);
    const address = this.data.addresses[addressIndex];
    if (!address) return;
    this.request = null;
    this.setData({ addressIndex, addressText: this.addressLabel(address), loading: true, error: '' });
    try {
      const plans = await api.call('membership', 'plans', { addressId: address.id || undefined }, { loading: false, silent: true });
      this.setData({ plans: plans.list.map(plan => ({ ...plan, priceText: yuan(plan.payAmount), originalText: yuan(plan.price) })) });
    } catch (error) { this.setData({ error: error.message || '月卡方案加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  slot(event) { this.setData({ slotIndex: Number(event.detail.value) }); },
  entry(event) { this.setData({ entry: ['password', 'key_handover', 'property_keybox'][Number(event.detail.value)], entryPassword: '' }); },
  entryPassword(event) { this.setData({ entryPassword: event.detail.value }); },
  async buy(event) {
    if (this.data.busy) return;
    const planCode = event.currentTarget.dataset.code;
    const slot = planCode === 'vacant_monthly' ? null : ['morning', 'afternoon', 'evening'][this.data.slotIndex];
    const address = this.data.addresses[this.data.addressIndex];
    const addressId = address && address.id || undefined;
    this.setData({ busy: true, error: '' });
    try {
      const fields = { planCode, slot, addressId, entry: this.data.entry, entryPassword: this.data.entryPassword };
      if (!this.request || JSON.stringify(this.request.fields) !== JSON.stringify(fields)) this.request = {
        fields, requestId: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) };
      const requestBody = { planCode, slot, addressId, requestId: this.request.requestId };
      if (planCode === 'vacant_monthly') Object.assign(requestBody, { entry: this.data.entry, entryPassword: this.data.entryPassword });
      const created = await api.call('membership', 'buy', requestBody);
      this.request = null;
      try { await pay(created); } catch (error) { wx.showToast({ title: error.message || '支付未完成，可到订单页重试', icon: 'none' }); }
      await this.load();
      wx.navigateTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(created.orderId) });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  async skip(event) {
    if (this.data.busy) return;
    const answer = await new Promise(resolve => wx.showModal({ title: '今天不用来', content: '仅能跳过尚未接单的今日垃圾月卡任务。确认今天不用上门吗？', success: resolve }));
    if (!answer.confirm) return;
    this.setData({ busy: true });
    try { await api.call('membership', 'skipToday', { membershipId: event.currentTarget.dataset.id }); await this.load(); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  }
});
