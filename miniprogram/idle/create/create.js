const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { toFen } = require('../../utils/money');
Page({
  data: { ready: false, loadError: false, loading: true, busy: false, error: '', itemId: '', scope: 'community', federationEnabled: false,
    scopeOptions: ['本小区', '联合社区'],
    escrowEnabled: false, tradeModes: ['线下信息交易', '平台担保交易'], tradeModeValues: ['offline', 'escrow'], tradeModeIndex: 0,
    title: '', desc: '', category: '', priceYuan: '', condition: 'used', conditionOptions: ['全新', '几乎全新', '有使用痕迹'],
    conditionValues: ['new', 'like_new', 'used'], conditionIndex: 2, negotiable: true, images: [] },
  onLoad(options) { this.itemId = options.id || ''; this.setData({ itemId: this.itemId }); this.requestId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2); },
  onShow() { this.load(); },
  async load() {
    if (this.loadInFlight) return;
    this.loadInFlight = true;
    this.setData({ loading: true, ready: false, loadError: false, error: '' });
    try {
      const user = await getApp().ensureSession(); this.user = user;
      const community = await api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true });
      if (!community.enabledFeatures.idle) throw new Error('闲置交易暂未开放');
      this.setData({ federationEnabled: community.enabledFeatures.federation, escrowEnabled: community.enabledFeatures.idleEscrow });
      if (this.itemId) {
        const result = await api.call('idle', 'detail', { itemId: this.itemId }, { loading: false, silent: true });
        const item = result.item;
        if (!item.seller) throw new Error('无权编辑此商品');
        const conditionIndex = this.data.conditionValues.indexOf(item.condition);
        if (!this.draftInitialized) this.setData({ title: item.title, desc: item.desc, category: item.category, priceYuan: (item.price / 100).toFixed(2),
          condition: item.condition, conditionIndex, negotiable: item.negotiable, scope: item.scope, images: item.images,
          tradeMode: item.tradeMode, tradeModeIndex: this.data.tradeModeValues.indexOf(item.tradeMode) });
        this.draftInitialized = true;
      }
      this.setData({ ready: true });
    } catch (error) { this.setData({ loadError: true, error: error.message || '页面加载失败' }); }
    finally { this.loadInFlight = false; this.setData({ loading: false }); }
  },
  field(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  switch(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  scope(event) { this.setData({ scope: Number(event.detail.value) === 1 ? 'federation' : 'community' }); },
  tradeMode(event) { const tradeModeIndex = Number(event.detail.value); this.setData({ tradeModeIndex,
    tradeMode: this.data.tradeModeValues[tradeModeIndex] }); },
  condition(event) { const conditionIndex = Number(event.detail.value); this.setData({ conditionIndex, condition: this.data.conditionValues[conditionIndex] }); },
  async photos() {
    if (!this.data.ready || this.data.loading || this.data.busy) return;
    try { this.setData({ images: await uploadPhotos('idle/' + this.user._id, 9) }); }
    catch (error) { this.setData({ error: error.message || '图片上传失败' }); }
  },
  async submit() {
    if (!this.data.ready || this.data.loading || this.data.busy) return;
    const price = toFen(this.data.priceYuan);
    if (!price || price < 1) { this.setData({ error: '请填写有效的价格' }); return; }
    this.setData({ busy: true, error: '' });
    const item = { title: this.data.title, desc: this.data.desc, category: this.data.category || '其他', price,
      condition: this.data.condition, tradeMode: this.data.tradeMode || 'offline', negotiable: this.data.negotiable, images: this.data.images,
      scope: this.data.scope };
    try {
      let result;
      if (this.itemId) result = await api.call('idle', 'update', { itemId: this.itemId, item });
      else result = await api.call('idle', 'create', { requestId: this.requestId, communityId: this.user.communityId, item });
      if (result.imageWarnings && result.imageWarnings.length) wx.showToast({ title: '商品已发布，部分图片未提交审核', icon: 'none' });
      wx.redirectTo({ url: '/idle/detail/detail?id=' + encodeURIComponent(result.itemId || this.itemId) });
    } catch (error) { this.setData({ error: error.message || '发布失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
