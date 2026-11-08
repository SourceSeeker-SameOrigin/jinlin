const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { yuan } = require('../../utils/money');
const STATUS = { unused: '未使用', locked: '已锁定', used: '已使用', expired: '已过期' };
Page({
  data: { loading: false, error: '', list: [], retrying: false, retryError: '', retryMessage: '', canRetry: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '', canRetry: false });
    try {
      await getApp().ensureSession();
      const result = await api.call('coupon', 'mine', {}, { loading: false, silent: true });
      this.setData({ canRetry: true, list: result.list.map(item => ({ ...item,
        statusText: STATUS[item.status] || item.status,
        discountText: item.kind === 'amount_off' ? yuan(item.value) + ' 元' :
          item.kind === 'percent_off' ? item.value + ' 折' : '免费',
        validText: display(item.validTo), thresholdText: item.threshold ? '满 ' + yuan(item.threshold) + ' 元可用' : '无门槛' })) });
    } catch (error) { this.setData({ error: error.message || '优惠券加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async retryWelcome() {
    if (this.data.retrying || !this.data.canRetry) return;
    this.setData({ retrying: true, retryError: '', retryMessage: '' });
    try {
      await api.call('user', 'retryWelcomeCoupons', {}, { loading: false, silent: true });
      this.setData({ retryMessage: '领取检查已完成，可领取的赠券已入账，已领过的不会重复发放。' });
      await this.load();
    } catch (error) { this.setData({ retryError: error.message || '暂未完成，请稍后重试' }); }
    finally { this.setData({ retrying: false }); }
  }
});
