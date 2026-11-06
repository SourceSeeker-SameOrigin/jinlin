Component({ properties: { code: String, name: String, icon: String }, methods: { open() { wx.navigateTo({ url: '/pages/service/' + this.data.code }); } } });

