const crypto = require('crypto');
const { ensure, integer, text } = require('./validate');

const HOST = 'https://api.mch.weixin.qq.com';
const CREATE_PATH = '/v3/fund-app/mch-transfer/transfer-bills';
const MAX_SINGLE_AMOUNT = 200000;

function loadConfig(env = process.env) {
  const required = ['MCH_ID', 'MCH_SERIAL_NO', 'MCH_PRIVATE_KEY_B64', 'WXPAY_PUBLIC_KEY_B64',
    'WXPAY_PUBLIC_KEY_ID', 'MINI_APP_ID', 'TRANSFER_SCENE_ID', 'TRANSFER_JOB_TYPE', 'TRANSFER_REPORT_DESCRIPTION'];
  const missing = required.filter(key => typeof env[key] !== 'string' || !env[key].trim());
  ensure(missing.length === 0, '自动打款配置尚未完成：' + missing.join(', '), 'E_CONFIG');
  const transferSceneId = text(env.TRANSFER_SCENE_ID, '转账场景ID', 36);
  ensure(/^\d+$/.test(transferSceneId), '转账场景ID配置不正确', 'E_CONFIG');
  const privateKey = Buffer.from(env.MCH_PRIVATE_KEY_B64, 'base64').toString('utf8');
  const publicKey = Buffer.from(env.WXPAY_PUBLIC_KEY_B64, 'base64').toString('utf8');
  try { crypto.createPrivateKey(privateKey); crypto.createPublicKey(publicKey); }
  catch (_) { ensure(false, '微信支付密钥配置不正确', 'E_CONFIG'); }
  return { mchId: text(env.MCH_ID, '商户号', 32), serialNo: text(env.MCH_SERIAL_NO, '商户证书序列号', 64),
    privateKey, publicKey, publicKeyId: text(env.WXPAY_PUBLIC_KEY_ID, '微信支付公钥ID', 100),
    appId: text(env.MINI_APP_ID, '小程序AppID', 32), transferSceneId,
    jobType: text(env.TRANSFER_JOB_TYPE, '岗位类型报备', 32),
    reportDescription: text(env.TRANSFER_REPORT_DESCRIPTION, '报酬说明报备', 32), maxDailyCount: 1 };
}

function nonce() { return crypto.randomBytes(16).toString('hex'); }

function authorization({ method, path, body = '', config, timestamp = String(Math.floor(Date.now() / 1000)), nonceStr = nonce() }) {
  const content = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(content), config.privateKey).toString('base64');
  const header = `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.serialNo}"`;
  return { header, canonical: content, timestamp, nonceStr, signature };
}

function verifyResponse(headers, body, publicKey, publicKeyId) {
  const get = name => headers[name] || headers[name.toLowerCase()];
  const timestamp = get('wechatpay-timestamp');
  const nonceStr = get('wechatpay-nonce');
  const signature = get('wechatpay-signature');
  const serial = get('wechatpay-serial');
  ensure(timestamp && nonceStr && signature && serial === publicKeyId, '微信支付响应签名头不完整或公钥ID不匹配', 'E_PAYOUT');
  const message = `${timestamp}\n${nonceStr}\n${body}\n`;
  const valid = crypto.verify('RSA-SHA256', Buffer.from(message), publicKey, Buffer.from(signature, 'base64'));
  ensure(valid, '微信支付响应签名校验失败', 'E_PAYOUT');
  return true;
}

function encryptUserName(name, publicKey) {
  text(name, '服务员姓名', 60);
  return crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha1' }, Buffer.from(name, 'utf8')).toString('base64');
}

function payoutBody(payout, provider, config) {
  const body = { appid: config.appId, out_bill_no: payout._id, transfer_scene_id: config.transferSceneId,
    openid: payout.payeeOpenid, transfer_amount: payout.amount, transfer_remark: '社区服务报酬',
    user_recv_perception: '劳务报酬', transfer_scene_report_infos: [
      { info_type: '岗位类型', info_content: config.jobType },
      { info_type: '报酬说明', info_content: config.reportDescription }
    ] };
  if (payout.amount >= MAX_SINGLE_AMOUNT) body.user_name = encryptUserName(provider.realName, config.publicKey);
  return body;
}

function transferPath(outBillNo) {
  return '/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/' + encodeURIComponent(outBillNo);
}

function normalizeState(state) {
  const states = { ACCEPTED: 'processing', PROCESSING: 'processing', WAIT_USER_CONFIRM: 'wait_user_confirm',
    TRANSFERING: 'processing', SUCCESS: 'success', FAIL: 'failed', CANCELING: 'processing', CANCELLED: 'cancelled' };
  ensure(states[state], '微信支付返回未知转账状态', 'E_PAYOUT');
  return states[state];
}

module.exports = { HOST, CREATE_PATH, MAX_SINGLE_AMOUNT, loadConfig, nonce, authorization, verifyResponse,
  encryptUserName, payoutBody, transferPath, normalizeState };
