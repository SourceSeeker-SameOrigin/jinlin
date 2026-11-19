const fs=require('fs'),path=require('path');
const p=fs.readFileSync('/tmp/jinlin-qa100-guest-path','utf8').trim();
if(JSON.parse(fs.readFileSync(path.join(p,'project.config.json'))).appid!=='touristappid')throw Error('Tourist only');
fs.mkdirSync(path.join(p,'probe/nav'),{recursive:true});
fs.writeFileSync(path.join(p,'app.json'),JSON.stringify({pages:['probe/nav/start','probe/nav/away'],window:{navigationBarTitleText:'本地导航对照'}}));
fs.writeFileSync(path.join(p,'app.js'),`App({events:[],record(state,detail){this.events.push({state,detail:detail||'',stack:getCurrentPages().map(p=>p.route)});wx.getFileSystemManager().writeFileSync(wx.env.USER_DATA_PATH+'/jinlin-qa113-nav-control.json',JSON.stringify(this.events),'utf8');}})`);
for(const name of ['start','away']){
fs.writeFileSync(path.join(p,'probe/nav/'+name+'.json'),'{}');fs.writeFileSync(path.join(p,'probe/nav/'+name+'.wxss'),'');
fs.writeFileSync(path.join(p,'probe/nav/'+name+'.wxml'),`<view class="page"><view class="card">${name==='start'?'本地导航起点':'本地导航终点'}</view><button bindtap="go">${name==='start'?'打开对照页':'返回起点'}</button></view>`);
fs.writeFileSync(path.join(p,'probe/nav/'+name+'.js'),`Page({onLoad(){getApp().record('${name}:load')},onShow(){getApp().record('${name}:show')},onHide(){getApp().record('${name}:hide')},onUnload(){getApp().record('${name}:unload')},go(){getApp().record('${name}:click');wx.${name==='start'?'navigateTo':'navigateBack'}({${name==='start'?"url:'/probe/nav/away',":''}success:r=>getApp().record('${name}:success',r.errMsg),fail:r=>getApp().record('${name}:fail',r.errMsg),complete:r=>getApp().record('${name}:complete',r.errMsg)});}})`);
}
console.log('Disposable two-page navigation control prepared; no production code or cloud calls');
