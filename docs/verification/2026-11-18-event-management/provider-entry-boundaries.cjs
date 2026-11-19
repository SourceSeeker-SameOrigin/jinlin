// Actual pages with synthetic identities and intercepted API calls only.
const { runtime } = require('../2026-11-09-remediation/page-fixture.cjs');
const assert = require('assert');
const results = [];
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const status = id => ({ provider: { _id: id, status: 'approved', onDuty: true }, todayCount: 1, todayIncome: 100 });
const task = id => ({ _id: id, pricing: { payAmount: 100, goodsCap: 0 }, slot: {}, createdAt: Date.now() });
function fixture(route) {
  let handler = async (n, a) => a === 'myStatus' ? status('provider-a') : { list: [task('task-a')], hasMore: false };
  const env = runtime((...args) => handler(...args));
  env.app.globalData.user = { _id: 'provider-a', roles: ['provider'] };
  const page = env.instance('miniprogram/provider/' + route + '/' + route + '.js');
  page.visible = true;
  return { env, page, use: fn => { handler = fn; } };
}
async function test(name, body) {
  let evidence;
  try { await body(value => { evidence = value; }); results.push({ name, pass: true, evidence }); }
  catch (error) { results.push({ name, pass: false, evidence, error: error.message }); }
}
(async () => {
  await test('workbench-normal-load', async record => {
    const f = fixture('workbench'); await f.page.load();
    record({ provider: f.page.data.provider._id, tasks: f.page.data.tasks.length });
    assert.equal(f.page.data.tasks.length, 1); assert.equal(f.page.data.loading, false);
  });
  await test('workbench-rejected-refresh-clears-previous-data', async record => {
    const f = fixture('workbench'); await f.page.load();
    f.use(async () => { throw Error('synthetic forbidden'); }); await f.page.load();
    record({ provider: f.page.data.provider?._id, tasks: f.page.data.tasks.length, error: f.page.data.error });
    assert.equal(f.page.data.provider, null); assert.equal(f.page.data.tasks.length, 0);
  });
  await test('workbench-latest-response-wins', async record => {
    const f = fixture('workbench'), wait = deferred(); let reads = 0;
    f.use(async (n, a) => a === 'myStatus' ? (++reads === 1 ? wait.promise : status('new-provider')) : { list: [], hasMore: false });
    const old = f.page.load(); await flush(); await f.page.load(); wait.resolve(status('old-provider')); await old;
    record({ provider: f.page.data.provider?._id }); assert.equal(f.page.data.provider._id, 'new-provider');
  });
  for (const leave of ['onHide', 'onUnload']) await test('workbench-late-read-' + leave, async record => {
    const f = fixture('workbench'), wait = deferred(); f.use(async () => wait.promise);
    const op = f.page.load(); await flush(); f.page[leave]?.();
    let updates = 0; const set = f.page.setData; f.page.setData = function(p) { updates++; set.call(this, p); };
    wait.resolve({ ...status('provider-a'), list: [], hasMore: false }); await op;
    record({ updates }); assert.equal(updates, 0);
  });
  for (const boundary of ['same-page', 'changed-user', 'hidden']) await test('workbench-duty-' + boundary, async record => {
    const f = fixture('workbench'); await f.page.load();
    if (boundary === 'changed-user') f.env.app.globalData.user = { _id: 'provider-b', roles: ['provider'] };
    if (boundary === 'hidden') { f.page.onHide?.(); f.page.visible = false; }
    await f.page.duty({ detail: { value: false } });
    const writes = f.env.requests.filter(r => r[1] === 'setDuty').length;
    record({ writes, currentUser: f.env.app.globalData.user._id }); assert.equal(writes, boundary === 'same-page' ? 1 : 0);
  });
  for (const boundary of ['same-page', 'changed-user', 'hidden', 'read-failed']) await test('hall-accept-' + boundary, async record => {
    const f = fixture('hall'); await f.page.load(true);
    if (boundary === 'changed-user') f.env.app.globalData.user = { _id: 'provider-b', roles: ['provider'] };
    if (boundary === 'hidden') f.page.onHide();
    if (boundary === 'read-failed') { f.use(async () => { throw Error('synthetic forbidden'); }); await f.page.load(true); }
    f.use(async (n, a, d) => a === 'accept' ? { orderId: d.orderId } : {});
    await f.page.accept({ currentTarget: { dataset: { id: 'task-a' } } }); await flush();
    const writes = f.env.requests.filter(r => r[1] === 'accept').length;
    record({ writes, navigation: f.env.navigation.length }); assert.equal(writes, boundary === 'same-page' ? 1 : 0);
  });
  console.log(JSON.stringify({ scope: 'actual pages; synthetic identities and intercepted writes; no live duty or acceptance', pass: results.filter(x => x.pass).length, fail: results.filter(x => !x.pass).length, results }, null, 2));
  if (results.some(x => !x.pass)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
