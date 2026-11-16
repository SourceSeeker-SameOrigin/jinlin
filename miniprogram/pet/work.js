const entryDisplay = require('../utils/entry-display');
const api = require('../utils/api');
const { uploadPhotos, uploadVideo } = require('../utils/media');
Page({
  data: { readingEntry: false, missingRecord: false, loading: true, error: '', orderId: '', visits: [], entryPassword: '' },
  onLoad(options = {}) {
    this.orderId = typeof options.id === 'string' ? options.id.trim() : '';
    this.setData({ missingRecord: !this.orderId, loading: !!this.orderId });
  },
  onShow() { this.visible = true; return this.load(); },
  leavePage() {
    this.visible = false; this.taskRead = (this.taskRead || 0) + 1;
    entryDisplay.clear(this);
    this.setData({ visits: [], parentStatus: '', entryMode: '' });
  },
  onHide() { this.leavePage(); },
  onUnload() { this.leavePage(); },
  async load() {
    if (!this.orderId || !this.visible) return;
    const token = this.taskRead = (this.taskRead || 0) + 1;
    const current = () => this.visible && this.taskRead === token;
    entryDisplay.clear(this);
    this.setData({ loading: true, error: '', visits: [], parentStatus: '', entryMode: '' });
    try {
      await getApp().ensureSession();
      if (!current()) return;
      const result = await api.call('pet', 'listVisits', { orderId: this.orderId }, { loading: false, silent: true });
      if (!current()) return;
      this.setData({ visits: result.list || [], parentStatus: result.status, entryMode: result.entryMode });
    } catch (error) { if (current()) this.setData({ error: error.message || '上门清单加载失败' }); }
    finally { if (current()) this.setData({ loading: false }); }
  },
  reveal(event) {
    const visitId = event.currentTarget.dataset.id;
    if (!this.orderId || this.data.entryMode !== 'password' || !this.data.visits.some(v => v._id === visitId && v.status === 'pending')) return;
    return entryDisplay.reveal(this, () => api.call('pet', 'revealEntry', { orderId: this.orderId, visitId }));
  },
  closeSecret() { entryDisplay.clear(this); },
  async done(event) {
    if (!this.orderId) return;
    const visitId = event.currentTarget.dataset.id;
    try {
      const choice = await new Promise(resolve => wx.showActionSheet({ itemList: ['拍摄 2 张照片', '录制视频'], success: resolve, fail: () => resolve(null) }));
      if (!choice) return;
      const folder = 'pet/' + this.orderId;
      const media = choice.tapIndex === 0 ? { photos: await uploadPhotos(folder, 2) } : { videoFileId: await uploadVideo(folder) };
      await api.call('pet', 'markDone', { orderId: this.orderId, visitId, ...media });
      await this.load();
    } catch (error) { this.setData({ error: error.message || '提交服务结果失败' }); }
  },
  async missed(event) {
    if (!this.orderId) return;
    const visitId = event.currentTarget.dataset.id;
    const answer = await new Promise(resolve => wx.showModal({ title: '标记本次未完成', content: '系统将按本次上门金额发起部分退款。确认记录吗？', success: resolve }));
    if (!answer.confirm) return;
    try { await api.call('pet', 'markMissed', { orderId: this.orderId, visitId, reason: '服务员登记未完成' }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '登记失败' }); }
  }
});
