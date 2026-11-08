const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
function merchantName(merchants, id) { const item = (merchants || []).find(merchant => merchant._id === id); return item ? item.name : ''; }
Page({
  data: { loading: true, authorized: false, isAdmin: false, busy: false, error: '', communities: [], communityIndex: 0, providers: [], providerIndex: 0, merchants: [], merchantIndex: 0, sellerOpenid: '',
    payees: ['服务员', '物业', '商家', '个人卖家'], payeeIndex: 0, from: '', to: '', preview: [], settlements: [] },
  onLoad() {
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    this.setData({ from: today.slice(0, 8) + '01', to: today }); this.load();
  },
  async load() {
    this.setData({ loading: true, error: '', authorized: false, isAdmin: false, preview: [], settlements: [] });
    try {
      const user = await getApp().ensureSession();
      const isAdmin = user.roles.includes('admin');
      if (!isAdmin && !user.roles.includes('property')) throw new Error('无权查看结算');
      this.setData({ authorized: true, isAdmin });
      if (!isAdmin) {
        if (!user.communityId) throw new Error('尚未分配物业服务小区');
        const [community, settlements] = await Promise.all([
          api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true }),
          api.call('admin', 'listSettlements', {}, { loading: false, silent: true })
        ]);
        this.setData({ communities: [community], communityIndex: 0, payeeIndex: 1, providers: [], merchants: [],
          settlements: settlements.list.map(item => ({ ...item, totalText: yuan(item.total) })) });
        return;
      }
      const [communities, providers, settlements, merchants] = await Promise.all([
        api.call('catalog', 'listCommunities', {}, { loading: false, silent: true }),
        api.call('admin', 'listProviders', { status: 'approved' }, { loading: false, silent: true }),
        api.call('admin', 'listSettlements', {}, { loading: false, silent: true }), api.call('merchant', 'adminList', { status: 'approved' }, { loading: false, silent: true })
      ]);
      this.setData({ communities: communities.list, providers: providers.list,
        merchants: merchants.list, settlements: settlements.list.map(item => ({ ...item, totalText: yuan(item.total), merchantName: merchantName(merchants.list, item.merchantId) })) });
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  select(event) { this.setData({ [event.currentTarget.dataset.field]: Number(event.detail.value) }); },
  request() {
    if (!this.data.authorized) throw new Error('请先加载结算权限');
    const payee = !this.data.isAdmin ? 'property' : ['provider', 'property', 'merchant', 'seller'][this.data.payeeIndex];
    const community = this.data.communities[this.data.communityIndex];
    const provider = this.data.providers[this.data.providerIndex]; const merchant = this.data.merchants[this.data.merchantIndex];
    if (!community || payee === 'provider' && !provider || payee === 'merchant' && !merchant) throw new Error('请先选择小区及收款对象');
    return { payee, communityId: community._id, ...(payee === 'provider' ? { providerId: provider._id } : {}), ...(payee === 'merchant' ? { merchantId: merchant._id } : {}), ...(payee === 'seller' && this.data.sellerOpenid ? { sellerOpenid: this.data.sellerOpenid.trim() } : {}),
      from: this.data.from, to: this.data.to };
  },
  async preview() {
    try {
      this.setData({ busy: true, error: '' });
      const result = await api.call('admin', 'settlementPreview', this.request());
      this.setData({ preview: result.rows.map(item => ({ ...item, totalText: yuan(item.total), merchantName: merchantName(this.data.merchants, item.merchantId) })) });
    } catch (error) { this.setData({ error: error.message || '预览失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async create() {
    if (this.data.busy || !this.data.isAdmin) return;
    try {
      this.setData({ busy: true, error: '' });
      const result = await api.call('admin', 'settlementCreate', this.request());
      wx.showToast({ title: '结算单已生成', icon: 'success' });
      this.setData({ preview: [] }); await this.load();
    } catch (error) { this.setData({ error: error.message || '生成失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async markPaid(event) {
    if (!this.data.isAdmin || this.data.busy) return;
    try {
      await api.call('admin', 'settlementMarkPaid', { settlementId: event.currentTarget.dataset.id });
      await this.load();
    } catch (error) { this.setData({ error: error.message }); }
  },
  async exportCsv() {
    if (!this.data.isAdmin) return;
    try {
      const result = await api.call('admin', 'exportCsv', this.request());
      const filePath = await new Promise((resolve, reject) => wx.downloadFile({ url: result.tempFileURL,
        success: response => response.statusCode === 200 ? resolve(response.tempFilePath) : reject(new Error('CSV 下载失败')),
        fail: reject }));
      wx.openDocument({ filePath, fileType: 'csv', showMenu: true,
        fail: () => this.setData({ error: 'CSV 已下载，请使用“用其他应用打开”查看' }) });
    } catch (error) { this.setData({ error: error.message || '导出失败' }); }
  }
});
