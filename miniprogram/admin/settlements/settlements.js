const api = require('../../utils/api');
const listAll = require('../../utils/list-all');
const { yuan } = require('../../utils/money');
function merchantName(merchants, id) { const item = (merchants || []).find(merchant => merchant._id === id); return item ? item.name : ''; }
Page({
  data: { loading: true, ready: false, authorized: false, isAdmin: false, busy: false, error: '', communities: [], communityIndex: 0, providers: [], providerIndex: 0, merchants: [], merchantIndex: 0, sellerOpenid: '',
    payees: ['服务员', '物业', '商家', '个人卖家'], payeeIndex: 0, from: '', to: '', preview: [], previewRange: null, settlements: [],
    historyLoading: false, historyError: '', historyHasMore: false, historyOffset: 0 },
  onUnload() { this._closed = true; this._historyVersion = (this._historyVersion || 0) + 1; this._previewVersion = (this._previewVersion || 0) + 1; },
  onLoad() {
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    this.setData({ from: today.slice(0, 8) + '01', to: today }); this.load();
  },
  async load() {
    if (this._loading || this._closed) return;
    this._loading = true;
    this._historyVersion = (this._historyVersion || 0) + 1;
    this._previewVersion = (this._previewVersion || 0) + 1;
    this.setData({ loading: true, ready: false, error: '', authorized: false, isAdmin: false, preview: [], previewRange: null, settlements: [],
      historyLoading: false, historyError: '', historyHasMore: false, historyOffset: 0 });
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
        if (this._closed) return;
        this.setData({ ready: true, communities: [community], communityIndex: 0, payeeIndex: 1, providers: [], merchants: [],
          historyHasMore: settlements.hasMore === true, historyOffset: settlements.list.length,
          settlements: settlements.list.map(item => ({ ...item, totalText: yuan(item.total) })) });
        return;
      }
      const [communities, providers, settlements, merchants] = await Promise.all([
        listAll('catalog', 'listCommunities'),
        listAll('admin', 'listProviders', { status: 'approved' }),
        api.call('admin', 'listSettlements', {}, { loading: false, silent: true }), listAll('merchant', 'adminList', { status: 'approved' })
      ]);
      if (this._closed) return;
      this.setData({ ready: true, communities, providers,
        historyHasMore: settlements.hasMore === true, historyOffset: settlements.list.length,
        merchants, settlements: settlements.list.map(item => ({ ...item, totalText: yuan(item.total), merchantName: merchantName(merchants, item.merchantId) })) });
    } catch (error) { if (!this._closed) this.setData({ error: error.message || '加载失败' }); }
    finally { this._loading = false; if (!this._closed) this.setData({ loading: false }); }
  },
  async loadMoreHistory() {
    if (this._closed || !this.data.ready || this.data.loading || this.data.historyLoading || this.data.busy || !this.data.historyHasMore) return;
    const version = this._historyVersion;
    const offset = this.data.historyOffset;
    this.setData({ historyLoading: true, historyError: '' });
    try {
      const result = await api.call('admin', 'listSettlements', { offset }, { loading: false, silent: true });
      if (this._closed || version !== this._historyVersion) return;
      if (!Array.isArray(result.list) || (result.hasMore && !result.list.length)) throw new Error('结算记录分页异常，请重试');
      const seen = new Set(this.data.settlements.map(item => item._id));
      const additions = [];
      for (const item of result.list) {
        if (!item || !item._id) throw new Error('结算记录编号缺失，请重试');
        if (seen.has(item._id)) continue;
        seen.add(item._id);
        additions.push({ ...item, totalText: yuan(item.total), merchantName: merchantName(this.data.merchants, item.merchantId) });
      }
      this.setData({ settlements: this.data.settlements.concat(additions), historyOffset: offset + result.list.length,
        historyHasMore: result.hasMore === true });
    } catch (error) {
      if (!this._closed && version === this._historyVersion) this.setData({ historyError: error.message || '结算记录加载失败，请重试' });
    } finally {
      if (!this._closed && version === this._historyVersion) this.setData({ historyLoading: false });
    }
  },
  changePreviewField(field, value) {
    if (this._closed || !this.data.ready || this.data[field] === value) return;
    this._previewVersion = (this._previewVersion || 0) + 1;
    this.setData({ [field]: value, preview: [], previewRange: null });
  },
  input(event) {
    const field = event.currentTarget.dataset.field;
    if (['from', 'to', 'sellerOpenid'].includes(field)) this.changePreviewField(field, event.detail.value);
  },
  select(event) {
    const field = event.currentTarget.dataset.field;
    if (!this.data.busy && ['communityIndex', 'payeeIndex', 'providerIndex', 'merchantIndex'].includes(field)) {
      this.changePreviewField(field, Number(event.detail.value));
    }
  },
  request() {
    if (!this.data.authorized || !this.data.ready) throw new Error('请先完整加载结算选项与权限');
    const payee = !this.data.isAdmin ? 'property' : ['provider', 'property', 'merchant', 'seller'][this.data.payeeIndex];
    const community = this.data.communities[this.data.communityIndex];
    const provider = this.data.providers[this.data.providerIndex]; const merchant = this.data.merchants[this.data.merchantIndex];
    if (!community || payee === 'provider' && !provider || payee === 'merchant' && !merchant) throw new Error('请先选择小区及收款对象');
    return { payee, communityId: community._id, ...(payee === 'provider' ? { providerId: provider._id } : {}), ...(payee === 'merchant' ? { merchantId: merchant._id } : {}), ...(payee === 'seller' && this.data.sellerOpenid ? { sellerOpenid: this.data.sellerOpenid.trim() } : {}),
      from: this.data.from, to: this.data.to };
  },
  async preview() {
    if (this._closed || !this.data.ready || this.data.busy) return;
    const version = this._previewVersion = (this._previewVersion || 0) + 1;
    try {
      this.setData({ busy: true, error: '', preview: [], previewRange: null });
      const request = this.request();
      const previewRange = { from: request.from, to: request.to, communityName: this.data.communities[this.data.communityIndex].name };
      const result = await api.call('admin', 'settlementPreview', request);
      if (this._closed || version !== this._previewVersion) return;
      this.setData({ previewRange, preview: result.rows.map(item => ({ ...item, totalText: yuan(item.total), merchantName: merchantName(this.data.merchants, item.merchantId) })) });
    } catch (error) { if (!this._closed && version === this._previewVersion) this.setData({ error: error.message || '预览失败' }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  },
  async create() {
    if (this.data.busy || !this.data.ready || !this.data.isAdmin) return;
    try {
      this.setData({ busy: true, error: '' });
      const result = await api.call('admin', 'settlementCreate', this.request());
      wx.showToast({ title: '结算单已生成', icon: 'success' });
      this.setData({ preview: [] }); await this.load();
    } catch (error) { this.setData({ error: error.message || '生成失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async markPaid(event) {
    if (!this.data.isAdmin || !this.data.ready || this.data.busy) return;
    try {
      await api.call('admin', 'settlementMarkPaid', { settlementId: event.currentTarget.dataset.id });
      await this.load();
    } catch (error) { this.setData({ error: error.message }); }
  },
  async exportCsv() {
    if (!this.data.isAdmin || !this.data.ready || this.data.busy) return;
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
