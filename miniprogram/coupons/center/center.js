const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { lifecycle, currentVisit, readList } = require('../../utils/visible-list');
const { discountText } = require('../presentation');

Page({
  ...lifecycle,
  data: { loading: false, busy: false, error: '', list: [] },
  load() {
    return readList(this, { busy: false }, '优惠券加载失败', async (_, options) => {
      const { list } = await api.call('coupon', 'center', {}, options);
      return { list: list.map(item => ({
        ...item, discountText: discountText(item),
        thresholdText: item.threshold ? '满 ' + yuan(item.threshold) + ' 元可用' : '无门槛'
      })) };
    }, this._pendingClaim);
  },
  async claim(event) {
    const active = currentVisit(this);
    if (!active() || this.data.loading || this._pendingClaim || this.data.busy) return;
    this.setData({ busy: true });
    try {
      const request = api.call('coupon', 'claim', { templateId: event.currentTarget.dataset.id },
        { loading: false, silent: true, isActive: active });
      this._pendingClaim = request;
      await request;
      if (active()) {
        wx.showToast({ title: '领取成功', icon: 'success' });
        await this.load();
      }
    } catch (error) {
      if (active()) this.setData({ error: error.message || '领取失败' });
    } finally {
      this._pendingClaim = null;
      if (active()) this.setData({ busy: false });
    }
  }
});
