const reportAction = require('../../utils/report');
const api = require('../../utils/api');
const { pay } = require('../../utils/payment');
const { yuan } = require('../../utils/money');
const { display } = require('../../utils/time');
Page({
  data: { loading: true, busy: false, error: '', item: null },
  onLoad(options) { this.eventId = options.id; },
  onShow() { this.load(); },
  async reportContent(event) {
    if(this.reporting)return;this.reporting=true;
    try { await reportAction.submit('event',this.eventId); }
    catch(error){this.setData({error:error.message||'举报提交失败'});}
    finally{this.reporting=false;}
  },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      await getApp().ensureSession();
      const item = await api.call('event', 'detail', { eventId: this.eventId }, { loading: false, silent: true });
      item.feeText = item.fee ? '¥' + yuan(item.fee) : '免费';
      item.startText = display(item.startAt); item.endText = display(item.endAt); item.deadlineText = display(item.signupDeadline);
      this.setData({ item });
    } catch (error) { this.setData({ error: error.message || '活动加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async signup() {
    if (this.data.busy || !this.data.item || !this.data.item.canSignup && this.data.item.mySignup.status !== 'pending_pay') return;
    this.setData({ busy: true, error: '' });
    try {
      const templates = await api.call('event', 'templates', {}, { loading: false, silent: true });
      if (templates.eventReminder && typeof wx.requestSubscribeMessage === 'function') {
        await new Promise(resolve => wx.requestSubscribeMessage({ tmplIds: [templates.eventReminder], success: resolve, fail: resolve }));
      }
      const result = await api.call('event', 'signup', { eventId: this.eventId });
      if (result.mock) await api.call('order', 'mockPay', { orderId: result.orderId });
      else if (result.payment) await pay(result.payment);
      await this.load();
      wx.showToast({ title: result.status === 'pending_pay' ? (result.duplicate ? '请继续完成支付' : '请完成支付') : '报名成功', icon: 'none' });
    } catch (error) { this.setData({ error: error.message || '报名失败，请重试' }); }
    finally { this.setData({ busy: false }); }
  },
  async cancelSignup() {
    if (this.data.busy) return;
    const modal = await new Promise(resolve => wx.showModal({ title: '取消报名', content: '确认取消本次报名吗？截止前将按规则全额退款。', success: resolve }));
    if (!modal.confirm) return;
    this.setData({ busy: true, error: '' });
    try { await api.call('event', 'cancelSignup', { eventId: this.eventId }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '取消失败' }); }
    finally { this.setData({ busy: false }); }
  }
});
