import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PERSON_DYNAMICS_SEEDS } from "../lib/data/personDynamicsSeeds";

const migrationPath = resolve("supabase/migrations/20260922120000_seed_person_dynamics.sql");
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const countByCategory = PERSON_DYNAMICS_SEEDS.reduce<Record<string, number>>((counts, seed) => {
  counts[seed.category] = (counts[seed.category] ?? 0) + 1;
  return counts;
}, {});

if (PERSON_DYNAMICS_SEEDS.length !== 65 || countByCategory.player_player !== 22 || countByCategory.player_staff !== 20 || countByCategory.staff_staff !== 23) {
  throw new Error(`Unexpected seed counts: ${JSON.stringify(countByCategory)}`);
}

const seen = new Set<string>();
for (const seed of PERSON_DYNAMICS_SEEDS) {
  if (seed.rating < 0 || seed.rating > 100 || !Number.isInteger(seed.rating)) throw new Error(`Invalid rating: ${seed.person1}/${seed.person2}`);
  if (seed.type === "idol" && seed.bidirectional !== false) throw new Error(`Idol must be one way: ${seed.person1}/${seed.person2}`);
  const [first, second] = [seed.person1, seed.person2].sort();
  const unique = `${seed.category}|${seed.type}|${first}|${second}`;
  if (seen.has(unique)) throw new Error(`Duplicate seed: ${unique}`);
  seen.add(unique);
}

const values = PERSON_DYNAMICS_SEEDS.map((seed) => `  (${[
  quote(seed.category), quote(seed.type), quote(seed.person1), quote(seed.person2),
  seed.rating, seed.bidirectional === false ? "false" : "true", quote(seed.reason), quote(seed.evidenceUrl),
].join(", ")})`).join(",\n");

const sql = `-- Approved 2026 starting roster: 22 player pairs, 18 player/staff pairs,
-- 23 staff pairs and 2 one-way player/staff idol links (65 rows total).
-- Generated from lib/data/personDynamicsSeeds.ts. Re-running is safe.

create temp table _person_dynamics_seed (
  category text not null,
  dynamic_type text not null,
  person1_key text not null,
  person2_key text not null,
  rating integer not null,
  is_bidirectional boolean not null,
  reason text not null,
  evidence_url text not null
);

insert into _person_dynamics_seed values
${values};

do $$
declare
  bad text;
begin
  if (select count(*) from _person_dynamics_seed) <> 65 then
    raise exception 'Expected 65 person dynamics seeds';
  end if;

  select format('%s / %s / %s (matches: %s, %s)', category, person1_key, person2_key, first_matches, second_matches)
  into bad
  from (
    select s.*,
      case when s.category in ('player_player', 'player_staff')
        then (select count(*) from public.players p where p.name = s.person1_key)
        else (select count(*) from public.staff_members m where m.slug = s.person1_key) end as first_matches,
      case when s.category = 'player_player'
        then (select count(*) from public.players p where p.name = s.person2_key)
        else (select count(*) from public.staff_members m where m.slug = s.person2_key) end as second_matches
    from _person_dynamics_seed s
  ) resolved
  where first_matches <> 1 or second_matches <> 1
  limit 1;
  if bad is not null then
    raise exception 'Missing or ambiguous person dynamics participant: %', bad;
  end if;

  select s.dynamic_type into bad
  from _person_dynamics_seed s
  left join public.dynamic_types t on t.id = s.dynamic_type
  where t.id is null or (t.category <> s.category and t.category <> 'universal')
  limit 1;
  if bad is not null then
    raise exception 'Missing or incompatible dynamic type: %', bad;
  end if;
end $$;

insert into public.person_dynamics (
  relationship_category, dynamic_type, rating, is_bidirectional,
  person_1_type, person_1_player_id, person_1_staff_id, person_1_name, person_1_role_label, person_1_reason,
  person_2_type, person_2_player_id, person_2_staff_id, person_2_name, person_2_role_label, person_2_reason,
  story, evidence_url, is_active
)
select
  s.category, s.dynamic_type, s.rating, s.is_bidirectional,
  case when s.category = 'staff_staff' then 'staff' else 'player' end,
  case when s.category <> 'staff_staff' then (select p.id from public.players p where p.name = s.person1_key) end,
  case when s.category = 'staff_staff' then (select m.id from public.staff_members m where m.slug = s.person1_key) end,
  case when s.category = 'staff_staff' then (select m.full_name from public.staff_members m where m.slug = s.person1_key) else s.person1_key end,
  case when s.dynamic_type = 'idol' then 'Admirer' when s.category = 'staff_staff' then 'Coach' else 'Player' end,
  s.reason,
  case when s.category = 'player_player' then 'player' else 'staff' end,
  case when s.category = 'player_player' then (select p.id from public.players p where p.name = s.person2_key) end,
  case when s.category <> 'player_player' then (select m.id from public.staff_members m where m.slug = s.person2_key) end,
  case when s.category = 'player_player' then s.person2_key else (select m.full_name from public.staff_members m where m.slug = s.person2_key) end,
  case when s.dynamic_type = 'idol' then 'Idol' when s.category = 'player_player' then 'Player' else 'Coach' end,
  s.reason,
  s.reason, s.evidence_url, true
from _person_dynamics_seed s
on conflict do nothing;

drop table _person_dynamics_seed;
`;

writeFileSync(migrationPath, sql);
console.log(`Wrote ${PERSON_DYNAMICS_SEEDS.length} relationships to ${migrationPath}`);
