const api = require('../../utils/api');
Page({
  data: { loading: true, busy: false, error: '', list: [], selected: null, services: [] },
  onShow() { this.load(); },
  async load() { this.setData({ loading: true, error: '' }); try {
    await getApp().ensureSession();
    const result = await api.call('merchant', 'adminList', { status: 'pending' }, { loading: false, silent: true });
    this.setData({ list: result.list || [] });
  } catch (error) { this.setData({ error: error.message || '商家申请加载失败' }); } finally { this.setData({ loading: false }); } },
  async inspect(event) { const merchant = this.data.list.find(item => item._id === event.currentTarget.dataset.id); if (!merchant) return;
    try { const result = await api.call('merchant', 'adminServices', { merchantId: merchant._id }, { loading: false, silent: true });
      this.setData({ selected: merchant, services: result.list || [] }); }
    catch (error) { this.setData({ error: error.message || '服务加载失败' }); } },
  async review(event) { const approved = event.currentTarget.dataset.approved === 'true'; const merchant = this.data.selected;
    if (!merchant || this.data.busy) return; this.setData({ busy: true, error: '' }); try {
      const note = await new Promise(resolve => wx.showModal({ title: approved ? '通过商家入驻' : '拒绝商家入驻', editable: true, placeholderText: '审核说明（选填）', success: result => resolve(result.confirm ? result.content || '' : null) }));
      if (note === null) return;
      await api.call('merchant', 'review', { merchantId: merchant._id, approved, note }); this.setData({ selected: null }); await this.load();
    } catch (error) { this.setData({ error: error.message || '审核失败' }); } finally { this.setData({ busy: false }); } },
  async serviceStatus(event) { const status = event.currentTarget.dataset.status; try {
    await api.call('merchant', 'setServiceStatus', { serviceId: event.currentTarget.dataset.id, status }); await this.inspect({ currentTarget: { dataset: { id: this.data.selected._id } } });
  } catch (error) { this.setData({ error: error.message || '服务状态更新失败' }); } }
});
