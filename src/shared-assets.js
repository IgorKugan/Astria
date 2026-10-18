'use strict';

// Public, anonymous static files only. Browser profiles and their caches stay separate.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const MAX_FILE = 16 * 1024 * 1024;
const MAX_DISK = 2 * 1024 * 1024 * 1024;
const STATIC = /\.(?:js|mjs|css|png|jpe?g|webp|gif|svg|ico|avif|bmp|tga|ogg|mp3|wav|m4a|mp4|webm|woff2?|ttf|otf|wasm|spr|act|gat|gnd|rsw|rsm2?|str|pal|grf|gpf|lub)$/i;
const SENSITIVE = /(?:^|[/_.-])(?:api|auth|login|logout|account|profile|character|save|config|runtime-config|user|private|avatar)(?:[/_.-]|$)/i;
const QUERY_KEYS = new Set(['v', 'ver', 'version', 'hash', 'rev', 'build', '_', 't']);
const VARY = new Set(['accept', 'accept-encoding', 'accept-language', 'origin', 'user-agent']);
const publicRagnarok = url => url.hostname === 'grf.robrowser.com' && /^\/(?:data|bgm|system)\//i.test(url.pathname);
const PATTERNS = 'js mjs css png jpg jpeg webp gif svg ico avif bmp tga ogg mp3 wav m4a mp4 webm woff woff2 ttf otf wasm spr act gat gnd rsw rsm rsm2 str pal grf gpf lub txt'.split(' ').map(ext => ({ urlPattern: 'http*://*.' + ext + '*', requestStage: 'Request' }));

function candidate(request) {
  let url;
  try { url = new URL(request.url); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol) || request.method !== 'GET' || url.username || url.password) return false;
  try { if (!(STATIC.test(url.pathname) || publicRagnarok(url) && /\.txt$/i.test(url.pathname)) || SENSITIVE.test(decodeURIComponent(url.pathname))) return false; }
  catch { return false; }
  if ([...url.searchParams.keys()].some(key => !QUERY_KEYS.has(key.toLowerCase()))) return false;
  const headers = new Headers(request.headers);
  return !headers.has('authorization') && !headers.has('range') && !headers.has('x-api-key') && !/no-cache|no-store/i.test(headers.get('cache-control') || '') && !/no-cache/i.test(headers.get('pragma') || '');
}

function lifetime(response, request) {
  if (response.status !== 200 || response.headers.has('set-cookie') || response.headers.has('set-cookie2') || response.headers.has('content-disposition')) return 0;
  const cc = response.headers.get('cache-control') || '';
  if (/(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|,|=|$)/i.test(cc)) return 0;
  if ((response.headers.get('vary') || '').split(',').some(v => v.trim() && !VARY.has(v.trim().toLowerCase()))) return 0;
  const type = response.headers.get('content-type') || '';
  const ragnarok = !!request && publicRagnarok(new URL(request.url));
  if (!/^(?:image\/|audio\/|video\/|font\/|text\/(?:css|javascript)|application\/(?:javascript|x-javascript|wasm|font|x-font|vnd.ms-fontobject|octet-stream|ro-))/i.test(type) && !(ragnarok && /^text\/plain/i.test(type))) return 0;
  const maxAge = cc.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i);
  const age = Math.max(0, Number(response.headers.get('age')) || 0);
  if (maxAge) return Math.max(0, Math.min(31536000, Number(maxAge[1])) - age) * 1000;
  const expires = Date.parse(response.headers.get('expires'));
  if (Number.isFinite(expires)) return Math.max(0, Math.min(31536000000, expires - Date.now()));
  // The known anonymous RO asset CDN sends no freshness headers. Give only those
  // static data files a short 15-minute freshness period; never apply this to APIs.
  return ragnarok && !cc ? 900000 : 0;
}

function cacheKey(request) {
  const url = new URL(request.url); url.hash = '';
  const headers = new Headers(request.headers);
  const variants = [...VARY].filter(key => key !== 'accept-encoding').map(key => [key, headers.get(key) || '']);
  return createHash('sha256').update(JSON.stringify([url.href, variants])).digest('hex');
}

