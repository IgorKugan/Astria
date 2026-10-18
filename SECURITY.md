# Security

Please report a vulnerability privately through this repository's **Security → Report a vulnerability** page. Do not post account tokens, cookies, profiles or private save files in issues.

## Boundaries

- Game pages run in sandboxed Chromium views with Node integration disabled, context isolation and web security enabled. They receive no Astria preload or privileged bridge. IPC operations accept only the local interface's main frame. Camera, microphone, location and device permissions are denied.
- Accounts use separate persistent Chromium partitions. Cookies, localStorage, IndexedDB, CacheStorage and service workers remain per account. The same operating-system user can access the files; this is session isolation, not protection against someone with access to your Windows account.
- Shared public assets use anonymous HTTPS requests with no cookies or authorization. DNS results must be public IPv4 addresses, and the checked address is pinned in the TLS connection lookup to prevent DNS rebinding to a private network. Private responses, APIs, sensitive paths and responses without valid freshness are excluded. Downloads are bounded to four concurrent transfers. Other requests use native Chromium networking.
- Portable data is stored under `Save`, beside the executable. **Do not upload or distribute your populated Save directory.** Online game progress is normally stored on the game's server. Windows-protected cookies may require another login after moving PCs.
- Updates are manual and come from this repository's GitHub Releases over HTTPS. Ed25519 signatures authenticate the manifest, which includes a SHA-256 digest and size for every program file and the ZIP. Extraction rejects unknown paths, duplicates, links and files exceeding the limits. Only known program paths can be replaced; `Save` is never an update payload. The previous program is backed up and restored if replacement or initial interface startup fails. Game compatibility cannot be guaranteed by the startup check.
- No GitHub token or private signing key is shipped in the app. Development keys remain local or in a GitHub Actions secret. Forks must generate their own update identity and change the configured repository before distributing builds.

## Limitations and maintenance

The Windows binaries are not Authenticode signed. Windows may display SmartScreen or Firewall prompts. The update manifest signature is separate from Windows code signing. Source review, tests and dependency scans reduce risk; they cannot guarantee the absence of vulnerabilities.

The app does not bypass a game's authentication, anti-cheat or terms. Game content, code and credentials are not included in the download. Websites and game servers are separate trust boundaries. Keep Windows and Astria current, and avoid importing configurations from people you do not trust.

Only the latest released version receives security fixes. `npm audit`, tests, CodeQL and secret scanning are part of maintenance. The owner reviews alerts and dependency changes before releasing. External contributions are disabled; security reports can still be submitted privately through GitHub's vulnerability reporting feature.
