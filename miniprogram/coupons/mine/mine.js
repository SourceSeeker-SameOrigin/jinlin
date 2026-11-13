const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { yuan } = require('../../utils/money');
const { lifecycle, currentVisit, readList } = require('../../utils/visible-list');
const { discountText } = require('../presentation');

const STATUS = { unused: '未使用', locked: '已锁定', used: '已使用', expired: '已过期' };
Page({
  ...lifecycle,
  data: { loading: false, error: '', list: [], retrying: false, retryError: '', retryMessage: '', canRetry: false },
  load() {
    return readList(this, { canRetry: false, retrying: false }, '优惠券加载失败', async (_, options) => {
      const { list } = await api.call('coupon', 'mine', {}, options);
      return { canRetry: true, list: list.map(item => ({
        ...item, statusText: STATUS[item.status] || item.status,
        discountText: discountText(item), validText: display(item.validTo),
        thresholdText: item.threshold ? '满 ' + yuan(item.threshold) + ' 元可用' : '无门槛'
      })) };
    }, this._pendingClaim);
  },
  async retryWelcome() {
    const active = currentVisit(this);
    if (!active() || this._pendingClaim || this.data.retrying || !this.data.canRetry) return;
    this.setData({ retrying: true, retryError: '', retryMessage: '' });
    try {
      this._pendingClaim = api.call('user', 'retryWelcomeCoupons', {}, { loading: false, silent: true, isActive: active });
      await this._pendingClaim;
      if (active()) {
        this.setData({ retryMessage: '领取检查已完成，可领取的赠券已入账，已领过的不会重复发放。' });
        await this.load();
      }
    } catch (error) {
      if (active()) this.setData({ retryError: error.message || '暂未完成，请稍后重试' });
    } finally {
      this._pendingClaim = null;
      if (active()) this.setData({ retrying: false });
    }
  }
});
