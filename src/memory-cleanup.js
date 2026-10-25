'use strict';
const lastCleanup = new WeakMap();
let busy = false;
async function collectPageMemory(contents) {
  if (contents.isDestroyed()) return 'closed';
  if (busy) return 'busy';
  if (contents.debugger.isAttached()) return 'debugging';
  if (Date.now() - (lastCleanup.get(contents) || 0) < 120000) return 'cooldown';
  let timer, owned = false;
  busy = true;
  try {
    contents.debugger.attach('1.3'); owned = true;
    await Promise.race([
      contents.debugger.sendCommand('HeapProfiler.collectGarbage'),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Memory cleanup timed out')), 5000); })
    ]);
    lastCleanup.set(contents, Date.now());
    return 'collected';
  } finally {
    clearTimeout(timer);
    try { if (owned && !contents.isDestroyed() && contents.debugger.isAttached()) contents.debugger.detach(); }
    finally { busy = false; }
  }
}
module.exports = { collectPageMemory };
