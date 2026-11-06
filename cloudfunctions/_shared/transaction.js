const { AppError } = require('./errors');
const { ensure } = require('./validate');

async function atomic(db, work) {
  try { return await db.runTransaction(work, 0); }
  catch (error) {
    if (error && (error.code === 'DATABASE_TRANSACTION_CONFLICT' ||
        String(error.errMsg || error.message || '').includes('DATABASE_TRANSACTION_CONFLICT'))) {
      throw new AppError('E_CONFLICT', '数据已变化，请刷新后重试');
    }
    throw error;
  }
}

async function read(transaction, collection, id) {
  const result = await transaction.collection(collection).doc(id).get();
  return result.data || null;
}

async function insert(transaction, collection, document) {
  const { _id, ...data } = document;
  ensure(!await read(transaction, collection, _id), '记录已存在，请刷新后重试', 'E_CONFLICT');
  await transaction.collection(collection).doc(_id).set({ data });
}

function sameSnapshot(current, expected, fields) {
  ensure(current && expected && fields.every(key => JSON.stringify(current[key] ?? null) === JSON.stringify(expected[key] ?? null)),
    '信息已变化，请重新获取报价', 'E_CONFLICT');
}

module.exports = { atomic, read, insert, sameSnapshot };
