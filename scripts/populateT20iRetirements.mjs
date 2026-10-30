import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function retirementCredentials(env = process.env, envFile = resolve(process.cwd(), ".env.local")) {
  const values = {};
  const content = await readFile(envFile, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL || values.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || values.SUPABASE_SERVICE_ROLE_KEY || values.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or API key. Set environment variables or .env.local.");
  return { url, key };
}

export async function runRetirementTool({ args = process.argv.slice(2), credentials, fetchImpl = fetch, log = console.log } = {}) {
  const mode = args[0] || "--check";
  if (!["--check", "--dry-run", "--apply", "--sql"].includes(mode)) throw new Error("Use --check, --dry-run, --apply or --sql.");
  if (mode === "--sql") {
    for (const name of ["20261029120000_t20i_retirement_metadata.sql", "20261029121000_seed_t20i_retirements.sql"])
      log(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    return { mode };
  }
  const { url, key } = credentials || await retirementCredentials();
  const headers = { apikey: key, authorization: `Bearer ${key}`, Prefer: "count=exact", "Content-Type": "application/json" };
  const request = async (query, options = {}) => {
    let response;
    try { response = await fetchImpl(`${url}/rest/v1/players?${query}`, { headers, signal: AbortSignal.timeout(15000), ...options }); }
    catch { throw new Error("Database connection failed; retirement schema and coverage could not be verified."); }
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(`Retirement query failed (HTTP ${response.status}${detail.code ? `; ${detail.code}` : ''}). ${detail.code === '42703' ? 'A required retirement metadata column is missing. The app uses bundled historical dates until the optional migration is applied.' : 'Check columns, permissions and migrations.'}`);
    }
    return response;
  };
  // Explicit projection checks schema even if the table has no rows.
  const schema = await request("select=is_t20i_retired,t20i_retirement_date,t20i_retirement_source_url&limit=0");
  const count = response => Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
  const flagged = await request("select=is_t20i_retired&is_t20i_retired=eq.true&limit=0");
  const undated = await request("select=is_t20i_retired&is_t20i_retired=eq.true&t20i_retirement_date=is.null&limit=0");
  log(`Schema verified. Players: ${count(schema)}; T20I retired: ${count(flagged)}; undated retirements: ${count(undated)}.`);
  if (mode === "--check") return { mode, players: count(schema), retired: count(flagged), undated: count(undated) };
  const seed = JSON.parse(await readFile(new URL("../lib/data/t20iRetirements.json", import.meta.url), "utf8"));
  const query = new URLSearchParams({ select: "id,name,is_t20i_retired,t20i_retirement_date", name: `in.(${seed.map(row => `"${row.name}"`).join(",")})` });
  const rows = await (await request(query)).json();
  let changed = 0, skipped = 0;
  for (const record of seed) {
    const matches = rows.filter(row => row.name === record.name);
    if (matches.length !== 1) { skipped++; log(`Skipped ${record.id}: ${matches.length} exact database matches.`); continue; }
    const row = matches[0];
    if (row.t20i_retirement_date && row.t20i_retirement_date !== record.effectiveOn) { skipped++; log(`Skipped ${record.id}: existing date differs; review required.`); continue; }
    if (row.is_t20i_retired && row.t20i_retirement_date === record.effectiveOn) continue;
    log(`${mode === "--apply" ? "Applying" : "Would apply"}: ${record.id}, effective ${record.effectiveOn}.`);
    if (mode === "--apply") await request(new URLSearchParams({ id: `eq.${row.id}` }), { method: "PATCH", body: JSON.stringify({ is_t20i_retired: true, t20i_retirement_date: record.effectiveOn, t20i_retirement_source_url: record.sourceUrl }) });
    changed++;
  }
  log(`${mode === "--apply" ? "Applied" : "Planned"}: ${changed}; skipped for review: ${skipped}.`);
  return { mode, changed, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runRetirementTool().catch(error => { console.error(error.message); process.exitCode = 1; });
}
