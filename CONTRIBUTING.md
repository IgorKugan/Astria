# Contributing

Use Node.js 24 LTS, Git and Windows x64. Run `npm ci`, `npm test`, `npm run test:e2e` and `npm run test:shared`. `npm start` uses a development profile under this checkout's ignored `Save/Profile`; it does not open your portable profiles.

Keep game sessions sandboxed. Never log or commit cookies, tokens, real account details, profiles, keys or populated saves. Tests must use temporary profiles and local fixture servers. Add a regression test for changes affecting session isolation, networking or updates.

Build with `npm run package:portable`. The versioned output directory must be new. For a personal fork, generate an update key with `node scripts/create-release-key.js`, change `src/release-config.json` to your repository, and retain the private key outside version control. Release signing requires `ASTRIA_UPDATE_PRIVATE_KEY` in the release environment or the ignored local key file. Never rotate the public key without a migration plan for existing users.

Releases are prepared manually from a reviewed commit. The workflow builds and tests a clean portable ZIP and creates a draft release. Inspect it before publishing. `Save` is created on first launch and is not part of release archives. No game assets are redistributed.

After preparing the signed release, `npm run test:update` runs the Windows updater against a temporary copy. When requested, close only the temporary copy identified in the test output and press Enter in the test terminal. The test checks the normal restart, account/cookie preservation and failed-launch rollback. `ASTRIA_OLD_PORTABLE` can point to an earlier clean version to test an actual upgrade. It must never point to your populated personal app folder.
