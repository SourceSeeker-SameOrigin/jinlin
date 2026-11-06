const { split, splitMembershipSale } = require('../split');

const rates = { platform: 0.20, property: 0.05 };
const calculate = overrides => split({ listPrice: 500, payAmount: 500, rates, ...overrides });

test.each([
  ['普通快递两件', { listPrice: 350, payAmount: 350 }, [262, 17, 71]],
  ['首单快递两件', { listPrice: 350, payAmount: 100 }, [262, 5, -167]],
  ['帮把手两块', { listPrice: 2000, payAmount: 2000 }, [1500, 100, 400]],
  ['月卡快递免单', { listPrice: 250, payAmount: 0 }, [187, 0, -187]],
  ['垃圾月卡计件', { source: 'membership', listPrice: 500, payAmount: 0, membershipTaskPayout: 120 }, [120, 0, -120]],
  ['全额退款且有责', { refundAmount: 500, providerLiable: true }, [0, 0, 0]],
  ['部分退款无责', { refundAmount: 200 }, [375, 15, -90]],
  ['部分退款有责', { refundAmount: 200, providerLiable: true }, [225, 15, 60]]
])('SPEC/T01 必测样例：%s', (_, input, expected) => {
  const result = calculate(input);
  expect(result).toEqual({ provider: expected[0], property: expected[1], platform: expected[2], goods: 0 });
  expect(result.provider + result.property + result.platform).toBe((input.payAmount ?? 500) - (input.refundAmount ?? 0));
});

test('有责部分退款只在最后取整，不提前截断服务员原价收入', () => {
  expect(calculate({ listPrice: 350, payAmount: 350, refundAmount: 50, providerLiable: true }))
    .toEqual({ provider: 225, property: 15, platform: 60, goods: 0 });
});

test('代买实际商品款全额报销，不参与分账', () => {
  expect(calculate({ listPrice: 400, payAmount: 400, goodsActual: 3250 }))
    .toEqual({ provider: 300, property: 20, platform: 80, goods: 3250 });
});

test('零支付且无退款不会除零，服务员仍按原价结算', () => {
  expect(calculate({ listPrice: 250, payAmount: 0, providerLiable: true }).provider).toBe(187);
});

test('费率转换为整数万分比，尾差留给平台', () => {
  expect(calculate({ listPrice: 10001, payAmount: 10001, rates: { platform: 0.12345, property: 0.05432 } }))
    .toEqual({ provider: 8222, property: 543, platform: 1236, goods: 0 });
});

test('大整数分账中间乘积不损失精度', () => {
  expect(calculate({ listPrice: Number.MAX_SAFE_INTEGER, payAmount: Number.MAX_SAFE_INTEGER }))
    .toEqual({ provider: 6755399441055743, property: 450359962737049, platform: 1801439850948199, goods: 0 });
});

test('月卡销售只有物业和平台分成', () => {
  expect(splitMembershipSale(2500, rates)).toEqual({ provider: 0, property: 125, platform: 2375, goods: 0 });
});

test.each([{ refundAmount: 501 }, { refundAmount: -1 }, { payAmount: 501 }, { listPrice: 0.5 },
  { payAmount: '500' }, { goodsActual: -1 }, { providerLiable: 'true' }, { source: 'unknown' },
  { source: 'membership' }])('拒绝非法分账输入 %p', input => {
  expect(() => calculate(input)).toThrow(expect.objectContaining({ code: 'E_INVALID_PARAM' }));
});

test.each([null, {}, { platform: NaN, property: 0 }, { platform: -0.1, property: 0.05 },
  { platform: 0.8, property: 0.3 }, { platform: '0.2', property: 0.05 }])('拒绝非法分账费率 %p', invalidRates => {
  expect(() => calculate({ rates: invalidRates })).toThrow(expect.objectContaining({ code: 'E_CONFIG' }));
});
