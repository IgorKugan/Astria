'use strict';
const api=window.floating,card=document.getElementById('card');
let gesture,pinned=false;
function finish(event,cancel=false){
  if(!gesture||event.pointerId!==gesture.id)return;
  const {moved,mode}=gesture;gesture=undefined;card.classList.remove('dragging','resizing');
  if(card.hasPointerCapture(event.pointerId))card.releasePointerCapture(event.pointerId);
  if(moved){if(mode!=='locked')api.dragEnd();}else if(!cancel&&mode!=='resize')api.swap();
}
card.onpointerdown=event=>{
  const resize=event.target.closest('#resize');
  if(event.button!==0||event.target.closest('button')&&!resize)return;
  gesture={id:event.pointerId,x:event.screenX,y:event.screenY,moved:false,mode:pinned?'locked':resize?'resize':'move'};
  card.setPointerCapture(event.pointerId);event.preventDefault();
};
card.onpointermove=event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const x=event.screenX-gesture.x,y=event.screenY-gesture.y;
  if(!gesture.moved&&Math.hypot(x,y)>=5){gesture.moved=true;if(gesture.mode!=='locked'){card.classList.add(gesture.mode==='resize'?'resizing':'dragging');api.dragStart(gesture.mode);}}
  if(gesture.moved&&gesture.mode!=='locked')api.dragMove(x,y);
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
document.getElementById('smaller').onclick=()=>api.resizeStep(-32);
document.getElementById('larger').onclick=()=>api.resizeStep(32);
document.getElementById('pin').onclick=()=>api.pin();
const resize=document.getElementById('resize');
resize.onkeydown=event=>{
  const delta={ArrowLeft:-16,ArrowDown:16,ArrowRight:16,ArrowUp:-16}[event.key];
  if(delta){event.preventDefault();api.resizeStep(delta);}
};
api.onState(state=>{
  const tr=value=>window.AstriaI18n.translate(value,state.language);
  document.documentElement.lang=state.language;
  document.documentElement.classList.toggle('light',state.theme==='light');
  document.documentElement.style.setProperty('--color',state.color);
  document.getElementById('name').textContent=state.name;
  document.getElementById('loading').textContent=state.ready?'':tr('Carregando…');
  pinned=state.pinned;card.classList.toggle('pinned',pinned);
  card.title=tr(pinned?'Clique para trocar.':'Clique para trocar. Arraste para mover.');
  card.setAttribute('aria-label',state.name+' · '+card.title);
  const corner=document.getElementById('corner');corner.title=tr('Mover para outro canto');corner.setAttribute('aria-label',corner.title);
  for(const [id,label] of Object.entries({smaller:'Diminuir janela',larger:'Aumentar janela',resize:'Redimensionar · arraste ou use as setas',pin:pinned?'Desafixar janela':'Fixar janela'})){
    const button=document.getElementById(id);button.title=tr(label);button.setAttribute('aria-label',button.title);
    if(id!=='pin')button.disabled=pinned;
  }
  corner.disabled=pinned;document.getElementById('pin').setAttribute('aria-pressed',String(pinned));
});
