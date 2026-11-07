const { ensure, integer, text } = require('./validate');
const { split } = require('./split');
const { refundTotals } = require('./refundState');
const { commission } = require('./idleData');

const COMPLAINT_REASONS = ['未上门', '物品损坏或丢失', '态度', '其他'];
function complaintAllowed(order, now, hours) {
  integer(hours, '投诉时限', 1, 8760, 'E_CONFIG');
  const delivered = order.deliveredAt instanceof Date ? order.deliveredAt : new Date(order.deliveredAt);
  return ['delivered', 'completed'].includes(order.status) && Number.isFinite(delivered.getTime()) &&
    order.deliveredAt !== null && now >= delivered && now.getTime() < delivered.getTime() + hours * 3600000;
}

function complaint(event, order, now, hours) {
  ensure(complaintAllowed(order, now, hours), '已超过投诉时限或当前状态不支持投诉', 'E_BAD_STATE');
  ensure(COMPLAINT_REASONS.includes(event.reason), '请选择投诉原因');
  const content = event.text || '';
  ensure(typeof content === 'string' && [...content].length <= 500, '投诉说明不能超过 500 字');
  return { reason: event.reason, text: content.trim(), at: now, resolution: null };
}

function rating(event, order, now) {
  ensure(order.status === 'completed' && !order.rating, '只有已完成且未评价的订单可以评价', 'E_BAD_STATE');
  integer(event.score, '评分', 1, 5);
  const content = event.text || '';
  ensure(typeof content === 'string' && [...content].length <= 100, '评价不能超过 100 字');
  return { score: event.score, text: content.trim(), at: now };
}

function accounting(order, { serviceRefund = 0, goodsRefund = 0, providerLiable = false } = {}) {
  integer(serviceRefund, '服务费退款', 0, order.pricing.payAmount);
  integer(goodsRefund, '商品款退款', 0, order.pricing.goodsActual || 0);
  if (order.kind === 'idle_purchase') {
    const gross = integer(order.pricing.payAmount - serviceRefund, '闲置成交净额', 0, order.pricing.payAmount);
    const fee = commission(gross, order.idleSnapshot.commissionRate);
    return { gross, provider: 0, property: 0, platform: fee, goods: 0, seller: gross - fee };
  }
  const amounts = split({ ...order.pricing, refundAmount: serviceRefund, providerLiable,
    goodsActual: (order.pricing.goodsActual || 0) - goodsRefund,
    rates: order.rateSnapshot, source: order.source, membershipTaskPayout: order.membershipTaskPayout });
  return { gross: order.pricing.payAmount - serviceRefund + amounts.goods, ...amounts };
}

function ledgerDelta(target, booked) {
  const result = {};
  const keys = ['gross', 'provider', 'property', 'platform', 'goods'];
  if (target.seller !== undefined || booked && booked.seller !== undefined) keys.push('seller');
  for (const key of keys) {
    const current = target[key] === undefined ? 0 : target[key];
    const previous = booked && booked[key] !== undefined ? booked[key] : 0;
    result[key] = integer(current, '账本金额', -Number.MAX_SAFE_INTEGER) -
      integer(previous, '已记账金额', -Number.MAX_SAFE_INTEGER);
    integer(result[key], '账本差额', -Number.MAX_SAFE_INTEGER);
  }
  return result;
}

function resolutionNote(value) { return text(value, '处理说明', 500).trim(); }
function complaintResolution(event, order, actor, now) {
  ensure(order.status === 'disputed' && order.complaint && !order.complaint.resolution, '投诉已处理或不存在', 'E_CONFLICT');
  const totals = refundTotals(order);
  const service = integer(event.serviceRefundAmount, '服务费退款', 0, order.pricing.payAmount - totals.service);
  const goods = integer(event.goodsRefundAmount, '商品款退款', 0, order.serviceCode === 'buy'
    ? Math.min(order.pricing.goodsCap - totals.goods, (order.pricing.goodsActual || 0) - totals.goodsAfterPurchase) : 0);
  ensure(typeof event.providerLiable === 'boolean', '请选择服务员是否有责');
  return { refundAmount: service + goods, serviceRefundAmount: service, goodsRefundAmount: goods,
    providerLiable: event.providerLiable, note: resolutionNote(event.note), at: now, by: actor };
}
module.exports = { COMPLAINT_REASONS, complaintAllowed, complaint, rating, accounting, ledgerDelta, resolutionNote, complaintResolution };
