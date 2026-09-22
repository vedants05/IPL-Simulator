import { PERSON_DYNAMICS_SEEDS } from "../lib/data/personDynamicsSeeds";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase URL or key is missing");
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function getRows<T>(table: string, select: string): Promise<T[]> {
  const response = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=1000`, { headers });
  if (!response.ok) throw new Error(`${table} read failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T[]>;
}

async function main() {
  const [players, staff, types, existing] = await Promise.all([
    getRows<{ id: number; name: string }>("players", "id,name"),
    getRows<{ id: string; slug: string; full_name: string }>("staff_members", "id,slug,full_name"),
    getRows<{ id: string; category: string }>("dynamic_types", "id,category"),
    getRows<{ id: number; dynamic_type: string; person_1_player_id: number | null; person_1_staff_id: string | null; person_2_player_id: number | null; person_2_staff_id: string | null }>("person_dynamics", "id,dynamic_type,person_1_player_id,person_1_staff_id,person_2_player_id,person_2_staff_id"),
  ]);
  const playerByName = new Map(players.map((player) => [player.name, player]));
  const staffBySlug = new Map(staff.map((member) => [member.slug, member]));
  const typeById = new Map(types.map((type) => [type.id, type]));
  const existingKeys = new Set(existing.map((row) => {
    const ids = [row.person_1_player_id ? `player:${row.person_1_player_id}` : `staff:${row.person_1_staff_id}`, row.person_2_player_id ? `player:${row.person_2_player_id}` : `staff:${row.person_2_staff_id}`].sort();
    return `${row.dynamic_type}|${ids.join("|")}`;
  }));

  const rows = PERSON_DYNAMICS_SEEDS.map((seed) => {
    const person1 = seed.category === "staff_staff" ? staffBySlug.get(seed.person1) : playerByName.get(seed.person1);
    const person2 = seed.category === "player_player" ? playerByName.get(seed.person2) : staffBySlug.get(seed.person2);
    if (!person1 || !person2) throw new Error(`Unresolved participant: ${seed.person1} / ${seed.person2}`);
    const type = typeById.get(seed.type);
    if (!type || (type.category !== seed.category && type.category !== "universal")) throw new Error(`Invalid type: ${seed.type}`);
    const firstId = `${seed.category === "staff_staff" ? "staff" : "player"}:${person1.id}`;
    const secondId = `${seed.category === "player_player" ? "player" : "staff"}:${person2.id}`;
    const key = `${seed.type}|${[firstId, secondId].sort().join("|")}`;
    return {
      key,
      relationship_category: seed.category,
      dynamic_type: seed.type,
      rating: seed.rating,
      is_bidirectional: seed.bidirectional !== false,
      person_1_type: seed.category === "staff_staff" ? "staff" : "player",
      person_1_player_id: seed.category === "staff_staff" ? null : person1.id,
      person_1_staff_id: seed.category === "staff_staff" ? person1.id : null,
      person_1_name: "name" in person1 ? person1.name : person1.full_name,
      person_1_role_label: seed.type === "idol" ? "Admirer" : seed.category === "staff_staff" ? "Coach" : "Player",
      person_1_reason: seed.reason,
      person_2_type: seed.category === "player_player" ? "player" : "staff",
      person_2_player_id: seed.category === "player_player" ? person2.id : null,
      person_2_staff_id: seed.category === "player_player" ? null : person2.id,
      person_2_name: "name" in person2 ? person2.name : person2.full_name,
      person_2_role_label: seed.type === "idol" ? "Idol" : seed.category === "player_player" ? "Player" : "Coach",
      person_2_reason: seed.reason,
      story: seed.reason,
      evidence_url: seed.evidenceUrl,
      is_active: true,
    };
  });

  const missing = rows.filter((row) => !existingKeys.has(row.key)).map(({ key: _key, ...row }) => row);
  if (process.argv.includes("--dry-run")) {
    console.log(`Validated ${rows.length} relationships against ${players.length} players, ${staff.length} staff and ${types.length} types; ${missing.length} need inserting.`);
    return;
  }
  if (!missing.length) {
    console.log(`All ${rows.length} approved relationships are present in Supabase.`);
    return;
  }
  const response = await fetch(`${url}/rest/v1/person_dynamics`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify(missing),
  });
  if (!response.ok) throw new Error(`Supabase relationship insert failed: ${response.status} ${await response.text()}`);
  const verified = await getRows<{ dynamic_type: string; person_1_player_id: number | null; person_1_staff_id: string | null; person_2_player_id: number | null; person_2_staff_id: string | null }>(
    "person_dynamics",
    "dynamic_type,person_1_player_id,person_1_staff_id,person_2_player_id,person_2_staff_id",
  );
  const verifiedKeys = new Set(verified.map((row) => {
    const ids = [row.person_1_player_id ? `player:${row.person_1_player_id}` : `staff:${row.person_1_staff_id}`, row.person_2_player_id ? `player:${row.person_2_player_id}` : `staff:${row.person_2_staff_id}`].sort();
    return `${row.dynamic_type}|${ids.join("|")}`;
  }));
  const absent = rows.filter((row) => !verifiedKeys.has(row.key));
  if (absent.length) throw new Error(`Insert finished but ${absent.length} approved relationships are still absent`);
  console.log(`Verified all ${rows.length} approved relationships in Supabase; inserted ${missing.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