class SharedAssets {
  constructor(directory, { fetch = globalThis.fetch, maxDisk = MAX_DISK, allowURL = trustedPublicURL } = {}) {
    this.directory = directory;
    this.fetch = fetch;
    this.maxDisk = maxDisk;
    this.allowURL = allowURL;
    this.pending = new Map();
    this.prepared = new WeakMap();
    this.commits = Promise.resolve();
    this.bodyBytes = 0;
    this.bodyWaiters = [];
    this.stats = { hits: 0, downloads: 0, savedBytes: 0, bytes: 0 };
    fs.mkdirSync(directory, { recursive: true });
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile() && /^[a-f\d]{64}\.bin$/.test(entry.name)) this.stats.bytes += fs.statSync(path.join(directory, entry.name)).size;
    }
  }

  prepare(siteSession) {
    if (!siteSession.storagePath || !siteSession.clearCache) return Promise.resolve();
    if (!this.prepared.has(siteSession)) this.prepared.set(siteSession, (async () => {
      const marker = path.join(siteSession.storagePath, 'astria-shared-cache-v1');
      await fsp.mkdir(siteSession.storagePath, { recursive: true });
      let handle;
      try { handle = await fsp.open(marker, 'wx'); }
      catch (error) { if (error.code === 'EEXIST') return; throw error; }
      try {
        // Drop old duplicated HTTP files once; cookies, IndexedDB and game saves stay.
        await siteSession.clearCache();
        await handle.writeFile('Public HTTP assets now use Save/SharedAssets.\n');
      } catch (error) { await fsp.unlink(marker).catch(() => {}); throw error; }
      finally { await handle.close(); }
    })());
    return this.prepared.get(siteSession);
  }

  async commit(key, temp, size, meta) {
    const task = this.commits.then(async () => {
      const target = path.join(this.directory, key + '.bin');
      const oldSize = await fsp.stat(target).then(s => s.size).catch(() => 0);
      if (this.stats.bytes - oldSize + size > this.maxDisk) {
        const files = [];
        for (const name of await fsp.readdir(this.directory)) if (/^[a-f\d]{64}\.bin$/.test(name) && name !== key + '.bin') {
          const stat = await fsp.stat(path.join(this.directory, name)); files.push({ name, size: stat.size, time: stat.mtimeMs });
        }
        for (const file of files.sort((a, b) => a.time - b.time)) {
          if (this.stats.bytes - oldSize + size <= this.maxDisk) break;
          try {
            await fsp.unlink(path.join(this.directory, file.name));
            await fsp.unlink(path.join(this.directory, file.name.replace(/\.bin$/, '.json'))).catch(() => {});
            this.stats.bytes -= file.size;
          } catch { /* A file in use can be kept until the next eviction. */ }
        }
      }
      if (this.stats.bytes - oldSize + size > this.maxDisk) throw new Error('Shared asset disk limit');
      await fsp.rename(temp, target);
      const metaPath = path.join(this.directory, key + '.json');
      await fsp.writeFile(metaPath + '.tmp', JSON.stringify(meta));
      await fsp.rename(metaPath + '.tmp', metaPath);
      this.stats.bytes += size - oldSize;
      this.stats.downloads++;
    });
    this.commits = task.catch(() => {});
    return task;
  }

  async read(key) {
    try {
      const meta = JSON.parse(await fsp.readFile(path.join(this.directory, key + '.json'), 'utf8'));
      const stat = await fsp.stat(path.join(this.directory, key + '.bin'));
      if (!Number.isFinite(meta.expires) || meta.expires <= Date.now() || !Number.isFinite(meta.size) || meta.size < 0 || meta.size > MAX_FILE || stat.size !== meta.size) return null;
      return meta;
    } catch { return null; }
  }

  async download(request, key) {
    const headers = new Headers();
    const incoming = new Headers(request.headers);
    for (const name of VARY) if (incoming.has(name) && name !== 'accept-encoding') headers.set(name, incoming.get(name));
    // Neither cookies nor authorization are ever sent through the shared path.
    const response = await this.fetch(request.url, { headers, credentials: 'omit', redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const ttl = lifetime(response, request);
    const length = Number(response.headers.get('content-length')) || 0;
    if (!ttl || length > MAX_FILE || !response.body) { await response.body?.cancel(); return null; }
    const temp = path.join(this.directory, key + '-' + randomUUID() + '.tmp');
    let size = 0;
    const limit = new Transform({ transform(chunk, _encoding, done) {
      size += chunk.length;
      done(size > MAX_FILE ? new Error('Public asset exceeds cache limit') : null, chunk);
    } });
    try {
      await pipeline(Readable.fromWeb(response.body), limit, fs.createWriteStream(temp, { flags: 'wx' }));
      const savedHeaders = new Headers(response.headers);
      // fetch decodes content encodings; store and serve decoded bytes consistently.
      for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'set-cookie', 'set-cookie2']) savedHeaders.delete(name);
      savedHeaders.set('content-length', String(size));
      const meta = { size, expires: Date.now() + ttl, headers: [...savedHeaders] };
      await this.commit(key, temp, size, meta);
      return meta;
    } catch { await fsp.unlink(temp).catch(() => {}); return null; }
  }

  async lookup(request) {
    if (!candidate(request) || !this.allowURL(new URL(request.url))) return null;
    const key = cacheKey(request);
    let meta = await this.read(key);
    let reused = !!meta;
    if (!meta) {
      reused = this.pending.has(key);
      if (!reused) this.pending.set(key, this.download(request, key).catch(() => null).finally(() => this.pending.delete(key)));
      meta = await this.pending.get(key);
    }
    return meta ? { key, meta, reused } : null;
  }

  async serve(request, forward) {
    const entry = await this.lookup(request);
    if (!entry) return forward();
    const { key, meta, reused } = entry;
    try {
      const handle = await fsp.open(path.join(this.directory, key + '.bin'), 'r');
      if (reused) { this.stats.hits++; this.stats.savedBytes += meta.size; }
      const headers = new Headers(meta.headers);
      // Avoid storing the same shared public body again in every profile HTTP cache.
      headers.set('cache-control', 'no-store');
      return new Response(Readable.toWeb(handle.createReadStream()), { status: 200, headers });
    } catch { return forward(); }
  }

  async reserveBody(size) {
    while (this.bodyBytes + size > 24 * 1024 * 1024) await new Promise(resolve => this.bodyWaiters.push(resolve));
    this.bodyBytes += size;
    return () => { this.bodyBytes -= size; for (const resolve of this.bodyWaiters.splice(0)) resolve(); };
  }

  async attachView(contents) {
    if (!contents.debugger) return;
    const inspector = contents.debugger;
    try {
      inspector.attach('1.3');
      inspector.on('message', async (_event, method, params, sessionId) => {
        if (method === 'Target.attachedToTarget') {
          try { await inspector.sendCommand('Fetch.enable', { patterns: PATTERNS }, params.sessionId); }
          catch { /* A closing child target can disappear before setup completes. */ }
          finally { await inspector.sendCommand('Runtime.runIfWaitingForDebugger', {}, params.sessionId).catch(() => {}); }
          return;
        }
        if (method !== 'Fetch.requestPaused') return;
        sessionId = sessionId || undefined;
        try {
          const entry = await this.lookup(params.request);
          if (!entry) { await inspector.sendCommand('Fetch.continueRequest', { requestId: params.requestId }, sessionId); return; }
          const release = await this.reserveBody(entry.meta.size);
          try {
            const body = await fsp.readFile(path.join(this.directory, entry.key + '.bin'));
            const headers = new Headers(entry.meta.headers); headers.set('cache-control', 'no-store');
            await inspector.sendCommand('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200, responseHeaders: [...headers].map(([name, value]) => ({ name, value })), body: body.toString('base64') }, sessionId);
            if (entry.reused) { this.stats.hits++; this.stats.savedBytes += entry.meta.size; }
          } finally { release(); }
        } catch { await inspector.sendCommand('Fetch.continueRequest', { requestId: params.requestId }, sessionId).catch(() => {}); }
      });
      await inspector.sendCommand('Fetch.enable', { patterns: PATTERNS });
      await inspector.sendCommand('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true, filter: [{ type: 'iframe' }, { type: 'worker' }, { type: 'shared_worker' }, { exclude: true }] });
    } catch { /* Native browsing still works if instrumentation is unavailable. */ }
  }
}

// A remote page must not use Node's anonymous downloader to probe local services.
// Unknown games keep Chromium's normal per-profile networking and cache.
function trustedPublicURL(url) {
  return url.protocol === 'https:' && !url.port && ['huntera.com.br', 'www.huntera.com.br', 'jogo.yggidle.com.br', 'grf.robrowser.com'].includes(url.hostname);
}

module.exports = { SharedAssets, candidate, lifetime, cacheKey, trustedPublicURL };
