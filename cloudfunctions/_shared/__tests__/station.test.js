const { parseAddressLines, deliveryItem, batchStatus, deliveredCount, billing, statement, statementCsv } = require('../station');

test('解析多行楼栋、单元和门牌，忽略空行并拒绝重复地址', () => {
  expect(parseAddressLines('1栋-1单元-302\n\n2栋-2单元-501')).toEqual([
    { buildingName: '1栋', unit: '1单元', room: '302' },
    { buildingName: '2栋', unit: '2单元', room: '501' }
  ]);
  expect(() => parseAddressLines('1栋-1单元-302\n1栋-1单元-302')).toThrow('重复');
  expect(() => parseAddressLines('1栋-302')).toThrow('楼栋-单元-门牌');
});

test('逐户送达需上传本批次照片；失败项记录原因', () => {
  const item = { status: 'pending' };
  const now = new Date('2026-11-07T01:00:00Z');
  expect(deliveryItem(item, { status: 'delivered', photoFileId: 'cloud://env/station/b1/photo.jpg' }, 'b1', now))
    .toEqual({ status: 'delivered', photoFileId: 'cloud://env/station/b1/photo.jpg', at: now });
  expect(() => deliveryItem(item, { status: 'delivered', photoFileId: 'cloud://env/station/b2/photo.jpg' }, 'b1', now))
    .toThrow('本批次');
  expect(deliveryItem(item, { status: 'failed', reason: '无人应答' }, 'b1', now))
    .toEqual({ status: 'failed', failReason: '无人应答', at: now });
});

test('只在所有门牌均已处理后结束批次，计费件数只统计送达项', () => {
  const items = [{ status: 'delivered' }, { status: 'failed' }, { status: 'pending' }];
  expect(batchStatus(items)).toBe('assigned');
  expect(deliveredCount(items)).toBe(1);
  expect(batchStatus(items.slice(0, 2))).toBe('done');
});

test('驿站按实际送达件数计费，默认驿站费用50分、服务员40分', () => {
  expect(billing(20)).toEqual({ gross: 1000, provider: 800, property: 0, platform: 200, goods: 0 });
  expect(billing(3, { perPiece: 60, perPiecePayout: 45 })).toEqual({
    gross: 180, provider: 135, property: 0, platform: 45, goods: 0
  });
  expect(() => billing(2, { perPiece: 40, perPiecePayout: 50 })).toThrow('服务员计件');
});

test('月度对账仅统计完成批次的实际送达件数并输出公式安全CSV', () => {
  const from = new Date('2026-11-01T00:00:00Z');
  const to = new Date('2026-12-01T00:00:00Z');
  const result = statement([{ _id: 'b1', stationCode: '=S1', providerId: 'p1', status: 'done',
    completedAt: new Date('2026-11-20T00:00:00Z'), priceSnapshot: {},
    items: [{ consented: true, status: 'delivered' }, { consented: true, status: 'failed' },
      { consented: false, status: 'delivered' }] },
  { _id: 'b2', status: 'assigned', completedAt: new Date('2026-11-21T00:00:00Z'), items: [] }], from, to);
  expect(result).toMatchObject({ gross: 50, provider: 40 });
  expect(result.rows).toHaveLength(1);
  expect(statementCsv(result)).toContain("'=S1");
});
