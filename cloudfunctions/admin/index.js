const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { adminProviderActions } = require('./lib/shared/adminProviders');
const { adminOrderActions } = require('./lib/shared/adminOrders');
const { publicTemplates } = require('./lib/shared/notificationData');
const { requireRole } = require('./lib/shared/auth');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
async function notificationTemplates(event, { user }) {
  requireRole(user, ['admin']);
  return publicTemplates(await server.config());
}
exports.main = server.entry({ ...adminProviderActions(cloud, server), ...adminOrderActions(cloud, server), notificationTemplates }, ['admin', 'property']);
