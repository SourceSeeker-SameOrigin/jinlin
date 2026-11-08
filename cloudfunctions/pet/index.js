const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { atomic, read } = require('./lib/shared/transaction');
const { requireApprovedProvider } = require('./lib/shared/auth');
const { ensure, text } = require('./lib/shared/validate');
const { transitionPatch } = require('./lib/shared/orderData');
const { createPayFlow } = require('./lib/shared/payFlow');
const { createNotifier } = require('./lib/shared/notify');
const { revealAllowed, cleanVisitResult, revealSecret } = require('./lib/shared/petFlow');
const { ymd } = require('./lib/shared/time');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const payments = createPayFlow(cloud, server);
const notify = createNotifier(cloud, server);
const now = () => new Date();

async function assignedOrder(event, openid) {
  text(event.orderId, '订单');
  const order = await server.get('orders', event.orderId);
  ensure(order && order.serviceCode === 'pet', '喂宠订单不存在');
  const provider = await server.one('providers', { openid });
  requireApprovedProvider(provider, 2);
  ensure(order.providerId === provider._id && order.providerOpenid === openid, '无权操作该订单', 'E_FORBIDDEN');
  await server.feature('pet', order.communityId);
  return { order, provider };
}
async function child(event, order) {
  text(event.visitId, '上门任务');
  const visit = await server.get('visits', event.visitId);
  ensure(visit && visit.parentOrderId === order._id, '上门任务不存在');
  return visit;
}
async function allSettled(transaction, order, currentVisitId) {
  const result = await transaction.collection('visits').where({ parentOrderId: order._id }).get();
  return (result.data || []).filter(item => item._id !== currentVisitId).every(item => item.status !== 'pending');
}
async function moveToDelivered(transaction, order, currentVisitId, actor) {
  if (!await allSettled(transaction, order, currentVisitId)) return false;
  const current = await read(transaction, 'orders', order._id);
  ensure(current && ['accepted','in_service'].includes(current.status), '父订单状态已变化', 'E_CONFLICT');
  await transaction.collection('orders').doc(order._id).update({ data: { ...transitionPatch(current, 'delivered', actor, now()), deliveredAt: now() } });
  return true;
}

async function revealEntry(event, { openid }) {
  const { order, provider } = await assignedOrder(event, openid);
  const visit = await child(event, order);
  revealAllowed(order, visit, provider, openid, now());
  const secret = await server.get('secrets', 's_' + order._id);
  ensure(secret, '门锁信息已删除或未设置');
  const password = revealSecret(secret, process.env.SECRET_KEY);
  await server.db.collection('auditLogs').add({ data: { action: 'pet_entry_reveal', actorOpenid: openid,
    orderId: order._id, visitId: visit._id, at: now() } });
  return { entry: password };
}

async function listVisits(event, { openid, user }) {
  text(event.orderId, '订单');
  const order = await server.get('orders', event.orderId);
  ensure(order && order.serviceCode === 'pet', '喂宠订单不存在');
  const provider = await server.one('providers', { openid });
  const resident = order.userOpenid === openid;
  const assigned = provider && order.providerId === provider._id && order.providerOpenid === openid;
  ensure(resident || assigned || user.roles.includes('admin'), '无权查看上门记录', 'E_FORBIDDEN');
  const result = await server.db.collection('visits').where({ parentOrderId: order._id }).orderBy('date', 'asc').orderBy('seq', 'asc').get();
  const list = result.data.map(item => ({ _id: item._id, date: item.date, seq: item.seq, status: item.status,
    photos: item.photos || [], videoFileId: item.videoFileId || '', doneAt: item.doneAt || null }));
  return { list, status: order.status, entryMode: order.detail.entry };
}

async function markDone(event, { openid }) {
  const { order, provider } = await assignedOrder(event, openid);
  ensure(order.status === 'in_service', '请先开始服务');
  const visit = await child(event, order);
  ensure(visit.status === 'pending', '该次上门已处理', 'E_CONFLICT');
  ensure(visit.date === ymd(now()), '只能在服务日期提交本次上门结果', 'E_FORBIDDEN');
  const { photos, videoFileId } = cleanVisitResult(event, order);
  const result = await atomic(server.db, async transaction => {
    const current = await read(transaction, 'visits', visit._id);
    ensure(current && current.status === 'pending', '该次上门已处理', 'E_CONFLICT');
    await transaction.collection('visits').doc(current._id).update({ data: { status: 'done', photos, videoFileId,
      doneAt: now(), providerId: provider._id } });
    const delivered = await moveToDelivered(transaction, order, current._id, openid);
    return { delivered };
  });
  if (result.delivered) await notify.resident('delivered', { ...order, status: 'delivered' });
  return { visitId: visit._id, status: 'done', parentStatus: result.delivered ? 'delivered' : 'in_service' };
}

async function markMissed(event, { openid }) {
  const { order, provider } = await assignedOrder(event, openid);
  ensure(order.status === 'in_service', '订单未进入服务中');
  const visit = await child(event, order);
  ensure(visit.status === 'pending', '该次上门已处理', 'E_CONFLICT');
  ensure(visit.date === ymd(now()), '只能在服务日期标记本次上门漏次', 'E_FORBIDDEN');
  const reason = text(event.reason || '未完成本次上门服务', '漏次原因', 200).trim();
  const parts = { service: visit.price, goods: 0 };
  const result = await payments.requestRefund(order, visit.price, '喂宠服务漏次退款：' + reason,
    { key: 'pet_visit_' + visit._id, actor: openid, parts,
      afterWrite: async (transaction, currentOrder) => {
        const currentVisit = await read(transaction, 'visits', visit._id);
        ensure(currentVisit && currentVisit.status === 'pending', '该次上门已处理', 'E_CONFLICT');
        await transaction.collection('visits').doc(visit._id).update({ data: { status: 'missed', missedAt: now(), reason, providerId: provider._id } });
        await moveToDelivered(transaction, currentOrder, visit._id, openid);
      } });
  // 退款请求幂等重放时 afterWrite 不执行；补偿确认下子任务状态。
  if (result.refunds.some(item => item.key === 'pet_visit_' + visit._id) && visit.status === 'pending') {
    await atomic(server.db, async transaction => {
      const current = await read(transaction, 'visits', visit._id);
      if (current && current.status === 'pending') {
        await transaction.collection('visits').doc(visit._id).update({ data: { status: 'missed', missedAt: now(), reason, providerId: provider._id } });
        await moveToDelivered(transaction, order, visit._id, openid);
      }
    });
  }
  const refreshedOrder = await server.get('orders', order._id);
  if (refreshedOrder.status === 'delivered') await notify.resident('delivered', refreshedOrder);
  return { visitId: visit._id, status: 'missed', refundStatus: result.refunds.find(item => item.key === 'pet_visit_' + visit._id).status };
}

exports.main = server.entry({ listVisits, revealEntry, markDone, markMissed }, ['resident','admin','provider'], 'pet');
