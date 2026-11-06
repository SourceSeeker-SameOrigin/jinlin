const { encryptSecret, decryptSecret } = require('../crypto');
const key = '0123456789abcdef'.repeat(4);
test('AES-256-GCM 密码加解密，密文不包含原文并验证篡改', () => {
  const value = 'Door-1234';
  const encrypted = encryptSecret(value, key, Buffer.from('0123456789abcdef01234567', 'hex'));
  expect(JSON.stringify(encrypted)).not.toContain(value);
  expect(decryptSecret(encrypted, key)).toBe(value);
  expect(() => decryptSecret({ ...encrypted, ciphertext: encrypted.ciphertext.replace(/^./, '0') }, key)).toThrow();
  expect(() => encryptSecret(value, 'short')).toThrow('64 位');
});
