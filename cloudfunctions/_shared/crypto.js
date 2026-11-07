const crypto = require('crypto');
const { ensure, text } = require('./validate');

function keyBytes(secretKey) {
  ensure(typeof secretKey === 'string' && /^[a-f\d]{64}$/i.test(secretKey), 'SECRET_KEY 必须是 64 位十六进制的 32 字节密钥', 'E_CONFIG');
  return Buffer.from(secretKey, 'hex');
}
function encryptSecret(value, secretKey, iv = crypto.randomBytes(12)) {
  text(value, '门锁密码', 100);
  ensure(Buffer.isBuffer(iv) && iv.length === 12, '加密随机数长度不正确', 'E_CONFIG');
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(secretKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { algorithm: 'AES-256-GCM', iv: iv.toString('hex'), ciphertext: ciphertext.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}
function decryptSecret(record, secretKey) {
  ensure(record && record.algorithm === 'AES-256-GCM' && /^[a-f\d]{24}$/i.test(record.iv) && /^[a-f\d]{32}$/i.test(record.tag) &&
    typeof record.ciphertext === 'string' && /^(?:[a-f\d]{2})+$/i.test(record.ciphertext), '密文格式不正确', 'E_CONFIG');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(secretKey), Buffer.from(record.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(record.tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'hex')), decipher.final()]).toString('utf8');
}
module.exports = { encryptSecret, decryptSecret };
