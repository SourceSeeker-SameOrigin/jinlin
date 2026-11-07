const { ensure, text } = require('./validate');

function stationGrant(user, communityId, stationCode, now = new Date()) {
  ensure(user && user.blocked !== true, '申请人账号状态异常', 'E_CONFLICT');
  const community = text(communityId, '小区');
  const station = text(stationCode, '驿站');
  const roles = Array.isArray(user.roles) ? user.roles : ['resident'];
  return { roles: [...new Set([...roles, 'station'])], stationCommunityId: community,
    stationCode: station, updatedAt: now };
}

module.exports = { stationGrant };
