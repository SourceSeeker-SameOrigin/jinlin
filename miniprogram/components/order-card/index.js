Component({ properties: { order: Object }, methods: { open() { wx.navigateTo({ url: '/pages/orders/detail?id=' + encodeURIComponent(this.data.order._id) }); } } });

