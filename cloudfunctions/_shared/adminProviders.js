const { ensure, integer, text } = require('./validate');
const { requireRole } = require('./auth');
const { providerView } = require('./providerData');
const { parseDate, addDays } = require('./time');

function adminProviderActions(cloud, server) {
  const { db } = server;
  async function cleanup(provider) {
    if (!provider.kycFileIds || !provider.kycFileIds.length) return;
    const result = await cloud.deleteFile({ fileList: provider.kycFileIds });
    ensure(result.fileList && result.fileList.length === provider.kycFileIds.length &&
      result.fileList.every(item => item.status === 0), '审核已保存，证件照片清理失败，请点击重试清理', 'E_STORAGE');
    await db.collection('providers').doc(provider._id).update({ data: { kycFileIds: [], updatedAt: new Date() } });
  }
  async function getProvider(event, user) {
    requireRole(user, ['admin']);
    text(event.providerId, '服务员');
    const provider = await server.get('providers', event.providerId);
    ensure(provider, '服务员不存在');
    return provider;
  }
  async function listProviders(event, { user }) {
    requireRole(user, ['admin']);
    const filter = {};
    if (event.status) {
      ensure(['pending', 'approved', 'rejected', 'suspended'].includes(event.status), '审核状态不正确');
      filter.status = event.status;
    }
    if (event.communityId) filter.communityId = text(event.communityId, '小区');
    const offset = integer(event.offset === undefined ? 0 : event.offset, '分页位置', 0, 100000);
    const result = await db.collection('providers').where(filter).orderBy('createdAt', 'desc').skip(offset).limit(20).get();
    return { list: result.data.map(provider => providerView(provider, true)), hasMore: result.data.length === 20 };
  }
  async function reviewProvider(event, { user }) {
    const provider = await getProvider(event, user);
    ensure(typeof event.approved === 'boolean', '请选择通过或拒绝');
    const status = event.approved ? 'approved' : 'rejected';
    if (provider.status === status && provider.kycFileIds.length) {
      await cleanup(provider);
      return { providerId: provider._id, status };
    }
    ensure(provider.status === 'pending', '该申请已处理，请刷新', 'E_CONFLICT');
    if (event.approved) integer(event.level, '审核等级', 1, 2);
    const certs = event.certs === undefined ? provider.certs || [] : event.certs;
    ensure(Array.isArray(certs) && certs.every(cert => ['escort','pet'].includes(cert)), '服务员证书列表不正确');
    const note = event.note === undefined ? '' : event.note;
    ensure(typeof note === 'string' && [...note].length <= 200, '审核备注不能超过 200 字');
    const patch = { status, level: event.approved ? event.level : provider.level, certs, onDuty: false,
      reviewNote: note, updatedAt: new Date() };
    const result = await db.collection('providers').where({ _id: provider._id, status: 'pending' }).update({ data: patch });
    ensure(result.stats.updated === 1, '该申请已处理，请刷新', 'E_CONFLICT');
    await cleanup({ ...provider, ...patch });
    return { providerId: provider._id, status };
  }
  async function cleanupProviderKyc(event, { user }) {
    const provider = await getProvider(event, user);
    ensure(provider.status !== 'pending', '待审核材料不能提前删除', 'E_BAD_STATE');
    await cleanup(provider);
    return { cleaned: true };
  }
  async function suspendProvider(event, { user }) {
    const provider = await getProvider(event, user);
    ensure(provider.status === 'approved', '只能停用已通过审核的服务员', 'E_BAD_STATE');
    const result = await db.collection('providers').where({ _id: provider._id, status: 'approved' })
      .update({ data: { status: 'suspended', onDuty: false, dutySince: null, updatedAt: new Date() } });
    ensure(result.stats.updated === 1, '服务员状态已变化，请刷新', 'E_CONFLICT');
    return { status: 'suspended' };
  }
  async function setInsurance(event, { user }) {
    const provider = await getProvider(event, user);
    const until = new Date(addDays(parseDate(event.until), 1).getTime() - 1);
    await db.collection('providers').doc(provider._id).update({ data: { insuranceUntil: until,
      ...(until <= new Date() ? { onDuty: false, dutySince: null } : {}), updatedAt: new Date() } });
    return { insuranceUntil: until };
  }
  async function setCerts(event, { user }) {
    const provider = await getProvider(event, user);
    ensure(provider.status === 'approved', '仅可配置已通过审核的服务员证书', 'E_BAD_STATE');
    const certs = event.certs;
    ensure(Array.isArray(certs) && certs.every(cert => ['escort', 'pet'].includes(cert)), '服务员证书列表不正确');
    const nextCerts = [...new Set(certs)];
    const result = await db.collection('providers').where({ _id: provider._id, status: 'approved' })
      .update({ data: { certs: nextCerts, updatedAt: new Date() } });
    ensure(result.stats.updated === 1, '服务员状态已变化，请刷新', 'E_CONFLICT');
    return { providerId: provider._id, certs: nextCerts };
  }
  return { listProviders, reviewProvider, suspendProvider, setInsurance, setCerts, cleanupProviderKyc };
}
module.exports = { adminProviderActions };
