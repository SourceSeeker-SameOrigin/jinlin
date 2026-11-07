const api = require('../../utils/api');
const INFO = {
  board: '需添加匹配社交/发帖类目、配置图片审核回调并安排举报审核人。', idle: '需确认二手信息内容审核与交易规则。',
  idleEscrow: '涉及平台代收货款和电商资质，未取得资质前保持关闭。', events: '需活动类目与内容审核安排。', chat: '需匹配聊天类目并配置图片审核和举报处理。',
  location: '需申请定位接口、更新隐私指引并配置小区坐标。', coupons: '无额外资质。', points: '需与正规回收企业合作。',
  autoPayout: '需开通商家转账并配置 APIv3 环境变量。', elder: '需核验陪诊证书并与食堂签约。', pet: '需宠物照护准备并配置密钥。',
  stationDelivery: '需先与驿站签合作协议。', recycle: '需与已备案回收企业合作。', merchants: '需商家协议及营业执照审核。',
  vacantHome: '需在协议中明确钥匙保管责任。', travelCarry: '需开启需求广场并补充境外帮带条款。', federation: '需先开启需求广场、闲置或活动之一。',
  ads: '需广告审核制度及广告内容审核。', notices: '无额外资质。'
};
const LABELS = { board:'需求广场',idle:'闲置交易',idleEscrow:'闲置担保',events:'社区活动',chat:'站内聊天',location:'地图定位',coupons:'优惠券',points:'环保积分',autoPayout:'自动打款',elder:'助老服务',pet:'上门喂宠',stationDelivery:'驿站送上门',recycle:'回收上门',merchants:'商家预约',vacantHome:'空置房巡检',travelCarry:'出行帮带',federation:'联合社区',ads:'广告位',notices:'物业公告' };
Page({
  data: { loading: true, saving: false, error: '', items: [], communities: [], communityIndex: 0, scope: 'community' },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可配置扩展功能');
      const result = await api.call('catalog', 'listCommunities', {}, { loading: false, silent: true });
      this.setData({ communities: result.list, communityIndex: Math.max(0, result.list.findIndex(item => item._id === user.communityId)) });
      await this.refresh();
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async refresh() {
    const community = this.data.communities[this.data.communityIndex];
    const result = await api.call('admin', 'getFeatures', { communityId: community && community._id }, { loading: false, silent: true });
    this.setData({ communityId: result.communityId, global: result.global,
      items: Object.keys(LABELS).map(key => ({ key, label: LABELS[key], info: INFO[key], global: result.global[key] === true,
        community: Object.prototype.hasOwnProperty.call(result.community, key) ? result.community[key] === true : null,
        enabled: this.data.scope === 'global' ? result.global[key] === true :
          Object.prototype.hasOwnProperty.call(result.community, key) ? result.community[key] === true : result.global[key] === true })) });
    this.communityFeatures = result.community;
  },
  choose(event) { this.setData({ communityIndex: Number(event.detail.value) }); this.refresh().catch(error => this.setData({ error: error.message })); },
  scope(event) { this.setData({ scope: event.currentTarget.dataset.scope }); this.refresh().catch(error => this.setData({ error: error.message })); },
  async toggle(event) {
    const key = event.currentTarget.dataset.key;
    const community = this.data.communities[this.data.communityIndex];
    const enabled = event.detail.value === true;
    this.setData({ saving: true, error: '' });
    try {
      if (this.data.scope === 'global') {
        const features = { ...(this.data.global || {}), [key]: enabled };
        await api.call('admin', 'updateConfig', { features });
      } else {
        if (!community) throw new Error('请先选择小区');
        const features = { ...(this.communityFeatures || {}), [key]: enabled };
        await api.call('admin', 'updateCommunity', { communityId: community._id, features });
        community.features = features;
        this.communityFeatures = features;
        this.setData({ communities: this.data.communities });
      }
      await this.refresh();
    } catch (error) { this.setData({ error: error.message || '依赖未满足，开关未保存' }); }
    finally { this.setData({ saving: false }); }
  }
});
