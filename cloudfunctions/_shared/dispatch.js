// T00 只提供空路由。后续任务在注册业务 action 时接入身份与角色校验。
function dispatch(actions, event = {}, context) {
  const action = event && event.action;
  if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(actions, action)) {
    return { ok: false, code: 'E_UNKNOWN_ACTION', message: '暂不支持此操作' };
  }
  return actions[action](event, context);
}

module.exports = { dispatch };
