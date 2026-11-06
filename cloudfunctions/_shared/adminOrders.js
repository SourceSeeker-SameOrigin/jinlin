const { ensure, text, integer } = require('./validate');
const { requireRole, requireCommunityAccess } = require('./auth');
const { canWork } = require('./providerData');
const { listView } = require('./orderData');
const { conditionalTransition } = require('./orderStore');
const { createPayFlow } = require('./payFlow');
const { totalFee } = require('./paymentState');

function adminOrderActions(cloud, server) {
  const payments = createPayFlow(cloud, server);
  async function managed(event, user) {
    requireRole(user, ['admin']);
    text(event.orderId, '订单');
    const order = await server.get('orders', event.orderId);
    ensure(order, '订单不存在');
    return order;
  }
  async function listOrders(event, { user }) {
    requireRole(user, ['admin', 'property']);
    const filter = {};
    const communityId = user.roles.includes('admin') ? event.communityId : user.communityId;
    if (communityId) { requireCommunityAccess(user, communityId); filter.communityId = communityId; }
    else ensure(user.roles.includes('admin'), '请先设置物业所属小区', 'E_FORBIDDEN');
    if (event.status) {
      ensure(['pending_pay', 'paid', 'accepted', 'in_service', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled', 'closed'].includes(event.status), '订单状态不正确');
      filter.status = event.status;
    }
    const offset = integer(event.offset === undefined ? 0 : event.offset, '分页位置', 0, 100000);
    const result = await server.db.collection('orders').where(filter).orderBy('alertPriority', 'desc').orderBy('createdAt', 'desc').skip(offset).limit(20).get();
    return { list: result.data.map(order => ({ ...listView(order), alerted: Boolean(order.alertedAt && order.status === 'paid') })),
      hasMore: result.data.length === 20, readOnly: !user.roles.includes('admin') };
  }
  async function assign(event, { user, openid }) {
    const order = await managed(event, user);
    text(event.providerId, '服务员');
    const provider = await server.get('providers', event.providerId);
    canWork(provider, new Date(), order.minLevel);
    ensure(order.kind === 'service' && provider.communityId === order.communityId, '请选择本小区服务员');
    ensure(order.status === 'paid', '仅待接单订单可指派', 'E_BAD_STATE');
    return conditionalTransition(server, order, 'accepted', openid, { providerId: provider._id,
      providerOpenid: provider.openid, acceptedAt: new Date() });
  }
  async function forceCancel(event, { user, openid }) {
    const order = await managed(event, user);
    ensure(['pending_pay', 'paid', 'accepted', 'in_service'].includes(order.status), '当前状态不能强制取消', 'E_BAD_STATE');
    if (order.status === 'pending_pay') { await payments.closeUnpaid(order, openid); return { status: 'closed' }; }
    const amount = totalFee(order) - order.refunds.reduce((sum, item) => sum + item.amount, 0);
    if (amount > 0) await payments.requestRefund(order, amount, '管理员取消订单', { key: 'admin_cancel', to: 'cancelled', actor: openid });
    else await conditionalTransition(server, order, 'cancelled', openid);
    return { status: 'cancelled' };
  }
  async function retryRefund(event, { user }) {
    const order = await managed(event, user);
    text(event.outRefundNo, '退款号');
    const refund = order.refunds.find(item => item.outRefundNo === event.outRefundNo);
    ensure(refund, '退款记录不存在');
    if (refund.status !== 'success') await payments.dispatchRefund(order, refund);
    const fresh = await server.get('orders', order._id);
    return { refunds: fresh.refunds.map(({ outRefundNo, amount, reason, status, at }) => ({ outRefundNo, amount, reason, status, at })) };
  }
  return { listOrders, assign, forceCancel, retryRefund };
}
module.exports = { adminOrderActions };
