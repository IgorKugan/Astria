# Floating account layout

Owner request: one main game, one smaller floating game; click to exchange them, drag to move the smaller one. Continue the existing portable Electron app and release through its signed GitHub updater.

Implementation decisions:
- Reuse both account WebContents/session instances. No polling screenshots or duplicate game renderers.
- A small transparent trusted native view above the secondary game handles the gesture, its name/color and a corner-position button. Sites get no new host API.
- Main account fills the existing content area. The layout also works with the existing Ultra fullscreen control.
- Drag begins after 5 DIP of movement; it never also swaps. Position is constrained to the main game area and stored as relative coordinates per workspace.
- Sidebar selection makes the old main account the secondary. The mini-window swaps the pair without reload or login changes.
- Keep the miniature's virtual viewport at main-game dimensions (or its explicit resolution), scaling only its display. Wait for renderer readiness before native emulation.
- Hide the floating overlay for dialogs, other workspaces, minimization and other layouts. Explicit suspension still unloads games. A single available account remains a normal full-size panel.
- EN/PT-BR labels; keyboard swapping/movement and a single-click corner control accompany dragging.

Files: main/preload/renderer/i18n/styles; new floating geometry helper, isolated floating HTML/CSS/preload/renderer; geometry and native integration tests; CI and bilingual release docs.

Checks:
- [x] Geometry, account selection and boundary validation tests.
- [x] Native transparent overlay, click/drag distinction, stacking, focus and state retention.
- [x] Dialogs, workspaces, resize, suspension, fixed resolution, Ultra and settings persistence.
- [ ] Existing unit/browser/activity/layout checks; review; signed portable build and updater/release verification.

Verification: baseline unit suite passed; floating integration passes click/drag, focus, transparent native layering, animation in visible-only mode, session identity retention, keyboard/corner movement, dialogs/workspaces/Ultra, preset resolution and resize, restart persistence and helper teardown. Original e2e/browser/layer/performance/activity/startup/close/network suites passed. Review fixes add tests for a letterboxed primary and injected disk-write failure when releasing a drag. No real user game profiles or Save were modified.
