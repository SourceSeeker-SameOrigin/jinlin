const { KEYS, isEnabled, validateFeatures, allOff } = require('../features');
const { dueTasks, daysInMonth, monthDates } = require('../schedule');
const { report, reportOutcome, mediaStatus, localUgc, checkText, ensureCanPublish, visibleImages } = require('../ugc');

test('扩展开关默认全部关闭，小区可覆盖全局', () => {
  const config = { features: { board: true } };
  expect(KEYS.every(key => allOff()[key] === false)).toBe(true);
  expect(isEnabled('board', config, null)).toBe(true);
  expect(isEnabled('board', config, { features: { board: false } })).toBe(false);
  expect(isEnabled('idle', config, null)).toBe(false);
});

test('功能依赖开启前校验，federation 至少依赖一个内容模块', () => {
  expect(() => validateFeatures({ idleEscrow: true, idle: false })).toThrow('依赖');
  expect(() => validateFeatures({ federation: true })).toThrow('需先开启');
  expect(validateFeatures({ idle: true, idleEscrow: true }).idleEscrow).toBe(true);
  expect(() => validateFeatures({ chat: 'yes' })).toThrow();
});

test('daily/weekly 排期、确定性任务 ID 和 skipDates', () => {
  const card = { _id: 'c1', slot: 'evening', skipDates: [] };
  expect(dueTasks(card, { schedule: { type: 'daily' } }, '2026-11-06')[0]._id).toBe('m_c1_20261106_evening');
  expect(dueTasks(card, { schedule: { type: 'weekly', weekdays: [1, 5] } }, '2026-11-06')).toHaveLength(1);
  expect(dueTasks(card, { schedule: { type: 'weekly', weekdays: [1] } }, '2026-11-06')).toHaveLength(0);
  expect(dueTasks({ ...card, skipDates: ['2026-11-06'] }, { schedule: { type: 'daily' } }, '2026-11-06')).toEqual([]);
});

test('monthly 排期忽略不存在的月末日期，覆盖闰年二月和跨月', () => {
  expect(daysInMonth(2024, 1)).toBe(29);
  expect(monthDates(2024, 1, [1, 15, 29, 30])).toEqual(['2024-02-01','2024-02-15','2024-02-29']);
  expect(monthDates(2025, 1, [1, 15, 29, 30])).toEqual(['2025-02-01','2025-02-15']);
  expect(monthDates(2026, 11, [1, 15])).toEqual(['2026-12-01','2026-12-15']);
});

test('举报按不同举报人计数，三人后隐藏；图片审核状态明确', () => {
  const first = report('post', 'p1', 'u1', '违规', '危险内容', new Date(0));
  expect(reportOutcome([first, { ...first, reporterOpenid: 'u1' }]).hide).toBe(false);
  expect(reportOutcome([first, { ...first, reporterOpenid: 'u2' }, { ...first, reporterOpenid: 'u3' }]).hide).toBe(true);
  expect(mediaStatus('risky')).toBe('blocked'); expect(mediaStatus('review')).toBe('pending');
  expect(() => localUgc('香 烟', ['香烟'])).toThrow();
});

test('UGC 文本先过本地黑名单，再按类型调用微信安全接口', async () => {
  const cloud = { openapi: { security: { msgSecCheck: jest.fn(async () => ({ result: { suggest: 'pass' } })) } } };
  await expect(checkText(cloud, '帮忙搬箱子', { blacklist: [], type: 'post', openid: 'u1' })).resolves.toBe('帮忙搬箱子');
  expect(cloud.openapi.security.msgSecCheck).toHaveBeenCalledWith({ content: '帮忙搬箱子', version: 2, scene: 3, openid: 'u1' });
  await expect(checkText(cloud, '香烟', { blacklist: ['香烟'], type: 'post', openid: 'u1' })).rejects.toThrow('不允许');
});

test('媒体审核前仅作者可见，禁言用户不能发布', () => {
  const target = { images: ['f1','f2'], moderationApprovedFileIds: ['f1'] };
  expect(visibleImages(target, 'owner', 'owner')).toEqual(['f1','f2']);
  expect(visibleImages(target, 'neighbor', 'owner')).toEqual(['f1']);
  expect(() => ensureCanPublish({ mutedUntil: new Date('2026-11-08') }, new Date('2026-11-07'))).toThrow('禁言中');
  expect(() => ensureCanPublish({ mutedUntil: new Date('2026-11-06') }, new Date('2026-11-07'))).not.toThrow();
});
