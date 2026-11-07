const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const TYPES = [{ key: 'settlement', name: '人工结算账目' }, { key: 'subsidy', name: '政府养老补贴业务明细' },
  { key: 'recycle', name: '回收企业月度对账' }, { key: 'station', name: '驿站月度对账' }];
const PAYEES = ['服务员', '物业', '商家', '个人卖家'];
Page({
  data: { loading: true, busy: false, error: '', types: TYPES, typeIndex: 0, payees: PAYEES, payeeIndex: 0,
    communities: [], communityIndex: 0, community: null, providers: [], providerIndex: 0, merchants: [], merchantIndex: 0,
    stationIndex: 0, sellerOpenid: '', from: '', to: '' },
  onLoad(options) {
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    this.setData({ from: today.slice(0, 8) + '01', to: today,
      typeIndex: Math.max(0, TYPES.findIndex(item => item.key === options.type)) });
  },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可以使用数据导出');
      const [communities, providers, merchants] = await Promise.all([
        api.call('catalog', 'listCommunities', {}, { loading: false, silent: true }),
        api.call('admin', 'listProviders', { status: 'approved' }, { loading: false, silent: true }),
        api.call('merchant', 'adminList', { status: 'approved' }, { loading: false, silent: true })
      ]);
      this.setData({ communities: communities.list, providers: providers.list, merchants: merchants.list,
        communityIndex: Math.max(0, communities.list.findIndex(item => item._id === user.communityId)) });
      await this.loadCommunity();
    } catch (error) { this.setData({ error: error.message || '数据导出页面加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async loadCommunity() {
    const community = this.data.communities[this.data.communityIndex];
    if (!community) { this.setData({ community: null }); return; }
    const detail = await api.call('catalog', 'getCommunity', { communityId: community._id }, { loading: false, silent: true });
    this.setData({ community: detail, stationIndex: 0 });
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  select(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: ['from', 'to'].includes(field) ? event.detail.value : Number(event.detail.value) });
    if (field === 'communityIndex') this.loadCommunity().catch(error => this.setData({ error: error.message }));
  },
  async download(action, params) {
    const result = await api.call(action[0], action[1], params);
    const file = await new Promise((resolve, reject) => wx.downloadFile({ url: result.tempFileURL,
      success: response => response.statusCode === 200 ? resolve(response.tempFilePath) : reject(new Error('CSV 下载失败')), fail: reject }));
    wx.openDocument({ filePath: file, fileType: 'csv', showMenu: true,
      fail: () => wx.showToast({ title: '文件已下载，可用其他应用打开', icon: 'none' }) });
  },
  requestSettlement() {
    const payee = ['provider', 'property', 'merchant', 'seller'][this.data.payeeIndex];
    const community = this.data.communities[this.data.communityIndex];
    const provider = this.data.providers[this.data.providerIndex], merchant = this.data.merchants[this.data.merchantIndex];
    if (!community || payee === 'provider' && !provider || payee === 'merchant' && !merchant) throw new Error('请先选择小区和收款对象');
    return { payee, communityId: community._id, ...(payee === 'provider' ? { providerId: provider._id } : {}),
      ...(payee === 'merchant' ? { merchantId: merchant._id } : {}),
      ...(payee === 'seller' && this.data.sellerOpenid.trim() ? { sellerOpenid: this.data.sellerOpenid.trim() } : {}),
      from: this.data.from, to: this.data.to };
  },
  async exportData() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const kind = TYPES[this.data.typeIndex].key;
      const community = this.data.communities[this.data.communityIndex];
      if (!this.data.from || !this.data.to || this.data.from > this.data.to) throw new Error('请选择有效的导出日期范围');
      if (kind === 'settlement') await this.download(['admin', 'exportCsv'], this.requestSettlement());
      else if (kind === 'subsidy') await this.download(['admin', 'exportSubsidyOrders'], { from: this.data.from, to: this.data.to });
      else {
        if (!community) throw new Error('请选择小区');
        if (kind === 'recycle') await this.download(['admin', 'exportRecyclerStatement'], { communityId: community._id, from: this.data.from, to: this.data.to });
        else {
          const station = community.stations && community.stations[this.data.stationIndex];
          if (!station) throw new Error('所选小区没有配置驿站');
          await this.download(['station', 'exportStatement'], { communityId: community._id, stationCode: station.code,
            from: this.data.from, to: this.data.to });
        }
      }
    } catch (error) { this.setData({ error: error.message || '导出失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
