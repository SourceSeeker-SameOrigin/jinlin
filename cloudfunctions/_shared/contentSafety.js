const { checkText } = require('./blacklist');
const { ensure } = require('./validate');

function orderTexts(note, detail) {
  return [note, detail.items, detail.shop, detail.desc, detail.canteenName, detail.hospital, detail.department]
    .filter(value => typeof value === 'string' && value.trim());
}

function checkLocal(texts, blacklist) {
  ensure(Array.isArray(blacklist) && blacklist.every(item => typeof item === 'string'), '禁止清单配置不正确', 'E_CONFIG');
  for (const text of texts) {
    ensure(!checkText(text, blacklist), '该物品或服务暂不提供（如烟草、处方药、银行卡等）', 'E_BLOCKED');
  }
}

function ensureSafeResult(result) {
  ensure(result && (!result.errCode || result.errCode === 0) && result.result && result.result.suggest === 'pass',
    '内容未通过安全检查，请修改后再试', 'E_BLOCKED');
}

async function checkOrderContent(cloud, openid, note, detail, blacklist) {
  const texts = orderTexts(note, detail);
  checkLocal(texts, blacklist);
  for (const content of texts) {
    const response = await cloud.openapi.security.msgSecCheck({ openid, scene: 2, version: 2, content });
    ensureSafeResult(response);
  }
}

module.exports = { orderTexts, checkLocal, ensureSafeResult, checkOrderContent };
