import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PERSON_DYNAMICS_SEEDS } from "../lib/data/personDynamicsSeeds";

const staffName = (slug: string) => {
  if (slug === "t-dilip") return "T. Dilip";
  if (slug === "ryan-ten-doeschate") return "Ryan ten Doeschate";
  return slug.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
};
const personName = (key: string, isStaff: boolean) => isStaff ? `${staffName(key)} (${key})` : key;
const row = (seed: (typeof PERSON_DYNAMICS_SEEDS)[number]) => {
  const first = personName(seed.person1, seed.category === "staff_staff");
  const second = personName(seed.person2, seed.category !== "player_player");
  const separator = seed.bidirectional === false ? "→" : "↔";
  return `| ${first} ${separator} ${second} | \`${seed.type}\` | ${seed.rating} | ${seed.reason} | [Source](${seed.evidenceUrl}) |`;
};
const table = (seeds: typeof PERSON_DYNAMICS_SEEDS) => [
  "| People | Type | Strength / 100 | Reason | Evidence |",
  "|---|---|---:|---|---|",
  ...seeds.map(row),
].join("\n");

const playerPairs = PERSON_DYNAMICS_SEEDS.filter((seed) => seed.category === "player_player");
const playerStaff = PERSON_DYNAMICS_SEEDS.filter((seed) => seed.category === "player_staff" && seed.type !== "idol");
const staffPairs = PERSON_DYNAMICS_SEEDS.filter((seed) => seed.category === "staff_staff");
const idols = PERSON_DYNAMICS_SEEDS.filter((seed) => seed.type === "idol");
if (playerPairs.length !== 22 || playerStaff.length !== 18 || staffPairs.length !== 23 || idols.length !== 2) {
  throw new Error("Starting roster no longer contains the approved 65 relationships; update the handoff summary before regenerating.");
}

const markdown = `# Person dynamics: 65 relationship handoff

## Current state (checked 22 September 2026)

- The user approved all 65 relationships below: 22 player–player, 18 player–staff, 23 staff–staff and 2 one-way idols.
- The live Supabase \`person_dynamics\` table had **0 rows** at the last check. An insert with the project's \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` returned HTTP 401 / PostgreSQL 42501: row-level security rejected it. Do not claim the seed is live without rechecking.
- The roster's source of truth is [\`lib/data/personDynamicsSeeds.ts\`](../lib/data/personDynamicsSeeds.ts). It imports 19 existing staff bonds from [\`lib/data/staffRelationships.ts\`](../lib/data/staffRelationships.ts). The staff bonds are still used directly by staff recruitment logic; keep that behavior until the game reads the new table.
- The ready-to-run, idempotent SQL is [\`supabase/migrations/20260922120000_seed_person_dynamics.sql\`](../supabase/migrations/20260922120000_seed_person_dynamics.sql). It resolves exact player names and staff slugs to database IDs, validates every participant and type, then inserts the rows.
- [\`calibration/syncPersonDynamics.ts\`](../calibration/syncPersonDynamics.ts) validates the roster against live Supabase and can insert it with a server-only \`SUPABASE_SERVICE_ROLE_KEY\`. Use \`node --env-file=.env.local --import tsx calibration/syncPersonDynamics.ts --dry-run\` to validate without writing. The key is not currently present in \`.env.local\`. A connected Supabase admin integration or authenticated SQL editor can apply the SQL instead.
- The schema is [\`supabase/migrations/20260920140000_add_person_dynamics.sql\`](../supabase/migrations/20260920140000_add_person_dynamics.sql). It allows public reads but has no anonymous insert/update policy for \`person_dynamics\`. Keep administrative writes off the public key.

## How to extend the roster

1. Add evidence-backed pairs to \`PERSON_DYNAMICS_SEEDS\`. Use exact \`players.name\` values for players and \`staff_members.slug\` values for staff. Include type, 0–100 strength, reason and a direct evidence URL. Do not infer a private friendship or conflict merely from shared nationality or team.
2. Check for the same pair and type in either order. \`idol\` is one-way, with the admirer as person 1. If a pair has two types, keep gameplay bonuses from stacking excessively.
3. Validate all participants and type categories against live Supabase. Extend the generator's count checks when intentionally adding rows.
4. If the 65-row migration has **not** been applied, regenerate it with \`npx --no-install tsx calibration/generatePersonDynamicsMigration.ts\`. If it **has** been applied, preserve that historical migration and create a new, idempotent migration for added rows.
5. Refresh this handoff note and verify row counts after any live write. Database seeding alone does not wire these relationships into gameplay or profile UI.

Strengths are proposed game ratings, not factual measurements of personal closeness. Historical bonds remain recorded; their gameplay effects should apply only when the people work or play together again.

## Player ↔ player (${playerPairs.length})

${table(playerPairs)}

## Player ↔ staff (${playerStaff.length})

${table(playerStaff)}

## Staff ↔ staff (${staffPairs.length})

${table(staffPairs)}

## One-way idols (${idols.length})

${table(idols)}
`;

const path = resolve("docs/person-dynamics-handoff.md");
writeFileSync(path, markdown);
console.log(`Wrote ${PERSON_DYNAMICS_SEEDS.length} relationships to ${path}`);
