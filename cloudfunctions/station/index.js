const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { requireRole, requireApprovedProvider } = require('./lib/shared/auth');
const { ensure, integer, text } = require('./lib/shared/validate');
const { atomic, read, insert } = require('./lib/shared/transaction');
const { canWork } = require('./lib/shared/providerData');
const { parseAddressLines, deliveryItem, batchStatus, deliveredCount, billing, statement, statementCsv } = require('./lib/shared/station');
const { period } = require('./lib/shared/settlementData');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const { command, db } = server;

async function setDoorDelivery(event, { user }) {
  requireRole(user, ['resident']);
  ensure(typeof event.enabled === 'boolean', '默认送上门设置不正确');
  text(user.communityId, '小区');
  const community = await server.feature('stationDelivery', user.communityId);
  ensure(community.community && community.community.status === 'active', '小区暂不可用');
  const now = new Date();
  return atomic(server.db, async transaction => {
    const current = await read(transaction, 'users', user._id);
    ensure(current && current.openid === user.openid && current.communityId === user.communityId && !current.blocked,
      '账号状态已变化，请重新登录', 'E_CONFLICT');
    await transaction.collection('users').doc(current._id).update({ data: {
      'prefs.doorDelivery': event.enabled, updatedAt: now
    } });
    return { doorDelivery: event.enabled };
  });
}

async function stationContext(user) {
  requireRole(user, ['station']);
  text(user.communityId, '小区');
  text(user.stationCode, '驿站');
  const { community } = await server.feature('stationDelivery', user.communityId);
  ensure(community && community.status === 'active' &&
    Array.isArray(community.stations) && community.stations.some(item => item.code === user.stationCode),
  '驿站账号尚未绑定有效小区', 'E_FORBIDDEN');
  return { community, stationCode: user.stationCode };
}

async function listMyBatches(event, { user }) {
  const { community, stationCode } = await stationContext(user);
  const offset = integer(event.offset === undefined ? 0 : event.offset, '分页位置', 0, 100000);
  const rows = await db.collection('deliveryBatches').where({ communityId: community._id, stationCode })
    .orderBy('createdAt', 'desc').skip(offset).limit(20).get();
  return { list: rows.data.map(batch => {
    const items = Array.isArray(batch.items) ? batch.items : [];
    return { _id: batch._id, status: batch.status, createdAt: batch.createdAt, itemCount: items.length,
    deliveredCount: items.filter(item => item.status === 'delivered').length,
    failedCount: items.filter(item => item.status === 'failed').length,
    providerId: batch.providerId || null };
  }), hasMore: rows.data.length === 20 };
}

async function exportStatement(event, { user }) {
  const { community, stationCode } = await stationContext(user);
  const range = period(event);
  const rows = await server.all('deliveryBatches', { communityId: community._id, stationCode, status: 'done',
    completedAt: command.gte(range.from).and(command.lt(range.to)) });
  const result = statement(rows, range.from, range.to);
  const file = await cloud.uploadFile({ cloudPath: `exports/station/${stationCode}/${Date.now()}.csv`,
    fileContent: Buffer.from(statementCsv(result), 'utf8') });
  const urls = await cloud.getTempFileURL({ fileList: [file.fileID] });
  ensure(urls.fileList && urls.fileList[0] && urls.fileList[0].tempFileURL, '对账文件生成失败', 'E_INTERNAL');
  return { fileId: file.fileID, tempFileURL: urls.fileList[0].tempFileURL, count: result.rows.length,
    gross: result.gross, provider: result.provider };
}

async function providerFor(openid) {
  const provider = await server.one('providers', { openid });
  requireApprovedProvider(provider, 1);
  return provider;
}

function providerBatchView(batch) {
  const items = (batch.items || []).filter(item => item.consented === true);
  const prices = batch.priceSnapshot || {};
  return { _id: batch._id, stationCode: batch.stationCode, status: batch.status, createdAt: batch.createdAt,
    itemCount: items.length, pendingCount: items.filter(item => item.status === 'pending').length, deliveredCount: deliveredCount(items),
    estimatedIncome: billing(items.filter(item => item.status === 'pending').length, prices).provider };
}

async function providerHall(event, { openid }) {
  const provider = await providerFor(openid);
  canWork(provider, new Date(), 1, true);
  await server.feature('stationDelivery', provider.communityId);
  const offset = integer(event.offset === undefined ? 0 : event.offset, '分页位置', 0, 100000);
  const rows = await db.collection('deliveryBatches').where({ communityId: provider.communityId, status: 'open' })
    .orderBy('createdAt', 'asc').skip(offset).limit(20).get();
  return { list: rows.data.map(providerBatchView).filter(row => row.itemCount > 0), hasMore: rows.data.length === 20 };
}

