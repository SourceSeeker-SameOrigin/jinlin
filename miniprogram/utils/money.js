function yuan(fen) {
  if (!Number.isSafeInteger(fen)) return '--';
  const absolute = Math.abs(fen);
  return (fen < 0 ? '-' : '') + Math.floor(absolute / 100) + '.' + String(absolute % 100).padStart(2, '0');
}

function toFen(value) {
  const input = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ''] = input.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : null;
}

module.exports = { yuan, toFen };
