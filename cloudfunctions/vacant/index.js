const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { atomic, read } = require('./lib/shared/transaction');
const { ensure, text } = require('./lib/shared/validate');
const { requireApprovedProvider } = require('./lib/shared/auth');
const { transitionPatch } = require('./lib/shared/orderData');
const { cleanReport } = require('./lib/shared/vacant');
const { decryptSecret } = require('./lib/shared/crypto');
const { ymd } = require('./lib/shared/time');
const { createNotifier } = require('./lib/shared/notify');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const notify = createNotifier(cloud, server);
const now = () => new Date();

async function assigned(orderId, openid) {
  const [order, provider] = await Promise.all([server.get('orders', orderId), server.one('providers', { openid })]);
  ensure(order && order.serviceCode === 'vacant', '空置房巡检任务不存在');
  requireApprovedProvider(provider, 2);
  ensure(order.providerId === provider._id && order.providerOpenid === openid, '无权操作此巡检任务', 'E_FORBIDDEN');
  await server.feature('vacantHome', order.communityId);
  return { order, provider };
}

async function revealEntry(event, { openid }) {
  text(event.orderId, '巡检任务');
  const { order } = await assigned(event.orderId, openid);
  ensure(['accepted','in_service'].includes(order.status) && order.slot.date === ymd(now()), '仅限接单服务员在巡检当天查看入户信息', 'E_FORBIDDEN');
  const membership = await server.get('memberships', order.membershipId);
  ensure(membership && membership.status === 'active' && membership.endAt > now(), '巡检月卡已失效', 'E_FORBIDDEN');
  ensure(order.detail.entry === 'password', '该住户使用的不是门锁密码入户');
  const secret = await server.get('secrets', 's_' + order.membershipId);
  ensure(secret, '门锁信息已删除或未设置');
  const entry = decryptSecret(secret, process.env.SECRET_KEY);
  await server.db.collection('auditLogs').add({ data: { action: 'vacant_entry_reveal', actorOpenid: openid,
    orderId: order._id, membershipId: order.membershipId, at: now() } });
  return { entry };
}

async function recordReport(event, { openid }) {
  text(event.orderId, '巡检任务');
  const { order } = await assigned(event.orderId, openid);
  ensure(order.status === 'in_service' && order.slot.date === ymd(now()), '只能在巡检当天提交报告', 'E_BAD_STATE');
  const report = cleanReport(event, order);
  const result = await atomic(server.db, async transaction => {
    const current = await read(transaction, 'orders', order._id);
    ensure(current && current.status === 'in_service' && current.providerOpenid === openid, '巡检任务状态已变化', 'E_CONFLICT');
    const patch = { ...transitionPatch(current, 'delivered', openid, now()), deliveredAt: now(), vacantReport: report };
    await transaction.collection('orders').doc(current._id).update({ data: patch });
    return { ...current, ...patch };
  });
  await notify.vacantReport(result);
  await notify.resident('delivered', result);
  return { orderId: result._id, status: result.status, attention: report.attention };
}

async function subscribeReport(event, { openid }) {
  text(event.orderId, '巡检任务');
  const order = await server.get('orders', event.orderId);
  ensure(order && order.userOpenid === openid && order.serviceCode === 'vacant', '无权操作该巡检任务', 'E_FORBIDDEN');
  await server.feature('vacantHome', order.communityId);
  return atomic(server.db, async transaction => {
    const current = await read(transaction, 'orders', order._id);
    ensure(current && current.userOpenid === openid && ['paid','accepted','in_service'].includes(current.status) && !current.vacantReport,
      '该巡检任务已完成或状态已变化，请在订单详情查看报告', 'E_BAD_STATE');
    if (current.visitReportNotifyAuthorizedAt) return { authorized: true, alreadyAuthorized: true };
    await transaction.collection('orders').doc(current._id).update({ data: { visitReportNotifyAuthorizedAt: now() } });
    return { authorized: true, alreadyAuthorized: false };
  });
}

exports.main = server.entry({ revealEntry, recordReport, subscribeReport }, ['resident','admin','provider']);
