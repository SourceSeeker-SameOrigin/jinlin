const { membershipKey, cardPlan, renewCard, visitAddressFor, taskDue, purchaseOrder } = require('../membershipData');
const { membershipTaskId } = require('../ids');
const { splitMembershipSale } = require('../split');
const { ymd } = require('../time');
const now = new Date('2026-11-07T15:30:00+08:00');
const plan = { code: 'trash_monthly', name: '垃圾月卡', serviceCode: 'trash', price: 4900, firstPeriodPrice: 2500, days: 30 };
const order = { _id: 'o', userOpenid: 'u', communityId: 'c', planCode: plan.code, planSnapshot: plan, detail: { slot: 'evening' } };
const card = () => renewCard(null, order, now);

test('首购有效期30天，晚班存储正确', () => {
  const result = card();
  expect(result._id).toBe('card_o');
  expect(result.startAt).toEqual(now);
  expect(result.endAt.getTime() - now.getTime()).toBe(30 * 86400000);
  expect(result.slot).toBe('evening');
});
test('有效月卡从原到期时间顺延，保留已有跳过与生成记录', () => {
  const first = { ...card(), skipDates: ['2026-11-08'], lastGeneratedDate: '2026-11-07' };
  const renewed = renewCard(first, { ...order, _id: 'renew' }, now);
  expect(renewed._id).toBe(first._id);
  expect(renewed.endAt.getTime() - first.endAt.getTime()).toBe(30 * 86400000);
  expect(renewed.skipDates).toEqual(first.skipDates);
  expect(renewed.lastGeneratedDate).toBe('2026-11-07');
});
test.each(['expired', 'refunded'])('失效月卡新建记录 %s', status => {
  const next = renewCard({ ...card(), status }, { ...order, _id: 'new' }, now);
  expect(next._id).toBe('card_new');
  expect(next.startAt).toEqual(now);
});
test('到期端点不续旧卡，2月跨月仍按30天', () => {
  expect(renewCard({ ...card(), endAt: now }, { ...order, _id: 'new' }, now)._id).toBe('card_new');
  const feb = new Date('2028-02-01T15:30:00+08:00');
  expect(ymd(renewCard(null, order, feb).endAt)).toBe('2028-03-02');
});
test('不同用户或小区不能续到同一月卡', () => {
  expect(() => renewCard({ ...card(), userOpenid: 'other' }, order, now)).toThrow();
  expect(membershipKey('c1', 'trash_monthly')).not.toBe(membershipKey('c2', 'trash_monthly'));
});
test('晚班15:30开始生成，早班05:30开始；使用北京时间', () => {
  const active = { ...card(), startAt: new Date(now - 86400000) };
  expect(taskDue(active, new Date('2026-11-07T07:29:59Z'))).toBe(false);
  expect(taskDue(active, new Date('2026-11-07T07:30:00Z'))).toBe(true);
  expect(taskDue({ ...active, slot: 'morning' }, new Date('2026-11-06T21:29:59Z'))).toBe(false);
  expect(taskDue({ ...active, slot: 'morning' }, new Date('2026-11-06T21:30:00Z'))).toBe(true);
  expect(taskDue({ ...active, slot: 'afternoon' }, new Date('2026-11-07T02:29:59Z'), { schedule: { type: 'daily' } })).toBe(false);
  expect(taskDue({ ...active, slot: 'afternoon' }, new Date('2026-11-07T02:30:00Z'), { schedule: { type: 'daily' } })).toBe(true);
});
test('跳过、已生成、到期或尚未生效均不再生成', () => {
  for (const patch of [{ skipDates: ['2026-11-07'] }, { lastGeneratedDate: '2026-11-07' },
    { status: 'refunded' }, { endAt: now }, { startAt: new Date(now.getTime() + 1) }]) expect(taskDue({ ...card(), ...patch }, now)).toBe(false);
  const id = membershipTaskId(card()._id, '2026-11-07', 'evening');
  expect(id).toBe(membershipTaskId(card()._id, '2026-11-07', 'evening'));
});
test('垃圾月卡首月25元，销售分账物业1.25元', () => {
  const community = { _id: 'c', status: 'active', rates: { platform: 0.2, property: 0.05 } };
  const user = { openid: 'u', communityId: 'c', unit: '1单元', room: '302', phone: '13800000000' };
  const building = { _id: 'b', communityId: 'c', name: '3号楼', units: ['1单元'] };
  const first = purchaseOrder({ id: 'o', orderNo: 'JL1', user, community, building, plan, first: true, slot: 'evening', now, payMode: 'mock' });
  expect(first.kind).toBe('membership_purchase');
  expect(first.pricing.payAmount).toBe(2500);
  expect(first.pricing.discount).toBe(2400);
  expect(splitMembershipSale(first.pricing.payAmount, community.rates)).toEqual({ provider: 0, property: 125, platform: 2375, goods: 0 });
  expect(purchaseOrder({ id: 'o2', orderNo: 'JL2', user, community, building, plan, first: false, slot: 'evening', now, payMode: 'mock' }).pricing.payAmount).toBe(4900);
});
test('拒绝配置错配及首期高于原价', () => {
  expect(cardPlan({ cardPlans: [plan] }, plan.code)).toEqual(plan);
  expect(() => cardPlan({ cardPlans: [{ ...plan, serviceCode: 'express' }] }, plan.code)).toThrow();
  expect(() => cardPlan({ cardPlans: [{ ...plan, firstPeriodPrice: 5000 }] }, plan.code)).toThrow();
});

