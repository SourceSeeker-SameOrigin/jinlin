const { cleanEntry, cleanReport } = require('../vacant');
const { cleanDetail } = require('../orderData');

const order = { _id: 'o_v1' };
const photoByItem = Object.fromEntries(['windows','utilities','leakMold','ventilation','mail','photos']
  .map((key, i) => [key, [`cloud://env/vacant/o_v1/${key}-${i}.jpg`]]));

test('空置房入户方式校验并要求密码模式填写密钥', () => {
  expect(cleanEntry({ entry: 'key_handover' })).toEqual({ entry: 'key_handover', password: '' });
  expect(cleanEntry({ entry: 'password', entryPassword: '1234' })).toEqual({ entry: 'password', password: '1234' });
  expect(() => cleanEntry({ entry: 'password', entryPassword: '12' })).toThrow('至少 4 位');
});

test('巡检订单日期必须是有效的 YYYY-MM-DD，且只保存入户方式不保存密码', () => {
  const detail = { date: '2026-11-15', entry: 'password', checklist: [] };
  expect(cleanDetail('vacant', detail)).toMatchObject({ date: '2026-11-15', entry: 'password' });
  expect(() => cleanDetail('vacant', { ...detail, date: '2026-02-30' })).toThrow('巡检日期无效');
  expect(() => cleanDetail('vacant', { ...detail, date: '15-11-2026' })).toThrow('巡检日期格式不正确');
  expect(cleanDetail('vacant', detail)).not.toHaveProperty('entryPassword');
});

test('巡检报告须完成逐项检查、逐项照片、文字和关注开关', () => {
  const checklist = { windows: true, utilities: true, leakMold: true, ventilation: true, mail: true, photos: true };
  expect(cleanReport({ checklist, photoByItem, notes: '客厅窗锁松动', attention: true }, order)).toMatchObject({ checklist,
    notes: '客厅窗锁松动', attention: true });
  expect(() => cleanReport({ checklist, photoByItem: { ...photoByItem, windows: [] }, attention: false }, order))
    .toThrow('至少上传 1 张照片');
  expect(() => cleanReport({ checklist, photoByItem: { ...photoByItem, windows: ['cloud://env/vacant/other/x.jpg'] }, attention: false }, order))
    .toThrow('本次巡检照片');
  expect(() => cleanReport({ checklist: { ...checklist, mail: false }, photoByItem, attention: false }, order)).toThrow('未完成勾选');
});
