const { visibleCommunityIds, canViewContent, filterVisible } = require('../visibility');

const communities = [
  { _id: 'a', status: 'active', federationGroupId: 'g1' },
  { _id: 'b', status: 'active', federationGroupId: 'g1' },
  { _id: 'c', status: 'active', federationGroupId: 'g2' },
  { _id: 'd', status: 'disabled', federationGroupId: 'g1' }
];

test('本小区范围只含本小区，联合范围只含同组启用小区', () => {
  expect(visibleCommunityIds('community', communities[0], communities)).toEqual(['a']);
  expect(visibleCommunityIds('federation', communities[0], communities)).toEqual(['a', 'b']);
  expect(visibleCommunityIds('federation', communities[2], communities)).toEqual(['c']);
});

test('付费任务不跨小区，隐藏内容不可见，普通联合内容按来源小区过滤', () => {
  const ids = visibleCommunityIds('federation', communities[0], communities);
  expect(canViewContent({ communityId: 'b', scope: 'federation' }, ids, { communityId: 'a' })).toBe(true);
  expect(canViewContent({ communityIds: ['a','b'], scope: 'federation' }, ids, { communityId: 'a' })).toBe(true);
  expect(canViewContent({ communityIds: ['a'], scope: 'community' }, ids, { communityId: 'a' })).toBe(true);
  expect(canViewContent({ communityId: 'b', scope: 'community' }, ids, { communityId: 'a' })).toBe(false);
  expect(canViewContent({ communityId: 'b', scope: 'federation' }, ids, { communityId: 'a', paidTask: true })).toBe(false);
  expect(filterVisible([{ communityId: 'a' }, { communityId: 'b', scope: 'federation' },
    { communityId: 'b', scope: 'federation', moderationHidden: true }], ids, { communityId: 'a' })).toHaveLength(2);
});
