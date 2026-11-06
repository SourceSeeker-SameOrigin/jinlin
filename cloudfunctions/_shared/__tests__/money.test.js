const { yuan, maskPhone } = require('../money');

test.each([[350, '3.50'], [1, '0.01'], [0, '0.00'], [-167, '-1.67'], [-1, '-0.01'],
  [Number.MAX_SAFE_INTEGER, '90071992547409.91']])('整数分 %p 显示为 %s 元', (fen, expected) => {
  expect(yuan(fen)).toBe(expected);
});

test.each([1.1, '350', NaN, Infinity, null, Number.MAX_SAFE_INTEGER + 1])('拒绝非法金额 %p', value => {
  expect(() => yuan(value)).toThrow(expect.objectContaining({ code: 'E_INVALID_PARAM' }));
});

test.each([['13800000000', '138****0000'], [null, ''], [undefined, ''], ['', ''],
  ['123', '****'], [13800000000, '****'], ['13800000000 extra', '****']])('手机号只返回打码结果 %p', (phone, expected) => {
  expect(maskPhone(phone)).toBe(expected);
});
