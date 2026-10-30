const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fs = require('node:fs/promises');
module.exports = {
  appId: 'com.iplmanager.desktop',
  productName: 'IPL Manager',
  electronVersion: require('electron/package.json').version,
  electronDist: path.join(root, 'node_modules/electron/dist'),
  directories: { app: __dirname, output: path.join(root, 'release') },
  files: ['main.cjs', 'package.json', 'offline-test.cjs', '!node_modules/**/*'],
  extraResources: [
    { from: path.join(root, '.desktop/server'), to: 'server', filter: ['**/*', '!**/.env*'] },
    // electron-builder's generic copier skips a root node_modules directory.
    { from: path.join(root, '.desktop/server/node_modules'), to: 'server/node_modules', filter: ['**/*', '!**/.env*'] },
    { from: path.join(root, '.desktop/data'), to: 'data' },
    { from: path.join(__dirname, 'server.cjs'), to: 'server-launcher.cjs' },
    { from: path.join(__dirname, 'offline-test.cjs'), to: 'offline-test.cjs' },
  ],
  asar: true,
  npmRebuild: false,
  async afterPack(context) {
    const resources = path.join(context.appOutDir, 'resources');
    for (const file of ['server/server.js', 'server/node_modules/next/package.json', 'server-launcher.cjs', 'data/players.json', 'data/teams.json', 'data/staff.json', 'data/retentions.json']) {
      await fs.access(path.join(resources, file));
    }
    async function checkPrivateFiles(dir) {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.env')) throw new Error(`Private environment file in desktop package: ${entry.name}`);
        if (entry.isDirectory()) await checkPrivateFiles(path.join(dir, entry.name));
      }
    }
    await checkPrivateFiles(path.join(resources, 'server'));
  },
  win: { target: [{ target: 'nsis', arch: ['x64'] }], signAndEditExecutable: false },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, deleteAppDataOnUninstall: false },
};
