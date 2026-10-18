'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');
const env = { ...process.env, MULTINEST_USER_DATA: path.resolve(__dirname, '../Save/Profile') };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.resolve(__dirname, '..')], { stdio: 'inherit', env });
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code || 0; });
