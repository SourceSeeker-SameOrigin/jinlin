const { availableSlots, validateSlot, addressSnapshot, newOrder, transitionPatch, cleanNote, listView } = require('../orderData');
const { quote } = require('../pricing');
const { orderView } = require('../views');
const fs = require('fs');
const path = require('path');
const community = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database/seed/communities.json'), 'utf8').trim());
const building = { _id: 'b', communityId: community._id, name: '3号楼', units: ['1单元'] };
const user = { _id: 'u', openid: 'owner', communityId: community._id, buildingId: 'b', unit: '1单元', room: '302',
  phone: '13800000000', firstPaidAt: null, roles: ['resident'] };
const now = new Date('2026-11-06T16:30:00Z');
const windows = [{ start: '23:00', end: '01:00' }, { start: '08:00', end: '09:00' }];
const detail = { stationCode: 'S1', pickupCodes: ['A1', 'A2'], largeCount: 1, placement: 'door', injected: 'no' };
function order() {
  const pricing = quote({ serviceCode: 'express', detail, prices: community.prices, user });
  return newOrder({ id: 'o', orderNo: 'JL1', user, community, building, serviceCode: 'express', detail, pricing,
    note: ' 放门口 ', slot: null, now });
}

describe('订单创建与时段校验', () => {
  test('凌晨允许前一天延续的跨夜时段，归属开始日期', () => {
    expect(availableSlots(windows, now)[0]).toEqual({ date: '2026-11-06', start: '23:00', end: '01:00' });
    expect(availableSlots(windows, now)).toHaveLength(5);
  });
  test('结束端点不可再选', () => {
    expect(() => validateSlot({ date: '2026-11-06', start: '23:00', end: '01:00' }, windows, 1,
      new Date('2026-11-06T17:00:00Z'))).toThrow('该时段已结束');
  });
  test('无人值班不能尽快；不能选后天或伪造时段', () => {
    expect(() => validateSlot(null, windows, 0, now)).toThrow('没有服务员值班');
    expect(validateSlot(null, windows, 1, now)).toBeNull();
    for (const slot of [{ date: '2026-11-09', start: '08:00', end: '09:00' },
      { date: '2026-11-07', start: '08:00', end: '10:00' }]) expect(() => validateSlot(slot, windows, 1, now)).toThrow();
  });
  test.each([{ communityId: 'other' }, { unit: '伪造单元' }, { room: '' }, { phone: '' }])('绑定地址字段校验 %p', patch => {
    expect(() => addressSnapshot({ ...user, ...patch }, community, building)).toThrow();
  });
  test('采用服务端价格和门牌快照，舍弃非白名单字段', () => {
    const result = order();
    expect(result.pricing).toMatchObject({ listPrice: 550, payAmount: 100, discount: 450 });
    expect(result.detail.injected).toBeUndefined();
    expect(result.address).toEqual({ buildingName: '3号楼', unit: '1单元', room: '302' });
    expect(result.note).toBe('放门口');
    expect(result.status).toBe('pending_pay');
    expect(result.payment.paidAt).toBeNull();
  });
  test('不能跨小区选驿站', () => {
    expect(() => newOrder({ ...order(), id: 'o', user, community, building, detail: { ...detail, stationCode: 'other' }, now })).toThrow('本小区');
  });
  test('悬赏 custom 订单保留任务摘要、预定时段与入户等级', () => {
    const custom = newOrder({ id: 'custom-o', orderNo: 'JL2', user, community, building, serviceCode: 'custom',
      detail: { title: '搬纸箱', desc: '从门口搬到楼下', needEnterHome: true }, note: '',
      slot: { date: '2026-11-08', start: '08:00', end: '09:00' },
      pricing: { listPrice: 500, discount: 0, payAmount: 500, goodsCap: 0, freeByMembership: false }, now,
      minLevel: 2, taskPostId: 'bp-task' });
    expect(custom).toMatchObject({ serviceCode: 'custom', minLevel: 2, taskPostId: 'bp-task',
      detail: { title: '搬纸箱', desc: '从门口搬到楼下', needEnterHome: true }, pricing: { payAmount: 500 } });
  });
  test('状态转换追加时间线且不修改输入', () => {
    const original = order();
    const patch = transitionPatch(original, 'paid', 'system', now);
    expect(patch.timeline).toHaveLength(2);
    expect(original.timeline).toHaveLength(1);
    expect(() => transitionPatch(original, 'completed', 'system', now)).toThrow();
  });
  test('备注按码点限制且允许空白', () => {
    expect(cleanNote('')).toBe('');
    expect(cleanNote('😀'.repeat(100))).toHaveLength(200);
    expect(() => cleanNote('字'.repeat(101))).toThrow();
  });
  test('列表不暴露门牌、取件码、身份', () => {
    const item = listView(order());
    expect(item.buildingName).toBe('3号楼');
    for (const key of ['detail', 'address', 'userOpenid', 'userPhone', 'payment']) expect(item[key]).toBeUndefined();
  });
});

