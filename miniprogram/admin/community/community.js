const api = require('../../utils/api');
const form = require('./form');
Page({
  data: { loading:true,saving:false,error:'',community:null,communities:[],communityIndex:0,authorized:false,priceRows:[],globalRows:[],keywordRows:[],planOptions:form.PLANS,
    helpModeIndex:0,helpModes:['按每15分钟计价','按次计价（超时不自动扣费）'],stations:[],dutyWindows:[],canteens:[],plans:[],recycleRows:[],buildingId:'',buildingName:'',buildingUnits:'',petCertRequired:false },
  onLoad(){return this.load();},
  async load() {
    this.setData({loading:true,error:'',authorized:false});
    try { const user=await getApp().ensureSession();if(!user.roles.includes('admin'))throw new Error('只有运营管理员可以修改配置');this.setData({authorized:true});await this.selectCommunity(this.data.communityIndex); }
    catch(error){this.setData({error:error.message || '配置加载失败'});}finally{this.setData({loading:false});}
  },
  async selectCommunity(index) {
    const sequence=(this.sequence||0)+1;this.sequence=sequence;
    const result=await api.call('admin','managementConfig',{communityId:(this.data.communities[index]||{})._id},{loading:false,silent:true});
    if(sequence!==this.sequence)return;
    const c=result.community,g=result.global;
    this.setData({communities:result.communities,community:c,communityIndex:Math.max(0,result.communities.findIndex(v=>c&&v._id===c._id))});
    if(!this.globalLoaded){this.globalLoaded=true;this.setData({hotline:g.hotline||'',globalRows:form.fields(form.GLOBAL_FIELDS,g),keywordRows:form.KEYWORDS.map(([key,label])=>({key,label,value:(g[key]||[]).join('\n')}))});}
    if(!c)return;
    this.setData({name:c.name,city:c.city||'',district:c.district||'',address:c.address||'',propertyName:c.propertyName||'',federationGroupId:c.federationGroupId||'',
      platformRate:c.rates&&c.rates.platform!==undefined?String(c.rates.platform):'',propertyRate:c.rates&&c.rates.property!==undefined?String(c.rates.property):'',
      location:c.location||null,locationText:c.location?`${c.location.lat}, ${c.location.lng}`:'未设置',petCertRequired:(c.requiredCerts||[]).includes('pet'),
      helpModeIndex:c.prices&&c.prices.help&&c.prices.help.billingMode==='per_visit'?1:0,stations:form.copy(c.stations||[]),canteens:form.copy(c.canteens||[]),dutyWindows:form.copy(c.dutyWindows||[]),priceRows:form.fields(form.PRICE_FIELDS,c.prices||{}),
      holidayDates:(c.prices&&c.prices.pet&&c.prices.pet.holidayDates||[]).join('\n'),
      recycleRows:form.CATEGORIES.map(([key,label])=>({key,label,...((c.prices&&c.prices.recycle&&c.prices.recycle.categories||{})[key]||{})})),
      plans:(c.cardPlans||[]).map(v=>({original:v,kindIndex:form.PLANS.findIndex(t=>t.code===v.code),name:v.name,price:String(v.price),firstPeriodPrice:String(v.firstPeriodPrice),days:String(v.days),dailyParcelQuota:v.dailyParcelQuota||'',weekdays:(v.schedule&&v.schedule.weekdays||[]).join(',')})),buildingId:'',buildingName:'',buildingUnits:''});
  },
  async chooseCommunity(event){if(this.data.saving)return;this.setData({loading:true,error:''});try{await this.selectCommunity(Number(event.detail.value));}catch(e){this.setData({error:e.message});}finally{this.setData({loading:false});}},
  input(event){this.setData({[event.currentTarget.dataset.field]:event.detail.value});},
  rowInput(event){const {list,index,field}=event.currentTarget.dataset;if(!['stations','canteens','dutyWindows','priceRows','globalRows','keywordRows','plans','recycleRows'].includes(list))return;this.setData({[`${list}[${index}].${field}`]:event.detail.value});},
  addRow(event){const list=event.currentTarget.dataset.list;const defaults={stations:{code:'',name:''},canteens:{code:'',name:'',merchantId:''},dutyWindows:{start:'',end:''},plans:{original:{},kindIndex:0,name:'垃圾月卡',price:'',firstPeriodPrice:'',days:'',dailyParcelQuota:'',weekdays:''}};if(defaults[list])this.setData({[list]:[...this.data[list],defaults[list]]});},
  removeRow(event){const {list,index}=event.currentTarget.dataset;if(['stations','canteens','dutyWindows','plans'].includes(list))this.setData({[list]:this.data[list].filter((_,i)=>i!==Number(index))});},
  choosePlan(event){const i=Number(event.currentTarget.dataset.index),kindIndex=Number(event.detail.value);this.setData({[`plans[${i}].kindIndex`]:kindIndex,[`plans[${i}].name`]:form.PLANS[kindIndex].name});},
  chooseHelpMode(event){const index=Number(event.detail.value);if(!this.data.saving&&[0,1].includes(index))this.setData({helpModeIndex:index});},
  togglePetCert(event){this.setData({petCertRequired:event.detail.value});},
  async chooseLocation(){try{const point=await new Promise((resolve,reject)=>wx.chooseLocation({success:resolve,fail:reject}));this.setData({location:{lat:point.latitude,lng:point.longitude},locationText:point.name||`${point.latitude}, ${point.longitude}`});}catch(e){if(!String(e.errMsg).includes('cancel'))this.setData({error:'无法选择小区位置，请确认定位授权'});}},
  async saveCommunity(){if(!this.data.authorized||this.data.saving||!this.data.community)return;this.setData({saving:true,error:''});try{
    const d=this.data,prices=form.pricePatch(d.community.prices,d.priceRows,d.helpModeIndex===1?'per_visit':'per15min');
    if(d.holidayDates.trim() || prices.pet&&prices.pet.holidayDates) {prices.pet=prices.pet||{};prices.pet.holidayDates=d.holidayDates.split(/[,，\s]+/).filter(Boolean);}
    for(const row of d.recycleRows){if(![row.pointsPerKg,row.purchaseFenPerKg,row.recyclerId].some(v=>v!==undefined&&String(v)!==''))continue;prices.recycle=prices.recycle||{};prices.recycle.categories=prices.recycle.categories||{};prices.recycle.categories[row.key]={pointsPerKg:form.number(row.pointsPerKg,'积分'),purchaseFenPerKg:form.number(row.purchaseFenPerKg,'收购价'),recyclerId:(row.recyclerId||'').trim()};}
    const requiredCerts=(d.community.requiredCerts||[]).filter(v=>v!=='pet');if(d.petCertRequired)requiredCerts.push('pet');
    const rates=form.copy(d.community.rates);if(d.platformRate!==''||d.propertyRate!==''){if(d.platformRate===''||d.propertyRate==='')throw new Error('请同时填写平台和物业费率');rates.platform=Number(d.platformRate);rates.property=Number(d.propertyRate);}
    const payload={communityId:d.community._id,name:d.name,city:d.city,district:d.district,address:d.address,propertyName:d.propertyName,prices,dutyWindows:d.dutyWindows,stations:d.stations,canteens:d.canteens.map(v=>({...v,merchantId:v.merchantId||null})),cardPlans:form.plans(d.plans),requiredCerts,federationGroupId:d.federationGroupId.trim()||null,...(Object.keys(rates).length?{rates}:{}),...(d.location?{location:d.location}:{})};
    await api.call('admin','updateCommunity',payload);wx.showToast({title:'小区配置已保存',icon:'success'});await this.selectCommunity(d.communityIndex);
  }catch(e){this.setData({error:e.message||'保存失败，输入已保留'});}finally{this.setData({saving:false});}},
  async saveGlobal(){if(!this.data.authorized||this.data.saving)return;this.setData({saving:true,error:''});try{const patch={hotline:this.data.hotline.trim()};for(const row of this.data.globalRows)if(row.value!=='')patch[row.key]=form.number(row.value,row.label);for(const row of this.data.keywordRows)patch[row.key]=[...new Set(row.value.split('\n').map(v=>v.trim()).filter(Boolean))];await api.call('admin','updateConfig',patch);wx.showToast({title:'全局配置已保存',icon:'success'});}catch(e){this.setData({error:e.message||'保存失败，输入已保留'});}finally{this.setData({saving:false});}},
  editBuilding(event){const b=(this.data.community.buildings||[]).find(v=>v._id===event.currentTarget.dataset.id);if(b)this.setData({buildingId:b._id,buildingName:b.name,buildingUnits:b.units.join('，')});},
  newBuilding(){this.setData({buildingId:'',buildingName:'',buildingUnits:''});},
  async addBuilding(){if(!this.data.authorized||this.data.saving||!this.data.community)return;this.setData({saving:true,error:''});try{const units=this.data.buildingUnits.split(/[,，\n]+/).map(v=>v.trim()).filter(Boolean);await api.call('admin','upsertBuilding',{communityId:this.data.community._id,buildingId:this.data.buildingId||undefined,name:this.data.buildingName.trim(),units});const r=await api.call('admin','managementConfig',{communityId:this.data.community._id},{loading:false,silent:true});this.setData({'community.buildings':r.community.buildings,buildingId:'',buildingName:'',buildingUnits:''});wx.showToast({title:'楼栋已保存',icon:'success'});}catch(e){this.setData({error:e.message||'楼栋保存失败'});}finally{this.setData({saving:false});}}
});
