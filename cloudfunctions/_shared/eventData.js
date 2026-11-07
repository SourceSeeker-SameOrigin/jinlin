const crypto = require('crypto');
const { ensure, integer, record, text } = require('./validate');

const TYPES = Object.freeze(['charity', 'interest']);
const STATUSES = Object.freeze(['draft', 'published', 'ended', 'cancelled']);

function eventFields(input, now = new Date()) {
  record(input, '活动资料');
  const title = text(input.title, '活动标题', 80).trim();
  const desc = text(input.desc || '', '活动说明', 2000);
  const type = input.type;
  ensure(TYPES.includes(type), '活动类型不正确');
  const communityIds = Array.isArray(input.communityIds) ? [...new Set(input.communityIds.map(id => text(id, '小区', 100)))] : [];
  ensure(communityIds.length > 0 && communityIds.length <= 50, '请选择活动小区');
  ensure(input.scope === undefined || ['community', 'federation'].includes(input.scope), '活动范围不正确');
  const capacity = integer(input.capacity, '活动名额', 1, 10000);
  const fee = integer(input.fee === undefined ? 0 : input.fee, '活动费用', 0, 100000000);
  ensure(type !== 'charity' || fee === 0, '公益活动必须免费');
  const startAt = new Date(input.startAt), endAt = new Date(input.endAt), signupDeadline = new Date(input.signupDeadline);
  ensure(Number.isFinite(startAt.getTime()) && Number.isFinite(endAt.getTime()) && Number.isFinite(signupDeadline.getTime()) &&
    signupDeadline <= startAt && startAt < endAt && endAt > now, '活动时间或报名截止时间不正确');
  const organizerType = input.organizerType;
  ensure(['platform', 'property', 'merchant'].includes(organizerType), '活动组织者类型不正确');
  const sponsors = Array.isArray(input.sponsors) ? input.sponsors.map(item => {
    record(item, '赞助资料');
    const note = item.note === undefined ? '' : item.note;
    ensure(typeof note === 'string' && [...note].length <= 200, '赞助说明不能超过 200 字');
    return { name: text(item.name, '赞助方', 80).trim(), merchantId: item.merchantId || null,
      amount: integer(item.amount, '赞助金额', 0, 100000000), note: note.trim() };
  }) : [];
  const images = Array.isArray(input.images) ? input.images : [];
  ensure(images.length <= 9 && images.every(fileId => typeof fileId === 'string' && /^cloud:\/\//.test(fileId)), '活动图片不正确');
  return { communityIds, scope: input.scope === 'federation' ? 'federation' : 'community', organizerType,
    organizerId: input.organizerId || null, type, title, desc: desc.trim(), images,
    location: text(input.location || '', '活动地点', 200).trim(), startAt, endAt, signupDeadline, capacity, fee,
    sponsors, status: input.status || 'draft' };
}

function signupId(eventId, openid) {
  return 'su_' + crypto.createHash('sha256').update(eventId + ':' + openid).digest('hex').slice(0, 32);
}

function signupOrderId() {
  return 'evord_' + crypto.randomBytes(16).toString('hex');
}

function checkinCode() { return crypto.randomBytes(8).toString('hex').toUpperCase(); }

function eventView(event, signup = null) {
  return { _id: event._id, communityIds: event.communityIds, scope: event.scope, organizerType: event.organizerType,
    type: event.type, title: event.title, desc: event.desc, images: event.images || [], location: event.location,
    startAt: event.startAt, endAt: event.endAt, signupDeadline: event.signupDeadline,
    capacity: event.capacity, fee: event.fee, sponsors: event.sponsors || [], status: event.status,
    signupCount: event.signupCount || 0, remaining: Math.max(0, event.capacity - (event.signupCount || 0) - (event.reservedCount || 0)),
    canSignup: !signup || ['cancelled', 'refunded'].includes(signup.status),
    createdAt: event.createdAt, mySignup: signup ? { status: signup.status,
      checkinCode: signup.status === 'signed' ? signup.checkinCode : null,
      checkinQrUrl: signup.status === 'signed' ? signup.checkinQrUrl || null : null } : null };
}

module.exports = { TYPES, STATUSES, eventFields, signupId, signupOrderId, checkinCode, eventView };
