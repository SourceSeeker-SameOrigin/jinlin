const crypto = require('crypto');
const { atomic, read, insert, sameSnapshot } = require('./transaction');
const { newOrder, transitionPatch, validateSlot } = require('./orderData');
const { totalFee } = require('./paymentState');
const { orderNo } = require('./ids');
const { ensure, text } = require('./validate');
const { ymd } = require('./time');
const { lockOrderDiscounts } = require('./couponFlow');
const { encryptSecret } = require('./crypto');
const { createPetVisits } = require('./petFlow');

function createOrderWriter(server) {
  const { db } = server;
  async function create(event, user, context) {
    text(event.requestId, '请求编号', 80);
    ensure(/^[a-zA-Z0-9_-]{8,80}$/.test(event.requestId), '请求编号不正确');
    const id = 'o_' + crypto.createHash('sha256').update(user.openid + ':' + event.requestId).digest('hex').slice(0, 40);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ serviceCode: event.serviceCode,
      communityId: event.communityId, addressId: event.addressId || null, detail: context.detail, note: context.note,
      slot: context.slot, couponId: context.pricing.couponId || null, pointsToUse: context.pricing.pointsRedeemed || 0,
      secretHash: context.entryPassword ? crypto.createHash('sha256').update(context.entryPassword).digest('hex') : null })).digest('hex');
    let createdNow = false;
    const result = await atomic(db, async transaction => {
      const existing = await read(transaction, 'orders', id);
      if (existing) {
        ensure(existing.userOpenid === user.openid && existing.requestHash === requestHash, '请求编号已用于其他订单', 'E_CONFLICT');
        return existing;
      }
      const currentUser = await read(transaction, 'users', user._id);
      sameSnapshot(currentUser, user, ['orderRevision', 'firstPaidAt', 'communityId', 'buildingId', 'unit', 'room', 'phone', 'blocked', 'addresses', 'pointsBalance']);
      ensure(!currentUser.blocked, '账号暂不可用', 'E_FORBIDDEN');
      const currentCommunity = await read(transaction, 'communities', context.community._id);
      sameSnapshot(currentCommunity, context.community, ['status', 'prices', 'cardPlans', 'dutyWindows', 'rates', 'features', 'requiredCerts']);
      const currentConfig = await read(transaction, 'config', 'global');
      sameSnapshot(currentConfig, context.config, ['features']);
      const currentBuilding = await read(transaction, 'buildings', context.building._id);
      sameSnapshot(currentBuilding, context.building, ['communityId', 'name', 'units']);
      if (context.membership) {
        const card = await read(transaction, 'memberships', context.membership._id);
        sameSnapshot(card, context.membership, ['status', 'startAt', 'endAt', 'planCode', 'userOpenid', 'communityId']);
        ensure(card.endAt > new Date(), '月卡已到期，请重新报价', 'E_CONFLICT');
      }
      const now = new Date();
      ensure(ymd(now) === ymd(context.now), '日期已变化，请重新获取报价', 'E_CONFLICT');
      validateSlot(context.slot, currentCommunity.dutyWindows, context.onDutyCount, now);
      if (event.addressId) {
        const selected = (currentUser.addresses || []).find(item => item.id === event.addressId);
        ensure(selected && context.selectedAddress && selected.communityId === context.selectedAddress.communityId &&
          selected.buildingId === context.selectedAddress.buildingId && selected.room === context.selectedAddress.room &&
          selected.contactPhone === context.selectedAddress.contactPhone, '上门地址已变化，请重新报价', 'E_CONFLICT');
      }
      const order = newOrder({ id, orderNo: orderNo(now), user: currentUser, community: currentCommunity,
        building: currentBuilding, serviceCode: event.serviceCode, detail: context.detail, note: context.note,
        slot: context.slot, pricing: context.pricing, now, selectedAddress: context.selectedAddress, detailAlreadyClean: event.serviceCode === 'pet' });
      if (event.serviceCode === 'pet') {
        order.petVisitPrices = context.pricing.perVisit;
        if (context.entryPassword) await insert(transaction, 'secrets', { _id: 's_' + order._id, orderId: order._id,
          ...encryptSecret(context.entryPassword, process.env.SECRET_KEY), createdAt: now });
      }
      order.userId = user._id;
      order.requestHash = requestHash;
      order.rateSnapshot = currentCommunity.rates;
      order.membershipTaskPayout = currentCommunity.prices.membershipTaskPayout;
      order.payment.mode = totalFee(order) === 0 ? 'free' : context.config.payMode;
      if (order.pricing.freeByMembership) order.membershipId = context.membership._id;
      if (totalFee(order) === 0) {
        Object.assign(order, transitionPatch(order, 'paid', 'system', now));
        order.payment.paidAt = now;
        order.payment.transactionId = 'free_' + id;
      }
      const discountPatch = await lockOrderDiscounts(transaction, order, currentUser, now);
      await insert(transaction, 'orders', order);
      await transaction.collection('users').doc(user._id).update({ data: { orderRevision: (currentUser.orderRevision || 0) + 1,
        ...(context.pricing.pointsRedeemed ? { pointsBalance: discountPatch.pointsBalance } : {}) } });
      if (order.serviceCode === 'pet' && order.status === 'paid') await createPetVisits(transaction, order);
      createdNow = true;
      return order;
    });
    return { ...result, createdNow };
  }

  return { create };
}

module.exports = { createOrderWriter };
