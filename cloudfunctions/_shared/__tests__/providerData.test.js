const { application, canWork, canTake, delivery, hallView, providerView, fileInFolder } = require('../providerData');
const now = new Date('2026-11-07T00:00:00+08:00');
const worker = { _id: 'p', openid: 'w', status: 'approved', level: 1, communityId: 'c',
  insuranceUntil: new Date(now.getTime() + 86400000), onDuty: true, phone: '13800000000' };
const order = { _id: 'o', kind: 'service', status: 'paid', serviceCode: 'express', minLevel: 1, communityId: 'c',
  userPhone: '13900000000', address: { buildingName: '3号楼', unit: '1单元', room: '302' },
  pricing: { listPrice: 550, payAmount: 100, goodsCap: 0, goodsActual: 0 }, rateSnapshot: { platform: 0.2, property: 0.05 },
  detail: { pickupCodes: ['secret'] }, source: 'user', slot: null };

test('申请校验主体、小区、后四位、授权和材料路径', () => {
  const event = { realName: '张三', idLast4: '123x', appliedLevel: 1, agreed: true,
    kycFileId: 'cloud://env.bucket/kyc/u/id.jpg', avatarFileId: 'cloud://env.bucket/providers/u/avatar.jpg' };
  const user = { _id: 'u', phone: '13800000000' };
  expect(application(event, user, { _id: 'c', status: 'active' }).idLast4).toBe('123X');
  for (const patch of [{ realName: '' }, { idLast4: '12345' }, { appliedLevel: 3 }, { agreed: false },
    { kycFileId: 'cloud://env.bucket/kyc/other/id.jpg' }]) expect(() => application({ ...event, ...patch }, user, { status: 'active' })).toThrow();
  expect(() => application(event, { ...user, phone: '' }, { status: 'active' })).toThrow();
});
test.each([null, new Date(now), new Date(now.getTime() - 1)])('保险未登记或到期均不能上线 %s', insuranceUntil => {
  expect(() => canWork({ ...worker, insuranceUntil }, now)).toThrow('保险');
});
test('帮手不能接入户单，认证服务员可以', () => {
  expect(() => canTake({ ...order, minLevel: 2 }, worker, now)).toThrow();
  expect(() => canTake({ ...order, minLevel: 2 }, { ...worker, level: 2 }, now)).not.toThrow();
});
test.each([{ status: 'accepted' }, { communityId: 'other' }, { kind: 'membership_purchase' },
  { releasedProviderIds: ['p'] }])('拒绝不可接任务 %p', patch => {
  expect(() => canTake({ ...order, ...patch }, worker, now)).toThrow();
});
test('下线或未审核不能接单', () => {
  for (const patch of [{ onDuty: false }, { status: 'pending' }, { status: 'suspended' }]) {
    expect(() => canTake(order, { ...worker, ...patch }, now)).toThrow();
  }
});
test('大厅只包含规定摘要，按原价计算服务员预计收入', () => {
  expect(hallView(order)).toEqual({ _id: 'o', serviceCode: 'express', serviceName: '代取快递',
    buildingName: '3号楼', slot: null, estimatedIncome: 412 });
});
test('悬赏任务大厅显示公开任务描述和入户要求', () => {
  const custom = { ...order, serviceCode: 'custom', detail: { title: '搬纸箱', desc: '门口搬到楼下', needEnterHome: true },
    pricing: { listPrice: 500, payAmount: 500, goodsCap: 0, goodsActual: 0 } };
  expect(hallView(custom)).toMatchObject({ serviceName: '悬赏任务', title: '搬纸箱', desc: '门口搬到楼下', needEnterHome: true });
});
test('代买完成必须提交照片、小票和有效实际金额', () => {
  const buying = { ...order, serviceCode: 'buy', pricing: { ...order.pricing, goodsCap: 5000 } };
  const event = { photos: ['cloud://env.bucket/orders/o/complete.jpg'],
    receiptPhoto: 'cloud://env.bucket/orders/o/receipt.jpg', goodsActual: 3250 };
  expect(delivery(event, buying).pricing.goodsActual).toBe(3250);
  for (const patch of [{ photos: [] }, { photos: new Array(4).fill(event.photos[0]) }, { receiptPhoto: '' },
    { goodsActual: 5001 }, { goodsActual: 0.5 }]) expect(() => delivery({ ...event, ...patch }, buying)).toThrow();
});
test('不接受其他订单或目录穿越的文件', () => {
  expect(() => fileInFolder('cloud://env.bucket/orders/other/a.jpg', 'orders/o')).toThrow();
  expect(() => fileInFolder('cloud://env.bucket/orders/o/../other/a.jpg', 'orders/o')).toThrow();
});
test('服务员个人摘要去掉证件、openid和完整电话；管理员可看审核材料', () => {
  const input = { ...worker, idLast4: '1234', kycFileIds: ['private'], stats: {} };
  const own = providerView(input);
  expect(own.phone).toBe('138****0000');
  expect(own.openid).toBeUndefined();
  expect(own.kycFileIds).toBeUndefined();
  expect(providerView(input, true).kycFileIds).toEqual(['private']);
});
