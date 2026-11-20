const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, ready: false, loadError: false, busy: false, error: '', pending: '0.00', settled: '0.00', available: '0.00',
    payoutEnabled: false, canWithdraw: false, payouts: [] },
  onShow() { this.load(); },
  async load() {
    if (this.data.loading) return;
    this.setData({ loading: true, ready: false, loadError: false, error: '' });
    try {
      await getApp().ensureSession();
      const [income, payoutResult] = await Promise.all([
        api.call('idle', 'earnings', {}, { loading: false, silent: true }),
        api.call('payout', 'list', {}, { loading: false, silent: true })
      ]);
      const stateText = { created: '处理中', processing: '处理中', wait_user_confirm: '待确认收款',
        success: '已到账', failed: '失败，收入已解锁', cancelled: '已撤销，收入已解锁' };
      this.setData({ pending: yuan(income.pending), settled: yuan(income.settled), available: yuan(income.available),
        payoutEnabled: income.payoutEnabled, canWithdraw: income.canWithdraw,
        payouts: (payoutResult.list || []).filter(item => item.payeeType === 'seller')
          .map(item => ({ ...item, amountText: yuan(item.amount), timeText: display(item.createdAt), stateText: stateText[item.state] || '处理中' })) });
      this.setData({ ready: true });
    } catch (error) { this.setData({ loadError: true, error: error.message || '收入加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async withdraw() {
    if (!this.data.ready || this.data.loading || this.data.busy || !this.data.payoutEnabled || !this.data.canWithdraw) return;
    this.setData({ busy: true, error: '' });
    try {
      const payout = await api.call('payout', 'create', { payeeType: 'seller',
        requestId: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9) });
      if (payout.packageInfo) {
        if (!wx.canIUse('requestMerchantTransfer')) throw new Error('请升级微信后再确认收款');
        await new Promise((resolve, reject) => wx.requestMerchantTransfer({ mchId: payout.mchId,
          appId: payout.appId, package: payout.packageInfo, success: resolve, fail: reject }));
      }
      await this.load();
      wx.showToast({ title: payout.state === 'success' ? '已到账' : '打款状态已更新', icon: 'none' });
    } catch (error) { this.setData({ error: error.message || '打款未完成，请刷新收入状态' }); }
    finally { this.setData({ busy: false }); }
  }
});
