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
  return { user: { firstPaidAt: now, firstPaidOrderId: order._id, updatedAt: now }, event: {
    _id: 'first_' + user._id, type: 'first_paid', openid: user.openid,
    scene: source.scene || '', buildingId: source.buildingId || order.buildingId,
    communityId: order.communityId, referrerProviderId: source.referrerProviderId || null, at: now } };
}

function paidOrderChanges(order, user, now) {
  if (order.kind !== 'service') return null;
  const count = user.paidOrderCount || 0;
  const next = count + 1;
  return { user: { paidOrderCount: next, updatedAt: now, ...(count === 0 ? { firstPaidOrderId: order._id } : {}) },
    secondEvent: count === 1 ? { _id: 'second_' + user._id, type: 'second_paid', openid: user.openid,
      scene: user.source && user.source.scene || '', buildingId: user.source && user.source.buildingId || order.buildingId,
      communityId: order.communityId, referrerProviderId: user.source && user.source.referrerProviderId || null, at: now } : null };
}

function referralAward(order, user, provider, bonus) {
  integer(bonus, '推荐奖励', 0);
  if (bonus === 0 || order.kind !== 'service' || order.pricing.payAmount <= 0 ||
    !user || user.firstPaidOrderId !== order._id || !user.source || !user.source.referrerProviderId ||
    !provider || provider._id !== user.source.referrerProviderId || provider.communityId !== order.communityId ||
    provider._id === order.providerId) return null;
  return { _id: 'referral_' + order._id, refType: 'order', refId: order._id, communityId: order.communityId,
    providerId: provider._id, amounts: { gross: 0, provider: bonus, property: 0, platform: -bonus, goods: 0 },
    settled: { provider: false, property: false }, settlementIds: { provider: null, property: null } };
}

module.exports = { totalFee, paidPatch, firstPaidChanges, paidOrderChanges, referralAward };
