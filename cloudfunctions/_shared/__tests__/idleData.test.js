const { newIdleItem, validateItem, commission, releaseReservation } = require('../idleData');
const { accounting, ledgerDelta } = require('../orderLifecycle');

const now = new Date('2026-11-07T00:00:00+08:00');
const user = { _id: 'u1', openid: 'wx1' };
const community = { _id: 'c1' };
const input = { title: '儿童自行车', desc: '九成新，可小区自提', category: '运动', price: 8000,
  condition: 'like_new', tradeMode: 'offline', negotiable: true, images: [] };

test('闲置信息默认本小区、信息交易', () => {
  const item = newIdleItem({ id: 'i1', user, community, input, now });
  expect(item).toMatchObject({ _id: 'i1', communityId: 'c1', sellerOpenid: 'wx1', status: 'on_sale',
    scope: 'community', tradeMode: 'offline', price: 8000 });
  expect(item.createdAt).toEqual(now);
});

test('创建内容保留明确选择的联合社区范围', () => {
  const item = newIdleItem({ id: 'i2', user, community, input: { ...input, scope: 'federation' }, now });
  expect(item.scope).toBe('federation');
});

test('拦截禁售品，校验价格、成色、交易模式和图片数量', () => {
  expect(() => validateItem({ ...input, title: '九成新烟草' }, ['烟草'])).toThrow('禁止');
  expect(() => validateItem({ ...input, price: 0 }, [])).toThrow('价格');
  expect(() => validateItem({ ...input, condition: 'broken' }, [])).toThrow('成色');
  expect(() => validateItem({ ...input, tradeMode: 'cash' }, [])).toThrow('交易方式');
  expect(() => validateItem({ ...input, images: Array.from({ length: 10 }, (_, index) => String(index)) }, [])).toThrow('9 张');
});

test('闲置佣金按分四舍五入，退款后账本同时调整卖家净额', () => {
  expect(commission(105, 0.1)).toBe(11);
  expect(commission(0, 0.1)).toBe(0);
  const order = { kind: 'idle_purchase', pricing: { payAmount: 105, goodsActual: 0 },
    idleSnapshot: { commissionRate: 0.1 } };
  const original = accounting(order);
  const refunded = accounting(order, { serviceRefund: 50 });
  expect(original).toEqual({ gross: 105, provider: 0, property: 0, platform: 11, goods: 0, seller: 94 });
  expect(ledgerDelta(refunded, original)).toEqual({ gross: -50, provider: 0, property: 0, platform: -5, goods: 0, seller: -45 });
});

test('退款成功仅在原卖家仍持有该预留商品时恢复上架', async () => {
  const stored = { _id: 'i1', sellerOpenid: 'seller', purchaseOrderId: 'o1', status: 'sold' };
  let patch;
  const transaction = { collection: () => ({ doc: () => ({ get: async () => ({ data: stored }),
    update: async ({ data }) => { patch = data; } }) }) };
  expect(await releaseReservation(transaction, { kind: 'idle_purchase', idleItemId: 'i1',
    sellerOpenid: 'seller', _id: 'o1' })).toBe(true);
  expect(patch).toMatchObject({ status: 'on_sale', purchaseOrderId: null });
  expect(await releaseReservation(transaction, { kind: 'idle_purchase', idleItemId: 'i1',
    sellerOpenid: 'other', _id: 'o1' })).toBe(false);
});