describe('独居探访月卡', () => {
  const visitPlan = { code: 'visit_monthly', name: '独居探访月卡', serviceCode: 'visit', price: 19900,
    firstPeriodPrice: 19900, days: 30, schedule: { type: 'weekly', weekdays: [2, 5] } };
  const visitOrder = { ...order, _id: 'visit_o', planCode: visitPlan.code, planSnapshot: visitPlan, detail: { slot: 'morning' },
    address: { buildingName: '3号楼', unit: '1单元', room: '302', contactName: '李女士', contactPhone: '13900000000' },
    userPhone: '13900000000', buildingId: 'b2' };

  test('使用每周二、五排期，校验非法日期配置', () => {
    const community = { cardPlans: [visitPlan] };
    expect(cardPlan(community, visitPlan.code).schedule.weekdays).toEqual([2, 5]);
    expect(() => cardPlan({ cardPlans: [{ ...visitPlan, schedule: { type: 'weekly', weekdays: [0] } }] }, visitPlan.code)).toThrow();
  });

  test('续卡保存为父母预选地址和服务电话', () => {
    const renewed = renewCard(null, visitOrder, now);
    expect(renewed).toMatchObject({ serviceCode: 'visit', slot: 'morning', visitAddress: {
      communityId: 'c', buildingId: 'b2', buildingName: '3号楼', unit: '1单元', room: '302',
      contactName: '李女士', contactPhone: '13900000000' } });
  });

  test('续期地址只从新周期生效，不改写本周期任务地址', () => {
    const current = renewCard(null, visitOrder, now);
    const nextOrder = { ...visitOrder, _id: 'visit_o2', buildingId: 'b3',
      address: { buildingName: '5号楼', unit: '2单元', room: '501', contactName: '王女士', contactPhone: '13700000000' },
      userPhone: '13700000000' };
    const renewed = renewCard(current, nextOrder, now);
    const newCycle = current.endAt;
    expect(visitAddressFor(renewed, new Date(newCycle.getTime() - 1))).toMatchObject({ buildingId: 'b2', room: '302' });
    expect(visitAddressFor(renewed, newCycle)).toMatchObject({ buildingId: 'b3', room: '501' });
    expect(renewed.visitAddress).toMatchObject({ buildingId: 'b2', room: '302' });
  });

  test('购买订单用已保存地址快照并绑定地址 ID', () => {
    const community = { _id: 'c', status: 'active', rates: { platform: 0.2, property: 0.05 } };
    const user = { _id: 'u', openid: 'u', communityId: 'c', buildingId: 'b', unit: '2单元', room: '101', phone: '13800000000' };
    const building = { _id: 'b2', communityId: 'c', name: '3号楼', units: ['1单元'] };
    const selected = { id: 'addr_parent', communityId: 'c', buildingId: 'b2', buildingName: '3号楼',
      unit: '1单元', room: '302', contactPhone: '13900000000' };
    const result = purchaseOrder({ id: 'visit_o', orderNo: 'JL2', user, community, building, plan: visitPlan,
      first: true, slot: 'morning', now, payMode: 'mock', selectedAddress: selected });
    expect(result).toMatchObject({ addressId: 'addr_parent', buildingId: 'b2', minLevel: 2,
      address: { buildingName: '3号楼', unit: '1单元', room: '302' }, userPhone: '13900000000', detail: { slot: 'morning' } });
  });
});
