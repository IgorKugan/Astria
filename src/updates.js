'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash, verify, randomUUID } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn } = require('node:child_process');
const { packagePath } = require('./package-paths');

const MAX_ZIP = 300 * 1024 * 1024;
const MAX_TOTAL = 700 * 1024 * 1024;
const versionParts = version => /^\d+\.\d+\.\d+$/.test(version) && version.split('.').map(Number);
function newer(a, b) {
  const x = versionParts(a), y = versionParts(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
function verifyManifest(bytes, signature, publicKey) {
  if (bytes.length > 100000 || !verify(null, bytes, publicKey, Buffer.from(signature.trim(), 'base64'))) throw new Error('Assinatura da atualização inválida.');
  const m = JSON.parse(bytes);
  if (m.schema !== 1 || !versionParts(m.version) || m.platform !== 'win32' || m.arch !== 'x64' || m.asset !== `Astria-Portable-${m.version}.zip`) throw new Error('Atualização incompatível.');
  if (!Number.isSafeInteger(m.size) || m.size <= 0 || m.size > MAX_ZIP || !/^[a-f0-9]{64}$/.test(m.sha256)) throw new Error('Pacote inválido.');
  if (!Array.isArray(m.files) || !m.files.length || m.files.length > 500) throw new Error('Lista de arquivos inválida.');
  const names = new Set(); let total = 0;
  for (const file of m.files) {
    if (!packagePath(file.path) || names.has(file.path.toLowerCase()) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_ZIP || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Caminho ou arquivo não autorizado.');
    names.add(file.path.toLowerCase()); total += file.size;
  }
  if (total > MAX_TOTAL || !['astria.exe', 'resources/app.asar', 'portable.flag'].every(name => names.has(name))) throw new Error('Pacote incompleto ou muito grande.');
  return m;
}
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function extract(zipPath, destination, manifest) {
  const yauzl = require('yauzl');
  await fsp.mkdir(destination, { recursive: false });
  await new Promise((resolve, reject) => yauzl.open(zipPath, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => {
    if (error) return reject(error);
    const remaining = new Map(manifest.files.map(file => [file.path, file]));
    const prefix = `Astria-Portable-${manifest.version}/`;
    let entries = 0;
    const fail = error => { zip.close(); reject(error); };
    zip.on('error', fail);
    zip.on('end', () => remaining.size ? fail(new Error('Arquivos ausentes no ZIP.')) : resolve());
    zip.on('entry', entry => { (async () => {
      if (++entries > 1000 || !entry.fileName.startsWith(prefix) || entry.generalPurposeBitFlag & 1 || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error('Entrada ZIP não autorizada.');
      const name = entry.fileName.slice(prefix.length);
      if (entry.fileName.endsWith('/')) {
        if (!['', 'locales/', 'resources/'].includes(name)) throw new Error('Pasta ZIP não autorizada.');
        zip.readEntry(); return;
      }
      const expected = remaining.get(name);
      if (!expected || !packagePath(name) || entry.uncompressedSize !== expected.size) throw new Error('Arquivo ZIP não corresponde ao manifesto.');
      remaining.delete(name);
      const target = path.join(destination, ...name.split('/'));
      await fsp.mkdir(path.dirname(target), { recursive: true });
      const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (e, s) => e ? reject(e) : resolve(s)));
      await pipeline(stream, fs.createWriteStream(target, { flags: 'wx' }));
      if (await hashFile(target) !== expected.sha256) throw new Error('Conteúdo extraído inválido.');
      zip.readEntry();
    })().catch(fail); });
    zip.readEntry();
  }));
}

async function githubFetch(url, limit, fetcher = globalThis.fetch) {
  // Only GitHub and its release CDN are allowed; never send an account token.
  let current = new URL(url);
  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== 'https:' || current.username || current.password || current.port || !['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(current.hostname)) throw new Error('Servidor de atualização não autorizado.');
    const response = await fetcher(current, { headers: { 'user-agent': 'Astria-Updater', accept: 'application/vnd.github+json' }, redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(180000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel(); current = new URL(response.headers.get('location'), current); continue;
    }
    if (!response.ok || Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error(`GitHub indisponível (${response.status}).`); }
    return response;
  }
  throw new Error('Redirecionamentos demais.');
}
async function smallBody(url, limit) {
  const response = await githubFetch(url, limit);
  let size = 0; const parts = [];
  for await (const chunk of Readable.fromWeb(response.body)) { size += chunk.length; if (size > limit) throw new Error('Resposta muito grande.'); parts.push(chunk); }
  return Buffer.concat(parts);
}

class Updates {
  constructor({ storage, currentVersion, repository, publicKey, execPath = process.execPath }) {
    this.storage = storage; this.currentVersion = currentVersion;
    this.repository = repository; this.publicKey = publicKey; this.execPath = execPath;
    this.busy = false; this.available = null;
  }
  async check() {
    if (!/^[\w-]+\/[\w.-]+$/.test(this.repository)) throw new Error('Repositório de atualização não configurado.');
    const release = JSON.parse(await smallBody(`https://api.github.com/repos/${this.repository}/releases/latest`, 200000));
    const version = String(release.tag_name || '').replace(/^v/, '');
    if (release.draft || release.prerelease || !versionParts(version)) throw new Error('Release inválida.');
    if (!newer(version, this.currentVersion)) { this.available = null; return { available: false, version: this.currentVersion }; }
    const base = `https://github.com/${this.repository}/releases/download/v${version}/`;
    const [bytes, sig] = await Promise.all([smallBody(base + 'astria-update.json', 100000), smallBody(base + 'astria-update.sig', 1024)]);
    const manifest = verifyManifest(bytes, sig.toString(), this.publicKey);
    if (manifest.version !== version) throw new Error('Versão assinada não corresponde à release.');
    this.available = { manifest, base };
    return { available: true, version, size: manifest.size };
  }
  async download(progress = () => {}) {
    if (this.busy || !this.available) throw new Error('Verifique as atualizações primeiro.');
    if (!this.storage.portable) throw new Error('Use a edição portátil para atualizar dentro do Astria.');
    this.busy = true;
    try {
      const { manifest, base } = this.available;
      const folder = path.join(this.storage.root, 'Updates', 'update-' + randomUUID());
      await fsp.mkdir(folder, { recursive: true });
      const zip = path.join(folder, 'package.zip');
      const response = await githubFetch(base + manifest.asset, manifest.size);
      let received = 0, last = 0;
      const limit = new Transform({ transform(chunk, _encoding, done) {
        received += chunk.length;
        if (Date.now() - last > 400) { last = Date.now(); progress(Math.round(received / manifest.size * 100)); }
        done(received > manifest.size ? new Error('Tamanho do download inválido.') : null, chunk);
      } });
      await pipeline(Readable.fromWeb(response.body), limit, fs.createWriteStream(zip, { flags: 'wx' }));
      if (received !== manifest.size || await hashFile(zip) !== manifest.sha256) throw new Error('A verificação do download falhou.');
      const stage = path.join(folder, 'program');
      await extract(zip, stage, manifest);
      await fsp.unlink(zip);
      const root = path.dirname(this.execPath);
      const oldFiles = [];
      for (const directory of ['', 'locales', 'resources']) {
        const parent = path.join(root, directory);
        if (!fs.existsSync(parent)) continue;
        if ((await fsp.lstat(parent)).isSymbolicLink()) throw new Error('Pasta do programa não é regular.');
        for (const entry of await fsp.readdir(parent, { withFileTypes: true })) {
          const name = (directory ? directory + '/' : '') + entry.name;
          if (packagePath(name)) { if (!entry.isFile()) throw new Error('Arquivo do programa não é regular.'); oldFiles.push(name); }
        }
      }
      const backup = path.join(this.storage.backups, `Program-${this.currentVersion}-${Date.now()}`);
      const job = { root, folder, stage, backup, pid: process.pid, oldFiles, files: manifest.files, version: manifest.version };
      const jobPath = path.join(folder, 'job.json');
      await fsp.writeFile(jobPath, JSON.stringify(job));
      const helper = path.join(folder, 'apply-update.ps1');
      await fsp.copyFile(path.join(__dirname, 'apply-update.ps1'), helper);
      this.ready = { jobPath, helper };
      progress(100);
      return { version: manifest.version };
    } finally { this.busy = false; }
  }
  install() {
    if (!this.ready) throw new Error('Baixe e verifique a atualização primeiro.');
    const child = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.ready.helper, '-JobPath', this.ready.jobPath], { detached: true, windowsHide: true, stdio: 'ignore' });
    child.unref();
    return new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  }
}
module.exports = { Updates, newer, verifyManifest, hashFile, extract, githubFetch };
