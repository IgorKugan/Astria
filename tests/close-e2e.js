'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { createHash } = require('node:crypto');
const { _electron: electron } = require('playwright');
const root = path.resolve(__dirname, '..'), profiles = fs.mkdtempSync(path.join(os.tmpdir(), 'astria-close-'));
let application;
const saved = new Map(), socketSaves = new Map(), lifecycle = [], sockets = new Set();
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost'), id = url.searchParams.get('id');
  if (url.pathname === '/save') {
    let body = ''; request.on('data', chunk => { body += chunk; });
    request.on('end', () => { saved.set(id, JSON.parse(body)); response.end('saved'); }); return;
  }
  if (url.pathname === '/event') { lifecycle.push({ id, event: url.searchParams.get('event') }); response.end('ok'); return; }
  response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  response.end(`<!doctype html><title>Page shutdown fixture</title><script>
    window.gameState=${JSON.stringify(saved.get(id) || { map: 'town', buffs: [] })};
    const socket=new WebSocket(location.origin.replace('http:', 'ws:')+'/live?id=${id}');
    socket.onopen=()=>window.ready=true;
    for(const event of ['beforeunload','pagehide','unload'])addEventListener(event,()=>{
      navigator.sendBeacon('/event?id=${id}&event='+event);
      if(event==='pagehide'){
        socket.send(JSON.stringify(gameState));
        navigator.sendBeacon('/save?id=${id}',JSON.stringify(gameState));
      }
    });
  </script>`);
});
server.on('upgrade', (request, socket) => {
  const id = new URL(request.url, 'http://localhost').searchParams.get('id');
  const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
  let pending = Buffer.alloc(0);
  socket.on('data', chunk => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 2) {
      const opcode = pending[0] & 15, masked = !!(pending[1] & 128);
      let length = pending[1] & 127, offset = 2;
      if (length === 127) { socket.destroy(); return; }
      if (length === 126) { if (pending.length < 4) return; length = pending.readUInt16BE(2); offset = 4; }
      if (length > 4096) { socket.destroy(); return; }
      const end = offset + (masked ? 4 : 0) + length; if (pending.length < end) return;
      const mask = masked ? pending.subarray(offset, offset + 4) : null;
      if (masked) offset += 4;
      const payload = Buffer.from(pending.subarray(offset, end));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      pending = pending.subarray(end);
      if (opcode === 1) socketSaves.set(id, JSON.parse(payload.toString()));
      if (opcode === 8) { socket.end(Buffer.from([0x88, 0])); return; }
    }
  });
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (await fn()) return; await delay(50); }
  throw new Error('Shutdown timeout: ' + label);
}
async function launch(profile) {
  const env = { ...process.env, MULTINEST_USER_DATA: profile }; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ executablePath: process.env.MULTINEST_TEST_EXE || require('electron'), args: process.env.MULTINEST_TEST_EXE ? ['--user-data-dir=' + profile] : [root], env });
  await application.firstWindow();
  await until(() => application.evaluate(async ({ webContents }) => {
    const pages = webContents.getAllWebContents().filter(w => /^http:/.test(w.getURL()));
    return pages.length === 2 && (await Promise.all(pages.map(w => w.executeJavaScript('window.ready===true')))).every(Boolean);
  }), 'two game connections ready');
}
async function close(mode) {
  await application.evaluate(({ app, BaseWindow }, mode) => {
    setTimeout(() => mode === 'quit' ? app.quit() : BaseWindow.getAllWindows()[0].close(), 20);
  }, mode);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const mode of ['window', 'quit']) {
    const profile = path.join(profiles, mode); fs.mkdirSync(profile);
    const ids = [mode + '-a', mode + '-b'];
    fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ activeWorkspaceId: 'games', selectedAccountId: ids[0], workspaces: [{ id: 'games', name: 'Shutdown', layout: 'focus' }], accounts: ids.map(id => ({ id, workspaceId: 'games', name: id, url: base + '/?id=' + id, activity: 'always' })), preferences: { language: 'en' } }));
    await launch(profile);
    await application.evaluate(async ({ webContents }) => {
      for (const contents of webContents.getAllWebContents().filter(w => /^http:/.test(w.getURL()))) await contents.executeJavaScript('gameState={map:"fixture-dungeon",buffs:["fixture-buff"]};true');
    });
    await close(mode);
    await until(() => ids.every(id => saved.has(id) && socketSaves.has(id)), 'server receives both beacon and WebSocket save on ' + mode);
    for (const id of ids) {
      assert.deepEqual(saved.get(id), { map: 'fixture-dungeon', buffs: ['fixture-buff'] });
      assert.deepEqual(socketSaves.get(id), saved.get(id), 'last WebSocket update reaches the server');
      await until(() => ['beforeunload', 'pagehide', 'unload'].every(event => lifecycle.some(entry => entry.id === id && entry.event === event)), 'complete page shutdown lifecycle');
    }
    await application.close(); application = null;
    await launch(profile);
    const restored = await application.evaluate(async ({ webContents }) => Promise.all(webContents.getAllWebContents().filter(w => /^http:/.test(w.getURL())).map(w => w.executeJavaScript('gameState'))));
    assert.ok(restored.every(state => state.map === 'fixture-dungeon' && state.buffs[0] === 'fixture-buff'), 'server-side fixture map and buffs survive closing and relaunching');
    await application.close(); application = null;
  }
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results', 'astria-close.json'), JSON.stringify({ passed: true, checks: ['window close lifecycle', 'app quit/update lifecycle', 'hidden account close lifecycle', 'final WebSocket save', 'sendBeacon save', 'server-side fixture state on relaunch'] }, null, 2));
  console.log('PASS: beforeunload/pagehide/unload, final WebSocket/beacon saves and server-side fixture state survive window close and app restart');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (application) await application.close(); for (const socket of sockets) socket.destroy(); server.close(); });
