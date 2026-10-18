'use strict';

const { app, BrowserWindow, WebContentsView, ipcMain, session, dialog, nativeTheme, Menu, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { pageMetrics } = require('./metrics');
const { configureStorage, writeAccountGuide } = require('./storage');
const { SharedAssets } = require('./shared-assets');
const { Updates } = require('./updates');
const releaseConfig = require('./release-config.json');
const appVersion = require('../package.json').version;

let storage;
try { storage = configureStorage(app); }
catch (error) {
  dialog.showErrorBox('Astria — pasta sem acesso', 'Não foi possível abrir a pasta Save. Mova a pasta Astria para um local com permissão de gravação.\n\n' + error.message);
  app.exit(1);
}

app.setAppUserModelId('com.multinest.desktop');

let windowMain;
let state;
let configPath;
let overlayOpen = false;
let metricsTimer;
let sharedAssets;
let updates;
const views = new Map();
const viewStatuses = new Map();
const boundsForAccounts = new Map();
const idleTimers = new Map();
const actions = new Map();
const activityModes = new Set(['always', 'visible', 'suspended']);
const colors = { mint: '#46bfa8', blue: '#559ce8', violet: '#a78bed', amber: '#d7a744', rose: '#d981b0', red: '#e97778', slate: '#91a2b8' };
const normalizeColor = color => typeof color === 'string' && /^#[a-f\d]{6}$/i.test(color) ? color.toLowerCase() : typeof color === 'string' && Object.hasOwn(colors, color) ? colors[color] : null;
const sidebarWidth = value => Math.max(44, Math.min(320, Math.round(value)));
const idleDelay = !app.isPackaged && process.env.ASTRIA_IDLE_MS ? Math.max(50, Number(process.env.ASTRIA_IDLE_MS) || 60000) : 60000;
const modeFor = account => activityModes.has(account.activity) ? account.activity : 'visible';

const initialConfig = () => ({
  version: 1,
  activeWorkspaceId: 'games',
  selectedAccountId: null,
  workspaces: [{ id: 'games', name: 'Meus jogos', layout: 'auto' }],
  accounts: [],
  preferences: { theme: 'dark', sidebarWidth: 152 }
});

const allowedLayouts = new Set(['auto', 'columns', 'rows', 'focus']);
const safeString = (s, max = 120) => String(s ?? '').trim().slice(0, max);
const hasId = (id) => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);

