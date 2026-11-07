const { selectRows, payoutState, sellerPayoutSuccess, publicPayout, communityAllocations, payoutCommunityAmounts } = require('../payout');
const { rowsForPayee } = require('../settlementData');
const { idFor } = require('../payoutFlow');
const crypto = require('crypto');

test('扩展收款对象后保持服务员既有提现幂等编号', () => {
  const legacy = 'po_' + crypto.createHash('sha256').update('provider-openid:request-12345678').digest('hex').slice(0, 32);
  expect(idFor('provider-openid', 'request-12345678')).toBe(legacy);
  expect(idFor('provider-openid', 'request-12345678', 'seller')).not.toBe(legacy);
});

function row(id, amount, patch = {}) {
  return { _id: id, createdAt: new Date('2026-11-01T00:00:00Z'), amounts: { provider: amount, goods: 0 },
    settled: { provider: false }, settlementIds: { provider: null }, ...patch };
}

test('选择可提现服务员收入并排除已结算、人工结算锁定和其他提现锁定', () => {
  const result = selectRows([row('a', 700), row('b', 800), row('settled', 500, { settled: { provider: true } }),
    row('settlement', 500, { settlementIds: { provider: 's1' } }), row('locked', 500, { payoutId: 'p1' })]);
  expect(result).toMatchObject({ amount: 1500 });
  expect(result.rows.map(item => item._id)).toEqual(['a', 'b']);
});

test('单次提现最低10元且不超过2000元', () => {
  expect(() => selectRows([row('small', 999)])).toThrow('需达到 ¥10');
  expect(selectRows([row('one', 200000)]).amount).toBe(200000);
  expect(selectRows([row('a', 150000), row('b', 100000)]).amount).toBe(150000);
});

test('卖家打款单笔不超过 ¥1999.99，超额后留至少 ¥10 供后续申请', () => {
  const cap = row('cap', 0, { sellerOpenid: 'wx-seller', amounts: { seller: 199999 },
    settled: { seller: false }, settlementIds: { seller: null } });
  expect(selectRows([cap], 'seller').amount).toBe(199999);
  const sale = row('seller', 0, { sellerOpenid: 'wx-seller', amounts: { seller: 200000 },
    settled: { seller: false }, settlementIds: { seller: null } });
  const result = selectRows([sale], 'seller');
  expect(result.amount).toBe(199000);
  expect(result.allocations).toEqual([{ ledgerId: 'seller', amount: 199000 }]);
});

test('卖家分笔打款成功只结算已付部分，最后一笔才结清账本', () => {
  const first = sellerPayoutSuccess({ amounts: { seller: 200000 }, paidAmounts: { seller: 0 },
    settled: { seller: false }, payoutId: 'p1' }, 199999, new Date('2026-11-07T00:00:00Z'));
  expect(first).toMatchObject({ paidAmounts: { seller: 199999 }, settled: { seller: false }, payoutId: null });
  const second = sellerPayoutSuccess({ amounts: { seller: 200000 }, paidAmounts: first.paidAmounts,
    settled: { seller: false }, payoutId: 'p2' }, 1);
  expect(second).toMatchObject({ paidAmounts: { seller: 200000 }, settled: { seller: true }, payoutId: null });
  expect(() => sellerPayoutSuccess({ amounts: { seller: 200000 }, paidAmounts: first.paidAmounts,
    settled: { seller: false } }, 2)).toThrow('超过账本余额');
});

test('人工结算筛选跳过提现锁定账本', () => {
  const ledger = [row('free', 500, { providerId: 'p1' }), row('locked', 700, { providerId: 'p1', payoutId: 'payout1' })];
  expect(rowsForPayee(ledger, 'provider', 'p1').map(item => item._id)).toEqual(['free']);
});

test('跨小区分笔提现按本次实际金额归属，不按账本总额重复分摊', () => {
  const rows = [row('a', 0, { communityId: 'A', amounts: { seller: 120000 }, settled: { seller: false } }),
    row('b', 0, { communityId: 'B', amounts: { seller: 180000 }, settled: { seller: false } })];
  const selection = selectRows(rows, 'seller');
  expect(communityAllocations(selection.rows, selection.allocations, selection.amount)).toEqual([
    { communityId: 'A', amount: 120000 }, { communityId: 'B', amount: 79999 }
  ]);
  const remaining = { ...rows[1], paidAmounts: { seller: 79999 } };
  const next = selectRows([remaining], 'seller');
  expect(communityAllocations(next.rows, next.allocations, next.amount)).toEqual([{ communityId: 'B', amount: 100001 }]);
});

test('旧提现按保留的账本分笔金额重建归属；缺失、重复或合计不一致时拒绝猜测', () => {
  const old = { amount: 3000, ledgerIds: ['a', 'b'], ledgerAmounts: { a: 1000, b: 2000 } };
  const rows = [{ _id: 'a', communityId: 'A' }, { _id: 'b', communityId: 'B' }];
  expect(payoutCommunityAmounts(old, rows)).toEqual([{ communityId: 'A', amount: 1000 }, { communityId: 'B', amount: 2000 }]);
  expect(payoutCommunityAmounts({ communityId: 'A', amount: 1000 })).toEqual([{ communityId: 'A', amount: 1000 }]);
  expect(() => payoutCommunityAmounts(old, rows.slice(0, 1))).toThrow('小区归属');
  expect(() => payoutCommunityAmounts({ amount: 1000 })).toThrow('缺少小区分摊依据');
  expect(() => payoutCommunityAmounts({ amount: 4000, communityAmounts: [{ communityId: 'A', amount: 3000 }] })).toThrow('合计');
  expect(() => payoutCommunityAmounts({ amount: 4000, communityAmounts: [{ communityId: 'A', amount: 2000 }, { communityId: 'A', amount: 2000 }] })).toThrow('重复');
});

test('展示提现状态时不泄漏内部请求体或收款标识', () => {
  const view = publicPayout({ _id: 'p1', amount: 5000, state: 'wait_user_confirm', wxState: 'WAIT_USER_CONFIRM',
    packageInfo: 'package', payeeOpenid: 'private-openid', requestBody: { openid: 'private-openid' },
    mchId: 'mch', appId: 'app', createdAt: new Date(), updatedAt: new Date() });
  expect(view).toMatchObject({ payoutId: 'p1', packageInfo: 'package', mchId: 'mch', appId: 'app' });
  expect(JSON.stringify(view)).not.toContain('private-openid');
  expect(view).not.toHaveProperty('requestBody');
  expect(publicPayout({ _id: 'p2', amount: 1000, state: 'processing', packageInfo: 'secret' }).packageInfo).toBeNull();
});

test.each([['ACCEPTED','processing'], ['PROCESSING','processing'], ['WAIT_USER_CONFIRM','wait_user_confirm'],
  ['TRANSFERING','processing'], ['SUCCESS','success'], ['FAIL','failed'], ['CANCELLED','cancelled']])(
  '映射微信支付终态 %s', (state, mapped) => expect(payoutState(state)).toBe(mapped));
