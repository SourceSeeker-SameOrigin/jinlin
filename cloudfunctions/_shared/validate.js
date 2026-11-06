const { AppError } = require('./errors');

function ensure(condition, message, code = 'E_INVALID_PARAM') {
  if (!condition) throw new AppError(code, message);
}

function record(value, label, code) {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), label + '格式不正确', code);
  return value;
}

function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER, code) {
  ensure(Number.isSafeInteger(value) && value >= min && value <= max, label + '必须是有效范围内的整数', code);
  return value;
}

function text(value, label, max = Infinity, code) {
  ensure(typeof value === 'string' && value.trim().length > 0 && [...value].length <= max,
    label + '不能为空或超出长度限制', code);
  return value;
}

module.exports = { ensure, record, integer, text };
