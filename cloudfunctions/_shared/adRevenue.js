const { read, insert } = require('./transaction');
const { ensure, integer } = require('./validate');

async function confirmAdReceived(transaction, adId, openid, now = new Date()) {
  const ad = await read(transaction, 'ads', adId);
  ensure(ad, '广告不存在', 'E_NOT_FOUND');
  const amount = integer(ad.price, '广告金额', 1, 100000000);
  const ledgerId = 'ad_' + ad._id;
  const existing = await read(transaction, 'ledger', ledgerId);
  if (existing) {
    ensure(existing.refType === 'ad' && existing.amounts && existing.amounts.platform === amount,
      '广告收入账本与广告金额不一致', 'E_CONFLICT');
    if (!ad.paymentReceivedAt) await transaction.collection('ads').doc(ad._id).update({ data: {
      paymentReceivedAt: existing.createdAt || now, revenueLedgerId: ledgerId, updatedAt: now
    } });
    return { adId: ad._id, ledgerId, amount, duplicate: true };
  }
  await insert(transaction, 'ledger', { _id: ledgerId, refType: 'ad', refId: ad._id,
    communityId: null, communityIds: Array.isArray(ad.communityIds) ? ad.communityIds : [], providerId: null,
    amounts: { provider: 0, property: 0, platform: amount, goods: 0, merchant: 0 },
    settled: { provider: true, property: true, merchant: true },
    settlementIds: { provider: null, property: null, merchant: null },
    createdAt: now, createdBy: openid });
  await transaction.collection('ads').doc(ad._id).update({ data: {
    paymentReceivedAt: now, revenueLedgerId: ledgerId, updatedAt: now
  } });
  return { adId: ad._id, ledgerId, amount, duplicate: false };
}

module.exports = { confirmAdReceived };
