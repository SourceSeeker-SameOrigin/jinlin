const { ensure, integer, record, text } = require('./validate');
const { csvCell } = require('./settlementData');

const CATEGORIES = Object.freeze({ paper: '纸类', plastic: '塑料', metal: '金属', clothing: '衣物', appliance: '小家电' });

function clean(detail) {
  record(detail, '回收预约');
  ensure(Array.isArray(detail.categories) && detail.categories.length >= 1 && detail.categories.length <= 5,
    '请选择至少一种回收类别');
  const categories = [...new Set(detail.categories)];
  ensure(categories.length === detail.categories.length && categories.every(item => Object.prototype.hasOwnProperty.call(CATEGORIES, item)),
    '回收类别不正确');
  const note = detail.note === undefined ? '' : detail.note;
  ensure(typeof note === 'string' && [...note].length <= 200, '回收说明不能超过 200 字');
  return { categories, note: note.trim() };
}

function snapshot(community, detail) {
  const config = record(community && community.prices && community.prices.recycle, '回收配置', 'E_CONFIG');
  const categoryConfig = record(config.categories, '回收分类配置', 'E_CONFIG');
  const categories = {};
  for (const key of detail.categories) {
    const item = record(categoryConfig[key], `${CATEGORIES[key]}配置`, 'E_CONFIG');
    categories[key] = {
      pointsPerKg: integer(item.pointsPerKg, `${CATEGORIES[key]}积分单价`, 0, 1000000, 'E_CONFIG'),
      purchaseFenPerKg: integer(item.purchaseFenPerKg, `${CATEGORIES[key]}收购价`, 0, 100000000, 'E_CONFIG'),
      recyclerId: text(item.recyclerId, `${CATEGORIES[key]}回收企业`, 100)
    };
  }
  return { categories, providerBaseFen: integer(config.providerBaseFen === undefined ? 300 : config.providerBaseFen,
    '每单服务员报酬', 0, 10000000, 'E_CONFIG'), providerFenPerKg: integer(config.providerFenPerKg === undefined ? 20 : config.providerFenPerKg,
    '每公斤服务员报酬', 0, 10000000, 'E_CONFIG') };
}

function quote() { return { listPrice: 0, discount: 0, payAmount: 0, goodsCap: 0, reason: '环保回收服务', freeByMembership: false }; }

function weigh(event, order) {
  ensure(order && order.serviceCode === 'recycle' && order.recycleSnapshot, '回收订单配置缺失', 'E_CONFIG');
  const weights = record(event.weightsTenths, '分类重量');
  const keys = order.detail.categories;
  ensure(Object.keys(weights).length === keys.length && keys.every(key => Object.hasOwn(weights, key)), '称重类别与预约不一致');
  let totalTenths = 0;
  let totalPoints = 0;
  let totalRevenueFen = 0;
  const breakdown = keys.map(category => {
    const tenthsKg = integer(weights[category], `${CATEGORIES[category]}重量`, 0, 100000, 'E_INVALID_PARAM');
    const price = order.recycleSnapshot.categories[category];
    ensure(price && typeof price.recyclerId === 'string', `${CATEGORIES[category]}回收企业配置缺失`, 'E_CONFIG');
    const points = Math.floor(tenthsKg * price.pointsPerKg / 10);
    const revenueFen = Math.round(tenthsKg * price.purchaseFenPerKg / 10);
    totalTenths += tenthsKg; totalPoints += points; totalRevenueFen += revenueFen;
    return { category, categoryName: CATEGORIES[category], tenthsKg, points, revenueFen, recyclerId: price.recyclerId };
  });
  ensure(totalTenths > 0, '请录入大于 0 kg 的回收重量');
  const providerPayoutFen = order.recycleSnapshot.providerBaseFen + Math.round(totalTenths * order.recycleSnapshot.providerFenPerKg / 10);
  return { breakdown, totalTenths, totalPoints, totalRevenueFen, providerPayoutFen };
}

function recyclerStatement(orders, from, to) {
  ensure(Array.isArray(orders), '回收订单数据不正确', 'E_CONFIG');
  const totals = new Map();
  for (const order of orders) {
    if (order.status !== 'completed' || !order.completedAt || order.completedAt < from || order.completedAt >= to) continue;
    for (const item of order.recycleResult && order.recycleResult.breakdown || []) {
      const key = item.recyclerId + '\u0000' + item.category;
      const row = totals.get(key) || { recyclerId: item.recyclerId, category: item.category, categoryName: item.categoryName,
        tenthsKg: 0, amountFen: 0, orderCount: 0 };
      row.tenthsKg += item.tenthsKg; row.amountFen += item.revenueFen; row.orderCount += 1;
      totals.set(key, row);
    }
  }
  const rows = [...totals.values()].sort((a, b) => a.recyclerId.localeCompare(b.recyclerId) || a.category.localeCompare(b.category));
  return { rows, totalFen: rows.reduce((sum, row) => sum + row.amountFen, 0) };
}

function recyclerStatementCsv(result, from, to) {
  const header = ['回收企业名称', '回收企业ID', '回收类别', '期间开始', '期间结束', '重量（kg）', '收购金额（分）', '订单数'];
  const rows = result.rows.map(row => [row.recyclerName || '', row.recyclerId, row.categoryName, from, to,
    (row.tenthsKg / 10).toFixed(1), row.amountFen, row.orderCount]);
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

module.exports = { CATEGORIES, clean, snapshot, quote, weigh, recyclerStatement, recyclerStatementCsv };
