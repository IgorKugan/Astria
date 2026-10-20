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
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><title>Activity fixture</title><canvas width="320" height="180"></canvas><script>window.framesDrawn=0;window.ticks=0;setInterval(()=>ticks++,50);const ctx=document.querySelector("canvas").getContext("2d");function frame(){framesDrawn++;ctx.fillRect(framesDrawn%300,30,4,4);requestAnimationFrame(frame)}requestAnimationFrame(frame);</script>');
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function frames() {
  return application.evaluate(async ({ webContents }) => Object.fromEntries(await Promise.all(
    webContents.getAllWebContents().filter(w => /^http:/.test(w.getURL())).map(async w => [w.id, await w.executeJavaScript('({frames:framesDrawn,ticks,visibility:document.visibilityState})')])
  )));
}
async function advancing(label, requireFrames = false) {
  const before = await frames();
  await delay(700);
  const after = await frames();
  assert.equal(Object.keys(after).length, 4, label + ': all accounts retained');
  for (const [id, sample] of Object.entries(after)) {
    if (requireFrames) assert.ok(sample.frames - before[id].frames >= 5, label + ': animation continues in account ' + id + ' (frames: ' + before[id].frames + ' → ' + sample.frames + ')');
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
  const page = await application.firstWindow();
  await page.waitForSelector('.panel');
  for(let i=0;i<100;i++){
    const ready=await application.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>/^http:/.test(w.getURL())&&!w.isLoading()).length);
    if(ready===4)break;
    await delay(100);
  }
  await advancing('focus layout timers');
  async function selectedAnimating(label) {
    const id = await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.onScreen)?.webContents.id);
    assert.ok(id,label+': selected page attached');
    const before=await frames();await delay(700);const after=await frames();
    assert.ok(after[id].frames-before[id].frames>=5,label+': selected page draws frames');
  }
  await selectedAnimating('focus layout');
  await page.evaluate(()=>window.multiNest.accountSelect('account-2'));
  await selectedAnimating('switch account');
  await page.evaluate(()=>window.multiNest.accountSelect('account-1'));
  await selectedAnimating('switch back');
  assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents&&v.onScreen).length),1,'only the selected game is visible');
  await page.evaluate(()=>window.multiNest.workspaceSelect('empty'));
  await advancing('another workspace');
  const window = await application.browserWindow(page);
  await window.evaluate(w=>w.minimize());
  await delay(200);
  // Chromium's accelerated canvas can stop producing frames when Windows
  // minimizes the surface. Timers must continue, and frames must resume below.
  await advancing('minimized timers', false);
  await window.evaluate(w=>w.restore());
  await delay(200);
  await advancing('restored timers');
  await page.evaluate(()=>window.multiNest.workspaceSelect('games'));
  await selectedAnimating('return to workspace');
  await page.click('#add-account');
  await advancing('modal overlay');
  assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents&&v.onScreen).length),0,'native pages cannot cover a dialog');
  await page.keyboard.press('Escape');
  await selectedAnimating('close modal');
  await page.evaluate(()=>window.multiNest.accountActivity('account-2','visible'));
  await delay(200);
  const ordinary=await application.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().endsWith('#2')).id);
  const before=await frames(); await delay(700); const after=await frames();
  assert.ok(after[ordinary].frames-before[ordinary].frames<=2,'visible-only stops background animation');
  await page.evaluate(()=>window.multiNest.accountActivity('account-2','always'));
  await advancing('resume full activity');
  await page.evaluate(()=>window.multiNest.accountActivity('account-2','suspended'));
  assert.equal(Object.keys(await frames()).length,3,'suspension releases the account renderer');
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  fs.writeFileSync(path.join(root,'test-results','astria-activity.json'),JSON.stringify({passed:true,checks:['four isolated account timers','focus layout animation','account switching animation','workspace switching timers','minimized timers','animation after returning to workspace','modal overlay','visible-only animation pause','return to Always active','suspension'],limitations:['Canvas animation can pause in hidden accounts or while the Windows surface is minimized.']},null,2));
  console.log('PASS: Always active retains account timers; selected animations resume after switching accounts, workspaces and dialogs; suspension still releases renderers');
})().catch(async error=>{console.error(error);if(application)console.error(await application.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {size:w.getContentSize(),minimized:w.isMinimized(),mainThrottle:w.webContents.getBackgroundThrottling(),children:w.contentView.children.map(v=>({id:v.webContents?.id,visible:v.getVisible(),bounds:v.getBounds(),throttle:v.webContents?.getBackgroundThrottling()}))};}));process.exitCode=1;}).finally(async()=>{if(application)await application.close();server.close();});
