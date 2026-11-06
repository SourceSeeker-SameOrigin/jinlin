const { orderTexts, checkLocal, ensureSafeResult } = require('../contentSafety');

test('仅检查规范要求的内容字段，空内容不发送', () => {
  expect(orderTexts('备注', { items: '清单', shop: '商店', desc: '帮助', pickupCodes: ['1234'] })).toEqual(['备注', '清单', '商店', '帮助']);
  expect(orderTexts('', { shop: '  ' })).toEqual([]);
});

test.each(['请带香烟', '香 烟', 'ＵＳＢ'])('禁止词变体被拦截：%s', content => {
  expect(() => checkLocal([content], ['香烟', 'usb'])).toThrow('暂不提供');
});

test('禁止清单损坏时不放行', () => {
  expect(() => checkLocal(['物品'], null)).toThrow('配置不正确');
  expect(() => checkLocal(['物品'], [42])).toThrow('配置不正确');
});

test.each([null, {}, { result: { suggest: 'review' } }, { result: { suggest: 'risky' } },
  { errCode: 87014, result: { suggest: 'pass' } }])('安全接口未明确通过时拒绝：%p', result => {
  expect(() => ensureSafeResult(result)).toThrow('安全检查');
});

test('安全接口明确通过', () => {
  expect(() => ensureSafeResult({ errCode: 0, result: { suggest: 'pass' } })).not.toThrow();
});
