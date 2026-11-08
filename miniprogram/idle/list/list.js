const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { yuan } = require('../../utils/money');
Page({
  data: { loading: false, error: '', needsBinding: true, list: [], scope: 'community', federationEnabled: false, hasMore: false },
  onShow() { return this.load(true); },
  async load(reset = false) {
    this.setData({ loading: true, error: '', ...(reset ? { list: [] } : {}) });
    try {
      const user = await getApp().ensureSession();
      const needsBinding = !user.communityId || !user.buildingId;
      this.setData({ needsBinding });
      if (needsBinding) {
        this.setData({ list: [], hasMore: false, federationEnabled: false, scope: 'community' });
        return;
      }
      const community = await api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true });
      if (!community.enabledFeatures.idle) throw new Error('闲置交易暂未开放');
      const result = await api.call('idle', 'list', { scope: this.data.scope, offset: reset ? 0 : this.data.list.length }, { loading: false, silent: true });
      const rows = result.list.map(item => ({ ...item, timeText: display(item.createdAt), priceText: yuan(item.price) }));
      this.setData({ federationEnabled: community.enabledFeatures.federation,
        list: reset ? rows : [...this.data.list, ...rows], hasMore: result.hasMore });
    } catch (error) { this.setData({ error: error.message || '闲置列表加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  scope(event) { this.setData({ scope: event.currentTarget.dataset.scope }); this.load(true); },
  open(event) { wx.navigateTo({ url: '/idle/detail/detail?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  bindAddress() { wx.navigateTo({ url: '/pages/bind/bind' }); },
  create() { if (this.data.needsBinding) return this.bindAddress(); wx.navigateTo({ url: '/idle/create/create' }); },
  mine() { if (this.data.needsBinding) return this.bindAddress(); wx.navigateTo({ url: '/idle/mine/mine' }); },
  more() { if (!this.data.loading && this.data.hasMore) this.load(); }
});
