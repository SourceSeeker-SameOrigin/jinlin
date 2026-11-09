const api = require('../../utils/api');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
Page({
  data: { loading: false, ready: false, loadError: false, creatingPayout: false, error: '', rows: [], payouts: [], pending: '0.00', settled: '0.00',
    available: '0.00', canWithdraw: false, payoutEnabled: false, hasMore: true },
  onShow() { this.load(true); },
  onReachBottom() { if (this.data.ready && this.data.hasMore && !this.data.loading) this.load(); },
  retry() { this.load(true); },
  async load(reset = false) {
    if (this.data.loading) return;
    this.setData({ loading: true, ready: false, loadError: false, error: '' });
    try {
      await getApp().ensureSession();
      const [result, payoutResult] = await Promise.all([
        api.call('provider', 'earnings', { offset: reset ? 0 : this.data.rows.length }, { loading: false, silent: true }),
        reset ? api.call('payout', 'list', {}, { loading: false, silent: true }) : Promise.resolve({ list: this.data.payouts })
      ]);
      const rows = result.list.map(row => ({ ...row, amountText: yuan(row.amount), time: display(row.createdAt) }));
      const payouts = (payoutResult.list || []).map(item => ({ ...item, amountText: yuan(item.amount),
        time: display(item.createdAt), stateText: this.payoutStateText(item.state) }));
      this.setData({ rows: reset ? rows : [...this.data.rows, ...rows], payouts, pending: yuan(result.pending),
        settled: yuan(result.settled), available: yuan(result.available || 0), canWithdraw: result.canWithdraw === true,
        payoutEnabled: result.payoutEnabled === true,
        hasMore: result.hasMore });
      this.setData({ ready: true });
    } catch (error) { this.setData({ loadError: true, error: error.message || '收入加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  payoutStateText(state) { return ({ created: '处理中', processing: '处理中', wait_user_confirm: '待确认收款',
    success: '已到账', failed: '失败，收入已解锁', cancelled: '已撤销，收入已解锁' })[state] || '处理中'; },
  async createPayout() {
    if (!this.data.ready || this.data.loading || this.data.creatingPayout || !this.data.payoutEnabled || !this.data.canWithdraw) return;
    this.setData({ creatingPayout: true, error: '' });
    try {
      const requestId = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      const payout = await api.call('payout', 'create', { requestId });
      if (payout.packageInfo) {
        if (!wx.canIUse('requestMerchantTransfer')) throw new Error('请升级微信后再确认收款');
        await new Promise((resolve, reject) => wx.requestMerchantTransfer({
          mchId: payout.mchId, appId: payout.appId, package: payout.packageInfo,
          success: resolve, fail: reject
        }));
      }
      await this.load(true);
      wx.showToast({ title: payout.state === 'success' ? '提现已到账' : '提现状态已更新', icon: 'none' });
    } catch (error) { this.setData({ error: error.message || '提现未完成，请刷新收入状态' }); }
    finally { this.setData({ creatingPayout: false }); }
  }
});
