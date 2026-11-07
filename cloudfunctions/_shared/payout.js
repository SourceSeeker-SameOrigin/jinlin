const { ensure, integer } = require('./validate');
const { MAX_SINGLE_AMOUNT, normalizeState } = require('./wxpayV3');

const MAX_LEDGER_ROWS = 100;
const TERMINAL_STATES = Object.freeze(['success', 'failed', 'cancelled']);

function rowAmount(row, payeeType = 'provider') {
  const amount = payeeType === 'seller' ? (row.amounts && row.amounts.seller || 0) -
    (row.paidAmounts && row.paidAmounts.seller || 0) :
    (row.amounts && row.amounts.provider || 0) + (row.amounts && row.amounts.goods || 0);
  return integer(amount,
    '可提现账本金额', 0, Number.MAX_SAFE_INTEGER, 'E_CONFIG');
}

function selectRows(rows, payeeType = 'provider') {
  ensure(['provider', 'seller'].includes(payeeType), '打款收款对象不正确', 'E_CONFIG');
  ensure(Array.isArray(rows), '账本数据不正确', 'E_CONFIG');
  const selected = [];
  const allocations = [];
  let amount = 0;
  const ordered = rows.slice().sort((a, b) => a.createdAt - b.createdAt || a._id.localeCompare(b._id));
  const eligibleTotal = ordered.reduce((sum, row) => {
    if (!row.settled || row.settled[payeeType] !== false || row.settlementIds && row.settlementIds[payeeType] || row.payoutId) return sum;
    return sum + rowAmount(row, payeeType);
  }, 0);
  const maxAmount = payeeType === 'seller' ? MAX_SINGLE_AMOUNT - 1 : MAX_SINGLE_AMOUNT;
  let targetAmount = Math.min(eligibleTotal, maxAmount);
  if (payeeType === 'seller' && eligibleTotal > targetAmount && eligibleTotal - targetAmount < 1000) {
    targetAmount = eligibleTotal - 1000;
  }
  for (const row of ordered) {
    if (!row.settled || row.settled[payeeType] !== false || row.settlementIds && row.settlementIds[payeeType] || row.payoutId) continue;
    const value = rowAmount(row, payeeType);
    const remaining = targetAmount - amount;
    if (!value || value > MAX_SINGLE_AMOUNT && payeeType !== 'seller' || remaining <= 0) continue;
    if (payeeType !== 'seller' && value > remaining) continue;
    const allocation = payeeType === 'seller' ? Math.min(value, remaining) : value;
    selected.push(row);
    allocations.push({ ledgerId: row._id, amount: allocation });
    amount += allocation;
    if (selected.length >= MAX_LEDGER_ROWS || amount === targetAmount) break;
  }
  ensure(amount >= 1000, payeeType === 'seller' ? '可提现金额需达到 ¥10，卖家单次上限 ¥1999.99' :
    '可提现金额需达到 ¥10，单次上限 ¥2000', 'E_BAD_STATE');
  return { rows: selected, allocations, amount };
}

function payoutState(wxState) { return normalizeState(wxState); }

function sellerPayoutSuccess(row, amount, now = new Date()) {
  integer(amount, '卖家分笔打款金额', 1, Number.MAX_SAFE_INTEGER);
  const previous = row.paidAmounts && row.paidAmounts.seller || 0;
  const total = integer(row.amounts && row.amounts.seller, '卖家账本金额', 0, Number.MAX_SAFE_INTEGER, 'E_CONFIG');
  ensure(previous + amount <= total, '卖家分笔打款金额超过账本余额', 'E_CONFLICT');
  const paid = previous + amount;
  return { paidAmounts: { ...(row.paidAmounts || {}), seller: paid },
    settled: { ...row.settled, seller: paid === total }, payoutId: null, payoutCompletedAt: now };
}

function publicPayout(payout) {
  const canConfirm = payout.state === 'wait_user_confirm' || payout.wxState === 'TRANSFERING';
  return { payoutId: payout._id, payeeType: payout.payeeType || 'provider', amount: payout.amount, state: payout.state, wxState: payout.wxState || null,
    packageInfo: canConfirm ? payout.packageInfo || null : null,
    mchId: payout.mchId || null, appId: payout.appId || null,
    createdAt: payout.createdAt, updatedAt: payout.updatedAt, failReason: payout.state === 'failed' ? payout.failReason || '' : '' };
}

module.exports = { MAX_LEDGER_ROWS, TERMINAL_STATES, rowAmount, selectRows, payoutState, sellerPayoutSuccess, publicPayout };
