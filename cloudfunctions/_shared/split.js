const { ensure, record, integer } = require('./validate');

function basisPoints(rates) {
  record(rates, '分账比例', 'E_CONFIG');
  for (const key of ['platform', 'property']) {
    ensure(typeof rates[key] === 'number' && Number.isFinite(rates[key]) && rates[key] >= 0 && rates[key] <= 1,
      '分账比例必须在零到一之间', 'E_CONFIG');
  }
  const platform = Math.round(rates.platform * 10000);
  const property = Math.round(rates.property * 10000);
  ensure(platform + property <= 10000 && rates.platform + rates.property <= 1,
    '平台和物业分账比例之和不能大于一', 'E_CONFIG');
  return { platform, property, provider: 10000 - platform - property };
}

// 用 BigInt 保证中间乘积精确，只在最终整分结果上转换回 Number。
function share(amount, rate) {
  return Number(BigInt(amount) * BigInt(rate) / 10000n);
}

function split(input) {
  record(input, '分账参数');
  const { listPrice, payAmount, refundAmount = 0, providerLiable = false,
    rates, goodsActual = 0, source = 'user', membershipTaskPayout } = input;
  integer(listPrice, '原价');
  integer(payAmount, '实付服务费', 0, listPrice);
  integer(refundAmount, '退款服务费', 0, payAmount);
  integer(goodsActual, '实际商品款');
  ensure(typeof providerLiable === 'boolean', '服务员责任标记不正确');
  ensure(source === 'user' || source === 'membership', '订单来源不正确');
  const bps = basisPoints(rates);
  const netCollected = payAmount - refundAmount;
  let provider;
  if (source === 'membership') {
    integer(membershipTaskPayout, '月卡任务计件费');
    provider = membershipTaskPayout;
  } else if (providerLiable && refundAmount > 0) {
    provider = Number(BigInt(listPrice) * BigInt(bps.provider) * BigInt(netCollected) /
      (10000n * BigInt(payAmount)));
  } else {
    provider = share(listPrice, bps.provider);
  }
  const property = share(netCollected, bps.property);
  const platform = netCollected - property - provider;
  integer(platform, '平台分账', -Number.MAX_SAFE_INTEGER);
  return { provider, property, platform, goods: goodsActual };
}

function splitMembershipSale(payAmount, rates) {
  integer(payAmount, '月卡实付金额');
  const property = share(payAmount, basisPoints(rates).property);
  return { provider: 0, property, platform: payAmount - property, goods: 0 };
}

module.exports = { split, splitMembershipSale };
