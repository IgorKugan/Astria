'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Only animation callbacks are paced; game clocks, timers and networking stay native.
const setLimit = contextBridge.executeInMainWorld({
  args: [Number(process.argv.find(value => value.startsWith('--astria-fps='))?.split('=')[1]) || 0],
  func: initial => {
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    const pending = new Map();
    let fps = initial, sequence = 0, last = -Infinity;
    window.requestAnimationFrame = callback => {
      if (typeof callback !== 'function') throw new TypeError('Animation callback must be a function');
      const id = ++sequence;
      // Separate native callbacks preserve browser microtask and error handling.
      function tick(time) {
        if (!pending.has(id)) return;
        if (!fps || time === last || time - last >= 1000 / fps - 0.5) {
          last = time;
          pending.delete(id);
          callback.call(window, time);
        } else pending.set(id, request(tick));
      }
      pending.set(id, request(tick));
      return id;
    };
    window.cancelAnimationFrame = id => {
      id = Number(id);
      if (pending.has(id)) cancel(pending.get(id));
      pending.delete(id);
    };
    return value => {
      if ([0, 10, 15, 30].includes(value)) { fps = value; last = -Infinity; }
    };
  }
});

// No API is exported to the site; only the host can send a new frame budget.
ipcRenderer.on('astria:frame-limit', (_event, fps) => setLimit(fps));
