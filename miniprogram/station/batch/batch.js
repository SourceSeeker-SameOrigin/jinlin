const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { display } = require('../../utils/time');
Page({
  data: { loading: true, busy: false, error: '', batch: null },
  onLoad(options) { this.batchId = options.id; },
  onShow() { this.visible = true; this.load(); },
  onHide() { this.visible = false; },
  onUnload() { this.visible = false; },
  async load() {
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
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('station', 'startBatch', { batchId: this.batchId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '开始配送失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async delivered(event) {
    if (this.data.busy) return;
    const itemId = event.currentTarget.dataset.id;
    this.setData({ busy: true, error: '' });
    try {
      const files = await uploadPhotos('station/' + this.batchId, 1);
      await api.call('station', 'recordDelivery', { batchId: this.batchId, itemId, status: 'delivered', photoFileId: files[0] });
      await this.load();
    } catch (error) { this.setData({ error: error.message || '送达记录失败' }); }
    finally { this.setData({ busy: false }); }
  },
  async failed(event) {
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
