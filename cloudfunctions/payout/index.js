const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { createPayoutFlow } = require('./lib/shared/payoutFlow');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const payout = createPayoutFlow(cloud, server);

exports.main = server.entry({ create: payout.create, get: payout.get, list: payout.list }, ['resident']);