function safeURL(value) {
  let input = safeString(value, 2048);
  if (!input || (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:/i.test(input) && !/^[\w.-]+:\d+(?:\/|$)/.test(input))) {
    throw new Error('Informe um endereço http/https válido.');
  }
  if (!/^https?:\/\//i.test(input)) input = 'https://' + input;
  let url;
  try { url = new URL(input); } catch { throw new Error('URL inválida.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Apenas sites http/https são permitidos.');
  if (!url.hostname || url.username || url.password) throw new Error('URL inválida ou contém credenciais.');
  return url.toString();
}

function normalizeImport(json) {
  if (!json || !Array.isArray(json.workspaces) || !Array.isArray(json.accounts)) {
    throw new Error('Arquivo de configuração inválido.');
  }
  const used = new Set();
  const workspaces = [];
  for (const w of json.workspaces.slice(0, 100)) {
    if (!w || typeof w !== 'object') continue;
    const id = hasId(w.id) && !used.has(w.id) ? w.id : randomUUID();
    used.add(id);
    workspaces.push({ id, name: safeString(w.name, 55) || 'Espaço', layout: allowedLayouts.has(w.layout) ? w.layout : 'auto' });
  }
  if (!workspaces.length) workspaces.push({ id: randomUUID(), name: 'Meus jogos', layout: 'auto' });
  const wIds = new Set(workspaces.map(w => w.id));
  const accounts = [];
  for (const a of json.accounts.slice(0, 300)) {
    if (!a || typeof a !== 'object') continue;
    if (!wIds.has(a.workspaceId)) continue;
    try {
      const id = hasId(a.id) && !used.has(a.id) ? a.id : randomUUID();
      used.add(id);
      accounts.push({ id, workspaceId: a.workspaceId, name: safeString(a.name, 55) || 'Conta', url: safeURL(a.url), muted: !!a.muted, zoom: Math.max(0.5, Math.min(2, Number(a.zoom) || 1)), color: normalizeColor(a.color) || colors.mint, activity: modeFor(a) });
    } catch { /* skip malformed or unsupported entry */ }
  }
  return {
    version: 1,
    activeWorkspaceId: wIds.has(json.activeWorkspaceId) ? json.activeWorkspaceId : workspaces[0].id,
    selectedAccountId: accounts.some(a => a.id === json.selectedAccountId) ? json.selectedAccountId : null,
    workspaces, accounts,
    preferences: { theme: json.preferences?.theme === 'light' ? 'light' : 'dark', sidebarWidth: Number.isFinite(json.preferences?.sidebarWidth) ? sidebarWidth(json.preferences.sidebarWidth) : json.preferences?.sidebarCollapsed ? 44 : 152 }
  };
}

function loadState() {
  configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    return normalizeImport(JSON.parse(fs.readFileSync(configPath, 'utf8')));
  } catch (err) {
    if (fs.existsSync(configPath)) {
      try { fs.copyFileSync(configPath, configPath + '.backup-' + Date.now()); } catch { /* ignore */ }
      console.warn('Configuração inválida; cópia de segurança criada:', err.message);
    }
    return initialConfig();
  }
}

function persistState() {
  const temp = configPath + '.tmp';
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(temp, configPath);
  writeAccountGuide(storage, state);
}

function currentAccounts() {
  return state.accounts.filter(a => a.workspaceId === state.activeWorkspaceId);
}

function publish() {
  persistState();
  if (windowMain && !windowMain.isDestroyed()) windowMain.webContents.send('state:updated', state);
  refreshViews();
}

function setStatus(id, patch) {
  const previous = viewStatuses.get(id) || {};
  if (Object.entries(patch).every(([key, value]) => previous[key] === value)) return;
  viewStatuses.set(id, { ...viewStatuses.get(id), ...patch });
  if (windowMain && !windowMain.isDestroyed()) {
    windowMain.webContents.send('view:status', { id, ...viewStatuses.get(id) });
  }
}

function makeView(account) {
  if (views.has(account.id)) return views.get(account.id);
  if (modeFor(account) === 'suspended') return null;
  const partition = `persist:multinest-${account.id}`;
  const siteSession = session.fromPartition(partition, { cache: true });
  if (storage.portable) siteSession.setDownloadPath(storage.games);
  // Untrusted pages cannot access Node/Electron or request privileged OS permissions.
  siteSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  siteSession.setPermissionCheckHandler(() => false);
  siteSession.setDevicePermissionHandler?.(() => false);
  const view = new WebContentsView({
    webPreferences: {
      partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: modeFor(account) !== 'always',
      javascript: true
    }
  });
  sharedAssets?.attachView(view.webContents);
  views.set(account.id, view);
  view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
  view.webContents.setAudioMuted(!!account.muted);
  view.webContents.setZoomFactor(Number(account.zoom) || 1);

  // Use the regular Chromium UA where Electron's brand could cause false incompatibility.
  const ua = view.webContents.getUserAgent().replace(/\sElectron\/\S+/g, '');
  view.webContents.setUserAgent(ua);
  view.webContents.on('context-menu', (_event, params) => showAccountMenu(account.id, null, params));
  const allowWebNavigation = (event, url) => {
    try { safeURL(url); if (!/^https?:\/\//i.test(url)) event.preventDefault(); }
    catch { event.preventDefault(); }
  };
  view.webContents.on('will-navigate', allowWebNavigation);
  view.webContents.on('will-redirect', allowWebNavigation);
  view.webContents.on('will-attach-webview', event => event.preventDefault());
  view.popups = new Set();
  view.webContents.setWindowOpenHandler(({ url }) => {
    try {
      safeURL(url);
      if (!/^https?:\/\//i.test(url)) return { action: 'deny' };
      return { action: 'allow', overrideBrowserWindowOptions: {
        parent: windowMain,
        width: 960, height: 760,
        webPreferences: { partition, nodeIntegration: false, contextIsolation: true, sandbox: true }
      } };
    } catch { return { action: 'deny' }; }
  });
  view.webContents.on('did-create-window', child => {
    view.popups.add(child);
    child.on('closed', () => view.popups.delete(child));
    child.webContents.on('will-navigate', allowWebNavigation);
    child.webContents.on('will-redirect', allowWebNavigation);
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
  view.webContents.on('did-start-loading', () => setStatus(account.id, { loading: true, error: '' }));
  view.webContents.on('did-stop-loading', () => setStatus(account.id, { loading: false }));
  view.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) setStatus(account.id, { loading: false, error: description });
  });
  view.webContents.on('render-process-gone', (_event, details) => {
    setStatus(account.id, { error: 'Processo encerrado: ' + details.reason });
  });
  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      event.preventDefault();
      if (input.shift) view.webContents.reloadIgnoringCache();
      else view.webContents.reload();
    }
  });
  Promise.resolve(sharedAssets?.prepare(siteSession)).then(() => {
    if (views.get(account.id) === view && !view.webContents.isDestroyed()) return view.webContents.loadURL(account.url);
  }).catch(err => setStatus(account.id, { error: err.message, loading: false }));
  return view;
}

