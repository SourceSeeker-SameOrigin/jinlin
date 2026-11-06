const api = require('./api');

async function pay(created) {
  if (created.free) return true;
  if (created.mock) {
    const answer = await new Promise(resolve => wx.showModal({ title: '模拟支付',
      content: '当前为开发测试支付，不会扣款。是否确认模拟支付？', success: resolve,
      fail: () => resolve({ confirm: false }) }));
    if (!answer.confirm) return false;
    await api.call('order', 'mockPay', { orderId: created.orderId });
    return true;
  }
  if (created.payment) {
    await new Promise((resolve, reject) => wx.requestPayment({ ...created.payment, success: resolve, fail: reject }));
    return true;
  }
  throw new Error('支付参数暂不可用，请到订单页重试');
}

module.exports = { pay };
