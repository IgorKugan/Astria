'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { _electron: electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-'));
let application;
const frameSamples=[];
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'nonce-fixture'; frame-src http://127.0.0.1:* http://localhost:*");
  const children=req.url.startsWith('/frame')?'':`<iframe src="/frame"></iframe><iframe src="http://localhost:${server.address().port}/frame"></iframe>`;
  res.end('<!doctype html><title>Activity fixture</title><canvas width="320" height="180"></canvas><script nonce="fixture">window.instance=crypto.randomUUID();window.framesDrawn=0;window.ticks=0;window.logicTicks=0;window.callbackOrder=[];const request=requestAnimationFrame.bind(window);request(()=>queueMicrotask(()=>callbackOrder.push("microtask")));request(()=>callbackOrder.push("next callback"));setInterval(()=>ticks++,50);setInterval(()=>{if(document.hidden)logicTicks++},100);const ctx=document.querySelector("canvas").getContext("2d");function frame(){framesDrawn++;logicTicks++;ctx.fillRect(framesDrawn%300,30,4,4);request(frame)}request(frame);</script>'+children);
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function frames() {
  return application.evaluate(async ({ webContents }) => Object.fromEntries(await Promise.all(
    webContents.getAllWebContents().filter(w => /^http:/.test(w.getURL())).map(async w => [w.id, await w.executeJavaScript('({frames:framesDrawn,ticks,logicTicks,visibility:document.visibilityState})')])
  )));
}
async function advancing(label, requireFrames = true) {
  const before = await frames();
  // Covered games may render at reduced FPS; foreground responsiveness is checked separately.
  await delay(1800);
  const after = await frames();
  assert.equal(Object.keys(after).length, 4, label + ': all accounts retained');
  for (const [id, sample] of Object.entries(after)) {
    if (requireFrames) assert.ok(sample.frames > before[id].frames, label + ': background animation continues in account ' + id + ' (frames: ' + before[id].frames + ' → ' + sample.frames + ', visibility: ' + sample.visibility + ')');
    else assert.ok(sample.frames > before[id].frames || sample.visibility === 'hidden', label + ': stopped rendering must expose hidden-page visibility');
    assert.ok(sample.logicTicks > before[id].logicTicks, label + ': frame loop or native hidden-page fallback advances game state');
    assert.ok(sample.ticks > before[id].ticks, label + ': timers continue in account ' + id);
  }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({
    activeWorkspaceId: 'games', selectedAccountId: 'account-1',
    workspaces: [{ id: 'games', name: 'Fixture', layout: 'focus' }, { id: 'empty', name: 'Empty', layout: 'auto' }],
    accounts: [1,2,3,4].map(i => ({ id: 'account-' + i, workspaceId: 'games', name: 'Account ' + i, url: base + '#' + i, activity: 'always' })),
    preferences: { language: 'en' }
  }));
  const env = { ...process.env, MULTINEST_USER_DATA: profile }; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ executablePath: process.env.MULTINEST_TEST_EXE || require('electron'), args: process.env.MULTINEST_TEST_EXE ? ['--user-data-dir=' + profile] : [root], env });
  let page = await application.firstWindow();
  await page.waitForSelector('.panel');
  for(let i=0;i<100;i++){
    const ready=await application.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())&&!w.isLoading()).length);
    if(ready===4)break;
    await delay(100);
  }
  const callbackOrders=await application.evaluate(async({webContents})=>Promise.all(webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())).map(w=>w.executeJavaScript('callbackOrder'))));
  for(const order of callbackOrders)assert.deepEqual(order,['microtask','next callback'],'native microtask ordering between animation callbacks');
  await advancing('focus layout timers');
  async function selectedAnimating(label) {
    let id;
    const current=(await page.evaluate(()=>window.multiNest.getState())).state;
    const expected=current.accounts.find(a=>a.id===current.selectedAccountId).url;
    // IPC completes before the renderer reports its new layout bounds.
    for(let i=0;i<100&&!id;i++) {
      id=await application.evaluate(({BaseWindow},url)=>BaseWindow.getAllWindows()[0].contentView.children.find(v=>v.onScreen&&v.webContents.getURL()===url)?.webContents.id,expected);
      if(!id)await delay(50);
    }
    assert.ok(id,label+': selected page attached');
    const before=await frames();await delay(700);const after=await frames();
    assert.ok(after[id].frames-before[id].frames>=5,label+': selected page draws frames');
  }
  await selectedAnimating('focus layout');
  await page.evaluate(()=>window.multiNest.accountSelect('account-2'));
  await selectedAnimating('switch account');
  await page.evaluate(()=>window.multiNest.accountSelect('account-1'));
  await selectedAnimating('switch back');
  assert.equal(await application.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents&&v.onScreen).length),1,'only the selected game is visible');
  await page.evaluate(()=>window.multiNest.workspaceSelect('empty'));
  await advancing('another workspace');
  const window = await application.browserWindow(page);
  await window.evaluate(w=>w.minimize());
  await delay(200);
  assert.equal(await window.evaluate(w=>w.isMinimized()),true,'fixture is actually minimized');
  await advancing('minimized game loop', false);
  await window.evaluate(w=>w.restore());
  await delay(200);
  await advancing('restored timers');
  await page.evaluate(()=>window.multiNest.workspaceSelect('games'));
  await selectedAnimating('return to workspace');
  await page.click('#add-account');
  await advancing('modal overlay');
  assert.equal(await application.evaluate(({BaseWindow})=>BaseWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents&&v.onScreen).length),0,'native pages cannot cover a dialog');
  await page.keyboard.press('Escape');
  await selectedAnimating('close modal');
  await page.evaluate(()=>window.multiNest.accountActivity('account-2','visible'));
  await delay(200);
  const ordinary=await application.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().endsWith('#2')).id);
  const before=await frames(); await delay(700); const after=await frames();
  assert.ok(after[ordinary].frames-before[ordinary].frames<=2,'visible-only stops background animation');
  await page.evaluate(()=>window.multiNest.accountActivity('account-2','always'));
  await advancing('resume background activity');
  assert.equal((await page.evaluate(()=>window.multiNest.accountActivity('account-1','eco'))).ok,true,'power saving stays active instead of suspending');
  const samples=(hash='#1')=>application.evaluate(async({webContents},hash)=>{
    const contents=webContents.getAllWebContents().find(w=>w.getURL().endsWith(hash));
    return Promise.all(contents.mainFrame.framesInSubtree.map(frame=>frame.executeJavaScript('({instance,frames:framesDrawn,ticks,node:typeof require,process:typeof process,bridge:typeof window.multiNest})')));
  },hash);
  async function capped(fps,label,hash='#1'){
    await delay(150);
    const before=await samples(hash);await delay(1800);const after=await samples(hash);
    assert.ok(after.length>=3,label+': main page and same/cross-origin frames covered');
    for(let i=0;i<after.length;i++){
      const drawn=after[i].frames-before[i].frames;
      assert.ok(drawn>0&&drawn<=fps*1.8+3,label+': frame budget respected: '+drawn);
      assert.ok(after[i].ticks>before[i].ticks+15,label+': timers keep advancing independently of drawing');
      assert.equal(after[i].instance,before[i].instance,label+': live page retained');
      assert.equal(after[i].node,'undefined');assert.equal(after[i].process,'undefined');assert.equal(after[i].bridge,'undefined');
    }
    const orders=await application.evaluate(async({webContents},hash)=>Promise.all(webContents.getAllWebContents().find(w=>w.getURL().endsWith(hash)).mainFrame.framesInSubtree.map(frame=>frame.executeJavaScript('new Promise(resolve=>{const order=[];requestAnimationFrame(()=>queueMicrotask(()=>order.push("microtask")));requestAnimationFrame(()=>{order.push("next callback");resolve(order);});})'))),hash);
    for(const order of orders)assert.deepEqual(order,['microtask','next callback'],label+': native microtask ordering preserved');
    frameSamples.push({label,targetFPS:fps,frames:after.map((sample,i)=>sample.frames-before[i].frames),durationMs:1800});
    return after.map(sample=>sample.instance);
  }
  await page.waitForSelector('[data-mode="eco"][aria-pressed="true"]');
  await capped(15,'default power saving');
  await application.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().endsWith('#1')).executeJavaScript('window.open(location.origin+"/#popup");true'));
  for(let i=0;i<100;i++){
    const ready=await application.evaluate(({webContents})=>webContents.getAllWebContents().some(w=>w.getURL().endsWith('#popup')&&!w.isLoading()));
    if(ready)break;
    await delay(100);
  }
  await capped(15,'popup inherits account budget','#popup');
  assert.equal((await page.evaluate(()=>window.multiNest.accountEcoFPS('account-1',10))).ok,true);
  assert.equal((await page.evaluate(()=>window.multiNest.accountEcoFPS('account-1',11))).ok,false,'unsupported frame budget rejected');
  await capped(10,'existing popup follows new budget','#popup');
  await application.evaluate(({BaseWindow})=>BaseWindow.getAllWindows().find(w=>w.webContents?.getURL().endsWith('#popup')).close());
  await page.evaluate(()=>window.multiNest.accountSelect('account-1'));
  const instances=await capped(10,'10 FPS');
  await application.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().endsWith('#1')).executeJavaScript('(()=>{const lateFrame=document.createElement("iframe");lateFrame.src="/frame?late";document.body.append(lateFrame);return true;})()'));
  await delay(350);
  await capped(10,'late iframe inherits current budget');
  await page.evaluate(()=>window.multiNest.accountEcoFPS('account-1',30));await capped(30,'30 FPS');
  await page.evaluate(()=>window.multiNest.accountActivity('account-1','always'));
  assert.deepEqual((await samples()).slice(0,3).map(sample=>sample.instance),instances,'return to maximum performance does not reload');
  await selectedAnimating('return to maximum performance');
  await page.evaluate(()=>window.multiNest.accountActivity('account-1','eco'));
  await page.evaluate(()=>window.multiNest.accountEcoFPS('account-1',10));
  await page.evaluate(()=>window.multiNest.workspaceSelect('empty'));
  await capped(10,'hidden power saving stays loaded');
  await page.evaluate(()=>window.multiNest.workspaceSelect('games'));
  await application.close();
  application=await electron.launch({executablePath:process.env.MULTINEST_TEST_EXE||require('electron'),args:process.env.MULTINEST_TEST_EXE?['--user-data-dir='+profile]:[root],env});
  page=await application.firstWindow();await page.waitForSelector('[data-mode="eco"][aria-pressed="true"]');
  for(let i=0;i<100;i++){
    const ready=await application.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())&&!w.isLoading()).length);
    if(ready===4)break;
    await delay(100);
  }
  const restored=(await page.evaluate(()=>window.multiNest.getState())).state.accounts.find(a=>a.id==='account-1');
  assert.equal(restored.activity,'eco');assert.equal(restored.ecoFPS,10);
  await capped(10,'saved mode and FPS after restart');
  await page.evaluate(()=>window.multiNest.accountActivity('account-2','suspended'));
  assert.equal(Object.keys(await frames()).length,3,'suspension releases the account renderer');
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  fs.writeFileSync(path.join(root,'test-results','astria-activity.json'),JSON.stringify({passed:true,frameSamples,checks:['four isolated account timers and animation loops','focus layout animation','account switching animation','workspace switching animation','minimized game loops','animation after returning to workspace','modal overlay with background game loops','visible-only animation pause','10/15/30 FPS animation budgets','late iframe inherits budget','same and cross-origin frames remain sandboxed','FPS and mode persist across restart','return to Always active without reload','suspension']},null,2));
  console.log('PASS: maximum activity, configurable power-saving FPS, cached animation callbacks, iframe isolation, persistence, hidden activity and suspension');
})().catch(async error=>{console.error(error);if(application)console.error(await application.evaluate(({BaseWindow})=>{const w=BaseWindow.getAllWindows()[0];return {size:w.getContentSize(),minimized:w.isMinimized(),mainThrottle:w.webContents.getBackgroundThrottling(),children:w.contentView.children.map(v=>({id:v.webContents?.id,visible:v.getVisible(),bounds:v.getBounds(),throttle:v.webContents?.getBackgroundThrottling()}))};}));process.exitCode=1;}).finally(async()=>{if(application)await application.close();server.close();});
