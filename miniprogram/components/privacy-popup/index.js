const privacy = require('../../utils/privacy');

Component({
  data: { visible: false },
  lifetimes: {
    attached() { this.listener = visible => this.setData({ visible }); privacy.attach(this.listener); },
    detached() { privacy.detach(this.listener); }
  },
  pageLifetimes: {
    show() { if (this.listener) privacy.attach(this.listener); },
    hide() { privacy.detach(this.listener); }
  },
  methods: {
    agree() { privacy.respond(true); },
    decline() { privacy.respond(false); },
    openContract() { wx.openPrivacyContract({ fail: () => wx.showToast({ title: '请稍后重试', icon: 'none' }) }); }
  }
});
