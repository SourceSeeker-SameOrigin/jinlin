const { ensure, integer, record, text } = require('./validate');
const { addDays, parseWindow, nextDutyWindow } = require('./time');

const TYPES = Object.freeze(['task', 'ask', 'carry']);
const SCOPES = Object.freeze(['community', 'federation']);

function validateCarry(input, now = new Date(), carryBlacklist = []) {
  ensure(input && typeof input === 'object' && !Array.isArray(input), '帮带信息不完整');
  ensure(['offer', 'request'].includes(input.direction), '请选择帮带或求帮带');
  const destination = text(input.destination, '目的地', 100).trim();
  ensure(['domestic', 'overseas'].includes(input.destinationType), '目的地类型不正确');
  const departAt = new Date(input.departAt);
  ensure(Number.isFinite(departAt.getTime()) && departAt >= now, '出发时间必须是未来时间');
  const returnAt = input.returnAt ? new Date(input.returnAt) : null;
  ensure(!returnAt || Number.isFinite(returnAt.getTime()) && returnAt >= departAt, '返程时间不能早于出发时间');
  if (input.destinationType === 'overseas') {
    ensure(input.disclaimerAgreed === true, '境外帮带请先确认合规声明');
    ensure(!input.reward, '境外帮带仅限信息发布，不能附带悬赏或付款');
    const terms = (carryBlacklist || []).filter(item => typeof item === 'string' && item.trim());
    for (const term of terms) ensure(![destination, input.title || '', input.content || ''].some(value => value.includes(term)),
      '境外帮带信息包含禁止词，请修改后重试', 'E_BLOCKED');
  }
  return { direction: input.direction, destination, destinationType: input.destinationType,
    departAt, returnAt, disclaimerAgreed: input.destinationType === 'overseas' };
}

function validateTaskSlot(slot, windows, now = new Date()) {
  record(slot, '悬赏服务时段');
  nextDutyWindow(windows, now); // 同时验证小区值班配置与跨午夜区间不重叠。
  const matched = windows.find(window => window.start === slot.start && window.end === slot.end);
  ensure(matched, '请选择本小区已配置的值班时段');
  const parsed = parseWindow(slot);
  ensure(parsed.startAt > now && parsed.endAt > now, '悬赏服务日期和时段必须在未来');
  return { date: slot.date, start: slot.start, end: slot.end };
}

function newPost({ id, user, community, input, now = new Date() }) {
  ensure(TYPES.includes(input.type), '帖子类型不正确');
  ensure(SCOPES.includes(input.scope), '内容范围不正确');
  const title = text(input.title, '标题', 100).trim();
  const content = text(input.content, '内容', 2000).trim();
  const carry = input.type === 'carry' ? validateCarry({ ...input.carry, title, content }, now, input.carryBlacklist) : null;
  const reward = input.type === 'task' ? integer(input.reward, '悬赏金额', 300, Number.MAX_SAFE_INTEGER) : null;
  const slot = input.type === 'task' ? validateTaskSlot(input.slot, community.dutyWindows, now) : null;
  const needEnterHome = input.type === 'task' ? input.needEnterHome === true : false;
  ensure(input.type !== 'task' || typeof input.needEnterHome === 'boolean', '请选择是否需要进入家中');
  ensure(input.type !== 'task' || input.scope === 'community', '悬赏任务只能发布在本小区');
  const orderId = input.type === 'task' ? text(input.orderId, '悬赏订单') : null;
  const images = Array.isArray(input.images) ? [...new Set(input.images)] : [];
  ensure(images.length <= 3, '最多上传 3 张图片');
  return { _id: id, type: input.type, communityId: community._id, scope: input.scope,
    authorOpenid: user.openid, authorUserId: user._id, title, content,
    images, carry, ...(input.type === 'task' ? { reward, needEnterHome, slot, orderId } : {}),
    status: 'open', commentsCount: 0, expireAt: slot ? parseWindow(slot).endAt : addDays(now, 7),
    moderationPendingFileIds: [], moderationApprovedFileIds: [], reporterOpenids: [],
    moderationHidden: false, createdAt: now, updatedAt: now };
}

module.exports = { TYPES, SCOPES, validateCarry, validateTaskSlot, newPost };
