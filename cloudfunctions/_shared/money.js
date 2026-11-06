const { integer } = require('./validate');

function yuan(fen) {
  integer(fen, '金额', -Number.MAX_SAFE_INTEGER);
  const amount = BigInt(fen < 0 ? -fen : fen);
  return (fen < 0 ? '-' : '') + (amount / 100n) + '.' + String(amount % 100n).padStart(2, '0');
}

function maskPhone(phone) {
  if (phone === null || phone === undefined || phone === '') return '';
  // 非标准号码不回显，避免格式异常时泄露原始个人信息。
  if (typeof phone !== 'string' || !/^1\d{10}$/.test(phone)) return '****';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

module.exports = { yuan, maskPhone };
