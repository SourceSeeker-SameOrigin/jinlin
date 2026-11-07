Component({ properties: { code: String, name: String, icon: String, url: String }, methods: { open() { wx.navigateTo({ url: this.data.url || '/pages/service/' + this.data.code }); } } });

