'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
if (process.platform !== 'win32') { console.log('SKIP: Windows helper lifecycle'); process.exit(0); }
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ahl-'));
  fs.mkdirSync(path.join(root, 'Profile'));
  const env = { ...process.env, ASTRIA_HELPER_TEST_ROOT: root };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [path.join(__dirname, 'helper-parent.cjs')], { env, windowsHide: true, stdio: 'ignore' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(code, 0, fs.existsSync(path.join(root, 'parent-error.txt')) ? fs.readFileSync(path.join(root, 'parent-error.txt'), 'utf8') : 'GUI parent exit');
  assert.ok(fs.existsSync(path.join(root, 'gui-exited-after-ready')));
  const result = path.join(root, 'Save', 'Updates', 'update-helper-fixture', 'result.txt');
  const deadline = Date.now() + 20000;
  while (!fs.existsSync(result) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(fs.existsSync(result), 'worker survives the Electron GUI parent exit: ' + root);
  // No executable is provided: the worker must reach the failed launch and
  // restore the marker after its GUI parent has already exited.
  assert.match(fs.readFileSync(result, 'utf8'), /Rolled back/);
  assert.equal(fs.readFileSync(path.join(root, 'portable.flag'), 'utf8'), 'old marker');
  console.log('PASS: hidden updater worker survives GUI exit and completes failed-launch rollback');
})().catch(error => { console.error(error); process.exitCode = 1; });
