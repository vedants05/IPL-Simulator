import assert from 'node:assert/strict';
import { runRetirementTool, retirementCredentials } from '../scripts/populateT20iRetirements.mjs';
import { readFile, mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const credentials = { url: 'https://retirement-test.invalid', key: 'test-key' };
const logs = [];
const log = value => logs.push(value);
const response = (rows, count = rows.length) => new Response(JSON.stringify(rows), { headers: { 'content-range': `*/${count}` } });
const empty = await runRetirementTool({ credentials, log, fetchImpl: async () => response([], 0) });
assert.equal(empty.players, 0, 'an empty table with the correct projection is valid schema');
await assert.rejects(() => runRetirementTool({ credentials, log, fetchImpl: async () => new Response('{}', { status: 400 }) }), /HTTP 400/);
await assert.rejects(() => runRetirementTool({ credentials, log, fetchImpl: async () => { throw new Error('network'); } }), /connection failed/);
const seed = JSON.parse(await readFile(new URL('../lib/data/t20iRetirements.json', import.meta.url), 'utf8'));
const rows = seed.map((fact, id) => ({ id, name: fact.name, is_t20i_retired: false, t20i_retirement_date: null }));
let patches = 0;
const fetchImpl = async (url, options) => {
  const query = new URL(url).searchParams;
  if (options.method === 'PATCH') {
    patches++;
    const id = Number(query.get('id').slice(3)); Object.assign(rows[id], JSON.parse(options.body));
    return response([]);
  }
  return query.get('limit') === '0' ? response([], rows.length) : response(rows);
};
const dry = await runRetirementTool({ args: ['--dry-run'], credentials, fetchImpl, log });
assert.equal(dry.changed, seed.length); assert.equal(patches, 0);
const applied = await runRetirementTool({ args: ['--apply'], credentials, fetchImpl, log });
assert.equal(applied.changed, seed.length); assert.equal(patches, seed.length);
const repeated = await runRetirementTool({ args: ['--apply'], credentials, fetchImpl, log });
assert.equal(repeated.changed, 0); assert.equal(patches, seed.length, 'repeat application must be harmless');
assert.ok(logs.every(line => !line.includes('test-key')));
const directory = await mkdtemp(join(tmpdir(), 't20i-credentials-'));
const file = join(directory, 'environment');
await writeFile(file, 'NEXT_PUBLIC_SUPABASE_URL="https://example.invalid"\nNEXT_PUBLIC_SUPABASE_ANON_KEY="abc=def=="\n');
assert.equal((await retirementCredentials({}, file)).key, 'abc=def==');
await unlink(file); await rmdir(directory);
console.log('T20I tooling checks passed: schema, empty table, network failures, dry-run, idempotent population and credential parsing.');
