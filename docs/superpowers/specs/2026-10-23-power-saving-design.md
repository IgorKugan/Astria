# Power saving activity mode

Keep existing sessions and native game surfaces. The four toolbar controls are maximum performance (speedometer), power saving (waving flag), visible-only activity, and suspension. Existing Always active settings retain their meaning and gain no FPS cap. Hidden visible-only accounts unload after five minutes instead of one.

Power saving defaults to 15 FPS. The account activity menu offers 10, 15 and 30 FPS, persisted independently per account. It remains active across workspace changes and does not reload a page when switching budgets or returning to maximum performance.

## Approach

Electron's native FPS setter requires offscreen rendering, which would replace the existing native display/input path with a separate rendering pipeline. CPU slowdown emulation does not provide a reliable animation FPS target. Keep native surfaces and use a small requestAnimationFrame scheduler installed before site scripts instead. This also handles engines that cache requestAnimationFrame during startup.

The sandboxed game preload installs the scheduler in the page world and retains its setter in the isolated world. It exposes no API to the site. Host updates carry only a validated frame budget. Subframe preload execution keeps sandbox, context isolation and web security enabled; site Node integration stays disabled. Frame creation and navigation refresh the current budget, including cross-origin and late frames. Owned popups follow their account budget.

## Limits

Clock timestamps, timers, networking, CSS animations and worker loops remain native. The target is a ceiling on animation callbacks, not a guaranteed CPU/power budget or guaranteed achieved FPS. Games that advance state by frame count may progress differently. Minimized windows retain normal Chromium hidden-page behavior. Keeping a page loaded still costs RAM.

## Verification and delivery

Check exact scheduler budgets, cancellation and error isolation in unit tests; validate live callbacks, timers, cached functions, same/cross-origin frames, persistence and UI menus with isolated Electron fixtures. Check the five-minute timer using the main-process fake clock, and exercise existing focus, keyboard, session, layering, shutdown and portable-update checks. Build a clean signed portable release and publish it on GitHub. Leave the user's installed app untouched so they can test the Update button.
