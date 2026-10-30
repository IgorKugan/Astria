# Floating window resize and pin

The user requested resizing the existing floating account and then a pin icon to prevent movement while retaining click-to-swap.

- Reuse the trusted transparent control view and existing native game; no new dependency or duplicate game renderer.
- Add a bottom-right aspect-preserving resize grip, smaller/larger buttons and keyboard resize.
- Save relative width and pin state alongside the existing per-workspace position. Clamp geometry inside the primary game's image.
- Pin locks position and size; it does not prevent switching accounts. Unpin restores adjustments. Ordinary window resizing can still clamp the miniature inside the available area.
- Validate IPC input and sender identity. Keep saves, logins, game activity and browser shortcuts unchanged.
- Verify normalization/geometry, real Electron drag and button resizing, pin locking and swapping, stable game instances/viewport, keyboard, both themes/languages, and persistence after restart.
- Run project checks, package a signed portable 1.8.1, verify it and publish for the existing updater. Do not replace the user's running copy.
