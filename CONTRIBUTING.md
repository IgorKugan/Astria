# Project policy / Política do projeto

This project is maintained by its owner. **External contributions are not accepted.** Pull requests, public issues and discussions are disabled. Download the portable ZIP from Releases. Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

Este projeto é mantido pelo proprietário. **Contribuições externas não são aceitas.** Pull requests, issues públicas e discussões estão desativados. Baixe o ZIP portátil em Releases. Relate vulnerabilidades em particular conforme [SECURITY.md](SECURITY.md).

## Owner: build and release

Use Windows x64, Node.js 24 LTS and Git. Run `npm ci`, `npm test`, `npm run test:e2e` and `npm run test:shared`. `npm start` uses an ignored development profile under this checkout's Save/Profile; it does not open personal portable profiles.

`npm run package:portable` creates a new versioned folder. Set `ASTRIA_TEST_AUTO_SAVE=1` for the noninteractive download fixture in `npm run test:portable`. Tests use temporary profiles and fixture accounts. Local UI tests use real mouse drags; hosted Windows CI exercises the document pointer fallback because its desktop may revoke pointer capture.

The manual **Prepare release** workflow builds, tests and signs a clean ZIP, then creates a draft GitHub Release. Review before publishing. `ASTRIA_UPDATE_PRIVATE_KEY` is a private GitHub Actions secret. No key, account data, game content or populated Save belongs in Git. ZIPs contain program files only; Save is created on first launch or preserved from an earlier version.

The optional `npm run test:update` lifecycle test uses a temporary copy. Close only that copy when requested, wait for the process to exit, then press Enter in its terminal. Never pass your populated personal app as `ASTRIA_OLD_PORTABLE`.
