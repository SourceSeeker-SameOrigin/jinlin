const { envId } = require('./config/env');

App({
  onLaunch() {
    wx.cloud.init({ env: envId, traceUser: true });
  },
  globalData: {
    user: null,
    community: null
  }
});
