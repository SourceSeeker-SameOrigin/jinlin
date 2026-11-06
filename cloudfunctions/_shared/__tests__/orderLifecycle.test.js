const { complaintAllowed, complaint, rating, accounting, ledgerDelta, complaintResolution } = require('../orderLifecycle');
const deliveredAt = new Date('2026-11-06T23:30:00+08:00');
const order = { status: 'delivered', deliveredAt, rating: null, source: 'user',
  pricing: { listPrice: 500, payAmount: 500, goodsCap: 0, goodsActual: 0 }, rateSnapshot: { platform: 0.2, property: 0.05 } };
test('投诉窗口从送达时间计算，24小时端点不可投诉', () => {
  expect(complaintAllowed(order, new Date(deliveredAt.getTime() + 86399999), 24)).toBe(true);
  expect(complaintAllowed(order, new Date(deliveredAt.getTime() + 86400000), 24)).toBe(false);
  expect(complaintAllowed({ ...order, status: 'completed' }, new Date(deliveredAt.getTime() + 1000), 24)).toBe(true);
  expect(complaintAllowed({ ...order, status: 'paid' }, deliveredAt, 24)).toBe(false);
  expect(complaintAllowed({ ...order, deliveredAt: null }, deliveredAt, 24)).toBe(false);
  expect(complaintAllowed(order, new Date(deliveredAt.getTime() - 1), 24)).toBe(false);
});
test('投诉原因和内容校验，不采信前端处理结果', () => {
  expect(complaint({ reason: '其他', text: ' 迟到 ', resolution: { refundAmount: 500 } }, order, deliveredAt, 24))
    .toEqual({ reason: '其他', text: '迟到', at: deliveredAt, resolution: null });
  expect(() => complaint({ reason: '任意值' }, order, deliveredAt, 24)).toThrow();
  expect(() => complaint({ reason: '其他', text: '字'.repeat(501) }, order, deliveredAt, 24)).toThrow();
});
test.each([0, 6, 3.5, '5'])('拒绝非法评分 %s', score => {
  expect(() => rating({ score }, { ...order, status: 'completed' }, deliveredAt)).toThrow();
});
test('只允许完成后评价一次', () => {
  expect(rating({ score: 5, text: ' 很好 ' }, { ...order, status: 'completed' }, deliveredAt).text).toBe('很好');
  expect(() => rating({ score: 5 }, order, deliveredAt)).toThrow();
  expect(() => rating({ score: 5 }, { ...order, status: 'completed', rating: { score: 4 } }, deliveredAt)).toThrow();
});
test('普通完成账本金额守恒', () => {
  expect(accounting(order)).toEqual({ gross: 500, provider: 375, property: 25, platform: 100, goods: 0 });
});
test('完成后部分退200且无责，冲减金额正确', () => {
  const original = accounting(order);
  const final = accounting(order, { serviceRefund: 200 });
  expect(final).toEqual({ gross: 300, provider: 375, property: 15, platform: -90, goods: 0 });
  expect(ledgerDelta(final, original)).toEqual({ gross: -200, provider: 0, property: -10, platform: -190, goods: 0 });
});
test('服务员有责全额退时冲销此前分账', () => {
  const final = accounting(order, { serviceRefund: 500, providerLiable: true });
  expect(final).toEqual({ gross: 0, provider: 0, property: 0, platform: 0, goods: 0 });
  expect(ledgerDelta(final, accounting(order)).provider).toBe(-375);
});
test('代买只按实际商品额报销，预付款不参与服务费分账', () => {
  expect(accounting({ ...order, pricing: { listPrice: 400, payAmount: 400, goodsCap: 5000, goodsActual: 3250 } }))
    .toEqual({ gross: 3650, provider: 300, property: 20, platform: 80, goods: 3250 });
});
test('再次达到同一最终金额不会生成重复差额', () => {
  const value = accounting(order);
  expect(Object.values(ledgerDelta(value, value))).toEqual([0, 0, 0, 0, 0]);
});
test('代买投诉分别退款，预付差额不二次扣商品报销', () => {
  const buying = { ...order, status: 'disputed', serviceCode: 'buy', complaint: { at: deliveredAt, resolution: null },
    pricing: { listPrice: 400, payAmount: 400, goodsCap: 5000, goodsActual: 3250 },
    refunds: [{ key: 'goods_difference', amount: 1750, serviceAmount: 0, goodsAmount: 1750 }] };
  const event = { serviceRefundAmount: 200, goodsRefundAmount: 1000, providerLiable: false, note: '核实后部分退款' };
  const result = complaintResolution(event, buying, 'admin', deliveredAt);
  expect(result.refundAmount).toBe(1200);
  const final = accounting(buying, { serviceRefund: result.serviceRefundAmount, goodsRefund: result.goodsRefundAmount, providerLiable: false });
  expect(final).toEqual({ gross: 2450, provider: 300, property: 10, platform: -110, goods: 2250 });
  expect(ledgerDelta(final, accounting(buying))).toEqual({ gross: -1200, provider: 0, property: -10, platform: -190, goods: -1000 });
  expect(() => complaintResolution({ ...event, serviceRefundAmount: 401 }, buying, 'a', deliveredAt)).toThrow();
  expect(() => complaintResolution({ ...event, goodsRefundAmount: 3251 }, buying, 'a', deliveredAt)).toThrow();
  expect(() => complaintResolution(event, { ...buying, status: 'refunded' }, 'a', deliveredAt)).toThrow();
});
test('非代买订单不能填写商品退款，服务员责任必须明确为布尔值', () => {
  const value = { ...order, serviceCode: 'trash', status: 'disputed', complaint: {}, refunds: [] };
  const event = { serviceRefundAmount: 0, goodsRefundAmount: 1, providerLiable: false, note: '说明' };
  expect(() => complaintResolution(event, value, 'admin', deliveredAt)).toThrow();
  expect(() => complaintResolution({ ...event, goodsRefundAmount: 0, providerLiable: undefined }, value, 'admin', deliveredAt)).toThrow();
});

test('商家单按佣金分账并在退款时冲减商家、平台和物业金额', () => {
  const merchantOrder = { ...order, kind: 'merchant', merchantRateSnapshot: 0.10, rateSnapshot: { property: 0.05 },
    pricing: { listPrice: 10001, payAmount: 10001, goodsCap: 0, goodsActual: 0 } };
  expect(accounting(merchantOrder)).toEqual({ gross: 10001, provider: 0, property: 50, platform: 950, goods: 0, merchant: 9001 });
  expect(ledgerDelta(accounting(merchantOrder, { serviceRefund: 1001 }), accounting(merchantOrder)))
    .toEqual({ gross: -1001, provider: 0, property: -5, platform: -95, goods: 0, merchant: -901 });
});
