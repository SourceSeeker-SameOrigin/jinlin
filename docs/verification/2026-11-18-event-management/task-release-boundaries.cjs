// Diagnostic: actual provider task page; synthetic modal and intercepted writes.
const { runtime } = require('../2026-11-09-remediation/page-fixture.cjs');
const results = [];
const flush = async () => { for(let i=0;i<10;i++) await Promise.resolve(); };
(async()=>{
 for(const boundary of ['same-page','cancel','hidden','unload','user-changed','order-changed','refreshed','completed']){
  const env=runtime(async(n,a)=>a==='detail'?{status:'accepted',canShareLocation:false,serviceCode:'trash',detail:{},pricing:{},slot:{}}:{}, {media:{}});
  env.app.globalData.user={_id:'synthetic-provider-a',roles:['provider']};
  let modal;env.wx.showModal=o=>{modal=o;};
  const page=env.instance('miniprogram/provider/task/task.js');page.onLoad({id:'synthetic-order-a'});await page.onShow();
  const op=page.act({currentTarget:{dataset:{action:'release'}}});await flush();
  if(boundary==='hidden')page.onHide();
  if(boundary==='unload')page.onUnload();
  if(boundary==='user-changed')env.app.globalData.user={_id:'synthetic-provider-b',roles:['provider']};
  if(boundary==='order-changed')page.orderId='synthetic-order-b';
  if(boundary==='refreshed')await page.load();
  if(boundary==='completed')page.data.order.status='done';
  modal.success({confirm:boundary!=='cancel',cancel:boundary==='cancel'});await op;
  const writes=env.requests.filter(x=>x[1]==='release');
  results.push({boundary,expectedRequests:boundary==='same-page'?1:0,actualRequests:writes.length,orderIds:writes.map(x=>x[2].orderId),navigation:env.navigation,pass:writes.length===(boundary==='same-page'?1:0)});
 }
 console.log(JSON.stringify({scope:'actual page with synthetic modal and API; no real order release',pass:results.filter(x=>x.pass).length,fail:results.filter(x=>!x.pass).length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
