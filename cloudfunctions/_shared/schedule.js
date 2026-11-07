const { ensure, record, integer } = require('./validate');
const { parseDate, ymd } = require('./time');

function dueTasks(membership, plan, today) {
  record(membership, '月卡'); record(plan, '月卡计划');
  const date = parseDate(today);
  const schedule = plan.schedule || { type: 'daily' };
  record(schedule, '排期规则', 'E_CONFIG');
  ensure(['daily','weekly','monthly'].includes(schedule.type), '排期类型不正确', 'E_CONFIG');
  let due = schedule.type === 'daily';
  if (schedule.type === 'weekly') {
    ensure(Array.isArray(schedule.weekdays) && schedule.weekdays.length > 0, '每周排期缺少星期', 'E_CONFIG');
    schedule.weekdays.forEach(day => integer(day, '星期', 1, 7, 'E_CONFIG'));
    const weekday = new Date(today + 'T12:00:00Z').getUTCDay() || 7;
    due = schedule.weekdays.includes(weekday);
  }
  if (schedule.type === 'monthly') {
    ensure(Array.isArray(schedule.days) && schedule.days.length > 0, '每月排期缺少日期', 'E_CONFIG');
    schedule.days.forEach(day => integer(day, '每月日期', 1, 31, 'E_CONFIG'));
    due = schedule.days.includes(Number(today.slice(8, 10)));
  }
  const skips = new Set(membership.skipDates || []);
  if (!due || skips.has(today)) return [];
  const slots = ['morning','afternoon','evening'];
  ensure(slots.includes(membership.slot), '月卡时段不正确', 'E_CONFIG');
  return [{ date: today, slot: membership.slot, _id: 'm_' + membership._id + '_' + today.replace(/-/g, '') + '_' + membership.slot }];
}

function daysInMonth(year, monthIndex) { return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(); }
function monthDates(year, monthIndex, days) {
  const max = daysInMonth(year, monthIndex);
  return days.filter(day => day <= max).map(day => ymd(new Date(Date.UTC(year, monthIndex, day, 4))));
}

module.exports = { dueTasks, daysInMonth, monthDates };
