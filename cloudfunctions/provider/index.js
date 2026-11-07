const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { createServer } = require('./lib/shared/server');
const { atomic, read, insert } = require('./lib/shared/transaction');
const { application, canWork, canTake, delivery, providerView, hallView } = require('./lib/shared/providerData');
const { requireApprovedProvider } = require('./lib/shared/auth');
const { transitionPatch, listView } = require('./lib/shared/orderData');
const { ensure, integer, text } = require('./lib/shared/validate');
const { shortCode } = require('./lib/shared/ids');
const { ymd, parseDate, addDays } = require('./lib/shared/time');
const { createPayFlow } = require('./lib/shared/payFlow');
const { conditionalTransition } = require('./lib/shared/orderStore');
const { publicTemplates } = require('./lib/shared/notificationData');
const { createNotifier } = require('./lib/shared/notify');
const { ensureOrderConversation } = require('./lib/shared/chatFlow');
const { orderConversationId } = require('./lib/shared/chatData');
const { isEnabled } = require('./lib/shared/features');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const { db, command } = server;
const payments = createPayFlow(cloud, server);
const notify = createNotifier(cloud, server);
const mine = openid => server.one('providers', { openid });
const offset = event => integer(event.offset === undefined ? 0 : event.offset, '分页位置', 0, 100000);

async function apply(event, { user, openid }) {
  const community = await server.get('communities', event.communityId);
  const fields = application(event, user, community);
  const id = 'p_' + crypto.createHash('sha256').update(openid).digest('hex').slice(0, 32);
  const provider = await atomic(db, async transaction => {
    const previous = await read(transaction, 'providers', id);
    ensure(!previous || previous.status === 'rejected', '已提交申请，请查看审核状态', 'E_BAD_STATE');
    ensure(!previous || !previous.kycFileIds.length, '上次审核材料正在清理，请联系管理员', 'E_BAD_STATE');
    const now = new Date();
    const data = { ...(previous || {}), ...fields, _id: id, openid, userId: user._id, level: 1,
      status: 'pending', insuranceUntil: null, onDuty: false, dutySince: null,
      referralCode: previous ? previous.referralCode : shortCode(), certs: previous ? previous.certs || [] : [], stats: previous ? previous.stats :
        { completed: 0, released: 0, ratingSum: 0, ratingCount: 0 }, reviewNote: '', createdAt: previous ? previous.createdAt : now, updatedAt: now };
    if (previous) { const { _id, ...update } = data; await transaction.collection('providers').doc(id).set({ data: update }); }
    else await insert(transaction, 'providers', data);
    return data;
  });
  return providerView(provider);
}

async function myStatus(event, { openid }) {
  const provider = await mine(openid);
  if (!provider) return { provider: null, todayCount: 0, todayIncome: 0 };
  const start = parseDate(ymd(new Date()));
  const [done, ledger] = await Promise.all([
    db.collection('orders').where({ providerId: provider._id, completedAt: command.gte(start).and(command.lt(addDays(start, 1))) }).count(),
    server.all('ledger', { providerId: provider._id, createdAt: command.gte(start).and(command.lt(addDays(start, 1))) })
  ]);
  const config = await server.config();
  return { provider: providerView(provider), templateIds: publicTemplates(config), todayCount: done.total,
    todayIncome: ledger.reduce((sum, row) => sum + row.amounts.provider + row.amounts.goods, 0) };
}

async function setDuty(event, { openid }) {
  ensure(typeof event.on === 'boolean', '值班状态不正确');
  const provider = await mine(openid);
  requireApprovedProvider(provider, 1);
  if (event.on) canWork(provider, new Date());
  const result = await db.collection('providers').where({ _id: provider._id, status: 'approved',
    ...(event.on ? { insuranceUntil: command.gt(new Date()) } : {}) }).update({ data: {
    onDuty: event.on, dutySince: event.on ? new Date() : null, updatedAt: new Date() } });
  ensure(result.stats.updated === 1, '服务员状态已变化，请刷新', 'E_CONFLICT');
  return { onDuty: event.on };
}

async function subscriptionTemplates(event, { user }) {
  const provider = await mine(user.openid);
  requireApprovedProvider(provider, 1);
  return publicTemplates(await server.config());
}

async function referralPoster(event, { openid }) {
  const provider = await mine(openid);
  requireApprovedProvider(provider, 1);
  const response = await cloud.openapi.wxacode.getUnlimited({ scene: 'r=' + provider.referralCode,
    page: 'pages/index/index', checkPath: false, envVersion: 'develop', width: 430 });
  ensure(response && response.buffer, '推荐码生成失败', 'E_INTERNAL');
  const file = await cloud.uploadFile({ cloudPath: 'posters/providers/' + provider._id + '.png', fileContent: response.buffer });
  await db.collection('providers').doc(provider._id).update({ data: { referralPosterFileId: file.fileID, updatedAt: new Date() } });
  const result = await cloud.getTempFileURL({ fileList: [file.fileID] });
  return { fileId: file.fileID, tempFileURL: result.fileList[0].tempFileURL, referralCode: provider.referralCode };
}

async function hall(event, { openid }) {
  const provider = await mine(openid);
  canWork(provider, new Date(), 1, true);
  const result = await db.collection('orders').where({ kind: 'service', communityId: provider.communityId,
    status: 'paid', minLevel: command.lte(provider.level), releasedProviderIds: command.nin([provider._id]) })
    .orderBy('createdAt', 'asc').skip(offset(event)).limit(20).get();
  return { list: result.data.filter(order => !order.requiredCert || (provider.certs || []).includes(order.requiredCert)).map(hallView), hasMore: result.data.length === 20 };
}

