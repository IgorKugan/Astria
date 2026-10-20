# Astria

[English](README.md) · [Português (Brasil)](README.pt-BR.md)

A compact, portable multi-account browser for **browser games** on Windows. Open the games you choose, keep separate account sessions, arrange their windows and control which pages stay active. No game accounts or game files are included.

## Download

**[Download the latest portable ZIP](https://github.com/IgorKugan/Astria/releases/latest)** from Releases. Choose `Astria-Portable-x.y.z.zip`; GitHub's automatic “Source code” archives are for developers, not the runnable app.

1. Extract the ZIP completely to a short, writable path such as `D:\Astria`.
2. Open **Astria.exe** inside the extracted folder.
3. Keep all supporting files and `portable.flag` beside the executable.

Windows x64 is required. You do not need Node.js or an installer. Windows may show SmartScreen or Firewall prompts because the executable does not have a commercial Windows code-signing certificate.

## Update your existing portable folder by copying files

1. Close Astria and back up your existing folder.
2. Extract the new ZIP somewhere else.
3. Copy **all files and folders inside `Astria-Portable-x.y.z`** into your existing Astria folder, replacing the program files. `Astria.exe` must end up beside your existing `Save` folder, not inside another nested folder.
4. **Keep your existing Save folder.** Release ZIPs contain no Save folder, so they do not replace profiles, logins or downloaded saves.
5. Open Astria.exe from your existing folder.

The in-app alternative is **☰ → Check for updates… → Download update → Restart and update**. It verifies the signed package, preserves Save and keeps the previous program in Save/Backups. It never forces a restart while you are playing.

**Upgrading from 1.6.0 or 1.6.1:** their Windows updater can stop after closing Astria. Use the ZIP replacement steps above for this first upgrade. Version 1.6.2 fixes the helper lifecycle for subsequent in-app updates. Your Save folder remains separate from program files.

## Language

Open **☰ → Language → English / Português (Brasil)**. The choice is saved and applies immediately to Astria's interface, menus and dialogs. It does not change the language of websites or games. Fresh installations start in English; existing profiles keep Portuguese until you choose another language.

## Accounts, layouts and activity

- Use **+** to add a workspace or an account. Enter any browser game's HTTP/HTTPS URL and log in inside its page.
- Each Astria account has its own cookies, localStorage, IndexedDB, CacheStorage and service workers.
- Right-click an account to rename it, choose a color, control sound/zoom or change its activity.
- Drag the sidebar edge to resize it. Panel headers contain layouts, theme switch and approximate page RAM/CPU usage.

| Mode | Behavior |
| --- | --- |
| Always active | Keeps the page loaded and timers active across accounts and workspaces. Uses more resources. See rendering limitations below. |
| Active when visible | Reduces background activity and unloads a hidden page after one minute. Showing it reconnects the game. |
| Suspended | Unloads immediately. Resume reopens the same saved profile. |

Unloading may disconnect a character. Offline progress depends on the game. Memory figures exclude shared app/GPU overhead. Compatibility depends on the website and its authentication requirements.

## Portable data

Astria creates **Save** beside the executable on first launch:

| Folder | Contents |
| --- | --- |
| Profile | Settings and separate Chromium account profiles |
| Games | Files/saves downloaded or exported from games |
| Backups | Configuration exports and previous programs from updates |
| Updates | Verified update staging and local update logs |
| Temp, Logs, CrashDumps | Temporary and diagnostic data |

Use **☰ → Open Save folder** to find your files. `Save/LEIA-ME.txt` maps account names to profile folders. To move or back up Astria, close it first and copy the **entire folder, including Save**. Do not run two copies using the same Save.

Online progress normally stays on the game's server. Windows-protected cookies may require a new login on another PC or Windows user. Configuration export includes names, URLs and preferences, but no cookies or passwords. **Never distribute your populated Save folder.** Share the clean release ZIP.

Each account uses Chromium's native HTTP cache inside its own profile. Game files are not intercepted or transferred through Astria's main process. This can use more disk space than a shared cache, while avoiding that extra loading overhead. Existing `Save/SharedAssets` folders from older releases are preserved but no longer used. All account caches move with Save.

Always active keeps pages loaded with timers unthrottled when switching accounts or workspaces. Every active game still needs its own CPU, RAM and GPU resources; running several can reduce the FPS available to the selected game. Use Active when visible or Suspended for accounts that do not need to keep running. Canvas rendering can pause in hidden accounts or while the window is minimized even though timers remain active. Keep the game visible if it requires continuous rendering; game progress depends on how that game handles background activity.

## Project policy and security

The official project is maintained by its owner. Outside pull requests, issues and discussions are disabled. Other users can download releases and read the public source; they cannot push changes to the official repository. Public materials remain copyable under the included license.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting and security boundaries. Owner build instructions are in [CONTRIBUTING.md](CONTRIBUTING.md). MIT license.
