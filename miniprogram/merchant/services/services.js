const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const { yuan } = require('../../utils/money');
const emptyDraft = () => ({ title: '', desc: '', priceTypeIndex: 0, price: '', unit: '次', images: [] });
Page({
  data: { ready: false, loadError: false, loading: true, busy: false, error: '', pageError: false,
    list: [], hasMore: false, types: ['固定价', '预约后报价'], ...emptyDraft() },
  onShow() { this.visible = true; return this.load({ preserveMedia: true }); },
  clearContext() {
    this.read = (this.read || 0) + 1;
    this.context = null;
    this.setData({ ready: false, loading: false, list: [], hasMore: false, busy: !!this.operation });
  },
  onHide() {
    this.visible = false;
    if (this.operation?.stage !== 'media') this.operation = null;
    this.clearContext();
  },
  onUnload() { this.operation = null; this.onHide(); },
  current(context) {
    const user = getApp().globalData.user;
    return !!(context && this.visible && context.read === this.read &&
      context.userId === user?._id && context.merchantId === user?.merchantId);
  },
  async load(options = {}) {
    const append = options.append === true;
    if (!this.visible || (append && (this.data.loading || this.data.busy || !this.data.hasMore))) return;
    if (append && !this.current(this.context)) return this.load();
    if (options.preserveMedia !== true) this.operation = null;
    if (!append) { this.clearContext(); this.offset = 0; }
    else { this.read++; this.context = null; }
    const read = this.read;
    let userId, merchantId;
    const current = () => this.visible && this.read === read && (!userId ||
      (getApp().globalData.user?._id === userId && getApp().globalData.user?.merchantId === merchantId));
    this.setData({ loading: true, ready: false, loadError: false, pageError: false, error: '', busy: !!this.operation });
    try {
      const user = await getApp().ensureSession();
      if (!current()) return;
      userId = user?._id; merchantId = user?.merchantId;
      if (!userId) throw Error('登录资料暂不可用，请重试');
      if (!current()) return;
      if (this.draftOwner && (this.draftOwner.userId !== userId || this.draftOwner.merchantId !== merchantId)) {
        this.operation = null;
        this.setData(emptyDraft());
      }
      this.draftOwner = { userId, merchantId };
      const result = await api.call('merchant', 'myServices', { offset: append ? this.offset : 0 },
        { loading: false, silent: true, redirectOnForbidden: false, isActive: current });
      if (!current()) return;
      const batch = result.list || [];
      if (!Array.isArray(batch) || (result.hasMore && !batch.length)) throw Error('服务分页结果异常，请重试');
      const offset = (append ? this.offset : 0) + batch.length;
      if (result.nextOffset !== undefined && result.nextOffset !== offset) throw Error('服务分页位置异常，请重试');
      const rows = append ? this.data.list.slice() : [], ids = new Set(rows.map(item => item._id));
      const list = rows.concat(batch.filter(item => { if (ids.has(item._id)) return false; ids.add(item._id); return true; })
        .map(item => ({ ...item, priceText: yuan(item.price) })));
      this.offset = offset;
      this.context = { userId, merchantId, read };
      this.setData({ list, hasMore: result.hasMore === true, ready: true, busy: !!this.operation });
    } catch (error) {
      if (current()) {
        const retain = append && !['E_FORBIDDEN', 'E_FEATURE_OFF', 'E_UNBOUND'].includes(error.code);
        this.operation = null;
        if (!retain) this.clearContext();
        else this.context = { userId, merchantId, read };
        this.setData({ ready: false, loading: false, busy: false, loadError: true, pageError: retain, error: error.message || '服务加载失败' });
      }
    } finally {
      if (current()) { this.setData({ loading: false }); this.finishMedia(); }
    }
  },
  more() { return this.load({ append: true }); },
  retry() { return this.load({ append: this.data.pageError }); },
  canEdit() { return this.current(this.context) && this.data.ready && !this.data.loading && !this.data.busy; },
  input(event) {
    if (!this.canEdit()) return;
    const field = event.currentTarget.dataset.field;
    if (['title', 'desc', 'price', 'unit'].includes(field)) this.setData({ [field]: event.detail.value });
  },
  chooseType(event) {
    if (!this.canEdit()) return;
    const index = Number(event.detail.value);
    if (index === 0 || index === 1) this.setData({ priceTypeIndex: index });
  },
  begin(stage) {
    if (!this.visible || !this.data.ready || this.data.loading || this.data.busy) return null;
    if (!this.current(this.context)) { this.load(); return null; }
    const request = this.operation = { ...this.context, stage };
    this.setData({ busy: true, error: '', loadError: false });
    return request;
  },
  active(request) { return this.operation === request && this.current(request) && this.data.ready && !this.data.loading; },
  release(request) {
    if (this.operation !== request) return;
    this.operation = null;
    if (!this.visible) return;
    if (!this.current(this.context)) { this.load(); return; }
    this.setData({ busy: false });
  },
  finishMedia() {
    const request = this.operation;
    if (!request || request.stage !== 'media' || !this.visible || this.data.loading) return;
    if (!this.current(this.context) || !this.data.ready || request.userId !== this.context.userId || request.merchantId !== this.context.merchantId) {
      this.release(request); return;
    }
    if (!request.result) return;
    request.read = this.read;
    const { images, error } = request.result;
    if (error) {
      if (!/cancel/i.test(error.errMsg || error.message || '')) this.setData({ error: error.message || '图片上传失败' });
    } else this.setData({ images: [...this.data.images, ...images].slice(0, 9), error: '' });
    this.release(request);
  },
  async photos() {
    if (this.data.images.length >= 9) return;
    const request = this.begin('media');
    if (!request) return;
    try { request.result = { images: await uploadPhotos('merchant-services/' + request.userId, Math.min(3, 9 - this.data.images.length), { loading: false }) }; }
    catch (error) { request.result = { error }; }
    if (this.operation !== request) return;
    if (this.visible) await this.load({ preserveMedia: true });
  },
  async save() {
    const request = this.begin('save');
    if (!request) return;
    const type = this.data.priceTypeIndex ? 'quote' : 'fixed';
    const data = { title: this.data.title, desc: this.data.desc, priceType: type,
      price: type === 'fixed' ? Math.round(Number(this.data.price) * 100) : 0, unit: this.data.unit, status: 'off', images: this.data.images.slice() };
    try {
      await api.call('merchant', 'upsertService', data,
        { loading: false, silent: true, redirectOnForbidden: false, isActive: () => this.active(request) });
      if (!this.active(request)) return;
      this.setData({ title: '', desc: '', price: '', images: [] });
      await this.load();
    } catch (error) { if (this.active(request)) this.setData({ error: error.message || '服务保存失败' }); }
    finally { this.release(request); }
  }
});
