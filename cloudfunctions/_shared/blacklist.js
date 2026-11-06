const { ensure } = require('./validate');

function normalize(text) {
  return text.normalize('NFKC').toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]+/gu, '');
}

function checkText(text, list) {
  ensure(typeof text === 'string', '待检查内容必须是文字');
  ensure(Array.isArray(list) && list.every(word => typeof word === 'string'), '黑名单配置不正确', 'E_CONFIG');
  const normalized = normalize(text);
  for (const word of list) {
    const keyword = normalize(word);
    if (keyword && normalized.includes(keyword)) return word;
  }
  return null;
}

module.exports = { checkText };
