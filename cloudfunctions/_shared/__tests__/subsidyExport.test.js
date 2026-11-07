const { HEADER, subsidyCsv } = require('../subsidyExport');

test('政府补贴导出仅包含业务字段，不包含地址、电话、姓名、备注或用户标识', () => {
  const order = { orderNo: 'JL123', communityId: 'c1', serviceCode: 'meal', status: 'completed',
    createdAt: new Date('2026-11-01T00:00:00Z'), completedAt: new Date('2026-11-01T02:00:00Z'),
    pricing: { payAmount: 300, goodsActual: 2500 }, refunds: [{ status: 'success', amount: 500 }],
    address: { room: '302', contactPhone: '13900000000' }, userPhone: '13900000000', note: '敏感备注', userOpenid: 'secret' };
  const csv = subsidyCsv([order]);
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv).toContain(HEADER.map(value => '"' + value + '"').join(','));
  expect(csv).toContain('JL123');
  for (const privateValue of ['302', '13900000000', '敏感备注', 'secret']) expect(csv).not.toContain(privateValue);
});
