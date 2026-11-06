const { ensure, record, text } = require('./validate');
const { ymd, addDays, parseWindow, nextDutyWindow } = require('./time');
const { STATUS_TEXT, assertTransition } = require('./stateMachine');

const SERVICE_NAMES = Object.freeze({ express: '代取快递', trash: '代扔垃圾', buy: '周边代买', help: '帮把手' });
const STATUS_GROUPS = Object.freeze({ ongoing: ['pending_pay', 'paid', 'accepted', 'in_service', 'delivered'],
  done: ['completed', 'closed', 'cancelled'], aftersale: ['disputed', 'refunded'] });

function availableSlots(windows, now) {
  nextDutyWindow(windows, now); // 同时验证配置及循环时段不重叠。
  return [-1, 0, 1].flatMap(offset => windows.map(window => ({ date: ymd(addDays(now, offset)),
    start: window.start, end: window.end }))).filter(slot => {
    const { startAt, endAt } = parseWindow(slot);
    return endAt > now && (slot.date >= ymd(now) || startAt <= now);
  }).sort((a, b) => parseWindow(a).startAt - parseWindow(b).startAt);
}

function validateSlot(slot, windows, onDutyCount, now) {
  if (slot === null) {
    ensure(onDutyCount > 0, '现在没有服务员值班，请选择上门时段');
    return null;
  }
  record(slot, '上门时段');
  const matched = availableSlots(windows, now).find(item => item.date === slot.date && item.start === slot.start && item.end === slot.end);
  ensure(matched, '该时段已结束或不可预约，请重新选择');
  return matched;
}

function cleanDetail(serviceCode, detail, community) {
  record(detail, '服务详情');
  if (serviceCode === 'express') {
    ensure(community.stations.some(station => station.code === detail.stationCode), '请选择本小区的驿站');
    return { stationCode: detail.stationCode, pickupCodes: detail.pickupCodes.map(value => value.trim()),
      largeCount: detail.largeCount, placement: detail.placement || 'door' };
  }
  if (serviceCode === 'trash') return { bags: detail.bags, sorted: detail.sorted, placement: 'door' };
  if (serviceCode === 'buy') return { shop: detail.shop.trim(), items: detail.items.trim(), goodsCap: detail.goodsCap };
  if (serviceCode === 'help') return { category: detail.category, desc: detail.desc.trim(), blocks: detail.blocks };
  ensure(false, '暂不支持该服务');
}

function cleanNote(note = '') {
  ensure(typeof note === 'string' && [...note].length <= 100, '备注不能超过 100 字');
  return note.trim();
}

function addressSnapshot(user, community, building) {
  ensure(community && community.status === 'active', '该小区暂不可用');
  ensure(building && building.communityId === community._id && user.communityId === community._id,
    '请重新绑定本小区门牌');
  ensure(building.units.includes(user.unit), '请选择有效单元');
  text(user.room, '门牌号', 30);
  ensure(/^1\d{10}$/.test(user.phone || ''), '请先授权手机号并绑定门牌');
  return { buildingName: building.name, unit: user.unit, room: user.room };
}

function transitionPatch(order, status, actor, now) {
  assertTransition(order.status, status);
  return { status, alertPriority: status === 'paid' && order.alertedAt ? 1 : 0,
    updatedAt: now, timeline: [...order.timeline, { status, at: now, by: actor }] };
}

function newOrder({ id, orderNo, user, community, building, serviceCode, detail, note, slot, pricing, now }) {
  return { _id: id, orderNo, kind: 'service', serviceCode, planCode: null,
    communityId: community._id, buildingId: building._id, address: addressSnapshot(user, community, building),
    userOpenid: user.openid, userPhone: user.phone, minLevel: serviceCode === 'help' ? 2 : 1,
    detail: cleanDetail(serviceCode, detail, community), note: cleanNote(note), slot,
    pricing: { listPrice: pricing.listPrice, discount: pricing.discount, payAmount: pricing.payAmount,
      goodsCap: pricing.goodsCap, goodsActual: 0, freeByMembership: pricing.freeByMembership },
    status: 'pending_pay', source: 'user', membershipId: null, providerOpenid: null, providerId: null,
    photos: [], rating: null, complaint: null,
    payment: { outTradeNo: orderNo, transactionId: null, paidAt: null }, refunds: [],
    timeline: [{ status: 'pending_pay', at: now, by: user.openid }],
    alertedAt: null, alertPriority: 0, acceptedAt: null, deliveredAt: null, completedAt: null, createdAt: now, updatedAt: now };
}

function listView(order) {
  return { _id: order._id, orderNo: order.orderNo, kind: order.kind, serviceCode: order.serviceCode, communityId: order.communityId,
    serviceName: SERVICE_NAMES[order.serviceCode] || '月卡', status: order.status, statusText: STATUS_TEXT[order.status],
    pricing: { payAmount: order.pricing.payAmount, goodsCap: order.pricing.goodsCap }, slot: order.slot,
    createdAt: order.createdAt, buildingName: order.address && order.address.buildingName };
}

module.exports = { SERVICE_NAMES, STATUS_GROUPS, availableSlots, validateSlot, cleanDetail, cleanNote,
  addressSnapshot, transitionPatch, newOrder, listView };
