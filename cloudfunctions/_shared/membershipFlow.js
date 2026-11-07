const { atomic, read, insert } = require('./transaction');
const { membershipKey, renewCard, visitAddressFor, taskDue, cardPlan } = require('./membershipData');
const { splitMembershipSale } = require('./split');
const { newOrder, transitionPatch } = require('./orderData');
const { membershipTaskId, orderNo } = require('./ids');
const { ymd, nextDutyWindow } = require('./time');
const { ensure } = require('./validate');
const { dueTasks } = require('./schedule');
const { isEnabled } = require('./features');

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
    const cardCommunity = await server.get('communities', card.communityId);
    if (!cardCommunity || !['trash','visit'].includes(card.serviceCode)) return false;
    if (card.serviceCode === 'visit' && !isEnabled('elder', await server.config(), cardCommunity)) return false;
    const plan = cardPlan(cardCommunity, card.planCode);
    if (!taskDue(card, now, plan)) return false;
    const user = await server.one('users', { openid: card.userOpenid });
    ensure(user && (card.serviceCode === 'visit' || user.communityId === card.communityId), '月卡门牌需要住户重新确认', 'E_CONFIG');
    if (card.serviceCode === 'visit') ensure(visitAddressFor(card, now) && visitAddressFor(card, now).buildingId && visitAddressFor(card, now).contactPhone,
      '探访地址资料不完整', 'E_CONFIG');
    return atomic(server.db, async transaction => {
      const current = await read(transaction, 'memberships', card._id);
      if (!current || !taskDue(current, now, plan)) return false;
      const profile = await read(transaction, 'users', user._id);
      const community = await read(transaction, 'communities', current.communityId);
      ensure(!profile.blocked, '住户账号暂不可用', 'E_FORBIDDEN');
      const visit = current.serviceCode === 'visit';
      const visitAddress = visit ? visitAddressFor(current, now) : null;
      const building = await read(transaction, 'buildings', visit ? visitAddress.buildingId : profile.buildingId);
      if (visit) ensure(visitAddress.communityId === current.communityId, '探访地址不属于服务小区', 'E_CONFIG');
      nextDutyWindow(community.dutyWindows, now);
      const due = dueTasks(current, plan, ymd(now))[0];
      const shift = due.slot === 'evening' && community.dutyWindows.length < 3 ? community.dutyWindows.length - 1 :
        { morning: 0, afternoon: 1, evening: 2 }[due.slot];
      const window = community.dutyWindows[shift];
      ensure(window, '月卡上门时段未配置', 'E_CONFIG');
      const date = ymd(now);
      const id = membershipTaskId(current._id, date, current.slot);
      const previous = await read(transaction, 'orders', id);
      if (!previous) {
        const visitPayout = visit ? require('./validate').integer(community.prices.visit && community.prices.visit.taskPayout,
          '探访每次服务员计件费', 0, Number.MAX_SAFE_INTEGER, 'E_CONFIG') : community.prices.membershipTaskPayout;
        const selectedAddress = visit ? { ...visitAddress, id: null } : null;
        const order = newOrder({ id, orderNo: orderNo(now), user: profile, community, building,
          serviceCode: visit ? 'visit' : 'trash', detail: visit ? { membershipId: current._id } : { bags: 1, sorted: true, placement: 'door' },
          note: visit ? '独居探访月卡上门任务' : '垃圾月卡上门任务',
          slot: { date, start: window.start, end: window.end }, now, selectedAddress,
          pricing: { listPrice: visit ? 0 : community.prices.trash.single, discount: visit ? 0 : community.prices.trash.single,
            payAmount: 0, goodsCap: 0, freeByMembership: false } });
        Object.assign(order, transitionPatch(order, 'paid', 'system', now), { source: 'membership', membershipId: current._id,
          rateSnapshot: community.rates, membershipTaskPayout: visitPayout });
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
