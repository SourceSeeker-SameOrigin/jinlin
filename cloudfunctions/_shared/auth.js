const { AppError } = require('./errors');

function deny() {
  throw new AppError('E_FORBIDDEN', '暂无权限执行此操作');
}

function validUser(user) {
  return user && !Array.isArray(user) && Array.isArray(user.roles) && user.roles.length > 0 &&
    user.roles.every(role => typeof role === 'string' && role.length > 0) && user.blocked !== true;
}

// user/provider 必须来自服务端查询；这些纯函数不接受前端自报的身份作为可信来源。
function requireRole(user, roles) {
  if (!validUser(user) || !Array.isArray(roles) || roles.length === 0 ||
      !roles.some(role => typeof role === 'string' && user.roles.includes(role))) deny();
}

function requireCommunityAccess(user, communityId) {
  if (!validUser(user) || typeof communityId !== 'string' || !communityId.trim()) deny();
  if (user.roles.includes('admin')) return;
  if (user.communityId !== communityId) deny();
}

function requireApprovedProvider(provider, minLevel) {
  if (!provider || provider.status !== 'approved' || ![1, 2].includes(provider.level) ||
      ![1, 2].includes(minLevel) || provider.level < minLevel) deny();
}

module.exports = { requireRole, requireCommunityAccess, requireApprovedProvider };
