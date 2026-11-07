const { stationGrant } = require('../stationApplications');

test('驿站审核授权保留住户小区和既有角色', () => {
  const resident = { _id: 'u1', communityId: 'home-community', roles: ['resident'] };
  const patch = stationGrant(resident, 'station-community', 'S2', new Date('2026-11-07T00:00:00Z'));
  expect(patch).toEqual({ roles: ['resident', 'station'], stationCommunityId: 'station-community',
    stationCode: 'S2', updatedAt: new Date('2026-11-07T00:00:00Z') });
  expect(resident.communityId).toBe('home-community');
});

test('驿站角色授权幂等且不移除其他角色', () => {
  expect(stationGrant({ roles: ['resident', 'provider', 'station'] }, 'c1', 'S1').roles)
    .toEqual(['resident', 'provider', 'station']);
});
