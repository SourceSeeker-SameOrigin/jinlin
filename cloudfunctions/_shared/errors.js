class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

// handler 返回业务数据；在云函数边界包装一次，兼容同步和异步处理器。
function wrap(handler) {
  return async function (...args) {
    try {
      return { ok: true, data: await handler.apply(this, args) };
    } catch (error) {
      if (error instanceof AppError && /^E_[A-Z0-9_]+$/.test(error.code)) {
        return { ok: false, code: error.code, message: error.message };
      }
      return { ok: false, code: 'E_INTERNAL', message: '服务开小差了，请稍后再试' };
    }
  };
}

module.exports = { AppError, wrap };
