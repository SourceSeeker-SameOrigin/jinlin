const { ensure } = require('./validate');

function visibleCommunityIds(scope, community, communities) {
  ensure(scope === 'community' || scope === 'federation', '可见范围不正确');
  ensure(community && community._id, '小区不存在');
  if (scope === 'community' || !community.federationGroupId) return [community._id];
  const members = (communities || []).filter(item => item && item.status === 'active' &&
    item.federationGroupId === community.federationGroupId).map(item => item._id);
  return [...new Set([community._id, ...members])];
}

function canViewContent(item, communityIds, options = {}) {
  if (!item || item.moderationHidden === true) return false;
  if (options.paidTask === true && item.communityId !== options.communityId) return false;
  const sources = Array.isArray(item.communityIds) ? item.communityIds : [item.communityId];
  if (item.scope !== 'federation') return sources.includes(options.communityId);
  return Array.isArray(communityIds) && sources.some(id => communityIds.includes(id));
}

function filterVisible(items, communityIds, options = {}) {
  return (items || []).filter(item => canViewContent(item, communityIds, options));
}

module.exports = { visibleCommunityIds, canViewContent, filterVisible };
