'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { _electron: electron } = require('playwright');
const { version } = require('../package.json');

const root = path.resolve(__dirname, '..');
const distribution = process.env.ASTRIA_PORTABLE_DIR || path.join(root, 'dist', `Astria-Portable-${version}`);
// Chromium cache filenames can exceed Windows path limits in a deeply nested folder.
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-'));
let directory = path.join(testRoot, 'Astria');
fs.cpSync(process.env.ASTRIA_OLD_PORTABLE || distribution, directory, { recursive: true });
let application, page;
let assetDownloads = 0;
const server = http.createServer((req, res) => {
  if (req.url === '/public/game.js') {
    assetDownloads++;
    res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'public,max-age=3600' });
    res.end('window.portableAsset="shared";');
  } else if (req.url === '/save') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="saved-game.json"');
    res.end('{"level":42}');
  } else {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><title>Portable fixture</title><script src="/public/game.js"></script><h1>Portable game</h1>');
  }
});
async function until(fn, description) {
  for (let i = 0; i < 150; i++) {
    const value = await fn();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timeout: ' + description);
}
async function relocate(from, to) {
  for (const target of [from, to]) {
    const relative = path.relative(testRoot, path.resolve(target));
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'relocation stays inside the temporary test folder');
  }
  const deadline = Date.now() + 10000;
  for (;;) {
    try { fs.renameSync(from, to); return; }
    catch (error) {
      // Windows can briefly retain executable/cache handles after app.quit().
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
async function launch() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.MULTINEST_USER_DATA;
  application = await electron.launch({ executablePath: path.join(directory, 'Astria.exe'), env });
  page = await application.firstWindow();
  await page.waitForSelector('#grid .empty, #grid .panel');
  await page.evaluate(()=>window.multiNest.language?.('pt-BR'));
  const paths = await application.evaluate(({ app }) => Object.fromEntries(['userData', 'sessionData', 'downloads', 'logs', 'crashDumps', 'temp'].map(key => [key, app.getPath(key)])));
  assert.equal(paths.userData, path.join(directory, 'Save', 'Profile'));
  assert.equal(paths.sessionData, paths.userData);
  assert.equal(paths.downloads, path.join(directory, 'Save', 'Games'));
  assert.equal(paths.logs, path.join(directory, 'Save', 'Logs'));
  assert.equal(paths.crashDumps, path.join(directory, 'Save', 'CrashDumps'));
  assert.equal(paths.temp, path.join(directory, 'Save', 'Temp'));
  assert.deepEqual(await application.evaluate(() => [process.env.TEMP, process.env.TMP]), [paths.temp, paths.temp]);
}
async function views() {
  return application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.filter(v => v.webContents?.getURL().startsWith('http://127.0.0.1:') && !v.webContents.isLoading()).map(v => v.webContents.id));
}
async function inView(id, script) {
  return application.evaluate(async ({ webContents }, { id, script }) => {
    const result = await webContents.fromId(id).executeJavaScript(`(async()=>{try{return {value:await (${script})};}catch(e){return {error:String(e),stack:e?.stack};}})()`);
    if (result.error) throw new Error(result.error + '\n' + result.stack);
    return result.value;
  }, { id, script });
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  await launch();
  for (let i = 0; i < 2; i++) {
    const result = await page.evaluate(({ name, url }) => window.multiNest.accountAdd({ name, url }), { name: `Portable ${i}`, url });
    if (!result.ok) console.error('Packaged fixture diagnostic:', await application.evaluate(({app,BrowserWindow})=>({exe:app.getPath('exe'),source:app.getAppPath(),url:BrowserWindow.getAllWindows()[0].webContents.getURL()})), result.error);
    assert.equal(result.ok, true, result.error || 'fixture account creation');
  }
  let ids = await until(async () => { const values = await views(); return values.length === 2 && values; }, 'two portable panels');
  for (let i = 0; i < ids.length; i++) {
    await until(async () => await inView(ids[i], 'document.readyState') === 'complete', 'fixture load');
    await inView(ids[i], `(async()=>{document.cookie='portable=${i}; Max-Age=86400; Path=/'; localStorage.setItem('portable','${i}'); await new Promise((resolve,reject)=>{const r=indexedDB.open('portable',1); r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>{const db=r.result;const t=db.transaction('data','readwrite');t.objectStore('data').put('${i}','identity');t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};r.onerror=()=>reject(r.error);});await(await caches.open('portable')).put('/portable',new Response('${i}'));return true;})()`);
  }
  const account = (await page.evaluate(() => window.multiNest.getState())).state.accounts[0];
  if (process.env.ASTRIA_OLD_PORTABLE) assert.ok(assetDownloads >= 1 && assetDownloads <= 2, 'previous version loaded both fixture accounts');
  else assert.equal(assetDownloads, 2, 'native cache stays separate for each portable account');
  const initialDownloads = assetDownloads;
  const location = await application.evaluate(({ session }, id) => session.fromPartition('persist:multinest-' + id).storagePath, account.id);
  assert.equal(location, path.join(directory, 'Save', 'Profile', 'Partitions', 'multinest-' + account.id));
  if (!process.env.ASTRIA_TEST_AUTO_SAVE) console.log('Native download check: confirm Save in the saved-game.json dialog (default folder: Save\\Games).');
  if (process.env.ASTRIA_TEST_AUTO_SAVE) await application.evaluate(({ session }, { id, target }) => {
    session.fromPartition('persist:multinest-' + id).once('will-download', (_event, item) => item.setSavePath(target));
  }, { id: account.id, target: path.join(directory, 'Save', 'Games', 'saved-game.json') });
  const downloaded = await application.evaluate(({ session }, { id, url }) => new Promise((resolve, reject) => {
    const ses = session.fromPartition('persist:multinest-' + id);
    ses.once('will-download', (_event, item) => item.once('done', (_e, state) => state === 'completed' ? resolve(item.getSavePath()) : reject(new Error(state))));
    ses.downloadURL(url + 'save');
  }), { id: account.id, url });
  assert.equal(downloaded, path.join(directory, 'Save', 'Games', 'saved-game.json'));
  assert.deepEqual(JSON.parse(fs.readFileSync(downloaded, 'utf8')), { level: 42 });
  const guide = fs.readFileSync(path.join(directory, 'Save', 'LEIA-ME.txt'), 'utf8');
  assert.ok(guide.includes('Portable 0') && guide.includes('Portable 1') && guide.includes(account.id));
  await application.evaluate(({ Menu, shell, dialog }) => {
    Menu.prototype.popup = function () { globalThis.testMenu = this; };
    shell.openPath = async folder => { globalThis.openedFolder = folder; return ''; };
    dialog.showSaveDialog = async (_parent, options) => { globalThis.exportOptions = options; return { canceled: true }; };
  });
  await page.click('#app-menu');
  await application.evaluate(({ BrowserWindow }) => globalThis.testMenu.items.find(i => i.label === 'Abrir pasta Save').click(null, BrowserWindow.getAllWindows()[0], {}));
  assert.equal(await application.evaluate(() => globalThis.openedFolder), path.join(directory, 'Save'));
  await application.evaluate(({ BrowserWindow }) => globalThis.testMenu.items.find(i => i.label === 'Exportar configuração…').click(null, BrowserWindow.getAllWindows()[0], {}));
  await until(async () => await application.evaluate(() => !!globalThis.exportOptions), 'export dialog options');
  assert.equal(await application.evaluate(() => globalThis.exportOptions.defaultPath), path.join(directory, 'Save', 'Backups', 'astria-config.json'));
  await application.close(); application = null;
  if (process.env.ASTRIA_OLD_PORTABLE) {
    // Match a user's manual update: replace program files while excluding Save.
    fs.cpSync(distribution, directory, { recursive: true, filter: source => {
      const relative = path.relative(distribution, source);
      return relative.split(path.sep)[0].toLowerCase() !== 'save';
    } });
    console.log('PASS: manual program-file replacement preserved the existing Save folder');
  }
  const relocated = path.join(testRoot, 'Cópia ~ 2');
  await relocate(directory, relocated);
  directory = relocated;
  await launch();
  assert.equal(await application.evaluate(({app})=>app.getVersion()),version);
  ids = await until(async () => { const values = await views(); return values.length === 2 && values; }, 'relocated panels');
  for (let i = 0; i < ids.length; i++) {
    await until(async () => await inView(ids[i], 'document.readyState') === 'complete', 'relocated fixture');
    const stored = await inView(ids[i], `(async()=>({cookie:document.cookie, local:localStorage.getItem('portable'), indexed:await new Promise((resolve,reject)=>{const r=indexedDB.open('portable');r.onsuccess=()=>{const db=r.result,q=db.transaction('data').objectStore('data').get('identity');q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}),cache:await(await(await caches.open('portable')).match('/portable')).text()}))()`);
    assert.deepEqual(stored, { cookie: 'portable=' + i, local: String(i), indexed: String(i), cache: String(i) });
  }
  assert.ok(fs.existsSync(path.join(directory, 'Save', 'Games', 'saved-game.json')));
  if (process.env.ASTRIA_OLD_PORTABLE) assert.ok(assetDownloads <= initialDownloads + 2, 'upgrading to native cache may download once per account');
  else assert.equal(assetDownloads, 2, 'both per-account caches move without redownload');
  for (const id of ids) assert.equal(await inView(id, 'window.portableAsset'), 'shared');
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results', 'astria-portable.json'), JSON.stringify({ passed: true, version, testRoot, movedTo: directory, checks: ['no installer', 'relative Save folder', 'temporary paths inside Save', 'downloads to Games', 'account data guide', 'open Save menu', 'config export path', 'folder relocation with spaces and Unicode', 'cookie isolation and persistence', 'localStorage', 'IndexedDB', 'CacheStorage', 'saved game file preserved', 'native per-account caches moved without redownload'] }, null, 2));
  console.log('PASS: portable Save paths, game downloads, menu and backup export');
  console.log('PASS: moved folder preserves two isolated profiles, cookies, localStorage, IndexedDB and CacheStorage');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (application) await application.close();
  server.close();
});
