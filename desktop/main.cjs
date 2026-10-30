const { app, BrowserWindow, Menu, dialog, session, shell, utilityProcess } = require('electron');
const { appendFileSync, existsSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const net = require('node:net');

// Keep the origin stable: IndexedDB and localStorage saves are scoped to it.
const PORT = process.argv.includes('--smoke-test') ? 47832 : 47831;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let window;
let server;
let quitting = false;
const smoke = process.argv.includes('--smoke-test');
const offline = process.argv.includes('--offline-test');
const resumeTest = process.argv.includes('--resume-test');
const profileArg = process.argv.find(arg => arg.startsWith('--test-profile='));
if (profileArg && smoke) app.setPath('userData', path.resolve(profileArg.split('=').slice(1).join('=')));
app.setName('IPL Manager');

function log(message) {
  mkdirSync(app.getPath('logs'), { recursive: true });
  appendFileSync(path.join(app.getPath('logs'), 'desktop.log'), `${new Date().toISOString()} ${message}\n`);
}
function assertPortAvailable() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Local port ${PORT} is in use. Close the other IPL Manager process and try again.`)));
    probe.listen(PORT, '127.0.0.1', () => probe.close(resolve));
  });
}
async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (quitting || !server) throw new Error('The game server stopped during startup.');
    try {
      const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The local game server did not start. See desktop.log in the logs folder.');
}
function isInternal(url) {
  try { return new URL(url).origin === ORIGIN; } catch { return false; }
}
function openExternal(url) {
  // Only deliberate HTTPS links can leave the app; no file or shell protocols.
  try { if (new URL(url).protocol === 'https:') void shell.openExternal(url); } catch {}
}
async function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 1024, minHeight: 700,
    title: 'IPL Manager', backgroundColor: '#10151c', show: !smoke,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: !smoke },
  });
  window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isInternal(url)) { event.preventDefault(); openExternal(url); }
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('render-process-gone', (_event, details) => log(`Renderer exited: ${details.reason}`));
  window.on('closed', () => { window = null; });
  await window.loadURL(ORIGIN);
}
async function smokeTest() {
  async function exitToHome() {
    await window.webContents.executeJavaScript(`(async () => {
      const settings = document.querySelector('button[title="Open Settings"]');
      if (!settings) throw new Error('Settings button missing');
      settings.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const buttons = [...document.querySelectorAll('button')];
      if (buttons.some(button => button.textContent.includes('Restart Game'))) throw new Error('Restart Game is still visible');
      const exit = buttons.find(button => button.textContent.includes('Exit to Home Page'));
      if (!exit) throw new Error('Exit to Home Page button missing');
      exit.click();
    })()`);
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (await window.webContents.executeJavaScript(`location.pathname === '/' && !!document.querySelector('a[href="/saves"]')`)) return;
    }
    throw new Error('Exit to Home Page did not return Home');
  }
  const home = await window.webContents.executeJavaScript(`({
    path: location.pathname,
    start: document.querySelector('a[href="/setup"]')?.textContent,
    load: document.querySelector('a[href="/saves"]')?.textContent,
  })`);
  if (home.path !== '/' || home.start !== 'Start Career' || home.load !== 'Load Career') throw new Error('Home page did not open with both career buttons');
  if (process.argv.includes('--guard-test')) {
    for (const route of ['/game/overview', '/game/auction', '/game/teams/CSK', '/resume']) {
      await window.loadURL(`${ORIGIN}${route}`);
      let returnedHome = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        returnedHome = await window.webContents.executeJavaScript(`location.pathname === '/' && !!document.querySelector('a[href="/setup"]')`);
        if (returnedHome) break;
      }
      if (!returnedHome) throw new Error(`Empty career did not return Home from ${route}`);
    }
    const createdCareer = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const request = indexedDB.open('ipl-simulator-game-state', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('saves')) { db.close(); resolve(false); return; }
        const tx = db.transaction('saves', 'readonly');
        const read = tx.objectStore('saves').get('ipl-simulator-save-v5');
        read.onsuccess = () => resolve(Boolean(read.result && JSON.parse(read.result).state?.saveId));
        read.onerror = () => reject(read.error);
        tx.oncomplete = () => db.close();
      };
    })`);
    if (createdCareer) throw new Error('Opening an empty game route created a career');
    log('GUARD PASS: empty game routes returned Home without creating a career');
    console.log('GUARD PASS: empty game routes returned Home without creating a career');
    app.quit();
    return;
  }
  writeFileSync(path.join(app.getPath('userData'), 'smoke-home.png'), (await window.webContents.capturePage()).toPNG());
  const api = {};
  for (const name of ['players', 'teams', 'staff', 'retentions']) {
    const response = await fetch(`${ORIGIN}/api/${name}`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const data = await response.json();
    api[name] = name === 'staff' ? data.members.length : data.length;
    if (!api[name]) throw new Error(`${name} is empty`);
  }
  const state = await window.webContents.executeJavaScript(`(async () => {
    const previous = localStorage.getItem('desktop-smoke');
    localStorage.setItem('desktop-smoke', 'persistent');
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('ipl-desktop-smoke', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('saves');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put('saved-career', 'test');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    return { title: document.title, node: typeof window.require, guest: document.cookie.includes('ipl-guest=1'), previous };
  })()`);
  if (state.node !== 'undefined' || !state.guest) throw new Error('Renderer isolation or guest session failed');
  if (resumeTest && process.argv.includes('--recent-save-test')) {
    await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const request = indexedDB.open('ipl-simulator-game-state', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('saves', 'readwrite');
        const store = tx.objectStore('saves');
        const read = store.get('ipl-simulator-save-v5');
        read.onsuccess = () => {
          const state = JSON.parse(read.result);
          state.state.saveId = 'desktop-most-recent-test';
          const local_storage = {};
          store.put(JSON.stringify({ state, local_storage, updated_at: new Date(Date.now() + 60000).toISOString() }), 'ipl-local-save:desktop-most-recent-test');
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    })`);
    await window.loadURL(ORIGIN);
  }
  if (resumeTest) {
    let expectedContinueId;
    if (process.argv.includes('--continue-test')) {
      for (let attempt = 0; attempt < 50; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        expectedContinueId = await window.webContents.executeJavaScript(`(() => {
          const button = document.querySelector('button[aria-label="Continue Career"]');
          return button && !button.disabled ? button.dataset.saveId : null;
        })()`);
        if (expectedContinueId) break;
      }
      if (!expectedContinueId) throw new Error('Recent career did not appear on Home');
      if (process.argv.includes('--recent-save-test') && expectedContinueId !== 'desktop-most-recent-test') throw new Error('Continue tile did not select the most recently updated local save');
      writeFileSync(path.join(app.getPath('userData'), 'smoke-home.png'), (await window.webContents.capturePage()).toPNG());
      await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="Continue Career"]').click()`);
    } else {
    await window.webContents.executeJavaScript(`document.querySelector('a[href="/saves"]').click()`);
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const continued = await window.webContents.executeJavaScript(`(() => {
        const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Continue');
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (continued) break;
    }
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    const recovered = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const request = indexedDB.open('ipl-simulator-game-state', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('saves', 'readonly');
        const read = tx.objectStore('saves').get('ipl-simulator-save-v5');
        read.onsuccess = () => { const state = read.result ? JSON.parse(read.result).state : null; resolve(state ? { saveId: state.saveId, team: state.userTeamId, players: Object.keys(state.players || {}).length } : null); };
        read.onerror = () => reject(read.error);
        tx.oncomplete = () => db.close();
      };
    })`);
    const expectedTeam = 'MI';
    if (!state.previous || !recovered?.saveId || recovered.team !== expectedTeam || !recovered.players || !window.webContents.getURL().includes('/game/auction')) throw new Error('Saved career was not recovered after restart');
    if (expectedContinueId && recovered.saveId !== expectedContinueId) throw new Error('Continue Career opened a different save from the tile');
    writeFileSync(path.join(app.getPath('userData'), 'smoke-resumed.png'), (await window.webContents.capturePage()).toPNG());
    await exitToHome();
    log(`RESUME PASS ${JSON.stringify(recovered)}`);
    console.log('RESUME PASS', JSON.stringify(recovered));
    app.quit();
    return;
  }
  await window.webContents.executeJavaScript(`document.querySelector('a[href="/setup"]').click()`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  if (!window.webContents.getURL().includes('/setup')) throw new Error('Guest setup redirected');
  const saved = await window.webContents.executeJavaScript(`localStorage.getItem('desktop-smoke')`);
  if (saved !== 'persistent') throw new Error('Local storage did not survive navigation');
  const idb = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const request = indexedDB.open('ipl-desktop-smoke', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('saves', 'readonly');
      const read = tx.objectStore('saves').get('test');
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
      tx.oncomplete = () => db.close();
    };
  })`);
  if (idb !== 'saved-career') throw new Error('IndexedDB persistence failed');
  await new Promise(resolve => setTimeout(resolve, 2500));
  writeFileSync(path.join(app.getPath('userData'), 'smoke-setup.png'), (await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript(`(async () => {
    const click = text => {
      const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes(text));
      if (!button || button.disabled) throw new Error('Missing enabled button: ' + text);
      button.click();
    };
    click('Mumbai Indians');
    await new Promise(resolve => setTimeout(resolve, 100));
    click('NEXT: CONFIRM');
    await new Promise(resolve => setTimeout(resolve, 100));
    click('BEGIN SEASON');
  })()`);
  let career;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    career = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const request = indexedDB.open('ipl-simulator-game-state', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('saves')) { db.close(); resolve(null); return; }
        const tx = db.transaction('saves', 'readonly');
        const read = tx.objectStore('saves').get('ipl-simulator-save-v5');
        read.onsuccess = () => {
          const state = read.result ? JSON.parse(read.result).state : null;
          resolve(state ? { saveId: state.saveId, team: state.userTeamId, players: Object.keys(state.players || {}).length } : null);
        };
        read.onerror = () => reject(read.error);
        tx.oncomplete = () => db.close();
      };
    })`);
    if (career?.saveId && career?.team === 'MI' && career?.players > 0 && window.webContents.getURL().includes('/game/auction')) break;
  }
  if (!career?.saveId || career.team !== 'MI' || !career.players || !window.webContents.getURL().includes('/game/auction')) throw new Error(`Offline career creation failed: ${JSON.stringify(career)}`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  writeFileSync(path.join(app.getPath('userData'), 'smoke-auction.png'), (await window.webContents.capturePage()).toPNG());
  await exitToHome();
  log(`SMOKE PASS ${JSON.stringify({ api, state, career, offline })}`);
  console.log('SMOKE PASS', JSON.stringify({ api, state, career, offline }));
  app.quit();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    const resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '.desktop');
    const serverDir = path.join(resources, 'server');
    if (!existsSync(path.join(serverDir, 'server.js'))) throw new Error('Desktop build missing. Run npm run desktop:build first.');
    await assertPortAvailable();
    const env = { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(PORT), IPL_DESKTOP: '1', IPL_DESKTOP_DATA: path.join(resources, 'data') };
    // A bootstrap also works in packaged Electron, where NODE_OPTIONS is restricted.
    delete env.NODE_OPTIONS;
    env.IPL_DESKTOP_OFFLINE_TEST = offline ? '1' : '0';
    const launcher = app.isPackaged ? path.join(resources, 'server-launcher.cjs') : path.join(__dirname, 'server.cjs');
    server = utilityProcess.fork(launcher, [path.join(serverDir, 'server.js')], { cwd: serverDir, env, stdio: 'pipe', serviceName: 'IPL Manager local server' });
    server.stdout.on('data', chunk => log(String(chunk).trim()));
    server.stderr.on('data', chunk => log(String(chunk).trim()));
    server.on('exit', code => {
      server = null;
      if (!quitting) { log(`Server exited ${code}`); if (!smoke) dialog.showErrorBox('IPL Manager stopped', 'The local game server stopped. Restart the app. Your saved data remains in the app data folder.'); app.exit(1); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    if (offline) session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^https?:/.test(details.url) && !isInternal(details.url) }));
    // First launch defaults to local play. Signing in removes this cookie.
    const cookies = await session.defaultSession.cookies.get({ url: ORIGIN, name: 'ipl-desktop-initialized' });
    if (!cookies.length) {
      await session.defaultSession.cookies.set({ url: ORIGIN, name: 'ipl-guest', value: '1', expirationDate: Date.now() / 1000 + 365 * 86400, sameSite: 'lax' });
      await session.defaultSession.cookies.set({ url: ORIGIN, name: 'ipl-desktop-initialized', value: '1', expirationDate: Date.now() / 1000 + 365 * 86400, sameSite: 'lax' });
    }
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Game', submenu: [
        { label: 'Saves', click: () => window?.loadURL(`${ORIGIN}/saves`) },
        { label: 'Open save data folder', click: () => shell.openPath(app.getPath('userData')) },
        { label: 'Open logs folder', click: () => shell.openPath(app.getPath('logs')) },
        { type: 'separator' }, { role: 'quit' },
      ] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
    ]));
    await waitForServer();
    await createWindow();
    if (smoke) await smokeTest();
  }).catch(error => { log(error.stack || error.message); if (!smoke) dialog.showErrorBox('Unable to start IPL Manager', error.message); app.exit(1); });
}
app.on('before-quit', () => { quitting = true; if (server) server.kill(); });
app.on('window-all-closed', () => app.quit());
