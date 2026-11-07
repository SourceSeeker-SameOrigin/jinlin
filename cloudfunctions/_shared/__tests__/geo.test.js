const { validatePoint, toGeoPoint, distanceKm, nearby } = require('../geo');

test('haversine 距离在赤道每经度约 111 公里，且同点为零', () => {
  expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.195, 1);
  expect(distanceKm({ lat: 31.2, lng: 121.5 }, { lat: 31.2, lng: 121.5 })).toBe(0);
});
test('校验坐标并筛选 3 公里内合作小区，按距离排序', () => {
  expect(nearby([
    { _id: 'far', status: 'active', location: { lat: 0, lng: 0.1 } },
    { _id: 'near', status: 'active', location: { lat: 0, lng: 0.01 } },
    { _id: 'paused', status: 'paused', location: { lat: 0, lng: 0.001 } },
    { _id: 'unset', status: 'active' }
  ], { lat: 0, lng: 0 }).map(item => item._id)).toEqual(['near']);
  expect(() => validatePoint({ lat: 91, lng: 0 })).toThrow('纬度');
  expect(() => validatePoint({ lat: 0, lng: NaN })).toThrow('经度');
});
test('GeoPoint 按经度、纬度传值且不改变 API 坐标结构', () => {
  expect(toGeoPoint({ Geo: { Point: (lng, lat) => ({ lng, lat }) } }, { lat: 31.2, lng: 121.5 }))
    .toEqual({ lng: 121.5, lat: 31.2 });
});
