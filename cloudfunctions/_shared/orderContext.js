const { quote } = require('./pricing');
const { cleanNote, cleanDetail, addressSnapshot, availableSlots, validateSlot } = require('./orderData');
const { ymd, parseDate, addDays } = require('./time');
const { ensure, integer } = require('./validate');
const { isEnabled } = require('./features');
const { validCoupon, couponDiscount } = require('./couponData');

function createOrderContext(server) {
  const { db, command, get } = server;
  return async function orderContext(event, user, { metadata = false } = {}) {
    const now = new Date();
    const selectedAddress = event.addressId ? (user.addresses || []).find(item => item.id === event.addressId) : null;
    ensure(!event.addressId || selectedAddress, '请选择已保存的上门地址');
    const communityId = selectedAddress ? selectedAddress.communityId : user.communityId;
    const buildingId = selectedAddress ? selectedAddress.buildingId : user.buildingId;
    ensure(event.communityId === communityId, '请选择已保存地址所属的小区');
    const [community, building, config] = await Promise.all([
      get('communities', communityId), get('buildings', buildingId), server.config()
    ]);
    const address = addressSnapshot(user, community, building, selectedAddress);
    const couponsEnabled = isEnabled('coupons', config, community);
    const pointsEnabled = isEnabled('points', config, community);
    ensure(couponsEnabled || !event.couponId, '优惠券暂未开放', 'E_FEATURE_OFF');
    ensure(pointsEnabled || !event.pointsToUse, '环保积分暂未开放', 'E_FEATURE_OFF');
    const [duty, memberships] = await Promise.all([
      db.collection('providers').where({ communityId: community._id, status: 'approved', onDuty: true,
        insuranceUntil: command.gt(now) }).count(),
      server.all('memberships', { userOpenid: user.openid, communityId: community._id, status: 'active',
        startAt: command.lte(now), endAt: command.gt(now) })
    ]);
    const membership = memberships.find(item => item.planCode === 'express_monthly');
    let membershipState = null;
    let todayUsedParcels = 0;
    if (membership && event.serviceCode === 'express') {
      const plan = community.cardPlans.find(item => item.code === 'express_monthly');
      ensure(plan, '快递月卡配置缺失', 'E_CONFIG');
      membershipState = { active: true, dailyParcelQuota: plan.dailyParcelQuota };
      const start = parseDate(ymd(now));
      const usedOrders = await server.all('orders', { userOpenid: user.openid, communityId: community._id,
        'pricing.freeByMembership': true, createdAt: command.gte(start).and(command.lt(addDays(start, 1))) });
      todayUsedParcels = usedOrders.reduce((sum, order) => sum + order.detail.pickupCodes.length, 0);
    }
    const slots = availableSlots(community.dutyWindows, now);
    const common = { now, community, building, config, address, onDutyCount: duty.total, slots,
      hasTrashMembership: memberships.some(item => item.planCode === 'trash_monthly'),
      membership, membershipState, todayUsedParcels };
    let coupons = [];
    if (couponsEnabled) {
      const [owned, templates] = await Promise.all([
        db.collection('coupons').where({ openid: user.openid, status: 'unused' }).orderBy('validTo', 'asc').limit(100).get(),
        server.all('couponTemplates', { status: 'active' })
      ]);
      const byId = new Map(templates.map(item => [item._id, item]));
      coupons = owned.data.filter(coupon => validCoupon(coupon, byId.get(coupon.templateId), now))
        .map(coupon => ({ couponId: coupon._id, coupon, template: byId.get(coupon.templateId) }));
    }
    const pointsBalance = integer(user.pointsBalance || 0, '积分余额');
    try {
      const pricing = quote({ ...event, prices: community.prices, user, membershipState, todayUsedParcels,
        communityId: community._id, coupons, pointsBalance, pointsEnabled });
      const detail = cleanDetail(event.serviceCode, event.detail, community);
      const note = cleanNote(event.note);
      const slot = event.slot === undefined && metadata ? (duty.total > 0 ? null : slots[0]) : event.slot;
      validateSlot(slot, community.dutyWindows, duty.total, now);
      const couponOptions = coupons.map(item => ({ couponId: item.couponId, name: item.template.name,
        discount: couponDiscount(item.template, { serviceCode: event.serviceCode, communityId: community._id,
          listPrice: pricing.listPrice }), threshold: item.template.threshold, validTo: item.coupon.validTo }))
        .filter(item => item.discount > 0);
      return { ...common, pricing, detail, note, slot, selectedAddress, couponOptions, pointsBalance,
        couponsEnabled, pointsEnabled };
    } catch (error) {
      if (!metadata || error.code !== 'E_INVALID_PARAM') throw error;
      return { ...common, pricing: null, validationMessage: error.message };
    }
  };
}

module.exports = { createOrderContext };
