const api = require('../../utils/api');
function amountFen(value) {
  const match = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(String(value));
  if (!match) throw new Error('广告金额最多保留两位小数');
  const amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100000000) throw new Error('广告金额超出范围');
  return amount;
}
Page({
  data: { loading: true, error: '', user: null, communityId: '', notices: [], ads: [], title: '', body: '', imageFileId: '', endAt: '', pinned: false,
    adTitle: '', adImage: '', adSlot: 'home_banner', adSlots: ['home_banner', 'board_top', 'shops_top'], adPath: '/shops/list/list', adStart: '', adEnd: '', adTargetType: 'page', adTargetId: '', adPrice: '0.00', adStatus: 'draft',
    adTargetTypes: ['page', 'merchant', 'event'], adStatuses: ['draft', 'live'],
    adPaths: ['/shops/list/list', '/shops/detail/detail', '/events/list/list', '/events/detail/detail'] },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin') && !user.roles.includes('property')) throw new Error('仅管理员或物业可管理内容');
      const communityId = user.communityId;
      const result = await api.call('content', 'listNotices', { communityId }, { loading: false, silent: true });
      let ads = [];
      if (user.roles.includes('admin')) ads = (await api.call('content', 'listAds', {}, { loading: false, silent: true })).list || [];
      this.setData({ user, isAdmin: user.roles.includes('admin'), communityId, notices: result.list || [], ads });
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  async chooseImage(event) {
    const field = event.currentTarget.dataset.field;
    try {
      const chosen = await new Promise((resolve, reject) => wx.chooseMedia({ count: 1, mediaType: ['image'], success: resolve, fail: reject }));
      const file = chosen.tempFiles && chosen.tempFiles[0];
      if (!file || !file.tempFilePath) throw new Error('没有选择图片');
      const uploaded = await wx.cloud.uploadFile({ cloudPath: 'content/' + field + '/' + Date.now() + '.jpg', filePath: file.tempFilePath });
      this.setData({ [field]: uploaded.fileID });
    } catch (error) { this.setData({ error: error.errMsg ? '图片选择或上传失败' : error.message || '图片上传失败' }); }
  },
  adTargetTypeChange(event) { this.setData({ adTargetType: this.data.adTargetTypes[Number(event.detail.value)] || 'page' }); },
  adStatusChange(event) { this.setData({ adStatus: this.data.adStatuses[Number(event.detail.value)] || 'draft' }); },
  adSlotChange(event) { this.setData({ adSlot: this.data.adSlots[Number(event.detail.value)] || 'home_banner' }); },
  adPathChange(event) { this.setData({ adPath: this.data.adPaths[Number(event.detail.value)] || this.data.adPaths[0] }); },
  togglePinned(event) { this.setData({ pinned: event.detail.value }); },
  async saveNotice() {
    if (!this.data.endAt) return this.setData({ error: '请填写公告有效期' });
    this.setData({ saving: true, error: '' });
    try {
      await api.call('content', 'saveNotice', { communityId: this.data.communityId, title: this.data.title, body: this.data.body, imageFileId: this.data.imageFileId,
        endAt: new Date(this.data.endAt + 'T23:59:59+08:00').toISOString(), pinned: this.data.pinned });
      this.setData({ title: '', body: '', imageFileId: '', pinned: false }); await this.load();
    } catch (error) { this.setData({ error: error.message || '公告发布失败' }); }
    finally { this.setData({ saving: false }); }
  },
  async endNotice(event) {
    try { await api.call('content', 'endNotice', { noticeId: event.currentTarget.dataset.id }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '操作失败' }); }
  },
  async endAd(event) {
    try { await api.call('content', 'endAd', { adId: event.currentTarget.dataset.id }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '结束广告失败' }); }
  },
  async confirmAdReceived(event) {
    const ad = this.data.ads.find(item => item._id === event.currentTarget.dataset.id);
    if (!ad || ad.paymentReceivedAt) return;
    const answer = await new Promise(resolve => wx.showModal({ title: '确认广告款已到账？',
      content: '确认后会将广告金额记入平台收入账本。', success: result => resolve(result.confirm) }));
    if (!answer) return;
    try { await api.call('content', 'markAdReceived', { adId: ad._id }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '确认收款失败' }); }
  },
  async saveAd() {
    if (!this.data.adStart || !this.data.adEnd) return this.setData({ error: '请填写广告起止日期' });
    this.setData({ saving: true, error: '' });
    try {
      await api.call('content', 'saveAd', { title: this.data.adTitle, imageFileId: this.data.adImage,
        slot: this.data.adSlot, communityIds: [this.data.communityId], startAt: new Date(this.data.adStart + 'T00:00:00+08:00').toISOString(),
        endAt: new Date(this.data.adEnd + 'T23:59:59+08:00').toISOString(),
        target: this.data.adTargetType === 'page' ? { type: 'page', path: this.data.adPath } : { type: this.data.adTargetType, id: this.data.adTargetId },
        price: amountFen(this.data.adPrice), status: this.data.adStatus });
      this.setData({ adTitle: '', adImage: '', adTargetId: '' }); await this.load();
    } catch (error) { this.setData({ error: error.message || '广告保存失败' }); }
    finally { this.setData({ saving: false }); }
  }
});
