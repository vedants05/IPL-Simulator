# Windows desktop prototype

The desktop app bundles Electron, a production Next.js server, fonts, stadium assets, and a snapshot of the public game database. It runs locally at `http://127.0.0.1:47831`; players do not install Node.js or run a separate website. The server binds only to loopback. A fixed origin keeps IndexedDB/localStorage saves stable between launches and updates. If that port is occupied, startup fails with a clear error instead of changing the origin and hiding existing saves.

## Build and run

Use Node.js **22.12 or later** (Node 24 LTS recommended).

```powershell
npm ci
npx install-electron
# Start the website in a separate terminal:
npm run dev -- --port 3002
# Bundle its public API data and build the desktop server:
npm run desktop:build
# Open the desktop app:
npm run desktop:start
# Produce a Windows x64 NSIS installer:
npm run desktop:dist
```

The installer is written to `release/`. `npm run desktop:pack` produces an unpacked application instead. Once data has been downloaded, `node desktop/build.mjs --reuse-data` rebuilds without refreshing the data snapshot. Set `DESKTOP_DATA_SOURCE` to another local server URL if port 3002 is unavailable. The build refuses empty game databases.

`desktop:dist` packages the most recently prepared `.desktop/` build. Rebuild before distributing changes. Do not distribute development builds or the repository itself.

## Local careers and online services

Every launch opens Home with three tiles at the upper left on the themed background: **Start Career** (the ten-team selector), **Continue Career** (the most recently updated local save, showing its team, season, and game date), and **Load Career** (the saves screen). Continue is disabled when no local career exists. Existing careers open only after an explicit load/continue action. The `/resume` route handles entering the selected career; an empty profile returns Home.

In-game settings provide **Exit to Home Page**, which pauses play and keeps the career saved. This replaces the destructive Restart Game action.

All `/game` screens wait for local save loading and require a save ID plus a valid selected team. Empty or invalid selections return Home before game components and background effects mount. The old automatic CSK career creation and team guessing have been removed. Existing careers are retained.

The first desktop launch defaults to guest play. Players, teams, staff, and retention API responses come from the bundled snapshot. Existing local career persistence, match archives, and international records use Chromium storage in the app's persistent user-data folder. Guest route navigation and the saves screen do not require Supabase authentication. Sign-in and cloud saves still require internet. Signing in removes the guest cookie using the existing sign-in flow.

Browser and desktop storage are separate. Browser careers are not automatically imported. To move a career using the existing cloud service, upload it from the browser and sign into the same account in the desktop app.

Use **Game → Open save data folder** to locate the profile. Close the app before copying this folder as a backup. Keep backups private: the profile can contain account sessions. Uninstalling retains app data. Automatic backups and an in-app backup import/export flow are not implemented in this prototype.

## Verification

The built-in smoke test uses a separate profile and blocks outbound DNS in the server and outbound HTTP(S) in the renderer:

```powershell
npx electron desktop --smoke-test --offline-test --test-profile=C:/path/to/a/disposable-profile
```

It checks bundled API responses, guest access, renderer isolation, IndexedDB/localStorage, and creates a Mumbai Indians career through the setup interface. It writes `SMOKE PASS` to `logs/desktop.log` in the test profile and captures setup/auction screenshots. Repeat with `--resume-test` and the same disposable profile to verify the saved career reopens after a full restart (`RESUME PASS`). The packaged executable accepts these same flags without the `desktop` argument. Do not point this at your normal profile: it creates a test career.

## Distribution limits

This is an unsigned Windows x64 prototype with the default Electron application icon. Windows may show an unknown-publisher warning. Code signing, custom branding, automatic updates, crash reporting, and a complete season-long offline regression pass remain release work. No installer is published automatically.

Private `.env` files are excluded from the staged server and installer. Public Supabase URL/anonymous key values are part of the client build as on the website; database row-level security remains necessary. The server-only editor password and session secret are deliberately not bundled, so the existing password-protected editor is unconfigured in distributed builds. Do not add service-role keys or signing secrets to the desktop package.

The main window has Node integration disabled, context isolation and sandboxing enabled, and blocks external navigation. HTTPS links open in the system browser. The app owns its local server process and stops it when exiting; only one desktop instance runs at a time. Startup/runtime diagnostics are available through **Game → Open logs folder**.