function destroyView(id, preserveBounds = false) {
  clearTimeout(idleTimers.get(id)); idleTimers.delete(id);
  const view = views.get(id);
  if (!view) return;
  if (windowMain && !windowMain.isDestroyed()) {
    try { windowMain.contentView.removeChildView(view); } catch { /* wasn't attached */ }
  }
  if (!view.webContents.isDestroyed()) {
    view.webContents.session?.flushStorageData();
    view.webContents.close();
  }
  for (const popup of view.popups || []) if (!popup.isDestroyed()) popup.destroy();
  views.delete(id);
  viewStatuses.delete(id);
  if (!preserveBounds) boundsForAccounts.delete(id);
}

function refreshViews() {
  if (!windowMain || windowMain.isDestroyed()) return;
  const windowVisible = windowMain.isVisible() && !windowMain.isMinimized();
  const visible = new Set(windowVisible ? currentAccounts().filter(a => boundsForAccounts.has(a.id)).map(a => a.id) : []);
  for (const account of state.accounts) {
    const mode = modeFor(account), onScreen = visible.has(account.id);
    if (mode === 'suspended') {
      destroyView(account.id, true);
      setStatus(account.id, { sleeping: true, loading: false, error: '' });
      continue;
    }
    if (mode === 'always' || onScreen) {
      clearTimeout(idleTimers.get(account.id)); idleTimers.delete(account.id);
      const wasMissing = !views.has(account.id);
      const view = makeView(account);
      if (wasMissing) setStatus(account.id, { sleeping: false, loading: true, error: '' });
      view.webContents.setBackgroundThrottling(mode !== 'always');
      const attached = windowMain.contentView.children.includes(view);
      if (onScreen && !overlayOpen) {
        view.setBounds(boundsForAccounts.get(account.id));
        view.setVisible(true);
        if (!attached) windowMain.contentView.addChildView(view);
      } else {
        view.setVisible(false);
        if (attached) windowMain.contentView.removeChildView(view);
      }
    } else {
      const view = views.get(account.id);
      if (!view) continue;
      view.webContents.setBackgroundThrottling(true);
      view.setVisible(false);
      if (windowMain.contentView.children.includes(view)) windowMain.contentView.removeChildView(view);
      if (!idleTimers.has(account.id)) {
        idleTimers.set(account.id, setTimeout(() => {
          idleTimers.delete(account.id);
          if (modeFor(accountById(account.id)) === 'visible') {
            destroyView(account.id, true);
            setStatus(account.id, { sleeping: true, loading: false });
          }
        }, idleDelay));
      }
    }
  }
  scheduleMetrics();
}

