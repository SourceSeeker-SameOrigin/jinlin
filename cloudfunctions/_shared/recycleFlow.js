const { atomic, read, insert } = require('./transaction');
const { ensure, integer } = require('./validate');
const { transitionPatch } = require('./orderData');
const { weigh } = require('./recycle');

function createRecycleFlow(server) {
  async function deliver(order, event, openid) {
    ensure(order && order.serviceCode === 'recycle' && order.providerOpenid === openid, '无权操作该回收订单', 'E_FORBIDDEN');
    await server.feature('recycle', order.communityId);
    return atomic(server.db, async transaction => {
      const current = await read(transaction, 'orders', order._id);
      ensure(current && current.providerOpenid === openid && current.serviceCode === 'recycle', '无权操作该回收订单', 'E_FORBIDDEN');
      if (current.status === 'delivered') return current;
      ensure(current.status === 'in_service', '请先开始服务，再提交称重结果', 'E_BAD_STATE');
      const result = weigh(event, current);
      const user = await read(transaction, 'users', current.userId);
      ensure(user && user.openid === current.userOpenid, '住户资料不存在', 'E_CONFIG');
      const pointsId = 'recycle_' + current._id;
      ensure(!(await read(transaction, 'pointsLedger', pointsId)), '回收积分已经发放', 'E_CONFLICT');
      const now = new Date();
      const balanceAfter = integer(integer(user.pointsBalance || 0, '积分余额') + result.totalPoints, '积分余额');
      const patch = { ...transitionPatch(current, 'delivered', openid, now), deliveredAt: now, recycleResult: result };
      if (result.totalPoints > 0) {
        await insert(transaction, 'pointsLedger', { _id: pointsId, openid: user.openid, delta: result.totalPoints,
          reason: 'recycle', refId: current._id, balanceAfter, createdAt: now });
        await transaction.collection('users').doc(user._id).update({ data: { pointsBalance: balanceAfter } });
      }
      await transaction.collection('orders').doc(current._id).update({ data: patch });
      return { ...current, ...patch };
    });
  }
  return { deliver };
}

module.exports = { createRecycleFlow };
