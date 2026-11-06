let active = null;
let pending = null;

function install() {
  if (!wx.onNeedPrivacyAuthorization) return;
  wx.onNeedPrivacyAuthorization(resolve => {
    if (pending) pending({ event: 'disagree' });
    pending = resolve;
    if (active) active(true);
    else respond(false);
  });
}

function attach(listener) { active = listener; }
function detach(listener) { if (active === listener) { respond(false); active = null; } }
function respond(agree) {
  const resolve = pending;
  pending = null;
  if (active) active(false);
  if (resolve) resolve({ event: agree ? 'agree' : 'disagree', buttonId: 'privacy-agree' });
}
function authorize() {
  return new Promise((resolve, reject) => {
    if (!wx.requirePrivacyAuthorize) { resolve(); return; }
    wx.requirePrivacyAuthorize({ success: resolve, fail: () => reject(new Error('请先同意隐私保护指引')) });
  });
}

module.exports = { install, attach, detach, respond, authorize };
