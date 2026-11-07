const api = require('../../utils/api');
Page({
  data: { loading: true, busy: false, error: '', communities: [], communityIndex: 0, from: '', to: '' },
  async onLoad() {
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    this.setData({ from: today.slice(0, 8) + '01', to: today });
    await this.load();
  },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可以导出回收企业对账');
      const result = await api.call('catalog', 'listCommunities', {}, { loading: false, silent: true });
      this.setData({ communities: result.list, communityIndex: Math.max(0, result.list.findIndex(item => item._id === user.communityId)) });
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  select(event) { this.setData({ communityIndex: Number(event.detail.value) }); },
  async exportStatement() {
    if (this.data.busy) return;
    const community = this.data.communities[this.data.communityIndex];
    if (!community) { this.setData({ error: '请选择小区' }); return; }
    this.setData({ busy: true, error: '' });
    try {
      const result = await api.call('admin', 'exportRecyclerStatement', { communityId: community._id,
        from: this.data.from, to: this.data.to });
      const file = await new Promise((resolve, reject) => wx.downloadFile({ url: result.tempFileURL,
        success: response => response.statusCode === 200 ? resolve(response.tempFilePath) : reject(new Error('CSV 下载失败')), fail: reject }));
      wx.openDocument({ filePath: file, fileType: 'csv', showMenu: true,
        fail: () => this.setData({ error: `已生成 ${result.count} 条对账明细，金额 ${result.totalFen} 分；CSV 已下载，请用其他应用打开` }) });
    } catch (error) { this.setData({ error: error.message || '对账导出失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
