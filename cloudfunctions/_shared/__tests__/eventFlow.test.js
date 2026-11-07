const { activateEventSignup, releaseEventSignup, refundEventSignup } = require('../eventFlow');

function transaction(initial) {
  const rows = structuredClone(initial), updates = [];
  return { rows, updates, collection(name) { return { doc(id) { return {
    async get() { return { data: rows[name] && rows[name][id] || null }; },
    async update({ data }) { Object.assign(rows[name][id], data); updates.push({ name, id, data }); }
  }; } }; } };
}
const order = { _id: 'o1', kind: 'event_signup', signupId: 's1' };
const base = () => ({ signups: { s1: { _id: 's1', orderId: 'o1', eventId: 'e1', status: 'pending_pay' } },
  events: { e1: { _id: 'e1', status: 'published', signupDeadline: new Date('2026-12-01'), signupCount: 2, reservedCount: 1, capacity: 5 } } });

test('支付成功把一个预留名额原子转为有效报名', async () => {
  const tx = transaction(base());
  await activateEventSignup(tx, order, new Date('2026-11-07'));
  expect(tx.rows.signups.s1.status).toBe('signed');
  expect(tx.rows.events.e1).toMatchObject({ signupCount: 3, reservedCount: 0 });
});

test('用户取消后才到达支付回调时不重开报名，要求自动退款', async () => {
  const data = base(); data.signups.s1.status = 'cancelled'; data.events.e1.reservedCount = 0;
  const tx = transaction(data);
  await expect(activateEventSignup(tx, order, new Date('2026-11-07'))).resolves.toEqual({ cancelled: true });
  expect(tx.rows.events.e1.signupCount).toBe(2);
});

test('关闭未付款订单释放名额；已退款报名减少有效人数', async () => {
  const tx = transaction(base());
  await releaseEventSignup(tx, order, 'cancelled', new Date('2026-11-07'));
  expect(tx.rows.events.e1.reservedCount).toBe(0);
  tx.rows.signups.s1.status = 'signed';
  await refundEventSignup(tx, order, new Date('2026-11-07'));
  expect(tx.rows.events.e1.signupCount).toBe(1);
});
