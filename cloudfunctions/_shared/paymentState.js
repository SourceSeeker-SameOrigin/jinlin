const { ensure, integer, text } = require('./validate');
const { transitionPatch } = require('./orderData');

function totalFee(order) {
  return integer(order.pricing.payAmount + order.pricing.goodsCap, '支付总金额');
}

function paidPatch(order, payment, now) {
  integer(payment.amount, '支付金额');
  ensure(payment.amount === totalFee(order), '支付金额与订单不一致', 'E_PAYMENT');
  ensure(payment.mode === order.payment.mode, '支付方式与订单不一致', 'E_PAYMENT');
  text(payment.transactionId, '支付流水号', 100);
  if (order.payment.paidAt) {
    ensure(order.payment.transactionId === payment.transactionId, '支付流水与订单不一致', 'E_PAYMENT');
    return null;
  }
  return { ...transitionPatch(order, 'paid', 'system', now),
    payment: { ...order.payment, paidAt: now, transactionId: payment.transactionId } };
}

function firstPaidChanges(order, user, now) {
  if (order.kind !== 'service' || order.pricing.payAmount <= 0 || user.firstPaidAt) return null;
  const source = user.source || {};
  return { user: { firstPaidAt: now, updatedAt: now }, event: {
    _id: 'first_' + user._id, type: 'first_paid', openid: user.openid,
    scene: source.scene || '', buildingId: source.buildingId || order.buildingId,
    communityId: order.communityId, referrerProviderId: source.referrerProviderId || null, at: now } };
}

module.exports = { totalFee, paidPatch, firstPaidChanges };
