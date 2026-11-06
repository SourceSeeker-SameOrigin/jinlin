const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
Page({
  data: { loading: true, busy: false, error: '', communities: [], communityIndex: 0, providers: [], providerIndex: 0,
    payees: ['服务员', '物业'], payeeIndex: 0, from: '', to: '', preview: [], settlements: [] },
  onLoad() {
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    this.setData({ from: today.slice(0, 8) + '01', to: today }); this.load();
  },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可以管理结算');
      const [communities, providers, settlements] = await Promise.all([
        api.call('catalog', 'listCommunities', {}, { loading: false, silent: true }),
        api.call('admin', 'listProviders', { status: 'approved' }, { loading: false, silent: true }),
        api.call('admin', 'listSettlements', {}, { loading: false, silent: true })
      ]);
      this.setData({ communities: communities.list, providers: providers.list,
        settlements: settlements.list.map(item => ({ ...item, totalText: yuan(item.total) })) });
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  select(event) { this.setData({ [event.currentTarget.dataset.field]: Number(event.detail.value) }); },
  request() {
    const payee = this.data.payeeIndex ? 'property' : 'provider';
    const community = this.data.communities[this.data.communityIndex];
    const provider = this.data.providers[this.data.providerIndex];
    if (!community || payee === 'provider' && !provider) throw new Error('请先配置小区和服务员');
    return { payee, communityId: community._id, ...(payee === 'provider' ? { providerId: provider._id } : {}),
      from: this.data.from, to: this.data.to };
  },
  async preview() {
    try {
      this.setData({ busy: true, error: '' });
      const result = await api.call('admin', 'settlementPreview', this.request());
      this.setData({ preview: result.rows.map(item => ({ ...item, totalText: yuan(item.total) })) });
    } catch (error) { this.setData({ error: error.message || '预览失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async create() {
    if (this.data.busy) return;
    try {
      this.setData({ busy: true, error: '' });
      const result = await api.call('admin', 'settlementCreate', this.request());
      wx.showToast({ title: '结算单已生成', icon: 'success' });
      this.setData({ preview: [] }); await this.load();
    } catch (error) { this.setData({ error: error.message || '生成失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async markPaid(event) {
    try {
      await api.call('admin', 'settlementMarkPaid', { settlementId: event.currentTarget.dataset.id });
      await this.load();
    } catch (error) { this.setData({ error: error.message }); }
  },
  async exportCsv() {
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
