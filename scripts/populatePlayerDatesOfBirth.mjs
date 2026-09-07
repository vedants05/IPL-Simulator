import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const retrySkipped = args.has("--retry-skipped");
const root = process.cwd();
const workDir = resolve(root, ".tmp", "player-dob");
const checkpointPath = resolve(workDir, "checkpoint.json");
const logPath = resolve(workDir, "run.log");
const reportPath = resolve(workDir, "report.json");

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const normalize = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

async function loadEnvFile(path) {
  const body = await readFile(path, "utf8");
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function requestJson(url, options = {}, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "user-agent": "ipl-simulator-player-dob-import/1.0 (local database maintenance)",
        accept: "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (response.ok) return response.json();
    const body = await response.text();
    if (attempt === attempts || ![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`${response.status} ${body.slice(0, 300)}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1_000
      : response.status === 429 ? 15_000 * attempt : 750 * (2 ** (attempt - 1));
    await sleep(backoff);
  }
}

function ageOn(dateOfBirth, asOf = "2026-09-04") {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const date = new Date(`${asOf}T00:00:00Z`);
  let age = date.getUTCFullYear() - birth.getUTCFullYear();
  if (
    date.getUTCMonth() < birth.getUTCMonth()
    || (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() < birth.getUTCDate())
  ) age -= 1;
  return age;
}

function wikidataDate(entity) {
  const claims = entity?.claims?.P569 ?? [];
  const preferred = claims.find((claim) => claim.rank === "preferred") ?? claims.find((claim) => claim.rank !== "deprecated");
  const value = preferred?.mainsnak?.datavalue?.value;
  if (!value?.time || Number(value.precision) < 11) return null;
  const match = value.time.match(/^\+?(\d{4,})-(\d{2})-(\d{2})T/);
  return match ? `${match[1].padStart(4, "0")}-${match[2]}-${match[3]}` : null;
}

function candidateScore(player, result, dateOfBirth) {
  const playerName = normalize(player.name);
  const label = normalize(result.label);
  const description = normalize(result.description);
  const aliases = (result.aliases ?? []).map(normalize);
  const exactName = label === playerName || aliases.includes(playerName);
  const cricketDescription = /\bcricket(er)?\b/.test(description);
  const ageDelta = Math.abs(ageOn(dateOfBirth) - Number(player.age));
  const country = normalize(player.nationality);
  const countryMatch = country && description.includes(country);
  let score = 0;
  if (exactName) score += 50;
  if (cricketDescription) score += 30;
  if (ageDelta === 0) score += 25;
  else if (ageDelta === 1) score += 15;
  if (countryMatch) score += 10;
  return { score, exactName, cricketDescription, ageDelta, countryMatch };
}

async function resolvePlayer(player) {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    // wbsearchentities performs entity-name search rather than general full-text
    // search. Adding "cricketer" causes valid player names to return no hits;
    // occupation is validated from each result's description below instead.
    search: player.name,
    language: "en",
    uselang: "en",
    type: "item",
    limit: "10",
    format: "json",
    origin: "*",
  });
  const search = await requestJson(`https://www.wikidata.org/w/api.php?${params}`);
  const results = search.search ?? [];
  if (results.length === 0) return { status: "not_found", candidates: [] };

  const ids = results.map((result) => result.id).join("|");
  const entityParams = new URLSearchParams({
    action: "wbgetentities",
    ids,
    props: "claims",
    format: "json",
    origin: "*",
  });
  const entityData = await requestJson(`https://www.wikidata.org/w/api.php?${entityParams}`);
  const candidates = results.flatMap((result) => {
    const dateOfBirth = wikidataDate(entityData.entities?.[result.id]);
    if (!dateOfBirth) return [];
    const evidence = candidateScore(player, result, dateOfBirth);
    return [{ id: result.id, label: result.label, description: result.description, dateOfBirth, ...evidence }];
  }).sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const second = candidates[1];
  if (!best) return { status: "no_precise_date", candidates };
  const confident = best.exactName
    && best.cricketDescription
    && best.ageDelta <= 1
    && best.score >= 95
    && (!second || best.score - second.score >= 10 || second.dateOfBirth === best.dateOfBirth);
  return confident
    ? { status: "resolved", dateOfBirth: best.dateOfBirth, wikidataId: best.id, candidates }
    : { status: "ambiguous", candidates };
}

async function main() {
  await mkdir(workDir, { recursive: true });
  await loadEnvFile(resolve(root, ".env.local"));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase URL/key missing from .env.local");
  const headers = { apikey: supabaseKey, authorization: `Bearer ${supabaseKey}` };
  const players = await requestJson(
    `${supabaseUrl}/rest/v1/players?select=id,name,date_of_birth,nationality,age&date_of_birth=is.null&order=name`,
    { headers },
  );
  let checkpoint = {};
  try { checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")); } catch {}
  const counts = { resolved: 0, updated: 0, ambiguous: 0, not_found: 0, no_precise_date: 0, error: 0 };

  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];
    const prior = checkpoint[player.id];
    if (prior && (!retrySkipped || prior.status === "updated" || prior.status === "resolved")) {
      counts[prior.status] = (counts[prior.status] ?? 0) + 1;
      continue;
    }
    let outcome;
    try {
      outcome = await resolvePlayer(player);
      if (outcome.status === "resolved" && apply) {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/players?id=eq.${encodeURIComponent(player.id)}&date_of_birth=is.null`,
          {
            method: "PATCH",
            headers: { ...headers, "content-type": "application/json", prefer: "return=minimal" },
            body: JSON.stringify({ date_of_birth: outcome.dateOfBirth }),
          },
        );
        if (!response.ok) throw new Error(`Supabase update failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
        outcome.status = "updated";
      }
    } catch (error) {
      outcome = { status: "error", error: error instanceof Error ? error.message : String(error) };
    }
    checkpoint[player.id] = { name: player.name, ...outcome, checkedAt: new Date().toISOString() };
    counts[outcome.status] = (counts[outcome.status] ?? 0) + 1;
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
    await appendFile(logPath, `${new Date().toISOString()} ${index + 1}/${players.length} ${player.name}: ${outcome.status}${outcome.dateOfBirth ? ` ${outcome.dateOfBirth}` : ""}\n`);
    // This produces at most two Wikidata requests per player. Keep the job
    // deliberately quiet so it can run unattended without hammering the API.
    await sleep(1_250);
  }

  const report = { mode: apply ? "apply" : "dry-run", totalMissingAtStart: players.length, counts, completedAt: new Date().toISOString() };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async (error) => {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${new Date().toISOString()} FATAL ${error instanceof Error ? error.stack : String(error)}\n`);
  console.error(error);
  process.exit(1);
});
