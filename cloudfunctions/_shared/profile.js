const { text, ensure } = require('./validate');
const { maskPhone } = require('./money');

function parseScene(scene) {
  if (typeof scene !== 'string' || !scene) return null;
  let decoded;
  try { decoded = decodeURIComponent(scene); } catch (_) { return null; }
  const match = /^([br])=([2-9A-HJ-NP-Z]{6})$/.exec(decoded);
  return match ? { type: match[1], code: match[2], scene: decoded } : null;
}

function publicUser(user) {
  return {
    _id: user._id, phone: maskPhone(user.phone), hasPhone: Boolean(user.phone), roles: user.roles,
    pointsBalance: user.pointsBalance || 0,
    communityId: user.communityId || null, buildingId: user.buildingId || null,
    buildingName: user.buildingName || '',
    unit: user.unit || '', room: user.room || '', firstPaidAt: user.firstPaidAt || null,
    source: user.source ? { scene: user.source.scene, buildingId: user.source.buildingId || null } : null,
    moderationNotices: (user.moderationNotices || []).slice(-10),
    addresses: (user.addresses || []).slice(0, 5).map(item => ({ id: item.id, communityId: item.communityId,
      buildingId: item.buildingId, buildingName: item.buildingName || '', unit: item.unit, room: item.room,
      contactName: item.contactName || '', contactPhone: maskPhone(item.contactPhone), isDefault: item.isDefault === true }))
  };
}

function providerSummary(provider) {
  return provider ? { _id: provider._id, status: provider.status, level: provider.level,
    communityId: provider.communityId, onDuty: provider.onDuty, insuranceUntil: provider.insuranceUntil } : null;
}

function validateAddress(input, community, building) {
  text(input.communityId, '小区');
  text(input.buildingId, '楼栋');
  text(input.unit, '单元', 30);
  text(input.room, '门牌号', 30);
  ensure(community && community._id === input.communityId && community.status === 'active', '该小区暂不可用');
  ensure(building && building._id === input.buildingId && building.communityId === community._id,
    '楼栋不属于所选小区');
  ensure(Array.isArray(building.units) && building.units.includes(input.unit), '请选择有效单元');
  ensure(input.privacyAgreed === true, '请先同意隐私政策和服务协议');
  return { communityId: community._id, buildingId: building._id, unit: input.unit, room: input.room.trim() };
}

module.exports = { parseScene, publicUser, providerSummary, validateAddress };
