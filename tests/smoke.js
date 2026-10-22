'use strict';
/* Lightweight smoke tests for the main process, using mock Electron objects.
   Runs with plain Node.js and never executes the third-party game's code. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { pageMetrics } = require('../src/metrics');
const { hsvToHex, hexToHsv } = require('../src/color');
const { configureStorage } = require('../src/storage');
const storageTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'astria-storage-'));
const configuredPaths = {};
const fakeApp = { isPackaged: true, commandLine: { hasSwitch: () => false }, getPath: () => storageTestRoot, setPath: (key, value) => { configuredPaths[key] = value; }, setAppLogsPath: value => { configuredPaths.logs = value; } };
const fakeExe = path.join(storageTestRoot, 'Astria.exe');
assert.equal(configureStorage(fakeApp, { execPath: fakeExe, env: {} }).portable, false, 'installed mode remains compatible');
assert.equal(configuredPaths.userData, path.join(storageTestRoot, 'MultiNest'));
fs.writeFileSync(path.join(storageTestRoot, 'portable.flag'), '');
assert.equal(configureStorage(fakeApp, { execPath: fakeExe, env: {} }).portable, true);
assert.equal(configuredPaths.userData, path.join(storageTestRoot, 'Save', 'Profile'));
assert.equal(configuredPaths.sessionData, configuredPaths.userData);
fakeApp.commandLine.hasSwitch = () => true;
assert.equal(configureStorage(fakeApp, { execPath: fakeExe, env: {} }).portable, false, 'explicit test profile overrides portable marker');
assert.deepEqual(pageMetrics([{id:'a',pids:[1,1,2]},{id:'b',pids:[2]}],[{pid:1,memory:{workingSetSize:1024},cpu:{percentCPUUsage:10}},{pid:2,memory:{workingSetSize:2048},cpu:{percentCPUUsage:5}}]),{a:{ram:3,cpu:15,shared:true,processes:2},b:{ram:2,cpu:5,shared:true,processes:1}});
assert.equal(hsvToHex(0,1,1),'#ff0000');
assert.equal(hsvToHex(120,1,1),'#00ff00');
assert.equal(hsvToHex(240,1,1),'#0000ff');
for(const color of ['#a78bed','#123abc','#ffffff','#000000']){const hsv=hexToHsv(color);assert.equal(hsvToHex(hsv.h,hsv.s,hsv.v),color);}
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'multinest-smoke-'));
const events = new Map();
let mainWindow;
const allViews = [];
const timers = new Map();
let nextTimer = 0;
class WebContentsMock extends EventEmitter {
  constructor() { super(); this.closed = false; this.u = 'Mozilla/5.0 Electron/44.9.0 Chrome/152'; this.session = { flushStorageData() {} }; }
  setAudioMuted(flag) { this.muted = flag; }
  setZoomFactor(z) { this.zoom = z; }
  setBackgroundThrottling(value) { this.throttled = value; }
  setUserAgent(ua) { this.u = ua; }
  getUserAgent() { return this.u; }
  setWindowOpenHandler(handler) { this.popupHandler = handler; }
  getOSProcessId() { return 100; }
  isDestroyed() { return this.closed; }
  close() { this.closed = true; this.emit('destroyed'); }
  focus() { this.focused = true; }
  loadURL(url) { this.loaded = url; return Promise.resolve(); }
  reload() { this.reloaded = true; }
}
class WebContentsViewMock {
  constructor(options) { this.partition = options.webPreferences.partition; this.webContents = new WebContentsMock(); allViews.push(this); }
  setBounds(bounds) { this.bounds = bounds; }
  setVisible(value) { this.visible = value; }
}
class ViewMock {
  // `native` models the stacking Windows actually draws. Reordering an
  // attached child changes `children` but can leave the native surface where
  // it was; only a fresh attach is guaranteed to restack it.
  constructor() { this.children = []; this.native = []; }
  setBounds(bounds) { this.bounds = bounds; }
  getBounds() { return this.bounds; }
  addChildView(view, index = this.children.length) {
    const fresh = !this.children.includes(view);
    this.children = this.children.filter(child => child !== view);
    this.children.splice(Math.min(index, this.children.length), 0, view);
    if (fresh) this.native.splice(Math.min(index, this.native.length), 0, view);
  }
  removeChildView(view) { this.children = this.children.filter(child => child !== view); this.native = this.native.filter(child => child !== view); }
}
class BrowserWindowMock extends EventEmitter {
  constructor(options) { super(); this.options = options;
    this.contentView = new ViewMock();
    this.webContents = new WebContentsMock(); this.webContents.send = () => {};
    this.destroyed = false; mainWindow = this;
  }
  setContentView(view) { this.contentView = view; }
  loadFile(file) { this.file = file; this.webContents.mainFrame = { url: require('node:url').pathToFileURL(file).href }; }
  isDestroyed() { return this.destroyed; }
  isVisible() { return true; }
  show() { this.emit('show'); }
  isMinimized() { return false; }
  isFocused() { return true; }
  setTitleBarOverlay() {}
  getContentSize() { return [1490, 900]; }
  static getAllWindows() { return [mainWindow]; }
}
const mock = {
  app: Object.assign(new EventEmitter(), {
    commandLine: { appendSwitch() {}, hasSwitch: () => false }, setAppUserModelId() {}, setPath() {}, requestSingleInstanceLock() { return true; }, getPath() { return folder; }, whenReady() { return Promise.resolve(); }, getAppMetrics() { return []; }, quit() {}
  }),
  BrowserWindow: BrowserWindowMock, WebContentsView: WebContentsViewMock, View: ViewMock,
  ipcMain: { handle: (name, fn) => events.set(name, fn), on: (name, fn) => events.set(name, fn) },
  session: { fromPartition: () => ({ protocol: { handle() {} }, setPermissionRequestHandler() {}, setPermissionCheckHandler() {} }) },
  dialog: {}, nativeTheme: {}, protocol: { registerSchemesAsPrivileged() {} }, Menu: { setApplicationMenu() {}, buildFromTemplate: template => ({ popup() {}, template }) }
};
const originalRequire = require;
const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
vm.runInNewContext(script, {
  require: n => n === 'electron' ? mock : originalRequire(n.startsWith('.') ? path.resolve(__dirname,'../src',n) : n),
  __dirname: path.join(__dirname, '..', 'src'), console, process,
  setInterval: () => 0, URL, setImmediate,
  setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; },
  clearTimeout: id => timers.delete(id)
}, { filename: 'main.js' });
async function invoke(channel, ...args) {
  const fn = events.get(channel);
  assert.ok(fn, `${channel} registered`);
  return fn(trustedEvent(), ...args);
}
const trustedEvent = () => ({ sender: mainWindow.webContents, senderFrame: mainWindow.webContents.mainFrame });
(async () => {
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(mainWindow, 'main window exists');
  mainWindow.emit('ready-to-show');
  assert.equal((await invoke('state:get')).state.workspaces[0].name, 'My games');
  assert.equal((await invoke('state:get')).state.preferences.language, 'en');
  assert.equal((await invoke('settings:language','pt-BR')).ok,true);
  assert.equal((await invoke('settings:language','fr')).ok,false);
  assert.equal((await invoke('account:add', {name: 'EK', url: 'example.com'})).ok, true);
  assert.equal((await invoke('account:add', {name: 'Druid', url: 'https://example.com'})).ok, true);
  let state = (await invoke('state:get')).state;
  const ids = state.accounts.map(a => a.id);
  assert.equal(ids.length, 2);
  events.get('layout:update')(trustedEvent(), ids.map((id, i) => ({id, x:260+i*550,y:100,width:520,height:550})));
  assert.equal(allViews.length, 2, 'one browser view per account');
  // Renderers now start in foreground priority, rather than config order.
  allViews.sort((a,b)=>ids.indexOf(a.partition.slice('persist:multinest-'.length))-ids.indexOf(b.partition.slice('persist:multinest-'.length)));
  assert.notEqual(allViews[0].partition, allViews[1].partition, 'isolated partition per account');
  assert.ok(allViews.every(v => v.partition.startsWith('persist:')));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(allViews[0].webContents.loaded, 'https://example.com/');
  assert.equal(mainWindow.contentView.children.filter(v => v instanceof WebContentsViewMock).length, 2);
  assert.equal((await invoke('view:mute', ids[0])).ok, true);
  assert.equal(allViews[0].webContents.muted, true);
  assert.equal((await invoke('view:zoom', ids[0], 0.1)).ok, true);
  assert.equal(allViews[0].webContents.zoom, 1.1);
  assert.equal((await invoke('account:rename', ids[0], 'Minha EK')).ok, true);
  assert.equal((await invoke('account:color', ids[0], 'violet')).ok, true);
  assert.equal((await invoke('account:color', ids[0], '#123AbC')).ok, true);
  assert.equal((await invoke('account:color', ids[0], 'invalid')).ok, false);
  assert.equal((await invoke('account:color', ids[0], 'constructor')).ok, false);
  assert.equal((await invoke('settings:sidebar-width', 240)).ok, true);
  assert.equal((await invoke('state:get')).state.preferences.sidebarWidth,240);
  await invoke('settings:sidebar-width', 10);
  assert.equal((await invoke('state:get')).state.preferences.sidebarWidth,44);
  assert.equal((await invoke('settings:sidebar-width', NaN)).ok, false);
  assert.equal((await invoke('account:activity', ids[0], 'always')).ok, true);
  assert.equal(allViews[0].webContents.throttled, false);
  assert.equal((await invoke('view:zoom', ids[0], NaN)).ok, false);
  assert.equal((await invoke('account:add', { url: 'javascript:alert(1)' })).ok, false);
  assert.equal((await invoke('account:add', { url: '' })).ok, false);
  assert.equal((await events.get('state:get')({ sender: {}, senderFrame: {} })).ok, false, 'reject untrusted IPC');
  assert.equal(allViews[0].webContents.popupHandler({ url: 'file:///C:/Windows/win.ini' }).action, 'deny');
  assert.equal((await invoke('account:add', {name: 'invalid', url: 'not a url !!!'})).ok, false);
  // Bring the Always active game on screen, then send it to the background.
  // Each move must restack the drawn surface, not only the requested order;
  // otherwise the background game shows through a suspended or empty panel.
  events.get('layout:update')(trustedEvent(), [{ id: ids[0], x: 260, y: 100, width: 520, height: 550 }]);
  {
    const root = mainWindow.contentView, ui = root.children.find(v => !(v instanceof WebContentsViewMock));
    assert.ok(root.native.indexOf(allViews[0]) > root.native.indexOf(ui), 'on-screen game is drawn above the interface');
    assert.deepEqual(root.native, root.children, 'drawn stacking matches the requested order');
  }
  assert.equal((await invoke('workspace:add', 'Second workspace')).ok, true);
  state = (await invoke('state:get')).state;
  assert.equal(state.workspaces.length, 2);
  assert.equal(mainWindow.contentView.children.filter(v => v instanceof WebContentsViewMock).length, 1, 'Always active view remains attached behind the interface');
  assert.equal(allViews[0].visible, true, 'Always active surface is not hidden');
  {
    const root = mainWindow.contentView, ui = root.children.find(v => !(v instanceof WebContentsViewMock));
    assert.ok(root.native.indexOf(allViews[0]) < root.native.indexOf(ui), 'background game is drawn below the interface');
    assert.deepEqual(root.native, root.children, 'drawn stacking matches the requested order');
  }
  for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
  assert.equal(allViews[0].webContents.closed, false, 'always-active survives hiding');
  assert.equal(allViews[1].webContents.closed, true, 'visible-only releases the hidden renderer');
  assert.equal((await invoke('account:activity', ids[0], 'suspended')).ok, true);
  assert.equal(allViews[0].webContents.closed, true, 'manual suspension releases renderer immediately');
  const beforeReload = allViews.length;
  assert.equal((await invoke('view:reload', ids[0])).ok, false);
  assert.equal(allViews.length, beforeReload, 'reload cannot wake suspended account');
  assert.ok(fs.existsSync(path.join(folder, 'config.json')), 'configuration persisted');
  assert.equal((await invoke('workspace:select', 'games')).ok, true);
  assert.equal((await invoke('account:delete', ids[1])).ok, true);
  assert.equal((await invoke('state:get')).state.accounts.length, 1);
  state = (await invoke('state:get')).state;
  assert.equal(state.accounts[0].name, 'Minha EK');
  assert.equal(state.accounts[0].color, '#123abc');
  assert.equal(state.accounts[0].activity, 'suspended');
  console.log('PASS: accounts, persistence, isolation, trusted IPC, colors, names and activity lifecycle');
})().catch(error => { console.error(error); process.exitCode = 1; });
