const { ensure, integer, record } = require('./validate');

const DAY = 24 * 60 * 60 * 1000;
const OFFSET = 8 * 60 * 60 * 1000;
const pad = value => String(value).padStart(2, '0');

function validDate(date) {
  ensure(date instanceof Date && Number.isFinite(date.getTime()), '日期不正确');
  return date;
}

// Date 保存真实时间戳，不人为加八小时；北京时间日历字段由 ymd/hm 转换。
function nowCST() {
  return new Date();
}

function cstParts(date) {
  validDate(date);
  const shifted = new Date(date.getTime() + OFFSET);
  validDate(shifted);
  return shifted;
}

function ymd(date) {
  const shifted = cstParts(date);
  return String(shifted.getUTCFullYear()).padStart(4, '0') + '-' +
    pad(shifted.getUTCMonth() + 1) + '-' + pad(shifted.getUTCDate());
}

function hm(date) {
  const shifted = cstParts(date);
  return pad(shifted.getUTCHours()) + ':' + pad(shifted.getUTCMinutes());
}

function addDays(date, days) {
  validDate(date);
  integer(days, '天数', -Number.MAX_SAFE_INTEGER);
  return validDate(new Date(date.getTime() + days * DAY));
}

function parseDate(date) {
  ensure(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date), '日期应为年月日');
  const start = validDate(new Date(date + 'T00:00:00+08:00'));
  ensure(ymd(start) === date, '日期不存在');
  return start;
}

function minutes(value) {
  ensure(typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value), '时间应为二十四小时制时分', 'E_CONFIG');
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

// window: { date: 'yyyy-mm-dd', start: 'HH:mm', end: 'HH:mm' }。
// 用户确认：归属开始日期，开始包含、结束不包含；跨午夜结束日期加一天。
function parseWindow(window) {
  record(window, '时段');
  const base = parseDate(window.date).getTime();
  const start = minutes(window.start);
  const end = minutes(window.end);
  ensure(start !== end, '时段开始和结束时间不能相同', 'E_CONFIG');
  return {
    startAt: new Date(base + start * 60000),
    endAt: new Date(base + end * 60000 + (end < start ? DAY : 0))
  };
}

function isWithin(window, now) {
  validDate(now);
  const { startAt, endAt } = parseWindow(window);
  return now.getTime() >= startAt.getTime() && now.getTime() < endAt.getTime();
}

function nextDutyWindow(windows, now) {
  validDate(now);
  ensure(Array.isArray(windows), '值班时段配置不正确', 'E_CONFIG');
  const ranges = windows.map(window => {
    record(window, '值班时段', 'E_CONFIG');
    const start = minutes(window.start);
    const end = minutes(window.end);
    ensure(start !== end, '时段开始和结束时间不能相同', 'E_CONFIG');
    return { start, end: end < start ? end + 1440 : end, window };
  });
  // 按循环日历拆分跨夜区间，检查当天及前一天延续的重叠；相邻端点允许相等。
  const segments = ranges.flatMap(range => range.end > 1440
    ? [{ start: range.start, end: 1440 }, { start: 0, end: range.end - 1440 }]
    : [{ start: range.start, end: range.end }]).sort((a, b) => a.start - b.start);
  for (let i = 1; i < segments.length; i += 1) {
    ensure(segments[i].start >= segments[i - 1].end, '值班时段不能重叠', 'E_CONFIG');
  }
  const candidates = [];
  for (const offset of [-1, 0, 1]) {
    const date = ymd(addDays(now, offset));
    for (const { window } of ranges) {
      const slot = { date, start: window.start, end: window.end };
      const interval = parseWindow(slot);
      if (interval.endAt.getTime() > now.getTime()) candidates.push({ slot, ...interval });
    }
  }
  candidates.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return candidates.length ? candidates[0].slot : null;
}

module.exports = { nowCST, ymd, hm, addDays, parseDate, parseWindow, nextDutyWindow, isWithin };
