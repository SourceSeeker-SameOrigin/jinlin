const { quote } = require('../pet');
test('多日和多宠物逐次计价，节假日按每次上门比例加价', () => {
  const community = { prices: { pet: { holidayDates: ['2026-12-25'], holidaySurcharge: 5000 } } };
  const result = quote({ dates: ['2026-12-25', '2026-12-26'], visitsPerDay: 2,
    pets: [{ kind: 'cat', count: 1 }, { kind: 'dog', count: 1 }], tasks: ['feed','walk'], entry: 'key_handover' }, community, new Date('2026-12-01T00:00:00Z'));
  expect(result.perVisit.map(item => item.amount)).toEqual([13500,13500,9000,9000]);
  expect(result.listPrice).toBe(45000);
});
test('遛狗、密码和日期输入校验', () => {
  const community = { prices: { pet: {} } };
  const base = { dates: ['2026-12-25'], visitsPerDay: 1, pets: [{ kind: 'cat', count: 1 }], tasks: ['walk'], entry: 'password', entryPassword: 'abc' };
  expect(() => quote(base, community, new Date('2026-12-01T00:00:00Z'))).toThrow('只有养狗');
  expect(() => quote({ ...base, tasks: ['feed'], entryPassword: '' }, community, new Date('2026-12-01T00:00:00Z'))).toThrow('门锁密码');
});
test('报价返回逐次金额，不包含住户填写的门锁密码', () => {
  const result = quote({ dates: ['2026-12-25'], visitsPerDay: 1, pets: [{ kind: 'cat', count: 1 }],
    tasks: ['feed'], entry: 'password', entryPassword: 'Hidden-456' }, { prices: { pet: {} } }, new Date('2026-12-01T00:00:00Z'));
  expect(JSON.stringify(result)).not.toContain('Hidden-456');
  expect(result.perVisit).toHaveLength(1);
});
