# Native Macro Maker and Auto Clicker implementation plan

**Goal:** Add two separate native account tools: Macro Maker sequences compatible with the user's extension, and independently timed Auto Clicker targets with faint crosshairs/countdowns. Targets belong to account page/canvas coordinates, never Windows desktop coordinates, and follow floating swaps and scaling.

**Architecture:** Reuse the extension's key definitions and validated version-2 macro format. Dispatch trusted Chromium inputs into that account's existing WebContents without operating the real mouse. Host-process timers run per account. The existing sandboxed game preload draws passive target markers and handles an explicit point-picking mode; no site receives host APIs. A compact trusted settings dialog provides the two tools. No new dependencies, global hotkeys or extra game renderers.

**Tech stack:** Electron, JavaScript, HTML/CSS, existing Playwright and Node assert tests.

## Scope and decisions

- User explicitly requested both tools. Choosing a keyboard/mouse input means the action sent at the marked game location, not a reserved start/stop shortcut. Existing game shortcuts remain available.
- Auto Clicker supports several independently timed enabled targets per account. Each target has `{id,name,enabled,interval,action,point}`. `action` is `{type:'mouse',button:'left'|'right'|'middle'}` or `{type:'key',key,mods:[]}` using Macro Maker keys. `point` is `{x,y,width,height}`: normalized x/y in [0,1), plus the source CSS viewport dimensions for display. Timings use seconds; minimum interval 0.05 seconds, default 5 seconds.
- Settings are `{macros:[{id,name,profile,viewport?:{width,height}}],targets:[]}` saved atomically under portable `Save/Automation/<account-id>.json`. Macro profile uses the existing extension version-2 format; recorded macro points are integer page coordinates in `viewport` and rescale to the current logical viewport. Imports without viewport use the viewport when started.
- Only one tool runs per account at a time; starting another stops the current one. Different accounts run independently. Save settings, never auto-start after restarting Astria. Stop on suspension, account deletion, actual page navigation, renderer loss and app shutdown. Point picking stops that account's running tool. Full-page UI changes may require choosing points again.
- Keep runtime and settings separate. No profile data, recorded text or settings enter public build artifacts.

## Shared interfaces

### Engine (src/automation-engine.js, CommonJS)

- `normalizeSettings(raw)` returns validated settings above.
- `createDriver(contents)` async returns a driver owning its debugger attachment, refusing an existing attachment, with cleanup on disposal. It does not focus the OS window or move the real cursor.
- `runMacro(record,{driver,signal,onState})` async runs a macro snapshot; `runClicker(targets,{driver,signal,onState})` async runs independently scheduled target snapshots. Both resolve on ordinary abort/completion and release held inputs. Errors reject. No catch-up bursts after stalls.
- `onState(patch)` reports `{phase,cycle?,step?,targets?:[{id,point,nextAt,label}]}`. Host adds account ID/kind/running. Driver must support `dispose()` to release inputs and restore debugger state. Internal driver methods are owned by engine.
- Core and key modules (`macro-core.js`, `macro-keys.js`) are UMD/CommonJS and browser globals `AstriaMacroCore`, `AstriaMacroKeys`, keeping the extension's exported helpers. Reuse source from the user's MacroMaker folder; don't execute extension scripts in Astria.

### Trusted root preload APIs

- `automationGet(id)` -> `{ok,settings,runtime}`
- `automationSave(id,settings)` -> `{ok,settings}`
- `automationPick(id,initialPoint?)` -> `{ok,point}` or `{ok:true,cancelled:true}` after user picks/cancels. UI closes its dialog while selecting and reopens its draft afterward.
- `automationPreview(id,point)` shows a temporary marker without sending input.
- `automationStart(id,{kind:'macro',macroId,once?:boolean}|{kind:'clicker'})` -> `{ok,runtime}`
- `automationStop(id)` / `automationStopAll()` -> `{ok}`
- `automationImport(id)` / `automationExport(id,macroId)` use native file dialogs, return `{ok,settings?,cancelled?}`.
- `onAutomation(callback)` subscription returns unsubscribe; events are `{id,runtime}`.

### UI (src/automation-ui.js / .css / automation-i18n.js)

- Browser global `AstriaAutomationUI.open({account,api,modal,closeModal,tr,toast,esc,initialTab})`, where initialTab is 'clicker' or 'macro'. Uses the root app's existing modal and patterns. UMD strings file exports PT->EN dictionary via CommonJS and browser global `AstriaAutomationStrings` for existing i18n integration.
- UI owns drafting, list/edit/add/delete/enable of timed targets, choosing actions/keys/intervals, point selection, previews and start/stop status. Macro Maker owns named profiles, ordered step add/edit/delete/reorder for key/mouse/move/scroll/text/wait, repeat/start/loop timings, native import/export and start/once/stop. Keep concise, accessible and bilingual. No live state update should destroy form drafts.

## Tasks and verification

- [ ] Engine implementer: port keys/core, validated settings, CDP driver and abortable schedulers; meaningful unit tests with red-green checks and no real game input.
- [ ] UI implementer: separate compact tool dialogs/editors and EN/PT strings using the shared API, reusing existing design tokens; no edits to root renderer/main/preload.
- [ ] Main implementer: native input feasibility probe with local fixture pages; storage, trusted IPC, lifecycle, account/tool menus, passive markers and point picker in game preload; integrate UI scripts and dictionaries.
- [ ] Verify actual Electron trusted mouse/key input, independent accounts, floating swaps/resize/fixed-resolution coordinates, countdown marker passthrough, picking cancellation/no game click, stopping/navigation/suspension, macro file compatibility, clean shutdown and persistence.
- [ ] Focused task reviews, full branch review, existing regression suite, signed portable build/update test and GitHub publication. Do not automate the user's actual games or change their production Save for testing.
