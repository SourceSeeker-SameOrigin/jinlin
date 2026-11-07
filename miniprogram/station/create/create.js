const api = require('../../utils/api');
Page({
  data: { busy: false, error: '', lines: '', result: null },
  change(event) { this.requestId = ''; this.setData({ lines: event.detail.value, result: null }); },
  async create() {
    if (this.data.busy) return;
    if (!this.requestId) this.requestId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    this.setData({ busy: true, error: '', result: null });
    try {
      const result = await api.call('station', 'createBatch', { lines: this.data.lines,
        requestId: this.requestId });
      this.setData({ result });
      this.requestId = '';
      if (!result.batchId) wx.showToast({ title: '这些门牌没有已授权住户', icon: 'none' });
      else wx.showToast({ title: '批次已创建', icon: 'success' });
    } catch (error) { this.setData({ error: error.message || '批次创建失败，请检查门牌列表' }); }
    finally { this.setData({ busy: false }); }
  }
});
