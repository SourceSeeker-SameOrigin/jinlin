const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { yuan } = require('../../utils/money');
const STATUS = { unused: '未使用', locked: '已锁定', used: '已使用', expired: '已过期' };
Page({
  data: { loading: false, error: '', list: [] },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('coupon', 'mine', {}, { loading: false, silent: true });
      this.setData({ list: result.list.map(item => ({ ...item,
        statusText: STATUS[item.status] || item.status,
        discountText: item.kind === 'amount_off' ? yuan(item.value) + ' 元' :
          item.kind === 'percent_off' ? item.value + ' 折' : '免费',
        validText: display(item.validTo), thresholdText: item.threshold ? '满 ' + yuan(item.threshold) + ' 元可用' : '无门槛' })) });
    } catch (error) { this.setData({ error: error.message || '优惠券加载失败' }); }
    finally { this.setData({ loading: false }); }
  }
});
