const { requireRole, requireCommunityAccess } = require('./auth');
const { ensure, text } = require('./validate');
const { period, rowsForPayee, total, csv, settlementId, validatePayee, validateSettlementNote } = require('./settlementData');
const { atomic, read, insert } = require('./transaction');

function adminSettlementActions(cloud, server) {
  const { db, command } = server;
  async function scope(event, user) {
    validatePayee(event.payee);
    const date = period(event);
    let communityId = event.communityId;
    if (event.payee === 'property' && user.roles.includes('property')) communityId = user.communityId;
    text(communityId, '小区');
    if (event.payee === 'provider') requireRole(user, ['admin']);
    else requireRole(user, ['admin', 'property']);
    requireCommunityAccess(user, communityId);
    let provider = null;
    if (event.payee === 'provider') {
      provider = await server.get('providers', event.providerId);
      ensure(provider && provider.communityId === communityId, '服务员不属于该小区');
    }
    return { ...date, communityId, provider };
  }
  async function settlementPreview(event, { user }) {
    const data = await scope(event, user);
    const filter = { communityId: data.communityId, createdAt: command.gte(data.from).and(command.lt(data.to)) };
    const ledger = await server.all('ledger', filter);
    const rows = [];
    if (event.payee === 'property') {
      const eligible = rowsForPayee(ledger, 'property');
      if (eligible.length) rows.push({ payee: 'property', communityId: data.communityId, providerId: null,
        from: event.from, to: event.to, total: total(eligible, 'property'), ledgerIds: eligible.map(row => row._id), status: 'unsettled' });
    } else {
      const ids = event.providerId ? [event.providerId] : [...new Set(ledger.filter(row => row.providerId && row.settled.provider === false).map(row => row.providerId))];
      for (const id of ids) {
        const eligible = rowsForPayee(ledger, 'provider', id);
        if (eligible.length) rows.push({ payee: 'provider', communityId: data.communityId, providerId: id,
          from: event.from, to: event.to, total: total(eligible, 'provider'), ledgerIds: eligible.map(row => row._id), status: 'unsettled' });
      }
    }
    return { from: event.from, to: event.to, rows };
  }
  async function settlementCreate(event, { user, openid }) {
    requireRole(user, ['admin']);
    const data = await scope(event, user);
    const preview = await settlementPreview(event, { user });
    ensure(preview.rows.length, '该期间没有待结算账目');
    const results = [];
    for (const row of preview.rows) {
      const id = settlementId(row.payee, row.communityId, row.providerId, event.from, event.to);
      const settlement = await atomic(db, async transaction => {
        const existing = await read(transaction, 'settlements', id);
        if (existing) return existing;
        const ids = [...row.ledgerIds].sort();
        for (const ledgerId of ids) {
          const ledgerRow = await read(transaction, 'ledger', ledgerId);
          ensure(ledgerRow && ledgerRow.settled[row.payee] === false &&
            (row.payee !== 'provider' || ledgerRow.providerId === row.providerId), '部分账目已结算，请刷新预览', 'E_CONFLICT');
          const settlementIds = { ...(ledgerRow.settlementIds || {}), [row.payee]: id };
          await transaction.collection('ledger').doc(ledgerId).update({ data: { [row.payee === 'provider' ? 'settlementIds.provider' : 'settlementIds.property']: id } });
        }
        const result = { _id: id, payee: row.payee, providerId: row.providerId, communityId: row.communityId,
          period: data.period, ledgerIds: ids, total: row.total, status: 'draft', paidAt: null,
          note: validateSettlementNote(event.note), createdAt: new Date(), createdBy: openid };
        await insert(transaction, 'settlements', result);
        return result;
      });
      results.push(settlement);
    }
    return { settlements: results };
  }
  async function settlementMarkPaid(event, { user, openid }) {
    requireRole(user, ['admin']);
    text(event.settlementId, '结算单');
    const settlement = await server.get('settlements', event.settlementId);
    ensure(settlement, '结算单不存在');
    const paidAt = new Date();
    return atomic(db, async transaction => {
      const current = await read(transaction, 'settlements', settlement._id);
      ensure(current, '结算单不存在');
      if (current.status === 'paid') return { settlementId: current._id, status: 'paid' };
      ensure(current.status === 'draft', '结算单状态不正确', 'E_BAD_STATE');
      for (const ledgerId of current.ledgerIds) {
        const row = await read(transaction, 'ledger', ledgerId);
        const field = current.payee === 'provider' ? 'provider' : 'property';
        const settlementField = field === 'provider' ? 'settlementIds.provider' : 'settlementIds.property';
        ensure(row && row.settled[field] === false && row.settlementIds[field] === current._id,
          '账本与结算单不一致，请联系管理员', 'E_CONFLICT');
        await transaction.collection('ledger').doc(row._id).update({ data: { ['settled.' + field]: true,
          [settlementField]: current._id } });
      }
      await transaction.collection('settlements').doc(current._id).update({ data: {
        status: 'paid', paidAt, note: validateSettlementNote(event.note || current.note), paidBy: openid } });
      return { settlementId: current._id, status: 'paid' };
    });
  }
  async function exportCsv(event, { user }) {
    const preview = await settlementPreview(event, { user });
    const body = csv(preview.rows);
    const file = await cloud.uploadFile({ cloudPath: 'exports/settlements/' + Date.now() + '.csv',
      fileContent: Buffer.from(body, 'utf8') });
    const result = await cloud.getTempFileURL({ fileList: [file.fileID] });
    return { fileId: file.fileID, tempFileURL: result.fileList[0].tempFileURL, count: preview.rows.length };
  }
  async function listSettlements(event, { user }) {
    requireRole(user, ['admin', 'property']);
    const filter = {};
    if (user.roles.includes('property')) { filter.communityId = user.communityId; filter.payee = 'property'; }
    else if (event.communityId) filter.communityId = event.communityId;
    const rows = await server.all('settlements', filter);
    return { list: rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map(({ _id, payee, providerId,
      communityId, period: range, total: amount, status, paidAt, note }) => ({ _id, payee, providerId, communityId,
      period: range, total: amount, status, paidAt, note })) };
  }
  return { settlementPreview, settlementCreate, settlementMarkPaid, exportCsv, listSettlements };
}

module.exports = { adminSettlementActions };
