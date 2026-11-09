const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
Page({
  data: { loading: true, busy: false, error: '', list: [], selected: null, services: [], statusIndex: 0,
    statuses: ['pending', 'approved', 'rejected', 'suspended', ''],
    statusLabels: ['待审核', '已通过', '已拒绝', '已停用', '全部'],
    statusNames: { pending: '待审核', approved: '已通过', rejected: '已拒绝', suspended: '已停用' } },
  onShow() { this.load(); },
  async load() { const sequence = this.loadSequence = (this.loadSequence || 0) + 1;
    this.inspectSequence = (this.inspectSequence || 0) + 1;
    this.setData({ loading: true, error: '', list: [], selected: null, services: [] }); try {
    await getApp().ensureSession();
    const result = await api.call('merchant', 'adminList', { status: this.data.statuses[this.data.statusIndex] }, { loading: false, silent: true });
    if (sequence !== this.loadSequence) return;
    this.setData({ list: result.list || [] });
  } catch (error) { if (sequence === this.loadSequence) this.setData({ error: error.message || '商家申请加载失败' }); }
    finally { if (sequence === this.loadSequence) this.setData({ loading: false }); } },
  async filter(event) {
    if (this.data.busy) return;
    const statusIndex = Number(event.detail.value);
    if (!Number.isInteger(statusIndex) || statusIndex < 0 || statusIndex >= this.data.statuses.length) return;
    this.setData({ statusIndex }); await this.load();
  },
  async inspect(event) { const merchant = this.data.list.find(item => item._id === event.currentTarget.dataset.id); if (!merchant) return;
    const sequence = this.inspectSequence = (this.inspectSequence || 0) + 1;
    try { const result = await api.call('merchant', 'adminServices', { merchantId: merchant._id }, { loading: false, silent: true });
      if (sequence !== this.inspectSequence) return;
      this.setData({ selected: merchant, services: (result.list || []).map(item => ({ ...item, priceText: yuan(item.price) })) }); }
    catch (error) { if (sequence === this.inspectSequence) this.setData({ error: error.message || '服务加载失败' }); } },
  async review(event) { const approved = event.currentTarget.dataset.approved === 'true'; const merchant = this.data.selected;
    if (!merchant || merchant.status !== 'pending' || this.data.busy) return; this.setData({ busy: true, error: '' }); try {
      const note = await new Promise(resolve => wx.showModal({ title: approved ? '通过商家入驻' : '拒绝商家入驻', editable: true, placeholderText: '审核说明（选填）', success: result => resolve(result.confirm ? result.content || '' : null) }));
      if (note === null) return;
      await api.call('merchant', 'review', { merchantId: merchant._id, approved, note }); this.setData({ selected: null }); await this.load();
    } catch (error) { this.setData({ error: error.message || '审核失败' }); } finally { this.setData({ busy: false }); } },
  async serviceStatus(event) { if (!this.data.selected || this.data.selected.status !== 'approved' || this.data.busy) return;
    const status = event.currentTarget.dataset.status; this.setData({ busy: true, error: '' }); try {
    await api.call('merchant', 'setServiceStatus', { serviceId: event.currentTarget.dataset.id, status }); await this.inspect({ currentTarget: { dataset: { id: this.data.selected._id } } });
  } catch (error) { this.setData({ error: error.message || '服务状态更新失败' }); } finally { this.setData({ busy: false }); } }
});
