const { dispatch } = require('../dispatch');

describe('云函数 action 分发', () => {
  test.each([undefined, null, {}, { action: 'missing' }, { action: 'toString' }, { action: '__proto__' }])(
    '未知或非法操作不执行处理器：%p',
    (event) => {
      expect(dispatch({}, event)).toEqual({
        ok: false,
        code: 'E_UNKNOWN_ACTION',
        message: '暂不支持此操作'
      });
    }
  );

  test('只分发显式注册的操作并保留入参和上下文', async () => {
    const event = { action: 'example', value: 1 };
    const context = { requestId: 'test' };
    const handler = jest.fn(async () => ({ ok: true, data: 1 }));
    await expect(dispatch({ example: handler }, event, context)).resolves.toEqual({ ok: true, data: 1 });
    expect(handler).toHaveBeenCalledWith(event, context);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
