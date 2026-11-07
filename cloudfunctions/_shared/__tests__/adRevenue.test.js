const { confirmAdReceived } = require('../adRevenue');

function transactionFor(initial) {
  const data = Object.fromEntries(Object.entries(initial).map(([name, rows]) => [name,
    new Map(rows.map(row => [row._id, { ...row }]))]));
  return {
    data,
    collection(name) {
      if (!data[name]) data[name] = new Map();
      const rows = data[name];
      return { doc(id) { return {
        async get() { return { data: rows.get(id) || null }; },
        async set({ data: value }) { rows.set(id, { _id: id, ...value }); },
        async update({ data: value }) { rows.set(id, { ...(rows.get(id) || { _id: id }), ...value }); }
      }; } };
    }
  };
}

test('管理员确认多小区广告收款只生成一笔平台收入账本', async () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const transaction = transactionFor({ ads: [{ _id: 'ad-1', price: 12500, communityIds: ['c1', 'c2'] }] });
  expect(await confirmAdReceived(transaction, 'ad-1', 'admin-openid', now)).toMatchObject({
    ledgerId: 'ad_ad-1', amount: 12500, duplicate: false
  });
  expect(transaction.data.ledger.get('ad_ad-1')).toMatchObject({
    refType: 'ad', refId: 'ad-1', communityId: null, communityIds: ['c1', 'c2'],
    amounts: { platform: 12500 }, createdBy: 'admin-openid'
  });
  expect(transaction.data.ads.get('ad-1')).toMatchObject({ paymentReceivedAt: now, revenueLedgerId: 'ad_ad-1' });
  expect(await confirmAdReceived(transaction, 'ad-1', 'admin-openid', now)).toMatchObject({ duplicate: true });
  expect(transaction.data.ledger.size).toBe(1);
});
