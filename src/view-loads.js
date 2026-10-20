'use strict';

// Decide which new renderers may start. Existing games keep running; only
// initial page loads compete for these slots.
function planViewLoads(accounts, { ready, visible, existing, loading, selected }) {
  if (!ready) return [];
  const wanted = accounts.filter(a => a.activity !== 'suspended' && (visible.has(a.id) || a.activity === 'always'));
  const missing = wanted.filter(a => !existing.has(a.id));
  const foreground = missing.filter(a => visible.has(a.id));
  foreground.sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
  const slots = Math.max(0, 2 - loading.size);
  if (foreground.length) {
    // Selecting a queued game must not wait for unrelated slow websites.
    const selectedWaiting = foreground[0].id === selected;
    return foreground.slice(0, Math.max(slots, selectedWaiting ? 1 : 0));
  }
  // Avoid opening another profile while the visible game is still loading.
  // One hidden profile at a time also avoids a burst of disk I/O at login.
  if ([...loading].some(id => visible.has(id)) || loading.size) return [];
  return missing.slice(0, 1);
}

module.exports = { planViewLoads };
