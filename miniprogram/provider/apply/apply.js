const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const listAll = require('../../utils/list-all');
Page({
  data: { loading: true, ready: false, uploading: false, busy: false, error: '', errorKind: '', provider: null, communities: [], communityIndex: 0,
    levels: ['邻居帮手（门口任务）', '认证服务员（可入户）'], levelIndex: 0,
    realName: '', idLast4: '', agreed: false, phone: '', kycFileId: '', avatarFileId: '' },
  onLoad() { this.load(); },
  onUnload() { this._closed = true; },
  canEdit() {
    return !this._closed && this.data.ready && !this.data.loading && !this.data.busy && !this.data.uploading &&
      (!this.data.provider || this.data.provider.status === 'rejected');
  },
  async load() {
    if (this._closed || this._loading || this.data.busy || this.data.uploading) return;
    this._loading = true;
    const selectedCommunity = this.data.communities[this.data.communityIndex]?._id;
    this.setData({ loading: true, ready: false, error: '', errorKind: '' });
    try {
      const user = await getApp().ensureSession();
      if (this._closed) return;
      if (!user._id) throw new Error('登录资料不完整，请重新加载');
      this.userId = user._id;
      const communities = await listAll('catalog', 'listCommunities');
      if (this._closed) return;
      const status = await api.call('provider', 'myStatus');
      if (this._closed) return;
      this.setData({ communities, phone: user.phone || '', provider: status.provider, ready: true,
        communityIndex: Math.max(0, communities.findIndex(item => item._id === (selectedCommunity || user.communityId))) });
    } catch (error) { if (!this._closed) this.setData({ error: error.message || '加载失败，请重试', errorKind: 'load' }); }
    finally { this._loading = false; if (!this._closed) this.setData({ loading: false }); }
  },
  change(event) {
    if (!this.canEdit()) return;
    const field = event.currentTarget.dataset.field;
    if (!['realName', 'idLast4', 'communityIndex', 'levelIndex'].includes(field)) return;
    this.setData({ [field]: event.detail.value });
  },
  agree(event) { if (this.canEdit()) this.setData({ agreed: event.detail.value.includes('yes') }); },
  async phone(event) {
    if (!this.canEdit() || !event.detail.code) return;
    this.setData({ busy: true, error: '', errorKind: '' });
    try { const user = await api.call('user', 'bindPhone', { code: event.detail.code }); if (!this._closed) { getApp().globalData.user = user; this.setData({ phone: user.phone }); } }
    catch (error) { if (!this._closed) this.setData({ error: error.message, errorKind: 'operation' }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  },
  async photo(event) {
    if (!this.canEdit() || !this.userId) return;
    this.setData({ uploading: true, error: '', errorKind: '' });
    try {
      const avatar = event.currentTarget.dataset.type === 'avatar';
      const files = await uploadPhotos((avatar ? 'providers/' : 'kyc/') + this.userId, 1);
      if (!this._closed && files[0]) this.setData({ [avatar ? 'avatarFileId' : 'kycFileId']: files[0] });
    } catch (error) { if (!this._closed) this.setData({ error: error.message || '未完成拍照上传，请重试', errorKind: 'operation' }); }
    finally { if (!this._closed) this.setData({ uploading: false }); }
  },
  async submit() {
    if (!this.canEdit()) return;
    if (!this.data.communities[this.data.communityIndex]) { this.setData({ error: '请选择服务小区' }); return; }
    this.setData({ busy: true, error: '', errorKind: '' });
    try {
      const provider = await api.call('provider', 'apply', { communityId: this.data.communities[this.data.communityIndex]._id,
        realName: this.data.realName, idLast4: this.data.idLast4, appliedLevel: Number(this.data.levelIndex) + 1,
        kycFileId: this.data.kycFileId, avatarFileId: this.data.avatarFileId, agreed: this.data.agreed });
      if (this._closed) return;
      this.setData({ provider });
      wx.showToast({ title: '申请已提交', icon: 'success' });
    } catch (error) { if (!this._closed) this.setData({ error: error.message, errorKind: 'operation' }); }
    finally { if (!this._closed) this.setData({ busy: false }); }
  }
});
