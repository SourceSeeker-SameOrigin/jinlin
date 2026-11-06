const api = require('../../utils/api');
const ISSUE_MODES = ['claim', 'auto_new_user', 'referral', 'event', 'manual'];
const MODE_LABELS = ['用户领取', '新用户自动发放', '推荐发放', '活动发放', '管理员手动发放'];
const EMPTY = { name: '', kind: 'amount_off', value: '100', maxOff: '100', threshold: '0',
  servicesText: 'all', validDays: '30', totalLimit: '100', perUserLimit: '1', issueMode: 'claim',
  communitiesText: 'all', status: 'active', phone: '', userIdsText: '' };
Page({
  data: { loading: false, saving: false, error: '', rows: [], form: { ...EMPTY }, modeLabels: MODE_LABELS,
    kindOptions: ['amount_off', 'percent_off', 'free'], kindIndex: 0 },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可管理优惠券');
      const result = await api.call('coupon', 'adminTemplates', {}, { loading: false, silent: true });
      this.setData({ rows: result.list });
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  field(event) { this.setData({ ['form.' + event.currentTarget.dataset.field]: event.detail.value }); },
  chooseMode(event) { this.setData({ 'form.issueMode': ISSUE_MODES[Number(event.detail.value)] }); },
  edit(event) {
    const row = this.data.rows[event.currentTarget.dataset.index];
    this.setData({ kindIndex: Math.max(0, this.data.kindOptions.indexOf(row.kind)), form: { ...EMPTY, ...row,
      templateId: row._id, servicesText: row.services.join(','), communitiesText:
        row.communityIds === 'all' ? 'all' : row.communityIds.join(',') } });
  },
  reset() { this.setData({ form: { ...EMPTY }, kindIndex: 0, error: '' }); },
  chooseKind(event) {
    const kindIndex = Number(event.detail.value);
    this.setData({ kindIndex, 'form.kind': this.data.kindOptions[kindIndex] });
  },
  async save() {
    const form = this.data.form;
    this.setData({ saving: true, error: '' });
    try {
      const services = form.servicesText.trim() === 'all' ? ['all'] : form.servicesText.split(',').map(value => value.trim()).filter(Boolean);
      const communityIds = form.communitiesText.trim() === 'all' ? 'all' : form.communitiesText.split(',').map(value => value.trim()).filter(Boolean);
      const template = { ...form, services, communityIds, value: Number(form.value), maxOff: Number(form.maxOff),
        threshold: Number(form.threshold), validDays: Number(form.validDays), totalLimit: Number(form.totalLimit),
        perUserLimit: Number(form.perUserLimit) };
      delete template.servicesText; delete template.communitiesText; delete template.phone; delete template.userIdsText;
      await api.call('coupon', 'saveTemplate', template);
      this.reset(); await this.load();
    } catch (error) { this.setData({ error: error.message || '保存失败' }); }
    finally { this.setData({ saving: false }); }
  },
  templatePick(event) {
    const item = this.data.rows[Number(event.detail.value)];
    this.setData({ 'form.issueTemplateId': item && item._id || '' });
  },
  async toggleStatus(event) {
    const row = this.data.rows[event.currentTarget.dataset.index];
    this.setData({ saving: true });
    try { await api.call('coupon', 'saveTemplate', { ...row, templateId: row._id,
      status: row.status === 'active' ? 'paused' : 'active' }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '更新模板状态失败' }); }
    finally { this.setData({ saving: false }); }
  },
  async issue() {
    const selected = this.data.rows.find(row => row._id === this.data.form.issueTemplateId) || this.data.rows[0];
    if (!selected) { this.setData({ error: '请先创建优惠券模板' }); return; }
    this.setData({ saving: true, error: '' });
    try {
      const phone = this.data.form.phone.trim();
      const userIds = this.data.form.userIdsText.split(/[\s,，]+/).filter(Boolean);
      const result = await api.call('coupon', 'manualIssue', { templateId: selected._id,
        ...(phone ? { phone } : { userIds }) });
      wx.showToast({ title: '成功 ' + result.issued + '，重复 ' + result.duplicates + '，失败 ' + result.failures.length,
        icon: result.failures.length ? 'none' : 'success' });
      await this.load();
      if (result.failures.length) this.setData({ error: result.failures.map(item => item.userId + '：' + item.message).join('；') });
    } catch (error) { this.setData({ error: error.message || '发放失败' }); }
    finally { this.setData({ saving: false }); }
  }
});
