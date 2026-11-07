const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
Page({
  data: { loading: true, error: '', list: [], hasMore: true },
  onShow() { this.load(true); },
  onPullDownRefresh() { this.load(true).finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (!this.data.loading && this.data.hasMore) this.load(); },
  async load(reset = false) {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('event', 'list', { offset: reset ? 0 : this.data.list.length }, { loading: false, silent: true });
      const list = result.list.map(item => ({ ...item, feeText: item.fee ? '¥' + yuan(item.fee) : '免费', startText: display(item.startAt) }));
      this.setData({ list: reset ? list : [...this.data.list, ...list], hasMore: result.hasMore });
    } catch (error) { this.setData({ error: error.message || '活动加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  open(event) { wx.navigateTo({ url: '/events/detail/detail?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); }
});
