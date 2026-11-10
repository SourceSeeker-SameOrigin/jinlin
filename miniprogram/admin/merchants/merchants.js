const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
function appendUnique(previous, incoming) {
  return [...new Map([...previous, ...incoming].map(item => [item._id, item])).values()];
}
Page({
  data: { loading: true, busy: false, error: '', list: [], hasMore: false, offset: 0,
    selected: null, services: [], servicesLoading: false, servicesError: '', servicesHasMore: false, servicesOffset: 0, statusIndex: 0,
    statuses: ['pending', 'approved', 'rejected', 'suspended', ''],
    statusLabels: ['待审核', '已通过', '已拒绝', '已停用', '全部'],
    statusNames: { pending: '待审核', approved: '已通过', rejected: '已拒绝', suspended: '已停用' } },
  onShow() { this.load(); },
  onUnload() { this._closed = true; this.loadSequence = (this.loadSequence || 0) + 1; this.inspectSequence = (this.inspectSequence || 0) + 1; },
  onReachBottom() { return this.loadMore(); },
  loadMore() { return this.load(false); },
  retry() { return this.load(this._failedReset !== false); },
  async load(reset = true) {
    if (this._closed || (!reset && (this.data.loading || !this.data.hasMore || this.data.busy))) return;
    const sequence = this.loadSequence = (this.loadSequence || 0) + 1;
    const offset = reset ? 0 : this.data.offset;
    this._failedReset = reset;
    if (reset) this.inspectSequence = (this.inspectSequence || 0) + 1;
    this.setData({ loading: true, error: '', ...(reset ? { list: [], offset: 0, hasMore: false,
      selected: null, services: [], servicesLoading: false, servicesError: '', servicesHasMore: false, servicesOffset: 0 } : {}) });
    try {
      await getApp().ensureSession();
      if (this._closed || sequence !== this.loadSequence) return;
      const result = await api.call('merchant', 'adminList', { status: this.data.statuses[this.data.statusIndex], offset }, { loading: false, silent: true });
      if (this._closed || sequence !== this.loadSequence) return;
      if (!result.list.length && result.hasMore) throw new Error('商家列表分页异常，请重试');
      this.setData({ list: appendUnique(reset ? [] : this.data.list, result.list), offset: offset + result.list.length, hasMore: result.hasMore });
    } catch (error) { if (!this._closed && sequence === this.loadSequence) this.setData({ error: error.message || '商家申请加载失败' }); }
    finally { if (!this._closed && sequence === this.loadSequence) this.setData({ loading: false }); }
  },
  async filter(event) {
    if (this._closed || this.data.busy) return;
    const statusIndex = Number(event.detail.value);
    if (!Number.isInteger(statusIndex) || statusIndex < 0 || statusIndex >= this.data.statuses.length) return;
    this.setData({ statusIndex }); await this.load();
  },
  async inspect(event) {
    if (this._closed || this.data.loading || this.data.busy) return;
    const merchant = this.data.list.find(item => item._id === event.currentTarget.dataset.id);
    if (!merchant) return;
    this.setData({ selected: merchant });
    return this.loadServices(true);
  },
  loadMoreServices() { return this.loadServices(false); },
  retryServices() { return this.loadServices(this._servicesFailedReset !== false); },
  async loadServices(reset = true) {
    const merchant = this.data.selected;
    if (this._closed || !merchant || (!reset && (this.data.servicesLoading || !this.data.servicesHasMore || this.data.busy))) return;
    const sequence = this.inspectSequence = (this.inspectSequence || 0) + 1;
    const offset = reset ? 0 : this.data.servicesOffset;
    this._servicesFailedReset = reset;
    this.setData({ servicesLoading: true, servicesError: '', ...(reset ? { services: [], servicesOffset: 0, servicesHasMore: false } : {}) });
    try {
      const result = await api.call('merchant', 'adminServices', { merchantId: merchant._id, offset }, { loading: false, silent: true });
      if (this._closed || sequence !== this.inspectSequence || this.data.selected?._id !== merchant._id) return;
      if (!result.list.length && result.hasMore) throw new Error('服务列表分页异常，请重试');
      const services = result.list.map(item => ({ ...item, priceText: yuan(item.price) }));
      this.setData({ services: appendUnique(reset ? [] : this.data.services, services), servicesOffset: offset + result.list.length,
        servicesHasMore: result.hasMore });
    } catch (error) { if (!this._closed && sequence === this.inspectSequence) this.setData({ servicesError: error.message || '服务加载失败' }); }
    finally { if (!this._closed && sequence === this.inspectSequence) this.setData({ servicesLoading: false }); }
  },
  async review(event) {
    const approved = event.currentTarget.dataset.approved === 'true', merchant = this.data.selected;
    if (this._closed || !merchant || merchant.status !== 'pending' || this.data.busy || this.data.loading || this.data.servicesLoading) return;
    this.setData({ busy: true, error: '' });
    try {
      const note = await new Promise(resolve => wx.showModal({ title: approved ? '通过商家入驻' : '拒绝商家入驻', editable: true, placeholderText: '审核说明（选填）', success: result => resolve(result.confirm ? result.content || '' : null) }));
      if (note === null || this._closed) return;
      await api.call('merchant', 'review', { merchantId: merchant._id, approved, note });
      await this.load();
    } catch (error) { if (!this._closed) this.setData({ error: error.message || '审核失败' }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  },
  async serviceStatus(event) {
    if (this._closed || !this.data.selected || this.data.selected.status !== 'approved' || this.data.busy || this.data.loading || this.data.servicesLoading) return;
    const serviceId = event.currentTarget.dataset.id;
    if (!this.data.services.some(item => item._id === serviceId)) return;
    this.setData({ busy: true, servicesError: '' });
    try {
      await api.call('merchant', 'setServiceStatus', { serviceId, status: event.currentTarget.dataset.status });
      await this.loadServices(true);
    } catch (error) { if (!this._closed) { this._servicesFailedReset = true; this.setData({ servicesError: error.message || '服务状态更新失败' }); } }
    finally { if (!this._closed) this.setData({ busy: false }); }
  }
});
