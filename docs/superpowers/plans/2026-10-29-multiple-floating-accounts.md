# Multiple floating accounts implementation plan

**Goal:** Left-clicking an account color selects it; right-click customization retains the wheel. Floating layout lets the user select several secondary accounts.

**Architecture:** Reuse native game views and one trusted transparent control per floating slot. Store normalized per-slot geometry and pin state in the workspace; migrate the previous single floating setting without losing it. Clicking a miniature exchanges that slot with the main account and preserves other slots.

**Tech stack:** Existing Electron, JavaScript, HTML/CSS and Playwright. No new dependencies.

## Constraints

- Preserve independent sessions, game instances, existing activity limits, shortcuts and portable Save.
- Main account cannot also occupy a miniature; duplicates, foreign-workspace IDs and invalid selections are rejected.
- Each control may operate only its own slot. Dialogs, workspace changes, suspension and closing must hide or release every helper correctly.
- Keep the compact interface, English and Portuguese labels, mouse/keyboard controls and per-window pin/resize behavior.

## Tasks

- [ ] Add regression coverage for color-dot selection while collapsed; retain right-click wheel checks.
- [ ] Add pure selection/migration tests and multi-window native tests, observe failures, then implement normalized slot arrays and per-slot view/frame lifecycle.
- [ ] Add the account selection dialog to Floating layout and its menu; preserve existing swap/drag/resize/pin actions for each slot.
- [ ] Verify changing or removing windows, independent positions/pins, targeted swaps, viewport/session preservation, minimized/modal/Ultra behavior and restore after restart.
- [ ] Review, run the project suite, build and verify a signed portable release, and publish for the user's updater without replacing the actual app or Save.
