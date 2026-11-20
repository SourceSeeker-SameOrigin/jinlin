const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { yuan } = require('../../utils/money');
const { lifecycle, readList } = require('../../utils/visible-list');

Page({
  ...lifecycle,
  data: { loading: false, error: '', needsBinding: true, list: [], scope: 'community', federationEnabled: false, hasMore: false },
  load(reset = true) {
    const append = reset === false;
    const { scope, list } = this.data;
    return readList(this, append ? {} : { list: [], hasMore: false, federationEnabled: false }, '闲置列表加载失败', async (user, options) => {
      const { communityId, buildingId } = user;
      if (!communityId || !buildingId) {
        return { needsBinding: true, list: [], hasMore: false, federationEnabled: false, scope: 'community' };
      }
      this.setData({ needsBinding: false });
      if (append && communityId !== this.listCommunityId) {
        this.setData({ list: [], hasMore: false, federationEnabled: false });
      }
      const community = await api.call('catalog', 'getCommunity', { communityId }, options);
      if (!options.isActive()) return;
      if (!community.enabledFeatures.idle) throw new Error('闲置交易暂未开放');
      const federationEnabled = !!community.enabledFeatures.federation;
      const selectedScope = federationEnabled ? scope : 'community';
      const sameList = append && this.listCommunityId === communityId && scope === selectedScope;
      if (!sameList) this.setData({ list: [], hasMore: false, scope: selectedScope });
      const previous = sameList ? list : [];
      const result = await api.call('idle', 'list', { scope: selectedScope, offset: previous.length }, options);
      if (!options.isActive()) return;
      this.listCommunityId = communityId;
      const rows = result.list.map(item => ({ ...item, timeText: display(item.createdAt), priceText: yuan(item.price) }));
      return { federationEnabled, list: previous.concat(rows), hasMore: result.hasMore };
    });
  },
  scope(event) { this.setData({ scope: event.currentTarget.dataset.scope }); this.load(true); },
  open(event) { wx.navigateTo({ url: '/idle/detail/detail?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  bindAddress() { wx.navigateTo({ url: '/pages/bind/bind' }); },
  create() { if (this.data.needsBinding) return this.bindAddress(); wx.navigateTo({ url: '/idle/create/create' }); },
  mine() { if (this.data.needsBinding) return this.bindAddress(); wx.navigateTo({ url: '/idle/mine/mine' }); },
  more() { if (!this.data.loading && this.data.hasMore) return this.load(false); }
});
