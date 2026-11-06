const { parseScene, publicUser, providerSummary, validateAddress } = require('../profile');

test.each([['b=K3F9QA', 'b', 'K3F9QA'], ['r%3DP7M2XQ', 'r', 'P7M2XQ']])('解析合法来源 %s', (value, type, code) => {
  expect(parseScene(value)).toEqual({ type, code, scene: type + '=' + code });
});
test.each(['%xx', 'b=ABC', 'b=O12345', 'r=P7M2XQ&admin=true', '', null, {}])('非法来源不接受 %p', value => {
  expect(parseScene(value)).toBeNull();
});
test('用户公开资料仅包含白名单字段，不包含 openid、完整手机号和内部标记', () => {
  const result = publicUser({ _id: 'u', openid: 'secret', phone: '13800000000', roles: ['resident'], blocked: false,
    communityId: 'c', buildingId: 'b', buildingName: '3号楼', unit: '1单元', room: '302',
    source: { scene: 'b=K3F9QA', buildingId: 'b', referrerProviderId: 'private' } });
  expect(result.phone).toBe('138****0000');
  expect(result.hasPhone).toBe(true);
  expect(result).not.toHaveProperty('openid');
  expect(result).not.toHaveProperty('blocked');
  expect(result.source).not.toHaveProperty('referrerProviderId');
});
test('服务员摘要不暴露实名、手机号及身份证照片', () => {
  const summary = providerSummary({ _id: 'p', status: 'approved', level: 1, communityId: 'c', onDuty: true,
    insuranceUntil: null, realName: '测试姓名', phone: '13800000000', kycFileIds: ['private'] });
  expect(summary).toEqual({ _id: 'p', status: 'approved', level: 1, communityId: 'c', onDuty: true, insuranceUntil: null });
  expect(providerSummary(null)).toBeNull();
});
const community = { _id: 'c', status: 'active' };
const building = { _id: 'b', communityId: 'c', units: ['1单元', '2单元'] };
const address = { communityId: 'c', buildingId: 'b', unit: '1单元', room: ' 302 ', privacyAgreed: true };
test('门牌返回明确白名单字段，不采信角色和价格', () => {
  expect(validateAddress({ ...address, roles: ['admin'] }, community, building))
    .toEqual({ communityId: 'c', buildingId: 'b', unit: '1单元', room: '302' });
});
test.each([{ room: '' }, { room: '1'.repeat(31) }, { unit: '不存在' }, { privacyAgreed: false },
  { communityId: 'other' }, { buildingId: 'other' }])('拒绝无效门牌参数 %p', patch => {
  expect(() => validateAddress({ ...address, ...patch }, community, building)).toThrow(expect.objectContaining({ code: 'E_INVALID_PARAM' }));
});
test('跨小区楼栋和暂停小区不能绑定', () => {
  expect(() => validateAddress(address, community, { ...building, communityId: 'other' })).toThrow();
  expect(() => validateAddress(address, { ...community, status: 'paused' }, building)).toThrow();
});
