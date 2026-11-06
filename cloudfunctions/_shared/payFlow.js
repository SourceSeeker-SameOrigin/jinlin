const crypto = require('crypto');
const { atomic, read, insert } = require('./transaction');
const { totalFee, paidPatch, firstPaidChanges } = require('./paymentState');
const { reserveRefund, refundResult, success, verifiedPayment, verifiedRefund, field } = require('./refundState');
const { payConfig } = require('./payConfig');
const { SERVICE_NAMES, transitionPatch } = require('./orderData');
const { ensure } = require('./validate');
const { activateMembership } = require('./membershipFlow');
const { createNotifier } = require('./notify');

function createPayFlow(cloud, server) {
  const { db } = server;
  const nonce = () => crypto.randomBytes(16).toString('hex');
  const notify = createNotifier(cloud, server);

  async function onPaid(order, payment) {
    const user = await server.one('users', { openid: order.userOpenid });
    ensure(user, '订单用户不存在', 'E_CONFIG');
    let changed = false;
    const result = await atomic(db, async transaction => {
      const current = await read(transaction, 'orders', order._id);
      ensure(current, '订单不存在');
      const now = new Date();
      const patch = paidPatch(current, payment, now);
      if (!patch) return current;
      const currentUser = await read(transaction, 'users', user._id);
      const first = firstPaidChanges(current, currentUser, now);
      if (first) await insert(transaction, 'events', first.event);
      const membership = current.kind === 'membership_purchase' ? await activateMembership(transaction, current, currentUser, now) : null;
      if (membership) Object.assign(patch, membership.orderPatch);
      await transaction.collection('users').doc(user._id).update({ data: {
        ...(first ? first.user : {}), ...(membership ? membership.userPatch : {}), orderRevision: (currentUser.orderRevision || 0) + 1 } });
      await transaction.collection('orders').doc(order._id).update({ data: patch });
      changed = true;
      return { ...current, ...patch };
    });
    if (changed) await notify.newTask(result);
    if (changed && result.kind === 'service') {
      await notify.resident('accepted', result);
      await notify.resident('delivered', result);
    }
    return result;
  }

  async function prepare(order) {
    if (order.payment.paidAt) return { orderId: order._id, free: true };
    ensure(order.status === 'pending_pay', '订单已关闭或结束，无法支付', 'E_BAD_STATE');
    const config = await server.config();
    ensure(order.payment.mode === config.payMode, '支付模式已变更，请联系客服', 'E_CONFIG');
    const env = payConfig(config.payMode);
    if (config.payMode === 'mock') return { orderId: order._id, mock: true };
    const response = await cloud.cloudPay.unifiedOrder({ body: '近邻帮-' + (SERVICE_NAMES[order.serviceCode] || '月卡'),
      outTradeNo: order.orderNo, spbillCreateIp: '127.0.0.1', subMchId: env.subMchId,
      totalFee: totalFee(order), envId: env.envId, functionName: 'payCallback', nonceStr: nonce() });
    ensure(success(response) && response.payment, '支付暂不可用，请到订单页重试', 'E_PAYMENT');
    const { timeStamp, nonceStr, package: packageValue, signType, paySign } = response.payment;
    return { orderId: order._id, payment: { timeStamp: String(timeStamp), nonceStr, package: packageValue, signType, paySign } };
  }

  async function verifyPaid(order) {
    const env = payConfig('wechat');
    const result = await cloud.cloudPay.queryOrder({ subMchId: env.subMchId, outTradeNo: order.orderNo, nonceStr: nonce() });
    return verifiedPayment(order, result, env.subMchId);
  }

  async function setRefundResult(orderId, refund, status, dispatched = false) {
    return atomic(db, async transaction => {
      const order = await read(transaction, 'orders', orderId);
      ensure(order, '订单不存在');
      const refunds = refundResult(order, refund.outRefundNo, refund.amount, status).map(item =>
        item.outRefundNo === refund.outRefundNo && dispatched ? { ...item, dispatchedAt: new Date() } : item);
      await transaction.collection('orders').doc(orderId).update({ data: { refunds, updatedAt: new Date() } });
      return { ...order, refunds };
    });
  }

  async function dispatchRefund(order, refund) {
    if (refund.status === 'success' || order.payment.mode === 'mock') return;
    const env = payConfig('wechat');
    try {
      const result = await cloud.cloudPay.refund({ outTradeNo: order.orderNo, outRefundNo: refund.outRefundNo,
        totalFee: totalFee(order), refundFee: refund.amount, subMchId: env.subMchId, envId: env.envId,
        functionName: 'refundCallback', nonceStr: nonce() });
      ensure(success(result), '退款申请失败，请联系管理员重试', 'E_PAYMENT');
      await setRefundResult(order._id, refund, 'processing', true);
    } catch (error) {
      await setRefundResult(order._id, refund, 'failed');
      // 不记录原始微信响应或个人信息。订单保留相同退款号供重试，避免重复退钱。
      console.error('退款待重试', order._id, refund.outRefundNo, error.code || 'E_PAYMENT');
    }
  }

  async function requestRefund(order, amount, reason, options = {}) {
    payConfig(order.payment.mode);
    const result = await atomic(db, async transaction => {
      const current = await read(transaction, 'orders', order._id);
      ensure(current, '订单不存在');
      if (options.validateCurrent) options.validateCurrent(current);
      const reserved = reserveRefund(current, amount, reason, options.key || reason, new Date(), options.parts);
      if (reserved.repeated) return { order: current, refund: reserved.refund };
      ensure(current.status === order.status, '订单状态已变化，请刷新后重试', 'E_CONFLICT');
      const patch = { ...(options.patch || {}), refunds: reserved.refunds, updatedAt: new Date() };
      if (options.to) Object.assign(patch, transitionPatch(current, options.to, options.actor || 'system', new Date()));
      await transaction.collection('orders').doc(order._id).update({ data: patch });
      const resultingOrder = { ...current, ...patch };
      if (options.afterWrite) await options.afterWrite(transaction, resultingOrder);
      return { order: resultingOrder, refund: reserved.refund };
    });
    await dispatchRefund(result.order, result.refund);
    return result.order;
  }

  async function verifyRefund(order, refund) {
    const env = payConfig('wechat');
    const result = await cloud.cloudPay.queryRefund({ subMchId: env.subMchId, outRefundNo: refund.outRefundNo, nonceStr: nonce() });
    return verifiedRefund(order, refund, result, env.subMchId);
  }

  async function closeUnpaid(order, actor) {
    if (order.payment.mode === 'wechat') {
      const env = payConfig('wechat');
      const result = await cloud.cloudPay.closeOrder({ subMchId: env.subMchId, outTradeNo: order.orderNo, nonceStr: nonce() });
      // 已关闭也可能来自前次网络响应丢失；其他错误不能把已支付订单关掉。
      if (!success(result)) {
        const checked = await cloud.cloudPay.queryOrder({ subMchId: env.subMchId, outTradeNo: order.orderNo, nonceStr: nonce() });
        ensure(success(checked) && field(checked, 'tradeState', 'trade_state') === 'CLOSED',
          '微信订单状态待确认，请稍后刷新', 'E_PAYMENT');
      }
    }
    const result = await db.collection('orders').where({ _id: order._id, status: 'pending_pay' })
      .update({ data: transitionPatch(order, 'closed', actor, new Date()) });
    ensure(result.stats.updated === 1, '订单状态已变化，请刷新后重试', 'E_CONFLICT');
  }

  return { onPaid, prepare, verifyPaid, requestRefund, dispatchRefund, verifyRefund, setRefundResult, closeUnpaid };
}

module.exports = { createPayFlow };
