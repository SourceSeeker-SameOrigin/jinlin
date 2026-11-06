function display(value) {
  if (!value) return '';
  const date = new Date(new Date(value).getTime() + 8 * 3600000);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 16).replace('T', ' ');
}
function slotText(slot) { return slot ? slot.date + ' ' + slot.start + '—' + slot.end : '尽快上门'; }
module.exports = { display, slotText };
