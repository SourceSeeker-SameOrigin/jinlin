const api = require('../../utils/api');
const INFO = {
  coupons: '无额外资质。', notices: '无额外资质。', federation: '无额外资质。联合社区需先开启需求广场、闲置或活动之一。',
  stationDelivery: '无额外资质。驿站送上门需先与驿站签合作协议。', vacantHome: '无额外资质。空置房巡检需在服务协议中写明钥匙保管责任。',
  board: '公众平台添加与发帖、评论、聊天相匹配的类目（如社交类）；在公众平台配置内容安全的消息推送到 mediaCallback；指定专人每天处理举报。',
  idle: '公众平台添加与发帖、评论、聊天相匹配的类目（如社交类）；在公众平台配置内容安全的消息推送到 mediaCallback；指定专人每天处理举报。',
  events: '公众平台添加与发帖、评论、聊天相匹配的类目（如社交类）；在公众平台配置内容安全的消息推送到 mediaCallback；指定专人每天处理举报。',
  chat: '公众平台添加与发帖、评论、聊天相匹配的类目（如社交类）；在公众平台配置内容安全的消息推送到 mediaCallback；指定专人每天处理举报。',
  idleEscrow: '平台代收用户之间的货款，属于电商平台性质，需要对应类目和资质（通常涉及增值电信业务经营许可）；拿到前保持关闭，只用信息模式。',
  travelCarry: '依赖 board；服务协议写入境外帮带规则。',
  location: '公众平台“开发管理 → 接口设置”申请 getLocation、chooseLocation，写清用途；更新用户隐私保护指引；给每个小区设好坐标。',
  autoPayout: '商户平台开通新版“商家转账”、配置报备场景并充值；云函数 payout 设置 MCH_ID、MCH_SERIAL_NO、MCH_PRIVATE_KEY_B64、WXPAY_PUBLIC_KEY_B64、WXPAY_PUBLIC_KEY_ID、MINI_APP_ID、TRANSFER_SCENE_ID、TRANSFER_JOB_TYPE、TRANSFER_REPORT_DESCRIPTION。',
  elder: '陪诊服务员参加陪诊培训并取得证书，管理员核验后勾选证书；与合作食堂签约；必要时添加医疗健康相关类目。',
  pet: '服务员宠物照护培训；云函数配好 SECRET_KEY（32 字节随机密钥）；服务协议写明钥匙与密码的保管责任。',
  points: '与已备案的正规回收企业签约，回收企业作为商家入驻。',
  recycle: '与已备案的正规回收企业签约，回收企业作为商家入驻。',
  merchants: '商家入驻协议（佣金、责任、执照公示）；按合同填写 10% 默认佣金或后台调整；确定每周对公结算流程；开锁类商家需公安部门备案（按当地要求），且核验照片留存规则确认前代码会拒绝创建开锁预约。',
  ads: '广告审核制度；广告位价格表；广告内容符合广告法。'
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
