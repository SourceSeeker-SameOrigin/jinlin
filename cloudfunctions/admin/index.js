const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { adminProviderActions } = require('./lib/shared/adminProviders');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
exports.main = server.entry({ ...adminProviderActions(cloud, server) }, ['admin', 'property']);
