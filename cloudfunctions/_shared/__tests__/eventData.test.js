const { eventFields, signupId, signupOrderId, checkinCode, eventView } = require('../eventData');
const { eventReminderData } = require('../notificationData');

function activity(overrides = {}) {
  return { title: '社区读书会', desc: '一起交流', communityIds: ['c1'], type: 'interest', fee: 3000,
    capacity: 20, startAt: '2026-12-01T10:00:00+08:00', endAt: '2026-12-01T12:00:00+08:00',
    signupDeadline: '2026-11-30T23:59:00+08:00', organizerType: 'platform', location: '活动室', ...overrides };
}

test('活动字段校验、公益活动必须免费、时间和容量受限', () => {
  expect(eventFields(activity()).fee).toBe(3000);
  expect(eventFields(activity({ type: 'charity', fee: 0 })).fee).toBe(0);
  expect(() => eventFields(activity({ type: 'charity', fee: 1 }))).toThrow('必须免费');
  expect(() => eventFields(activity({ capacity: 0 }))).toThrow();
  expect(() => eventFields(activity({ signupDeadline: '2026-12-02T00:00:00+08:00' }))).toThrow('时间');
});

test('报名 ID 确定且签到码不泄漏收款身份', () => {
  expect(signupId('e1', 'u1')).toBe(signupId('e1', 'u1'));
  expect(signupId('e1', 'u1')).not.toBe(signupId('e1', 'u2'));
  expect(signupOrderId()).toMatch(/^evord_[0-9a-f]{32}$/);
  expect(signupOrderId()).not.toBe(signupOrderId());
  expect(checkinCode()).toMatch(/^[0-9A-F]{16}$/);
});

test('活动列表视图只输出允许字段与剩余名额', () => {
  const view = eventView({ ...eventFields(activity()), _id: 'e1', signupCount: 4, reservedCount: 2,
    internalSecret: 'x' });
  expect(view.remaining).toBe(14);
  expect(view).not.toHaveProperty('internalSecret');
});

test('活动提醒模板字段按映射输出本地时间', () => {
  const result = eventReminderData({ title: '社区读书会', location: '活动室', startAt: new Date('2026-12-01T02:00:00.000Z') });
  expect(result).toEqual({ thing1: { value: '社区读书会' }, thing2: { value: '活动室' }, time3: { value: '2026-12-01 10:00' } });
});