describe('订单字段裁剪', () => {
  const provider = { _id: 'p', openid: 'worker', realName: '张三', status: 'approved', level: 2, phone: '13900000000', kycFileIds: ['secret'] };
  const config = { phoneVisibleHoursAfterDone: 24 };
  const assigned = () => ({ ...order(), status: 'accepted', providerId: 'p', providerOpenid: 'worker' });
  test('住户只能看到服务员履约信息，无身份证和内部身份', () => {
    const result = orderView(assigned(), user, provider, config, now);
    expect(result.provider).toMatchObject({ name: '张师傅', phone: '13900000000', canCall: true });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.userOpenid).toBeUndefined();
    expect(result.timeline[0].by).toBeUndefined();
  });
  test('已接单服务员可看门牌和手机号', () => {
    const result = orderView(assigned(), { ...user, openid: 'worker' }, provider, config, now);
    expect(result.address.room).toBe('302');
    expect(result.userPhone).toBe('13800000000');
    expect(result.canCallResident).toBe(true);
  });
  test('满24小时双方号码恢复打码', () => {
    const completed = { ...assigned(), status: 'completed', completedAt: new Date(now - 86400000) };
    expect(orderView(completed, user, provider, config, now).provider.phone).toBe('139****0000');
    const result = orderView(completed, { ...user, openid: 'worker' }, provider, config, now);
    expect(result.userPhone).toBe('138****0000');
    expect(result.canCallResident).toBe(false);
  });
  test('物业仅本小区，隐去门牌和内容', () => {
    const property = { ...user, openid: 'property', roles: ['property'] };
    const result = orderView(assigned(), property, provider, config, now);
    expect(result.address.room).toBeUndefined();
    expect(result.detail).toBeUndefined();
    expect(() => orderView(assigned(), { ...property, communityId: 'other' }, provider, config, now)).toThrow();
  });
  test('管理员可看订单但不自动取得完整电话', () => {
    const result = orderView(assigned(), { openid: 'admin', roles: ['admin'] }, provider, config, now);
    expect(result.detail.pickupCodes).toEqual(['A1', 'A2']);
    expect(result.userPhone).toBe('138****0000');
  });
  test('其他住户、未接单服务员无权查看', () => {
    expect(() => orderView(assigned(), { ...user, openid: 'stranger' }, null, config, now)).toThrow();
    expect(() => orderView(order(), { ...user, openid: 'worker' }, provider, config, now)).toThrow();
  });
  test.each(['merchant', 'station'])('%s 角色不能借用核心订单视图读取无关订单', role => {
    expect(() => orderView(assigned(), { openid: role + '-staff', roles: [role], communityId: 'community-1' },
      null, config, now)).toThrow(expect.objectContaining({ code: 'E_FORBIDDEN' }));
  });
});
