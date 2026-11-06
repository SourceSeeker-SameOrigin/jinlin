const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { createOrderContext } = require('./lib/shared/orderContext');
const { STATUS_GROUPS, listView, transitionPatch } = require('./lib/shared/orderData');
const { orderView } = require('./lib/shared/views');
const { ensure, integer, text } = require('./lib/shared/validate');
const { createOrderWriter } = require('./lib/shared/orderWrite');
const { checkOrderContent } = require('./lib/shared/contentSafety');
const { totalFee } = require('./lib/shared/paymentState');
const { requireRole } = require('./lib/shared/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const server = createServer(cloud);
const context = createOrderContext(server);
const writer = createOrderWriter(server);

function mockEnabled(config) {
  ensure(config.payMode === 'mock' && process.env.ALLOW_MOCK_PAY === 'true', '模拟支付未开启，请联系管理员', 'E_CONFIG');
}

async function create(event, { user }) {
  requireRole(user, ['resident']);
  const result = await context(event, user);
  if (result.pricing.payAmount + result.pricing.goodsCap > 0) mockEnabled(result.config);
  await checkOrderContent(cloud, user.openid, result.note, result.detail, result.config.blacklist);
  const order = await writer.create(event, user, result);
  return { orderId: order._id, mock: order.status === 'pending_pay', free: order.status !== 'pending_pay' };
}

async function mockPay(event, { user }) {
  requireRole(user, ['resident']);
  mockEnabled(await server.config());
  text(event.orderId, '订单');
  const order = await server.get('orders', event.orderId);
  ensure(order && order.userOpenid === user.openid, '无权操作该订单', 'E_FORBIDDEN');
  ensure(order.payment.mode === 'mock', '该订单不支持模拟支付', 'E_FORBIDDEN');
  const paid = await writer.markPaid(order, { mode: 'mock', amount: totalFee(order), transactionId: 'mock_' + order._id });
  return { orderId: paid._id, status: paid.status };
}

async function quote(event, { user }) {
  const result = await context(event, user, { metadata: event.metadata === true });
  return { pricing: result.pricing, slots: result.slots, onDutyCount: result.onDutyCount,
    hasTrashMembership: result.hasTrashMembership, validationMessage: result.validationMessage || '' };
}

async function listMine(event, { openid }) {
  const group = event.group || 'ongoing';
  ensure(Object.prototype.hasOwnProperty.call(STATUS_GROUPS, group), '订单分组不正确');
  const offset = integer(event.offset === undefined ? 0 : event.offset, '分页位置', 0, 100000);
  const rows = await server.db.collection('orders').where({ userOpenid: openid, status: server.command.in(STATUS_GROUPS[group]) })
    .orderBy('createdAt', 'desc').orderBy('_id', 'desc').skip(offset).limit(20).get();
  return { list: rows.data.map(listView), hasMore: rows.data.length === 20 };
}

async function detail(event, { user }) {
  text(event.orderId, '订单');
  const order = await server.get('orders', event.orderId);
  ensure(order, '订单不存在');
  const [provider, config] = await Promise.all([server.get('providers', order.providerId), server.config()]);
  const result = orderView(order, user, provider, config, new Date());
  if (result.canPay && config.payMode === 'mock' && process.env.ALLOW_MOCK_PAY === 'true') result.paymentOptions = { mock: true };
  return result;
}

async function cancel(event, { openid }) {
  text(event.orderId, '订单');
  const order = await server.get('orders', event.orderId);
  ensure(order && order.userOpenid === openid, '无权操作该订单', 'E_FORBIDDEN');
  ensure(['pending_pay', 'paid'].includes(order.status), '订单已接单或已结束，无法自行取消', 'E_BAD_STATE');
  const now = new Date();
  const patch = transitionPatch(order, order.status === 'pending_pay' ? 'closed' : 'cancelled', openid, now);
  const total = order.pricing.payAmount + order.pricing.goodsCap;
  if (order.status === 'paid' && total > 0) {
    const config = await server.config();
    ensure(config.payMode === 'mock' && process.env.ALLOW_MOCK_PAY === 'true' && order.payment.mode === 'mock',
      '当前支付配置不支持模拟退款', 'E_CONFIG');
    patch.refunds = [...order.refunds, { outRefundNo: order.orderNo + 'R' + (order.refunds.length + 1),
      amount: total, reason: '住户取消订单', status: 'success', at: now }];
  }
  const result = await server.db.collection('orders').where({ _id: order._id, status: order.status })
    .update({ data: patch });
  ensure(result.stats.updated === 1, '订单状态已变化，请刷新后重试', 'E_CONFLICT');
  return { orderId: order._id, status: patch.status };
}

exports.main = server.entry({ quote, create, mockPay, listMine, detail, cancel }, ['resident', 'admin', 'property']);
