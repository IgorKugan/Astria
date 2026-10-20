'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { gzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { _electron: electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'an-'));
const requests = [];
let app, page, base;
const server = http.createServer((req, res) => {
  requests.push({ path: req.url, cookie: req.headers.cookie || '', authorization: req.headers.authorization || '' });
  if (req.url === '/assets/shared.js?v=1') {
    res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'public,max-age=3600' }); res.end('window.sharedGameAsset="ok";');
  } else if (req.url === '/assets/worker.js') {
    res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'public,max-age=3600' }); res.end('self.onmessage=async()=>self.postMessage(await(await fetch("/assets/shared.js?v=1")).text());');
  } else if (req.url === '/assets/private.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'private,no-store' }); res.end('private:' + (req.headers.cookie || 'anonymous'));
  } else if (req.url === '/assets/cookie.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public,max-age=3600', 'set-cookie': 'assetCookie=one;Path=/' }); res.end('cookie:' + (req.headers.cookie || 'anonymous'));
  } else if (req.url === '/api/who') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ cookie: req.headers.cookie || '' }));
  } else if (req.url === '/api/compressed') {
    res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip', 'cache-control': 'no-store' }); res.end(gzipSync(JSON.stringify({ cookie: req.headers.cookie || '' })));
  } else if (req.url === '/hop') { res.writeHead(302, { location: '/after-login' }); res.end();
  } else if (req.url === '/login' && req.method === 'POST') {
    let body = ''; req.on('data', data => { body += data; }); req.on('end', () => { res.writeHead(302, { 'set-cookie': `fixture=${body};Path=/;Max-Age=3600`, location: '/after-login' }); res.end(); });
  } else if (req.url === '/after-login') { res.end('<!doctype html><title>Logged in</title><p>Redirected safely</p>'); }
  else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>Shared cache fixture</title><script src="/assets/shared.js?v=1"></script><p>Fixture</p>'); }
});
server.on('upgrade', (req, socket) => {
  requests.push({ path: '/ws', cookie: req.headers.cookie || '' });
  const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.write(Buffer.from([0x81, 2, 111, 107]));
  socket.on('data', () => socket.end()); socket.on('error', () => {});
});
async function until(fn, description) {
  for (let i = 0; i < 150; i++) { const value = await fn(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 100)); }
  if (app) console.log(await app.evaluate(({ webContents }) => webContents.getAllWebContents().map(w => ({ url: w.getURL(), loading: w.isLoading() }))));
  throw new Error('Timeout: ' + description);
}
async function launch() {
  const env = { ...process.env, MULTINEST_USER_DATA: profile }; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ executablePath: process.env.MULTINEST_TEST_EXE || require('electron'), args: process.env.MULTINEST_TEST_EXE ? ['--user-data-dir=' + profile] : [root], env });
  page = await app.firstWindow(); await page.waitForSelector('#grid .empty, #grid .panel');
  await app.evaluate(({ app }) => { globalThis.fixtureErrors = []; app.on('web-contents-created', (_e, w) => w.on('console-message', (...args) => globalThis.fixtureErrors.push(args.map(a => typeof a === 'string' ? a : a?.message || '').join(' ')))); });
}
async function views() { return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.filter(v => v.webContents?.getURL().startsWith('http://127.0.0.1:') && !v.webContents.isLoading()).map(v => v.webContents.id)); }
async function inView(id, script) { return app.evaluate(({ webContents }, { id, script }) => webContents.fromId(id).executeJavaScript(script), { id, script }); }
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  await launch();
  for (let i = 0; i < 2; i++) assert.equal((await page.evaluate(url => window.multiNest.accountAdd({ name: 'Isolated', url }), base)).ok, true);
  let ids = await until(async () => { const value = await views(); return value.length === 2 && value; }, 'two loaded pages');
  for (const id of ids) assert.equal(await inView(id, 'window.sharedGameAsset'), 'ok');
  assert.equal(requests.filter(r => r.path === '/assets/shared.js?v=1').length, 2, 'native script cached independently for each account');
  for (let i = 0; i < ids.length; i++) {
    await inView(ids[i], `document.cookie='identity=${i};Max-Age=3600;Path=/';true`);
    assert.equal((await inView(ids[i], 'fetch("/api/who").then(r=>r.json())')).cookie, 'identity=' + i);
    assert.equal((await inView(ids[i], 'fetch("/api/compressed").then(r=>r.json())')).cookie, 'identity=' + i);
    const omitted = await inView(ids[i], 'fetch("/api/who",{credentials:"omit"}).then(r=>r.json())');
    assert.equal(omitted.cookie, '');
    assert.equal(await inView(ids[i], `new Promise((resolve,reject)=>{const s=new WebSocket('${base.replace('http:', 'ws:')}/ws');s.onmessage=e=>{resolve(e.data);s.close();};s.onerror=()=>reject(new Error('WebSocket failed'));})`), 'ok');
    assert.equal(await inView(ids[i], 'fetch("/assets/private.png").then(r=>r.text())'), 'private:identity=' + i);
    assert.equal(await inView(ids[i], 'fetch("/assets/cookie.png").then(r=>r.text())'), 'cookie:identity=' + i);
    const status = await inView(ids[i], `fetch('/login',{method:'POST',body:'user${i}'}).then(r=>({status:r.status,url:r.url}))`);
    assert.equal(status.status, 200);
    assert.equal(status.url, base + '/after-login');
    assert.match(await inView(ids[i], 'document.cookie'), new RegExp('fixture=user' + i));
    assert.doesNotMatch(await inView(ids[i], 'document.cookie'), new RegExp('fixture=user' + (1 - i)));
    const workerResult = await inView(ids[i], 'new Promise((resolve,reject)=>{const w=new Worker("/assets/worker.js");w.onmessage=e=>{resolve(e.data);w.terminate();};w.onerror=e=>reject(new Error(e.message));w.postMessage("load");})');
    assert.ok(workerResult.includes('sharedGameAsset'));
  }
  assert.equal(requests.filter(r => r.path === '/assets/worker.js').length, 2, 'workers use their own account cache');
  const anonymous = requests.filter(r => r.path === '/assets/shared.js?v=1');
  assert.ok(anonymous.every(r => !r.cookie && !r.authorization));
  const before = anonymous.length;
  await app.evaluate(({ webContents }, { id, url }) => webContents.fromId(id).loadURL(url), { id: ids[0], url: base + '/hop' });
  assert.equal(await app.evaluate(({ webContents }, id) => webContents.fromId(id).getURL(), ids[0]), base + '/after-login');
  await app.close(); app = null;
  await launch(); ids = await until(async () => { const value = await views(); return value.length === 2 && value; }, 'restart');
  assert.equal(requests.filter(r => r.path === '/assets/shared.js?v=1').length, before, 'both native caches persist across restart');
  for (let i = 0; i < ids.length; i++) assert.match(await inView(ids[i], 'document.cookie'), new RegExp('fixture=user' + i));
  fs.writeFileSync(path.join(root, 'test-results', 'astria-native-cache.json'), JSON.stringify({ passed: true, checks: ['separate native HTTP caches', 'private API cookies isolated', 'credential omission respected', 'compressed private responses', 'WebSocket session isolation', 'worker cache isolation', 'private responses', 'Set-Cookie responses', 'POST login and redirect', 'document redirect URL preserved', 'session cookies preserved on restart', 'both native caches preserved on restart'] }, null, 2));
  console.log('PASS: native per-account caches, private requests, workers, WebSockets, POST login, redirects and cookies isolated across restart');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (app) await app.close(); server.close(); });
