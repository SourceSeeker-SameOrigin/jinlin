const api = require('../../utils/api');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, busy: false, error: '', rows: [], hasMore: true, statusIndex: 0,
    statuses: ['待审核', '已通过', '已拒绝', '已停用', '全部'] },
  onShow() { this.load(true); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(); },
  retry() { this.load(true); },
  filter(event) { this.setData({ statusIndex: Number(event.detail.value) }); this.load(true); },
  async load(reset = false) {
    const sequence = (this.sequence || 0) + 1;
    this.sequence = sequence;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('admin', 'listProviders', { status: ['pending', 'approved', 'rejected', 'suspended', ''][this.data.statusIndex],
        offset: reset ? 0 : this.data.rows.length }, { loading: false, silent: true });
      if (sequence !== this.sequence) return;
      const rows = result.list.map(row => ({ ...row, insuranceText: display(row.insuranceUntil).slice(0, 10), note: '' }));
      this.setData({ rows: reset ? rows : [...this.data.rows, ...rows], hasMore: result.hasMore });
    } catch (error) { if (sequence === this.sequence) this.setData({ error: error.message || '审核列表加载失败' }); }
    finally { if (sequence === this.sequence) this.setData({ loading: false }); }
  },
  note(event) { this.setData({ ['rows[' + event.currentTarget.dataset.index + '].note']: event.detail.value }); },
  async review(event) {
    const row = this.data.rows[event.currentTarget.dataset.index];
    const level = Number(event.currentTarget.dataset.level);
    await this.perform('reviewProvider', { providerId: row._id, approved: level > 0, level, note: row.note });
  },
  async suspend(event) {
    const answer = await new Promise(resolve => wx.showModal({ title: '停用服务员', content: '停用后不能上线或接单，已有任务请到订单管理处理。', success: resolve }));
    if (answer.confirm) await this.perform('suspendProvider', { providerId: event.currentTarget.dataset.id });
  },
  insurance(event) { this.perform('setInsurance', { providerId: event.currentTarget.dataset.id, until: event.detail.value }); },
  cleanup(event) { this.perform('cleanupProviderKyc', { providerId: event.currentTarget.dataset.id }); },
  async perform(action, data) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('admin', action, data); await this.load(true); }
    catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  },
  preview(event) { wx.previewImage({ current: event.currentTarget.dataset.url, urls: [event.currentTarget.dataset.url] }); }
});
