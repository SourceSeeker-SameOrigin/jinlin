const api = require('../../utils/api');
Page({
  data: { loading: true, busy: false, error: '', communities: [], providers: [], communityIndex: 0, providerIndex: 0,
    buildings: [], poster: null },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可以生成海报码');
      const communities = await api.call('catalog', 'listCommunities', {}, { loading: false, silent: true });
      const providers = await api.call('admin', 'listProviders', { status: 'approved' }, { loading: false, silent: true });
      this.setData({ communities: communities.list, providers: providers.list });
      await this.changeCommunity({ detail: { value: 0 } });
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async changeCommunity(event) {
    const communityIndex = Number(event.detail.value);
    const community = this.data.communities[communityIndex];
    if (!community) return;
    const detail = await api.call('catalog', 'getCommunity', { communityId: community._id }, { loading: false, silent: true });
    this.setData({ communityIndex, buildings: detail.buildings, poster: null });
  },
  async generate(event) {
    if (this.data.busy) return;
    const type = event.currentTarget.dataset.type;
    const id = type === 'building' ? event.currentTarget.dataset.id : this.data.providers[this.data.providerIndex]._id;
    this.setData({ busy: true, error: '' });
    try {
      const result = await api.call('admin', 'genPoster', type === 'building' ? { buildingId: id } : { providerId: id });
      this.setData({ poster: result });
    } catch (error) { this.setData({ error: error.message || '生成失败，请重试' }); }
    finally { this.setData({ busy: false }); }
  },
  providerChange(event) { this.setData({ providerIndex: Number(event.detail.value) }); },
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
