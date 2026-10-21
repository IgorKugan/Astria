'use strict';
const api = window.multiNest;
const tr = value => window.AstriaI18n.translate(value, state?.preferences.language || 'en');
const h = (parts, ...values) => window.AstriaI18n.tag(parts, values, state?.preferences.language || 'en');
let state, statuses = {}, metrics = {}, queuedLayout = false, modalShowing = false, toastTimer, sidebarDrag;
const { hsvToHex, hexToHsv } = window.AstriaColor;
const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentWorkspace = () => state.workspaces.find(w => w.id === state.activeWorkspaceId);
const currentAccounts = () => state.accounts.filter(a => a.workspaceId === state.activeWorkspaceId);
const account = id => state.accounts.find(a => a.id === id);
const host = url => { try { return new URL(url).hostname; } catch { return url; } };
const activityLabel = a => ({always:tr('Sempre ativa'),visible:tr('Ativa quando visível'),suspended:tr('Suspensa · RAM liberada')}[a.activity] || tr('Ativa quando visível'));
const modeIcon = a => a.activity === 'always' ? '∞' : a.activity === 'suspended' ? 'Ⅱ' : '';
const layoutIcons = {auto:'▦',columns:'▥',rows:'☷',focus:'▣'};
const clampSidebar = width => Math.round(Math.max(44,Math.min(320,width)));
function applySidebar(width) {
  width = clampSidebar(width);
  document.documentElement.style.setProperty('--sidebar',width+'px');
  document.documentElement.classList.toggle('collapsed',width<100);
  el('sidebar-resizer').setAttribute('aria-valuenow',width);
  return width;
}
function themeToggle() {
  return h`<button class="theme-toggle" role="switch" aria-label="Tema escuro" aria-checked="${state.preferences.theme==='dark'}" data-action="theme" title="Alternar tema"><span aria-hidden="true">☀</span><span aria-hidden="true">☾</span><i class="theme-thumb"></i></button>`;
}
function updateCosts() {
  document.querySelectorAll('[data-cost]').forEach(node=>{
    const a=account(node.dataset.cost); if(!a)return;
    const m=a.activity==='suspended'?{ram:0,cpu:0,processes:0}:metrics[a.id];
    node.querySelector('.metric-ram').textContent=m?(m.ram>=1024?`~${(m.ram/1024).toFixed(1)} GB`:`~${m.ram} MB`):'— MB';
    node.querySelector('.metric-cpu').textContent=m?` · ${m.cpu.toFixed(1)}% CPU`:'';
    node.title=m?h`RAM aproximada dos processos da página: ${m.ram} MB. CPU: ${m.cpu.toFixed(1)}%. ${m.processes} processo(s).${m.shared?tr(' Processo compartilhado com outro painel.'):''} Não inclui o custo compartilhado do aplicativo e da GPU.`:tr('Aguardando medição dos processos da página.');
  });
}
function toast(message) {
  el('toast').textContent = message;
  el('toast').classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el('toast').classList.add('hidden'), 4500);
}
async function call(action, ...args) {
  try { const r = await action(...args); if (!r?.ok) toast(r?.error || tr('Não foi possível concluir.')); return r || {ok:false}; }
  catch (e) { toast(e.message); return {ok:false}; }
}
function panelStatus(id) {
  const status = statuses[id] || {};
  return status.error ? tr('Erro ao carregar') : status.queued ? tr('Aguardando carregamento…') : status.loading ? tr('Carregando…') : '';
}
function render() {
  if (!state) return;
  document.documentElement.lang = state.preferences.language || 'en';
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent=tr(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach(node => { node.setAttribute('aria-label',tr(node.dataset.i18nLabel)); });
  document.querySelectorAll('[data-i18n-title]').forEach(node => { node.title=tr(node.dataset.i18nTitle); });
  const workspace = currentWorkspace(), accounts = currentAccounts();
  document.documentElement.classList.toggle('light', state.preferences.theme === 'light');
  applySidebar(sidebarDrag?.width ?? state.preferences.sidebarWidth ?? 152);
  el('empty-theme').classList.toggle('hidden',accounts.length>0);
  el('empty-theme').setAttribute('aria-checked',state.preferences.theme==='dark');
  el('workspace-title').textContent = workspace.name;
  el('workspaces').innerHTML = state.workspaces.map(w => `<button class="workspace-item ${w.id===workspace.id?'active':''}" data-action="workspace" data-id="${esc(w.id)}" title="${esc(w.name)}"><span class="work-icon">${esc(w.name.slice(0,1).toUpperCase())}</span><span class="row-label">${esc(w.name)}</span><span class="workspace-count">${state.accounts.filter(a=>a.workspaceId===w.id).length}</span></button>`).join('');
  el('sidebar-accounts').innerHTML = accounts.map(a => h`<button class="account-link ${a.id===state.selectedAccountId?'active':''}" data-action="select" data-id="${esc(a.id)}" data-account="${esc(a.id)}" title="${esc(a.name)} · ${esc(activityLabel(a))}"><span class="color-dot" title="Escolher cor"></span><span class="row-label">${esc(a.name)}</span><span class="mode-icon">${modeIcon(a)}</span></button>`).join('') || h`<div class="sidebar-empty">Crie sua primeira conta.</div>`;
  document.querySelectorAll('.account-link[data-account]').forEach(node=>node.style.setProperty('--account-color',account(node.dataset.account).color));
  const grid=el('grid');
  grid.className='panel-grid '+(accounts.length?workspace.layout:'');
  if (!accounts.length) {
    grid.innerHTML=h`<div class="empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.6 6.6L22 12l-7.4 3.4L12 22l-2.6-6.6L2 12l7.4-3.4Z" fill="currentColor"/></svg><h2>Seu próximo espaço.</h2><p>Adicione um jogo. Cada conta tem seu próprio login e pode ter uma cor e um modo de atividade.</p><button class="primary" data-action="add-account">Criar conta</button></div>`;
    scheduleLayout(); return;
  }
  const shown=workspace.layout==='focus'?[accounts.find(a=>a.id===state.selectedAccountId)||accounts[0]]:accounts;
  grid.style.setProperty('--n',shown.length);
  grid.innerHTML=shown.map(a=>{
    const status=statuses[a.id]||{}, paused=a.activity==='suspended';
    return h`<article class="panel ${a.id===state.selectedAccountId?'selected':''}" data-panel="${esc(a.id)}" data-account="${esc(a.id)}">
      <header class="panel-head"><button class="color-button" data-action="color" data-id="${esc(a.id)}" title="Escolher cor" aria-label="Cor de ${esc(a.name)}"><span class="color-dot"></span></button><button class="panel-title" data-action="select" data-id="${esc(a.id)}" title="${esc(a.name)} · ${esc(host(a.url))}">${esc(a.name)}</button><span class="panel-state ${status.error?'error':status.loading?'loading':''}" title="${esc(status.error||panelStatus(a.id))}">${status.error?'!':status.loading?'◌':''}</span><span class="panel-cost" data-cost="${esc(a.id)}"><span class="metric-ram"></span><span class="metric-cpu"></span></span><div class="activity-controls" role="group" aria-label="Atividade de ${esc(a.name)}">${Object.entries({always:['∞',tr('Sempre ativa')],visible:['◉',tr('Ativa quando visível · descarrega após 1 minuto oculta')],suspended:['Ⅱ',tr('Suspender · liberar RAM')]}).map(([mode,[icon,label]])=>`<button data-action="activity" data-mode="${mode}" data-id="${esc(a.id)}" aria-label="${label}" title="${label}" aria-pressed="${a.activity===mode}">${icon}</button>`).join('')}</div><button class="icon-button layout-button" data-action="layout-menu" title="Layout dos painéis" aria-label="Layout dos painéis" aria-haspopup="menu">${layoutIcons[workspace.layout]}</button>${themeToggle()}<button class="icon-button reload-button" data-action="reload" data-id="${esc(a.id)}" title="Atualizar" aria-label="Atualizar ${esc(a.name)}">↻</button><button class="icon-button" data-action="account-menu" data-id="${esc(a.id)}" title="Opções da conta" aria-label="Opções de ${esc(a.name)}" aria-haspopup="menu">⋯</button></header>
      <div class="panel-body" ${paused?'':`data-slot="${esc(a.id)}"`}>${paused?h`<div class="panel-placeholder"><span class="sleep-mark">Ⅱ</span><strong>${esc(a.name)} está suspensa</strong><p>A página foi descarregada para liberar RAM. Retomar abre o jogo com o perfil salvo.</p><button class="secondary" data-action="resume" data-id="${esc(a.id)}">Retomar conta</button></div>`:h`<div class="panel-placeholder">Abrindo ${esc(a.name)}…</div>`}</div>
    </article>`;
  }).join('');
  document.querySelectorAll('.panel[data-account]').forEach(node=>node.style.setProperty('--account-color',account(node.dataset.account).color));
  updateCosts();
  scheduleLayout();
}
function scheduleLayout() {
  if(sidebarDrag)return;
  if(queuedLayout) return; queuedLayout=true;
  requestAnimationFrame(()=>{
    queuedLayout=false;
    const viewport=el('content').getBoundingClientRect();
    const rects=[...document.querySelectorAll('[data-slot]')].map(node=>{
      const r=node.getBoundingClientRect(); const x=Math.max(r.left,viewport.left), y=Math.max(r.top,viewport.top);
      return {id:node.dataset.slot,x,y,width:Math.min(r.right,viewport.right)-x,height:Math.min(r.bottom,viewport.bottom)-y};
    }).filter(r=>r.width>=100&&r.height>=75);
    api.layout(rects);
  });
}
function modal(markup, ready) {
  modalShowing=true; api.setOverlay(true);
  const root=el('modal-root'); root.classList.remove('hidden');
  root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${markup}</section>`;
  root.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
  ready?.(root.querySelector('.modal'));
  if(!root.contains(document.activeElement)) root.querySelector('input,button')?.focus();
}
function closeModal() {
  const root=el('modal-root'); root.classList.add('hidden'); root.innerHTML=''; modalShowing=false; api.setOverlay(false); scheduleLayout();
}

function chooseColor(a) {
  let hsv=hexToHsv(a.color)||{h:0,s:1,v:1};
  modal(h`<h2 id="modal-title">Cor de ${esc(a.name)}</h2><p class="sub">Arraste na roda para escolher o tom e ajuste o brilho.</p><form id="color-form"><div class="color-wheel-wrap"><div id="color-wheel" class="color-wheel" role="slider" tabindex="0" aria-label="Matiz e saturação" aria-valuemin="0" aria-valuemax="360"><div class="wheel-shade"></div><span class="wheel-knob"></span></div></div><div class="field"><label for="color-brightness">Brilho</label><input id="color-brightness" type="range" min="0" max="100" value="${Math.round(hsv.v*100)}"></div><div class="color-value-row"><span id="color-preview" class="color-preview"></span><div class="field"><label for="color-hex">Cor hexadecimal</label><input id="color-hex" pattern="#[0-9A-Fa-f]{6}" maxlength="7" required value="${esc(a.color)}" autocomplete="off" spellcheck="false"></div></div><div class="modal-actions"><button type="button" class="secondary" data-close>Cancelar</button><button type="submit" class="primary">Salvar cor</button></div></form>`,dialog=>{
    const wheel=el('color-wheel'),hex=el('color-hex');
    function update(syncHex=true){
      const value=hsvToHex(hsv.h,hsv.s,hsv.v),r=hsv.h*Math.PI/180;
      wheel.querySelector('.wheel-knob').style.left=(50+Math.cos(r)*hsv.s*50)+'%';
      wheel.querySelector('.wheel-knob').style.top=(50+Math.sin(r)*hsv.s*50)+'%';
      wheel.querySelector('.wheel-shade').style.opacity=1-hsv.v;
      el('color-preview').style.backgroundColor=value;
      el('color-brightness').value=Math.round(hsv.v*100);
      wheel.setAttribute('aria-valuenow',Math.round(hsv.h));
      wheel.setAttribute('aria-valuetext',h`Matiz ${Math.round(hsv.h)} graus, saturação ${Math.round(hsv.s*100)}%`);
      if(syncHex)hex.value=value;
    }
    function point(e){const b=wheel.getBoundingClientRect(),x=e.clientX-b.left-b.width/2,y=e.clientY-b.top-b.height/2;hsv.h=(Math.atan2(y,x)*180/Math.PI+360)%360;hsv.s=Math.min(1,Math.hypot(x,y)/(b.width/2));update();}
    wheel.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();wheel.focus();wheel.setPointerCapture(e.pointerId);point(e);};
    wheel.onpointermove=e=>{if(wheel.hasPointerCapture(e.pointerId))point(e);};
    wheel.onpointerup=e=>{if(wheel.hasPointerCapture(e.pointerId))wheel.releasePointerCapture(e.pointerId);};
    wheel.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')hsv.h=(hsv.h+355)%360;if(e.key==='ArrowRight')hsv.h=(hsv.h+5)%360;if(e.key==='ArrowUp')hsv.s=Math.min(1,hsv.s+.05);if(e.key==='ArrowDown')hsv.s=Math.max(0,hsv.s-.05);update();};
    el('color-brightness').oninput=e=>{hsv.v=Number(e.target.value)/100;update();};
    hex.oninput=()=>{const next=hexToHsv(hex.value);if(next){hsv=next;update(false);}};
    dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(!hexToHsv(hex.value))return;if((await call(api.accountColor,a.id,hex.value)).ok)closeModal();};
    update();wheel.focus();
  });
}
el('modal-root').addEventListener('click',e=>{if(e.target===el('modal-root'))closeModal();});
function accountForm(existing) {
  const editing=!!existing, defaultURL=existing?.url||currentAccounts()[0]?.url||'';
  modal(h`<h2 id="modal-title">${editing?tr('Editar endereço'):tr('Criar conta')}</h2><p class="sub">Escolha um nome e o endereço do jogo. O login fica separado das outras contas.</p><form id="account-form"><div class="field"><label for="account-name">Nome</label><input id="account-name" maxlength="55" required autocomplete="off" placeholder="Nome do personagem" value="${esc(existing?.name||'')}"></div><div class="field"><label for="account-url">Endereço</label><input id="account-url" maxlength="2048" required autocomplete="off" placeholder="https://site-do-jogo.com" value="${esc(defaultURL)}"></div><div class="modal-actions"><button class="secondary" type="button" data-close>Cancelar</button><button class="primary" type="submit">${editing?tr('Salvar'):tr('Criar conta')}</button></div></form>`,dialog=>{
    dialog.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const data={name:el('account-name').value,url:el('account-url').value};const r=editing?await call(api.accountEdit,existing.id,data):await call(api.accountAdd,data);if(r.ok)closeModal();});
    el('account-name').focus();
  });
}
function renameAccount(a) {
  modal(h`<h2 id="modal-title">Renomear conta</h2><form id="rename-form"><div class="field"><label for="rename-name">Nome da conta</label><input id="rename-name" maxlength="55" required autocomplete="off" value="${esc(a.name)}"></div><div class="modal-actions"><button class="secondary" type="button" data-close>Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`,dialog=>{
    dialog.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();if((await call(api.accountRename,a.id,el('rename-name').value)).ok)closeModal();});el('rename-name').select();
  });
}
function workspaceForm(editing=false) {
  const w=currentWorkspace();
  modal(h`<h2 id="modal-title">${editing?tr('Editar espaço'):tr('Novo espaço')}</h2><form id="workspace-form"><div class="field"><label for="workspace-name">Nome</label><input id="workspace-name" maxlength="55" required autocomplete="off" value="${esc(editing?w.name:'')}" placeholder="Nome do jogo ou grupo"></div><div class="modal-actions">${editing?h`<button id="delete-workspace" class="danger" type="button">Excluir</button>`:''}<button class="secondary" type="button" data-close>Cancelar</button><button class="primary" type="submit">${editing?tr('Salvar'):tr('Criar espaço')}</button></div></form>`,dialog=>{
    dialog.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const r=editing?await call(api.workspaceRename,w.id,el('workspace-name').value):await call(api.workspaceAdd,el('workspace-name').value);if(r.ok)closeModal();});
    if(editing)el('delete-workspace').onclick=()=>confirmDelete(w,true);
    el('workspace-name').focus();
  });
}
function confirmDelete(item,workspace=false) {
  modal(h`<h2 id="modal-title">Remover ${esc(item.name)}?</h2><p class="sub">${workspace?tr('Os painéis deste espaço serão removidos.'):tr('O painel será removido.')} Os perfis e logins salvos no computador serão preservados.</p><div class="modal-actions"><button class="secondary" data-close>Cancelar</button><button class="danger" id="confirm-delete">Remover</button></div>`,()=>{el('confirm-delete').onclick=async()=>{if((await call(workspace?api.workspaceDelete:api.accountDelete,item.id)).ok)closeModal();};});
}
function confirmImport() {
  modal(h`<h2 id="modal-title">Importar configuração</h2><p class="sub">Substitui a lista atual de espaços e contas. O arquivo não inclui cookies nem senhas.</p><div class="modal-actions"><button class="secondary" data-close>Cancelar</button><button class="primary" id="confirm-import">Escolher arquivo</button></div>`,()=>{el('confirm-import').onclick=async()=>{const r=await call(api.import);if(r.ok){closeModal();if(!r.canceled)toast(tr('Configuração importada.'));}};});
}
function performanceHelp() {
  modal(h`<h2 id="modal-title">Atividade das contas</h2>
    <p class="sub"><strong>Sempre ativa</strong><br>Mantém a página carregada e os timers ativos ao trocar de conta ou espaço. Usa mais recursos.</p>
    <p class="sub"><strong>Ativa quando visível</strong><br>Reduz a atividade quando oculta. Após um minuto, descarrega a página para liberar RAM. Ao voltar, o jogo reconecta.</p>
    <p class="sub"><strong>Suspensa</strong><br>Descarrega imediatamente. Use Retomar conta para abrir novamente com o perfil salvo.</p>
    <p class="small-note">O cache dos jogos é separado por conta e fica dentro de Save. Várias contas ativas dividem os recursos da CPU e da GPU.</p>
    <p class="small-note">Sempre ativa mantém o desenho e as atualizações ao trocar de conta ou espaço. Quando a janela é minimizada, o jogo recebe o estado normal de página oculta do navegador.</p>
    <p class="small-note">Descarregar pode interromper a atividade online do jogo. A progressão offline depende de cada jogo. Escolha o modo no botão direito da conta.</p>
    <div class="modal-actions"><button class="primary" data-close>Entendi</button></div>`);
}
function updateDialog() {
  modal(h`<h2 id="modal-title">Atualizar Astria</h2><p id="update-status" class="sub" role="status">Verificando a última versão no GitHub…</p><p class="small-note">O download é verificado com a assinatura do Astria. Seus perfis e a pasta Save são preservados. Reiniciar desconecta temporariamente os jogos.</p><div class="modal-actions"><button class="secondary" data-close>Fechar</button><button id="update-action" class="primary" disabled>Verificando…</button></div>`, async () => {
    const button=el('update-action'),status=el('update-status');
    const result=await api.updateCheck();
    if(!button.isConnected)return;
    if(!result.ok){status.textContent=result.error;button.textContent=tr('Tentar novamente');button.disabled=false;button.onclick=updateDialog;return;}
    if(!result.available){status.textContent=h`Astria ${result.version} está atualizado.`;button.classList.add('hidden');return;}
    status.textContent=h`Versão ${result.version} disponível · ${(result.size/1048576).toFixed(0)} MB.`;
    button.disabled=false;button.textContent=tr('Baixar atualização');
    button.onclick=async()=>{
      button.disabled=true;button.textContent=tr('Baixando…');status.textContent=tr('Baixando e verificando os arquivos…');
      const result=await api.updateDownload();
      if(!button.isConnected)return;
      if(!result.ok){status.textContent=result.error;button.textContent=tr('Tentar novamente');button.disabled=false;button.onclick=updateDialog;return;}
      status.textContent=h`Versão ${result.version} verificada. A versão anterior ficará em Save/Backups.`;
      button.textContent=tr('Reiniciar e atualizar');button.disabled=false;
      button.onclick=async()=>{button.disabled=true;const result=await call(api.updateInstall);if(!result.ok)button.disabled=false;};
    };
  });
}
function menuFor(id,point) { call(api.accountMenu,id,point); }
el('app-menu').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();call(api.appMenu,{x:r.right,y:r.bottom});};
el('add-workspace').onclick=()=>workspaceForm();
el('add-account').onclick=()=>accountForm();

const resizer=el('sidebar-resizer');
resizer.addEventListener('pointerdown',e=>{
  if(e.button!==0||modalShowing)return;
  e.preventDefault();resizer.focus();
  // Some remote Windows desktops cannot acquire pointer capture. The document
  // handlers below keep dragging functional there without aborting pointerdown.
  try { resizer.setPointerCapture(e.pointerId); } catch { /* document fallback */ }
  const width=el('sidebar-accounts').parentElement.getBoundingClientRect().width;
  sidebarDrag={x:e.clientX,start:width,width,pointer:e.pointerId};
  document.documentElement.classList.add('resizing');
  // Temporarily hide native game surfaces so dragging cannot land inside a game.
  // Views stay loaded; only the final width is persisted and applied to them.
  api.setOverlay(true);
});
document.addEventListener('pointermove',e=>{
  if(sidebarDrag)sidebarDrag.width=applySidebar(sidebarDrag.start+e.clientX-sidebarDrag.x);
});
async function finishSidebarDrag(cancel=false){
  if(!sidebarDrag)return;
  const drag=sidebarDrag;sidebarDrag=undefined;
  if(resizer.hasPointerCapture(drag.pointer))resizer.releasePointerCapture(drag.pointer);
  document.documentElement.classList.remove('resizing');
  if(cancel)applySidebar(drag.start);
  else await call(api.sidebarWidth,drag.width);
  api.setOverlay(false);scheduleLayout();
}
document.addEventListener('pointerup',()=>finishSidebarDrag());
document.addEventListener('pointercancel',()=>finishSidebarDrag(true));
resizer.addEventListener('lostpointercapture',()=>finishSidebarDrag());
resizer.addEventListener('keydown',e=>{
  const width=Number(resizer.getAttribute('aria-valuenow'));
  const next={ArrowLeft:width-(e.shiftKey?32:8),ArrowRight:width+(e.shiftKey?32:8),Home:44,End:320}[e.key];
  if(next!==undefined){e.preventDefault();call(api.sidebarWidth,clampSidebar(next));}
});
document.body.addEventListener('click',e=>{
  const dot=e.target.closest('.account-link .color-dot');
  if(dot){chooseColor(account(dot.closest('[data-account]').dataset.account));return;}
  const b=e.target.closest('[data-action]');if(!b||!state)return;const id=b.dataset.id;
  const actions={workspace:()=>call(api.workspaceSelect,id),select:()=>call(api.accountSelect,id),'add-account':()=>accountForm(),reload:()=>call(api.reload,id),resume:()=>call(api.accountActivity,id,'visible'),activity:()=>call(api.accountActivity,id,b.dataset.mode),color:()=>chooseColor(account(id)),theme:()=>call(api.theme,state.preferences.theme==='dark'?'light':'dark'),'layout-menu':()=>{const r=b.getBoundingClientRect();call(api.layoutMenu,{x:r.left,y:r.bottom});},'account-menu':()=>{const r=b.getBoundingClientRect();menuFor(id,{x:r.right,y:r.bottom});}};
  actions[b.dataset.action]?.();
});
document.body.addEventListener('contextmenu',e=>{
  const target=e.target.closest('[data-account]');if(target){e.preventDefault();menuFor(target.dataset.account,{x:e.clientX,y:e.clientY});}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&sidebarDrag){finishSidebarDrag(true);return;}
  if(e.key==='Escape'&&modalShowing){closeModal();return;}
  if(modalShowing){
    if(e.key==='Tab'){const nodes=[...el('modal-root').querySelectorAll('input,button,[tabindex="0"]')];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    return;
  }
  if(e.key==='F5'||(e.ctrlKey&&e.key.toLowerCase()==='r')){e.preventDefault();if(state.selectedAccountId)call(api.reload,state.selectedAccountId);}
});
window.addEventListener('resize',scheduleLayout);
el('content').addEventListener('scroll',scheduleLayout,{passive:true});
api.onResize(scheduleLayout);
api.onState(next=>{state=next;render();});
api.onStatus(event=>{
  statuses[event.id]=event;
  const node=document.querySelector(`[data-panel="${event.id}"] .panel-state`);
  if(node&&account(event.id)?.activity!=='suspended'){
    node.textContent=event.error?'!':event.queued?'◷':event.loading?'◌':'';
    node.classList.toggle('error',!!event.error);node.classList.toggle('loading',!!event.loading);node.title=event.error||panelStatus(event.id);
    const placeholder=document.querySelector(`[data-panel="${event.id}"] .panel-placeholder`);
    if(placeholder)placeholder.textContent=event.queued?tr('Aguardando carregamento…'):h`Abrindo ${account(event.id).name}…`;
  }
});
api.onMetrics(next=>{metrics=next;updateCosts();});
api.onToast(toast);
api.onUpdateProgress(percent=>{const node=el('update-status');if(node)node.textContent=h`Baixando e verificando os arquivos… ${percent}%`;});
api.onCommand(({type,id})=>{
  const commands={'add-account':()=>accountForm(),'rename-account':()=>renameAccount(account(id)),'account-color':()=>chooseColor(account(id)),'edit-account':()=>accountForm(account(id)),'delete-account':()=>confirmDelete(account(id)),'add-workspace':()=>workspaceForm(),'edit-workspace':()=>workspaceForm(true),import:confirmImport,'performance-help':performanceHelp,updates:updateDialog};commands[type]?.();
});
api.getState().then(r=>{if(r?.ok){state=r.state;statuses=r.statuses||{};render();}else toast(tr('Não foi possível carregar a configuração.'));});
