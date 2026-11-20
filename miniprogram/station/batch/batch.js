const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { display } = require('../../utils/time');
Page({
  data: { missingRecord: false, loading: true, busy: false, error: '', batch: null },
  onLoad(options = {}) {
    this.batchId = typeof options.id === 'string' ? options.id.trim() : '';
    this.setData({ missingRecord: !this.batchId, loading: !!this.batchId });
  },
  onShow() { this.visible = true; this.load(); },
  onHide() { this.visible = false; },
  onUnload() { this.visible = false; },
  async load() {
    if (!this.batchId) return;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const batch = await api.call('station', 'providerBatch', { batchId: this.batchId }, { loading: false, silent: true });
      if (this.visible) this.setData({ batch: { ...batch,
        items: batch.items.map(item => ({ ...item, atText: item.at ? display(item.at) : '' })) } });
    } catch (error) { if (this.visible) this.setData({ error: error.message || '批次加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async start() {
    if (!this.batchId) return;
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('station', 'startBatch', { batchId: this.batchId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '开始配送失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async delivered(event) {
    if (!this.batchId) return;
    if (this.data.busy) return;
    const itemId = event.currentTarget.dataset.id;
    this.setData({ busy: true, error: '' });
    try {
      const consent = await api.call('station', 'checkDoorDeliveryConsent', { batchId: this.batchId, itemId }, { loading: false, silent: true });
      if (!consent.allowed) {
        wx.showToast({ title: '住户已撤回授权，已跳过', icon: 'none' });
        await this.load();
        return;
      }
      const files = await uploadPhotos('station/' + this.batchId, 1);
      const result = await api.call('station', 'recordDelivery', { batchId: this.batchId, itemId, status: 'delivered', photoFileId: files[0] });
      if (result.status === 'skipped') wx.showToast({ title: '住户已撤回授权，已跳过', icon: 'none' });
      await this.load();
    } catch (error) { this.setData({ error: error.message || '送达记录失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async failed(event) {
    if (!this.batchId) return;
    if (this.data.busy) return;
    const answer = await new Promise(resolve => wx.showModal({ title: '标记未送达', editable: true,
      placeholderText: '填写原因（选填）', success: resolve }));
    if (!answer.confirm) return;
    this.setData({ busy: true, error: '' });
    try {
      await api.call('station', 'recordDelivery', { batchId: this.batchId, itemId: event.currentTarget.dataset.id,
        status: 'failed', reason: answer.content || '' });
      await this.load();
    } catch (error) { this.setData({ error: error.message || '更新结果失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
