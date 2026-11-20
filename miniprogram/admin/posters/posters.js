const api = require('../../utils/api');
const listAll = require('../../utils/list-all');
Page({
  data: { loading: true, ready: false, communityLoading: false, communityReady: false,
    busy: false, error: '', retryAction: '', communities: [], providers: [], communityIndex: 0, providerIndex: 0,
    buildings: [], poster: null },
  onLoad() { this.load(); },
  onUnload() {
    this._closed = true;
    this._communityRequest = (this._communityRequest || 0) + 1;
    this._targetVersion = (this._targetVersion || 0) + 1;
  },
  async load() {
    if (this._loading || this.data.busy || this._closed) return;
    this._loading = true;
    this._communityRequest = (this._communityRequest || 0) + 1;
    this._targetVersion = (this._targetVersion || 0) + 1;
    const selectedCommunity = this.data.communities[this.data.communityIndex]?._id;
    this.setData({ loading: true, ready: false, communityReady: false, communityLoading: false,
      buildings: [], poster: null, error: '', retryAction: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可以生成海报码');
      const communities = await listAll('catalog', 'listCommunities');
      const providers = await listAll('admin', 'listProviders', { status: 'approved' });
      if (this._closed) return;
      const communityIndex = Math.max(0, communities.findIndex(item => item._id === selectedCommunity));
      this.setData({ communities, providers, ready: true,
        communityIndex, providerIndex: 0 });
      await this.changeCommunity({ detail: { value: communityIndex } });
    } catch (error) {
      if (!this._closed) this.setData({ error: error.message || '加载失败', retryAction: 'load' });
    } finally {
      this._loading = false;
      if (!this._closed) this.setData({ loading: false });
    }
  },
  async changeCommunity(event) {
    if (!this.data.ready || this._closed) return;
    const communityIndex = Number(event.detail.value);
    const community = this.data.communities[communityIndex];
    const request = this._communityRequest = (this._communityRequest || 0) + 1;
    this._targetVersion = (this._targetVersion || 0) + 1;
    this.setData({ communityIndex, buildings: [], poster: null, communityReady: false,
      communityLoading: !!community, error: '', retryAction: '' });
    if (!community) return;
    try {
      const detail = await api.call('catalog', 'getCommunity', { communityId: community._id }, { loading: false, silent: true });
      if (request !== this._communityRequest || this._closed) return;
      this.setData({ buildings: detail.buildings || [], communityReady: true });
    } catch (error) {
      if (request === this._communityRequest && !this._closed) {
        this.setData({ error: error.message || '小区读取失败，请重试', retryAction: 'community' });
      }
    } finally {
      if (request === this._communityRequest && !this._closed) this.setData({ communityLoading: false });
    }
  },
  retry() {
    if (this.data.loading || this.data.communityLoading || this.data.busy) return;
    if (this.data.retryAction === 'community') return this.changeCommunity({ detail: { value: this.data.communityIndex } });
    if (this.data.retryAction === 'load') return this.load();
  },
  async generate(event) {
    if (this.data.busy || this.data.loading || !this.data.ready || this._closed) return;
    const type = event.currentTarget.dataset.type;
    const target = type === 'building'
      ? this.data.communityReady && this.data.buildings.find(item => item._id === event.currentTarget.dataset.id)
      : type === 'provider' && this.data.providers[this.data.providerIndex];
    if (!target?._id) {
      this.setData({ error: type === 'provider' ? '暂无可用服务员，请先完成服务员审核' : '请先选择已加载的小区楼栋' });
      return;
    }
    const version = this._targetVersion || 0;
    this.setData({ busy: true, poster: null, error: '' });
    try {
      const result = await api.call('admin', 'genPoster', type === 'building' ? { buildingId: target._id } : { providerId: target._id });
      if (version === (this._targetVersion || 0) && !this._closed) this.setData({ poster: result });
    } catch (error) {
      if (version === (this._targetVersion || 0) && !this._closed) this.setData({ error: error.message || '生成失败，请重试' });
    } finally { if (!this._closed) this.setData({ busy: false }); }
  },
  providerChange(event) {
    if (!this.data.ready || this._closed) return;
    this._targetVersion = (this._targetVersion || 0) + 1;
    this.setData({ providerIndex: Number(event.detail.value), poster: null });
  },
  preview() { if (this.data.poster) require('../../utils/media-links').preview({ urls: [this.data.poster.tempFileURL] }); },
  save() {
    const poster = this.data.poster;
    if (!poster) return;
    wx.downloadFile({ url: poster.tempFileURL, success: response => {
      if (response.statusCode !== 200) { this.setData({ error: '图片下载失败，请重试' }); return; }
      wx.saveImageToPhotosAlbum({ filePath: response.tempFilePath,
        success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
        fail: error => this.setData({ error: error.errMsg || '保存失败，请检查相册权限' }) });
    }, fail: error => this.setData({ error: error.errMsg || '下载失败，请重试' }) });
  }
});
