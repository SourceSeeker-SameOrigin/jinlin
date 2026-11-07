const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { createServer } = require('./lib/shared/server');
const { atomic, read, insert, sameSnapshot } = require('./lib/shared/transaction');
const { cardPlan, purchaseOrder } = require('./lib/shared/membershipData');
const { orderNo, membershipTaskId } = require('./lib/shared/ids');
const { ymd } = require('./lib/shared/time');
const { transitionPatch, addressSnapshot } = require('./lib/shared/orderData');
const { ensure, text } = require('./lib/shared/validate');
const { createPayFlow } = require('./lib/shared/payFlow');
const { payConfig } = require('./lib/shared/payConfig');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const payments = createPayFlow(cloud, server);

async function plans(event, { user, openid }) {
  const community = await server.get('communities', user.communityId);
  ensure(community && community.status === 'active', '请先绑定有效小区');
  const history = await server.all('memberships', { userOpenid: openid, communityId: community._id });
  return { list: community.cardPlans.map(item => {
    const plan = cardPlan(community, item.code);
    const first = !history.some(card => card.planCode === plan.code);
    return { ...plan, first, payAmount: first ? plan.firstPeriodPrice : plan.price };
  }), communityId: community._id };
}

async function mine(event, { openid }) {
  const rows = await server.all('memberships', { userOpenid: openid });
  const today = ymd(new Date());
  return { list: rows.sort((a, b) => b.endAt - a.endAt).map(card => ({ _id: card._id, communityId: card.communityId,
    name: card.planCode === 'trash_monthly' ? '垃圾月卡' : '快递月卡', planCode: card.planCode,
    serviceCode: card.serviceCode, slot: card.slot, slotText: { morning: '早班', afternoon: '中班', evening: '晚班' }[card.slot] || '', startAt: card.startAt, endAt: card.endAt,
    status: card.status === 'active' && card.endAt <= new Date() ? 'expired' : card.status,
    skippedToday: card.skipDates.includes(today), purchaseOrderId: card.purchaseOrderId })) };
}

async function buy(event, { user, openid }) {
  text(event.requestId, '请求编号', 80);
  ensure(/^[a-zA-Z0-9_-]{8,80}$/.test(event.requestId), '请求编号不正确');
  const [community, building, config, history] = await Promise.all([
    server.get('communities', user.communityId), server.get('buildings', user.buildingId), server.config(),
    server.all('memberships', { userOpenid: openid, communityId: user.communityId })
  ]);
  addressSnapshot(user, community, building);
  const plan = cardPlan(community, event.planCode);
  ensure(plan.serviceCode !== 'trash' || ['morning', 'afternoon', 'evening'].includes(event.slot), '请选择上门时段');
  ensure(event.slot !== 'afternoon' || (Array.isArray(community.dutyWindows) && community.dutyWindows.length >= 3),
    '中班需要先配置三段上门时段', 'E_CONFIG');
  const first = !history.some(card => card.planCode === plan.code);
  if ((first ? plan.firstPeriodPrice : plan.price) > 0) payConfig(config.payMode);
  const id = 'mp_' + crypto.createHash('sha256').update(openid + ':' + event.requestId).digest('hex').slice(0, 40);
  const order = await atomic(server.db, async transaction => {
    const previous = await read(transaction, 'orders', id);
    if (previous) {
      ensure(previous.userOpenid === openid && previous.planCode === plan.code && previous.communityId === community._id &&
        (plan.serviceCode !== 'trash' || previous.detail.slot === event.slot), '请求编号已用于其他月卡订单', 'E_CONFLICT');
      return previous;
    }
    const currentUser = await read(transaction, 'users', user._id);
    sameSnapshot(currentUser, user, ['orderRevision', 'communityId', 'buildingId', 'unit', 'room', 'phone', 'blocked']);
    const currentCommunity = await read(transaction, 'communities', community._id);
    sameSnapshot(currentCommunity, community, ['status', 'cardPlans', 'rates']);
    const currentBuilding = await read(transaction, 'buildings', building._id);
    sameSnapshot(currentBuilding, building, ['communityId', 'name', 'units']);
    const now = new Date();
    const created = purchaseOrder({ id, orderNo: orderNo(now), user: currentUser, community: currentCommunity,
      building: currentBuilding, plan, first, slot: event.slot, now, payMode: config.payMode });
    await insert(transaction, 'orders', created);
    await transaction.collection('users').doc(user._id).update({ data: { orderRevision: (currentUser.orderRevision || 0) + 1 } });
    return created;
  });
  if (order.pricing.payAmount === 0 && !order.payment.paidAt) {
    await payments.onPaid(order, { mode: 'free', amount: 0, transactionId: 'free_' + id });
    return { orderId: id, free: true };
  }
  try { return await payments.prepare(order); }
  catch (error) { return { orderId: id, paymentError: error.code || 'E_PAYMENT' }; }
}

async function skipToday(event, { openid }) {
  text(event.membershipId, '月卡');
  return atomic(server.db, async transaction => {
    const card = await read(transaction, 'memberships', event.membershipId);
    const now = new Date(), date = ymd(now);
    ensure(card && card.userOpenid === openid && card.serviceCode === 'trash', '无权操作该月卡', 'E_FORBIDDEN');
    ensure(card.status === 'active' && card.startAt <= now && card.endAt > now, '月卡当前无效', 'E_BAD_STATE');
    const id = card.lastGeneratedDate === date ? card.lastTaskId : membershipTaskId(card._id, date, card.slot);
    const task = await read(transaction, 'orders', id);
    if (task) {
      ensure(['paid', 'cancelled'].includes(task.status), '服务员已接单，今天不能再跳过', 'E_BAD_STATE');
      if (task.status === 'paid') await transaction.collection('orders').doc(id).update({ data: transitionPatch(task, 'cancelled', openid, now) });
    }
    await transaction.collection('memberships').doc(card._id).update({ data: { skipDates: [...new Set([...card.skipDates, date])] } });
    return { date, skipped: true };
  });
}
exports.main = server.entry({ plans, buy, mine, skipToday }, ['resident']);
