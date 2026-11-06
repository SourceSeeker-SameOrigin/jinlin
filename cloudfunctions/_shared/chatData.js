const crypto = require('crypto');
const { ensure } = require('./validate');

function orderConversationId(orderId, providerOpenid) {
  return 'cv_' + crypto.createHash('sha256').update(orderId + ':' + providerOpenid).digest('hex').slice(0, 36);
}

function newOrderConversation(order, now = new Date()) {
  ensure(order && order.kind === 'service' && order.userOpenid && order.providerOpenid,
    '订单会话参与者不完整', 'E_CONFIG');
  ensure(['accepted', 'in_service', 'delivered', 'disputed', 'completed'].includes(order.status),
    '订单尚未接单，暂不能聊天', 'E_BAD_STATE');
  return { _id: orderConversationId(order._id, order.providerOpenid), type: 'order', refId: order._id,
    communityId: order.communityId, members: [order.userOpenid, order.providerOpenid],
    lastMessage: '', lastAt: now, unread: { [order.userOpenid]: 0, [order.providerOpenid]: 0 },
    lastSentAt: {}, closedAt: null, closeAt: null, createdAt: now, updatedAt: now };
}

function readOnly(order, conversation, config, now = new Date()) {
  if (conversation.closedAt) return true;
  if (!['completed', 'cancelled', 'closed', 'refunded'].includes(order.status)) return false;
  if (order.status === 'completed' && order.completedAt) {
    const hours = Number(config.phoneVisibleHoursAfterDone);
    return now.getTime() >= new Date(order.completedAt).getTime() + hours * 3600000;
  }
  return true;
}

function messageView(message, viewerOpenid) {
  const own = message.from === viewerOpenid;
  const result = { _id: message._id, mine: own, type: message.type, status: message.status,
    createdAt: message.createdAt };
  if (message.type === 'text') result.content = message.content;
  else if (message.status === 'ok' || message.status === 'pending' && own) result.fileId = message.fileId;
  if (message.status === 'pending' && !own) result.content = '图片审核中';
  if (message.status === 'blocked') result.content = own ? '图片未通过审核，只有你能看到' : '图片未通过审核';
  return result;
}

function checkSendRate(lastSentAt, now = new Date()) {
  const previous = lastSentAt ? new Date(lastSentAt) : null;
  ensure(!previous || Number.isFinite(previous.getTime()) && now.getTime() - previous.getTime() >= 1000,
    '发送太快，请稍后再试', 'E_RATE_LIMIT');
  return true;
}

module.exports = { orderConversationId, newOrderConversation, readOnly, messageView, checkSendRate };
