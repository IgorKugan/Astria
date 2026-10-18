'use strict';
const path = require('node:path');
const { fileURLToPath } = require('node:url');

function isInterfaceURL(value, expectedFile) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:' || url.host || url.search || url.hash) return false;
    // Chromium and Node encode an unreserved tilde differently. Compare the
    // decoded local path while keeping the exact file and main-frame checks.
    return path.resolve(fileURLToPath(url)) === path.resolve(expectedFile);
  } catch { return false; }
}
module.exports = { isInterfaceURL };
