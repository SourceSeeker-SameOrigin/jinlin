const { atomic, read, insert } = require('./transaction');
const { accounting, ledgerDelta } = require('./orderLifecycle');
const { transitionPatch } = require('./orderData');
const { ensure } = require('./validate');
const { referralAward } = require('./paymentState');

function createLedgerFlow(server) {
  async function book(transaction, order, accountingInput = {}) {
    const target = accounting(order, accountingInput);
    const delta = ledgerDelta(target, order.bookedAmounts);
    const version = (order.ledgerVersion || 0) + 1;
    const now = new Date();
    if (!order.bookedAmounts || Object.values(delta).some(value => value !== 0)) {
      await insert(transaction, 'ledger', { _id: 'order_' + order._id + '_' + version,
        refType: 'order', refId: order._id, communityId: order.communityId, providerId: order.providerId,
        amounts: delta, settled: { provider: false, property: false },
        settlementIds: { provider: null, property: null }, createdAt: now });
    }
    await transaction.collection('orders').doc(order._id).update({ data: { bookedAmounts: target, ledgerVersion: version } });
  }

  async function complete(order, actor) {
    const config = await server.config();
    return atomic(server.db, async transaction => {
      const current = await read(transaction, 'orders', order._id);
      ensure(current, '订单不存在');
      if (current.status === 'completed' && current.bookedAmounts) return current;
      ensure(current.status === 'delivered', '订单状态已变化，无法确认', 'E_CONFLICT');
      const now = new Date();
      const patch = { ...transitionPatch(current, 'completed', actor, now), completedAt: current.completedAt || now };
      await book(transaction, current);
      const user = current.userId ? await read(transaction, 'users', current.userId) : null;
      if (user && user.source && user.source.referrerProviderId) {
        const referrer = await read(transaction, 'providers', user.source.referrerProviderId);
        const award = referralAward(current, user, referrer, config.referralBonus || 0);
        if (award && !(await read(transaction, 'ledger', award._id))) await insert(transaction, 'ledger', { ...award, createdAt: now });
      }
      if (!current.completedAt && current.providerId) {
        const provider = await read(transaction, 'providers', current.providerId);
        ensure(provider, '订单服务员资料不存在', 'E_CONFIG');
        await transaction.collection('providers').doc(provider._id).update({ data: { 'stats.completed': (provider.stats.completed || 0) + 1 } });
      }
      await transaction.collection('orders').doc(current._id).update({ data: patch });
      return { ...current, ...patch };
    });
  }
  return { book, complete };
}
module.exports = { createLedgerFlow };
