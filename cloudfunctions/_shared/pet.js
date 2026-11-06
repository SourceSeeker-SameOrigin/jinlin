const { ensure, integer, record, text } = require('./validate');
const { parseDate, ymd } = require('./time');

function clean(detail, community, now = new Date()) {
  record(detail, '喂宠订单详情');
  ensure(Array.isArray(detail.dates) && detail.dates.length >= 1 && detail.dates.length <= 15, '请选择 1 至 15 个服务日期');
  const dates = [...new Set(detail.dates)];
  ensure(dates.length === detail.dates.length, '服务日期不能重复');
  dates.forEach(date => ensure(parseDate(date) > parseDate(ymd(now)), '上门日期必须从明天开始'));
  dates.sort();
  ensure(detail.visitsPerDay === 1 || detail.visitsPerDay === 2, '每天上门次数只能选 1 次或 2 次');
  ensure(Array.isArray(detail.pets) && detail.pets.length >= 1 && detail.pets.length <= 5, '请填写 1 至 5 种宠物');
  const pets = detail.pets.map(pet => {
    record(pet, '宠物信息'); ensure(['cat','dog','other'].includes(pet.kind), '宠物类型不正确');
    const note = pet.note === undefined ? '' : pet.note;
    ensure(typeof note === 'string' && [...note].length <= 100, '宠物说明不能超过 100 字');
    return { kind: pet.kind, count: integer(pet.count, '宠物数量', 1, 10), note: note.trim() };
  });
  const kinds = pets.map(pet => pet.kind); ensure(new Set(kinds).size === kinds.length, '宠物类型不能重复填写');
  ensure(Array.isArray(detail.tasks) && detail.tasks.length >= 1 && detail.tasks.length <= 5, '请选择服务事项');
  const allowed = ['feed','water','litter','walk','play'];
  const tasks = [...new Set(detail.tasks)];
  ensure(tasks.length === detail.tasks.length && tasks.every(task => allowed.includes(task)), '服务事项不正确');
  ensure(!tasks.includes('walk') || pets.some(pet => pet.kind === 'dog'), '只有养狗的订单可以选择遛狗');
  ensure(['password','key_handover','property_keybox'].includes(detail.entry), '入户方式不正确');
  const entryPassword = detail.entry === 'password' ? text(detail.entryPassword, '门锁密码', 100).trim() : '';
  if (detail.entry === 'password') ensure(entryPassword.length > 0, '请填写门锁密码');
  if (detail.entry !== 'password') ensure(!detail.entryPassword, '当前入户方式不应填写门锁密码');
  return { detail: { dates, visitsPerDay: detail.visitsPerDay, pets, tasks, entry: detail.entry }, entryPassword };
}

function quote(detail, community, now = new Date()) {
  const cleaned = clean(detail, community, now);
  const config = community.prices.pet || {};
  const catPrice = integer(config.perVisitCat === undefined ? 4000 : config.perVisitCat, '猫每次上门价', 1);
  const dogPrice = integer(config.perVisitDog === undefined ? 5000 : config.perVisitDog, '狗每次上门价', 1);
  const holidays = new Set(Array.isArray(config.holidayDates) ? config.holidayDates : []);
  const surcharge = config.holidaySurcharge === undefined ? 5000 : integer(config.holidaySurcharge, '节假日加价比例', 0, 10000);
  const perVisit = [];
  for (const date of cleaned.detail.dates) for (let seq = 1; seq <= cleaned.detail.visitsPerDay; seq++) {
    const base = cleaned.detail.pets.reduce((sum, pet) => sum + (pet.kind === 'cat' ? catPrice : pet.kind === 'dog' ? dogPrice : 0) * pet.count, 0);
    // SPEC 只定义猫/狗单价，other 的护理不擅自定价，须由管理员配置。
    if (cleaned.detail.pets.some(pet => pet.kind === 'other')) ensure(Number.isSafeInteger(config.perVisitOther) && config.perVisitOther > 0, '尚未配置其他宠物每次上门价', 'E_CONFIG');
    const otherPrice = cleaned.detail.pets.filter(pet => pet.kind === 'other').reduce((sum, pet) => sum + config.perVisitOther * pet.count, 0);
    const subtotal = base + otherPrice;
    const amount = holidays.has(date) ? Math.floor(subtotal * (10000 + surcharge) / 10000) : subtotal;
    perVisit.push({ date, seq, amount });
  }
  const listPrice = perVisit.reduce((sum, item) => sum + item.amount, 0);
  ensure(Number.isSafeInteger(listPrice), '订单金额超出范围');
  return { perVisit, listPrice, discount: 0, payAmount: listPrice, goodsCap: 0, freeByMembership: false,
    reason: '按上门次数和节假日计价' };
}
module.exports = { clean, quote };
