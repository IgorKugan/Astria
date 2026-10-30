'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { _electron: electron } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-'));
const errors = [];
let application, page;
const server = http.createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="pt-BR"><title>Teste de sessão MultiNest</title><body style="font:18px system-ui;padding:24px;background:#f1f5fa"><h1>Sessão independente</h1><p>Página local para verificar cookies e armazenamento.</p><input placeholder="Teste de digitação"><button onclick="window.open(location.href)">Abrir popup</button></body></html>');
});
async function waitUntil(fn, description) {
  const limit = Date.now() + 20000;
  while (Date.now() < limit) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timeout: ' + description);
}
async function launch() {
  const env = { ...process.env, MULTINEST_USER_DATA: profile, ASTRIA_IDLE_MS: '500' };
  delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ executablePath: process.env.MULTINEST_TEST_EXE || require('electron'), args: process.env.MULTINEST_TEST_EXE ? ['--user-data-dir=' + profile] : [root], env });
  page = await application.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('#grid .empty, #grid .panel');
  assert.equal(await application.evaluate(({app})=>app.getPath('userData')),profile,'isolated test profile');
  await application.evaluate(({Menu})=>{Menu.prototype.popup=function(){globalThis.testMenu=this;};});
}
async function appMenu(...labels) {
  await page.click('#app-menu');
  await clickMenu(labels);
}
async function clickMenu(labels) {
  await application.evaluate(({BaseWindow},labels)=>{
    let menu=globalThis.testMenu,item;
    for(const label of labels){item=menu.items.find(i=>i.label===label);if(!item)throw new Error('Menu item missing: '+label);menu=item.submenu;}
    item.click(item,BaseWindow.getAllWindows()[0],{});
  },labels);
}
async function allSiteContents() {
  return application.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>w.getURL().startsWith('http://127.0.0.1:')).map(w=>({id:w.id,throttled:w.getBackgroundThrottling()})));
}
async function getViews() {
  return application.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows()[0].contentView.children
    .filter(v => v.webContents && v.onScreen).map(v => ({ id: v.webContents.id, bounds: v.getBounds(), url: v.webContents.getURL() })));
}
async function inView(id, script) {
  return application.evaluate(({ webContents }, { id, script }) => new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Timed out reading fixture page')),20000);
    webContents.fromId(id).executeJavaScript(script).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  }), { id, script });
}
async function addAccount(name, url) {
  await page.click('#add-account');
  await page.fill('#account-name', name);
  await page.fill('#account-url', url);
  await page.click('#account-form button[type=submit]');
  await page.waitForSelector('#modal-root.hidden', { state: 'attached' });
}
async function dragSidebar(from, to) {
  if(process.env.CI){
    // Hosted Windows runners can revoke OS pointer capture while native views
    // detach. Exercise the document-level fallback with DOM pointer events;
    // local runs retain the real mouse drag below.
    await page.evaluate(({from,to})=>{
      const edge=document.querySelector('#sidebar-resizer');
      edge.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerId:77,clientX:from.x,clientY:from.y}));
      document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,buttons:1,pointerId:77,clientX:to.x,clientY:to.y}));
      document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,buttons:0,pointerId:77,clientX:to.x,clientY:to.y}));
    },{from,to});
  }else{
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();
  }
}
async function readStorage(id) {
  return inView(id, `(async () => ({ cookie: document.cookie, local: localStorage.getItem('identity'), indexed: await new Promise((resolve, reject) => { const r = indexedDB.open('isolation'); r.onsuccess = () => { const db = r.result; if(!db.objectStoreNames.contains("data")){db.close();reject(new Error("Fixture storage is missing"));return;} const q = db.transaction('data').objectStore('data').get('identity'); q.onsuccess = () => { resolve(q.result); db.close(); }; q.onerror = () => reject(q.error); }; r.onerror = () => reject(r.error); }), cache: await (await (await caches.open('isolation')).match('/identity')).text(), node: typeof require, bridge: typeof window.multiNest }))()`);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  await launch();
  assert.equal(await page.getAttribute('html','lang'),'en');
  assert.equal(await page.locator('[data-i18n="Contas"]').textContent(),'Accounts');
  await appMenu('Language','Português (Brasil)');
  await page.waitForFunction(()=>document.documentElement.lang==='pt-BR');
  for (let i = 1; i <= 2; i++) await addAccount('Conta ' + i, url + '#fixture-' + i);
  await waitUntil(async () => (await getViews()).length === 2, 'two browser panels');
  let views = await getViews();
  assert.equal(await application.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())).some(w=>w.debugger.isAttached())),false,'native cache does not attach the asset debugger');
  for (let i = 0; i < views.length; i++) {
    await waitUntil(async () => (await inView(views[i].id, 'document.readyState')) === 'complete', 'loaded panel');
    const identity = 'account-' + i;
    await inView(views[i].id, `(async () => {
      const fixture = location.hash.match(/^#fixture-(\\d+)$/);
      if (!fixture) throw new Error('Missing fixture identity');
      const identity = 'account-' + (Number(fixture[1]) - 1);
      document.cookie = 'identity=' + identity + '; Max-Age=86400; Path=/';
      localStorage.setItem('identity', identity);
      await new Promise((resolve, reject) => {
        const r = indexedDB.open('isolation', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('data');
        r.onsuccess = () => {
          const db = r.result, t = db.transaction('data', 'readwrite');
          t.objectStore('data').put(identity, 'identity');
          t.oncomplete = () => { db.close(); resolve(); };
          t.onerror = () => reject(t.error);
        };
        r.onerror = () => reject(r.error);
      });
      await (await caches.open('isolation')).put('/identity', new Response(identity));
      return true;
    })()`);
    const result = await readStorage(views[i].id);
    assert.deepEqual(result, { cookie: 'identity=' + identity, local: identity, indexed: identity, cache: identity, node: 'undefined', bridge: 'undefined' });
  }
  console.log('PASS: real cookies, localStorage, IndexedDB, CacheStorage and no Node/bridge in game panels');
  for (const [layout,label] of Object.entries({auto:'Grade automática',columns:'Colunas',rows:'Linhas',focus:'Uma conta por vez'})) {
    await appMenu('Layout',label);
    await waitUntil(async () => (await getViews()).length === (layout === 'focus' ? 1 : 2), layout);
    const bounds = (await getViews()).map(v => v.bounds);
    assert.ok(bounds.every(b => b.width >= 100 && b.height >= 75));
    await page.screenshot({ path: path.join(output, 'layout-' + layout + '.png') });
  }
  await appMenu('Layout','Grade automática');
  await page.locator('.panel .theme-toggle').first().click();
  await page.waitForFunction(()=>document.documentElement.classList.contains('light'));
  assert.equal(await page.locator('html').getAttribute('class'), 'light');
  await page.screenshot({ path: path.join(output, 'theme-light.png') });
  assert.equal(await page.locator('.panel .theme-toggle').first().getAttribute('aria-checked'),'false');
  await page.locator('.panel .theme-toggle').first().click();
  await page.waitForFunction(()=>!document.documentElement.classList.contains('light'));
  const firstLink=page.locator('.account-link').first();
  await page.evaluate(()=>window.multiNest.sidebarWidth(44));
  await firstLink.locator('.color-dot').click();
  assert.equal(await page.locator('#modal-root').evaluate(node=>node.classList.contains('hidden')),true,'left-clicking a collapsed color dot selects without opening customization');
  assert.equal((await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId,await firstLink.getAttribute('data-account'));
  await page.evaluate(()=>window.multiNest.sidebarWidth(152));
  await firstLink.click({button:'right'});
  await clickMenu(['Renomear conta…']);
  await page.fill('#rename-name','Minha conta');
  await page.click('#rename-form button[type=submit]');
  await page.waitForSelector('#modal-root.hidden',{state:'attached'});
  await firstLink.click({button:'right'});
  await clickMenu(['Escolher cor…']);
  await page.waitForSelector('#color-wheel');
  const wheel=await page.locator('#color-wheel').boundingBox();
  const colorBefore=await page.inputValue('#color-hex');
  await page.mouse.move(wheel.x+wheel.width*.75,wheel.y+wheel.height*.5);
  await page.mouse.down();await page.mouse.move(wheel.x+wheel.width*.5,wheel.y+wheel.height*.85,{steps:8});await page.mouse.up();
  assert.notEqual(await page.inputValue('#color-hex'),colorBefore,'wheel drag changes hue/saturation');
  await page.fill('#color-hex','#123abc');
  await page.screenshot({path:path.join(output,'color-wheel.png')});
  await page.click('#color-form button[type=submit]');
  await page.waitForSelector('#modal-root.hidden',{state:'attached'});
  assert.equal((await page.evaluate(()=>window.multiNest.getState())).state.accounts[0].color,'#123abc');
  assert.equal(await firstLink.innerText(),'Minha conta');
  const chrome=await page.evaluate(()=>({header:document.querySelector('.titlebar').getBoundingClientRect().height,sidebar:document.querySelector('.sidebar').getBoundingClientRect().width,footers:document.querySelectorAll('footer').length}));
  assert.deepEqual(chrome,{header:36,sidebar:152,footers:0});
  assert.equal(await page.locator('#sidebar-toggle').count(),0,'logo no longer toggles sidebar');
  const edge=await page.locator('#sidebar-resizer').boundingBox();
  await page.evaluate(()=>{
    globalThis.resizeTrace=[];
    for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.querySelector('#sidebar-resizer').addEventListener(type,event=>globalThis.resizeTrace.push({type,x:event.clientX,buttons:event.buttons,width:document.querySelector('.sidebar').getBoundingClientRect().width}));
  });
  await dragSidebar({x:edge.x+edge.width/2,y:edge.y+70},{x:edge.x-108,y:edge.y+70});
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width===44);
  await page.screenshot({path:path.join(output,'sidebar-collapsed.png')});
  const narrowEdge=await page.locator('#sidebar-resizer').boundingBox();
  await dragSidebar({x:narrowEdge.x+narrowEdge.width/2,y:narrowEdge.y+70},{x:narrowEdge.x+narrowEdge.width/2+184,y:narrowEdge.y+70});
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width===228);
  assert.equal((await page.evaluate(()=>window.multiNest.getState())).state.preferences.sidebarWidth,228);
  await page.locator('#sidebar-resizer').focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width===236);
  await page.evaluate(()=>window.multiNest.sidebarWidth(152));
  await waitUntil(async()=>await page.locator('.metric-ram').first().innerText()!=='— MB','page memory metric');
  assert.match(await page.locator('.metric-ram').first().innerText(),/^~\d/);
  assert.match(await page.locator('.metric-cpu').first().innerText(),/CPU/);
  assert.deepEqual(await page.locator('.activity-controls').first().locator('button').evaluateAll(buttons=>buttons.map(b=>b.dataset.mode)),['always','adaptive','visible','suspended'],'four activity buttons in requested order');
  assert.match(await page.locator('[data-mode="visible"]').first().getAttribute('title'),/5 minutos/);
  await page.locator('[data-mode="adaptive"]').first().click();
  await page.waitForSelector('[data-mode="adaptive"][aria-pressed="true"]');
  await firstLink.click({button:'right'});await clickMenu(['Atividade','Economia de energia']);
  await page.waitForSelector('[data-mode="eco"][aria-pressed="true"]');
  await firstLink.click({button:'right'});await clickMenu(['Atividade','FPS em economia','5 FPS']);
  await page.waitForFunction(()=>document.querySelector('[data-mode="eco"][aria-pressed="true"]').title.includes('5 FPS'));
  await appMenu('Desempenho','Sobre os modos…');
  await page.waitForSelector('#modal-root:not(.hidden)');
  assert.match(await page.locator('#modal-root').textContent(),/Preserva dados, sessões/);
  await page.keyboard.press('Escape');
  await firstLink.click({button:'right'});await clickMenu(['Atividade','FPS em economia','10 FPS']);
  await page.waitForFunction(()=>document.querySelector('[data-mode="eco"][aria-pressed="true"]').title.includes('10 FPS'));
  await page.locator('[data-mode="visible"]').first().click();
  // The runner may have a small desktop: use the compact app-menu fallback.
  if (await page.locator('.layout-button').first().isVisible()) {
    await page.locator('.layout-button').first().click();await clickMenu(['Colunas']);
  } else await appMenu('Layout','Colunas');
  await page.waitForSelector('.panel-grid.columns');
  // Narrow columns move the optional header control into the app menu.
  if (await page.locator('.layout-button').first().isVisible()) {
    await page.locator('.layout-button').first().click();await clickMenu(['Grade automática']);
  } else await appMenu('Layout','Grade automática');
  await page.click('#add-account');
  await waitUntil(async () => (await getViews()).length === 0, 'modal covers native panels');
  await page.keyboard.press('Escape');
  await waitUntil(async () => (await getViews()).length === 2, 'panels restored after modal');
  const window = await application.browserWindow(page);
  await window.evaluate(w => w.setSize(900, 600));
  await page.screenshot({ path: path.join(output, 'window-900x600.png') });
  await window.evaluate(w => w.setSize(1500, 950));
  await application.evaluate(({app})=>{const original=app.getAppMetrics.bind(app);globalThis.metricReads=0;app.getAppMetrics=()=>{globalThis.metricReads++;return original();};});
  await window.evaluate(w=>w.minimize());
  await page.waitForTimeout(2800);
  assert.equal(await application.evaluate(()=>globalThis.metricReads),0,'metrics polling stops while minimized');
  await window.evaluate(w=>w.restore());
  await waitUntil(async()=>await application.evaluate(()=>globalThis.metricReads)>0,'metrics resume after restore');
  await page.click('#add-workspace');
  await page.fill('#workspace-name', 'Outro espaço');
  await page.click('#workspace-form button[type=submit]');
  await page.waitForSelector('#grid .empty');
  assert.equal((await getViews()).length, 0);
  const ids=(await page.evaluate(()=>window.multiNest.getState())).state.accounts.map(a=>a.id);
  // Returning to the workspace restores a sleeping page from the same partition.
  if(!process.env.MULTINEST_TEST_EXE)await waitUntil(async()=>(await allSiteContents()).length===0,'hidden pages unloaded');
  await page.click('[data-action="workspace"][data-id="games"]');
  await waitUntil(async () => (await getViews()).length === 2, 'workspace restored');
  console.log('PASS: compact chrome, toolbar layouts, wheel colors, theme switch, resize drag, keyboard width and page metrics');
  await page.locator('.activity-controls').first().locator('[data-mode="always"]').click();
  await page.locator('.activity-controls').nth(1).locator('[data-mode="suspended"]').click();
  await waitUntil(async()=>(await allSiteContents()).length===1,'suspended page destroyed');
  assert.ok(await page.getByText('está suspensa',{exact:false}).isVisible());
  const running=await allSiteContents();assert.equal(running[0].throttled,false,'always active is not throttled');
  await page.click('[data-action="resume"]');
  await waitUntil(async()=>(await getViews()).length===2,'manual resume');
  const resumed=(await getViews())[1];
  await waitUntil(async()=>(await inView(resumed.id,'document.readyState'))==='complete','resumed page');
  assert.equal((await readStorage(resumed.id)).cookie,'identity=account-1');
  await page.click('.workspace-item:not(.active)');
  if(!process.env.MULTINEST_TEST_EXE)await waitUntil(async()=>(await allSiteContents()).length===1,'visible-only unloaded, always-active retained');
  await page.click('[data-action="workspace"][data-id="games"]');
  await waitUntil(async()=>(await getViews()).length===2,'restore workspace with mixed modes');
  console.log('PASS: always-active retained, manual suspension destroys renderer, resume preserves cookies');
  const firstId = (await page.evaluate(() => window.multiNest.getState())).state.accounts[0].id;
  assert.equal((await page.evaluate(id => window.multiNest.zoom(id, 0.1), firstId)).ok, true);
  const audio = page.locator(`.audio-toggle[data-id="${firstId}"]`);
  assert.equal(await audio.getAttribute('aria-pressed'), 'true');
  assert.equal(await audio.getAttribute('title'), 'Silenciar');
  assert.equal(await audio.getAttribute('aria-label'), 'Áudio de Minha conta');
  assert.equal(await audio.evaluate(button => button.previousElementSibling.classList.contains('panel-cost')), true, 'audio sits beside page performance');
  views = await getViews();
  const nativeAudio = () => application.evaluate(({ webContents }, ids) => ids.map(id => webContents.fromId(id).isAudioMuted()), views.map(v => v.id));
  await audio.click();
  await waitUntil(async () => await audio.getAttribute('aria-pressed') === 'false', 'mute icon');
  assert.equal(await audio.getAttribute('title'), 'Ativar áudio');
  assert.deepEqual(await nativeAudio(), [true, false], 'mute only the selected account');
  await inView(views[0].id, 'document.querySelector("button").click()');
  await waitUntil(async () => await application.evaluate(({ BaseWindow }) => BaseWindow.getAllWindows().length === 2), 'account popup');
  const popup = await application.evaluateHandle(({ BaseWindow }) => BaseWindow.getAllWindows().find(w => w.getParentWindow()));
  assert.equal(await popup.evaluate(w => w.webContents.isAudioMuted()), true, 'new popup inherits account mute');
  await audio.click();
  await waitUntil(async () => await audio.getAttribute('aria-pressed') === 'true', 'unmute icon');
  assert.deepEqual(await nativeAudio(), [false, false]);
  assert.equal(await popup.evaluate(w => w.webContents.isAudioMuted()), false, 'existing popup follows account audio');
  await audio.click();
  await waitUntil(async () => await audio.getAttribute('aria-pressed') === 'false', 'saved mute setting');
  assert.equal(await popup.evaluate(w => w.webContents.isAudioMuted()), true);
  await page.screenshot({ path: path.join(output, 'audio-controls.png') });
  await popup.evaluate(w => w.close());
  console.log('PASS: header mute/unmute controls native account audio and owned popups independently');
  await application.evaluate(async ({ webContents }) => { for (const contents of webContents.getAllWebContents()) await contents.session.flushStorageData(); });
  await application.close(); application = null;
  await launch();
  await waitUntil(async () => (await getViews()).length === 2, 'restored panels after restart');
  views = await getViews();
  for (let i = 0; i < views.length; i++) {
    await waitUntil(async () => (await inView(views[i].id, 'document.readyState')) === 'complete', 'restored page');
    const result = await readStorage(views[i].id);
    assert.equal(result.local, 'account-' + i);
    assert.equal(result.cookie, 'identity=account-' + i);
    assert.equal(result.indexed, 'account-' + i);
    assert.equal(result.cache, 'account-' + i);
  }
  const restored = (await page.evaluate(() => window.multiNest.getState())).state;
  assert.equal(restored.preferences.language,'pt-BR','chosen language survives restart');
  assert.equal(await application.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())).some(w=>w.debugger.isAttached())),false,'native networking remains free of asset interception after restart');
  const idsBeforeLanguage=restored.accounts.map(a=>a.id);
  const restoredFirstLink=page.locator('.account-link').first();
  await appMenu('Idioma','English');
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal(await page.locator('.audio-toggle').first().getAttribute('title'), 'Unmute');
  assert.equal(await page.locator('.audio-toggle').first().getAttribute('aria-label'), 'Audio for Minha conta');
  assert.equal(await page.locator('.audio-toggle').first().getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('[data-i18n="Contas"]').textContent(),'Accounts');
  const englishState=(await page.evaluate(()=>window.multiNest.getState())).state;
  assert.deepEqual(englishState.accounts.map(a=>a.id),idsBeforeLanguage,'language switch preserves account identities');
  assert.equal(await restoredFirstLink.locator('.row-label').innerText(),'Minha conta','custom account name is never translated');
  await restoredFirstLink.click({button:'right'});await clickMenu(['Rename account…']);
  await page.waitForSelector('#rename-name');
  assert.equal(await page.locator('#modal-title').innerText(),'Rename account');
  await page.click('[data-close]');
  await appMenu('Language','Português (Brasil)');
  assert.equal(restored.accounts[0].zoom, 1.1);
  assert.equal(restored.accounts[0].muted, true);
  assert.equal(restored.accounts[0].name,'Minha conta');
  assert.equal(restored.accounts[0].color,'#123abc');
  assert.equal(restored.accounts[0].activity,'always');
  assert.equal(restored.preferences.sidebarWidth,152);
  console.log('PASS: sessions, zoom and mute persist after application restart');
  assert.deepEqual(errors, [], 'renderer errors');
  fs.writeFileSync(path.join(output, 'astria-e2e-report.json'), JSON.stringify({ passed: true, profile, executable: process.env.MULTINEST_TEST_EXE || 'development', chrome, checks: ['cookies', 'localStorage', 'IndexedDB', 'CacheStorage', 'sandbox', 'toolbar layouts', 'theme switch', 'color wheel', 'custom hex colors', 'modals', 'sidebar drag', 'keyboard resize', 'page RAM/CPU', 'metrics pause on minimize', 'workspaces', 'restart', 'zoom', 'mute','native menus','rename','suspend/resume','always-active'], errors }, null, 2));
})().catch(async error => {
  console.error(error); process.exitCode = 1;
  if(page && !page.isClosed()){
    console.error('Resize diagnostic:',JSON.stringify(await page.evaluate(()=>({trace:globalThis.resizeTrace,width:document.querySelector('.sidebar')?.getBoundingClientRect().width,dpr:devicePixelRatio})).catch(()=>null)));
    await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  }
}).finally(async () => {
  if (application) await application.close();
  server.close();
});
