const { ensure, record } = require('./validate');

const KEYS = Object.freeze(['board','idle','idleEscrow','events','chat','location','coupons','points','autoPayout',
  'elder','pet','stationDelivery','recycle','merchants','vacantHome','travelCarry','federation','ads','notices']);
const DEPENDENCIES = Object.freeze({ idleEscrow: ['idle'], travelCarry: ['board'], points: ['recycle'] });

function isEnabled(name, config, community) {
  ensure(KEYS.includes(name), '功能开关不存在', 'E_CONFIG');
  const local = community && community.features;
  if (local && Object.prototype.hasOwnProperty.call(local, name)) return local[name] === true;
  return Boolean(config && config.features && config.features[name] === true);
}

function validateFeatures(features, label = '功能开关') {
  record(features, label, 'E_CONFIG');
  for (const [name, value] of Object.entries(features)) {
    ensure(KEYS.includes(name) && typeof value === 'boolean', label + '配置不正确', 'E_INVALID_PARAM');
  }
  for (const [name, deps] of Object.entries(DEPENDENCIES)) if (features[name] === true) {
    for (const dep of deps) ensure(features[dep] === true, name + '依赖先开启 ' + dep, 'E_INVALID_PARAM');
  }
  if (features.federation === true) ensure(['board','idle','events'].some(key => features[key] === true),
    '联合社区需先开启需求广场、闲置或活动之一', 'E_INVALID_PARAM');
  return features;
}

function allOff() { return Object.fromEntries(KEYS.map(key => [key, false])); }
module.exports = { KEYS, DEPENDENCIES, isEnabled, validateFeatures, allOff };
