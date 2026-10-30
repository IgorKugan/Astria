'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {_electron:electron}=require('playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'astria-float-'));
let app;const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<200;i++){const result=await fn();if(result)return result;await delay(50);}throw Error('Floating timeout: '+label);}
const server=http.createServer((req,res)=>{const id=new URL(req.url,'http://local').searchParams.get('id');res.setHeader('content-type','text/html');res.end(`<!doctype html><style>html,body{margin:0;height:100%;background:${id==='a'?'#cf4a62':'#38b7ff'};color:white;font:32px system-ui}</style><h1>${id}</h1><script>window.instance=crypto.randomUUID();window.draws=0;window.clicks=0;window.keys=[];window.initialWidth=innerWidth;document.cookie='identity=${id};max-age=86400;path=/';localStorage.setItem('identity','${id}');const r=requestAnimationFrame;function frame(){draws++;r(frame)}r(frame);addEventListener('click',()=>clicks++);addEventListener('keydown',e=>keys.push(e.key));</script>`);});
async function layers(){return app.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].contentView.children.map(v=>({url:v.webContents?.getURL(),bounds:v.getBounds(),onScreen:!!v.onScreen,visible:v.getVisible()})));}
async function documents(){return app.evaluate(async({webContents})=>Promise.all(webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())).map(async w=>({url:w.getURL(),...await w.executeJavaScript('({instance,draws,clicks,keys,initialWidth,width:innerWidth,identity:localStorage.getItem("identity"),cookie:document.cookie,hostAPI:typeof multiNest,floatingAPI:typeof floating})')}))));}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({activeWorkspaceId:'games',selectedAccountId:'a',workspaces:[{id:'games',name:'Floating test',layout:'focus'},{id:'empty',name:'Empty',layout:'focus'}],accounts:['a','b','c'].map(id=>({id,workspaceId:'games',name:'Account '+id,url:base+'/?id='+id,activity:'always',color:id==='a'?'#e97778':'#559ce8'})),preferences:{language:'en'}}));
 const env={...process.env,MULTINEST_USER_DATA:profile};delete env.ELECTRON_RUN_AS_NODE;
 const launch=()=>electron.launch({executablePath:process.env.MULTINEST_TEST_EXE||require('electron'),args:process.env.MULTINEST_TEST_EXE?['--user-data-dir='+profile]:[root],env});
 app=await launch();let page=await app.firstWindow();await page.waitForSelector('.panel');
 assert.equal((await page.evaluate(()=>window.multiNest.workspaceLayout('floating'))).ok,true,'floating layout is supported');
 const floating=await until(()=>app.context().pages().find(p=>p.url().endsWith('/floating.html')),'floating control');await floating.waitForSelector('#card');
 await until(async()=>(await documents()).length===3,'three retained games');
 await until(async()=>(await layers()).filter(v=>v.onScreen).length===2,'two visible native games');
 const initial=await documents();assert.equal(initial.length,3);for(const d of initial){assert.equal(d.hostAPI,'undefined');assert.equal(d.floatingAPI,'undefined');assert.ok(d.cookie.includes('identity='+d.identity));}
 const fullSlot=(await layers()).find(v=>v.url.endsWith('id=a')).bounds;
 await page.evaluate(()=>window.multiNest.accountResolution('a','720p'));await delay(100);
 const letterboxed=await layers(),fittedMain=letterboxed.find(v=>v.url.endsWith('id=a')).bounds,fittedCard=letterboxed.find(v=>v.url.endsWith('/floating.html')).bounds;
 assert.ok(fittedCard.y>=fittedMain.y&&fittedCard.x>=fittedMain.x&&fittedCard.y+fittedCard.height<=fittedMain.y+fittedMain.height&&fittedCard.x+fittedCard.width<=fittedMain.x+fittedMain.width,'miniature stays inside letterboxed primary game');
 await floating.locator('#card').click({position:{x:70,y:65}});await until(async()=>(await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId==='b','swap from fixed-resolution primary');
 await until(async()=>(await layers()).find(v=>v.url.endsWith('id=b')).bounds.height===fullSlot.height,'swap restores the full panel slot');
 await page.evaluate(()=>window.multiNest.floatingSwap());await page.evaluate(()=>window.multiNest.accountResolution('a','auto'));await delay(100);
 await floating.locator('#card').dispatchEvent('click',{detail:0});await until(async()=>(await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId==='b','accessible default action swaps');await page.evaluate(()=>window.multiNest.floatingSwap());
 await app.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].focus());
 for(const id of ['a','b','c'])await page.evaluate(id=>window.multiNest.accountActivity(id,'visible'),id);
 const beforeVisible=await documents();await delay(700);const afterVisible=await documents();
 assert.ok(afterVisible.find(d=>d.url.endsWith('id=b')).draws>beforeVisible.find(d=>d.url.endsWith('id=b')).draws,'miniature keeps rendering under the transparent gesture layer');
 for(const id of ['a','b','c'])await page.evaluate(id=>window.multiNest.accountActivity(id,'always'),id);
 let native=await layers();const primary=native.find(v=>v.url.endsWith('id=a')),secondary=native.find(v=>v.url.endsWith('id=b')),chrome=native.find(v=>v.url.endsWith('/floating.html'));
 assert.ok(native.indexOf(chrome)>native.indexOf(secondary)&&native.indexOf(secondary)>native.indexOf(primary),'miniature and gesture surface are above primary');
 assert.ok(primary.bounds.width>secondary.bounds.width*2);assert.ok(secondary.bounds.x>=primary.bounds.x&&secondary.bounds.y>=primary.bounds.y);
 const alpha=await app.evaluate(({BaseWindow})=>{const view=BaseWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents?.getURL().endsWith('/floating.html'));return view.webContents.capturePage().then(img=>{const bitmap=img.toBitmap(),s=img.getSize();return bitmap[(Math.floor(s.height/2)*s.width+Math.floor(s.width/2))*4+3];});});assert.equal(alpha,0,'gesture overlay is transparent above the game');
 const cardBounds=async()=>(await layers()).find(v=>v.url.endsWith('/floating.html')).bounds;
 const originalCard=await cardBounds();
 assert.equal(await floating.locator('#larger').count(),1,'floating window exposes resize controls');
 await floating.locator('#larger').click();await until(async()=>(await cardBounds()).width>originalCard.width,'larger button resizes');
 const grip=await floating.locator('#resize').boundingBox(),beforeResize=await cardBounds();
 await floating.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await floating.mouse.down();
 await floating.mouse.move(grip.x+grip.width/2-55,grip.y+grip.height/2-25);await delay(80);await floating.mouse.up();
 await until(async()=>(await cardBounds()).width<beforeResize.width,'corner drag shrinks miniature');
 assert.equal((await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId,'a','resize never swaps accounts');
 const resized=await cardBounds();assert.ok(Math.abs((resized.height-28)/(resized.width-4)-(originalCard.height-28)/(originalCard.width-4))<.01,'resize keeps aspect ratio');
 const beforeKeys=resized.width;await floating.locator('#resize').focus();await floating.keyboard.press('ArrowRight');await until(async()=>(await cardBounds()).width>beforeKeys,'keyboard resize');
 assert.equal((await floating.evaluate(()=>window.floating.resizeStep(NaN))).ok,false,'reject invalid resize input');
 await page.evaluate(()=>window.multiNest.language('pt-BR'));await until(()=>floating.locator('#pin').getAttribute('aria-label').then(v=>v==='Fixar janela'),'Portuguese resize labels');
 await page.evaluate(()=>window.multiNest.language('en'));
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
 for(const theme of ['light','dark']){
   await page.evaluate(theme=>window.multiNest.theme(theme),theme);await until(()=>floating.evaluate(theme=>document.documentElement.classList.contains('light')===(theme==='light'),theme),'floating theme');
   await floating.screenshot({path:path.join(root,'test-results','floating-resize-'+theme+'.png')});
 }
 await floating.locator('#pin').click();await until(()=>floating.locator('#pin').getAttribute('aria-pressed').then(v=>v==='true'),'pin pressed state');
 const pinned=await cardBounds();assert.equal(await floating.locator('#smaller').isDisabled(),true,'pinned size is locked');assert.equal(await floating.locator('#corner').isDisabled(),true,'pinned corner is locked');
 await floating.mouse.move(70,65);await floating.mouse.down();await floating.mouse.move(30,30);await floating.mouse.up();await delay(100);
 await page.evaluate(()=>window.multiNest.floatingStep(-80,-80));assert.deepEqual(await cardBounds(),pinned,'pin blocks pointer and keyboard movement');
 await floating.evaluate(async()=>{await window.floating.resizeStep(80);await window.floating.corner();});assert.deepEqual(await cardBounds(),pinned,'pin also blocks programmatic resize/corner commands');
 assert.equal((await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId,'a','dragging pinned card does not swap');
 for(const d of await documents()){assert.equal(d.instance,initial.find(s=>s.url===d.url).instance,'resizing never reloads');assert.equal(d.width,initial.find(s=>s.url===d.url).width,'resizing scales without changing game viewport');}
 await floating.locator('#card').click({position:{x:70,y:65}});
 await until(async()=>(await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId==='b','mini click swaps');
 await until(()=>app.evaluate(({webContents})=>webContents.getFocusedWebContents()?.getURL().endsWith('id=b')),'swap focuses game keyboard input');
 for(const d of await documents()){assert.equal(d.instance,initial.find(s=>s.url===d.url).instance,'swap never reloads');assert.equal(d.clicks,0,'preview click never reaches a game');}
 assert.equal(await floating.locator('#pin').getAttribute('aria-pressed'),'true','pin survives swap');await floating.locator('#pin').click();await until(()=>floating.locator('#pin').getAttribute('aria-pressed').then(v=>v==='false'),'unpin restores controls');
 const beforeDrag=(await layers()).find(v=>v.url.endsWith('/floating.html')).bounds;
 await floating.mouse.move(70,65);await floating.mouse.down();await delay(250);
 await floating.mouse.move(35,35);await delay(100);await floating.mouse.up();
 await until(async()=>{const b=(await layers()).find(v=>v.url.endsWith('/floating.html')).bounds;return b.x!==beforeDrag.x||b.y!==beforeDrag.y;},'drag moves miniature');
 assert.equal((await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId,'b','drag does not also swap');
 await until(()=>app.evaluate(({webContents})=>webContents.getFocusedWebContents()?.getURL().endsWith('id=b')),'drag release returns game keyboard input');
 const saveError=await app.evaluate(({ipcMain,BaseWindow})=>{const w=BaseWindow.getAllWindows()[0],wc=w.contentView.children.find(v=>v.webContents?.getURL().endsWith('/floating.html')).webContents,fs=process.getBuiltinModule('fs'),write=fs.writeFileSync,send=w.webContents.send;let toast;w.webContents.send=function(channel,value){if(channel==='ui:toast')toast=value;return send.call(this,channel,value);};try{ipcMain.emit('floating:drag-start',{sender:wc,senderFrame:wc.mainFrame});fs.writeFileSync=()=>{throw Error('fixture save failure');};ipcMain.emit('floating:drag-end',{sender:wc,senderFrame:wc.mainFrame});return toast;}finally{fs.writeFileSync=write;w.webContents.send=send;}});
 assert.match(saveError,/fixture save failure/,'failed position save reports a toast without throwing');
 await floating.locator('#corner').click();assert.equal((await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId,'b','corner button does not swap');
 await page.locator('[data-action="floating-swap"]').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');
 await until(async()=>(await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId==='a','keyboard swap');
 await page.evaluate(()=>window.multiNest.accountSelect('c'));await until(async()=>await floating.locator('#name').textContent()==='Account a','sidebar selection retains previous main');
 await page.click('#add-account');await until(async()=>(await layers()).filter(v=>v.onScreen).length===0,'modal hides both native games');assert.equal((await layers()).some(v=>v.url.endsWith('/floating.html')&&v.visible),false);await page.keyboard.press('Escape');
 await until(async()=>(await layers()).filter(v=>v.onScreen).length===2,'dismiss dialog restores floating');
 await app.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].minimize());await delay(150);assert.equal((await layers()).some(v=>v.url.endsWith('/floating.html')&&v.visible),false,'minimizing hides floating controls');await app.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].restore());await until(async()=>(await layers()).filter(v=>v.onScreen).length===2,'restore keeps both sessions');
 await page.evaluate(()=>window.multiNest.ultra('c'));await delay(200);assert.equal(await app.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].isFullScreen()),true);
 await floating.locator('#card').click({position:{x:60,y:60}});await until(async()=>(await page.evaluate(()=>window.multiNest.getState())).state.selectedAccountId==='a','Ultra swap');assert.equal(await app.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].isFullScreen()),true,'swap keeps Ultra fullscreen');await page.evaluate(()=>window.multiNest.ultra('a'));
 await page.evaluate(()=>window.multiNest.workspaceSelect('empty'));await until(async()=>!(await layers()).some(v=>v.url.endsWith('/floating.html')&&v.visible),'other workspace hides miniature');
 await page.evaluate(()=>window.multiNest.workspaceSelect('games'));await until(async()=>(await layers()).filter(v=>v.onScreen).length===2,'return restores pair');
 await page.evaluate(()=>window.multiNest.accountResolution('b','720p'));await page.evaluate(()=>window.multiNest.accountSelect('c'));await page.evaluate(()=>window.multiNest.accountSelect('b'));await page.evaluate(()=>window.multiNest.floatingSwap());await delay(100);
 assert.equal((await page.evaluate(()=>window.multiNest.floatingStep(NaN,1))).ok,false);
 const win=await app.browserWindow(page);await win.evaluate(w=>w.setSize(780,500));await page.evaluate(()=>window.multiNest.sidebarWidth(320));await delay(200);assert.equal(await page.locator('.panel-head').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'floating toolbar fits with a wide sidebar');await page.evaluate(()=>window.multiNest.floatingStep(10000,10000));
 native=await layers();const main=native.filter(v=>v.onScreen).sort((a,b)=>b.bounds.width-a.bounds.width)[0].bounds,card=native.find(v=>v.url.endsWith('/floating.html')).bounds;assert.ok(card.x>=main.x&&card.y>=main.y&&card.x+card.width<=main.x+main.width&&card.y+card.height<=main.y+main.height,'resized miniature stays inside main game');
 const currentFloating=await until(()=>app.context().pages().find(p=>p.url().endsWith('/floating.html')),'restored control');await currentFloating.locator('#pin').click();
 const state=(await page.evaluate(()=>window.multiNest.getState())).state;const saved=state.workspaces.find(w=>w.id==='games').floating;assert.ok(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.width>0&&saved.pinned);
 await app.close();app=await launch();page=await app.firstWindow();await page.waitForSelector('.panel');const restored=(await page.evaluate(()=>window.multiNest.getState())).state;assert.equal(restored.workspaces.find(w=>w.id==='games').layout,'floating');assert.deepEqual(restored.workspaces.find(w=>w.id==='games').floating,saved);
 await page.evaluate(()=>window.multiNest.workspaceLayout('focus'));await until(async()=>!(await layers()).some(v=>v.url.endsWith('/floating.html')),'leaving floating releases trusted helper');
 await page.evaluate(async()=>{await window.multiNest.workspaceLayout('floating');const state=(await window.multiNest.getState()).state;for(const a of state.accounts)if(a.id!==state.selectedAccountId)await window.multiNest.accountActivity(a.id,'suspended');});await until(async()=>!(await layers()).some(v=>v.url.endsWith('/floating.html')),'suspended accounts excluded from miniature');await until(async()=>(await layers()).filter(v=>v.onScreen).length===1,'one available account remains full size');
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results','floating-e2e.json'),JSON.stringify({passed:true,checks:['native transparent overlay','live game reuse','click swap','drag without swap','corner/keyboard controls','resize grip/buttons/keyboard','pinned move/resize lock with click swap','EN/PT-BR labels and both themes','session isolation','modal/workspace hiding','Ultra swap','fixed resolution','resize bounds','saved layout/position/size/pin','helper teardown']},null,2));console.log('PASS: floating live accounts, transparent stacking, click/drag, resize, pin, keyboard, isolation, Ultra and persistence');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(app)await app.close();server.close();});
