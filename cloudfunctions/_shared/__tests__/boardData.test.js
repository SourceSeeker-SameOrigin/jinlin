const { newPost, validateCarry, validateTaskSlot } = require('../boardData');

const now = new Date('2026-11-07T00:00:00+08:00');
const user = { _id: 'u1', openid: 'wx1' };
const community = { _id: 'c1' };

test('求助帖默认仅本小区可见并在七天后过期', () => {
  const post = newPost({ id: 'p1', user, community, now, input: { type: 'ask', scope: 'community',
    title: '帮忙看看', content: '请问哪里能买到' } });
  expect(post).toMatchObject({ _id: 'p1', type: 'ask', scope: 'community', status: 'open',
    communityId: 'c1', authorOpenid: 'wx1', commentsCount: 0 });
  expect(post.expireAt.getTime() - now.getTime()).toBe(7 * 24 * 3600000);
});

test('境外帮带必须同意声明、不能悬赏并拦截配置禁止词', () => {
  const input = { direction: 'request', destination: '东京', destinationType: 'overseas',
    departAt: new Date('2026-12-01T00:00:00Z'), disclaimerAgreed: true };
  expect(validateCarry(input, now, ['代购']).destinationType).toBe('overseas');
  expect(() => validateCarry({ ...input, disclaimerAgreed: false }, now, [])).toThrow('确认合规声明');
  expect(() => validateCarry({ ...input, reward: 500 }, now, [])).toThrow('不能附带悬赏');
  expect(() => validateCarry({ ...input, destination: '代购商品到东京' }, now, ['代购'])).toThrow('禁止词');
  expect(() => validateCarry({ ...input, destination: '东京', title: '收费代带' }, now, ['代带'])).toThrow('禁止词');
  expect(() => validateCarry({ ...input, destination: '东京', content: '帮忙代购' }, now, ['代购'])).toThrow('禁止词');
});

test('境内帮带可列求助或提供，出发时间不能早于当前时间', () => {
  const carry = validateCarry({ direction: 'offer', destination: '天津', destinationType: 'domestic',
    departAt: new Date('2026-11-08T00:00:00Z'), returnAt: new Date('2026-11-08T10:00:00Z') }, now);
  expect(carry.direction).toBe('offer');
  expect(() => validateCarry({ ...carry, departAt: new Date('2026-11-06T00:00:00Z') }, now)).toThrow('未来时间');
  expect(() => validateCarry({ ...carry, departAt: new Date('2026-11-08T10:00:00Z'),
    returnAt: new Date('2026-11-08T09:00:00Z') }, now)).toThrow('返程时间');
});

test('悬赏帖必须选择未来且匹配小区值班配置的时段，最低 3 元', () => {
  const taskCommunity = { ...community, dutyWindows: [{ start: '07:00', end: '09:00' }, { start: '19:00', end: '21:00' }] };
  const slot = { date: '2026-11-08', start: '07:00', end: '09:00' };
  const post = newPost({ id: 'p1', user, community: taskCommunity, now, input: { type: 'task', scope: 'community',
    title: '悬赏', content: '帮忙搬纸箱', reward: 300, needEnterHome: false, slot, orderId: 'o1' } });
  expect(post).toMatchObject({ type: 'task', reward: 300, needEnterHome: false, slot, orderId: 'o1', status: 'open' });
  expect(() => newPost({ id: 'p2', user, community: taskCommunity, now, input: { type: 'task', scope: 'community',
    title: '悬赏', content: '帮忙搬纸箱', reward: 299, needEnterHome: false, slot, orderId: 'o2' } })).toThrow('有效范围');
  expect(() => validateTaskSlot({ ...slot, start: '10:00', end: '12:00' }, taskCommunity.dutyWindows, now)).toThrow('已配置');
  expect(() => validateTaskSlot({ ...slot, date: '2026-11-06' }, taskCommunity.dutyWindows, now)).toThrow('未来');
});

test('悬赏时段支持跨午夜并按开始日期验证', () => {
  const slot = { date: '2026-11-08', start: '23:00', end: '01:00' };
  expect(validateTaskSlot(slot, [{ start: '23:00', end: '01:00' }], now)).toEqual(slot);
  expect(() => validateTaskSlot({ ...slot, date: '2026-11-06' }, [{ start: '23:00', end: '01:00' }], now)).toThrow('未来');
});

test('悬赏图片数量最多三张', () => {
  expect(() => newPost({ id: 'p1', user, community, now, input: { type: 'ask', scope: 'community',
    title: '求助', content: '需要帮忙', images: ['1', '2', '3', '4'] } })).toThrow('3 张');
});
