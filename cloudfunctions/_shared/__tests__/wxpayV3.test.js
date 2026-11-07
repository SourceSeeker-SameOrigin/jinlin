const crypto = require('crypto');
const { authorization, verifyResponse, encryptUserName, payoutBody, normalizeState, loadConfig } = require('../wxpayV3');

const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+YdV/XRjHyTzv
1Y60/EYPbBCZL1XXGcXpxnynrcE2ZUqytCW88qdlc2eb6ko+qsf+jwUj7d3iraXP
BSvY6txKAl5EwYjBmr+d8VoDaPg3unrhJphgouLeLuNzmPEdQGbmOtoRNAr2WXWf
KLq4WkL/Qj0VUXv1lhSLnOtDRPYKaWwbpzfnXgQpupZtpBXDzKrQ/gKxpP6jML1H
qmC4YqdhV9wJdbSYz6tAFsQ51c0eIgoD9jjtp1DLf6H5sbmArE+Z0HGnpVSFgM/r
L5CpDOhsWkxtVnkeWO/vMXxk4pO0GVD1S/5++WuYS7mbjWZuQJRWIj+xBYmes9NA
/RCwDUWjAgMBAAECggEAObJhpxs6NtX8gzzH5n6r5uGbuCj5zVoQulP+lDya2Rbi
h/0DkNtDMwJCDKT5Ajv0p2eFqcldXOS+YtqQ2sj2oPFNy22RugbheobZ/j2SOCVq
NxDgziyfL7GrGe3oaLKLXMvKKbuJdPZQqL8Js3QbaMuUwoCy3g8xQ8x3GihsnmOk
etPMo8Yi2rtdINVKnLrLvpBV6oq05HPi6pXJ6AiK4AMmTiOiR5Pu1wbccoPVcw9m
zLIBtAlLhyeDv0km9TDfqVbdsl9ZXeIHuIHLGzkdqTTIHPbxtsEzDoHxmTh7dS5o
YvQWEWZo6O3mnjPn5hYTm2B3JqDg075i1mQSNTQhxQKBgQD/GsQwy+aLplJ8Ntlu
U4OiSFDHuVVg173Cr5BFGDdWkAxW/Ik6UoQd7yMtGwChOIUKZ2wu7O9kYQ/xTb9e
ycx9Qesxh3ftrBaLQpQbGVuFIiALSqdka80IKnQ4slqGu+Ql6s8RfJ6DPXxx6IVg
c6ULURK+hEzNyQON/PM96iiBxwKBgQC/DOiuHMpsozbrNfe9y3VpUI/wlMj2kUNw
RFn0eGtdFLs1HtcxK6GGQOBDYWo8d6nTOd/baFd3RbvLx8T7JHyaH8TVYvz8kwje
gsH9fb+KsDH5tNw5IgBD+2cUPK1vBBswX1npcGW+Vns44BeFeR9U9EcfEsZxKMN2
LUvkdBtdRQKBgHqsSWnZs2y2N3Yp/hbyrBsuwUG52teuBz+Go07GnV3P+U8fM3JL
WeL3Kyg2ku/0OO3O3BQYtenETyFPrNYNHnuhZlMz/LTbCyA+jPAXGo6D4XrslGBT
Ao6Js8fL5IJj+gtNxfN3xNYBjEVOdkzyb4xomSXqgvB2WHJAEExWvNHjAoGAIgjP
rqzMVtwgnXhIwRPsv60tZ0NqJZqtM+PJTqbhIXze+NCcr1LBfKQ0D2zcOxdqNonZ
2kFVS5ctpFjbO449cEt2ijkPLoOXEeSjYGA1biSDUqOok7j96R5xN4azstI9cbma
z95JEcZgPzqUlh+EuGKoBN4YYfJMF9Jr8a/JbC0CgYEAq8hB3pASK+ykylAQDrz1
hXPqrUupasbYXluK4lZOGRu4JptMS14wCQ4/XUGAnVKVHwdDTOkPlfxWoIPwx7QE
82yeOjiTILl4PF2E9PUhTYeCH2NZCmf3JsrU/SxWFhUIYrX/WzhAIZZinkHnUdG4
eqEU4lLv18h/LP8iUMmgz+A=
-----END PRIVATE KEY-----`;
const publicKey = crypto.createPublicKey(privateKey);
const config = { mchId: '1900000001', serialNo: 'TESTCERTSERIAL', privateKey,
  publicKey, publicKeyId: 'PUB_KEY_ID_TEST', appId: 'wx-test', transferSceneId: '1005',
  jobType: '社区服务员', reportDescription: '社区上门服务报酬' };

test('APIv3 请求签名串和 Authorization 与固定测试密钥的已知签名一致', () => {
  const result = authorization({ method: 'POST', path: '/v3/fund-app/mch-transfer/transfer-bills',
    body: '{"amount":5000}', config, timestamp: '1735689600', nonceStr: 'fixed-nonce' });
  expect(result.canonical).toBe('POST\n/v3/fund-app/mch-transfer/transfer-bills\n1735689600\nfixed-nonce\n{"amount":5000}\n');
  expect(result.signature).toBe('kdpzM0RQNeiSEq+RLwdQvmSJehvmx+9J++HpJ65xiQLEKFuUYJ10Glnv7bp1WKms+RihgEwo9jUKSi3TdKQgdIgFkZUVYEw8lf9upwcjrqNpPhnlePvuyKgdx//XKqZHKNzUr3Q1yQj/BiJbQln2kFKvVdWlWUxuMX+FTbDJc6O/MTF4Otkf9biRXnz1iLB9bJ3MpwFycdEbiamC8gztj+WC6v12X0NzgNdXhhAc2aDXu6ABZT8pE2KisNFEArfvEunalj4Zsg178BC//ywm3ABw1Mt9RAtel27aCzbwx0itYUmGwYftb83XMs0YcShG4do3zwtLwQrGXoVbPbfObA==');
  expect(result.header).toContain('WECHATPAY2-SHA256-RSA2048');
});

test('响应签名验真，公钥ID不一致或签名篡改时拒绝', () => {
  const body = '{"out_bill_no":"bill1","state":"SUCCESS"}';
  const timestamp = '1735689600', nonce = 'response-nonce';
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64');
  const headers = { 'wechatpay-timestamp': timestamp, 'wechatpay-nonce': nonce,
    'wechatpay-signature': signature, 'wechatpay-serial': config.publicKeyId };
  expect(verifyResponse(headers, body, publicKey, config.publicKeyId)).toBe(true);
  expect(() => verifyResponse({ ...headers, 'wechatpay-serial': 'other' }, body, publicKey, config.publicKeyId)).toThrow();
  expect(() => verifyResponse(headers, body + ' ', publicKey, config.publicKeyId)).toThrow();
});

test('2000元收款姓名按 RSA-OAEP 加密；发起报备按佣金报酬场景', () => {
  const item = { _id: 'bill1', payeeOpenid: 'openid', amount: 200000 };
  const body = payoutBody(item, { realName: '测试服务员' }, config);
  expect(body.transfer_scene_id).toBe('1005');
  expect(body.transfer_scene_report_infos).toEqual([{ info_type: '岗位类型', info_content: '社区服务员' },
    { info_type: '报酬说明', info_content: '社区上门服务报酬' }]);
  expect(crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha1' }, Buffer.from(body.user_name, 'base64')).toString()).toBe('测试服务员');
  expect(payoutBody({ ...item, amount: 199999 }, { realName: '测试服务员' }, config)).not.toHaveProperty('user_name');
});

test('卖家打款采用商品收入用途且不提交未核验姓名', () => {
  const body = payoutBody({ _id: 'seller-bill', payeeOpenid: 'seller-openid', payeeType: 'seller', amount: 199999 }, {}, config);
  expect(body).toMatchObject({ transfer_remark: '闲置商品销售款', user_recv_perception: '商品销售收入' });
  expect(body).not.toHaveProperty('user_name');
});

test('新版转账状态与配置缺失保护', () => {
  expect(normalizeState('WAIT_USER_CONFIRM')).toBe('wait_user_confirm');
  expect(normalizeState('SUCCESS')).toBe('success');
  expect(normalizeState('CANCELLED')).toBe('cancelled');
  expect(() => normalizeState('UNKNOWN')).toThrow();
  expect(() => loadConfig({})).toThrow(expect.objectContaining({ code: 'E_CONFIG' }));
});
