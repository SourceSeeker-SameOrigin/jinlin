const { csvCell } = require('./settlementData');
const { ymd, hm } = require('./time');

const HEADER = Object.freeze(['订单号', '小区ID', '服务代码', '订单状态', '创建时间', '完成时间',
  '服务费实付（分）', '餐费实际（分）', '退款合计（分）']);

function subsidyCsv(orders) {
  const rows = (orders || []).map(order => [order.orderNo, order.communityId, order.serviceCode, order.status,
    ymd(order.createdAt) + ' ' + hm(order.createdAt), order.completedAt ? ymd(order.completedAt) + ' ' + hm(order.completedAt) : '',
    order.pricing.payAmount, order.pricing.goodsActual || 0,
    (order.refunds || []).filter(item => item.status === 'success').reduce((sum, item) => sum + item.amount, 0)]);
  return '\uFEFF' + [HEADER, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

module.exports = { HEADER, subsidyCsv };
