const { ensure, text } = require('./validate');

function reviewInput(event) {
  const applicationId = text(event.applicationId, '驿站申请');
  ensure(['approved', 'rejected'].includes(event.status), '审核结果不正确');
  const reviewNote = event.reviewNote === undefined ? '' : event.reviewNote;
  ensure(typeof reviewNote === 'string' && [...reviewNote].length <= 300, '审核说明格式不正确或超出长度限制');
  return { applicationId, status: event.status, reviewNote: reviewNote.trim() };
}

function stationGrant(user, communityId, stationCode, now = new Date()) {
  ensure(user && user.blocked !== true, '申请人账号状态异常', 'E_CONFLICT');
  const community = text(communityId, '小区');
  const station = text(stationCode, '驿站');
  const roles = Array.isArray(user.roles) ? user.roles : ['resident'];
  return { roles: [...new Set([...roles, 'station'])], stationCommunityId: community,
    stationCode: station, updatedAt: now };
}

module.exports = { stationGrant, reviewInput };
