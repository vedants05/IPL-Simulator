import { readFileSync, writeFileSync } from "node:fs";

type PlayerRow = { id: string; name: string; runs: number; balls: number; aggression?: number; ability: number; outs?: number; wickets?: number };
type AuditSeason = {
  summary: Record<string, any>;
  batting: PlayerRow[];
  bowling: PlayerRow[];
  errors: string[];
};
type Audit = { seed: string; inputHash?: string; mode?: string; seasons: AuditSeason[] };
const beforePath = process.env.AUDIT_BEFORE ?? "calibration/results/league-realism-audit.json";
const afterPath = process.env.AUDIT_AFTER ?? "calibration/results/league-realism-revised-instant.json";
const before = JSON.parse(readFileSync(beforePath, "utf8")) as Audit;
const after = JSON.parse(readFileSync(afterPath, "utf8")) as Audit;
for (const [path, audit] of [[beforePath, before], [afterPath, after]] as const) {
  if (!audit.seasons?.length) throw new Error(`No completed seasons in ${path}`);
}
if (before.seed !== after.seed) throw new Error("Comparison needs the same AUDIT_SEED");
if (before.inputHash && after.inputHash && before.inputHash !== after.inputHash) throw new Error("Input snapshots differ; this is not a paired comparison");

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
function range(xs: number[], dp = 2) {
  const values = xs.filter(Number.isFinite);
  return values.length ? `${mean(values).toFixed(dp)} (${Math.min(...values).toFixed(dp)}–${Math.max(...values).toFixed(dp)})` : "—";
}
function median(xs: number[]) {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 : NaN;
}
const select = (audit: Audit, fn: (season: AuditSeason) => number) => audit.seasons.map(fn);
const phaseRR = (key: string) => (season: AuditSeason) => 6 * season.summary.phase[key].runs / season.summary.phase[key].balls;
const metrics: Array<[string, (season: AuditSeason) => number, number?]> = [
  ["League run rate", season => season.summary.overallRR],
  ["First innings average", season => season.summary.firstInningsAverage],
  ["Best economy (minimum 180 legal balls)", season => Math.min(...season.bowling.filter(row => row.balls >= 180).map(row => 6 * row.runs / row.balls))],
  ["Bumrah economy", season => { const row = season.bowling.find(row => /bumrah/i.test(row.name)); return row?.balls ? 6 * row.runs / row.balls : NaN; }],
  ["Qualified batter median SR (minimum 200 balls)", season => median(season.batting.filter(row => row.balls >= 200).map(row => 100 * row.runs / row.balls))],
  ["Qualified batters with SR >=200", season => season.batting.filter(row => row.balls >= 200 && 100 * row.runs / row.balls >= 200).length, 1],
  ["Fours per season", season => season.summary.fours, 1],
  ["Sixes per season", season => season.summary.sixes, 1],
  ["Hundreds per season", season => season.summary.hundreds, 1],
  ["Fifties per season", season => season.summary.fifties, 1],
  ["First innings >=250 per season", season => season.summary.first250, 1],
  ["Wickets per innings", season => season.summary.wicketsPerInnings],
  ["All-outs per season", season => season.summary.allOuts, 1],
  ["Powerplay RR", phaseRR("powerplay")],
  ["Middle overs RR", phaseRR("middle")],
  ["Death overs RR", phaseRR("death")],
  ["Arithmetic errors per season", season => season.errors.length, 0],
];
const lines = [
  "# League realism before/after comparison", "",
  `Seed: \`${before.seed}\`. Before: ${before.seasons.length} seasons (${before.mode ?? "instant"}); after: ${after.seasons.length} seasons (${after.mode ?? "instant"}).`,
  "", "Values are means followed by season ranges. Both runs use fixed squads and AI lineups; these are independent seasons without career progression.", "",
  "| Measure | Before: mean (range) | After: mean (range) |", "| --- | --- | --- |",
  ...metrics.map(([label, fn, dp]) => `| ${label} | ${range(select(before, fn), dp)} | ${range(select(after, fn), dp)} |`),
  "", "## Batting by aggression", "",
  "Pooled batter runs / balls across all seasons; every recorded batting innings is included. Missing aggression uses the engine default of 65.", "",
  "| Aggression | Before SR | After SR | Before runs/dismissal | After runs/dismissal |", "| --- | --- | --- | --- | --- |",
];
const battingBands = [["1–49", 1, 49], ["50–64", 50, 64], ["65–79", 65, 79], ["80–94", 80, 94], ["95–98", 95, 98], ["99", 99, 99]] as const;
function pool(audit: Audit, kind: "batting" | "bowling", field: "aggression" | "ability", min: number, max: number) {
  return audit.seasons.flatMap(season => season[kind]).filter(row => (row[field] ?? 65) >= min && (row[field] ?? 65) <= max)
    .reduce((acc, row) => ({ runs: acc.runs + row.runs, balls: acc.balls + row.balls, outs: acc.outs + (row.outs ?? 0), wickets: acc.wickets + (row.wickets ?? 0) }), { runs: 0, balls: 0, outs: 0, wickets: 0 });
}
const rate = (numerator: number, denominator: number) => denominator ? (numerator / denominator).toFixed(2) : "—";
for (const [label, min, max] of battingBands) {
  const a = pool(before, "batting", "aggression", min, max), b = pool(after, "batting", "aggression", min, max);
  lines.push(`| ${label} | ${rate(100 * a.runs, a.balls)} | ${rate(100 * b.runs, b.balls)} | ${rate(a.runs, a.outs)} | ${rate(b.runs, b.outs)} |`);
}
lines.push("", "## Bowling by ability", "", "Pooled conceded runs / legal balls. Ratings group the actual selected bowlers; opposition, phases and workloads are not held equal in this table.", "", "| Bowling ability | Before economy | After economy | Before balls/wicket | After balls/wicket |", "| --- | --- | --- | --- | --- |");
for (const [label, min, max] of [["Below 70", 0, 69.999], ["70–79", 70, 79.999], ["80–89", 80, 89.999], ["90+", 90, 1000]] as const) {
  const a = pool(before, "bowling", "ability", min, max), b = pool(after, "bowling", "ability", min, max);
  lines.push(`| ${label} | ${rate(6 * a.runs, a.balls)} | ${rate(6 * b.runs, b.balls)} | ${rate(a.balls, a.wickets)} | ${rate(b.balls, b.wickets)} |`);
}
if (before.seasons.length > 5 && after.seasons.length > 5) {
  const heldBefore = { ...before, seasons: before.seasons.slice(5) };
  const heldAfter = { ...after, seasons: after.seasons.slice(5) };
  lines.push("", "## Seeds 6 onward", "", "The first five seeds were used during tuning. The remaining seeds were evaluated after selecting the revised engine.", "", "| Measure | Before: mean (range) | After: mean (range) |", "| --- | --- | --- |");
  for (const [label, fn, dp] of metrics.filter(([label]) => ["League run rate", "First innings average", "Best economy (minimum 180 legal balls)", "Hundreds per season", "Sixes per season", "First innings >=250 per season", "Arithmetic errors per season"].includes(label))) {
    lines.push(`| ${label} | ${range(select(heldBefore, fn), dp)} | ${range(select(heldAfter, fn), dp)} |`);
  }
}
lines.push("", "## Suryavanshi", "", "These are observed season outcomes against varied opponents, rather than the neutral aggression target.", "", "| Run | Pooled SR | Runs/dismissal | Mean season runs |", "| --- | --- | --- | --- |");
for (const [label, audit] of [["Before", before], ["After", after]] as const) {
  const rows = audit.seasons.flatMap(season => season.batting).filter(row => /suryavanshi/i.test(row.name));
  const total = (field: "runs" | "balls" | "outs") => rows.reduce((sum, row) => sum + (row[field] ?? 0), 0);
  lines.push(`| ${label} | ${rate(100 * total("runs"), total("balls"))} | ${rate(total("runs"), total("outs"))} | ${rate(total("runs"), audit.seasons.length)} |`);
}
lines.push("", `Before data: \`${beforePath}\`. After data: \`${afterPath}\`.`, "");
if (process.env.AUDIT_REPORT) writeFileSync(process.env.AUDIT_REPORT, lines.join("\n"));
console.log(lines.join("\n"));
