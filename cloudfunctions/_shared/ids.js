const crypto = require('node:crypto');
const { ymd, hm, parseDate } = require('./time');
const { ensure, text } = require('./validate');

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function orderNo(now) {
  const date = ymd(now).replace(/-/g, '').slice(2);
  const time = hm(now).replace(':', '') + String(now.getUTCSeconds()).padStart(2, '0');
  return 'JL' + date + time + String(crypto.randomInt(10000)).padStart(4, '0');
}

function shortCode() {
  return Array.from({ length: 6 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
}

function membershipTaskId(membershipId, date, slot) {
  text(membershipId, '月卡标识');
  // 复用真实日历校验，防止 2 月 30 日等输入形成错误幂等键。
  parseDate(date);
  ensure(['morning', 'evening'].includes(slot), '月卡时段不正确');
  return 'm_' + membershipId + '_' + date.replace(/-/g, '') + '_' + slot;
}

// 随机 ID 的全局唯一性由 SPEC 指定的数据库唯一索引兜底；调用方处理重复键重试。
module.exports = { orderNo, shortCode, membershipTaskId };
