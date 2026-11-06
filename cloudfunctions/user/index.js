const cloud = require('wx-server-sdk');
const crypto = require('node:crypto');
const { createServer } = require('./lib/shared/server');
const { publicUser, providerSummary, parseScene, validateAddress } = require('./lib/shared/profile');
const { ensure, text } = require('./lib/shared/validate');
const { issueAutomatic } = require('./lib/shared/couponFlow');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const server = createServer(cloud);
const { db, command, one, get } = server;

async function login(_, { openid }) {
  let user = await one('users', { openid });
  let created = false;
  if (!user) {
    const id = 'u_' + crypto.createHash('sha256').update(openid).digest('hex').slice(0, 32);
    const now = new Date();
    const document = { _id: id, openid, phone: '', roles: ['resident'], communityId: null,
      buildingId: null, unit: '', room: '', source: null, firstPaidAt: null, blocked: false,
      paidOrderCount: 0, firstPaidOrderId: null, addresses: [], pointsBalance: 0, couponCounts: {},
      mutedUntil: null, moderationNotices: [], createdAt: now, updatedAt: now };
    try {
      await db.collection('users').add({ data: document });
      user = document;
      created = true;
    } catch (error) {
      // 并发首次登录只创建一条；其余数据库异常保留给边界处理。
      user = await one('users', { openid });
      if (!user) throw error;
    }
  }
  ensure(!user.blocked, '账号暂不可用，请联系管理员', 'E_FORBIDDEN');
  if (created) {
    try { await server.feature('coupons', user.communityId); await issueAutomatic(server, openid, user.communityId || ''); }
    catch (error) { if (error.code !== 'E_FEATURE_OFF') throw error; }
  }
  const provider = await one('providers', { openid });
  const community = await get('communities', user.communityId);
  const building = await get('buildings', user.buildingId);
  const config = community ? await server.config() : null;
  return { profile: publicUser({ ...user, buildingName: building && building.name }), roles: user.roles,
    provider: providerSummary(provider), community: community ? { ...community, hotline: config.hotline } : null };
}

async function bindPhone(event, { openid }) {
  const user = await server.user(openid);
  text(event.code, '手机号授权码');
  const result = await cloud.openapi.phonenumber.getPhoneNumber({ code: event.code });
  const phone = result.phoneInfo && result.phoneInfo.purePhoneNumber;
  ensure(typeof phone === 'string' && /^1\d{10}$/.test(phone), '未取得有效手机号，请重新授权');
  await db.collection('users').doc(user._id).update({ data: { phone, updatedAt: new Date() } });
  return publicUser({ ...user, phone });
}

async function setAddress(event, { openid }) {
  const user = await server.user(openid);
  ensure(Boolean(user.phone), '请先授权手机号');
  const community = await get('communities', event.communityId);
  const building = await get('buildings', event.buildingId);
  const address = validateAddress(event, community, building);
  const addressId = 'addr_' + crypto.createHash('sha256').update([user._id, address.communityId, address.buildingId,
    address.unit, address.room].join(':')).digest('hex').slice(0, 16);
  const addresses = user.addresses || [];
  const savedAddress = { id: addressId, ...address, buildingName: building.name, contactName: event.contactName || '', contactPhone: event.contactPhone || user.phone,
    isDefault: true };
  ensure(typeof savedAddress.contactName === 'string' && [...savedAddress.contactName].length <= 30, '联系人姓名不能超过 30 字');
  ensure(/^1\d{10}$/.test(savedAddress.contactPhone), '请输入有效联系人手机号');
  const nextAddresses = [savedAddress, ...addresses.filter(item => item.id !== addressId).map(item => ({ ...item, isDefault: false }))].slice(0, 5);
  await db.collection('users').doc(user._id).update({ data: { ...address, addresses: nextAddresses, updatedAt: new Date() } });
  await db.collection('events').add({ data: { type: 'bind', openid, scene: user.source && user.source.scene || '',
    buildingId: address.buildingId, communityId: address.communityId,
    referrerProviderId: user.source && user.source.referrerProviderId || null, at: new Date() } });
  try { await server.feature('coupons', address.communityId); await issueAutomatic(server, openid, address.communityId); }
  catch (error) { if (error.code !== 'E_FEATURE_OFF') throw error; }
  return publicUser({ ...user, ...address, addresses: nextAddresses, buildingName: building.name });
}

async function recordScene(event, { openid }) {
  const user = await server.user(openid);
  const parsed = parseScene(event.scene);
  ensure(parsed, '二维码内容不正确');
  const target = parsed.type === 'b' ? await one('buildings', { shortCode: parsed.code })
    : await one('providers', { referralCode: parsed.code, status: 'approved' });
  ensure(target, '二维码已失效');
  const community = await get('communities', target.communityId);
  ensure(community && community.status === 'active', '小区暂不可用');
  const source = { scene: parsed.scene, buildingId: parsed.type === 'b' ? target._id : null,
    referrerProviderId: parsed.type === 'r' ? target._id : null, firstSeenAt: new Date() };
  await db.collection('users').where({ _id: user._id, source: command.eq(null) })
    .update({ data: { source, updatedAt: new Date() } });
  await db.collection('events').add({ data: { type: 'scan', openid, scene: parsed.scene,
    buildingId: source.buildingId, communityId: target.communityId,
    referrerProviderId: source.referrerProviderId, at: new Date() } });
  return { recorded: true };
}

exports.main = server.entry({ login, bindPhone, setAddress, recordScene });
