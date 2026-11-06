const crypto = require('crypto');
const { atomic, read, insert } = require('./transaction');
const { ensure, integer } = require('./validate');
const { couponId, couponDiscount } = require('./couponData');
const { addDays } = require('./time');

function communityMatches(template, communityId) {
  return template.communityIds === 'all' || template.communityIds.includes(communityId);
}

async function issueOne(server, { openid, templateId, mode, communityId, deterministic = false }) {
  const suffix = deterministic ? mode : crypto.randomBytes(16).toString('hex');
  const id = couponId(openid, templateId, suffix);
  const actor = await server.one('users', { openid });
  ensure(actor, '用户不存在');
  return atomic(server.db, async transaction => {
    const existing = await read(transaction, 'coupons', id);
    if (existing) return { couponId: id, duplicate: true };
    const [user, template] = await Promise.all([read(transaction, 'users', actor._id), read(transaction, 'couponTemplates', templateId)]);
    ensure(user && template, '用户或优惠券模板不存在');
    ensure(template.status === 'active' && (mode === 'manual' || template.issueMode === mode), '该模板当前不可发放');
    ensure(communityMatches(template, communityId), '该优惠券不适用于所选小区');
    const issued = integer(template.issued || 0, '已发放数量', 0, template.totalLimit);
    ensure(issued < template.totalLimit, '该优惠券已领完');
    const counts = user.couponCounts || {};
    const count = integer(counts[templateId] || 0, '个人领取数量');
    ensure(count < template.perUserLimit, '已达到每人领取上限');
    const now = new Date();
    const coupon = { _id: id, templateId, openid, status: 'unused', validFrom: now,
      validTo: addDays(now, template.validDays), orderId: null, createdAt: now };
    await insert(transaction, 'coupons', coupon);
    await transaction.collection('couponTemplates').doc(templateId).update({ data: { issued: issued + 1, updatedAt: now } });
    await transaction.collection('users').doc(user._id).update({ data: { couponCounts: { ...counts, [templateId]: count + 1 } } });
    return { couponId: id, duplicate: false };
  });
}

async function issueAutomatic(server, openid, communityId) {
  const templates = await server.all('couponTemplates', { issueMode: 'auto_new_user', status: 'active' });
  const results = [];
  for (const template of templates) if (communityMatches(template, communityId || '')) {
    try { results.push(await issueOne(server, { openid, templateId: template._id, mode: 'auto_new_user',
      communityId: communityId || '', deterministic: true })); }
    catch (error) { if (error.code !== 'E_INVALID_PARAM') throw error; }
  }
  return results;
}

async function lockOrderDiscounts(transaction, order, user, now) {
  const couponIdValue = order.pricing.couponId;
  if (couponIdValue) {
    const coupon = await read(transaction, 'coupons', couponIdValue);
    ensure(coupon && coupon.openid === user.openid && coupon.status === 'unused' &&
      coupon.validFrom <= now && coupon.validTo > now, '优惠券已被使用或过期，请重新报价', 'E_CONFLICT');
    const template = await read(transaction, 'couponTemplates', coupon.templateId);
    const actualDiscount = Math.min(couponDiscount(template, { serviceCode: order.serviceCode,
      communityId: order.communityId, listPrice: order.pricing.listPrice }), Math.max(0, order.pricing.listPrice - 1));
    ensure(actualDiscount === order.pricing.couponDiscount, '优惠券规则已变化，请重新报价', 'E_CONFLICT');
    await transaction.collection('coupons').doc(coupon._id).update({ data: { status: 'locked', orderId: order._id } });
  }
  const points = integer(order.pricing.pointsRedeemed || 0, '抵扣积分');
  if (points) {
    ensure(integer(user.pointsBalance || 0, '积分余额') >= points, '积分余额已变化，请重新报价', 'E_CONFLICT');
    const ledgerId = 'points_redeem_' + order._id;
    ensure(!await read(transaction, 'pointsLedger', ledgerId), '积分抵扣记录已存在', 'E_CONFLICT');
    await insert(transaction, 'pointsLedger', { _id: ledgerId, openid: user.openid, delta: -points,
      reason: 'redeem', refId: order._id, balanceAfter: user.pointsBalance - points, createdAt: now });
  }
  return { pointsBalance: (user.pointsBalance || 0) - points };
}

async function markCouponUsed(transaction, order, now) {
  if (!order.pricing.couponId) return;
  const coupon = await read(transaction, 'coupons', order.pricing.couponId);
  ensure(coupon && coupon.status === 'locked' && coupon.orderId === order._id, '优惠券锁定状态不一致', 'E_CONFLICT');
  await transaction.collection('coupons').doc(coupon._id).update({ data: { status: 'used', usedAt: now } });
}

async function releaseOrderDiscounts(transaction, order, user, now) {
  await releaseCoupon(transaction, order, now);
  const points = integer(order.pricing.pointsRedeemed || 0, '抵扣积分');
  if (!points) return user.pointsBalance || 0;
  const ledgerId = 'points_restore_' + order._id;
  if (await read(transaction, 'pointsLedger', ledgerId)) return user.pointsBalance || 0;
  const nextBalance = (user.pointsBalance || 0) + points;
  await insert(transaction, 'pointsLedger', { _id: ledgerId, openid: user.openid, delta: points,
    reason: 'refund', refId: order._id, balanceAfter: nextBalance, createdAt: now });
  await transaction.collection('users').doc(user._id).update({ data: { pointsBalance: nextBalance } });
  return nextBalance;
}

async function finalizeRefundDiscounts(transaction, order, refunds, now) {
  const serviceRefunded = refunds.filter(item => item.status === 'success')
    .reduce((sum, item) => sum + (item.serviceAmount === undefined ? item.amount : item.serviceAmount), 0);
  const goodsRefunded = refunds.filter(item => item.status === 'success')
    .reduce((sum, item) => sum + (item.goodsAmount || 0), 0);
  if (serviceRefunded < order.pricing.payAmount || goodsRefunded < order.pricing.goodsCap) return false;
  if (order.pricing.couponId) {
    const coupon = await read(transaction, 'coupons', order.pricing.couponId);
    if (coupon && coupon.status === 'used' && coupon.orderId === order._id) {
      await transaction.collection('coupons').doc(coupon._id).update({ data: {
        status: coupon.validTo > now ? 'unused' : 'expired', orderId: null
      } });
    }
  }
  return true;
}

async function releaseCoupon(transaction, order, now) {
  if (!order.pricing.couponId) return;
  const coupon = await read(transaction, 'coupons', order.pricing.couponId);
  if (!coupon || coupon.status !== 'locked' || coupon.orderId !== order._id) return;
  await transaction.collection('coupons').doc(coupon._id).update({ data: {
    status: coupon.validTo > now ? 'unused' : 'expired', orderId: null
  } });
}

module.exports = { communityMatches, issueOne, issueAutomatic, lockOrderDiscounts, markCouponUsed,
  releaseCoupon, releaseOrderDiscounts, finalizeRefundDiscounts };
