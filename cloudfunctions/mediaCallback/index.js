const cloud = require('wx-server-sdk');
const { AppError, wrap } = require('./lib/shared/errors');
const { mediaStatus } = require('./lib/shared/ugc');
const { atomic, read } = require('./lib/shared/transaction');
const { ensure } = require('./lib/shared/validate');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const TARGETS = { post: 'posts', idle: 'idleItems', event: 'events', message: 'messages', merchant: 'merchants' };

exports.main = wrap(async event => {
  const context = cloud.getWXContext();
  if (context.OPENID || !event || typeof event !== 'object') throw new AppError('E_FORBIDDEN', '仅允许平台内容安全回调');
  const traceId = event.trace_id || event.traceId || event.traceid;
  const suggest = event.result && event.result.suggest || event.suggest;
  if (typeof traceId !== 'string' || !['pass','risky','review'].includes(suggest)) return { accepted: false };
  const job = await db.collection('mediaChecks').doc(traceId).get().then(result => result.data).catch(() => null);
  if (!job) return { accepted: false };
  const status = mediaStatus(suggest);
  const jobStatus = suggest === 'review' ? 'review' : status;
  const claimed = await atomic(db, async transaction => {
    const current = await read(transaction, 'mediaChecks', traceId);
    if (!current || current.status !== 'pending') return false;
    await transaction.collection('mediaChecks').doc(traceId).update({ data: { status: 'processing', result: suggest,
      updatedAt: new Date() } });
    return true;
  });
  if (!claimed) return { accepted: true, status: job.status };
  if (status === 'blocked') {
    try {
      const deletion = await cloud.deleteFile({ fileList: [job.fileId] });
      ensure(deletion.fileList && deletion.fileList.length === 1 && deletion.fileList[0].status === 0,
        '违规图片删除失败，等待回调重试', 'E_STORAGE');
    } catch (error) {
      await db.collection('mediaChecks').doc(traceId).update({ data: { status: 'pending', updatedAt: new Date() } });
      throw error;
    }
  }
  const collection = TARGETS[job.targetType];
  ensure(collection, '审核对象不正确', 'E_CONFIG');
  await atomic(db, async transaction => {
    const currentJob = await read(transaction, 'mediaChecks', traceId);
    if (!currentJob || currentJob.status !== 'processing') return;
    const target = await read(transaction, collection, job.targetId);
    if (target) {
      const pending = (target.moderationPendingFileIds || []).filter(fileId => fileId !== job.fileId);
      const approved = status === 'ok' ? [...new Set([...(target.moderationApprovedFileIds || []), job.fileId])] : target.moderationApprovedFileIds || [];
      const images = Array.isArray(target.images) ? target.images.filter(image =>
        status !== 'blocked' || (typeof image === 'string' ? image : image.fileId) !== job.fileId) : target.images;
      await transaction.collection(collection).doc(target._id).update({ data: { moderationPendingFileIds: pending,
        moderationApprovedFileIds: approved, ...(images ? { images } : {}),
        ...(job.targetType === 'message' ? { status } : {}) } });
    }
    await transaction.collection('mediaChecks').doc(traceId).update({ data: { status: jobStatus, updatedAt: new Date() } });
  });
  if (status === 'blocked') {
    const userResult = await db.collection('users').where({ openid: job.authorOpenid }).limit(1).get();
    const author = userResult.data[0];
    if (author) {
      const notices = [...(author.moderationNotices || []), { type: 'media_rejected', message: '你上传的图片未通过审核，已移除',
        createdAt: new Date() }].slice(-10);
      await db.collection('users').doc(author._id).update({ data: { moderationNotices: notices } });
    }
  }
  return { accepted: true, status };
});