async function assigned(event, openid) {
  text(event.orderId, '订单');
  const [provider, order] = await Promise.all([mine(openid), server.get('orders', event.orderId)]);
  requireApprovedProvider(provider, 1);
  ensure(order && order.providerId === provider._id && order.providerOpenid === openid, '无权操作该任务', 'E_FORBIDDEN');
  return { provider, order };
}

async function accept(event, { openid }) {
  text(event.orderId, '订单');
  const [provider, order] = await Promise.all([mine(openid), server.get('orders', event.orderId)]);
  ensure(order, '订单不存在');
  canTake(order, provider, new Date());
  const now = new Date();
  const result = await conditionalTransition(server, order, 'accepted', openid,
    { providerId: provider._id, providerOpenid: openid, acceptedAt: now },
    { releasedProviderIds: command.nin([provider._id]) }, '手慢了，单已被接走');
  try {
    await server.feature('chat', order.communityId);
    await ensureOrderConversation(server, { ...order, status: 'accepted', providerOpenid: openid });
  } catch (error) { if (error.code !== 'E_FEATURE_OFF') console.error('订单会话创建待重试', order._id, error.code || 'E_INTERNAL'); }
  return result;
}

async function release(event, { openid }) {
  const { provider, order } = await assigned(event, openid);
  await atomic(db, async transaction => {
    const current = await read(transaction, 'orders', order._id);
    ensure(current.status === 'accepted' && current.providerId === provider._id, '任务状态已变化，无法放弃', 'E_CONFLICT');
    const worker = await read(transaction, 'providers', provider._id);
    const [config, community] = await Promise.all([read(transaction, 'config', 'global'),
      read(transaction, 'communities', current.communityId)]);
    const conversation = isEnabled('chat', config, community)
      ? await read(transaction, 'conversations', orderConversationId(current._id, openid)) : null;
    await transaction.collection('orders').doc(order._id).update({ data: {
      ...transitionPatch(current, 'paid', openid, new Date()), providerId: null, providerOpenid: null, acceptedAt: null,
      releasedProviderIds: [...new Set([...(current.releasedProviderIds || []), provider._id])] } });
    if (conversation && !conversation.closedAt) await transaction.collection('conversations').doc(conversation._id)
      .update({ data: { closedAt: new Date(), updatedAt: new Date() } });
    await transaction.collection('providers').doc(provider._id).update({ data: { 'stats.released': (worker.stats.released || 0) + 1 } });
  });
  return { orderId: order._id, status: 'paid' };
}

async function start(event, { openid }) {
  const { provider, order } = await assigned(event, openid);
  canWork(provider, new Date(), order.minLevel);
  ensure(order.status === 'accepted', '请先接单后再开始服务', 'E_BAD_STATE');
  return conditionalTransition(server, order, 'in_service', openid, {}, { providerId: provider._id });
}

async function deliver(event, { openid }) {
  const { order, provider } = await assigned(event, openid);
  if (order.status === 'delivered') return { orderId: order._id, status: order.status };
  ensure(order.status === 'in_service', '请先开始服务，再提交完成', 'E_BAD_STATE');
  const patch = { ...delivery(event, order), deliveredAt: new Date() };
  const refund = order.serviceCode === 'buy' ? order.pricing.goodsCap - patch.pricing.goodsActual : 0;
  if (refund > 0) await payments.requestRefund(order, refund, '代买商品退差额', { key: 'goods_difference',
    to: 'delivered', actor: openid, patch });
  else {
    await conditionalTransition(server, order, 'delivered', openid, patch, { providerId: provider._id });
  }
  await notify.resident('delivered', { ...order, ...patch, status: 'delivered', deliveredAt: patch.deliveredAt });
  return { orderId: order._id, status: 'delivered' };
}

async function myTasks(event, { openid }) {
  const provider = await mine(openid);
  requireApprovedProvider(provider, 1);
  const result = await db.collection('orders').where({ providerId: provider._id,
    status: command.in(['accepted', 'in_service', 'delivered']) }).orderBy('createdAt', 'desc').skip(offset(event)).limit(20).get();
  return { list: result.data.map(listView), hasMore: result.data.length === 20 };
}

async function earnings(event, { openid }) {
  const provider = await mine(openid);
  requireApprovedProvider(provider, 1);
  const ledger = await server.all('ledger', { providerId: provider._id });
  const totals = ledger.reduce((sum, row) => {
    sum[row.settled.provider ? 'settled' : 'pending'] += row.amounts.provider + row.amounts.goods;
    return sum;
  }, { pending: 0, settled: 0 });
  const rows = ledger.sort((a, b) => b.createdAt - a.createdAt).slice(offset(event), offset(event) + 20);
  return { ...totals, list: rows.map(row => ({ _id: row._id, refId: row.refId, amount: row.amounts.provider + row.amounts.goods,
    settled: row.settled.provider, createdAt: row.createdAt })), hasMore: offset(event) + rows.length < ledger.length };
}

exports.main = server.entry({ apply, myStatus, subscriptionTemplates, referralPoster, setDuty, hall, accept, release, start, deliver, myTasks, earnings }, ['resident', 'admin']);
