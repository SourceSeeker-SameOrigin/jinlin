const { finalizeRefundDiscounts, awardReferralCoupons } = require('../couponFlow');

function transactionFor(coupon) {
  const updates = [];
  return {
    updates,
    collection(name) {
      return { doc(id) {
        return {
          async get() { return { data: name === 'coupons' && id === coupon._id ? coupon : null }; },
          async update({ data }) { updates.push({ name, id, data }); }
        };
      } };
    }
  };
}

test('只有全额退款成功后才退回仍有效的已使用优惠券', async () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const coupon = { _id: 'c1', status: 'used', orderId: 'o1', validTo: new Date('2026-12-01T00:00:00Z') };
  const transaction = transactionFor(coupon);
  const order = { _id: 'o1', pricing: { payAmount: 250, goodsCap: 1000, couponId: 'c1' } };
  const partial = [{ status: 'success', serviceAmount: 250, goodsAmount: 999 }];
  expect(await finalizeRefundDiscounts(transaction, order, partial, now)).toBe(false);
  expect(transaction.updates).toHaveLength(0);
  const full = [{ status: 'success', serviceAmount: 250, goodsAmount: 1000 }];
  expect(await finalizeRefundDiscounts(transaction, order, full, now)).toBe(true);
  expect(transaction.updates).toEqual([{ name: 'coupons', id: 'c1', data: { status: 'unused', orderId: null } }]);
});

test('已过期券全额退款后保持过期状态', async () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const coupon = { _id: 'c1', status: 'used', orderId: 'o1', validTo: new Date('2026-11-06T00:00:00Z') };
  const transaction = transactionFor(coupon);
  const order = { _id: 'o1', pricing: { payAmount: 250, goodsCap: 0, couponId: 'c1' } };
  expect(await finalizeRefundDiscounts(transaction, order, [{ status: 'success', amount: 250 }], now)).toBe(true);
  expect(transaction.updates[0].data).toEqual({ status: 'expired', orderId: null });
});

function memoryTransaction(initial) {
  const data = Object.fromEntries(Object.entries(initial).map(([name, rows]) => [name,
    new Map(rows.map(row => [row._id, { ...row }]))]));
  const tx = { collection(name) {
    if (!data[name]) data[name] = new Map();
    const rows = data[name];
    return {
      doc(id) { return {
        async get() { return { data: rows.get(id) || null }; },
        async set({ data: value }) { rows.set(id, { _id: id, ...value }); },
        async update({ data: value }) { rows.set(id, { ...(rows.get(id) || { _id: id }), ...value }); }
      }; },
      where(filter) {
        const query = { limit() { return query; }, async get() { return { data: [...rows.values()].filter(row =>
          Object.entries(filter).every(([key, value]) => row[key] === value)) }; } };
        return query;
      }
    };
  } };
  return { tx, data };
}

test('按服务费退款比例逐笔恢复积分，商品退款不恢复且回调幂等', async () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const { tx, data } = memoryTransaction({ users: [{ _id: 'u1', openid: 'resident', pointsBalance: 0 }] });
  const order = { _id: 'o1', userId: 'u1', pricing: { pointsRedeemed: 101, payAmount: 1000, goodsCap: 300 } };
  const refunds = [
    { outRefundNo: 'R1', status: 'success', serviceAmount: 500, goodsAmount: 0, amount: 500 },
    { outRefundNo: 'R2', status: 'success', serviceAmount: 0, goodsAmount: 100, amount: 100 }
  ];
  await finalizeRefundDiscounts(tx, order, refunds, now);
  await finalizeRefundDiscounts(tx, order, refunds, now);
  expect(data.users.get('u1').pointsBalance).toBe(50);
  expect(data.pointsLedger.get('points_restore_R1')).toMatchObject({ delta: 50, refundId: 'R1' });
  expect(data.pointsLedger.get('points_restore_R2')).toMatchObject({ delta: 0, refundId: 'R2' });

  refunds.push({ outRefundNo: 'R3', status: 'success', serviceAmount: 500, goodsAmount: 0, amount: 500 });
  await finalizeRefundDiscounts(tx, order, refunds, now);
  await finalizeRefundDiscounts(tx, order, refunds, now);
  expect(data.users.get('u1').pointsBalance).toBe(101);
  expect(data.pointsLedger.get('points_restore_R3').delta).toBe(51);
});

test('被推荐人首笔付费订单完成时给推荐人发券，并以订单号幂等', async () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const { tx, data } = memoryTransaction({
    users: [
      { _id: 'referrer-user', openid: 'referrer', couponCounts: {} },
      { _id: 'referred-user', openid: 'referred' }
    ],
    couponTemplates: [{ _id: 'referral-template', issueMode: 'referral', status: 'active', communityIds: 'all',
      validDays: 30, totalLimit: 10, perUserLimit: 2, issued: 0 }]
  });
  const order = { _id: 'first-paid-order', kind: 'service', communityId: 'c1', pricing: { payAmount: 99 } };
  const referred = { _id: 'referred-user', firstPaidOrderId: order._id };
  const referrer = { _id: 'provider-1', openid: 'referrer', communityId: 'c1' };
  expect(await awardReferralCoupons(tx, order, referred, referrer, now, true)).toBe(1);
  expect(await awardReferralCoupons(tx, order, referred, referrer, now, true)).toBe(0);
  expect(await awardReferralCoupons(tx, { ...order, _id: 'later-order' },
    { ...referred, firstPaidOrderId: 'later-order' }, referrer, now, false)).toBe(0);
  const issued = [...data.coupons.values()][0];
  expect(issued).toMatchObject({ openid: 'referrer', referralOrderId: order._id, status: 'unused' });
  expect(data.users.get('referrer-user').couponCounts['referral-template']).toBe(1);
  expect(data.couponTemplates.get('referral-template').issued).toBe(1);
});
