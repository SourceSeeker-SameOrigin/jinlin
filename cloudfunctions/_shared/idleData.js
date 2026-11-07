const { ensure, integer, text, record } = require('./validate');
const { checkText } = require('./blacklist');
const { read } = require('./transaction');

const CONDITIONS = Object.freeze(['new', 'like_new', 'used']);
const MODES = Object.freeze(['offline', 'escrow']);
const DEFAULT_IDLE_BLACKLIST = Object.freeze(['烟草', '酒类', '药品', '医疗器械', '活体动物', '管制刀具', '自制食品', '贴身衣物', '虚拟账号']);

function idleBlacklist(config = {}) {
  return [...new Set([...(config.blacklist || []), ...DEFAULT_IDLE_BLACKLIST, ...(config.idleBlacklist || [])])];
}

function validateItem(input, blacklist) {
  record(input, '闲置商品');
  const title = text(input.title, '标题', 80).trim();
  const desc = text(input.desc, '商品描述', 2000).trim();
  ensure(!checkText(title, blacklist) && !checkText(desc, blacklist), '商品信息包含禁止发布的内容', 'E_BLOCKED');
  const price = integer(input.price, '价格', 1);
  ensure(CONDITIONS.includes(input.condition), '成色不正确');
  ensure(MODES.includes(input.tradeMode || 'offline'), '交易方式不正确');
  ensure(typeof input.negotiable === 'boolean', '请确认是否接受议价');
  const images = Array.isArray(input.images) ? [...new Set(input.images)] : [];
  ensure(images.length <= 9, '最多上传 9 张图片');
  return { title, desc, price, condition: input.condition, tradeMode: input.tradeMode || 'offline',
    negotiable: input.negotiable, category: text(input.category || '其他', '分类', 40).trim(), images };
}

function newIdleItem({ id, user, community, input, now = new Date(), config = {} }) {
  const valid = validateItem(input, idleBlacklist(config));
  return { _id: id, communityId: community._id, scope: input.scope || 'community', sellerOpenid: user.openid,
    sellerUserId: user._id, ...valid, status: 'on_sale', moderationPendingFileIds: [],
    moderationApprovedFileIds: [], reporterOpenids: [], moderationHidden: false,
    createdAt: now, updatedAt: now };
}

function commission(price, rate) {
  integer(price, '闲置商品价格', 0);
  ensure(typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1, '闲置交易佣金比例不正确', 'E_CONFIG');
  return Math.round(price * rate);
}

async function releaseReservation(transaction, order) {
  if (!order || order.kind !== 'idle_purchase' || !order.idleItemId) return false;
  const item = await read(transaction, 'idleItems', order.idleItemId);
  if (!item || item.sellerOpenid !== order.sellerOpenid || item.purchaseOrderId !== order._id ||
      !['reserved', 'sold'].includes(item.status)) return false;
  await transaction.collection('idleItems').doc(item._id).update({ data: { status: 'on_sale', purchaseOrderId: null, updatedAt: new Date() } });
  return true;
}

module.exports = { CONDITIONS, MODES, idleBlacklist, validateItem, newIdleItem, commission, releaseReservation };
