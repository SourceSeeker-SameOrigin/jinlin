const { ensure, integer } = require('./validate');
const { MAX_SINGLE_AMOUNT, normalizeState } = require('./wxpayV3');

const MAX_LEDGER_ROWS = 100;
const TERMINAL_STATES = Object.freeze(['success', 'failed', 'cancelled']);

function rowAmount(row) {
  return integer((row.amounts && row.amounts.provider || 0) + (row.amounts && row.amounts.goods || 0),
    '可提现账本金额', 0, Number.MAX_SAFE_INTEGER, 'E_CONFIG');
}

function selectRows(rows) {
  ensure(Array.isArray(rows), '账本数据不正确', 'E_CONFIG');
  const selected = [];
  let amount = 0;
  for (const row of rows.slice().sort((a, b) => a.createdAt - b.createdAt || a._id.localeCompare(b._id))) {
    if (!row.settled || row.settled.provider !== false || row.settlementIds && row.settlementIds.provider || row.payoutId) continue;
    const value = rowAmount(row);
    if (!value || value > MAX_SINGLE_AMOUNT || amount + value > MAX_SINGLE_AMOUNT) continue;
    selected.push(row);
    amount += value;
    if (selected.length >= MAX_LEDGER_ROWS || amount === MAX_SINGLE_AMOUNT) break;
  }
  ensure(amount >= 1000, '可提现金额需达到 ¥10，单次上限 ¥2000', 'E_BAD_STATE');
  return { rows: selected, amount };
}

function payoutState(wxState) { return normalizeState(wxState); }

function publicPayout(payout) {
  const canConfirm = payout.state === 'wait_user_confirm' || payout.wxState === 'TRANSFERING';
  return { payoutId: payout._id, amount: payout.amount, state: payout.state, wxState: payout.wxState || null,
    packageInfo: canConfirm ? payout.packageInfo || null : null,
    mchId: payout.mchId || null, appId: payout.appId || null,
    createdAt: payout.createdAt, updatedAt: payout.updatedAt, failReason: payout.state === 'failed' ? payout.failReason || '' : '' };
}

module.exports = { MAX_LEDGER_ROWS, TERMINAL_STATES, rowAmount, selectRows, payoutState, publicPayout };
