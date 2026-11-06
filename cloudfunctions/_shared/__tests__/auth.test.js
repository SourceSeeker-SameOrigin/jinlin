const { requireRole, requireCommunityAccess, requireApprovedProvider } = require('../auth');

test('多个角色中任意一个满足允许列表即可', () => {
  expect(() => requireRole({ roles: ['resident', 'admin'] }, ['admin'])).not.toThrow();
  expect(() => requireRole({ roles: ['property'] }, ['admin', 'property'])).not.toThrow();
});

test.each([null, {}, { roles: 'admin' }, { roles: [] }, { roles: ['resident'] },
  { roles: ['admin'], blocked: true }])('拒绝无权或异常用户 %p', user => {
  expect(() => requireRole(user, ['admin'])).toThrow(expect.objectContaining({ code: 'E_FORBIDDEN' }));
});

test('未给允许角色时不放行', () => {
  expect(() => requireRole({ roles: ['admin'] }, [])).toThrow(expect.objectContaining({ code: 'E_FORBIDDEN' }));
});

test('物业只能访问本小区，管理员可跨小区', () => {
  const property = { roles: ['resident', 'property'], communityId: 'A' };
  expect(() => requireCommunityAccess(property, 'A')).not.toThrow();
  expect(() => requireCommunityAccess(property, 'B')).toThrow(expect.objectContaining({ code: 'E_FORBIDDEN' }));
  expect(() => requireCommunityAccess({ roles: ['property', 'admin'], communityId: 'A' }, 'B')).not.toThrow();
});

test('缺失小区或未认证用户不能因两个 undefined 相等而通过', () => {
  expect(() => requireCommunityAccess({ roles: ['property'] }, undefined)).toThrow(expect.objectContaining({ code: 'E_FORBIDDEN' }));
  expect(() => requireCommunityAccess(null, 'A')).toThrow(expect.objectContaining({ code: 'E_FORBIDDEN' }));
  expect(() => requireCommunityAccess({ roles: ['admin'] }, '')).toThrow(expect.objectContaining({ code: 'E_FORBIDDEN' }));
});

test.each([[1, 1], [2, 1], [2, 2]])('已审核 %i 级服务员可接最低 %i 级任务', (level, minLevel) => {
  expect(() => requireApprovedProvider({ status: 'approved', level }, minLevel)).not.toThrow();
});

test.each([[{ status: 'pending', level: 2 }, 1], [{ status: 'suspended', level: 2 }, 1],
  [{ status: 'rejected', level: 2 }, 1], [{ status: 'approved', level: 1 }, 2],
  [{ status: 'approved', level: '2' }, 1], [{ status: 'approved', level: 2 }, undefined], [null, 1]])(
  '未审核、等级不足或异常输入不放行 %p', (provider, minLevel) => {
    expect(() => requireApprovedProvider(provider, minLevel)).toThrow(expect.objectContaining({ code: 'E_FORBIDDEN' }));
  });
