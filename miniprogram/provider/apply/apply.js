const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
Page({
  data: { loading: true, busy: false, error: '', provider: null, communities: [], communityIndex: 0,
    levels: ['邻居帮手（门口任务）', '认证服务员（可入户）'], levelIndex: 0,
    realName: '', idLast4: '', agreed: false, phone: '', kycFileId: '', avatarFileId: '' },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      this.userId = user._id;
      const communities = [];
      let page;
      do { page = await api.call('catalog', 'listCommunities', { offset: communities.length }, { loading: false }); communities.push(...page.list); } while (page.hasMore);
      const status = await api.call('provider', 'myStatus');
      this.setData({ communities, phone: user.phone, provider: status.provider,
        communityIndex: Math.max(0, communities.findIndex(item => item._id === user.communityId)) });
    } catch (error) { this.setData({ error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  change(event) {
    const field = event.currentTarget.dataset.field;
    if (!['realName', 'idLast4', 'communityIndex', 'levelIndex'].includes(field)) return;
    this.setData({ [field]: event.detail.value });
  },
  agree(event) { this.setData({ agreed: event.detail.value.includes('yes') }); },
  async phone(event) {
    if (!event.detail.code) return;
    try { const user = await api.call('user', 'bindPhone', { code: event.detail.code }); getApp().globalData.user = user; this.setData({ phone: user.phone }); }
    catch (error) { this.setData({ error: error.message }); }
  },
  async photo(event) {
    try {
      const avatar = event.currentTarget.dataset.type === 'avatar';
      const files = await uploadPhotos((avatar ? 'providers/' : 'kyc/') + this.userId, 1);
      this.setData({ [avatar ? 'avatarFileId' : 'kycFileId']: files[0] });
    } catch (error) { this.setData({ error: error.message || '未完成拍照上传，请重试' }); }
  },
  async submit() {
    if (this.data.busy) return;
    if (!this.data.communities[this.data.communityIndex]) { this.setData({ error: '请选择服务小区' }); return; }
    this.setData({ busy: true, error: '' });
    try {
      const provider = await api.call('provider', 'apply', { communityId: this.data.communities[this.data.communityIndex]._id,
        realName: this.data.realName, idLast4: this.data.idLast4, appliedLevel: Number(this.data.levelIndex) + 1,
        kycFileId: this.data.kycFileId, avatarFileId: this.data.avatarFileId, agreed: this.data.agreed });
      this.setData({ provider });
      wx.showToast({ title: '申请已提交', icon: 'success' });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ busy: false }); }
  }
});
