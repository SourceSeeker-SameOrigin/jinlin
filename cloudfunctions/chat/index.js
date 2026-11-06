const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { createChatFlow } = require('./lib/shared/chatFlow');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const server = createServer(cloud);
const chat = createChatFlow(cloud, server);

async function open(event, context) { return chat.openOrder(event, context); }

exports.main = server.entry({ open, pull: chat.pull, send: chat.send, list: chat.list,
  markRead: chat.markRead, adminPull: chat.adminPull }, ['resident', 'admin', 'property']);
