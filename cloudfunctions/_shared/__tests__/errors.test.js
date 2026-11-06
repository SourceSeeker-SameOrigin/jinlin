const { AppError, wrap } = require('../errors');

test('业务错误保留明确的中文信息和错误码', async () => {
  const error = new AppError('E_FORBIDDEN', '暂无权限');
  expect(error).toBeInstanceOf(Error);
  await expect(wrap(() => { throw error; })()).resolves.toEqual({ ok: false, code: 'E_FORBIDDEN', message: '暂无权限' });
});

test.each([new Error('包含私钥的内部消息'), { code: 'E_FAKE', message: '内部信息' }, null, '数据库失败',
  new AppError('INVALID', '内部信息')])('未知异常不泄露内部信息：%p', async error => {
  const handler = wrap(async () => { throw error; });
  await expect(handler()).resolves.toEqual({ ok: false, code: 'E_INTERNAL', message: '服务开小差了，请稍后再试' });
});

test('异步业务错误也被包装', async () => {
  await expect(wrap(async () => { throw new AppError('E_CONFLICT', '单已被接走'); })())
    .resolves.toEqual({ ok: false, code: 'E_CONFLICT', message: '单已被接走' });
});

test('成功结果只包装一次，并透传参数与 this', async () => {
  const context = { value: 3 };
  const handler = wrap(function (a, b) { return this.value + a + b; });
  await expect(handler.call(context, 4, 5)).resolves.toEqual({ ok: true, data: 12 });
  await expect(wrap(async () => ({ orderId: 'test' }))()).resolves.toEqual({ ok: true, data: { orderId: 'test' } });
});