function visibleViews() {
  if (!windowMain || windowMain.isDestroyed() || !windowMain.isVisible() || windowMain.isMinimized() || overlayOpen) return [];
  const attached = windowMain.contentView.children;
  return [...views].filter(([, view]) => attached.includes(view) && !view.webContents.isDestroyed());
}

function scheduleMetrics(delay = 200) {
  if (!visibleViews().length) {
    clearTimeout(metricsTimer); metricsTimer = undefined; return;
  }
  if (metricsTimer !== undefined) return;
  metricsTimer = setTimeout(() => {
    metricsTimer = undefined;
    const entries = visibleViews();
    if (!entries.length) return;
    const pages = entries.map(([id, view]) => {
      const pids = new Set([view.webContents.getOSProcessId()]);
      for (const contents of [view.webContents, ...[...view.popups].filter(popup => !popup.isDestroyed()).map(popup => popup.webContents)]) {
        try { for (const frame of contents.mainFrame.framesInSubtree) if (frame.osProcessId > 0) pids.add(frame.osProcessId); } catch { /* a frame may exit during sampling */ }
      }
      return { id, pids: [...pids] };
    });
    windowMain.webContents.send('view:metrics', pageMetrics(pages, app.getAppMetrics()));
    scheduleMetrics(2500);
  }, delay);
}

function accountById(id) {
  const account = state.accounts.find(a => a.id === id);
  if (!account) throw new Error('Conta não encontrada.');
  return account;
}

function listen(name, fn) {
  actions.set(name, fn);
  ipcMain.handle(name, async (event, ...args) => {
    try {
      if (!trustedSender(event)) throw new Error('Origem não autorizada.');
      return await fn(...args);
    }
    catch (err) { return { ok: false, error: err.message || String(err) }; }
  });
}

function trustedSender(event) {
  return !!windowMain && !windowMain.isDestroyed() &&
    event.sender === windowMain.webContents &&
    event.senderFrame === windowMain.webContents.mainFrame &&
    event.senderFrame?.url === pathToFileURL(path.join(__dirname, 'index.html')).href;
}

function updateTitleBar() {
  if (process.platform !== 'win32' || !windowMain || windowMain.isDestroyed()) return;
  const light = state.preferences.theme === 'light';
  windowMain.setTitleBarOverlay({ color: light ? '#f7f9fc' : '#10151f', symbolColor: light ? '#243247' : '#dbe5f3', height: 36 });
}

function uiCommand(type, id) {
  windowMain.webContents.send('ui:command', { type, id });
}

function runAction(name, ...args) {
  Promise.resolve().then(() => actions.get(name)(...args)).catch(error => {
    if (windowMain && !windowMain.isDestroyed()) windowMain.webContents.send('ui:toast', error.message);
  });
}

function popupMenu(template, point) {
  const options = { window: windowMain };
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const [width, height] = windowMain.getContentSize();
    options.x = Math.max(0, Math.min(width - 1, Math.round(point.x)));
    options.y = Math.max(0, Math.min(height - 1, Math.round(point.y)));
  }
  Menu.buildFromTemplate(template).popup(options);
}

