const crypto = require('crypto');
const { ensure, integer, record, text } = require('./validate');

const KINDS = ['amount_off', 'percent_off', 'free'];
const MODES = ['claim', 'auto_new_user', 'referral', 'event', 'manual'];
const SERVICES = ['express', 'trash', 'buy', 'help'];

function validateTemplate(input, now = new Date()) {
  record(input, '优惠券模板');
  const name = text(input.name, '模板名称', 40).trim();
  ensure(KINDS.includes(input.kind), '优惠券类型不正确');
  if (input.kind === 'amount_off') integer(input.value, '优惠金额', 1);
  if (input.kind === 'percent_off') integer(input.value, '折扣百分比', 1, 99);
  const maxOff = integer(input.maxOff, '优惠封顶金额', 1);
  const threshold = integer(input.threshold, '使用门槛');
  const validDays = integer(input.validDays, '有效天数', 1, 3650);
  const totalLimit = integer(input.totalLimit, '发放总量', 1, 1000000);
  const perUserLimit = integer(input.perUserLimit, '每人限领', 1, 100);
  ensure(Array.isArray(input.services) && (input.services.includes('all') || (input.services.length > 0 && input.services.every(code => SERVICES.includes(code)))),
    '适用服务配置不正确');
  ensure(input.services.includes('all') ? input.services.length === 1 : new Set(input.services).size === input.services.length,
    '适用服务不可重复');
  ensure(MODES.includes(input.issueMode), '发放方式不正确');
  ensure(input.communityIds === 'all' || (Array.isArray(input.communityIds) &&
    input.communityIds.every(id => typeof id === 'string' && id.length > 0)), '适用小区配置不正确');
  ensure(['active', 'paused'].includes(input.status), '模板状态不正确');
  return { name, kind: input.kind, value: input.kind === 'free' ? 0 : input.value, maxOff, threshold,
    services: [...input.services], validDays, totalLimit, perUserLimit, issueMode: input.issueMode,
    communityIds: input.communityIds === 'all' ? 'all' : [...new Set(input.communityIds)], status: input.status,
    issued: integer(input.issued === undefined ? 0 : input.issued, '已发放数量', 0, totalLimit),
    createdAt: input.createdAt || now, updatedAt: now };
}

function couponDiscount(template, { serviceCode, communityId, listPrice }) {
  if (!template || template.status !== 'active' || listPrice < template.threshold ||
    !(template.services.includes('all') || template.services.includes(serviceCode)) ||
    !(template.communityIds === 'all' || template.communityIds.includes(communityId))) return 0;
  let discount = template.kind === 'amount_off' ? template.value : template.kind === 'percent_off' ?
    Math.floor(listPrice * template.value / 100) : template.maxOff;
  return Math.min(discount, template.maxOff, listPrice);
}

function couponId(openid, templateId, suffix) {
  return 'cp_' + crypto.createHash('sha256').update([openid, templateId, suffix].join(':')).digest('hex').slice(0, 32);
}

function validCoupon(coupon, template, now = new Date()) {
  return coupon && template && coupon.status === 'unused' && coupon.validFrom <= now && coupon.validTo > now &&
    template.status === 'active';
}

module.exports = { KINDS, MODES, SERVICES, validateTemplate, couponDiscount, couponId, validCoupon };
