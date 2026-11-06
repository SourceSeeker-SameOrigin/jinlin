const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { adminProviderActions } = require('./lib/shared/adminProviders');
const { adminOrderActions } = require('./lib/shared/adminOrders');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
exports.main = server.entry({ ...adminProviderActions(cloud, server), ...adminOrderActions(cloud, server) }, ['admin', 'property']);
