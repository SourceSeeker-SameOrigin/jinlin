const { stationGrant, reviewInput } = require('../stationApplications');

test.each(['approved', 'rejected'])('审核 %s 允许不填写说明', status => {
  for (const reviewNote of [undefined, '', '  ']) {
    expect(reviewInput({ applicationId: 'a1', status, reviewNote }))
      .toEqual({ applicationId: 'a1', status, reviewNote: '' });
  }
});

test('审核说明保留有效文字并拒绝非法格式、超长内容及无效结果', () => {
  const input = { applicationId: 'a1', status: 'rejected', reviewNote: ' 请补充材料 ' };
  expect(reviewInput(input).reviewNote).toBe('请补充材料');
  for (const reviewNote of [null, 1, {}, '字'.repeat(301)]) {
    expect(() => reviewInput({ ...input, reviewNote })).toThrow();
  }
  expect(() => reviewInput({ ...input, status: 'pending' })).toThrow();
  expect(() => reviewInput({ ...input, applicationId: '' })).toThrow();
});

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
