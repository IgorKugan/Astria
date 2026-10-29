'use strict';
const api=window.floating,card=document.getElementById('card');
let gesture;
function finish(event,cancel=false){
  if(!gesture||event.pointerId!==gesture.id)return;
  const moved=gesture.moved;gesture=undefined;card.classList.remove('dragging');
  if(card.hasPointerCapture(event.pointerId))card.releasePointerCapture(event.pointerId);
  if(moved)api.dragEnd();else if(!cancel)api.swap();
}
card.onpointerdown=event=>{
  if(event.button!==0||event.target.closest('button'))return;
  gesture={id:event.pointerId,x:event.screenX,y:event.screenY,moved:false};
  card.setPointerCapture(event.pointerId);event.preventDefault();
};
card.onpointermove=event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const x=event.screenX-gesture.x,y=event.screenY-gesture.y;
  if(!gesture.moved&&Math.hypot(x,y)>=5){gesture.moved=true;card.classList.add('dragging');api.dragStart();}
  if(gesture.moved)api.dragMove(x,y);
};
card.onpointerup=event=>finish(event);
card.onclick=event=>{if(event.detail===0&&event.target===card)api.swap();};
card.onpointercancel=event=>finish(event,true);
card.onlostpointercapture=event=>finish(event,true);
card.onkeydown=event=>{
  if(event.target!==card)return;
  if(['Enter',' '].includes(event.key)){event.preventDefault();api.swap();}
  const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
  if(delta){event.preventDefault();api.step(...delta);}
};
document.getElementById('corner').onclick=event=>{event.stopPropagation();api.corner();};
api.onState(state=>{
  const tr=value=>window.AstriaI18n.translate(value,state.language);
  document.documentElement.lang=state.language;
  document.documentElement.classList.toggle('light',state.theme==='light');
  document.documentElement.style.setProperty('--color',state.color);
  document.getElementById('name').textContent=state.name;
  document.getElementById('loading').textContent=state.ready?'':tr('Carregando…');
  card.setAttribute('aria-label',state.name+' · '+tr('Clique para trocar. Arraste para mover.'));
  card.title=tr('Clique para trocar. Arraste para mover.');
  const corner=document.getElementById('corner');corner.title=tr('Mover para outro canto');corner.setAttribute('aria-label',corner.title);
});
