const { reserveRefund, refundResult, verifiedPayment, verifiedRefund } = require('../refundState');
const { payConfig } = require('../payConfig');
const now = new Date();
const order = { orderNo: 'JL123', pricing: { payAmount: 400, goodsCap: 5000 },
  payment: { paidAt: now, mode: 'wechat' }, refunds: [] };
const reserved = () => reserveRefund(order, 1750, '代买退差额', 'goods_difference', now);

test('代买退差额保留原支付总额及独立退款号', () => {
  expect(reserved().refund).toMatchObject({ outRefundNo: 'JL123R1', amount: 1750, status: 'processing' });
});
test('同业务重试复用退款号且不得改金额', () => {
  const current = { ...order, refunds: reserved().refunds };
  expect(reserveRefund(current, 1750, '代买退差额', 'goods_difference', now).repeated).toBe(true);
  expect(() => reserveRefund(current, 1700, '代买退差额', 'goods_difference', now)).toThrow();
});
test('失败和处理中退款仍占用可退金额，避免重试时超退', () => {
  for (const status of ['processing', 'failed', 'success']) {
    const current = { ...order, refunds: [{ ...reserved().refund, status }] };
    expect(() => reserveRefund(current, 3651, '取消', 'cancel', now)).toThrow('剩余可退金额');
    expect(reserveRefund(current, 3650, '取消', 'cancel', now).refund.outRefundNo).toBe('JL123R2');
  }
});
test.each([0, -1, 0.1, NaN, 5401])('拒绝非法退款金额 %s', amount => {
  expect(() => reserveRefund(order, amount, '退款', 'cancel', now)).toThrow();
});
test('未付款不能退，mock 直接成功', () => {
  expect(() => reserveRefund({ ...order, payment: { paidAt: null } }, 100, '退款', 'cancel', now)).toThrow();
  expect(reserveRefund({ ...order, payment: { ...order.payment, mode: 'mock' } }, 5400, '退款', 'cancel', now).refund.status).toBe('success');
});
test('已成功退款不可被迟到失败通知降级', () => {
  const current = { ...order, refunds: [{ ...reserved().refund, status: 'success' }] };
  expect(refundResult(current, 'JL123R1', 1750, 'failed')[0].status).toBe('success');
  expect(() => refundResult(current, 'JL123R1', 1751, 'success')).toThrow();
});

const paidResponse = { returnCode: 'SUCCESS', resultCode: 'SUCCESS', tradeState: 'SUCCESS',
  outTradeNo: 'JL123', subMchId: 'merchant', totalFee: 5400, transactionId: 'wx123' };
test('微信查单校验订单、金额、商户及已付款状态', () => {
  expect(verifiedPayment(order, paidResponse, 'merchant')).toEqual({ mode: 'wechat', amount: 5400, transactionId: 'wx123' });
  for (const change of [{ tradeState: 'NOTPAY' }, { totalFee: 1 }, { outTradeNo: 'other' }, { subMchId: 'other' }, { resultCode: 'FAIL' }]) {
    expect(() => verifiedPayment(order, { ...paidResponse, ...change }, 'merchant')).toThrow();
  }
});
test('支持官方 snake_case 以及 SDK 保留下划线的退款索引', () => {
  const result = { ...paidResponse, refundCount: 1, outRefundNo_0: 'JL123R1', refundFee_0: 1750, refundStatus_0: 'SUCCESS' };
  expect(verifiedRefund(order, reserved().refund, result, 'merchant')).toBe('success');
  expect(verifiedRefund(order, reserved().refund, { ...result, refundStatus_0: 'PROCESSING' }, 'merchant')).toBe('processing');
  expect(verifiedRefund(order, reserved().refund, { ...result, refundStatus_0: 'CHANGE' }, 'merchant')).toBe('failed');
  const snake = { return_code: 'SUCCESS', result_code: 'SUCCESS', out_trade_no: 'JL123', sub_mch_id: 'merchant',
    total_fee: '5400', refund_count: '1', out_refund_no_0: 'JL123R1', refund_fee_0: '1750', refund_status_0: 'SUCCESS' };
  expect(verifiedRefund(order, reserved().refund, snake, 'merchant')).toBe('success');
  expect(() => verifiedRefund(order, reserved().refund, { ...snake, refund_fee_0: 2 }, 'merchant')).toThrow();
});
test('缺配置仅报告变量名，不泄漏已有值', () => {
  const report = jest.fn();
  expect(() => payConfig('wechat', { SUB_MCH_ID: 'private' }, report)).toThrow('配置尚未完成');
  expect(report).toHaveBeenCalledWith(['ENV_ID', 'ALLOW_MOCK_PAY']);
  expect(JSON.stringify(report.mock.calls)).not.toContain('private');
});
test.each(['', 'false', 'TRUE', undefined])('mock 双开关不能绕过 %s', value => {
  expect(() => payConfig('mock', { ALLOW_MOCK_PAY: value }, () => {})).toThrow();
});
test('真实支付允许关闭 mock；开启 mock 仍要求明确配置', () => {
  expect(payConfig('wechat', { SUB_MCH_ID: 'm', ENV_ID: 'e', ALLOW_MOCK_PAY: 'false' })).toEqual({ subMchId: 'm', envId: 'e' });
  expect(() => payConfig('mock', { ALLOW_MOCK_PAY: 'true' })).not.toThrow();
});
test('分项退款分别占用额度，重复总额但换分项仍被拒绝', () => {
  const first = reserveRefund(order, 1200, '投诉处理', 'complaint', now, { service: 200, goods: 1000 });
  expect(first.refund).toMatchObject({ serviceAmount: 200, goodsAmount: 1000, amount: 1200 });
  const updated = { ...order, refunds: first.refunds };
  expect(() => reserveRefund(updated, 1200, '投诉处理', 'complaint', now, { service: 100, goods: 1100 })).toThrow();
  expect(() => reserveRefund(updated, 201, '继续处理', 'another', now, { service: 201, goods: 0 })).toThrow();
  expect(() => reserveRefund(order, 1200, '投诉处理', 'complaint', now, { service: 200, goods: 999 })).toThrow();
});
