# Adaptive performance implementation plan

**Goal:** Add the five performance controls requested by the owner and an expanding star identity to the normal Electron app.
**Architecture:** Reuse isolated sessions, the existing RAF limiter, trusted IPC and compact controls. Keep game clocks, networking, storage and live objects intact. Work directly in Astria-dev as requested, on codex/adaptive-performance.
**Stack:** Existing Electron/JavaScript/SVG; no new dependencies.

## Decisions and constraints
- Keep manual Eco FPS for existing profiles; add Adaptive Eco (active <=60, secondary <=15, <=10 with four loaded accounts, <=5 with eight).
- Optional global visual rest caps hidden loaded accounts at 2 FPS and mutes them. Native image animation policy applies to newly loaded images; do not reset game-owned image elements to force it.
- Ultra is a temporary fullscreen state; other accounts stay connected at <=1 FPS. No blanket timer throttling or unloading of always/Eco accounts.
- Per-account virtual viewport presets: 1280x720, 1366x768, 1600x900, 1920x1080; fit aspect ratio to panel, preserve saved zoom when returning to automatic.
- Cleanup is manual, serialized, debounced per page for 120 seconds, using HeapProfiler.collectGarbage with a timeout and debugger cleanup. Skip pages being debugged. No storage/cache clearing.
- Animate the star briefly on opening/hover, respecting reduced motion. Regenerate Windows icons from the same vector identity.
- Preserve the production app and Save. Public docs remain generic and bilingual.

## Tasks
- [x] Test adaptive budgets, resolution fit and limiter 2/60 FPS; implement shared policy and trusted main/preload integration.
- [x] Test live transitions, resolution/input, session continuity, mute restoration and cleanup; implement controls and bilingual help.
- [x] Update vector/Windows logo and check dark/light, reduced-motion and compact layouts.
- [x] Run unit, browser/network/activity/layering/startup/close and portable checks; review diff; build signed update.

## Review focus
- Minimized/restored windows must retain live timers and connections.
- Nested frames must receive new budgets without restarting the frame clock for unrelated UI changes.
- Fixed viewports must have correct pointer coordinates and restore native bounds/zoom.
- Rest and Ultra must restore the user's explicit mute state.
- Cleanup must never detach another debugger, destroy a page, or erase persistent state.

## Verification ledger
- Baseline: clean main at 0c1946b, version 1.6.12. Baseline npm test passed before implementation.
- Ruling: native image policy has a Chromium limitation for already decoded images; document it instead of mutating game-owned image sources.

- Unit and synthetic integrated checks passed for live frame budgets, sockets/timers, all four viewport sizes, scaled pointer input, cleanup retaining live objects/storage, native context-menu target, UI language/theme/reduced motion and persistence after restart.
- Original network, browser shortcut/focus, layering, activity, startup, close/save and broad UI tests passed. One concurrent activity run was invalidated by a minimized fixture; rerunning it alone passed.
- Review fixes: adaptive secondary ceiling remains <=15 even with a saved 30 FPS manual choice; context-menu cleanup opens the clicked account.
- Brand rendering now waits for the completed SVG paint and asserts a bright center before writing icons.
- Dependency audit: zero reported vulnerabilities. No authenticated game FPS/RAM benchmark performed; live game resources remain allocated.

- Final packaged executable passed the performance integration suite, including persisted settings. Portable relocation preserved isolated cookies/localStorage/IndexedDB/CacheStorage and exported game files.
- Signed update from a clean 1.6.12 fixture to 1.7.0 passed account/cookie/user-file preservation and invalid-executable rollback. One earlier health-confirmation attempt timed out; subsequent upgrade attempts confirmed health normally. No production updater behavior was changed.
- Updated the existing update test to support unattended closure of its own temporary fixture and inspect the authoritative rollback result/restored binary instead of Windows PowerShell bootstrap exit codes.
- Delivery: signed 1.7.0 ZIP/manifest/signature prepared for the existing GitHub release channel. Production Save and executable were not modified. Authenticated game memory/FPS gains still require user testing.

- CI exposed native fixed-resolution startup calling Electron emulation before a render widget existed. Fixed by staging preset-sized views behind the interface and fitting/revealing after main DOM readiness. Initial game scripts now see the requested preset dimensions.
- Readiness is invalidated on committed main navigation, preserving visible games across canceled/download navigations. Both mocked regressions failed before their fixes; native startup and attachment-download checks pass locally. Full GitHub Tests passed after the native-readiness fix.
- Removed a redundant process-exit wait: Playwright already waits for process closure; it was not the cause of the restart crash.

- Added a one-shot timer fallback for trusted layout IPC. Deliberately withholding UI RAF reproduced a permanent native-view/layout stall before the fix; the same integration check passes afterward. Health validation still waits for a valid layout.
