const { atomic, read, insert } = require('./transaction');
const { ensure, text, integer } = require('./validate');
const { newOrderConversation, orderConversationId, readOnly, messageView, checkSendRate } = require('./chatData');
const { isEnabled } = require('./features');

async function ensureOrderConversation(server, order) {
  ensure(order && order.providerOpenid, '订单尚未指派服务员', 'E_BAD_STATE');
  const id = orderConversationId(order._id, order.providerOpenid);
  return atomic(server.db, async transaction => {
    const currentOrder = await read(transaction, 'orders', order._id);
    ensure(currentOrder && currentOrder.providerOpenid === order.providerOpenid,
      '订单服务员已变化，请刷新后重试', 'E_CONFLICT');
    const existing = await read(transaction, 'conversations', id);
    if (existing) return existing;
    const conversation = newOrderConversation(currentOrder);
    if (currentOrder.completedAt) {
      const config = await read(transaction, 'config', 'global');
      conversation.closeAt = new Date(new Date(currentOrder.completedAt).getTime() +
        Number(config.phoneVisibleHoursAfterDone) * 3600000);
      if (conversation.closeAt <= new Date()) conversation.closedAt = new Date();
    }
    await insert(transaction, 'conversations', conversation);
    return conversation;
  });
}

function createChatFlow(cloud, server) {
  const { db, command } = server;
  async function orderForMember(conversation, openid) {
    ensure(conversation && conversation.type === 'order' && conversation.members.includes(openid), '无权访问此会话', 'E_FORBIDDEN');
    const order = await server.get('orders', conversation.refId);
    ensure(order && (order.userOpenid === openid || order.providerOpenid === openid), '已不再参与此订单会话', 'E_FORBIDDEN');
    return order;
  }

  async function ensureWritable(order, conversation, config, now) {
    ensure(order.providerOpenid && conversation.members.includes(order.providerOpenid), '当前订单服务员不在会话中', 'E_FORBIDDEN');
    ensure(!readOnly(order, conversation, config, now), '该会话已关闭，只能查看历史消息', 'E_BAD_STATE');
    ensure(['accepted', 'in_service', 'delivered', 'disputed', 'completed'].includes(order.status), '当前订单状态不能发送消息', 'E_BAD_STATE');
  }

  async function openOrder(event, { openid }) {
    text(event.orderId, '订单');
    const order = await server.get('orders', event.orderId);
    ensure(order && order.kind === 'service', '订单会话不存在');
    ensure(order.userOpenid === openid || order.providerOpenid === openid, '无权访问此订单会话', 'E_FORBIDDEN');
    ensure(order.providerOpenid, '服务员接单后即可聊天', 'E_BAD_STATE');
    const { community, settings } = await server.feature('chat', order.communityId);
    const conversation = await ensureOrderConversation(server, order);
    return { conversationId: conversation._id, readOnly: readOnly(order, conversation, settings),
      unread: conversation.unread && conversation.unread[openid] || 0, enabled: Boolean(community) };
  }

  async function pullMessages(conversation, order, openid, event, config) {
    const now = new Date();
    const isReadOnly = readOnly(order, conversation, config, now);
    if (isReadOnly && !conversation.closedAt) await db.collection('conversations').doc(conversation._id)
      .update({ data: { closedAt: now, updatedAt: now } });
    const afterId = !event.afterId ? '' : text(event.afterId, '消息游标', 100);
    const filter = { convId: conversation._id };
    if (afterId) filter._id = command.gt(afterId);
    const result = await db.collection('messages').where(filter).orderBy('_id', 'asc').limit(50).get();
    return { conversationId: conversation._id, list: result.data.map(item => messageView(item, openid)), hasMore: result.data.length === 50,
      lastId: result.data.length ? result.data[result.data.length - 1]._id : afterId,
      readOnly: isReadOnly, unread: conversation.unread && conversation.unread[openid] || 0 };
  }

  async function pull(event, { openid }) {
    text(event.conversationId, '会话');
    const conversation = await server.get('conversations', event.conversationId);
    const order = await orderForMember(conversation, openid);
    await server.feature('chat', order.communityId);
    return pullMessages(conversation, order, openid, event, await server.config());
  }

  async function send(event, { openid }) {
    text(event.conversationId, '会话');
    ensure(['text', 'image'].includes(event.type), '消息类型不正确');
    const conversation = await server.get('conversations', event.conversationId);
    const order = await orderForMember(conversation, openid);
    const { settings: config } = await server.feature('chat', order.communityId);
    const now = new Date();
    await ensureWritable(order, conversation, config, now);
    let content = '';
    let fileId = null;
    if (event.type === 'text') {
      text(event.content, '消息内容', 500);
      const { checkText } = require('./ugc');
      content = await checkText(cloud, event.content, { blacklist: config.blacklist, type: 'message', openid });
    } else {
      fileId = text(event.fileId, '图片文件', 300);
      ensure(fileId.startsWith('cloud://'), '图片文件地址不正确');
    }
    const recipient = conversation.members.find(member => member !== openid);
    ensure(recipient, '会话参与者不完整', 'E_CONFIG');
    const message = await atomic(db, async transaction => {
      const current = await read(transaction, 'conversations', conversation._id);
      ensure(current && current.members.includes(openid), '会话已变化，请刷新后重试', 'E_CONFLICT');
      const currentOrder = await read(transaction, 'orders', current.refId);
      ensure(currentOrder && currentOrder.providerOpenid && current.members.includes(currentOrder.providerOpenid),
        '当前订单服务员不在会话中', 'E_FORBIDDEN');
      const [currentConfig, currentCommunity] = await Promise.all([read(transaction, 'config', 'global'),
        read(transaction, 'communities', currentOrder.communityId)]);
      ensure(isEnabled('chat', currentConfig, currentCommunity), '该功能暂未开放', 'E_FEATURE_OFF');
      await ensureWritable(currentOrder, current, currentConfig, now);
      const lastSentAt = current.lastSentAt && current.lastSentAt[openid] ? new Date(current.lastSentAt[openid]) : null;
      checkSendRate(lastSentAt, now);
      const messageSeq = integer(current.messageSeq || 0, '消息序号', 0, Number.MAX_SAFE_INTEGER - 1) + 1;
      const id = current._id + '_' + String(messageSeq).padStart(12, '0');
      const value = { _id: id, convId: current._id, communityId: current.communityId, from: openid,
        type: event.type, content, fileId, status: event.type === 'image' ? 'pending' : 'ok', createdAt: now };
      await insert(transaction, 'messages', value);
      const unread = { ...(current.unread || {}), [recipient]: (current.unread && current.unread[recipient] || 0) + 1 };
      await transaction.collection('conversations').doc(current._id).update({ data: {
        lastMessage: event.type === 'image' ? '图片审核中' : content.slice(0, 100), lastAt: now, unread,
        lastSentAt: { ...(current.lastSentAt || {}), [openid]: now }, messageSeq, updatedAt: now
      } });
      return value;
    });
    if (event.type === 'image') {
      const { requestMediaCheck } = require('./ugc');
      try { await requestMediaCheck(cloud, db, { fileId, targetType: 'message', targetId: message._id,
        authorOpenid: openid, communityId: order.communityId }); }
      catch (_) {
        await db.collection('messages').doc(message._id).update({ data: { status: 'blocked', moderationFailedAt: new Date() } });
        await db.collection('conversations').doc(conversation._id).update({ data: { lastMessage: '图片未通过审核', updatedAt: new Date() } });
      }
    }
    return { messageId: message._id, status: message.status };
  }

  async function list(event, { openid }) {
    const result = await db.collection('conversations').where({ members: openid })
      .orderBy('lastAt', 'desc').limit(100).get();
    const list = [];
    const config = await server.config();
    for (const conversation of result.data) {
      if (conversation.type !== 'order') continue;
      const order = await server.get('orders', conversation.refId);
      if (!order || (order.userOpenid !== openid && order.providerOpenid !== openid)) continue;
      const community = await server.get('communities', order.communityId);
      if (!isEnabled('chat', config, community)) continue;
      list.push({ conversationId: conversation._id, type: conversation.type, refId: conversation.refId,
        serviceName: ({ express: '代取快递', trash: '代扔垃圾', buy: '周边代买', help: '帮把手' })[order.serviceCode] || '订单',
        lastMessage: conversation.lastMessage || '', lastAt: conversation.lastAt,
        unread: conversation.unread && conversation.unread[openid] || 0,
        readOnly: readOnly(order, conversation, config) });
    }
    return { list, unreadTotal: list.reduce((sum, item) => sum + item.unread, 0) };
  }

  async function markRead(event, { openid }) {
    text(event.conversationId, '会话');
    const initial = await server.get('conversations', event.conversationId);
    const order = await orderForMember(initial, openid);
    await server.feature('chat', order.communityId);
    await atomic(db, async transaction => {
      const conversation = await read(transaction, 'conversations', initial._id);
      ensure(conversation && conversation.members.includes(openid), '无权访问此会话', 'E_FORBIDDEN');
      await transaction.collection('conversations').doc(conversation._id)
        .update({ data: { ['unread.' + openid]: 0, updatedAt: new Date() } });
    });
    return { conversationId: initial._id, unread: 0 };
  }

  async function adminPull(event, { user, openid }) {
    ensure(user.roles.includes('admin'), '只有管理员可处理聊天举报或投诉', 'E_FORBIDDEN');
    let caseMessage = null;
    let conversation = event.conversationId ? await server.get('conversations', text(event.conversationId, '会话')) : null;
    if (!conversation && event.reportId) {
      const report = await server.get('reports', text(event.reportId, '举报记录'));
      ensure(report && report.targetType === 'message', '聊天举报不存在', 'E_FORBIDDEN');
      const message = await server.get('messages', report.targetId);
      if (message) { caseMessage = message; conversation = await server.get('conversations', message.convId); }
    }
    if (!conversation && event.orderId) {
      const order = await server.get('orders', text(event.orderId, '订单'));
      if (order && order.providerOpenid) conversation = await server.get('conversations',
        orderConversationId(order._id, order.providerOpenid));
    }
    ensure(conversation && conversation.type === 'order', '订单会话不存在');
    const order = await server.get('orders', conversation.refId);
    ensure(order, '关联订单不存在');
    await server.feature('chat', order.communityId);
    let reason;
    let caseId;
    if (event.caseType === 'complaint') {
      ensure(order.status === 'disputed' && order.complaint && !order.complaint.resolution,
        '该订单当前没有待处理投诉', 'E_FORBIDDEN');
      reason = 'complaint'; caseId = order._id;
    } else if (event.caseType === 'report') {
      text(event.reportId, '举报记录');
      const report = await server.get('reports', event.reportId);
      ensure(report && report.status === 'pending' && report.targetType === 'message', '该聊天举报已处理或无权查看', 'E_FORBIDDEN');
      const message = await server.get('messages', report.targetId);
      ensure(message && message.convId === conversation._id, '举报内容不属于此会话', 'E_FORBIDDEN');
      caseMessage = message;
      reason = 'report'; caseId = report._id;
    } else ensure(false, '请提供有效的投诉或举报案件', 'E_FORBIDDEN');
    await db.collection('auditLogs').add({ data: { action: 'chat_admin_view', actorOpenid: openid,
      orderId: order._id, conversationId: conversation._id, caseType: reason, caseId, at: new Date() } });
    const result = await pullMessages(conversation, order, openid, event, await server.config());
    if (caseMessage && !result.list.some(item => item._id === caseMessage._id)) {
      result.list.push(messageView(caseMessage, openid));
      result.list.sort((left, right) => left._id.localeCompare(right._id));
    }
    const senderRows = await Promise.all(result.list.map(item => server.get('messages', item._id)));
    return { ...result, list: result.list.map((item, index) => ({ ...item,
      from: senderRows[index] && senderRows[index].from || '' })) };
  }

  return { openOrder, pull, send, list, markRead, adminPull };
}

module.exports = { ensureOrderConversation, createChatFlow };
