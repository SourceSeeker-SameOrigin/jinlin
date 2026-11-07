const { ensure } = require('./validate');
const { ymd, hm } = require('./time');
const { SERVICE_NAMES } = require('./orderData');
const KEYS = ['newTask', 'accepted', 'delivered', 'unaccepted', 'visitReport'];
const EVENT_REMINDER_FIELDS = Object.freeze({ event: 'thing1', location: 'thing2', time: 'time3' });
const DEFAULT_FIELDS = Object.freeze({ orderNo: 'character_string1', service: 'thing2', status: 'phrase3', time: 'time4' });
const MESSAGES = { newTask: '待接单', accepted: '已接单', delivered: '待确认', unaccepted: '待处理', visitReport: '报告已提交' };
const truncate = (value, max) => [...String(value)].slice(0, max).join('');

function notificationData(key, order, now, fields = DEFAULT_FIELDS) {
  ensure(KEYS.includes(key), '通知类型不正确', 'E_CONFIG');
  const values = { orderNo: order.orderNo, service: (SERVICE_NAMES[order.serviceCode] || '月卡') + ' · ' +
    (order.address && order.address.buildingName || ''), status: MESSAGES[key], time: ymd(now) + ' ' + hm(now) };
  const result = {};
  const types = { orderNo: 'character_string', service: 'thing', status: 'phrase', time: 'time' };
  const limits = { orderNo: 32, service: 20, status: 5, time: 32 };
  for (const name of Object.keys(types)) {
    ensure(typeof fields[name] === 'string' && new RegExp('^' + types[name] + '\\d+$').test(fields[name]),
      '通知模板字段映射不正确', 'E_CONFIG');
    result[fields[name]] = { value: truncate(values[name], limits[name]) };
  }
  return result;
}
function publicTemplates(config) {
  return Object.fromEntries([...KEYS, 'eventReminder'].map(key => [key, config.templateIds && typeof config.templateIds[key] === 'string' ? config.templateIds[key] : '']));
}
function eventReminderData(event, fields = EVENT_REMINDER_FIELDS) {
  const result = {};
  const values = { event: event.title, location: event.location || '活动地点见详情',
    time: ymd(new Date(event.startAt)) + ' ' + hm(new Date(event.startAt)) };
  const types = { event: 'thing', location: 'thing', time: 'time' };
  const limits = { event: 20, location: 20, time: 32 };
  for (const name of Object.keys(types)) {
    ensure(typeof fields[name] === 'string' && new RegExp('^' + types[name] + '\\d+$').test(fields[name]),
      '活动提醒模板字段映射不正确', 'E_CONFIG');
    result[fields[name]] = { value: truncate(values[name], limits[name]) };
  }
  return result;
}
module.exports = { KEYS, DEFAULT_FIELDS, EVENT_REMINDER_FIELDS, notificationData, eventReminderData, publicTemplates };
