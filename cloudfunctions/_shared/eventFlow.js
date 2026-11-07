const { ensure } = require('./validate');
const { read } = require('./transaction');

async function activateEventSignup(transaction, order, now) {
  if (order.kind !== 'event_signup' || !order.signupId) return;
  const signup = await read(transaction, 'signups', order.signupId);
  ensure(signup && signup.orderId === order._id, '活动报名记录不存在', 'E_CONFIG');
  if (signup.status === 'signed') return;
  if (['cancelled', 'refunded'].includes(signup.status)) return { cancelled: true };
  ensure(signup.status === 'pending_pay', '活动报名状态已变化', 'E_CONFLICT');
  const event = await read(transaction, 'events', signup.eventId);
  ensure(event, '活动不存在', 'E_CONFIG');
  if (event.status !== 'published' || event.signupDeadline <= now) {
    await transaction.collection('signups').doc(signup._id).update({ data: { status: 'cancelled', cancelledAt: now } });
    await transaction.collection('events').doc(event._id).update({ data: {
      reservedCount: Math.max(0, (event.reservedCount || 0) - 1), updatedAt: now
    } });
    return { cancelled: true };
  }
  ensure((event.signupCount || 0) < event.capacity, '活动名额已满', 'E_CONFLICT');
  await transaction.collection('signups').doc(signup._id).update({ data: { status: 'signed', signedAt: now } });
  await transaction.collection('events').doc(event._id).update({ data: {
    reservedCount: Math.max(0, (event.reservedCount || 0) - 1), signupCount: (event.signupCount || 0) + 1,
    updatedAt: now
  } });
}

async function releaseEventSignup(transaction, order, status, now) {
  if (order.kind !== 'event_signup' || !order.signupId) return;
  const signup = await read(transaction, 'signups', order.signupId);
  if (!signup || signup.orderId !== order._id || signup.status !== 'pending_pay') return;
  const event = await read(transaction, 'events', signup.eventId);
  await transaction.collection('signups').doc(signup._id).update({ data: { status, cancelledAt: now } });
  if (event) await transaction.collection('events').doc(event._id).update({ data: {
    reservedCount: Math.max(0, (event.reservedCount || 0) - 1), updatedAt: now
  } });
}

async function refundEventSignup(transaction, order, now) {
  if (order.kind !== 'event_signup' || !order.signupId) return;
  const signup = await read(transaction, 'signups', order.signupId);
  if (!signup || signup.orderId !== order._id || !['signed', 'checked_in'].includes(signup.status)) return;
  ensure(signup.status !== 'checked_in', '已签到的活动报名不能取消', 'E_BAD_STATE');
  const event = await read(transaction, 'events', signup.eventId);
  await transaction.collection('signups').doc(signup._id).update({ data: { status: 'refunded', cancelledAt: now } });
  if (event) await transaction.collection('events').doc(event._id).update({ data: {
    signupCount: Math.max(0, (event.signupCount || 0) - 1), updatedAt: now
  } });
}

module.exports = { activateEventSignup, releaseEventSignup, refundEventSignup };
