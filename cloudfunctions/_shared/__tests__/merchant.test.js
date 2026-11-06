const { application, service, quoteAmount, visibleMerchant, visibleService } = require('../merchant');

test('商家入驻验证营业执照并只开放申请所属小区', () => {
  const value = application({ name: '安心维修', category: 'repair', licenseFileId: 'cloud://license',
    licenseInfo: { name: '安心维修部', creditCode: '91110108MA01ABCD2X' }, contactName: '张师傅', phone: '13800138000' },
  { openid: 'openid-1' }, { _id: 'community-1', status: 'active' });
  expect(value.status).toBe('pending');
  expect(value.communityIds).toEqual(['community-1']);
  expect(() => application({ name: 'x', category: 'repair', licenseFileId: 'local.png', licenseInfo: {
    name: '安心维修部', creditCode: '91110108MA01ABCD2X' }, contactName: '张师傅', phone: '13800138000' },
  { openid: 'openid-1' }, { _id: 'community-1', status: 'active' })).toThrow();
});

test('服务支持固定价格和报价，不允许以零元固定价上架', () => {
  expect(service({ title: '水龙头维修', priceType: 'fixed', price: 12000, unit: '次', status: 'on' }).price).toBe(12000);
  expect(service({ title: '上门勘察', priceType: 'quote', unit: '次', status: 'off' }).price).toBe(0);
  expect(() => service({ title: '维修', priceType: 'fixed', price: 0 })).toThrow();
});

test('佣金中提取物业分成，商家实收与平台金额保持守恒', () => {
  expect(quoteAmount(10001, 0.10, 0.05)).toEqual({ gross: 10001, merchant: 9001, property: 50, platform: 950, commission: 1000 });
  expect(() => quoteAmount(1000, 1.1, 0.05)).toThrow();
  expect(quoteAmount(0, 0.10, 0.05)).toEqual({ gross: 0, merchant: 0, property: 0, platform: 0, commission: 0 });
});

test('住户端商家卡片只展示规范允许公示的执照名称和信用代码', () => {
  const view = visibleMerchant({ _id: 'm1', name: '商家', licenseFileId: 'private-file', licenseInfo: {
    name: '执照名称', creditCode: '91110108MA01ABCD2X' }, contactName: '联系人', phone: '13800138000', staffOpenids: ['secret'] });
  expect(view.licenseInfo.creditCode).toBe('91110108MA01ABCD2X');
  expect(JSON.stringify(view)).not.toMatch(/private-file|13800138000|secret|联系人/);
});

test('服务图片在审核通过前仅商家本人可见', () => {
  const item = { _id: 's1', merchantId: 'm1', ownerOpenid: 'seller', title: '服务', desc: '', images: ['cloud://pending', 'cloud://ok'],
    moderationApprovedFileIds: ['cloud://ok'], priceType: 'fixed', price: 100, unit: '次', status: 'off' };
  expect(visibleService(item, 'resident').images).toEqual(['cloud://ok']);
  expect(visibleService(item, 'seller').images).toEqual(['cloud://pending', 'cloud://ok']);
});