async function acceptBatch(event, { openid }) {
  text(event.batchId, '驿站批次');
  const [provider, batch] = await Promise.all([providerFor(openid), server.get('deliveryBatches', event.batchId)]);
  ensure(batch && batch.communityId === provider.communityId, '批次不存在或不属于当前小区', 'E_FORBIDDEN');
  canWork(provider, new Date(), 1, true);
  await server.feature('stationDelivery', batch.communityId);
  return atomic(db, async transaction => {
    const current = await read(transaction, 'deliveryBatches', batch._id);
    ensure(current && current.status === 'open', '批次已被其他服务员接走', 'E_CONFLICT');
    const eligible = (current.items || []).filter(item => item.consented === true && item.status === 'pending');
    ensure(eligible.length > 0, '批次没有可配送的住户');
    const now = new Date();
    await transaction.collection('deliveryBatches').doc(current._id).update({ data: {
      status: 'assigned', providerId: provider._id, providerOpenid: openid, acceptedAt: now, updatedAt: now
    } });
    return { batchId: current._id, status: 'assigned' };
  });
}

async function assignedBatch(batchId, openid) {
  text(batchId, '驿站批次');
  const [provider, batch] = await Promise.all([providerFor(openid), server.get('deliveryBatches', batchId)]);
  ensure(batch && batch.providerId === provider._id && batch.providerOpenid === openid &&
    batch.communityId === provider.communityId, '无权操作该驿站批次', 'E_FORBIDDEN');
  await server.feature('stationDelivery', batch.communityId);
  return { provider, batch };
}

async function providerBatch(event, { openid }) {
  const { batch } = await assignedBatch(event.batchId, openid);
  return { ...providerBatchView(batch), startedAt: batch.startedAt || null,
    items: (batch.items || []).filter(item => item.consented === true).map(({ _id, buildingName, unit, room, status, photoFileId, at, failReason }) =>
      ({ _id, buildingName, unit, room, status, photoFileId: photoFileId || null, at: at || null, failReason: failReason || '' })) };
}

async function startBatch(event, { openid }) {
  const { provider, batch } = await assignedBatch(event.batchId, openid);
  canWork(provider, new Date(), 1);
  ensure(batch.status === 'assigned', '该批次当前不能开始服务', 'E_BAD_STATE');
  if (batch.startedAt) return { batchId: batch._id, status: batch.status, startedAt: batch.startedAt };
  const now = new Date();
  const result = await atomic(db, async transaction => {
    const current = await read(transaction, 'deliveryBatches', batch._id);
    ensure(current && current.status === 'assigned' && current.providerId === provider._id &&
      current.providerOpenid === openid, '批次状态已变化，请刷新后重试', 'E_CONFLICT');
    if (current.startedAt) return { startedAt: current.startedAt };
    await transaction.collection('deliveryBatches').doc(current._id).update({ data: { startedAt: now, updatedAt: now } });
    return { startedAt: now };
  });
  return { batchId: batch._id, status: 'assigned', startedAt: result.startedAt };
}

async function recordDelivery(event, { openid }) {
  const { provider, batch } = await assignedBatch(event.batchId, openid);
  ensure(batch.status === 'assigned' && batch.startedAt, '请先开始配送', 'E_BAD_STATE');
  text(event.itemId, '门牌记录');
  return atomic(db, async transaction => {
    const current = await read(transaction, 'deliveryBatches', batch._id);
    ensure(current && current.status === 'assigned' && current.providerId === provider._id && current.startedAt,
      '批次状态已变化，请刷新后重试', 'E_CONFLICT');
    const index = (current.items || []).findIndex(item => item._id === event.itemId);
    ensure(index >= 0, '门牌记录不存在');
    const item = current.items[index];
    ensure(item.consented === true, '该住户未同意送上门');
    ensure(item.userId, '门牌缺少住户关联，请联系驿站管理员', 'E_CONFIG');
    if (event.status === 'delivered') {
      const resident = await read(transaction, 'users', item.userId);
      ensure(resident && resident.communityId === current.communityId, '住户资料不存在', 'E_CONFIG');
      ensure(resident.prefs && resident.prefs.doorDelivery === true, '住户已关闭默认送上门，请勿继续配送', 'E_FORBIDDEN');
    }
    const now = new Date();
    const patch = deliveryItem(item, event, current._id, now);
    const items = current.items.slice();
    items[index] = { ...item, ...patch };
    const eligibleItems = items.filter(row => row.consented === true);
    const status = batchStatus(eligibleItems);
    const data = { items, status, updatedAt: now, ...(status === 'done' ? { completedAt: now } : {}) };
    if (status === 'done') {
      const amounts = billing(deliveredCount(eligibleItems), current.priceSnapshot || {});
      if (amounts.gross > 0) await insert(transaction, 'ledger', { _id: 'station_' + current._id,
        refType: 'station_delivery', refId: current._id, communityId: current.communityId,
        stationCode: current.stationCode, providerId: provider._id, amounts,
        settled: { provider: false, property: false }, settlementIds: { provider: null, property: null }, createdAt: now });
      data.amounts = amounts;
      data.ledgerId = amounts.gross > 0 ? 'station_' + current._id : null;
    }
    await transaction.collection('deliveryBatches').doc(current._id).update({ data });
    return { batchId: current._id, itemId: event.itemId, status, batchStatus: status };
  });
}

exports.main = server.entry({ setDoorDelivery, listMyBatches, exportStatement, providerHall, acceptBatch, providerBatch,
  startBatch, recordDelivery }, ['resident', 'admin', 'station']);
