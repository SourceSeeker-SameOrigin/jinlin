const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
Page({
  data: { loading: false, busy: false, error: '', list: [] },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const result = await api.call('coupon', 'center', {}, { loading: false, silent: true });
      this.setData({ list: result.list.map(item => ({ ...item,
        discountText: item.kind === 'amount_off' ? yuan(item.value) + ' 元' :
          item.kind === 'percent_off' ? item.value + '% 优惠' : '免费',
        thresholdText: item.threshold ? '满 ' + yuan(item.threshold) + ' 元可用' : '无门槛' })) });
    } catch (error) { this.setData({ error: error.message || '优惠券加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async claim(event) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try { await api.call('coupon', 'claim', { templateId: event.currentTarget.dataset.id });
      wx.showToast({ title: '领取成功', icon: 'success' }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '领取失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
