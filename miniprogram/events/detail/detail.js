const reportAction = require('../../utils/report');
const api = require('../../utils/api');
const { pay } = require('../../utils/payment');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
const { signupStatusNames } = require('../../utils/status-labels');
Page({
  data: { missingRecord: false, loading: true, busy: false, error: '', item: null, signupStatusNames },
  onLoad(options = {}) {
    this.eventId = typeof options.id === 'string' ? options.id.trim() : '';
    this.setData({ missingRecord: !this.eventId, loading: !!this.eventId });
  },
  onShow() { this.visible = true; return this.load(); },
  onHide() { this.visible = false; clearTimeout(this.deadlineTimer); },
  onUnload() { this.onHide(); },
  refreshActions() {
    clearTimeout(this.deadlineTimer);
    const item = this.data.item;
    if (!item) return {};
    const now = Date.now();
    const deadline = new Date(item.signupDeadline).getTime();
    const start = new Date(item.startAt).getTime();
    const status = item.mySignup && item.mySignup.status;
    const published = item.status === 'published' && item.featureEnabled;
    const beforeDeadline = deadline > now;
    const canCancel = beforeDeadline && (status === 'signed' || status === 'pending_pay');
    const canPay = published && status === 'pending_pay';
    const canJoin = published && beforeDeadline && start > now && item.canSignup && item.remaining > 0;
    let reason = '';
    if (item.status !== 'published') reason = '活动当前不可报名';
    else if (!beforeDeadline || start <= now) reason = '活动报名已截止';
    else if (item.remaining <= 0 && !status) reason = '活动名额已满';
    if (!beforeDeadline && (status === 'signed' || status === 'pending_pay')) reason = '报名已截止，无法取消报名';
    const actions = { canJoin, canPay, canCancel, reason };
    this.setData({ actions });
    const next = Math.min(...[deadline, start].filter(at => at > now));
    if (this.visible && Number.isFinite(next)) {
      this.deadlineTimer = setTimeout(() => this.refreshActions(), Math.min(next - now, 2147483647));
    }
    return actions;
  },
  async reportContent(event) {
    if (!this.eventId) return;
    if(this.reporting)return;this.reporting=true;
    try { await reportAction.submit('event',this.eventId); }
    catch(error){this.setData({error:error.message||'举报提交失败'});}
    finally{this.reporting=false;}
  },
  async load() {
    if (!this.eventId) return;
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const item = await api.call('event', 'detail', { eventId: this.eventId }, { loading: false, silent: true });
      item.feeText = item.fee ? '¥' + yuan(item.fee) : '免费';
      item.startText = display(item.startAt); item.endText = display(item.endAt); item.deadlineText = display(item.signupDeadline);
      this.setData({ item });
      this.refreshActions();
    } catch (error) { this.setData({ error: error.message || '活动加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async signup() {
    if (!this.eventId) return;
    if (this.data.busy || this.data.loading) return;
    const allowed = () => { const actions = this.refreshActions(); return actions.canJoin || actions.canPay; };
    if (!allowed()) return;
    this.setData({ busy: true, error: '' });
    try {
      const templates = await api.call('event', 'templates', {}, { loading: false, silent: true });
      if (!allowed()) return;
      if (templates.eventReminder && typeof wx.requestSubscribeMessage === 'function') {
        await new Promise(resolve => wx.requestSubscribeMessage({ tmplIds: [templates.eventReminder], success: resolve, fail: resolve }));
      }
      if (!allowed()) return;
      const result = await api.call('event', 'signup', { eventId: this.eventId });
      if (result.mock) await api.call('order', 'mockPay', { orderId: result.orderId });
      else if (result.payment) await pay(result.payment);
      await this.load();
      wx.showToast({ title: result.status === 'pending_pay' ? (result.duplicate ? '请继续完成支付' : '请完成支付') : '报名成功', icon: 'none' });
    } catch (error) { this.setData({ error: error.message || '报名失败，请重试' }); }
    finally { this.setData({ busy: false }); }
  },
  async cancelSignup() {
    if (!this.eventId) return;
    if (this.data.busy || this.data.loading || !this.refreshActions().canCancel) return;
    const modal = await new Promise(resolve => wx.showModal({ title: '取消报名', content: '确认取消本次报名吗？截止前将按规则全额退款。', success: resolve }));
    if (!modal.confirm || this.data.busy || !this.refreshActions().canCancel) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('event', 'cancelSignup', { eventId: this.eventId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '取消失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
