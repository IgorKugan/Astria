'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { _electron: electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astria-browser-'));
let application, page;
const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'text/html');
  if (request.url === '/inner') { response.end('<!doctype html><input id="nested-chat"><script>window.frameKeys=[];document.addEventListener("keydown",e=>frameKeys.push(e.key));</script>'); return; }
  response.end(`<!doctype html><title>Browser behavior fixture</title><input id="chat"><canvas></canvas><iframe src="/inner"></iframe><script>
    window.initialViewport={width:innerWidth,height:innerHeight};
    window.instance=crypto.randomUUID();window.keys=[];
    window.gameState={map:location.hash,buffs:['fixture-buff']};
    document.addEventListener('keydown',e=>keys.push(e.key));
  </script>`);
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await delay(50); }
  throw new Error('Browser behavior timeout: ' + label);
}
async function inGame(id, script) {
  return application.evaluate(({ webContents }, { id, script }) => {
    const contents = webContents.getAllWebContents().find(w => w.getURL().endsWith('#' + id));
    return contents.executeJavaScript(script);
  }, { id, script });
}
async function focusedGame(id) {
  return application.evaluate(({ webContents }, id) => webContents.getFocusedWebContents()?.getURL().endsWith('#' + id) || false, id);
}
async function key(keyCode, modifiers = []) {
  await application.evaluate(({ webContents }, input) => {
    const contents = webContents.getFocusedWebContents();
    if (!contents) throw new Error('No focused web contents');
    contents.sendInputEvent({ type: 'keyDown', ...input });
    contents.sendInputEvent({ type: 'keyUp', ...input });
  }, { keyCode, modifiers });
  await delay(80);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({
    activeWorkspaceId: 'games', selectedAccountId: 'front',
    workspaces: [{ id: 'games', name: 'Games', layout: 'focus' }, { id: 'other', name: 'Other', layout: 'focus' }],
    accounts: ['front', 'background', 'other'].map(id => ({ id, workspaceId: id === 'other' ? 'other' : 'games', name: id, url: base + '#' + id, activity: 'always' })),
    preferences: { language: 'en' }
  }));
  const env = { ...process.env, MULTINEST_USER_DATA: profile }; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ executablePath: process.env.MULTINEST_TEST_EXE || require('electron'), args: process.env.MULTINEST_TEST_EXE ? ['--user-data-dir=' + profile] : [root], env });
  page = await application.firstWindow(); await page.waitForSelector('.account-link');
  await until(() => application.evaluate(({ webContents }) => webContents.getAllWebContents().filter(w => /^http:/.test(w.getURL()) && !w.isLoading()).length === 3), 'three pages loaded');
  const snapshots = {};
  for (const id of ['front', 'background', 'other']) {
    snapshots[id] = await inGame(id, '({initialViewport,instance,gameState})');
    assert.ok(snapshots[id].initialViewport.width >= 100 && snapshots[id].initialViewport.height >= 75, id + ': usable viewport on the FIRST script execution, including hidden accounts');
  }
  assert.equal(await application.evaluate(({ Menu }) => Menu.getApplicationMenu()), null, 'no implicit application menu with close accelerators');
  for (const id of ['background', 'front', 'background']) {
    await page.locator('.account-link[data-id="' + id + '"] .row-label').click();
    await until(() => focusedGame(id), 'sidebar click focuses ' + id);
    const before = await inGame(id, 'keys.length');
    await key('W');
    assert.equal(await inGame(id, 'keys.length'), before + 1, 'game receives W without a second click');
    for (const modifiers of [['control'], ['alt'], ['control', 'shift']]) {
      await key('W', modifiers);
      assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1, 'close shortcut must not close the app');
    }
    assert.equal(await inGame(id, 'keys.filter(k=>k.toLowerCase()==="w").length'), before + 1, 'blocked close chords do not reach the game');
    assert.deepEqual(await inGame(id, '({initialViewport,instance,gameState})'), snapshots[id], 'switching preserves the page, map and buffs in memory');
  }
  await inGame('background', 'document.querySelector("iframe").contentDocument.querySelector("#nested-chat").focus();true');
  await page.locator('.account-link[data-id="front"] .row-label').click();
  await until(() => focusedGame('front'), 'leave nested game frame');
  await page.locator('.account-link[data-id="background"] .row-label').click();
  await until(() => focusedGame('background'), 'return to nested game frame');
  await key('W');
  assert.equal(await inGame('background', 'document.querySelector("iframe").contentWindow.frameKeys.length'), 1, 'returning to an embedded game restores keyboard input in its iframe');
  await page.locator('.workspace-item[data-id="other"]').click();
  await until(() => focusedGame('other'), 'workspace click focuses its page');
  await key('W');
  assert.ok((await inGame('other', 'keys')).includes('w'), 'workspace game immediately receives keyboard input');
  await page.locator('#add-account').click();
  await page.waitForSelector('#account-name');
  for (const modifiers of [['control'], ['alt'], ['control', 'shift']]) await key('W', modifiers);
  await page.fill('#account-name', 'Typing stays in the dialog');
  await page.evaluate(() => window.multiNest.language('pt-BR'));
  assert.equal(await page.inputValue('#account-name'), 'Typing stays in the dialog', 'unrelated state/layout updates do not steal dialog focus');
  assert.equal(await application.evaluate(({ webContents }) => webContents.getFocusedWebContents().getURL().startsWith('file:')), true, 'dialog keeps focus in Astria UI');
  await page.locator('[data-close]').click();
  await until(() => focusedGame('other'), 'closing dialog restores the game focus');
  await inGame('other', 'document.querySelector("#chat").focus();true');
  await page.evaluate(() => window.multiNest.accountRename('other', 'Renamed'));
  await delay(150);
  assert.equal(await inGame('other', 'document.activeElement.id'), 'chat', 'ordinary updates preserve the game chat caret');
  for (const id of ['front', 'background', 'other']) assert.deepEqual(await inGame(id, '({initialViewport,instance,gameState})'), snapshots[id], 'no hidden account is reloaded on a switch');
  await inGame('other', 'window.open(location.origin+"/#popup");true');
  await until(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 2), 'game popup');
  await until(() => focusedGame('popup'), 'popup focus');
  for (const modifiers of [['control'], ['alt'], ['control', 'shift']]) {
    await key('W', modifiers);
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 2, 'close shortcut must not close a game popup');
  }
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#popup')).close());
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results', 'astria-browser-behavior.json'), JSON.stringify({ passed: true, checks: ['usable initial hidden viewport', 'sidebar keyboard focus', 'embedded game iframe focus', 'workspace keyboard focus', 'Ctrl+W/Alt+W/Ctrl+Shift+W blocked in games, UI and popups', 'ordinary W preserved', 'dialog focus', 'chat focus', 'page/map/buff state preserved across switches'] }, null, 2));
  console.log('PASS: browser viewport, immediate account keyboard focus, close shortcuts blocked, dialog/chat focus and unchanged live game state');
})().catch(async error => {
  console.error(error); process.exitCode = 1;
  if (application) console.error(await application.evaluate(({ BrowserWindow, webContents }) => ({ focused: webContents.getFocusedWebContents()?.getURL(), windows: BrowserWindow.getAllWindows().map(w => ({ focused: w.isFocused(), visible: w.isVisible(), children: w.contentView.children.filter(v => v.webContents).length })) })).catch(() => 'Application unavailable'));
}).finally(async () => { if (application) await application.close(); server.close(); });
