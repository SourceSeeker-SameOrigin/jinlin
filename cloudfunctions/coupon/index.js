const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { atomic, read } = require('./lib/shared/transaction');
const { couponDiscount, validateTemplate, validCoupon } = require('./lib/shared/couponData');
const { issueOne, communityMatches } = require('./lib/shared/couponFlow');
const { ensure, integer, text } = require('./lib/shared/validate');
const { requireRole } = require('./lib/shared/auth');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);

async function center(event, { user }) {
  const communityId = user.communityId || '';
  await server.featureEntry('coupons', user, communityId);
  const templates = await server.all('couponTemplates', { status: 'active', issueMode: 'claim' });
  const list = templates.filter(item => communityMatches(item, communityId) && item.issued < item.totalLimit)
    .map(item => ({ _id: item._id, name: item.name, kind: item.kind, value: item.value,
      maxOff: item.maxOff, threshold: item.threshold, validDays: item.validDays,
      services: item.services, remaining: item.totalLimit - item.issued }));
  return { communityId, list };
}

async function claim(event, { user, openid }) {
  await server.featureEntry('coupons', user);
  text(event.templateId, '优惠券模板');
  if (event.requestId !== undefined) {
    ensure(typeof event.requestId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(event.requestId), '领取编号不正确');
  }
  return issueOne(server, { openid, templateId: event.templateId, mode: 'claim',
    communityId: user.communityId, claimRequestId: event.requestId });
}

async function mine(event, { user, openid }) {
  await server.featureEntry('coupons', user);
  const result = await server.db.collection('coupons').where({ openid }).orderBy('createdAt', 'desc').limit(100).get();
  const templates = new Map((await server.all('couponTemplates', {})).map(item => [item._id, item]));
  const now = new Date();
  return { list: result.data.map(coupon => {
    const template = templates.get(coupon.templateId);
    const status = coupon.status === 'unused' && coupon.validTo <= now ? 'expired' : coupon.status;
    return { _id: coupon._id, templateId: coupon.templateId, name: template && template.name || '优惠券',
      kind: template && template.kind, value: template && template.value, maxOff: template && template.maxOff,
      threshold: template && template.threshold, status, validFrom: coupon.validFrom, validTo: coupon.validTo };
  }) };
}

async function adminTemplates(event, { user }) {
  requireRole(user, ['admin']);
  const rows = await server.all('couponTemplates', {});
  return { list: rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) };
}

async function saveTemplate(event, { user }) {
  requireRole(user, ['admin']);
  const now = new Date();
  const current = event.templateId ? await server.get('couponTemplates', event.templateId) : null;
  ensure(!event.templateId || current, '优惠券模板不存在');
  const normalized = validateTemplate({ ...event, issued: current ? current.issued : 0,
    createdAt: current ? current.createdAt : now, status: event.status || (current && current.status) || 'active' }, now);
  if (current) {
    const result = await server.db.collection('couponTemplates').where({ _id: current._id, issued: current.issued })
      .update({ data: normalized });
    ensure(result.stats.updated === 1, '模板已被其他管理员修改，请刷新', 'E_CONFLICT');
    return { templateId: current._id };
  }
  const templateId = 'ct_' + crypto.randomBytes(16).toString('hex');
  await server.db.collection('couponTemplates').doc(templateId).set({ data: normalized });
  return { templateId };
}

async function manualIssue(event, { user }) {
  requireRole(user, ['admin']);
  text(event.templateId, '优惠券模板');
  const template = await server.get('couponTemplates', event.templateId);
  ensure(template && template.status === 'active', '优惠券模板不存在或已暂停');
  let recipients;
  if (typeof event.phone === 'string' && event.phone.trim()) {
    ensure(/^1\d{10}$/.test(event.phone), '请输入完整的 11 位手机号');
    const result = await server.db.collection('users').where({ phone: event.phone }).limit(2).get();
    ensure(result.data.length === 1, '未找到唯一匹配的用户');
    recipients = result.data;
  } else {
    ensure(Array.isArray(event.userIds) && event.userIds.length > 0 && event.userIds.length <= 100 &&
      event.userIds.every(id => typeof id === 'string'), '请填写 1–100 个用户编号');
    recipients = await Promise.all([...new Set(event.userIds)].map(id => server.get('users', id)));
    ensure(recipients.every(Boolean), '用户列表中包含不存在的记录');
  }
  const results = [];
  const failures = [];
  for (const recipient of recipients) {
    try {
      await server.feature('coupons', recipient.communityId);
      results.push(await issueOne(server, { openid: recipient.openid, templateId: template._id, mode: 'manual',
        communityId: recipient.communityId || '' }));
    } catch (error) {
      failures.push({ userId: recipient._id, message: error.message || '发放失败' });
    }
  }
  return { issued: results.filter(item => !item.duplicate).length,
    duplicates: results.filter(item => item.duplicate).length, failures };
}

exports.main = server.entry({ center, claim, mine, adminTemplates, saveTemplate, manualIssue },
  ['resident', 'admin', 'property']);
