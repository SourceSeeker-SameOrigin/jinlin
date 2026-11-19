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
    this.taskContext = null;
    entryDisplay.clear(this);
    this.setData({ visits: [], parentStatus: '', entryMode: '' });
  },
  onHide() { this.leavePage(); },
  onUnload() { this.leavePage(); },
  async load() {
    if (!this.orderId || !this.visible) return;
    const token = this.taskRead = (this.taskRead || 0) + 1;
    const orderId = this.orderId;
    let userId;
    const current = () => this.visible && this.taskRead === token && this.orderId === orderId &&
      (!userId || getApp().globalData.user?._id === userId);
    this.taskContext = null;
    entryDisplay.clear(this);
    this.setData({ loading: true, error: '', visits: [], parentStatus: '', entryMode: '' });
    try {
      const user = await getApp().ensureSession();
      if (!current()) return;
      userId = user && user._id;
      if (!userId) throw new Error('登录资料暂不可用，请重试');
      if (!current()) return;
      const result = await api.call('pet', 'listVisits', { orderId },
        { loading: false, silent: true, redirectOnForbidden: false, isActive: current });
      if (!current()) return;
      this.setData({ visits: result.list || [], parentStatus: result.status, entryMode: result.entryMode });
      this.taskContext = { userId, orderId, read: token };
    } catch (error) { if (current()) this.setData({ error: error.message || '上门清单加载失败' }); }
    finally { if (current()) this.setData({ loading: false }); }
  },
  reveal(event) {
    if (!this.visible || this.data.loading) return;
    const context = this.taskContext;
    if (!context || getApp().globalData.user?._id !== context.userId || this.orderId !== context.orderId) return this.load();
    const visitId = event.currentTarget.dataset.id;
    if (!this.orderId || this.data.entryMode !== 'password' || !this.data.visits.some(v => v._id === visitId && v.status === 'pending')) return;
    const current = () => this.visible && this.taskContext === context && this.taskRead === context.read &&
      getApp().globalData.user?._id === context.userId && this.orderId === context.orderId &&
      this.data.entryMode === 'password' && this.data.visits.some(v => v._id === visitId && v.status === 'pending');
    return entryDisplay.reveal(this, () => api.call('pet', 'revealEntry', { orderId: context.orderId, visitId },
      { loading: false, silent: true, redirectOnForbidden: false, isActive: current }), current, () => this.load());
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
