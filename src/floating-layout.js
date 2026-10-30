'use strict';
const unit=(value,fallback=1)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
function floatingPosition(value) {
  const position={x:unit(value?.x),y:unit(value?.y)};
  if(Number.isFinite(value?.width)&&value.width>0)position.width=Math.min(1,value.width);
  if(typeof value?.pinned==='boolean')position.pinned=value.pinned;
  if(typeof value?.accountId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value.accountId))position.accountId=value.accountId;
  return position;
}
function floatingPositions(value) {
  if(Array.isArray(value))return value.slice(0,299).map(floatingPosition);
  if(value&&typeof value==='object')return [floatingPosition(value)];
}
function floatingDefault(index) {
  const layer=Math.floor(index/4),inset=.4*layer/(layer+1);
  return {x:index%2?inset:1-inset,y:index%4<2?1-inset:inset};
}
function floatingAccounts(state) {
  const workspace=state.workspaces.find(w=>w.id===state.activeWorkspaceId);
  if(workspace?.layout!=='floating')return [];
  const accounts=state.accounts.filter(a=>a.workspaceId===workspace.id);
  const primary=accounts.find(a=>a.id===state.selectedAccountId)||accounts[0];
  const available=accounts.filter(a=>a.id!==primary?.id&&a.activity!=='suspended');
  const used=new Set();
  return (floatingPositions(workspace.floating)||[{}]).flatMap((position,index)=>{
    const account=(position.accountId?available.find(a=>a.id===position.accountId):available.find(a=>!used.has(a.id)))||(!Array.isArray(workspace.floating)?available[0]:undefined);
    if(!account||used.has(account.id))return [];
    used.add(account.id);return [{account,position,index}];
  });
}
const floatingAccount=state=>floatingAccounts(state)[0]?.account;
function floatingBounds(area,size,position) {
  if(area.width<280||area.height<180)return null;
  const requested=Number.isFinite(position?.width)&&position.width>0?Math.max(180,area.width*position.width):Math.min(360,Math.max(220,area.width*.28));
  let width=Math.round(Math.min(requested,area.width-16));
  let height=Math.round((width-4)*size.height/size.width)+28;
  if(height>area.height-16){height=area.height-16;width=Math.floor((height-28)*size.width/size.height)+4;}
  return {x:area.x+8+Math.round(unit(position?.x)*(area.width-width-16)),y:area.y+8+Math.round(unit(position?.y)*(area.height-height-16)),width,height};
}
function positionAt(area,card,x,y) {
  return {x:unit((x-area.x-8)/Math.max(1,area.width-card.width-16),0),y:unit((y-area.y-8)/Math.max(1,area.height-card.height-16),0)};
}
module.exports={floatingPosition,floatingPositions,floatingDefault,floatingAccount,floatingAccounts,floatingBounds,positionAt};
