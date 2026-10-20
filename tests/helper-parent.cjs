'use strict';
// Electron GUI parent for the real Windows helper lifecycle test.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Updates, hashFile } = require('../src/updates');
const root = process.env.ASTRIA_HELPER_TEST_ROOT;
app.setPath('userData', path.join(root, 'Profile'));
app.whenReady().then(async () => {
  new BrowserWindow({ show: false });
  const folder = path.join(root, 'Save', 'Updates', 'update-helper-fixture');
  const stage = path.join(folder, 'program');
  fs.mkdirSync(stage, { recursive: true });
  fs.writeFileSync(path.join(root, 'portable.flag'), 'old marker');
  fs.writeFileSync(path.join(stage, 'portable.flag'), 'replacement marker');
  const jobPath = path.join(folder, 'job.json');
  const job = { root, folder, stage, backup: path.join(root, 'Save', 'Backups', 'Program-helper-fixture'), pid: process.pid, oldFiles: ['portable.flag'], files: [{ path: 'portable.flag', size: 18, sha256: await hashFile(path.join(stage, 'portable.flag')) }], version: '1.6.2' };
  fs.writeFileSync(jobPath, JSON.stringify(job));
  const helper = path.join(folder, 'apply-update.ps1');
  fs.copyFileSync(path.join(__dirname, '..', 'src', 'apply-update.ps1'), helper);
  const updates = new Updates({ storage: {}, currentVersion: '1.6.1' });
  updates.ready = { helper, jobPath };
  await updates.install();
  fs.writeFileSync(path.join(root, 'gui-exited-after-ready'), 'ready');
  app.quit();
}).catch(error => { fs.writeFileSync(path.join(root, 'parent-error.txt'), String(error.stack)); app.exit(1); });
