const { ensure } = require('./validate');

function payConfig(mode, env = process.env, report = names => console.error('缺少支付环境变量:', names.join(', '))) {
  ensure(['mock', 'wechat'].includes(mode), '支付模式配置不正确', 'E_CONFIG');
  const required = mode === 'wechat' ? ['SUB_MCH_ID', 'ENV_ID', 'ALLOW_MOCK_PAY'] : ['ALLOW_MOCK_PAY'];
  const missing = required.filter(name => typeof env[name] !== 'string' || !env[name].trim());
  if (missing.length) report(missing);
  ensure(missing.length === 0, '支付配置尚未完成，请联系管理员', 'E_CONFIG');
  ensure(['true', 'false'].includes(env.ALLOW_MOCK_PAY), '模拟支付开关配置不正确', 'E_CONFIG');
  if (mode === 'mock') ensure(env.ALLOW_MOCK_PAY === 'true', '模拟支付未开启，请联系管理员', 'E_CONFIG');
  return { subMchId: env.SUB_MCH_ID, envId: env.ENV_ID };
}

module.exports = { payConfig };
