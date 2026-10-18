# Astria

A compact multi-account browser for Windows, designed for browser games such as Huntera and YggIdle. Each account has its own persistent session. Astria is an independent project and is not affiliated with those games or Idle Labs.

## Download and run

Download **Astria-Portable-x.y.z.zip** from [Releases](https://github.com/IgorKugan/Astria/releases/latest). Extract the entire folder to a short, writable path such as `D:\Astria`, then open **Astria.exe**. Windows x64 is required. No Node.js or installation is needed to run the portable edition. Keep every supporting file and `portable.flag` beside the executable. Windows may ask for confirmation because the binary does not have a commercial code-signing certificate.

Add a workspace and an account with **+**. Enter the game's URL and log in inside its page. Use a separate Astria account for each game account. Right-click an account to rename it, choose any color or control its activity. Drag the sidebar edge to resize it. Panel headers contain layout controls, theme toggle and approximate page RAM/CPU usage.

| Activity | Behavior |
| --- | --- |
| Always active | Keeps the page running in the background, including while minimized. Uses more memory. |
| Active when visible | Reduces background activity and unloads a hidden page after one minute. It reconnects when shown. |
| Suspended | Unloads immediately and reopens with the same profile when resumed. |

Unloading can disconnect a character. Offline progression depends on the game. Page memory figures are approximate and exclude shared application/GPU overhead.

## Portable saves and sessions

Everything managed by the portable app stays beside the executable, under **Save**:

| Folder | Contents |
| --- | --- |
| Profile | Astria settings and separate Chromium account profiles |
| Games | Saves/files downloaded or exported from games |
| SharedAssets | Reusable anonymous public assets, up to 2 GB, 16 MB per file |
| Backups | Configuration exports and previous programs from updates |
| Updates | Download staging and update logs |
| Temp, Logs, CrashDumps | App temporary and diagnostic data |

To move or back up the app, **close it first and copy the entire folder, including Save**. Never run two copies against the same Save. Windows can retain its own execution records outside the app folder. Cookies protected by Windows may require a new login on another PC or Windows user. Server-side game progress still requires the game account and an internet connection.

The menu **Abrir pasta Save** opens these files. `Save/LEIA-ME.txt` maps account names to their profile folders. Configuration export contains names, URLs and preferences; it does not export logins. Do not share your populated Save folder. Use the clean release ZIP to distribute Astria.

Public assets from the supported game/CDN hosts may be downloaded once and reused between profiles. Requests are anonymous and responses must pass the public-cache checks. APIs, cookies, private responses and per-account storage are never shared. Other sites and files above the cache limit use Chromium's own per-profile cache. A game's own CacheStorage/IndexedDB remains private and may contain additional cached assets.

## Updates

Open **☰ → Verificar atualizações…** to check GitHub Releases. Download the new version, then choose **Reiniciar e atualizar** when ready. There are no background checks or forced restarts. The updater verifies the signed manifest and each file, backs up the previous program under Save/Backups and preserves Save. It restores the previous program if replacement or initial interface startup fails. See [SECURITY.md](SECURITY.md) for the trust model and limitations.

## Build from source

Install Node.js 24 LTS and Git, then:

```powershell
git clone https://github.com/IgorKugan/Astria.git
cd Astria
npm ci
npm start
```

Development uses this checkout's ignored Save/Profile. `npm test` runs validation, cache, updater and public-file checks. `npm run test:e2e` tests the interface and storage isolation in real Chromium. `npm run test:shared` tests networking and shared assets with a local server. `npm run package:portable` creates a clean versioned portable folder. Set `ASTRIA_TEST_AUTO_SAVE=1` before `npm run test:portable` to test downloads without an interactive Save dialog. All automated session tests use temporary profiles.

See [CONTRIBUTING.md](CONTRIBUTING.md) for release signing and [SECURITY.md](SECURITY.md) for private vulnerability reporting. MIT license. No game code, game assets, account credentials or personal profiles are included in this repository.
