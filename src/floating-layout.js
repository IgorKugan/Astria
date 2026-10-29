'use strict';
const unit=(value,fallback=1)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
function floatingPosition(value) {
  const position={x:unit(value?.x),y:unit(value?.y)};
  if(typeof value?.accountId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value.accountId))position.accountId=value.accountId;
  return position;
}
function floatingAccount(state) {
  const workspace=state.workspaces.find(w=>w.id===state.activeWorkspaceId);
  if(workspace?.layout!=='floating')return;
  const accounts=state.accounts.filter(a=>a.workspaceId===workspace.id);
  const primary=accounts.find(a=>a.id===state.selectedAccountId)||accounts[0];
  const available=accounts.filter(a=>a.id!==primary?.id&&a.activity!=='suspended');
  return available.find(a=>a.id===workspace.floating?.accountId)||available[0];
}
function floatingBounds(area,size,position) {
  if(area.width<280||area.height<180)return null;
  let width=Math.round(Math.min(360,Math.max(220,area.width*.28),area.width-16));
  let height=Math.round((width-4)*size.height/size.width)+28;
  if(height>area.height-16){height=area.height-16;width=Math.floor((height-28)*size.width/size.height)+4;}
  return {x:area.x+8+Math.round(unit(position?.x)*(area.width-width-16)),y:area.y+8+Math.round(unit(position?.y)*(area.height-height-16)),width,height};
}
function positionAt(area,card,x,y) {
  return {x:unit((x-area.x-8)/Math.max(1,area.width-card.width-16),0),y:unit((y-area.y-8)/Math.max(1,area.height-card.height-16),0)};
}
module.exports={floatingPosition,floatingAccount,floatingBounds,positionAt};
