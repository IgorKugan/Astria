# Continuous power saving

Power saving must keep the game loaded, connected and running, including when another account or workspace is shown. It must not suspend, reload or discard the page. Preserve existing per-account FPS preferences and the five-minute visible-only timeout.

The previous limiter polls native animation frames at display frequency even when it only delivers a small fraction to the game. Use one internal wake timer between animation budgets, then register each game callback separately through native requestAnimationFrame. This reduces scheduling work while preserving native timestamps, microtask ordering, errors and cancellation. Switching to maximum performance cancels any pending wait immediately. Native game timers, networking and workers remain unchanged.

Add 1 and 5 FPS to the existing 10, 15 and 30 FPS choices; retain the 15 FPS default. Replace the flag with a battery-and-lightning outline SVG in the existing icon family. Explain RAM behavior in EN/PT-BR help and documentation.

Loaded games still need their live data and images. A fixed low RAM cap can exhaust the renderer, and repeated forced cache clearing can cause extra work and stalls. Do not add either, trim Windows working sets, spoof memory pressure across the application, or silently disconnect accounts. Browser memory measurement remains unchanged. Minimum live memory and actual CPU savings depend on the game; frame-count-based progression can differ at low FPS.

Verify reduced native animation requests at 60/144 Hz, every frame budget, cancellation during sleep, immediate uncapped resume, browser callback ordering, iframe/popup isolation and unchanged connections/storage. Build and publish a signed portable update after local and GitHub checks. Leave the installed copy for the user to update.
