const { clean, snapshot, quote, weigh, recyclerStatement, recyclerStatementCsv } = require('../recycle');

const community = { prices: { recycle: { categories: {
  paper: { pointsPerKg: 3, purchaseFenPerKg: 7, recyclerId: 'm_paper' },
  plastic: { pointsPerKg: 20, purchaseFenPerKg: 50, recyclerId: 'm_plastic' }
} } } };

test('回收预约只接受去重后的已知类别和短备注', () => {
  expect(clean({ categories: ['paper', 'plastic'], note: '纸箱和瓶子' })).toEqual({ categories: ['paper', 'plastic'], note: '纸箱和瓶子' });
  expect(() => clean({ categories: ['paper', 'paper'] })).toThrow('回收类别不正确');
  expect(() => clean({ categories: ['unknown'] })).toThrow('回收类别不正确');
});

test('回收服务免服务费并要求每种已选类别具备小区单价和企业映射', () => {
  const detail = clean({ categories: ['paper'] });
  expect(quote()).toMatchObject({ payAmount: 0, listPrice: 0 });
  expect(snapshot(community, detail)).toMatchObject({ providerBaseFen: 300, providerFenPerKg: 20,
    categories: { paper: { pointsPerKg: 3, purchaseFenPerKg: 7, recyclerId: 'm_paper' } } });
  expect(() => snapshot({ prices: { recycle: { categories: {} } } }, detail)).toThrow('纸类配置');
});

test('0.1 kg 积分向下取整、企业金额四舍五入到分，服务员计件叠加每单与每公斤报酬', () => {
  const order = { serviceCode: 'recycle', detail: { categories: ['paper', 'plastic'] },
    recycleSnapshot: snapshot(community, { categories: ['paper', 'plastic'] }) };
  const result = weigh({ weightsTenths: { paper: 1, plastic: 1 } }, order);
  expect(result).toEqual({ totalTenths: 2, totalPoints: 2, totalRevenueFen: 6, providerPayoutFen: 304,
    breakdown: [
      { category: 'paper', categoryName: '纸类', tenthsKg: 1, points: 0, revenueFen: 1, recyclerId: 'm_paper' },
      { category: 'plastic', categoryName: '塑料', tenthsKg: 1, points: 2, revenueFen: 5, recyclerId: 'm_plastic' }
    ] });
  expect(() => weigh({ weightsTenths: { paper: 1 } }, order)).toThrow('称重类别与预约不一致');
  expect(() => weigh({ weightsTenths: { paper: 0, plastic: 0 } }, order)).toThrow('大于 0 kg');
});

test('回收企业对账按企业和类别汇总完成订单，CSV 防公式注入', () => {
  const from = new Date('2026-11-01T00:00:00Z');
  const to = new Date('2026-12-01T00:00:00Z');
  const result = recyclerStatement([{ _id: 'o1', status: 'completed', completedAt: new Date('2026-11-15T00:00:00Z'),
    recycleResult: { breakdown: [{ recyclerId: '=merchant', category: 'paper', categoryName: '纸类', tenthsKg: 15, revenueFen: 11 }] } },
  { _id: 'o2', status: 'delivered', completedAt: new Date('2026-11-20T00:00:00Z'), recycleResult: { breakdown: [] } }], from, to);
  expect(result).toMatchObject({ totalFen: 11, rows: [{ tenthsKg: 15, amountFen: 11, orderCount: 1 }] });
  expect(recyclerStatementCsv(result, '2026-11-01', '2026-11-30')).toContain("'=merchant");
});
