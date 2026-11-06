const crypto = require('crypto');
const { ensure, integer } = require('./validate');
const { addDays, ymd, hm } = require('./time');
const { addressSnapshot } = require('./orderData');

function membershipKey(communityId, planCode) {
  return crypto.createHash('sha256').update(communityId + ':' + planCode).digest('hex').slice(0, 32);
}
function cardPlan(community, code) {
  const plan = community.cardPlans.find(item => item.code === code);
  ensure(plan && ['trash_monthly', 'express_monthly'].includes(plan.code), '月卡计划不存在');
  ensure(plan.serviceCode === (plan.code === 'trash_monthly' ? 'trash' : 'express'), '月卡服务类型配置不正确', 'E_CONFIG');
  integer(plan.price, '月卡价格', 0, Number.MAX_SAFE_INTEGER, 'E_CONFIG');
  integer(plan.firstPeriodPrice, '首期价格', 0, plan.price, 'E_CONFIG');
  integer(plan.days, '月卡有效天数', 1, 366, 'E_CONFIG');
  if (plan.code === 'express_monthly') integer(plan.dailyParcelQuota, '每日件数', 1, 100, 'E_CONFIG');
  return plan;
}
function renewCard(existing, order, now) {
  const plan = order.planSnapshot;
  if (existing) ensure(existing.userOpenid === order.userOpenid && existing.communityId === order.communityId &&
    existing.planCode === order.planCode, '月卡归属不一致', 'E_CONFIG');
  const active = existing && existing.status === 'active' && existing.endAt > now;
  const slot = plan.serviceCode === 'trash' ? order.detail.slot : null;
  ensure(plan.serviceCode !== 'trash' || ['morning', 'afternoon', 'evening'].includes(slot), '请选择上门时段');
  return { ...(active ? existing : {}), _id: active ? existing._id : 'card_' + order._id,
    userOpenid: order.userOpenid, communityId: order.communityId, planCode: plan.code, serviceCode: plan.serviceCode,
    slot, skipDates: active ? existing.skipDates : [], startAt: active ? existing.startAt : now,
    endAt: addDays(active ? existing.endAt : now, plan.days), status: 'active', purchaseOrderId: order._id,
    createdAt: active ? existing.createdAt : now };
}
function taskDue(card, now, plan) {
  if (plan && plan.schedule) {
    const { dueTasks } = require('./schedule');
    const dueDate = ymd(now);
    return dueTasks(card, plan, dueDate).length > 0 && card.status === 'active' && card.startAt <= now && card.endAt > now &&
      card.lastGeneratedDate !== dueDate && hm(now) >= (card.slot === 'morning' ? '05:30' : card.slot === 'afternoon' ? '10:30' : '15:30');
  }
  return card.status === 'active' && card.serviceCode === 'trash' && card.startAt <= now && card.endAt > now &&
    !card.skipDates.includes(ymd(now)) && card.lastGeneratedDate !== ymd(now) &&
    hm(now) >= (card.slot === 'morning' ? '05:30' : card.slot === 'afternoon' ? '10:30' : '15:30');
}
function purchaseOrder({ id, orderNo, user, community, building, plan, first, slot, now, payMode }) {
  const amount = first ? plan.firstPeriodPrice : plan.price;
  return { _id: id, orderNo, kind: 'membership_purchase', serviceCode: '', planCode: plan.code,
    planSnapshot: { ...plan }, communityId: community._id, buildingId: building._id,
    address: addressSnapshot(user, community, building), userOpenid: user.openid, userId: user._id, userPhone: user.phone,
    minLevel: 1, detail: { slot: plan.serviceCode === 'trash' ? slot : null }, note: '', slot: null,
    pricing: { listPrice: plan.price, discount: plan.price - amount, payAmount: amount, goodsCap: 0, goodsActual: 0, freeByMembership: false },
    status: 'pending_pay', source: 'user', membershipId: null, providerId: null, providerOpenid: null,
    photos: [], rating: null, complaint: null, refunds: [], rateSnapshot: community.rates,
    payment: { outTradeNo: orderNo, transactionId: null, paidAt: null, mode: amount === 0 ? 'free' : payMode },
    timeline: [{ status: 'pending_pay', at: now, by: user.openid }], alertedAt: null, alertPriority: 0,
    acceptedAt: null, deliveredAt: null, completedAt: null, createdAt: now, updatedAt: now };
}

module.exports = { membershipKey, cardPlan, renewCard, taskDue, purchaseOrder };
