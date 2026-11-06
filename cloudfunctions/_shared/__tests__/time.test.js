const { nowCST, ymd, hm, addDays, parseWindow, nextDutyWindow, isWithin } = require('../time');

const at = value => new Date(value);
const duty = [{ start: '07:00', end: '09:00' }, { start: '14:00', end: '16:00' }, { start: '19:00', end: '21:00' }];
const night = [{ start: '22:00', end: '02:00' }];

test('UTC 前一天 16:30 对应北京时间次日 00:30', () => {
  const now = at('2026-11-05T16:30:00Z');
  expect(ymd(now)).toBe('2026-11-06');
  expect(hm(now)).toBe('00:30');
  expect(now.toISOString()).toBe('2026-11-05T16:30:00.000Z');
});

test('nowCST 保持真实时间戳，与北京时间格式化函数组合使用', () => {
  jest.useFakeTimers().setSystemTime(at('2026-11-05T16:30:00Z'));
  try {
    expect(nowCST().toISOString()).toBe('2026-11-05T16:30:00.000Z');
    expect(ymd(nowCST())).toBe('2026-11-06');
  } finally {
    jest.useRealTimers();
  }
});

test.each([
  ['2026-12-31T18:30:00+08:00', 1, '2027-01-01'],
  ['2024-02-28T18:30:00+08:00', 1, '2024-02-29'],
  ['2024-02-29T18:30:00+08:00', 1, '2024-03-01'],
  ['2026-03-01T18:30:00+08:00', -1, '2026-02-28'],
  ['2026-03-08T18:30:00+08:00', 1, '2026-03-09']
])('加天不受服务器时区和夏令时影响 %s / %i', (input, days, expected) => {
  const date = at(input);
  const original = date.getTime();
  const result = addDays(date, days);
  expect(ymd(result)).toBe(expected);
  expect(hm(result)).toBe('18:30');
  expect(date.getTime()).toBe(original);
});

test('白天时段转换为真实 UTC 时间戳', () => {
  expect(parseWindow({ date: '2026-11-06', start: '07:00', end: '09:00' })).toEqual({
    startAt: at('2026-11-05T23:00:00Z'), endAt: at('2026-11-06T01:00:00Z')
  });
});

test.each([
  ['2026-11-06', '2026-11-06T14:00:00Z', '2026-11-06T18:00:00Z'],
  ['2026-12-31', '2026-12-31T14:00:00Z', '2026-12-31T18:00:00Z'],
  ['2024-02-29', '2024-02-29T14:00:00Z', '2024-02-29T18:00:00Z']
])('跨午夜时段包括跨年和闰年 %s', (date, start, end) => {
  expect(parseWindow({ date, start: '22:00', end: '02:00' })).toEqual({ startAt: at(start), endAt: at(end) });
});

test.each([
  ['2026-11-06T21:59:59.999+08:00', false], ['2026-11-06T22:00:00+08:00', true],
  ['2026-11-07T00:30:00+08:00', true], ['2026-11-07T01:59:59.999+08:00', true],
  ['2026-11-07T02:00:00+08:00', false]
])('时段包含开始不包含结束：%s', (now, expected) => {
  expect(isWithin({ date: '2026-11-06', ...night[0] }, at(now))).toBe(expected);
});

test.each([
  ['06:59', '2026-11-06', '07:00'], ['07:00', '2026-11-06', '07:00'],
  ['08:30', '2026-11-06', '07:00'], ['09:00', '2026-11-06', '14:00'],
  ['16:00', '2026-11-06', '19:00'], ['21:00', '2026-11-07', '07:00']
])('白天值班选择 %s', (clock, date, start) => {
  expect(nextDutyWindow([...duty].reverse(), at('2026-11-06T' + clock + ':00+08:00'))).toEqual({
    date, ...duty.find(window => window.start === start)
  });
});

test.each([
  ['2026-11-07T00:30:00+08:00', '2026-11-06'],
  ['2026-11-07T02:00:00+08:00', '2026-11-07'],
  ['2027-01-01T00:30:00+08:00', '2026-12-31'],
  ['2024-03-01T00:30:00+08:00', '2024-02-29']
])('跨夜班次归属开始日期 %s', (now, date) => {
  expect(nextDutyWindow(night, at(now))).toEqual({ date, start: '22:00', end: '02:00' });
});

test('凌晨班次日期与月卡额度自然日独立', () => {
  const now = at('2026-11-07T00:30:00+08:00');
  expect(nextDutyWindow(night, now).date).toBe('2026-11-06');
  expect(ymd(now)).toBe('2026-11-07');
});

test('空值班列表无可用时段，不修改原始配置', () => {
  const windows = Object.freeze(duty.map(window => Object.freeze({ ...window })));
  expect(nextDutyWindow([], at('2026-11-06T00:00:00Z'))).toBeNull();
  expect(nextDutyWindow(windows, at('2026-11-06T00:00:00Z')).start).toBe('07:00');
});

test('相邻时段及午夜端点允许，无重叠', () => {
  const windows = [{ start: '22:00', end: '00:00' }, { start: '00:00', end: '02:00' }];
  expect(nextDutyWindow(windows, at('2026-11-07T00:00:00+08:00')))
    .toEqual({ date: '2026-11-07', start: '00:00', end: '02:00' });
});

test.each([
  [{ start: '07:00', end: '09:00' }, { start: '08:00', end: '10:00' }],
  [{ start: '22:00', end: '02:00' }, { start: '01:00', end: '03:00' }],
  [{ start: '22:00', end: '02:00' }, { start: '23:00', end: '01:00' }],
  [{ start: '07:00', end: '09:00' }, { start: '07:00', end: '09:00' }]
])('拒绝循环日历中重叠的时段 %#', (...windows) => {
  expect(() => nextDutyWindow(windows, at('2026-11-06T00:00:00Z'))).toThrow(expect.objectContaining({ code: 'E_CONFIG' }));
});

test.each([{ date: '2026-02-29', start: '07:00', end: '09:00' },
  { date: '2026-11-31', start: '07:00', end: '09:00' }, { date: 'bad', start: '07:00', end: '09:00' }])(
  '拒绝无效日历日期 %p', window => {
    expect(() => parseWindow(window)).toThrow(expect.objectContaining({ code: 'E_INVALID_PARAM' }));
  });

test.each([['07:00', '07:00'], ['7:00', '09:00'], ['24:00', '02:00'], ['22:60', '02:00']])(
  '拒绝无效时段 %s–%s', (start, end) => {
    expect(() => parseWindow({ date: '2026-11-06', start, end })).toThrow(expect.objectContaining({ code: 'E_CONFIG' }));
  });

test('非法日期、非整数天数和异常配置明确报错', () => {
  for (const value of [new Date(NaN), null, '2026-11-06']) {
    expect(() => ymd(value)).toThrow(expect.objectContaining({ code: 'E_INVALID_PARAM' }));
  }
  expect(() => addDays(new Date(), 0.5)).toThrow(expect.objectContaining({ code: 'E_INVALID_PARAM' }));
  expect(() => nextDutyWindow(null, new Date())).toThrow(expect.objectContaining({ code: 'E_CONFIG' }));
});
