'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { _electron: electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astria-layer-'));
let application;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (await check()) return; await delay(50); }
  throw new Error('Layering timeout: ' + label);
}
const server = http.createServer((req, res) => {
  const id = new URL(req.url, 'http://localhost').searchParams.get('id');
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><title>' + id + '</title><style>html,body{margin:0;height:100%;background:' + (id === 'front' ? '#cf4a62' : '#38b7ff') + ';color:white;font:36px system-ui}</style><h1>' + id + '</h1><script>window.framesDrawn=0;function frame(){framesDrawn++;requestAnimationFrame(frame)}requestAnimationFrame(frame)</script>');
});
async function layers() {
  return application.evaluate(({ BaseWindow }) => {
    const window = BaseWindow.getAllWindows()[0];
    const [width, height] = window.getContentSize();
    return window.contentView.children.map(view => ({
      ui: view.webContents === window.webContents,
      url: view.webContents?.getURL(), visible: view.getVisible(), onScreen: !!view.onScreen,
      bounds: view.getBounds(), windowSize: { width, height }
    }));
  });
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({
    activeWorkspaceId: 'front-workspace', selectedAccountId: 'front',
    workspaces: [{ id: 'front-workspace', name: 'Huntera', layout: 'focus' }, { id: 'background-workspace', name: 'YYGIdle', layout: 'focus' }],
    accounts: [
      { id: 'front', name: 'Huntera', workspaceId: 'front-workspace', url: url + '/?id=front', activity: 'always' },
      { id: 'background', name: 'YYGIdle', workspaceId: 'background-workspace', url: url + '/?id=background', activity: 'always' }
    ], preferences: { theme: 'dark', language: 'en' }
  }));
  const env = { ...process.env, MULTINEST_USER_DATA: profile }; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ executablePath: process.env.MULTINEST_TEST_EXE || require('electron'), args: process.env.MULTINEST_TEST_EXE ? ['--user-data-dir=' + profile] : [root], env });
  const page = await application.firstWindow();
  await page.waitForSelector('.panel');
  await until(() => application.evaluate(({ webContents }) => webContents.getAllWebContents().filter(w => /^http:/.test(w.getURL()) && !w.isLoading()).length === 2), 'both games loaded');
  await page.evaluate(() => window.multiNest.accountActivity('front', 'suspended'));
  await page.waitForSelector('.panel-placeholder strong');
  await until(() => application.evaluate(({ webContents }) => !webContents.getAllWebContents().some(w => w.getURL().endsWith('id=front'))), 'suspended renderer closed');
  const suspended = await layers();
  fs.writeFileSync(path.join(output, 'suspend-layers.json'), JSON.stringify(suspended, null, 2));
  const covered = stack => { const ui = stack.findIndex(layer => layer.ui); return ui >= 0 && stack.every((layer,index) => !layer.url?.startsWith('http:') || !layer.visible || index < ui); };
  assert.ok(covered(suspended), 'the actual interface page must cover background games in the suspended panel');
  const before = await application.evaluate(async ({ webContents }) => webContents.getAllWebContents().find(w => w.getURL().endsWith('id=background')).executeJavaScript('framesDrawn'));
  await delay(1800);
  const after = await application.evaluate(async ({ webContents }) => webContents.getAllWebContents().find(w => w.getURL().endsWith('id=background')).executeJavaScript('framesDrawn'));
  assert.ok(after > before, 'Always active background games must keep drawing while the foreground is suspended');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.multiNest.workspaceSelect('background-workspace'));
    await until(async () => (await layers()).some(layer => layer.url?.endsWith('id=background') && layer.onScreen), 'background selected');
    await page.evaluate(() => window.multiNest.workspaceSelect('front-workspace'));
    await page.waitForSelector('.panel-placeholder strong');
    const current = await layers();
    assert.ok(covered(current), 'switching back keeps the suspended panel clear');
  }
  await page.screenshot({ path: path.join(output, 'suspend-panel.png') });
  await page.evaluate(() => window.multiNest.accountActivity('front', 'visible'));
  await until(async () => (await layers()).some(layer => layer.url?.endsWith('id=front') && layer.onScreen), 'resumed game visible');
  await page.click('#add-account');
  await page.waitForSelector('#modal-root:not(.hidden)');
  const modal = await layers();
  assert.ok(covered(modal), 'no game page may overlap the dialog');
  console.log('PASS: suspension and workspace changes isolate background games, background animation continues, resume and dialogs work');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (application) await application.close(); server.close(); });