function showAccountMenu(id, point, params) {
  const a = accountById(id), v = views.get(id);
  const template = [
    { label: a.name, enabled: false },
    { label: 'Renomear conta…', click: () => uiCommand('rename-account', id) },
    { label: 'Escolher cor…', click: () => uiCommand('account-color', id) },
    { type: 'separator' },
    { label: 'Atividade', submenu: [
      { label: 'Sempre ativa', type: 'radio', checked: modeFor(a) === 'always', click: () => runAction('account:activity', id, 'always') },
      { label: 'Ativa quando visível', type: 'radio', checked: modeFor(a) === 'visible', click: () => runAction('account:activity', id, 'visible') },
      { label: 'Suspender agora · liberar RAM', type: 'radio', checked: modeFor(a) === 'suspended', click: () => runAction('account:activity', id, 'suspended') },
      { type: 'separator' },
      { label: 'Quando oculta: descarrega após 1 minuto', enabled: false },
      { label: 'Ao retomar, o jogo reconecta', enabled: false }
    ] },
    { type: 'separator' },
    { label: 'Atualizar', accelerator: 'F5', enabled: !!v, click: () => runAction('view:reload', id) },
    { label: 'Atualizar sem cache', accelerator: 'CmdOrCtrl+Shift+R', enabled: !!v, click: () => runAction('view:reload', id, true) },
    { label: 'Endereço inicial', click: () => runAction('view:home', id) },
    { label: a.muted ? 'Ativar áudio' : 'Silenciar', click: () => runAction('view:mute', id) },
    { label: `Zoom · ${Math.round(a.zoom * 100)}%`, submenu: [
      { label: 'Aumentar', click: () => runAction('view:zoom', id, 0.1) },
      { label: 'Diminuir', click: () => runAction('view:zoom', id, -0.1) },
      { label: 'Restaurar 100%', click: () => runAction('view:zoom', id, 1 - a.zoom) }
    ] },
    { type: 'separator' },
    { label: 'Editar endereço…', click: () => uiCommand('edit-account', id) },
    { label: 'Nova conta neste espaço…', click: () => uiCommand('add-account') },
    { label: 'Remover painel…', click: () => uiCommand('delete-account', id) }
  ];
  if (params?.isEditable || params?.selectionText) {
    template.push({ type: 'separator' }, { role: 'copy' });
    if (params.isEditable) template.push({ role: 'paste' }, { role: 'selectAll' });
  }
  popupMenu(template, point);
}

function showAppMenu(point) {
  const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
  const metrics = app.getAppMetrics();
  const memory = Math.round(metrics.reduce((sum, m) => sum + Number(m.memory?.workingSetSize || 0), 0) / 1024);
  popupMenu([
    { label: 'Nova conta…', click: () => uiCommand('add-account') },
    { label: 'Novo espaço…', click: () => uiCommand('add-workspace') },
    { label: 'Editar espaço…', click: () => uiCommand('edit-workspace') },
    { type: 'separator' },
    { label: 'Layout', submenu: Object.entries({ auto: 'Grade automática', columns: 'Colunas', rows: 'Linhas', focus: 'Uma conta por vez' }).map(([layout, label]) => ({ label, type: 'radio', checked: workspace.layout === layout, click: () => runAction('workspace:layout', layout) })) },
    { type: 'separator' },
    { label: 'Exportar configuração…', click: () => runAction('config:export') },
    { label: 'Importar configuração…', click: () => uiCommand('import') },
    { label: storage.portable ? 'Abrir pasta Save' : 'Abrir pasta de dados', click: () => runAction('storage:open') },
    { type: 'separator' },
    { label: 'Desempenho', submenu: [
      { label: `${views.size} painéis carregados · ~${memory} MB no aplicativo`, enabled: false },
      ...(sharedAssets ? [{ label: `Cache público: ${sharedAssets.stats.hits} reutilizações · ${(sharedAssets.stats.savedBytes / 1048576).toFixed(1)} MB poupados nesta execução`, enabled: false }] : []),
      { label: 'Ativa quando visível economiza RAM após 1 minuto', enabled: false },
      { label: 'Suspender descarrega o painel imediatamente', enabled: false },
      { label: 'Sobre os modos…', click: () => uiCommand('performance-help') }
    ] },
    { label: 'Verificar atualizações…', click: () => uiCommand('updates') },
    { label: 'Astria · ' + appVersion + (storage.portable ? ' · Portátil' : ''), enabled: false }
  ], point);
}

