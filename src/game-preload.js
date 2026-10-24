'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Only animation callbacks are paced; game clocks, timers and networking stay native.
const setLimit = contextBridge.executeInMainWorld({
  args: [Number(process.argv.find(value => value.startsWith('--astria-fps='))?.split('=')[1]) || 0],
  func: initial => {
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    const timeout = window.setTimeout.bind(window);
    const clear = window.clearTimeout.bind(window);
    const now = window.performance.now.bind(window.performance);
    const pending = new Map();
    let fps = initial, sequence = 0, last = -Infinity, timer = null;
    function stopTimer() {
      if (timer !== null) { clear(timer); timer = null; }
    }
    function queue(entry) {
      // Separate native callbacks preserve browser microtask and error handling.
      entry.frame = request(time => {
        if (!pending.has(entry.id)) return;
        entry.frame = null;
        if (fps && time !== last && time - last < 1000 / fps - 0.5) { schedule(); return; }
        last = time;
        pending.delete(entry.id);
        if (!pending.size) stopTimer();
        entry.callback.call(window, time);
      });
    }
    function flush() {
      timer = null;
      for (const entry of pending.values()) if (entry.frame === null) queue(entry);
    }
    function schedule() {
      if (timer !== null) return;
      // Sleep between budgets instead of polling every display refresh.
      const wait = fps ? 1000 / fps - (now() - last) : 0;
      if (wait > 0) timer = timeout(flush, wait);
      else flush();
    }
    window.requestAnimationFrame = callback => {
      if (typeof callback !== 'function') throw new TypeError('Animation callback must be a function');
      const entry = { id: ++sequence, callback, frame: null };
      pending.set(entry.id, entry);
      if (fps) schedule();
      else queue(entry);
      return entry.id;
    };
    window.cancelAnimationFrame = id => {
      id = Number(id);
      const entry = pending.get(id);
      if (entry && entry.frame !== null) cancel(entry.frame);
      pending.delete(id);
      if (!pending.size) stopTimer();
    };
    return value => {
      if ([0, 1, 5, 10, 15, 30].includes(value)) { fps = value; last = -Infinity; stopTimer(); flush(); }
    };
  }
});

// No API is exported to the site; only the host can send a new frame budget.
ipcRenderer.on('astria:frame-limit', (_event, fps) => setLimit(fps));
