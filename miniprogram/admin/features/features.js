const api = require('../../utils/api');
const listAll = require('../../utils/list-all');
const CONTENT_PREPARATION = '公众平台添加与发布内容相匹配的类目；配置内容安全消息推送到 mediaCallback；指定专人每天处理举报。图片须在审核回调通过后展示。';
const RECYCLE_PREPARATION = '与已备案的正规回收企业签约并作为商家入驻；逐小区配置分类积分单价、企业收购价、品类对应企业及服务员报酬；积分向下取整，企业金额四舍五入到分；缺项时不得开放。';
const INFO = {
  coupons: '无额外资质；由管理员在后台创建测试券模板，避免示例券误发。',
  notices: '无额外资质。' + CONTENT_PREPARATION,
  federation: '参与小区配置相同 federationGroupId，并先开启需求广场、闲置或活动之一；付费悬赏仍限本小区。',
  stationDelivery: '先与驿站签合作协议；配置合作驿站，员工先申请、管理员审核；只配送明确同意的住户。',
  vacantHome: '配置单次报酬 prices.vacantHome.perVisitPayout、月卡价格和值班时段；服务协议写明钥匙保管责任。',
  board: CONTENT_PREPARATION, idle: CONTENT_PREPARATION, events: CONTENT_PREPARATION, chat: CONTENT_PREPARATION,
  idleEscrow: '平台代收用户之间的货款，需要对应类目和资质；以公众平台实际要求为准，准备好前保持关闭，只用信息模式。',
  travelCarry: '依赖 board；服务协议写入境外帮带规则。',
  location: '申请 getLocation、chooseLocation 并写清用途；更新隐私保护指引，配置小区坐标及 locationGeo 地理索引。',
  autoPayout: '商户平台开通新版商家转账、配置佣金报酬场景并充值；payout 和 timer 配置 MCH_ID、MCH_SERIAL_NO、MCH_PRIVATE_KEY_B64、WXPAY_PUBLIC_KEY_B64、WXPAY_PUBLIC_KEY_ID、MINI_APP_ID、TRANSFER_SCENE_ID、TRANSFER_JOB_TYPE、TRANSFER_REPORT_DESCRIPTION。卖家单笔最多 1999.99 元，服务员达到 2000 元须有效实名；商户及确认页验收完成前保持关闭。',
  elder: '管理员核验陪诊培训证书；与合作食堂签约；逐小区配置 canteens、prices.meal.goodsCapMax、prices.visit.taskPayout、值班时段及月卡；配置 config.templateIds.visitReport。缺项时不要开启；按公众平台要求准备相关类目。',
  pet: '服务员宠物照护培训；云函数配好 SECRET_KEY（32 字节随机密钥）；协议写明钥匙与密码保管责任。',
  points: RECYCLE_PREPARATION, recycle: RECYCLE_PREPARATION,
  merchants: CONTENT_PREPARATION + '准备入驻协议、佣金、责任与执照公示；报价待报价阶段不自动过期；开锁按当地要求备案，开始前当面核验身份证与门牌一致，仅保存核验结果，不保存身份证号码或照片。',
  ads: CONTENT_PREPARATION + '准备广告审核制度和价格表；管理员确认收款后才记收入；跨小区投放只记一笔平台收入。'
};
const LABELS = { board:'需求广场',idle:'闲置交易',idleEscrow:'闲置担保',events:'社区活动',chat:'站内聊天',location:'地图定位',coupons:'优惠券',points:'环保积分',autoPayout:'自动打款',elder:'助老服务',pet:'上门喂宠',stationDelivery:'驿站送上门',recycle:'回收上门',merchants:'商家预约',vacantHome:'空置房巡检',travelCarry:'出行帮带',federation:'联合社区',ads:'广告位',notices:'物业公告' };
Page({
  data: { loading: true, ready: false, saving: false, error: '', items: [], communities: [], communityIndex: 0, scope: 'community' },
  onLoad() { this.load(); },
  async load() {
    this.setData({ loading: true, ready: false, error: '' });
    try {
      const user = await getApp().ensureSession();
      if (!user.roles.includes('admin')) throw new Error('只有运营管理员可配置扩展功能');
      const communities = await listAll('catalog', 'listCommunities');
      this.setData({ communities, communityIndex: Math.max(0, communities.findIndex(item => item._id === user.communityId)) });
      await this.refresh();
    } catch (error) { this.setData({ error: error.message || '加载失败' }); }
    finally { this.setData({ loading: false }); }
  },
  async refresh() {
    this.setData({ ready: false });
    const community = this.data.communities[this.data.communityIndex];
    const result = await api.call('admin', 'getFeatures', { communityId: community && community._id }, { loading: false, silent: true });
    this.setData({ ready: true, communityId: result.communityId, global: result.global,
      items: Object.keys(LABELS).map(key => ({ key, label: LABELS[key], info: INFO[key], global: result.global[key] === true,
        community: Object.prototype.hasOwnProperty.call(result.community, key) ? result.community[key] === true : null,
        enabled: this.data.scope === 'global' ? result.global[key] === true :
          Object.prototype.hasOwnProperty.call(result.community, key) ? result.community[key] === true : result.global[key] === true })) });
    this.communityFeatures = result.community;
  },
  choose(event) { if (!this.data.ready || this.data.saving) return; this.setData({ communityIndex: Number(event.detail.value) }); this.refresh().catch(error => this.setData({ error: error.message })); },
  scope(event) { if (!this.data.ready || this.data.saving) return; this.setData({ scope: event.currentTarget.dataset.scope }); this.refresh().catch(error => this.setData({ error: error.message })); },
  async toggle(event) {
    if (!this.data.ready || this.data.saving) return;
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
