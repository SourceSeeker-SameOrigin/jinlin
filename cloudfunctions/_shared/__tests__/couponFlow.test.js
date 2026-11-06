const { finalizeRefundDiscounts } = require('../couponFlow');

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
