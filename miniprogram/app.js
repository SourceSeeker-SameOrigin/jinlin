const { envId } = require('./config/env');
const api = require('./utils/api');
const scene = require('./utils/scene');
const privacy = require('./utils/privacy');

App({
  onLaunch(options) {
    wx.cloud.init({ env: envId, traceUser: true });
    privacy.install();
    this.pendingScene = scene.remember(options);
    this.firstShow = true;
    this.ensureSession().catch(error => {
      this.globalData.bootstrapError = error.message;
    });
  },
  onShow(options) {
    if (this.firstShow) { this.firstShow = false; return; }
    const value = scene.remember(options);
    if (value) this.ensureSession().then(() => this.recordScene(value)).catch(error => {
      this.globalData.bootstrapError = error.message;
    });
  },
  ensureSession(refresh = false) {
    if (this.loginPromise) return this.loginPromise;
    if (!refresh && this.globalData.user && !this.pendingScene) return Promise.resolve(this.globalData.user);
    this.loginPromise = api.call('user', 'login', {}, { loading: false, silent: true }).then(async result => {
      this.globalData.user = result.profile;
      this.globalData.community = result.community;
      this.globalData.provider = result.provider;
      this.globalData.bootstrapError = '';
      if (this.pendingScene) {
        const value = this.pendingScene;
        try { await this.recordScene(value); }
        catch (error) {
          if (error.code !== 'E_INVALID_PARAM') throw error;
          wx.removeStorageSync('scene');
          wx.showToast({ title: '二维码已失效，请手动选择小区', icon: 'none' });
        }
        this.pendingScene = null;
      }
      return result.profile;
    }).finally(() => { this.loginPromise = null; });
    return this.loginPromise;
  },
  recordScene(value) {
    return value ? api.call('user', 'recordScene', { scene: value }, { loading: false, silent: true }) : Promise.resolve();
  },
  globalData: {
    user: null,
    community: null,
    provider: null,
    bootstrapError: ''
  }
});
