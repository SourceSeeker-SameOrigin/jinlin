const { selectRows, payoutState, publicPayout } = require('../payout');
const { rowsForPayee } = require('../settlementData');

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

test('人工结算筛选跳过提现锁定账本', () => {
  const ledger = [row('free', 500, { providerId: 'p1' }), row('locked', 700, { providerId: 'p1', payoutId: 'payout1' })];
  expect(rowsForPayee(ledger, 'provider', 'p1').map(item => item._id)).toEqual(['free']);
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
