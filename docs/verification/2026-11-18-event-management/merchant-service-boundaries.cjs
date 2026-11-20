// Actual page and cloud entry with synthetic identities, services and media only.
// No network, real uploads, service creation or approval.
const assert = require('assert');
const fs = require('fs');
const { runtime } = require('../2026-11-09-remediation/page-fixture.cjs');
const { fixture } = require('../2026-11-09-remediation/cloud-fixture.cjs');
const results = [];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const service = id => ({ _id: id, merchantId: 'merchant-a', title: '合成服务', desc: '仅供测试', priceType: 'fixed', price: 500, unit: '次', images: [], status: 'off' });
function setup() {
  let call = async (n, a) => a === 'myServices' ? { list: [service('service-a')] } : {};
  let upload = async () => ['cloud://synthetic/merchant-services/user-a/photo.jpg'];
  const env = runtime((...args) => call(...args), { media: { uploadPhotos: (...args) => upload(...args) } });
  env.app.globalData.user = { _id: 'user-a', roles: ['merchant'], merchantId: 'merchant-a' };
  const page = env.instance('miniprogram/merchant/services/services.js'); page.visible = true;
  return { env, page, use: fn => { call = fn; }, media: fn => { upload = fn; } };
}
function change(f, state) {
  if (state === 'hidden') f.page.onHide?.();
  if (state === 'unloaded') f.page.onUnload?.();
  if (state === 'user') f.env.app.globalData.user = { _id: 'user-b', roles: ['merchant'], merchantId: 'merchant-b' };
}
async function check(name, fn) {
  let evidence;
  try { await fn(v => { evidence = v; }); results.push({ name, pass: true, evidence }); }
  catch (error) { results.push({ name, pass: false, evidence, error: error.message }); }
}
(async () => {
  await check('normal-load', async record => {
    const f = setup(); await f.page.load(); record({ rows: f.page.data.list.length, ready: f.page.data.ready });
    assert.equal(f.page.data.list.length, 1); assert(f.page.data.ready);
  });
  await check('denied-reload-clears-old-services', async record => {
    const f = setup(); await f.page.load(); f.use(async () => { throw Object.assign(Error('合成无权读取'), { code: 'E_FORBIDDEN' }); });
    await f.page.load(); record({ rows: f.page.data.list.length, ready: f.page.data.ready }); assert.equal(f.page.data.list.length, 0);
  });
  for (const state of ['hidden', 'unloaded', 'user']) await check('late-read-' + state, async record => {
    const f = setup(), wait = deferred(); f.use(() => wait.promise); const op = f.page.load(); change(f, state);
    let updates = 0; const set = f.page.setData; f.page.setData = function(p) { updates++; set.call(this, p); };
    wait.resolve({ list: [service('old')] }); await op; record({ updates, rows: f.page.data.list.length }); assert.equal(updates, 0);
  });
  await check('return-refresh-not-blocked-by-old-read', async record => {
    const f = setup(), wait = deferred(); let calls = 0;
    f.use(() => ++calls === 1 ? wait.promise : { list: [service('new')] });
    const old = f.page.load(); change(f, 'hidden'); f.page.onShow(); await flush(); wait.resolve({ list: [service('old')] }); await old;
    record({ calls, id: f.page.data.list[0]?._id }); assert.equal(f.page.data.list[0]?._id, 'new');
  });
  for (const state of ['same-page', 'hidden', 'unloaded', 'user']) await check('save-entry-' + state, async record => {
    const f = setup(); await f.page.load(); f.page.setData({ title: '合成新服务', desc: '仅供测试', price: '5' }); change(f, state);
    await f.page.save(); const calls = f.env.requests.filter(r => r[1] === 'upsertService').length;
    record({ calls }); assert.equal(calls, state === 'same-page' ? 1 : 0);
  });
  for (const state of ['same-page', 'unloaded', 'user']) await check('upload-result-' + state, async record => {
    const f = setup(), wait = deferred(); await f.page.load(); f.media(() => wait.promise);
    const op = f.page.photos(); await flush(); change(f, state); wait.resolve(['cloud://synthetic/old-photo.jpg']); await op;
    record({ images: f.page.data.images.length }); assert.equal(f.page.data.images.length, state === 'same-page' ? 1 : 0);
  });
  await check('account-change-clears-old-draft', async record => {
    const f = setup(); await f.page.load(); f.page.setData({ title: 'A的合成草稿', desc: 'A的文字', images: ['cloud://synthetic/a.jpg'] });
    change(f, 'hidden'); change(f, 'user'); f.page.onShow(); await flush();
    record({ title: f.page.data.title, images: f.page.data.images.length }); assert.equal(f.page.data.title, ''); assert.equal(f.page.data.images.length, 0);
  });
  function database() {
    return fixture({ roles: ['resident', 'merchant'], global: true, local: true, records: {
      merchants: [{ _id: 'merchant-a', status: 'approved', staffOpenids: ['actor'], communityIds: ['c'] }],
      merchantServices: Array.from({ length: 101 }, (_, i) => ({ ...service('service-' + i), createdAt: new Date(Date.UTC(2026, 10, 19, 0, 0, 101 - i)) }))
    } });
  }
  await check('cloud-offset-reaches-101st-service', async record => {
    const db = database(); const first = await db.call('merchant', 'myServices', { offset: 0 }); const last = await db.call('merchant', 'myServices', { offset: 100 });
    assert(first.ok && last.ok); record({ counts: [first.data.list.length, last.data.list.length], firstIds: [first.data.list[0]?._id, last.data.list[0]?._id], writes: db.writes.length });
    assert(last.data.list.some(s => s._id === 'service-100')); assert.equal(db.writes.length, 0);
  });
  await check('page-reaches-101st-service', async record => {
    const db = database(), env = runtime(async (n,a,d) => { const r = await db.call(n,a,d); if (!r.ok) throw Error(r.message); return r.data; });
    const page = env.instance('miniprogram/merchant/services/services.js'); await page.load();
    const template = fs.readFileSync('miniprogram/merchant/services/services.wxml', 'utf8');
    const handler = /bindtap="([^"]+)"[^>]*>\s*加载更多/.exec(template)?.[1];
    if (handler && typeof page[handler] === 'function') for (let i=0; i<6 && !page.data.list.some(s=>s._id==='service-100'); i++) await page[handler]();
    record({ rows: page.data.list.length, paginationButton: !!handler, calls: env.requests.length, writes: db.writes.length });
    assert(page.data.list.some(s => s._id === 'service-100')); assert.equal(db.writes.length, 0);
  });
  await check('other-merchant-cannot-read-services', async record => {
    const db = database(); db.data.merchants[0].staffOpenids = ['other']; const r = await db.call('merchant','myServices',{});
    record({ ok: r.ok, code: r.code, writes: db.writes.length }); assert.equal(r.ok,false); assert.equal(db.writes.length,0);
  });
  console.log(JSON.stringify({ scope: 'synthetic interfaces and database; no real media or cloud writes; database order prearranged', pass: results.filter(r=>r.pass).length, fail: results.filter(r=>!r.pass).length, results },null,2));
  if (results.some(r=>!r.pass)) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
