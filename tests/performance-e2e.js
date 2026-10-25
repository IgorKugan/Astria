'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {_electron:electron}=require('playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'astria-perf-'));
const sockets=new Set();let application;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><style>body{margin:0;background:#142740;color:white}button{position:absolute;left:320px;top:180px;width:120px;height:70px}</style><button onclick="clicks++">Test input</button><script>window.instance=crypto.randomUUID();window.frames=0;window.ticks=0;window.messages=0;window.clicks=0;window.live=new Array(10000).fill('retained');localStorage.setItem('keep','yes');const r=requestAnimationFrame.bind(window);function draw(){frames++;r(draw)}r(draw);setInterval(()=>ticks++,50);const ws=new WebSocket('ws://'+location.host);ws.onmessage=()=>messages++;</script>`);});
server.on('upgrade',(req,socket)=>{const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));});
const ticker=setInterval(()=>{for(const socket of sockets)socket.write(Buffer.from([0x81,1,49]));},200);
async function samples(){return application.evaluate(async({webContents})=>Promise.all(webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())).map(async w=>({url:w.getURL(),muted:w.isAudioMuted(),fps:w.astriaFPS,...await w.executeJavaScript('({instance,frames,ticks,messages,clicks,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,live:live.length,keep:localStorage.getItem("keep")})')}))));}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({activeWorkspaceId:'games',selectedAccountId:'a1',workspaces:[{id:'games',name:'Performance test',layout:'focus'}],accounts:[1,2,3,4].map(i=>({id:'a'+i,workspaceId:'games',name:'Account '+i,url:`http://127.0.0.1:${server.address().port}/#${i}`,activity:'adaptive',muted:i===3})),preferences:{language:'en'}}));
  const env={...process.env,MULTINEST_USER_DATA:profile};delete env.ELECTRON_RUN_AS_NODE;
  application=await electron.launch({executablePath:process.env.MULTINEST_TEST_EXE||require('electron'),args:process.env.MULTINEST_TEST_EXE?['--user-data-dir='+profile]:[root],env});
  let page=await application.firstWindow();await page.waitForSelector('[data-action="performance"]');
  for(let i=0;i<100&&(await samples()).length!==4;i++)await delay(100);
  await delay(500);let before=await samples();assert.equal(before.length,4);
  assert.equal(before.find(s=>s.url.endsWith('#1')).fps,60);assert.equal(before.find(s=>s.url.endsWith('#2')).fps,10);
  await page.evaluate(()=>window.multiNest.visualRest(true));await delay(150);before=await samples();await delay(1700);let after=await samples();
  for(const sample of after){const previous=before.find(s=>s.url===sample.url);assert.equal(sample.instance,previous.instance);assert.ok(sample.ticks>previous.ticks);assert.ok(sample.messages>previous.messages,'WebSocket remains live');if(!sample.url.endsWith('#1')){assert.equal(sample.fps,2);assert.ok(sample.frames-previous.frames>=1&&sample.frames-previous.frames<=5,'rest frame cap');assert.equal(sample.muted,true);}}
  await page.evaluate(()=>window.multiNest.accountSelect('a2'));await delay(300);after=await samples();assert.equal(after.find(s=>s.url.endsWith('#2')).muted,false);assert.equal(after.find(s=>s.url.endsWith('#2')).fps,60);
  const nativeWindow=await application.browserWindow(page);await nativeWindow.evaluate(w=>w.minimize());await delay(200);before=await samples();await delay(1200);after=await samples();
  for(const sample of after){const previous=before.find(s=>s.url===sample.url);assert.ok(sample.ticks>previous.ticks,'minimized timers continue');assert.ok(sample.messages>previous.messages,'minimized networking continues');assert.equal(sample.instance,previous.instance);}
  await nativeWindow.evaluate(w=>w.restore());await delay(200);
  assert.equal((await page.evaluate(()=>window.multiNest.accountResolution('a2','bad'))).ok,false);
  for(const [preset,width,height] of [['720p',1280,720],['768p',1366,768],['900p',1600,900],['1080p',1920,1080]]){
    assert.equal((await page.evaluate(p=>window.multiNest.accountResolution('a2',p),preset)).ok,true);await delay(120);const s=(await samples()).find(s=>s.url.endsWith('#2'));assert.equal(s.width,width);assert.equal(s.height,height);assert.equal(s.dpr,1);
  }
  await page.evaluate(()=>window.multiNest.accountResolution('a2','720p'));await delay(200);
  // Physical pointer coordinates must map into the virtual viewport.
  await application.evaluate(({BaseWindow})=>{const view=BaseWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents?.getURL().endsWith('#2'));const scale=view.getBounds().width/1280;view.webContents.focus();view.webContents.sendInputEvent({type:'mouseDown',x:Math.round(370*scale),y:Math.round(210*scale),button:'left',clickCount:1});view.webContents.sendInputEvent({type:'mouseUp',x:Math.round(370*scale),y:Math.round(210*scale),button:'left',clickCount:1});});
  await delay(150);assert.equal((await samples()).find(s=>s.url.endsWith('#2')).clicks,1);
  await page.evaluate(()=>window.multiNest.ultra('a2'));await page.waitForSelector('[data-action="ultra"][aria-pressed="true"]');await delay(300);
  assert.equal(await application.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].isFullScreen()),true);
  for(const s of await samples())if(!s.url.endsWith('#2'))assert.equal(s.fps,1);
  await page.click('[data-action="ultra"]');await delay(250);assert.equal(await application.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].isFullScreen()),false);
  const cleanup=await page.evaluate(()=>window.multiNest.cleanup('a2'));assert.equal(cleanup.ok,true);assert.equal(cleanup.result,'collected');assert.equal((await page.evaluate(()=>window.multiNest.cleanup('a2'))).result,'cooldown');
  const retained=(await samples()).find(s=>s.url.endsWith('#2'));assert.equal(retained.live,10000);assert.equal(retained.keep,'yes');assert.equal(retained.instance,before.find(s=>s.url.endsWith('#2')).instance);
  await page.evaluate(()=>window.multiNest.accountResolution('a2','auto'));await page.evaluate(()=>window.multiNest.visualRest(false));await delay(300);after=await samples();assert.equal(after.find(s=>s.url.endsWith('#1')).muted,false);assert.equal(after.find(s=>s.url.endsWith('#3')).muted,true,'manual mute retained');
  await page.click('[data-action="performance"]');await page.waitForSelector('#visual-rest');assert.equal(await page.locator('#modal-title').textContent(),'Performance');
  const dir=path.join(root,'test-results');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,'performance-controls.png')});await page.keyboard.press('Escape');await page.screenshot({path:path.join(dir,'performance-dark.png')});
  await page.evaluate(()=>window.multiNest.theme('light'));await delay(100);await page.screenshot({path:path.join(dir,'performance-light.png')});
  await application.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].webContents.send('ui:command',{type:'performance-help',id:'a3'}));
  await page.waitForSelector('#performance-mode');assert.equal(await page.locator('label[for="performance-mode"]').textContent(),'Activity for Account 3','context-menu cleanup targets the clicked account');await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.brand-mark').evaluate(el=>getComputedStyle(el).animationName),'none');
  await nativeWindow.evaluate(w=>w.setSize(780,500));await delay(200);assert.equal(await page.locator('.panel-head').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'compact toolbar fits');
  await page.evaluate(()=>window.multiNest.language('pt-BR'));await page.click('[data-action="performance"]');assert.equal(await page.locator('#modal-title').textContent(),'Desempenho');await page.keyboard.press('Escape');
  await page.evaluate(()=>window.multiNest.accountResolution('a2','720p'));await page.evaluate(()=>window.multiNest.visualRest(true));
  const previousProcess=application.process();await application.close();
  for(let i=0;i<200&&previousProcess.exitCode===null&&previousProcess.signalCode===null;i++)await delay(50);
  assert.ok(previousProcess.exitCode!==null||previousProcess.signalCode!==null,'previous process releases the profile before restart');
  application=await electron.launch({executablePath:process.env.MULTINEST_TEST_EXE||require('electron'),args:process.env.MULTINEST_TEST_EXE?['--user-data-dir='+profile]:[root],env});
  page=await application.firstWindow();await page.waitForSelector('.panel');
  const restored=(await page.evaluate(()=>window.multiNest.getState())).state;assert.equal(restored.preferences.visualRest,true);assert.equal(restored.accounts.find(a=>a.id==='a2').resolution,'720p');assert.equal(restored.accounts.find(a=>a.id==='a2').activity,'adaptive');assert.ok(!restored.ultraAccountId,'fullscreen is not persisted');
  fs.writeFileSync(path.join(dir,'performance-e2e.json'),JSON.stringify({passed:true,checks:['adaptive budgets','2 FPS rest','WebSocket and timer continuity','same document instances','mute restoration','four fixed virtual viewports','scaled pointer input','Ultra fullscreen and 1 FPS secondary','manual GC live-object/storage retention','cooldown','bilingual controls','light/dark screenshots','reduced motion']},null,2));
  console.log('PASS: live adaptive/rest/Ultra transitions, network continuity, resolutions, pointer input, cleanup and bilingual controls');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(application)await application.close();clearInterval(ticker);for(const socket of sockets)socket.destroy();server.close();});
