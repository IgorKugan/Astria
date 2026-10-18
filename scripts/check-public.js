'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const names = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const forbiddenPath = /(?:^|\/)(?:Save|Profile|Partitions|Backups|SharedAssets|node_modules|dist|test-results|\.tools|\.release-keys|\.env(?:\..*)?|\.node-path)(?:\/|$)|\.(?:pem|key|pfx|p12|dmp|exe|zip|asar|log)$/i;
const secrets = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{40,}/, /AKIA[0-9A-Z]{16}/, /[A-Z]:\\Users\\(?!Public\\|Default\\)[a-z0-9_-]+\\/i];
let failed = false;
for (const name of names) {
  if (forbiddenPath.test(name)) { console.error('Private/build path tracked:', name); failed = true; continue; }
  const stat = fs.lstatSync(path.join(root, name));
  if (!stat.isFile() || stat.size > 2_000_000) { console.error('Unexpected file:', name); failed = true; continue; }
  if (!name.endsWith('.ico') && name !== 'scripts/check-public.js' && secrets.some(pattern => pattern.test(fs.readFileSync(path.join(root, name), 'utf8')))) { console.error('Potential secret or personal information:', name); failed = true; }
}
if (!names.length) { console.error('No tracked source files were scanned. Stage the intended source first.'); failed = true; }
if (failed) process.exitCode = 1;
else console.log(`PASS: ${names.length} tracked files checked; no private data, local profiles or detected secrets.`);
