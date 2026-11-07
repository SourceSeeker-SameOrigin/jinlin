const { extensionMetrics } = require('../dashboardMetrics');

test('扩展看板按模块汇总订单、优惠券、积分、活动报名和打款状态', () => {
  const result = extensionMetrics([
    { serviceCode: 'recycle', payment: { paidAt: new Date() }, pricing: { payAmount: 100, goodsCap: 0, pointsRedeemed: 5 }, recycleResult: { totalPoints: 14 } },
    { serviceCode: 'recycle', payment: null, pricing: { payAmount: 100 } },
    { kind: 'idle_purchase', payment: { paidAt: new Date() }, pricing: { payAmount: 999, goodsCap: 0, couponId: 'c1' } }
  ], [{ signupCount: 3 }, { signupCount: 4 }], [
    { state: 'success', amount: 500 }, { state: 'processing', amount: 700 }, { state: 'success', amount: 100 }
  ]);
  expect(result.modules).toEqual([
    { code: 'idle_purchase', count: 1, paidCount: 1, paidAmount: 999 },
    { code: 'recycle', count: 2, paidCount: 1, paidAmount: 100 }
  ]);
  expect(result).toMatchObject({ activitySignups: 7, couponRedemptions: 1, pointsIssued: 14, pointsRedeemed: 5 });
  expect(result.payoutStatus).toEqual([{ status: 'success', count: 2, amount: 600 }, { status: 'processing', count: 1, amount: 700 }]);
});

test('小区只计本区提现份额，联合社区去重后每笔只计一次', () => {
  const payouts = [{ _id: 'p1', state: 'success', amount: 199999, communityAmounts: [
    { communityId: 'A', amount: 120000 }, { communityId: 'B', amount: 79999 }
  ] }, { _id: 'p2', state: 'processing', amount: 100001, communityAmounts: [{ communityId: 'B', amount: 100001 }] }];
  expect(extensionMetrics([], [], payouts, ['A']).payoutStatus).toEqual([{ status: 'success', count: 1, amount: 120000 }]);
  expect(extensionMetrics([], [], payouts, ['B']).payoutStatus).toEqual([
    { status: 'success', count: 1, amount: 79999 }, { status: 'processing', count: 1, amount: 100001 }
  ]);
  expect(extensionMetrics([], [], payouts, ['A', 'B', 'A']).payoutStatus).toEqual([
    { status: 'success', count: 1, amount: 199999 }, { status: 'processing', count: 1, amount: 100001 }
  ]);
  expect(extensionMetrics([], [], payouts, ['C']).payoutStatus).toEqual([]);
});