function registerIPC() {
  listen('updates:check', async () => ({ ok: true, ...await updates.check() }));
  listen('updates:download', async () => ({ ok: true, ...await updates.download(percent => {
    if (windowMain && !windowMain.isDestroyed()) windowMain.webContents.send('updates:progress', percent);
  }) }));
  listen('updates:install', async () => {
    await updates.install();
    setImmediate(() => app.quit());
    return { ok: true };
  });
  listen('storage:open', async () => {
    const folder = storage.portable ? storage.root : app.getPath('userData');
    fs.mkdirSync(folder, { recursive: true });
    const error = await shell.openPath(folder);
    if (error) throw new Error(error);
    return { ok: true };
  });
  listen('state:get', () => ({ ok: true, state, statuses: Object.fromEntries(viewStatuses) }));
  listen('workspace:add', (name) => {
    const w = { id: randomUUID(), name: safeString(name, 55) || 'Novo espaço', layout: 'auto' };
    state.workspaces.push(w); state.activeWorkspaceId = w.id; state.selectedAccountId = null;
    boundsForAccounts.clear(); publish(); return { ok: true };
  });
  listen('workspace:rename', (id, name) => {
    const w = state.workspaces.find(w => w.id === id);
    if (!w) throw new Error('Espaço não encontrado.');
    w.name = safeString(name, 55) || w.name; publish(); return { ok: true };
  });
  listen('workspace:select', (id) => {
    if (!state.workspaces.some(w => w.id === id)) throw new Error('Espaço não encontrado.');
    state.activeWorkspaceId = id;
    state.selectedAccountId = state.accounts.find(a => a.workspaceId === id)?.id || null;
    boundsForAccounts.clear(); publish(); return { ok: true };
  });
  listen('workspace:delete', (id) => {
    if (state.workspaces.length < 2) throw new Error('Mantenha pelo menos um espaço.');
    const w = state.workspaces.find(w => w.id === id);
    if (!w) throw new Error('Espaço não encontrado.');
    for (const a of state.accounts.filter(a => a.workspaceId === id)) destroyView(a.id);
    state.accounts = state.accounts.filter(a => a.workspaceId !== id);
    state.workspaces = state.workspaces.filter(w => w.id !== id);
    if (state.activeWorkspaceId === id) state.activeWorkspaceId = state.workspaces[0].id;
    state.selectedAccountId = currentAccounts()[0]?.id || null;
    boundsForAccounts.clear(); publish(); return { ok: true };
  });
  listen('workspace:layout', (layout) => {
    if (!allowedLayouts.has(layout)) throw new Error('Layout desconhecido.');
    state.workspaces.find(w => w.id === state.activeWorkspaceId).layout = layout;
    boundsForAccounts.clear(); publish(); return { ok: true };
  });
  listen('account:add', (data) => {
    const account = {
      id: randomUUID(), workspaceId: state.activeWorkspaceId,
      name: safeString(data?.name, 55) || `Conta ${currentAccounts().length + 1}`,
      url: safeURL(data?.url), muted: false, zoom: 1,
      color: normalizeColor(data?.color) || colors.mint, activity: 'visible'
    };
    state.accounts.push(account); state.selectedAccountId = account.id;
    publish(); return { ok: true };
  });
  listen('account:edit', (id, data) => {
    const a = accountById(id);
    const newURL = safeURL(data?.url);
    a.name = safeString(data?.name, 55) || a.name;
    if (a.url !== newURL) {
      a.url = newURL;
      const view = views.get(id);
      if (view && !view.webContents.isDestroyed()) view.webContents.loadURL(newURL).catch(() => {});
    }
    publish(); return { ok: true };
  });
  listen('account:delete', (id) => {
    accountById(id); destroyView(id);
    state.accounts = state.accounts.filter(a => a.id !== id);
    if (state.selectedAccountId === id) state.selectedAccountId = currentAccounts()[0]?.id || null;
    publish(); return { ok: true, note: 'Sessão salva no disco; dados do site não foram apagados.' };
  });
  listen('account:select', (id) => {
    const a = accountById(id);
    if (a.workspaceId !== state.activeWorkspaceId) throw new Error('Conta fora deste espaço.');
    state.selectedAccountId = id; publish(); return { ok: true };
  });
  listen('account:rename', (id, name) => {
    const a = accountById(id), next = safeString(name, 55);
    if (!next) throw new Error('Informe o nome da conta.');
    a.name = next; publish(); return { ok: true };
  });
  listen('account:color', (id, color) => {
    const next = normalizeColor(color);
    if (!next) throw new Error('Cor inválida.');
    accountById(id).color = next; publish(); return { ok: true };
  });
  listen('account:activity', (id, mode) => {
    if (!activityModes.has(mode)) throw new Error('Modo de atividade inválido.');
    accountById(id).activity = mode; publish(); return { ok: true };
  });
  listen('view:reload', (id, ignoreCache = false) => {
    const a = accountById(id); const v = makeView(a);
    if (!v) throw new Error('Retome a conta suspensa primeiro.');
    if (ignoreCache) v.webContents.reloadIgnoringCache();
    else v.webContents.reload();
    return { ok: true };
  });
  listen('view:home', (id) => {
    const a = accountById(id), v = makeView(a);
    if (!v) throw new Error('Retome a conta suspensa primeiro.');
    v.webContents.loadURL(a.url).catch(() => {}); return { ok: true };
  });
  listen('view:mute', (id) => {
    const a = accountById(id); a.muted = !a.muted;
    const view = views.get(id); if (view) view.webContents.setAudioMuted(a.muted);
    publish(); return { ok: true };
  });
  listen('view:zoom', (id, delta) => {
    if (!Number.isFinite(delta)) throw new Error('Zoom inválido.');
    const a = accountById(id); a.zoom = Math.round(Math.max(0.5, Math.min(2, (a.zoom || 1) + Number(delta))) * 10) / 10;
    const view = views.get(id); if (view) view.webContents.setZoomFactor(a.zoom);
    publish(); return { ok: true };
  });
  listen('settings:theme', (theme) => {
    state.preferences.theme = theme === 'light' ? 'light' : 'dark';
    nativeTheme.themeSource = state.preferences.theme;
    updateTitleBar();
    publish(); return { ok: true };
  });
  listen('settings:sidebar-width', width => {
    if (!Number.isFinite(width)) throw new Error('Largura inválida.');
    state.preferences.sidebarWidth = sidebarWidth(width);
    boundsForAccounts.clear(); publish(); return { ok: true };
  });
  listen('menu:layout', point => {
    const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    popupMenu(Object.entries({ auto: 'Grade automática', columns: 'Colunas', rows: 'Linhas', focus: 'Uma conta por vez' }).map(([layout, label]) => ({ label, type: 'radio', checked: workspace.layout === layout, click: () => runAction('workspace:layout', layout) })), point);
    return { ok: true };
  });
  listen('menu:app', point => { showAppMenu(point); return { ok: true }; });
  listen('menu:account', (id, point) => { accountById(id); showAccountMenu(id, point); return { ok: true }; });
  listen('config:export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(windowMain, {
      title: 'Exportar espaços e contas (não inclui cookies)', defaultPath: storage.portable ? path.join(storage.backups, 'astria-config.json') : 'astria-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!canceled && filePath) fs.writeFileSync(filePath, JSON.stringify({ ...state, warning: 'Logins e cookies não estão neste arquivo.' }, null, 2));
    return { ok: true, canceled };
  });
  listen('config:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(windowMain, {
      title: 'Importar espaços e contas (substitui a configuração)', properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePaths?.[0]) return { ok: true, canceled: true };
    if (fs.statSync(filePaths[0]).size > 3_000_000) throw new Error('Arquivo muito grande.');
    const parsed = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    const newState = normalizeImport(parsed);
    for (const id of [...views.keys()]) destroyView(id);
    state = newState; boundsForAccounts.clear(); publish(); return { ok: true };
  });
  ipcMain.on('ui:overlay', (event, open) => { if (trustedSender(event)) { overlayOpen = !!open; refreshViews(); } });
  ipcMain.on('layout:update', (event, rects) => {
    if (!trustedSender(event)) return;
    if (!Array.isArray(rects) || !windowMain || windowMain.isDestroyed()) return;
    const ids = new Set(currentAccounts().map(a => a.id));
    boundsForAccounts.clear();
    const [ww, wh] = windowMain.getContentSize();
    for (const rect of rects.slice(0, 300)) {
      if (!rect || typeof rect !== 'object') continue;
      if (!ids.has(rect.id)) continue;
      const x = Math.round(Number(rect.x)), y = Math.round(Number(rect.y));
      const width = Math.round(Number(rect.width)), height = Math.round(Number(rect.height));
      if (![x, y, width, height].every(Number.isFinite)) continue;
      if (x < 0 || y < 0 || width < 100 || height < 75) continue;
      if (x + width > ww + 2 || y + height > wh + 2) continue;
      boundsForAccounts.set(rect.id, { x, y, width, height });
    }
    refreshViews();
  });
}

