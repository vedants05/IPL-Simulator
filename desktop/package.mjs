import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { build, Platform, Arch } = require('electron-builder');
const desktop = path.dirname(fileURLToPath(import.meta.url));
const config = require('./electron-builder.cjs');
await build({
  projectDir: desktop,
  config,
  targets: Platform.WINDOWS.createTarget(process.argv.includes('--dir') ? ['dir'] : ['nsis'], Arch.x64),
  publish: 'never',
});
