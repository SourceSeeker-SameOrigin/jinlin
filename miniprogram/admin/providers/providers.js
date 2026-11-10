const api = require('../../utils/api');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, busy: false, error: '', rows: [], hasMore: true, statusIndex: 0,
    statuses: ['待审核', '已通过', '已拒绝', '已停用', '全部'] },
  onShow() { this.load(true); },
  onUnload() { this._closed = true; this.sequence = (this.sequence || 0) + 1; },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  retry() { return this.load(this._failedReset !== false); },
  filter(event) { if (this._closed || this.data.busy) return; this.setData({ statusIndex: Number(event.detail.value) }); this.load(true); },
  async load(reset = false) {
    if (this._closed || (!reset && (this.data.loading || this.data.busy || !this.data.hasMore))) return;
    const sequence = this.sequence = (this.sequence || 0) + 1;
    const offset = reset ? 0 : this.data.rows.length;
    this._failedReset = reset;
    this.setData({ loading: true, error: '', ...(reset ? { rows: [], hasMore: true } : {}) });
    try {
      await getApp().ensureSession();
      if (this._closed || sequence !== this.sequence) return;
      const result = await api.call('admin', 'listProviders', { status: ['pending', 'approved', 'rejected', 'suspended', ''][this.data.statusIndex],
        offset }, { loading: false, silent: true });
      if (this._closed || sequence !== this.sequence) return;
      const rows = result.list.map(row => { const certs = row.certs || []; return { ...row, certs,
        escortCert: certs.includes('escort'), petCert: certs.includes('pet'),
        insuranceText: display(row.insuranceUntil).slice(0, 10), note: '' }; });
      this.setData({ rows: reset ? rows : [...this.data.rows, ...rows], hasMore: result.hasMore });
    } catch (error) { if (!this._closed && sequence === this.sequence) this.setData({ error: error.message || '审核列表加载失败' }); }
    finally { if (!this._closed && sequence === this.sequence) this.setData({ loading: false }); }
  },
  note(event) { if (this._closed || this.data.loading || this.data.busy || !this.data.rows[event.currentTarget.dataset.index]) return; this.setData({ ['rows[' + event.currentTarget.dataset.index + '].note']: event.detail.value }); },
  async review(event) {
    if (this._closed || this.data.loading || this.data.busy) return;
    const row = this.data.rows[event.currentTarget.dataset.index];
    if (!row) return;
    const level = Number(event.currentTarget.dataset.level);
    await this.perform('reviewProvider', { providerId: row._id, approved: level > 0, level, note: row.note, certs: row.certs });
  },
  async suspend(event) {
    if (this._closed || this.data.loading || this.data.busy) return;
    const sequence = this.sequence;
    const answer = await new Promise(resolve => wx.showModal({ title: '停用服务员', content: '停用后不能上线或接单，已有任务请到订单管理处理。', success: resolve }));
    if (answer.confirm && !this._closed && sequence === this.sequence) await this.perform('suspendProvider', { providerId: event.currentTarget.dataset.id });
  },
  insurance(event) { this.perform('setInsurance', { providerId: event.currentTarget.dataset.id, until: event.detail.value }); },
  certs(event) {
    if (this._closed || this.data.loading || this.data.busy) return;
    const index = event.currentTarget.dataset.index;
    const row = this.data.rows[index];
    if (!row) return;
    const certs = event.detail.value;
    this.setData({ ['rows[' + index + '].certs']: certs, ['rows[' + index + '].escortCert']: certs.includes('escort'),
      ['rows[' + index + '].petCert']: certs.includes('pet') });
    if (row.status === 'approved') this.perform('setCerts', { providerId: row._id, certs });
  },
  cleanup(event) { this.perform('cleanupProviderKyc', { providerId: event.currentTarget.dataset.id }); },
  async perform(action, data) {
    if (this._closed || this.data.busy || this.data.loading) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('admin', action, data); await this.load(true); }
    catch (error) { if (!this._closed) this.setData({ error: error.message }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  },
  preview(event) { require('../../utils/media-links').preview({ current: event.currentTarget.dataset.url, urls: [event.currentTarget.dataset.url] }); }
});
