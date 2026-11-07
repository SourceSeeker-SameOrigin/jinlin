const { validateTemplate, couponDiscount } = require('../couponData');

function template(overrides = {}) {
  return validateTemplate({ name: '首发优惠', kind: 'amount_off', value: 200, maxOff: 200,
    threshold: 500, services: ['express', 'trash'], validDays: 30, totalLimit: 100,
    perUserLimit: 1, issueMode: 'claim', communityIds: 'all', status: 'active', ...overrides });
}

test('券模板金额、折扣、服务和发放限制校验', () => {
  expect(template().kind).toBe('amount_off');
  expect(() => template({ kind: 'percent_off', value: 100 })).toThrow();
  expect(() => template({ services: ['other'] })).toThrow();
  expect(() => template({ totalLimit: 0 })).toThrow();
});

test('券门槛、服务和小区范围均生效', () => {
  const value = template({ communityIds: ['c1'] });
  expect(couponDiscount(value, { serviceCode: 'express', communityId: 'c1', listPrice: 500 })).toBe(200);
  expect(couponDiscount(value, { serviceCode: 'help', communityId: 'c1', listPrice: 900 })).toBe(0);
  expect(couponDiscount(value, { serviceCode: 'express', communityId: 'c2', listPrice: 900 })).toBe(0);
  expect(couponDiscount(value, { serviceCode: 'express', communityId: 'c1', listPrice: 499 })).toBe(0);
});

test('空小区列表表示不适用于任何小区', () => {
  const value = template({ communityIds: [] });
  expect(couponDiscount(value, { serviceCode: 'express', communityId: 'c1', listPrice: 1000 })).toBe(0);
});
