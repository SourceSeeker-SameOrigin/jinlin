const { notificationData, eventReminderData, EVENT_REMINDER_FIELDS } = require('./notificationData');

function createNotifier(cloud, server) {
  async function send(openid, templateKey, data, page, suppliedConfig) {
    try {
      const config = suppliedConfig || await server.config();
      const templateId = config.templateIds && config.templateIds[templateKey];
      if (!templateId) return { skipped: true };
      const result = await cloud.openapi.subscribeMessage.send({ touser: openid, templateId, data, page,
        miniprogramState: config.messageState || 'developer', lang: 'zh_CN' });
      if ((result.errCode || result.errcode || 0) !== 0) throw new Error('E_NOTIFY');
      return { sent: true };
    } catch (error) {
      console.error('订阅消息发送失败', templateKey, error.code || error.errCode || 'E_NOTIFY');
      return { sent: false };
    }
  }
  async function resident(key, order) {
    try {
      const config = await server.config();
      if (!config.templateIds || !config.templateIds[key]) return;
      await send(order.userOpenid, key, notificationData(key, order, new Date(), config.templateFields && config.templateFields[key]),
        'pages/orders/detail?id=' + order._id, config);
    } catch (error) { console.error('住户提醒未发送', key, error.code || 'E_NOTIFY'); }
  }
  async function visitReport(order) {
    if (!order.visitReportNotifyAuthorizedAt) return { skipped: true };
    return resident('visitReport', order);
  }
  async function vacantReport(order) {
    if (!order.visitReportNotifyAuthorizedAt) return { skipped: true };
    return resident('visitReport', order);
  }
  async function newTask(order) {
    if (order.kind !== 'service') return;
    try {
      const config = await server.config();
      if (!config.templateIds || !config.templateIds.newTask) return;
      const providers = await server.all('providers', { communityId: order.communityId, status: 'approved', onDuty: true,
        level: server.command.gte(order.minLevel), insuranceUntil: server.command.gt(new Date()) });
      const data = notificationData('newTask', order, new Date(), config.templateFields && config.templateFields.newTask);
      for (const provider of providers) {
        if ((order.releasedProviderIds || []).includes(provider._id)) continue;
        const result = await send(provider.openid, 'newTask', data, 'provider/hall/hall', config);
        if (result.sent) await server.db.collection('providers').doc(provider._id)
          .update({ data: { 'notificationStats.newTaskSent': server.command.inc(1) } });
      }
    } catch (error) { console.error('新任务提醒未完成', error.code || 'E_NOTIFY'); }
  }
  async function unaccepted(order) {
    try {
      const config = await server.config();
      if (!config.templateIds || !config.templateIds.unaccepted) return;
      const data = notificationData('unaccepted', order, new Date(), config.templateFields && config.templateFields.unaccepted);
      for (const openid of [...new Set(config.adminOpenids || [])]) {
        const user = await server.one('users', { openid });
        if (!user || user.blocked || !user.roles.includes('admin')) continue;
        await send(openid, 'unaccepted', data, 'admin/order/order?id=' + order._id, config);
      }
    } catch (error) { console.error('未接单告警未发送', error.code || 'E_NOTIFY'); }
  }
  async function eventReminder(openid, event) {
    const config = await server.config();
    if (!config.templateIds || !config.templateIds.eventReminder) return { skipped: true };
    const fields = config.templateFields && config.templateFields.eventReminder || EVENT_REMINDER_FIELDS;
    return send(openid, 'eventReminder', eventReminderData(event, fields), 'events/detail/detail?id=' + event._id, config);
  }
  return { send, newTask, resident, visitReport, vacantReport, unaccepted, eventReminder };
}
module.exports = { createNotifier };
