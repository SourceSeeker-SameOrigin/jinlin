const crypto = require('node:crypto');
const { orderNo, shortCode, membershipTaskId } = require('../ids');

afterEach(() => jest.restoreAllMocks());

test('订单号使用北京时间并保留四位随机数前导零', () => {
  jest.spyOn(crypto, 'randomInt').mockReturnValue(7);
  expect(orderNo(new Date('2026-11-05T16:30:09Z'))).toBe('JL2611060030090007');
  expect(orderNo(new Date('2026-12-31T16:00:00Z'))).toBe('JL2701010000000007');
});

test('订单号真实随机部分符合四位数字格式', () => {
  expect(orderNo(new Date('2026-11-05T16:30:09Z'))).toMatch(/^JL261106003009\d{4}$/);
});

test('短码六位，整个候选字符表不包含易混字符', () => {
  const random = jest.spyOn(crypto, 'randomInt');
  random.mockImplementation(max => max - 1);
  expect(shortCode()).toBe('ZZZZZZ');
  const length = random.mock.calls[0][0];
  const candidates = [];
  for (let i = 0; i < length; i += 1) {
    random.mockReturnValue(i);
    candidates.push(shortCode()[0]);
  }
  expect(candidates.join('')).toBe('23456789ABCDEFGHJKLMNPQRSTUVWXYZ');
  expect(candidates.join('')).not.toMatch(/[01OI]/);
});

test('确定性月卡任务 ID 对相同输入保持一致，日期和时段区分任务', () => {
  const id = membershipTaskId('card_123', '2026-11-06', 'evening');
  expect(id).toBe('m_card_123_20261106_evening');
  expect(membershipTaskId('card_123', '2026-11-06', 'evening')).toBe(id);
  expect(membershipTaskId('card_123', '2026-11-07', 'evening')).not.toBe(id);
  expect(membershipTaskId('card_123', '2026-11-06', 'morning')).not.toBe(id);
});

test.each([['', '2026-11-06', 'morning'], ['card', '2026-02-30', 'morning'],
  ['card', '20261106', 'morning'], ['card', '2026-11-06', 'midnight']])('拒绝错误幂等键参数 %p', (id, date, slot) => {
  expect(() => membershipTaskId(id, date, slot)).toThrow(expect.objectContaining({ code: 'E_INVALID_PARAM' }));
});
