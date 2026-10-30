import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, '.desktop');
const build = path.join(root, '.next-desktop');
const run = (script, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}`)));
});

await mkdir(path.join(stage, 'data'), { recursive: true });
if (!process.argv.includes('--reuse-data')) {
  const origin = process.env.DESKTOP_DATA_SOURCE || 'http://127.0.0.1:3002';
  const source = new URL(origin);
  if (!['127.0.0.1', 'localhost'].includes(source.hostname)) throw new Error('DESKTOP_DATA_SOURCE must be your local development server.');
  for (const name of ['players', 'teams', 'staff', 'retentions']) {
    const response = await fetch(new URL(`/api/${name}`, origin), { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Unable to bundle ${name}: HTTP ${response.status}. Start the website first.`);
    const data = await response.json();
    if (name === 'staff' ? !Array.isArray(data.members) || !data.members.length : !Array.isArray(data) || !data.length) {
      throw new Error(`Refusing to ship an empty ${name} database.`);
    }
    await writeFile(path.join(stage, 'data', `${name}.json`), JSON.stringify(data));
    console.log(`Bundled ${name}: ${name === 'staff' ? data.members.length : data.length} records`);
  }
}
// Validate cached data even when rebuilding without a connection.
for (const name of ['players', 'teams', 'staff', 'retentions']) {
  const data = JSON.parse(await readFile(path.join(stage, 'data', `${name}.json`), 'utf8'));
  if (name === 'staff' ? !data.members?.length : !Array.isArray(data) || !data.length) throw new Error(`Invalid ${name} snapshot`);
}
await run('node_modules/next/dist/bin/next', ['build'], { NEXT_DESKTOP_BUILD: '1', NEXT_DIST_DIR: '.next-desktop' });
// Remove only this task's generated staging directory, never source or saves.
const server = path.join(stage, 'server');
if (path.dirname(server) !== stage) throw new Error('Unsafe staging path');
await rm(server, { recursive: true, force: true });
await cp(path.join(build, 'standalone'), server, { recursive: true, filter: source => !path.basename(source).startsWith('.env') });
await cp(path.join(build, 'static'), path.join(server, '.next-desktop', 'static'), { recursive: true });
await cp(path.join(root, 'public'), path.join(server, 'public'), { recursive: true });
async function assertNoEnv(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.env')) throw new Error(`Private environment file in bundle: ${entry.name}`);
    if (entry.isDirectory()) await assertNoEnv(path.join(dir, entry.name));
  }
}
await assertNoEnv(server);
console.log('Desktop bundle prepared. Run npm run desktop:start or npm run desktop:dist.');
