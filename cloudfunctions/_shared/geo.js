const { ensure } = require('./validate');

const EARTH_RADIUS_KM = 6371.0088;
function coordinate(value, label, min, max) {
  ensure(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, label + '坐标无效');
  return value;
}
function validatePoint(point, label = '位置') {
  ensure(point && typeof point === 'object', label + '坐标无效');
  return { lat: coordinate(point.lat, label + '纬度', -90, 90), lng: coordinate(point.lng, label + '经度', -180, 180) };
}
function toGeoPoint(db, point) {
  const value = validatePoint(point);
  ensure(db && db.Geo && typeof db.Geo.Point === 'function', '数据库地理坐标类型不可用', 'E_CONFIG');
  return db.Geo.Point(value.lng, value.lat);
}
function distanceKm(a, b) {
  const from = validatePoint(a, '起点'); const to = validatePoint(b, '终点');
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(to.lat - from.lat); const dLng = radians(to.lng - from.lng);
  const lat1 = radians(from.lat); const lat2 = radians(to.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function nearby(communities, point, radiusKm = 3) {
  validatePoint(point);
  ensure(Number.isFinite(radiusKm) && radiusKm > 0 && radiusKm <= 50, '搜索范围无效');
  return (communities || []).filter(item => item && item.status === 'active' && item.location)
    .map(item => ({ ...item, distanceKm: distanceKm(point, item.location) }))
    .filter(item => item.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
}
module.exports = { validatePoint, toGeoPoint, distanceKm, nearby };
