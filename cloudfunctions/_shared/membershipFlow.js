const { atomic, read, insert } = require('./transaction');
const { membershipKey, renewCard, taskDue } = require('./membershipData');
const { splitMembershipSale } = require('./split');
const { newOrder, transitionPatch } = require('./orderData');
const { membershipTaskId, orderNo } = require('./ids');
const { ymd, nextDutyWindow } = require('./time');
const { ensure } = require('./validate');

async function activateMembership(transaction, order, user, now) {
  const key = membershipKey(order.communityId, order.planCode);
  const refs = user.membershipRefs || {};
  const existing = refs[key] ? await read(transaction, 'memberships', refs[key]) : null;
  const card = renewCard(existing, order, now);
  if (existing && existing._id === card._id) {
    const { _id, ...data } = card;
    await transaction.collection('memberships').doc(_id).set({ data });
  } else await insert(transaction, 'memberships', card);
  await insert(transaction, 'ledger', { _id: 'membership_' + order._id, refType: 'membership_sale', refId: order._id,
    communityId: order.communityId, providerId: null, amounts: { gross: order.pricing.payAmount,
      ...splitMembershipSale(order.pricing.payAmount, order.rateSnapshot) },
    settled: { provider: false, property: false }, settlementIds: { provider: null, property: null }, createdAt: now });
  return { userPatch: { membershipRefs: { ...refs, [key]: card._id } }, orderPatch: { membershipId: card._id } };
}

function createMembershipTasks(server) {
  async function generate(card, now) {
    if (!taskDue(card, now)) return false;
    const user = await server.one('users', { openid: card.userOpenid });
    ensure(user && user.communityId === card.communityId, '月卡门牌需要住户重新确认', 'E_CONFIG');
    return atomic(server.db, async transaction => {
      const current = await read(transaction, 'memberships', card._id);
      if (!current || !taskDue(current, now)) return false;
      const profile = await read(transaction, 'users', user._id);
      const community = await read(transaction, 'communities', current.communityId);
      const building = await read(transaction, 'buildings', profile.buildingId);
      ensure(!profile.blocked, '住户账号暂不可用', 'E_FORBIDDEN');
      nextDutyWindow(community.dutyWindows, now);
      const window = community.dutyWindows[current.slot === 'morning' ? 0 : community.dutyWindows.length - 1];
      ensure(window, '月卡上门时段未配置', 'E_CONFIG');
      const date = ymd(now);
      const id = membershipTaskId(current._id, date, current.slot);
      const previous = await read(transaction, 'orders', id);
      if (!previous) {
        const order = newOrder({ id, orderNo: orderNo(now), user: profile, community, building,
          serviceCode: 'trash', detail: { bags: 1, sorted: true, placement: 'door' }, note: '垃圾月卡上门任务',
          slot: { date, start: window.start, end: window.end }, now,
          pricing: { listPrice: community.prices.trash.single, discount: community.prices.trash.single,
            payAmount: 0, goodsCap: 0, freeByMembership: false } });
        Object.assign(order, transitionPatch(order, 'paid', 'system', now), { source: 'membership', membershipId: current._id,
          rateSnapshot: community.rates, membershipTaskPayout: community.prices.membershipTaskPayout });
        order.payment = { ...order.payment, mode: 'free', paidAt: now, transactionId: 'free_' + id };
        await insert(transaction, 'orders', order);
      }
      await transaction.collection('memberships').doc(current._id).update({ data: { lastGeneratedDate: date, lastTaskId: id } });
      return !previous;
    });
  }
  return { generate };
}
module.exports = { activateMembership, createMembershipTasks };
