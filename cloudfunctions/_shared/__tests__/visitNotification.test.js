const { orderView } = require('../views');
const { createNotifier } = require('../notify');

const order = { _id: 'visit_1', orderNo: 'JL1', kind: 'service', serviceCode: 'visit', communityId: 'c1',
  userOpenid: 'resident', status: 'accepted', address: { buildingName: '1号楼', unit: '1单元', room: '101' },
  pricing: { payAmount: 0, goodsCap: 0 }, timeline: [], refunds: [], photos: [], detail: {}, note: '' };

test('探访报告通知授权只作为下单人可见字段返回', () => {
  const user = { openid: 'resident', roles: ['resident'] };
  const config = { phoneVisibleHoursAfterDone: 24 };
  expect(orderView({ ...order, visitReportNotifyAuthorizedAt: new Date() }, user, null, config, new Date()))
    .toMatchObject({ visitReportNotifyAuthorized: true });
  expect(orderView(order, user, null, config, new Date())).toMatchObject({ visitReportNotifyAuthorized: false });
  expect(() => orderView({ ...order, visitReportNotifyAuthorizedAt: new Date() }, { openid: 'other', roles: ['resident'] }, null, config, new Date()))
    .toThrow('无权查看');
});

test('未对该探访任务授权时不发送订阅报告通知', async () => {
  const server = { config: jest.fn() };
  const notify = createNotifier({}, server);
  await expect(notify.visitReport(order)).resolves.toEqual({ skipped: true });
  expect(server.config).not.toHaveBeenCalled();
});