function createMainWindow() {
  windowMain = new BrowserWindow({
    width: 1500, height: 950, minWidth: 780, minHeight: 500,
    backgroundColor: '#0b1020',
    title: 'Astria',
    icon: path.join(__dirname, 'astria.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? { color: state.preferences.theme === 'light' ? '#f7f9fc' : '#10151f', symbolColor: state.preferences.theme === 'light' ? '#243247' : '#dbe5f3', height: 36 } : false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true
    }
  });
  windowMain.loadFile(path.join(__dirname, 'index.html'));
  windowMain.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  windowMain.webContents.on('will-navigate', event => event.preventDefault());
  windowMain.on('closed', () => {
    clearTimeout(metricsTimer); metricsTimer = undefined;
    for (const id of [...views.keys()]) destroyView(id);
    boundsForAccounts.clear(); overlayOpen = false; windowMain = null;
  });
  windowMain.on('resize', () => {
    if (!windowMain.isDestroyed()) windowMain.webContents.send('window:resized');
  });
  for (const event of ['minimize', 'restore', 'show', 'hide']) {
    windowMain.on(event, () => setImmediate(() => {
      if (!windowMain || windowMain.isDestroyed()) return;
      refreshViews();
      if (event === 'restore' || event === 'show') windowMain.webContents.send('window:resized');
    }));
  }
  windowMain.webContents.on('did-finish-load', () => {
    windowMain.webContents.send('state:updated', state);
    const healthArgument = process.argv.find(value => value.startsWith('--astria-update-health='));
    if (storage.portable && healthArgument) {
      const jobPath = path.resolve(healthArgument.slice('--astria-update-health='.length));
      const relative = path.relative(path.join(storage.root, 'Updates'), jobPath);
      if (/^update-[a-f\d-]+[\\/]job\.json$/.test(relative) && fs.existsSync(jobPath)) fs.writeFileSync(jobPath + '.healthy', appVersion);
    }
  });
}

const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => {
  if (windowMain && !windowMain.isDestroyed()) {
    if (windowMain.isMinimized()) windowMain.restore();
    windowMain.focus();
  }
});

if (ownsInstance) app.whenReady().then(() => {
  // Test fixtures opt in to loopback assets; shipped builds use the HTTPS host allowlist.
  const testAssets = process.env.ASTRIA_TEST_ASSETS === '1' ? { allowURL: url => ['127.0.0.1', 'localhost'].includes(url.hostname) } : {};
  sharedAssets = new SharedAssets(storage.assets || path.join(app.getPath('userData'), 'SharedAssets'), testAssets);
  updates = new Updates({ storage, currentVersion: appVersion, ...releaseConfig });
  session.defaultSession?.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession?.setPermissionCheckHandler(() => false);
  session.defaultSession?.setDevicePermissionHandler?.(() => false);
  state = loadState();
  writeAccountGuide(storage, state);
  nativeTheme.themeSource = state.preferences.theme;
  registerIPC(); createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { for (const id of [...views.keys()]) destroyView(id); });
