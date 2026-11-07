const api = require('../../utils/api');
const { display } = require('../../utils/time');
const { yuan } = require('../../utils/money');
Page({
  data: { loading: false, error: '', posts: [], type: 'ask', scope: 'community', federationEnabled: false,
    types: [{ code: 'task', label: '悬赏' }, { code: 'ask', label: '求助' }, { code: 'carry', label: '出行帮带' }] },
  onShow() { this.load(true); },
  async load(reset = false) {
    this.setData({ loading: true, error: '', ...(reset ? { posts: [] } : {}) });
    try {
      const user = await getApp().ensureSession();
      const community = await api.call('catalog', 'getCommunity', { communityId: user.communityId }, { loading: false, silent: true });
      const federationEnabled = community.enabledFeatures.federation;
      if (!community.enabledFeatures.board) throw new Error('需求广场暂未开放');
      const result = await api.call('board', 'list', { type: this.data.type, scope: this.data.scope,
        offset: reset ? 0 : this.data.posts.length }, { loading: false, silent: true });
      this.setData({ federationEnabled, posts: reset ? result.list.map(this.formatPost) :
        [...this.data.posts, ...result.list.map(this.formatPost)], hasMore: result.hasMore });
    } catch (error) { this.setData({ error: error.message || '需求列表加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  formatPost(post) { return { ...post, timeText: display(post.createdAt), typeText: post.type === 'task' ? '悬赏' : post.type === 'carry' ? '出行帮带' : '求助',
    rewardText: post.reward ? yuan(post.reward) : '', slotText: post.slot ? post.slot.date + ' ' + post.slot.start + '—' + post.slot.end : '' }; },
  chooseType(event) { const type = event.currentTarget.dataset.type;
    this.setData({ type, ...(type === 'task' ? { scope: 'community' } : {}) }); this.load(true); },
  chooseScope(event) { this.setData({ scope: event.currentTarget.dataset.scope }); this.load(true); },
  create() { wx.navigateTo({ url: '/board/create/create?type=' + this.data.type }); },
  open(event) { wx.navigateTo({ url: '/board/detail/detail?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  more() { if (this.data.hasMore && !this.data.loading) this.load(); }
});
