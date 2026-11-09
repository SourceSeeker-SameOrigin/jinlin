const api = require('../../utils/api');
function amountFen(value) {
  const match = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(String(value));
  if (!match) throw new Error('广告金额最多保留两位小数');
  const amount = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 100000000) throw new Error('广告金额超出范围');
  return amount;
}
Page({
  data: { loading: true, error: '', noticeError: '', adError: '', authorized: false, isAdmin: false,
    user: null, communityId: '', communities: [], communityIndex: 0, notices: [], ads: [], title: '', body: '', imageFileId: '', endAt: '', pinned: false,
    adTitle: '', adImage: '', adSlot: 'home_banner', adSlots: ['home_banner', 'board_top', 'shops_top'], adPath: '/shops/list/list', adStart: '', adEnd: '', adTargetType: 'page', adTargetId: '', adPrice: '0.00', adStatus: 'draft',
    adTargetTypes: ['page', 'merchant', 'event'], adStatuses: ['draft', 'live'],
    adSlotIndex: 0, adTargetTypeIndex: 0, adStatusIndex: 0, adPathIndex: 0,
    adSlotLabels: ['首页横幅', '需求广场顶部', '社区商家顶部'],
    adTargetTypeLabels: ['小程序页面', '商家', '活动'], adStatusLabels: ['草稿', '上线'],
    adStatusNames: { draft: '草稿', live: '上线', ended: '已结束' },
    adPathLabels: ['社区商家列表', '商家详情', '社区活动列表', '活动详情'],
    adPaths: ['/shops/list/list', '/shops/detail/detail', '/events/list/list', '/events/detail/detail'] },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '', noticeError: '', adError: '', authorized: false, isAdmin: false, user: null, notices: [], ads: [] });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin') && !user.roles.includes('property')) throw new Error('仅管理员或物业可管理内容');
      const isAdmin = user.roles.includes('admin');
      this.setData({ user, isAdmin, authorized: true });
      await Promise.all([this.prepareNotices(user), isAdmin ? this.loadAds() : Promise.resolve()]);
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async prepareNotices(user) {
    try {
      let communities = [];
      if (user.roles.includes('admin')) {
        let result;
        do {
          result = await api.call('catalog', 'listCommunities', { offset: communities.length }, { loading: false, silent: true });
          communities.push(...result.list);
        } while (result.hasMore);
      } else {
        if (!user.communityId) throw new Error('尚未分配物业服务小区');
        communities = [await api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true })];
      }
      const communityIndex = Math.max(0, communities.findIndex(item => item._id === (this.data.communityId || user.communityId)));
      this.setData({ communities, communityIndex, communityId: (communities[communityIndex] || {})._id || '' });
      await this.loadNotices();
    } catch (error) { this.setData({ noticeError: error.message || '小区加载失败', notices: [], communities: [], communityId: '' }); }
  },
  async loadNotices() {
    const sequence = this.noticeSequence = (this.noticeSequence || 0) + 1;
    this.setData({ noticeError: '', notices: [] });
    try {
      if (!this.data.communityId) throw new Error('请先配置并选择管理小区');
      const result = await api.call('content', 'listNotices', { communityId: this.data.communityId }, { loading: false, silent: true });
      if (sequence === this.noticeSequence) this.setData({ notices: result.list || [] });
    } catch (error) { if (sequence === this.noticeSequence) this.setData({ noticeError: error.message || '公告加载失败' }); }
  },
  async loadAds() {
    this.setData({ adError: '', ads: [] });
    try {
      const result = await api.call('content', 'listAds', {}, { loading: false, silent: true });
      this.setData({ ads: result.list || [] });
    } catch (error) { this.setData({ adError: error.message || '广告加载失败' }); }
  },
  async chooseCommunity(event) {
    if (!this.data.isAdmin || this.data.saving || this.data.loading) return;
    const communityIndex = Number(event.detail.value), community = this.data.communities[communityIndex];
    if (!community) return;
    this.setData({ communityIndex, communityId: community._id });
    await this.loadNotices();
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  async chooseImage(event) {
    const field = event.currentTarget.dataset.field;
    try {
      if (!['imageFileId', 'adImage'].includes(field)) throw new Error('图片用途不正确');
      const user = await getApp().ensureSession();
      await require('../../utils/privacy').authorize();
      const chosen = await new Promise((resolve, reject) => wx.chooseMedia({ count: 1, mediaType: ['image'], success: resolve, fail: reject }));
      const file = chosen.tempFiles && chosen.tempFiles[0];
      if (!file || !file.tempFilePath) throw new Error('没有选择图片');
      const folder = field === 'adImage' ? 'ads' : 'notices';
      const uploaded = await wx.cloud.uploadFile({ cloudPath: folder + '/' + user._id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.jpg', filePath: file.tempFilePath });
      this.setData({ [field]: uploaded.fileID });
    } catch (error) { this.setData({ error: error.errMsg ? '图片选择或上传失败' : error.message || '图片上传失败' }); }
  },
  adTargetTypeChange(event) {
    const index = Number(event.detail.value); if (!this.data.adTargetTypes[index]) return;
    this.setData({ adTargetTypeIndex: index, adTargetType: this.data.adTargetTypes[index] });
  },
  adStatusChange(event) {
    const index = Number(event.detail.value); if (!this.data.adStatuses[index]) return;
    this.setData({ adStatusIndex: index, adStatus: this.data.adStatuses[index] });
  },
  adSlotChange(event) {
    const index = Number(event.detail.value); if (!this.data.adSlots[index]) return;
    this.setData({ adSlotIndex: index, adSlot: this.data.adSlots[index] });
  },
  adPathChange(event) {
    const index = Number(event.detail.value); if (!this.data.adPaths[index]) return;
    this.setData({ adPathIndex: index, adPath: this.data.adPaths[index] });
  },
  togglePinned(event) { this.setData({ pinned: event.detail.value }); },
  async saveNotice() {
    if (!this.data.authorized || this.data.saving) return;
    if (!this.data.communityId) return this.setData({ noticeError: '请先选择管理小区' });
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
    if (!this.data.isAdmin || this.data.saving) return;
    if (!this.data.communityId) return this.setData({ adError: '请先选择广告投放小区' });
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
