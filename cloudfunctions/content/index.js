const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { createServer } = require('./lib/shared/server');
const { report: reportData, reportOutcome } = require('./lib/shared/ugc');
const { atomic, read, insert } = require('./lib/shared/transaction');
const { requireRole } = require('./lib/shared/auth');
const { ensure, text, integer } = require('./lib/shared/validate');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const COLLECTIONS = { post: 'posts', comment: 'comments', idle: 'idleItems', event: 'events', message: 'messages', merchant: 'merchants' };

async function report(event, { openid }) {
  const collection = COLLECTIONS[event.targetType];
  ensure(collection, '暂不支持举报该内容');
  text(event.targetId, '举报内容'); text(event.communityId, '小区');
  const target = await server.get(collection, event.targetId);
  ensure(target && target.communityId === event.communityId, '内容不存在或不属于该小区');
  ensure(target.authorOpenid !== openid && target.sellerOpenid !== openid && target.openid !== openid, '不能举报自己的内容');
  const config = await server.config();
  const id = 'r_' + crypto.createHash('sha256').update(event.targetType + ':' + event.targetId + ':' + openid).digest('hex').slice(0, 36);
  const record = reportData(event.targetType, event.targetId, openid, event.reason, event.text);
  return atomic(server.db, async transaction => {
    const existing = await read(transaction, 'reports', id);
    if (existing) return { reportId: id, duplicate: true, hidden: Boolean(target.moderationHidden) };
    const current = await read(transaction, collection, event.targetId);
    ensure(current, '内容已删除', 'E_CONFLICT');
    // 只需记录达到隐藏门槛的三名不同举报人，避免高频举报无限扩大文档。
    const reporters = [...new Set([...(current.reporterOpenids || []), openid])].slice(0, 3);
    const hidden = reportOutcome(reporters.map(reporterOpenid => ({ reporterOpenid }))).hide;
    await insert(transaction, 'reports', { _id: id, ...record, communityId: event.communityId });
    await transaction.collection(collection).doc(event.targetId).update({ data: { reporterOpenids: reporters,
      ...(hidden ? { moderationHidden: true } : {}) } });
    return { reportId: id, duplicate: false, hidden };
  });
}

async function listReports(event, { user }) {
  requireRole(user, ['admin']);
  const status = event.status || 'pending';
  ensure(['pending','upheld','dismissed'].includes(status), '审核状态不正确');
  const offset = integer(event.offset || 0, '分页位置', 0, 100000);
  const result = await server.db.collection('reports').where({ status }).orderBy('createdAt', 'desc').skip(offset).limit(20).get();
  const list = await Promise.all(result.data.map(async item => {
    const collection = COLLECTIONS[item.targetType];
    const target = collection ? await server.get(collection, item.targetId) : null;
    const authorOpenid = target && (target.authorOpenid || target.sellerOpenid || target.openid || target.from);
    const author = authorOpenid ? await server.one('users', { openid: authorOpenid }) : null;
    return { _id: item._id, targetType: item.targetType, targetId: item.targetId, communityId: item.communityId,
      reason: item.reason, text: item.text, status: item.status, createdAt: item.createdAt,
      hidden: Boolean(target && target.moderationHidden), authorUserId: author && author._id || null };
  }));
  return { list, hasMore: result.data.length === 20 };
}

async function resolveReport(event, { user, openid }) {
  requireRole(user, ['admin']); text(event.reportId, '举报记录');
  ensure(['upheld','dismissed'].includes(event.status), '请选择成立或驳回');
  return atomic(server.db, async transaction => {
    const item = await read(transaction, 'reports', event.reportId);
    ensure(item && item.status === 'pending', '举报已处理或不存在', 'E_CONFLICT');
    await transaction.collection('reports').doc(item._id).update({ data: { status: event.status, handledBy: openid,
      handledAt: new Date(), note: typeof event.note === 'string' ? event.note.slice(0,200) : '' } });
    return { reportId: item._id, status: event.status };
  });
}

async function moderateUser(event, { user }) {
  requireRole(user, ['admin']); text(event.userId, '用户');
  ensure(['mute','block','unmute','unblock'].includes(event.action), '管理操作不正确');
  const target = await server.get('users', event.userId);
  ensure(target, '用户不存在');
  if (event.action === 'mute') {
    const hours = integer(event.hours, '禁言时长', 1, 8760);
    await server.db.collection('users').doc(target._id).update({ data: { mutedUntil: new Date(Date.now() + hours*3600000) } });
  } else if (event.action === 'unmute') await server.db.collection('users').doc(target._id).update({ data: { mutedUntil: null } });
  else await server.db.collection('users').doc(target._id).update({ data: { blocked: event.action === 'block' } });
  return { userId: target._id, action: event.action };
}

async function moderateContent(event, { user }) {
  requireRole(user, ['admin']);
  const collection = COLLECTIONS[event.targetType];
  ensure(collection && typeof event.hidden === 'boolean', '内容管理操作不正确');
  text(event.targetId, '内容'); text(event.communityId, '小区');
  return atomic(server.db, async transaction => {
    const target = await read(transaction, collection, event.targetId);
    ensure(target && target.communityId === event.communityId, '内容不存在或不属于该小区', 'E_CONFLICT');
    await transaction.collection(collection).doc(target._id).update({ data: { moderationHidden: event.hidden,
      ...(event.targetType === 'comment' ? { status: event.hidden ? 'hidden' : 'ok' } : {}),
      moderatedAt: new Date() } });
    return { targetId: target._id, hidden: event.hidden };
  });
}

exports.main = server.entry({ report, listReports, resolveReport, moderateUser, moderateContent }, ['resident','admin','property']);
