const { checkText } = require('../blacklist');

test.each(['请代买香烟', '请代买香 烟', '香\t\n烟', '香　烟', '香\u200b烟'])('识别空白及零宽变体 %p', text => {
  expect(checkText(text, ['香烟'])).toBe('香烟');
});

test.each(['ＵＳＢ', 'uSb', 'ｕ ｓ ｂ'])('识别大小写、全角变体 %p', text => {
  expect(checkText(text, ['USB'])).toBe('USB');
});

test('返回原始词条，按配置顺序匹配；空词条不会匹配一切', () => {
  expect(checkText('usb香烟', ['　', '香烟', 'USB'])).toBe('香烟');
  expect(checkText('USB', ['ＵＳＢ'])).toBe('ＵＳＢ');
  expect(checkText('请买牛奶', ['香烟'])).toBeNull();
  expect(checkText('', [])).toBeNull();
});

test('非法内容和配置明确报错', () => {
  expect(() => checkText(null, [])).toThrow(expect.objectContaining({ code: 'E_INVALID_PARAM' }));
  expect(() => checkText('牛奶', [null])).toThrow(expect.objectContaining({ code: 'E_CONFIG' }));
  expect(() => checkText('牛奶', null)).toThrow(expect.objectContaining({ code: 'E_CONFIG' }));
});
