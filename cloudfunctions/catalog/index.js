const cloud = require('wx-server-sdk');
const { createServer } = require('./lib/shared/server');
const { parseScene } = require('./lib/shared/profile');
const { nextDutyWindow } = require('./lib/shared/time');
const { ensure, text, integer } = require('./lib/shared/validate');
const { publicTemplates } = require('./lib/shared/notificationData');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const server = createServer(cloud);
const { db, one, get } = server;

async function listCommunities(event) {
  const offset = event.offset === undefined ? 0 : integer(event.offset, '页码', 0, 10000);
  const result = await db.collection('communities').where({ status: 'active' }).orderBy('_id', 'asc').skip(offset).limit(100).get();
  return { list: result.data.map(({ _id, name, city, district, address }) => ({ _id, name, city, district, address })),
    hasMore: result.data.length === 100 };
}

async function getCommunity(event) {
  text(event.communityId, '小区');
  const community = await get('communities', event.communityId);
  ensure(community && community.status === 'active', '该小区暂不可用');
  const buildings = await server.all('buildings', { communityId: community._id });
  const duty = await db.collection('providers').where({ communityId: community._id, status: 'approved', onDuty: true,
    insuranceUntil: server.command.gt(new Date()) }).count();
  const config = await server.config();
  return { ...community, buildings, onDutyCount: duty.total,
    nextDutyWindow: nextDutyWindow(community.dutyWindows, new Date()), hotline: config.hotline, templateIds: publicTemplates(config) };
}

async function resolveScene(event) {
  const scene = parseScene(event.scene);
  ensure(scene, '二维码内容不正确');
  const target = scene.type === 'b' ? await one('buildings', { shortCode: scene.code })
    : await one('providers', { referralCode: scene.code, status: 'approved' });
  ensure(target, '二维码已失效');
  const community = await get('communities', target.communityId);
  ensure(community && community.status === 'active', '小区暂不可用');
  return { communityId: community._id, buildingId: scene.type === 'b' ? target._id : null };
}

async function templates() { return publicTemplates(await server.config()); }
exports.main = server.entry({ listCommunities, getCommunity, resolveScene, templates });
