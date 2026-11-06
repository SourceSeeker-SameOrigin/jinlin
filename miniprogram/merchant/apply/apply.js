const api = require('../../utils/api');
const { uploadPhotos } = require('../../utils/media');
const CATEGORIES = ['housekeeping', 'repair', 'laundry', 'locksmith', 'haul', 'canteen', 'recycler', 'other'];
const LABELS = ['家政', '维修', '洗衣', '开锁', '清运', '食堂', '回收企业', '其他'];
Page({
  data: { busy: false, error: '', categories: LABELS, categoryIndex: 0, name: '', licenseName: '', creditCode: '', contactName: '', phone: '', licenseFileId: '' },
  onLoad() { this.load(); },
  async load() {
    try {
      const user = await getApp().ensureSession();
      this.user = user;
      const result = await api.call('merchant', 'myApplication', {}, { loading: false, silent: true });
      if (result.merchant) this.setData({ existing: result.merchant });
      this.setData({ phone: user.phone || '' });
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
  },
  input(event) { const key = event.currentTarget.dataset.field; this.setData({ [key]: event.detail.value }); },
  chooseCategory(event) { this.setData({ categoryIndex: Number(event.detail.value) }); },
  async upload() {
    try { const files = await uploadPhotos('merchants/' + this.user._id + '/license', 1); this.setData({ licenseFileId: files[0] }); }
    catch (error) { this.setData({ error: error.message || '营业执照上传失败' }); }
  },
  async submit() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const communityId = this.user.communityId;
      await api.call('merchant', 'apply', { communityId, name: this.data.name, category: CATEGORIES[this.data.categoryIndex],
        licenseFileId: this.data.licenseFileId, licenseInfo: { name: this.data.licenseName, creditCode: this.data.creditCode },
        contactName: this.data.contactName, phone: this.data.phone });
      wx.showToast({ title: '入驻申请已提交', icon: 'success' });
      wx.navigateBack();
    } catch (error) { this.setData({ error: error.message || '提交失败，请检查资料' }); }
    finally { this.setData({ busy: false }); }
  }
});
