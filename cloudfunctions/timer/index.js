const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { createPayFlow } = require('./lib/shared/payFlow');
const { createLedgerFlow } = require('./lib/shared/ledgerFlow');
const { ensure, integer } = require('./lib/shared/validate');
const { createMembershipTasks } = require('./lib/shared/membershipFlow');
const { createNotifier } = require('./lib/shared/notify');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const payments = createPayFlow(cloud, server);
const ledger = createLedgerFlow(server);
const notify = createNotifier(cloud, server);
const { db, command } = server;

exports.main = async (event = {}) => {
  ensure(!cloud.getWXContext().OPENID && event.Type === 'Timer' && event.TriggerName === 'every5min', '仅允许定时触发', 'E_FORBIDDEN');
  const config = await server.config();
  const now = new Date();
  const results = {};
  async function run(name, filter, action) {
    results[name] = { done: 0, failed: 0 };
    try {
      const rows = await server.all('orders', filter());
      for (const row of rows) {
        try { await action(row); results[name].done++; }
        catch (error) { results[name].failed++; console.error(name, row._id, error.code || 'E_INTERNAL'); }
      }
    } catch (error) { results[name].failed++; console.error(name, error.code || 'E_INTERNAL'); }
  }
  await run('closeUnpaid', () => ({ status: 'pending_pay', createdAt: command.lte(new Date(now - integer(config.payTimeoutMinutes, '支付超时', 1) * 60000)) }),
    order => payments.closeUnpaid(order, 'system'));
  await run('unaccepted', () => ({ kind: 'service', status: 'paid', alertedAt: null,
    'payment.paidAt': command.lte(new Date(now - integer(config.acceptAlertMinutes, '告警时限', 1) * 60000)) }), async order => {
    const updated = await db.collection('orders').where({ _id: order._id, status: 'paid', alertedAt: null })
      .update({ data: { alertedAt: now, alertPriority: 1 } });
    if (updated.stats.updated === 1) await notify.unaccepted({ ...order, alertedAt: now });
  });
  await run('autoConfirm', () => ({ status: 'delivered', deliveredAt: command.lte(new Date(now - integer(config.autoConfirmHours, '自动确认时限', 1) * 3600000)) }),
    order => ledger.complete(order, 'system'));
  await run('refundRecovery', () => ({ 'refunds.status': command.in(['processing', 'failed']) }), async order => {
    for (const refund of order.refunds.filter(item => item.status !== 'success' && order.payment.mode === 'wechat')) {
      try {
        if (refund.status === 'processing' && !refund.dispatchedAt) await payments.dispatchRefund(order, refund);
        else await payments.setRefundResult(order._id, refund, await payments.verifyRefund(order, refund));
      } catch (error) { console.error('退款核对待重试', order._id, error.code || 'E_PAYMENT'); }
    }
  });
  try {
    const cards = await server.all('memberships', { status: 'active', serviceCode: 'trash', startAt: command.lte(now), endAt: command.gt(now) });
    results.membershipTasks = { created: 0, failed: 0 };
    const tasks = createMembershipTasks(server);
    for (const card of cards) {
      try { if (await tasks.generate(card, now)) results.membershipTasks.created++; }
      catch (error) { results.membershipTasks.failed++; console.error('月卡任务生成失败', card._id, error.code || 'E_INTERNAL'); }
    }
  } catch (error) { results.membershipTasks = { failed: true }; console.error('月卡任务查询失败', error.code || 'E_INTERNAL'); }
  try {
    results.expireMemberships = await db.collection('memberships').where({ status: 'active', endAt: command.lte(now) })
      .update({ data: { status: 'expired' } });
  } catch (error) { results.expireMemberships = { failed: true }; console.error('月卡到期处理失败', error.code || 'E_INTERNAL'); }
  return { ok: true, data: results };
};
