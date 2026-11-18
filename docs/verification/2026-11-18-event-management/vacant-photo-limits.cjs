// Actual task page + production report validator; synthetic media only.
const { runtime } = require('../2026-11-09-remediation/page-fixture.cjs');
const { CHECKLIST, cleanReport } = require('../../../cloudfunctions/_shared/vacant');
const assert = require('assert');
const results = [];
async function check(name, fn) {
  try { results.push({ name, pass: true, observed: await fn() }); }
  catch (error) { results.push({ name, pass: false, error: error.message }); }
}
async function fixture(target) {
  const order = { _id: 'synthetic-vacant', serviceCode: 'vacant', status: 'in_service',
    featureEnabled: true, detail: {}, pricing: {}, slot: {} };
  const state = { uploads: 0, submitted: 0, accepted: 0 };
  const env = runtime(async (name, action, data) => {
    if (action === 'detail') return JSON.parse(JSON.stringify(order));
    if (action === 'recordReport') {
      state.submitted++;
      const report = cleanReport(data, order);
      state.accepted++;
      return report;
    }
    throw Error('Unexpected business operation');
  }, { media: { uploadPhotos: async folder => ['cloud://synthetic-env/' + folder + '/' + (++state.uploads) + '.jpg'] } });
  const page = env.instance('miniprogram/provider/task/task.js');
  page.onLoad({ id: order._id }); await page.onShow();
  for (const key of Object.keys(CHECKLIST)) {
    page.checklist({ currentTarget: { dataset: { key } }, detail: { value: ['done'] } });
    page.data.photoByItem[key] = key === target ? [] : ['cloud://synthetic-env/vacant/' + order._id + '/' + key + '/seed.jpg'];
  }
  return { page, env, order, state,
    upload: () => page.vacantPhoto({ currentTarget: { dataset: { key: target } } }) };
}
(async () => {
  for (const key of Object.keys(CHECKLIST)) for (const attempts of [1, 3, 4, 5]) {
    await check(key + '-attempts-' + attempts, async () => {
      const f = await fixture(key);
      for (let i = 0; i < attempts; i++) await f.upload();
      await f.page.submitVacantReport();
      const observed = { attempts, photos: f.page.data.photoByItem[key].length, ...f.state, error: f.page.data.error };
      assert.equal(observed.photos, Math.min(attempts, 3), JSON.stringify(observed));
      assert.equal(observed.accepted, 1, JSON.stringify(observed));
      return observed;
    });
  }
  console.log(JSON.stringify({ scope: 'Actual page and production validator, synthetic files; no cloud writes',
    pass: results.filter(x => x.pass).length, fail: results.filter(x => !x.pass).length, results }, null, 2));
  if (results.some(x => !x.pass)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
