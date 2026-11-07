const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { yuan } = require('../../utils/money');
Page({
  data: { loading: true, busy: false, error: '', list: [], quoteId: '', quoteAmount: '', quoteDetail: '' },
  onShow() { this.load(); },
  async load() { this.setData({ loading: true, error: '' }); try {
    const result = await api.call('merchant', 'merchantOrders', {}, { loading: false, silent: true });
    this.setData({ list: (result.list || []).map(item => ({ ...item, amountText: yuan(item.pricing.payAmount), quoteAmountText: item.quote ? yuan(item.quote.amount) : '' })) });
  } catch (error) { this.setData({ error: error.message || '订单加载失败' }); } finally { this.setData({ loading: false }); } },
  chooseQuote(event) { this.setData({ quoteId: event.currentTarget.dataset.id, quoteAmount: '', quoteDetail: '' }); },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  async quote() { if (this.data.busy || !this.data.quoteId) return; this.setData({ busy: true, error: '' }); try {
    const amount = Math.round(Number(this.data.quoteAmount) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('请填写大于 0 的报价金额');
    await api.call('merchant', 'quoteBooking', { orderId: this.data.quoteId, amount, detail: this.data.quoteDetail });
    this.setData({ quoteId: '' }); await this.load();
  } catch (error) { this.setData({ error: error.message || '报价失败' }); } finally { this.setData({ busy: false }); } },
  async transition(event) { const actionName = event.currentTarget.dataset.action; const orderId = event.currentTarget.dataset.id;
    this.setData({ busy: true, error: '' }); try { await api.call('merchant', 'merchantTransition', { orderId, actionName }); await this.load(); }
    catch (error) { this.setData({ error: error.message || '操作失败' }); } finally { this.setData({ busy: false }); } },
  async complete(event) { const orderId = event.currentTarget.dataset.id; this.setData({ busy: true, error: '' }); try {
    const photos = await uploadPhotos('merchant-orders/' + orderId, 3);
    await api.call('merchant', 'completeBooking', { orderId, photos }); await this.load();
  } catch (error) { this.setData({ error: error.message || '提交完成凭证失败' }); } finally { this.setData({ busy: false }); } }
});
