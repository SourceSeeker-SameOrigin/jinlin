function parse(options) {
  const raw = options && options.query && options.query.scene;
  if (typeof raw !== 'string' || !raw) return null;
  let value;
  try { value = decodeURIComponent(raw); } catch (_) { return null; }
  return /^[br]=[2-9A-HJ-NP-Z]{6}$/.test(value) ? value : null;
}

function remember(options) {
  const value = parse(options);
  if (value) wx.setStorageSync('scene', value);
  return value;
}

module.exports = { parse, remember };
