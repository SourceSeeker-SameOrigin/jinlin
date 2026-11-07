const { ensure } = require('./validate');
const { maskPhone } = require('./money');
const { listView } = require('./orderData');

// 白名单输出：绝不透传用户身份、身份证材料、内部支付流水和 timeline.by。
function orderView(order, user, provider, config, now) {
  const roles = user.roles || [];
  const owner = user.openid === order.userOpenid;
  const assigned = provider && provider.openid === user.openid && order.providerId === provider._id &&
    provider.status === 'approved';
  const seller = order.kind === 'idle_purchase' && order.sellerOpenid === user.openid;
  const admin = roles.includes('admin');
  const property = roles.includes('property') && user.communityId === order.communityId;
  ensure(owner || assigned || admin || property || seller, '无权查看此订单', 'E_FORBIDDEN');
  const active = ['accepted', 'in_service', 'delivered', 'disputed'].includes(order.status);
  const end = order.completedAt || order.deliveredAt;
  const withinPhoneWindow = active && !order.completedAt || end && now - new Date(end) >= 0 &&
    now - new Date(end) < config.phoneVisibleHoursAfterDone * 3600000;
  const phoneAllowed = Boolean((active || order.status === 'completed') && withinPhoneWindow);
  const pricing = { ...order.pricing };
  if (!owner && !admin) delete pricing.couponId;
  const view = { ...listView(order), note: owner || assigned || admin ? order.note : '', address: owner || assigned || admin ? order.address :
    { buildingName: order.address && order.address.buildingName },
  pricing: { ...pricing }, ...(order.kind === 'merchant' ? { quote: order.quote || null, merchantName: order.detail && order.detail.merchantName } : {}), photos: order.kind === 'idle_purchase' ? order.idleDelivery && order.idleDelivery.photos || [] : order.photos,
  receiptPhoto: order.receiptPhoto || null, rating: order.rating,
  complaint: order.complaint ? { reason: order.complaint.reason, text: order.complaint.text,
    at: order.complaint.at, resolution: order.complaint.resolution ? {
      refundAmount: order.complaint.resolution.refundAmount,
      serviceRefundAmount: order.complaint.resolution.serviceRefundAmount,
      goodsRefundAmount: order.complaint.resolution.goodsRefundAmount,
      providerLiable: order.complaint.resolution.providerLiable,
      note: order.complaint.resolution.note, at: order.complaint.resolution.at } : null } : null,
  timeline: order.timeline.map(({ status, at }) => ({ status, at })),
  refunds: order.refunds.map(({ outRefundNo, amount, reason, status, at }) => ({ amount, reason, status, at,
    ...(admin ? { outRefundNo } : {}) })),
  userPhone: assigned && phoneAllowed ? order.userPhone : maskPhone(order.userPhone),
  canCallResident: Boolean(assigned && phoneAllowed),
  canCancel: owner && order.kind !== 'event_signup' && (order.status === 'pending_quote' || order.status === 'pending_pay' || order.status === 'paid' && order.kind !== 'membership_purchase'),
  canPay: owner && order.status === 'pending_pay',
  provider: null };
  if (owner || assigned || admin || seller && order.kind === 'idle_purchase') view.detail = order.detail;
  if (order.serviceCode === 'recycle' && order.recycleResult && (owner || assigned || admin)) {
    view.recycleSummary = { kg: (order.recycleResult.totalTenths / 10).toFixed(1), points: order.recycleResult.totalPoints,
      breakdown: order.recycleResult.breakdown.map(item => ({ category: item.categoryName, kg: (item.tenthsKg / 10).toFixed(1),
        points: item.points, ...(admin ? { recyclerId: item.recyclerId, revenueFen: item.revenueFen } : {}) })) };
  }
  if (order.kind === 'idle_purchase' && (owner || seller || admin)) {
    view.idleSale = { seller: !owner, price: order.idleSnapshot && order.idleSnapshot.price,
      ...(seller || admin ? { sellerAmount: order.idleSnapshot && order.idleSnapshot.sellerAmount } : {}),
      delivery: order.idleDelivery || null };
  }
  if (order.serviceCode === 'visit' && order.visitReport && (owner || assigned || admin)) view.visitReport = order.visitReport;
  if (order.serviceCode === 'visit' && owner) view.visitReportNotifyAuthorized = Boolean(order.visitReportNotifyAuthorizedAt);
  if (order.serviceCode === 'vacant' && order.vacantReport && (owner || assigned || admin)) view.vacantReport = order.vacantReport;
  if (order.serviceCode === 'vacant' && owner) view.visitReportNotifyAuthorized = Boolean(order.visitReportNotifyAuthorizedAt);
  if (provider && order.providerId === provider._id && (owner || assigned || admin || property)) {
    view.provider = { name: (provider.realName || '服务员').slice(0, 1) + '师傅', level: provider.level,
      avatarFileId: provider.avatarFileId || null,
      phone: owner && phoneAllowed ? provider.phone : maskPhone(provider.phone), canCall: Boolean(owner && phoneAllowed) };
  }
  return view;
}

module.exports = { orderView };
