const api=require('./api');
const REASONS=['违规或不实内容','骚扰或侵犯隐私','其他问题'];
async function submit(targetType,targetId) {
  const choice=await new Promise(resolve=>wx.showActionSheet({itemList:REASONS,success:resolve,fail:()=>resolve(null)}));
  if(!choice)return false;
  const detail=await new Promise(resolve=>wx.showModal({title:'举报说明',editable:true,placeholderText:'可补充说明（不超过500字）',success:resolve,fail:()=>resolve(null)}));
  if(!detail||!detail.confirm)return false;
  const text=(detail.content||'').trim();if([...text].length>500)throw new Error('举报说明不能超过500字');
  await api.call('content','report',{targetType,targetId,reason:REASONS[choice.tapIndex],text});
  wx.showToast({title:'举报已提交',icon:'success'});return true;
}
module.exports={submit};
