const crypto = require('crypto');
const { ensure, integer } = require('./validate');
const { addDays, ymd, hm } = require('./time');
const { addressSnapshot } = require('./orderData');

function membershipKey(communityId, planCode) {
  return crypto.createHash('sha256').update(communityId + ':' + planCode).digest('hex').slice(0, 32);
}
function cardPlan(community, code) {
  const rawPlan = community.cardPlans.find(item => item.code === code);
  const plan = rawPlan && rawPlan.code === 'visit_monthly'
    ? { ...rawPlan, schedule: rawPlan.schedule || { type: 'weekly', weekdays: [2, 5] } } : rawPlan;
  ensure(plan && ['trash_monthly', 'express_monthly', 'visit_monthly', 'vacant_monthly'].includes(plan.code), '月卡计划不存在');
  const expectedService = { trash_monthly: 'trash', express_monthly: 'express', visit_monthly: 'visit', vacant_monthly: 'vacant' }[plan.code];
  ensure(plan.serviceCode === expectedService, '月卡服务类型配置不正确', 'E_CONFIG');
  integer(plan.price, '月卡价格', 0, Number.MAX_SAFE_INTEGER, 'E_CONFIG');
  integer(plan.firstPeriodPrice, '首期价格', 0, plan.price, 'E_CONFIG');
  integer(plan.days, '月卡有效天数', 1, 366, 'E_CONFIG');
  if (plan.code === 'express_monthly') integer(plan.dailyParcelQuota, '每日件数', 1, 100, 'E_CONFIG');
  if (plan.code === 'visit_monthly') {
    const schedule = plan.schedule || { type: 'weekly', weekdays: [2, 5] };
    ensure(schedule.type === 'weekly' && Array.isArray(schedule.weekdays) && schedule.weekdays.length > 0 &&
      schedule.weekdays.every(day => Number.isInteger(day) && day >= 1 && day <= 7), '探访排期配置不正确', 'E_CONFIG');
  }
  if (plan.code === 'vacant_monthly') ensure(plan.days === 30 && plan.schedule && plan.schedule.type === 'monthly' &&
    Array.isArray(plan.schedule.days) && plan.schedule.days.includes(1) && plan.schedule.days.includes(15),
  '空置房月卡须有效 30 天并按每月 1 日、15 日排期', 'E_CONFIG');
  return plan;
}
function renewCard(existing, order, now) {
  const plan = order.planSnapshot;
  if (existing) ensure(existing.userOpenid === order.userOpenid && existing.communityId === order.communityId &&
    existing.planCode === order.planCode, '月卡归属不一致', 'E_CONFIG');
  const active = existing && existing.status === 'active' && existing.endAt > now;
  const slot = ['trash', 'visit'].includes(plan.serviceCode) ? order.detail.slot : plan.serviceCode === 'vacant' ? 'morning' : null;
  ensure(!['trash', 'visit'].includes(plan.serviceCode) || ['morning', 'afternoon', 'evening'].includes(slot), '请选择上门时段');
  const selected = plan.serviceCode === 'visit' ? { communityId: order.communityId, buildingId: order.buildingId,
    buildingName: order.address.buildingName, unit: order.address.unit, room: order.address.room,
    contactName: order.address.contactName || '', contactPhone: order.address.contactPhone || order.userPhone } : null;
  const startAt = active ? existing.startAt : now;
  const endAt = addDays(active ? existing.endAt : now, plan.days);
  const visitAddressPeriods = plan.serviceCode !== 'visit' ? undefined : active ? [
    ...(existing.visitAddressPeriods || (existing.visitAddress ? [{ startAt: existing.startAt, endAt: existing.endAt,
      address: existing.visitAddress }] : [])),
    { startAt: existing.endAt, endAt, address: selected }
  ] : [{ startAt, endAt, address: selected }];
  return { ...(active ? existing : {}), _id: active ? existing._id : 'card_' + order._id,
    userOpenid: order.userOpenid, communityId: order.communityId, planCode: plan.code, serviceCode: plan.serviceCode,
    slot, ...(plan.serviceCode === 'vacant' ? { entry: order.detail.entry || (active && existing.entry) || 'key_handover' } : {}),
    skipDates: active ? existing.skipDates : [], startAt, endAt, status: 'active', purchaseOrderId: order._id,
    ...(selected ? { visitAddress: active ? existing.visitAddress || selected : selected, visitAddressPeriods } : {}),
    createdAt: active ? existing.createdAt : now };
}

function visitAddressFor(card, now) {
  const periods = card.visitAddressPeriods || [];
  const period = periods.find(item => item.startAt <= now && item.endAt > now);
  return period ? period.address : card.visitAddress || null;
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
function purchaseOrder({ id, orderNo, user, community, building, plan, first, slot, now, payMode, selectedAddress = null, entry = 'key_handover' }) {
  const amount = first ? plan.firstPeriodPrice : plan.price;
  return { _id: id, orderNo, kind: 'membership_purchase', serviceCode: '', planCode: plan.code,
    planSnapshot: { ...plan }, communityId: community._id, buildingId: building._id,
    address: addressSnapshot(user, community, building, selectedAddress), addressId: selectedAddress && selectedAddress.id || null,
    userOpenid: user.openid, userId: user._id, userPhone: selectedAddress ? selectedAddress.contactPhone : user.phone,
    minLevel: ['visit', 'vacant'].includes(plan.serviceCode) ? 2 : 1,
    detail: { slot: ['trash','visit'].includes(plan.serviceCode) ? slot : null,
      ...(plan.serviceCode === 'vacant' ? { entry } : {}) }, note: '', slot: null,
    pricing: { listPrice: plan.price, discount: plan.price - amount, payAmount: amount, goodsCap: 0, goodsActual: 0, freeByMembership: false },
    status: 'pending_pay', source: 'user', membershipId: null, providerId: null, providerOpenid: null,
    photos: [], rating: null, complaint: null, refunds: [], rateSnapshot: community.rates,
    payment: { outTradeNo: orderNo, transactionId: null, paidAt: null, mode: amount === 0 ? 'free' : payMode },
    timeline: [{ status: 'pending_pay', at: now, by: user.openid }], alertedAt: null, alertPriority: 0,
    acceptedAt: null, deliveredAt: null, completedAt: null, createdAt: now, updatedAt: now };
}

module.exports = { membershipKey, cardPlan, renewCard, visitAddressFor, taskDue, purchaseOrder };
