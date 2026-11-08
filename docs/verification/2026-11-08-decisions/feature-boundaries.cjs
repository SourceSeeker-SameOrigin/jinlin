// Executes actual cloud entries against read-only synthetic records. No network or cloud writes.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = process.cwd();
function fixture({ bound = true, global = false, local = false, roles = ['resident'], records = {} } = {}) {
  const user = { _id: 'u', openid: 'actor', roles, communityId: bound ? 'c' : null };
  const data = { users: [user], config: [{ _id: 'global', features: Object.fromEntries(['board','idle','events','chat','coupons','merchants','stationDelivery','autoPayout','notices'].map(k=>[k, global])) }],
    communities: [{ _id: 'c', status: 'active', features: local === null ? {} : Object.fromEntries(['board','idle','events','chat','coupons','merchants','stationDelivery','autoPayout','notices'].map(k=>[k, local])) }], ...records };
  const op = (name, value) => ({ op: name, value });
  const command = new Proxy({}, { get: (_, name) => value => op(name, value) });
  function matches(row, filter) { return Object.entries(filter).every(([key, value]) => {
    if (value && value.op === 'in') return Array.isArray(row[key]) ? row[key].some(x=>value.value.includes(x)) : value.value.includes(row[key]);
    if (value && value.op === 'neq') return row[key] !== value.value;
    if (value && value.op) throw Error('Unsupported read predicate ' + value.op);
    return row[key] === value;
  }); }
  const db = { command, collection(table) { let filter = {}, limit = 100;
    const chain = { where(value) { filter = value; return chain; }, limit(value) { limit = value; return chain; },
      orderBy() { return chain; }, skip() { return chain; }, async get() { return { data: (data[table] || []).filter(row=>matches(row, filter)).slice(0, limit) }; },
      add() { throw Error('Unexpected write'); }, update() { throw Error('Unexpected write'); } }; return chain;
  }};
  const cloud = { init() {}, database:()=>db, getWXContext:()=>({OPENID:'actor'}), DYNAMIC_CURRENT_ENV:'offline',
    getTempFileURL() { throw Error('Unexpected signing'); } };
  function load(file, cache = new Map()) {
    file = path.resolve(file); if (!path.extname(file)) file += '.js';
    if (cache.has(file)) return cache.get(file).exports;
    const module = {exports:{}}; cache.set(file,module);
    const requireLocal = name => { if (name === 'wx-server-sdk') return cloud; if (['crypto','node:crypto'].includes(name)) return require('crypto');
      if (name === 'https') return {request(){throw Error('Unexpected network');}};
      if (!name.startsWith('.')) throw Error('Unknown dependency '+name); return load(path.resolve(path.dirname(file),name),cache); };
    vm.runInNewContext('(function(require,module,exports){'+fs.readFileSync(file,'utf8')+'\n})', { Date, JSON, Set, Map, Promise, Buffer, process:{env:{}}, console:{error(){}} }, {filename:file})(requireLocal,module,module.exports);
    return module.exports;
  }
  return { call: (name, action, input={})=>load('cloudfunctions/'+name+'/index.js').main({...input,action}) };
}
(async()=>{
 const results=[];
 async function check(label, f) { try { await f();results.push({label,status:'PASS'}); } catch(e) { results.push({label,status:'FAIL',message:e.message}); } }
 const entries=[['board','list'],['idle','list'],['chat','list'],['coupon','center'],['coupon','mine'],['merchant','myApplication'],['merchant','listForCommunity'],['content','listNotices'],['station','myApplication'],['station','applicationOptions'],['event','list'],['payout','list']];
 for(const [name,action]of entries) for(const bound of [false,true]) await check(`${name}.${action} off bound=${bound}`,async()=>{const result=await fixture({bound}).call(name,action,bound?{communityId:'c'}:{});assert.equal(result.code,'E_FEATURE_OFF',JSON.stringify(result));});
 for(const [name,action]of entries) await check(`${name}.${action} global on but unbound prompts binding`,async()=>{const result=await fixture({bound:false,global:true}).call(name,action);assert.equal(result.code,'E_INVALID_PARAM',JSON.stringify(result));assert.match(result.message,/绑定/);});
 await check('global on/local off uses local override',async()=>assert.equal((await fixture({global:true,local:false}).call('coupon','center')).code,'E_FEATURE_OFF'));
 await check('global off/local on allows read',async()=>assert.equal((await fixture({global:false,local:true}).call('coupon','center')).ok,true));
 for(const [name,action,records,input]of [
  ['board','detail',{posts:[{_id:'p',communityId:'other'}]},{postId:'p'}],
  ['idle','detail',{idleItems:[{_id:'i',communityId:'other'}]},{itemId:'i'}],
  ['event','detail',{events:[{_id:'e',communityIds:['other']}]},{eventId:'e'}],
  ['payout','get',{payouts:[{_id:'p',openid:'other',communityId:'c'}]},{payoutId:'p'}]
 ]) await check(`${name}.${action} unrelated record returns forbidden before off`,async()=>{const result=await fixture({records}).call(name,action,input);assert.equal(result.code,'E_FORBIDDEN',JSON.stringify(result));});
 for(const [name,action,input]of [['coupon','adminTemplates',{}],['merchant','adminList',{}],['station','listApplications',{}],['content','listAds',{}],['content','listNotices',{communityId:'c'}],['event','adminList',{communityId:'c'}]]) {
  await check(`${name}.${action} authorized admin prepares while off`,async()=>{const result=await fixture({roles:['resident','admin']}).call(name,action,input);assert.equal(result.ok,true,JSON.stringify(result));});
  if(action!=='listNotices')await check(`${name}.${action} ordinary user has no preparation exemption`,async()=>{const result=await fixture().call(name,action,input);assert.equal(result.code,'E_FORBIDDEN',JSON.stringify(result));});
 }
 await check('home aggregation remains successful empty while off',async()=>{const result=await fixture().call('content','homeContent',{communityId:'c'});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.data.ads.length,0);});
 for(const [name,action,records,input]of [
 ['board','detail',{posts:[{_id:'p',communityId:'c',moderationHidden:true,authorOpenid:'other'}]},{postId:'p'}],
 ['idle','detail',{idleItems:[{_id:'i',communityId:'c',moderationHidden:true,sellerOpenid:'other'}]},{itemId:'i'}]
 ]) await check(`${name} hidden record is forbidden before feature lookup`,async()=>{assert.equal((await fixture({records}).call(name,action,input)).code,'E_FORBIDDEN');});
 const report={scope:'real entry code with read-only synthetic database; no cloud/identity changes',total:results.length,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,results};
 fs.writeFileSync('docs/verification/2026-11-08-decisions/feature-boundaries.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;
})();
