const api = require('../../utils/api');
Page({
  data: { loading: true, error: '' },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) return;
      const templates = await api.call('admin', 'notificationTemplates', {}, { loading: false, silent: true });
      if (templates.unaccepted) await new Promise(resolve => wx.requestSubscribeMessage({ tmplIds: [templates.unaccepted],
        success: resolve, fail: resolve }));
    } catch (error) { this.setData({ error: error.message || '看板加载失败' }); }
    finally { this.setData({ loading: false }); }
  }
});
