const api = require('../utils/api');
const { uploadPhotos, uploadVideo } = require('../utils/media');
Page({
  data: { loading: true, error: '', orderId: '', visits: [], entryPassword: '' },
  onLoad(options) { this.orderId = options.id; },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('pet', 'listVisits', { orderId: this.orderId }, { loading: false, silent: true });
      this.setData({ visits: result.list || [], parentStatus: result.status, entryMode: result.entryMode });
    } catch (error) { this.setData({ error: error.message || '上门清单加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async reveal(event) {
    try {
      const result = await api.call('pet', 'revealEntry', { orderId: this.orderId, visitId: event.currentTarget.dataset.id });
      this.setData({ entryPassword: result.entry });
    } catch (error) { this.setData({ error: error.message || '门锁信息暂不可用' }); }
  },
  closeSecret() { this.setData({ entryPassword: '' }); },
  async done(event) {
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
    const visitId = event.currentTarget.dataset.id;
    const answer = await new Promise(resolve => wx.showModal({ title: '标记本次未完成', content: '系统将按本次上门金额发起部分退款。确认记录吗？', success: resolve }));
    if (!answer.confirm) return;
    try { await api.call('pet', 'markMissed', { orderId: this.orderId, visitId, reason: '服务员登记未完成' }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '登记失败' }); }
  }
});
