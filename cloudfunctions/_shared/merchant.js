const { ensure, integer, record, text } = require('./validate');
const { listView } = require('./orderData');

const CATEGORIES = Object.freeze(['housekeeping', 'repair', 'laundry', 'locksmith', 'haul', 'canteen', 'recycler', 'other']);
const CATEGORY_NAMES = Object.freeze({ housekeeping: '家政', repair: '维修', laundry: '洗衣', locksmith: '开锁',
  haul: '清运', canteen: '食堂', recycler: '回收企业', other: '其他' });

function application(event, user, community) {
  record(event, '入驻资料');
  ensure(community && community.status === 'active', '请选择有效小区');
  const name = text(event.name, '商家名称', 60).trim();
  const category = event.category;
  ensure(CATEGORIES.includes(category), '商家类别不正确');
  const licenseFileId = text(event.licenseFileId, '营业执照文件', 500);
  ensure(/^cloud:\/\//.test(licenseFileId), '请上传营业执照照片');
  const licenseInfo = record(event.licenseInfo, '营业执照信息');
  const licenseName = text(licenseInfo.name, '执照名称', 100).trim();
  const creditCode = text(licenseInfo.creditCode, '统一社会信用代码', 32).trim().toUpperCase();
  ensure(/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(creditCode), '统一社会信用代码格式不正确');
  const contactName = text(event.contactName, '联系人', 40).trim();
  ensure(/^1\d{10}$/.test(event.phone || ''), '联系电话格式不正确');
  return { name, category, licenseFileId, licenseInfo: { name: licenseName, creditCode }, contactName,
    phone: event.phone, staffOpenids: [user.openid], communityIds: [community._id], commissionRate: 0.10,
    status: 'pending', ratingSum: 0, ratingCount: 0 };
}

function service(event) {
  record(event, '服务资料');
  const title = text(event.title, '服务名称', 60).trim();
  const desc = event.desc === undefined ? '' : event.desc;
  ensure(typeof desc === 'string' && [...desc].length <= 500, '服务说明不能超过 500 字');
  ensure(Array.isArray(event.images || []) && (event.images || []).length <= 9 &&
    (event.images || []).every(item => typeof item === 'string' && /^cloud:\/\//.test(item)), '服务图片不正确');
  ensure(['fixed', 'quote'].includes(event.priceType), '请选择固定价或报价');
  const price = event.priceType === 'fixed' ? integer(event.price, '服务价格', 1, 100000000) : 0;
  const unit = text(event.unit || '次', '计价单位', 20).trim();
  ensure(['on', 'off'].includes(event.status || 'off'), '服务状态不正确');
  return { title, desc: desc.trim(), images: event.images || [], priceType: event.priceType, price, unit, status: event.status || 'off' };
}

function quoteAmount(payAmount, commissionRate, propertyRate) {
  integer(payAmount, '实收金额', 0, 100000000);
  ensure(Number.isFinite(commissionRate) && commissionRate >= 0 && commissionRate <= 1, '商家佣金比例配置不正确', 'E_CONFIG');
  ensure(Number.isFinite(propertyRate) && propertyRate >= 0 && propertyRate <= 1, '物业分成比例配置不正确', 'E_CONFIG');
  ensure(commissionRate * propertyRate <= 1, '分成比例配置不正确', 'E_CONFIG');
  const commission = Math.floor(payAmount * Math.round(commissionRate * 10000) / 10000);
  const property = Math.floor(commission * Math.round(propertyRate * 10000) / 10000);
  return { gross: payAmount, merchant: payAmount - commission, property, platform: commission - property, commission };
}

function visibleMerchant(merchant) {
  return { _id: merchant._id, name: merchant.name, category: merchant.category, categoryName: CATEGORY_NAMES[merchant.category] || '其他', licenseInfo: merchant.licenseInfo,
    communityIds: merchant.communityIds, ratingSum: merchant.ratingSum || 0, ratingCount: merchant.ratingCount || 0 };
}

function visibleService(item, viewerOpenid = '') {
  const { visibleImages } = require('./ugc');
  return { _id: item._id, merchantId: item.merchantId, title: item.title, desc: item.desc,
    images: visibleImages(item, viewerOpenid, item.ownerOpenid),
    priceType: item.priceType, price: item.price, unit: item.unit, status: item.status };
}

function locksmithStartCheck(order, confirmed, openid, now = new Date()) {
  if (order.detail?.category !== 'locksmith') return {};
  ensure(confirmed === true, '请先当面核验下单人身份证与门牌一致，再开始开锁服务');
  return { identityCheck: { passed: true, checkedBy: text(openid, '核验人'), checkedAt: now } };
}

function requireLocksmithCheck(order) {
  if (order.detail?.category === 'locksmith') {
    ensure(order.identityCheck?.passed === true && order.identityCheck.checkedBy && order.identityCheck.checkedAt,
      '该开锁订单缺少当面身份核验记录，请联系管理员', 'E_BAD_STATE');
  }
}

function merchantOrderView(order) {
  const address = order.address || {};
  const quote = order.quote || null;
  const detail = order.detail || {};
  return { ...listView(order),
    quote: quote ? { amount: quote.amount, detail: quote.detail, at: quote.at || null } : null,
    address: { buildingName: address.buildingName, unit: address.unit, room: address.room,
      ...(address.contactName ? { contactName: address.contactName } : {}),
      ...(address.contactPhone ? { contactPhone: address.contactPhone } : {}) },
    note: order.note || '',
    identityChecked: order.identityCheck?.passed === true,
    detail: { title: detail.title, desc: detail.desc, category: detail.category,
      merchantName: detail.merchantName, serviceId: detail.serviceId, priceType: detail.priceType, unit: detail.unit },
    photos: Array.isArray(order.photos) ? order.photos.slice(0, 3) : [] };
}

module.exports = { CATEGORIES, CATEGORY_NAMES, application, service, quoteAmount, visibleMerchant, visibleService, merchantOrderView,
  locksmithStartCheck, requireLocksmithCheck };
