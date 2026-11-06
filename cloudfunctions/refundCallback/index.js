const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { createPayFlow } = require('./lib/shared/payFlow');
const { field } = require('./lib/shared/refundState');
const { ensure, text } = require('./lib/shared/validate');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const payments = createPayFlow(cloud, server);
exports.main = async (event = {}) => {
  try {
    ensure(!cloud.getWXContext().OPENID, '不接受客户端退款回调', 'E_FORBIDDEN');
    const outTradeNo = field(event, 'outTradeNo', 'out_trade_no');
    const outRefundNo = field(event, 'outRefundNo', 'out_refund_no');
    text(outTradeNo, '订单号', 32);
    text(outRefundNo, '退款号', 64);
    const order = await server.one('orders', { orderNo: outTradeNo });
    ensure(order && order.payment.mode === 'wechat', '退款订单不存在', 'E_PAYMENT');
    const refund = order.refunds.find(item => item.outRefundNo === outRefundNo);
    ensure(refund, '退款记录不存在', 'E_PAYMENT');
    if (refund.status === 'success') return { errcode: 0, errmsg: '' };
    const status = await payments.verifyRefund(order, refund);
    await payments.setRefundResult(order._id, refund, status);
    return { errcode: 0, errmsg: '' };
  } catch (error) {
    console.error('退款回调未处理', error.code || 'E_INTERNAL');
    return { errcode: 1, errmsg: '退款结果待核实，请重试' };
  }
};
