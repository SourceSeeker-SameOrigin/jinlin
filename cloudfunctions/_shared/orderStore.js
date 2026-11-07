const { transitionPatch } = require('./orderData');
const { ensure } = require('./validate');

async function conditionalTransition(server, order, to, actor, patch = {}, filter = {}, message) {
  const change = transitionPatch(order, to, actor, new Date());
  if (patch.alertPriority !== undefined) change.alertPriority = patch.alertPriority;
  // paid→accepted→paid 可以发生 ABA；原子追加避免覆盖另一次服务员放弃的时间线。
  change.timeline = server.command.push(change.timeline.slice(-1));
  const result = await server.db.collection('orders').where({ ...filter, _id: order._id, status: order.status })
    .update({ data: { ...patch, ...change } });
  ensure(result.stats.updated === 1, message || '订单状态已变化，请刷新后重试', 'E_CONFLICT');
  return { orderId: order._id, status: to };
}

module.exports = { conditionalTransition };
