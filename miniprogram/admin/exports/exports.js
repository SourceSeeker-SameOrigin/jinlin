const api = require('../../utils/api');
const TYPES = [{ key: 'settlement', name: '人工结算账目' }, { key: 'subsidy', name: '政府养老补贴业务明细' },
  { key: 'recycle', name: '回收企业月度对账' }, { key: 'station', name: '驿站月度对账' }];
const PAYEES = ['服务员', '物业', '商家', '个人卖家'];
Page({
  data: { loading: true, ready: false, communityLoading: false, busy: false, error: '', errorKind: '', types: TYPES, typeIndex: 0, payees: PAYEES, payeeIndex: 0,
    communities: [], communityIndex: 0, community: null, providers: [], providerIndex: 0, merchants: [], merchantIndex: 0,
    stationIndex: 0, sellerOpenid: '', from: '', to: '' },
  onLoad(options = {}) {
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    this.setData({ from: today.slice(0, 8) + '01', to: today,
      typeIndex: Math.max(0, TYPES.findIndex(item => item.key === options.type)) });
  },
  onShow() { this.load(); },
  onUnload() { this._closed = true; this._communityVersion = (this._communityVersion || 0) + 1; },
  async loadAll(name, action, params = {}) {
    const list = [];
    let page;
    do {
      page = await api.call(name, action, { ...params, offset: list.length }, { loading: false, silent: true });
      if (!page.list.length && page.hasMore) throw new Error('列表分页异常，请稍后重试');
      list.push(...page.list);
    } while (page.hasMore);
    return list;
  },
  async load() {
    if (this._closed || this._loading || this.data.busy || this.data.communityLoading) return;
    this._loading = true;
    this.setData({ loading: true, ready: false, error: '', errorKind: '' });
    try {
      const user = await getApp().ensureSession();
      if (this._closed) return;
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可以使用数据导出');
      const selectedCommunity = this.data.communities[this.data.communityIndex]?._id || user.communityId;
      const selectedProvider = this.data.providers[this.data.providerIndex]?._id;
      const selectedMerchant = this.data.merchants[this.data.merchantIndex]?._id;
      const [communities, providers, merchants] = await Promise.all([
        this.loadAll('catalog', 'listCommunities'),
        this.loadAll('admin', 'listProviders', { status: 'approved' }),
        this.loadAll('merchant', 'adminList', { status: 'approved' })
      ]);
      if (this._closed) return;
      this.setData({ communities, providers, merchants,
        communityIndex: Math.max(0, communities.findIndex(item => item._id === selectedCommunity)),
        providerIndex: Math.max(0, providers.findIndex(item => item._id === selectedProvider)),
        merchantIndex: Math.max(0, merchants.findIndex(item => item._id === selectedMerchant)) });
      await this.loadCommunity();
    } catch (error) { if (!this._closed) this.setData({ error: error.message || '数据导出页面加载失败', errorKind: 'load' }); }
    finally { this._loading = false; if (!this._closed) this.setData({ loading: false }); }
  },
  async loadCommunity() {
    if (this._closed) return;
    const version = this._communityVersion = (this._communityVersion || 0) + 1;
    const community = this.data.communities[this.data.communityIndex];
    const selectedStation = this.data.community?._id === community?._id
      ? this.data.community?.stations?.[this.data.stationIndex]?.code : null;
    this.setData({ ready: false, communityLoading: true, error: '', errorKind: '' });
    try {
      const detail = community ? await api.call('catalog', 'getCommunity', { communityId: community._id }, { loading: false, silent: true }) : null;
      if (this._closed || version !== this._communityVersion) return;
      this.setData({ community: detail, stationIndex: Math.max(0, (detail?.stations || []).findIndex(item => item.code === selectedStation)), ready: true });
    } catch (error) {
      if (!this._closed && version === this._communityVersion) this.setData({ error: error.message || '小区资料加载失败，请重试', errorKind: 'load' });
    } finally { if (!this._closed && version === this._communityVersion) this.setData({ communityLoading: false }); }
  },
  input(event) {
    if (this._closed || !this.data.ready || this.data.loading || this.data.busy) return;
    this.changeCondition(event.currentTarget.dataset.field, event.detail.value);
  },
  select(event) {
    if (this._closed || !this.data.ready || this.data.loading || this.data.busy) return;
    const field = event.currentTarget.dataset.field;
    const changed = this.changeCondition(field, ['from', 'to'].includes(field) ? event.detail.value : Number(event.detail.value));
    if (changed && field === 'communityIndex') return this.loadCommunity();
  },
  changeCondition(field, value) {
    if (this.data[field] === value) return false;
    const patch = { [field]: value };
    if (['validation', 'export'].includes(this.data.errorKind)) Object.assign(patch, { error: '', errorKind: '' });
    this.setData(patch);
    return true;
  },
  async download(action, params) {
    const result = await api.call(action[0], action[1], params);
    if (this._closed) return;
    const file = await new Promise((resolve, reject) => wx.downloadFile({ url: result.tempFileURL,
      success: response => response.statusCode === 200 ? resolve(response.tempFilePath) : reject(new Error('CSV 下载失败')), fail: reject }));
    if (this._closed) return;
    wx.openDocument({ filePath: file, fileType: 'csv', showMenu: true,
      fail: () => { if (!this._closed) wx.showToast({ title: '文件已下载，可用其他应用打开', icon: 'none' }); } });
  },
  requestSettlement() {
    const payee = ['provider', 'property', 'merchant', 'seller'][this.data.payeeIndex];
    const community = this.data.communities[this.data.communityIndex];
    const provider = this.data.providers[this.data.providerIndex], merchant = this.data.merchants[this.data.merchantIndex];
    if (!community) throw new Error('请选择小区');
    if (payee === 'provider' && !provider) throw new Error('暂无已审核服务员，暂不能导出该类账目');
    if (payee === 'merchant' && !merchant) throw new Error('暂无已审核商家，暂不能导出该类账目');
    return { payee, communityId: community._id, ...(payee === 'provider' ? { providerId: provider._id } : {}),
      ...(payee === 'merchant' ? { merchantId: merchant._id } : {}),
      ...(payee === 'seller' && this.data.sellerOpenid.trim() ? { sellerOpenid: this.data.sellerOpenid.trim() } : {}),
      from: this.data.from, to: this.data.to };
  },
  async exportData() {
    if (this._closed || this.data.busy || this.data.loading || !this.data.ready) return;
    this.setData({ busy: true, error: '', errorKind: '' });
    let errorKind = 'validation';
    try {
      const kind = TYPES[this.data.typeIndex].key;
      const community = this.data.communities[this.data.communityIndex];
      if (!this.data.from || !this.data.to || this.data.from > this.data.to) throw new Error('请选择有效的导出日期范围');
      let action, params;
      if (kind === 'settlement') { action = ['admin', 'exportCsv']; params = this.requestSettlement(); }
      else if (kind === 'subsidy') { action = ['admin', 'exportSubsidyOrders']; params = { from: this.data.from, to: this.data.to }; }
      else {
        if (!community) throw new Error('请选择小区');
        if (kind === 'recycle') { action = ['admin', 'exportRecyclerStatement']; params = { communityId: community._id, from: this.data.from, to: this.data.to }; }
        else {
          const detail = this.data.community;
          if (!detail || detail._id !== community._id) throw new Error('小区资料尚未加载完成，请稍后重试');
          const station = detail.stations && detail.stations[this.data.stationIndex];
          if (!station) throw new Error('所选小区没有配置驿站');
          action = ['station', 'exportStatement']; params = { communityId: community._id, stationCode: station.code,
            from: this.data.from, to: this.data.to };
        }
      }
      errorKind = 'export';
      await this.download(action, params);
    } catch (error) { if (!this._closed) this.setData({ error: error.message || '导出失败', errorKind }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  }
});
