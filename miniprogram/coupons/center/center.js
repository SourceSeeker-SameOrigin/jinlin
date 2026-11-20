const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { lifecycle, currentVisit, readList } = require('../../utils/visible-list');
const { discountText } = require('../presentation');

function pendingClaims(key) {
  return wx.getStorageSync(key) || {};
}

function finishClaim(key, templateId, requestId) {
  const pending = pendingClaims(key);
  if (pending[templateId]?.id !== requestId) return;
  delete pending[templateId];
  if (Object.keys(pending).length) wx.setStorageSync(key, pending);
  else wx.removeStorageSync(key);
}

Page({
  ...lifecycle,
  data: { loading: true, busy: false, error: '', list: [], pending: [] },
  load() {
    return readList(this, { busy: false, pending: [] }, '优惠券加载失败', async (user, options) => {
      const { list } = await api.call('coupon', 'center', {}, options);
      return { pending: Object.values(pendingClaims('couponClaim:' + user._id)), list: list.map(item => ({
        ...item, discountText: discountText(item),
        thresholdText: item.threshold ? '满 ' + yuan(item.threshold) + ' 元可用' : '无门槛'
      })) };
    }, this._pendingClaim);
  },
  async claim(event) {
    const active = currentVisit(this);
    if (!active() || this.data.loading || this._pendingClaim || this.data.busy) return;
    const templateId = event.currentTarget.dataset.id;
    const user = getApp().globalData.user;
    if (!user || !user._id || !templateId) return;
    const key = 'couponClaim:' + user._id;
    let receipt;
    let pending;
    this.setData({ busy: true, error: '' });
    try {
      pending = pendingClaims(key);
      receipt = pending[templateId];
      if (!receipt) {
        const template = this.data.list.find(item => item._id === templateId);
        receipt = { id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2),
          templateId, name: template?.name || '优惠券' };
        wx.setStorageSync(key, { ...pending, [templateId]: receipt });
        pending[templateId] = receipt;
      }
      const request = api.call('coupon', 'claim', { templateId, requestId: receipt.id },
        { loading: false, silent: true, isActive: active });
      this._pendingClaim = request;
      await request;
      finishClaim(key, templateId, receipt.id);
      if (active()) {
        wx.showToast({ title: '领取成功', icon: 'success' });
        await this.load();
      }
    } catch (error) {
      if (receipt && ['E_INVALID_PARAM', 'E_FORBIDDEN', 'E_FEATURE_OFF'].includes(error.code)) {
        finishClaim(key, templateId, receipt.id);
        delete pending[templateId];
      }
      if (active()) this.setData({ error: error.message || '领取失败', pending: Object.values(pending || {}) });
    } finally {
      this._pendingClaim = null;
      if (active()) this.setData({ busy: false });
    }
  }
});
