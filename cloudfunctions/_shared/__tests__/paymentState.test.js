const { totalFee, paidPatch, firstPaidChanges, paidOrderChanges, referralAward } = require('../paymentState');
const { sameSnapshot } = require('../transaction');
const now = new Date('2026-11-07T00:00:00+08:00');
const user = { _id: 'u', openid: 'owner', firstPaidAt: null, source: { scene: 'b=K3F9QA', buildingId: 'b' } };
const order = { _id: 'o', kind: 'service', status: 'pending_pay', pricing: { payAmount: 100, goodsCap: 5000 },
  communityId: 'c', buildingId: 'b', timeline: [], payment: { mode: 'mock', paidAt: null } };
const payment = { mode: 'mock', transactionId: 'mock_o', amount: 5100 };

test('服务费和商品款共同校验', () => {
  expect(totalFee(order)).toBe(5100);
  expect(() => paidPatch(order, { ...payment, amount: 100 }, now)).toThrow('金额与订单不一致');
});
test('支付成功只产生一次状态和时间线变化', () => {
  const patch = paidPatch(order, payment, now);
  expect(patch.status).toBe('paid');
  expect(patch.timeline).toHaveLength(1);
  expect(paidPatch({ ...order, ...patch }, payment, now)).toBeNull();
  expect(paidPatch({ ...order, ...patch, status: 'completed' }, payment, now)).toBeNull();
});
test('拒绝错付方式、伪造流水、关闭后付款', () => {
  expect(() => paidPatch(order, { ...payment, mode: 'wechat' }, now)).toThrow();
  const patch = paidPatch(order, payment, now);
  expect(() => paidPatch({ ...order, ...patch }, { ...payment, transactionId: 'other' }, now)).toThrow();
  expect(() => paidPatch({ ...order, status: 'closed' }, payment, now)).toThrow();
});
test('首个付费服务单记录首单事件并采用来源归因', () => {
  expect(firstPaidChanges(order, user, now)).toMatchObject({ user: { firstPaidAt: now },
    event: { _id: 'first_u', type: 'first_paid', scene: 'b=K3F9QA', buildingId: 'b' } });
});
test.each([{ ...order, kind: 'membership_purchase' }, { ...order, pricing: { payAmount: 0, goodsCap: 0 } }])('月卡购买和免单不消耗首单资格', value => {
  expect(firstPaidChanges(value, user, now)).toBeNull();
});
test('已有首单时不重复写入', () => {
  expect(firstPaidChanges(order, { ...user, firstPaidAt: now }, now)).toBeNull();
});
test('首个付费订单稳定归因，第二单事件幂等地只产生一次', () => {
  expect(firstPaidChanges(order, user, now).user.firstPaidOrderId).toBe(order._id);
  expect(paidOrderChanges(order, { ...user, paidOrderCount: 0 }, now)).toMatchObject({ user: { paidOrderCount: 1, firstPaidOrderId: order._id }, secondEvent: null });
  expect(paidOrderChanges(order, { ...user, paidOrderCount: 1 }, now).secondEvent).toMatchObject({ _id: 'second_u', type: 'second_paid' });
  expect(paidOrderChanges({ ...order, kind: 'membership_purchase' }, { ...user, paidOrderCount: 1 }, now)).toBeNull();
});
test('首单完成时奖励推荐服务员，零奖励、跨小区和本人接单不记账', () => {
  const referred = { ...order, pricing: { payAmount: 100, goodsCap: 0 } };
  const referredUser = { ...user, firstPaidOrderId: order._id, source: { referrerProviderId: 'p' } };
  const provider = { _id: 'p', communityId: 'c' };
  expect(referralAward(referred, referredUser, provider, 500)).toMatchObject({ _id: 'referral_o', providerId: 'p',
    amounts: { provider: 500, platform: -500 } });
  expect(referralAward(referred, referredUser, provider, 0)).toBeNull();
  expect(referralAward(referred, referredUser, { ...provider, communityId: 'other' }, 500)).toBeNull();
  expect(referralAward({ ...referred, providerId: 'p' }, referredUser, provider, 500)).toBeNull();
});
test('订单版本、首次付款或地址改变后拒绝旧报价上下文', () => {
  const previous = { ...user, orderRevision: 1, room: '302' };
  for (const changed of [{ orderRevision: 2 }, { room: '303' }, { firstPaidAt: now }]) {
    expect(() => sameSnapshot({ ...previous, ...changed }, previous, ['orderRevision', 'firstPaidAt', 'room'])).toThrow('重新获取报价');
  }
  expect(() => sameSnapshot({ ...previous }, previous, ['orderRevision', 'firstPaidAt', 'room'])).not.toThrow();
});
