const api=require('./api');
const { currentVisit } = require('./visible-list');

async function load(page, slot, communityId, visible = currentVisit(page)) {
  if (!visible()) return;
  const sequence = page.adSequence = (page.adSequence || 0) + 1;
  const active = () => sequence === page.adSequence && visible();
  page.adCommunityId = communityId;
  page.setData({ ads: [], adError: '' });
  if (!communityId) return;
  try {
    const result = await api.call('content', 'adsForSlot', { slot, communityId },
      { loading: false, silent: true, isActive: active });
    if (active()) page.setData({ ads: result.ads || [] });
  } catch (error) {
    if (active() && error.code !== 'E_FEATURE_OFF') page.setData({ adError: '推荐内容加载失败，可重试' });
  }
}
function record(page,adId,type) {
  if(!page.adCommunityId||!(page.data.ads||[]).some(v=>v._id===adId))return;
  if(type==='ad_view'){page.adViews=page.adViews||new Set();const key=page.adCommunityId+':'+adId;if(page.adViews.has(key))return;page.adViews.add(key);}
  api.call('content','adEvent',{adId,communityId:page.adCommunityId,type},{loading:false,silent:true}).catch(()=>{});
}
function open(page,event) {
  const ad=(page.data.ads||[]).find(v=>v._id===event.currentTarget.dataset.id);if(!ad||!ad.target)return;
  const t=ad.target;let url='';
  if(t.type==='merchant')url='/shops/detail/detail?merchantId='+encodeURIComponent(t.id);
  if(t.type==='event')url='/events/detail/detail?id='+encodeURIComponent(t.id);
  if(t.type==='page'&&['/shops/list/list','/shops/detail/detail','/events/list/list','/events/detail/detail'].includes(t.path))url=t.path;
  if(url){record(page,ad._id,'ad_click');wx.navigateTo({url});}
}
function clear(page) {
  if (page._hidden || page._unloaded) return;
  page.adSequence = (page.adSequence || 0) + 1;
  page.adCommunityId = null;
  page.setData({ ads: [], adError: '' });
}
module.exports={load,record,open,clear};
