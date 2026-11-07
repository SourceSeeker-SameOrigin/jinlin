const { period, rowsForPayee, total, csvCell, csv, settlementId } = require('../settlementData');

test('结算日期包含结束日且限制范围为一年', () => {
  expect(period({ from: '2026-11-01', to: '2026-11-30' })).toMatchObject({ period: { from: '2026-11-01', to: '2026-11-30' } });
  expect(() => period({ from: '2026-12-01', to: '2026-11-30' })).toThrow();
  expect(() => period({ from: '2025-01-01', to: '2026-01-02' })).toThrow();
});

const ledger = [
  { _id: 'a', providerId: 'p1', settled: { provider: false, property: false }, amounts: { provider: 75, property: 5 } },
  { _id: 'b', providerId: 'p2', settled: { provider: false, property: true }, amounts: { provider: 120, property: 8 } },
  { _id: 'c', providerId: 'p1', settled: { provider: true, property: false }, amounts: { provider: 30, property: 2 } }
];
test('按服务员和物业分别筛选未结算账目', () => {
  expect(rowsForPayee(ledger, 'provider', 'p1').map(row => row._id)).toEqual(['a']);
  expect(total(rowsForPayee(ledger, 'provider', 'p2'), 'provider')).toBe(120);
  expect(rowsForPayee(ledger, 'property').map(row => row._id)).toEqual(['a', 'c']);
});

test('个人卖家结算按卖家OpenID筛选并排除打款锁定账目', () => {
  const rows = [
    { _id: 's1', sellerOpenid: 'wx-a', payoutId: null, settled: { seller: false }, amounts: { seller: 300 } },
    { _id: 's2', sellerOpenid: 'wx-a', payoutId: 'po1', settled: { seller: false }, amounts: { seller: 500 } },
    { _id: 's3', sellerOpenid: 'wx-b', settled: { seller: false }, amounts: { seller: 700 } }
  ];
  expect(rowsForPayee(rows, 'seller', 'wx-a').map(row => row._id)).toEqual(['s1']);
  expect(total(rowsForPayee(rows, 'seller', 'wx-b'), 'seller')).toBe(700);
});

test('CSV 添加 UTF-8 BOM、正确转义并防止公式注入', () => {
  expect(csvCell('A,"B')).toBe('"A,""B"');
  expect(csvCell('=1+1')).toBe("\"'=1+1\"");
  expect(csvCell('-123')).toBe('"-123"');
  expect(csv([{ payee: 'provider', communityId: 'c', providerId: null, from: 'a', to: 'b', total: 100,
    status: 'draft', ledgerIds: ['x'] }]).startsWith('\uFEFF')).toBe(true);
});

test('同一收款人和期间得到稳定结算单号', () => {
  expect(settlementId('provider', 'c', 'p', '2026-01-01', '2026-01-31')).toBe(
    settlementId('provider', 'c', 'p', '2026-01-01', '2026-01-31'));
  expect(settlementId('provider', 'c', 'p2', '2026-01-01', '2026-01-31')).not.toBe(
    settlementId('provider', 'c', 'p', '2026-01-01', '2026-01-31'));
});
