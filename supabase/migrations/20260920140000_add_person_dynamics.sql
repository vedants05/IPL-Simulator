-- ============================================================================
-- Migration: Add Person-to-Person Dynamics & Chemistry System
-- Architecture:
--   1. Registry Table: `dynamic_types`
--      - Pre-seeded with the fixed official cricket dynamic types
--      - Fully extensible so new custom types can be created in-game without migrations
--   2. Relationship Table: `person_dynamics`
--      - Stores individual person-to-person relationships
--      - Foreign-key validates `dynamic_type` against `dynamic_types(id)`
--      - Enforces bidirectional for mutual bonds and unidirectional for 'idol'
--   3. Projection View: `person_dynamics_view`
--      - Unrolls perspectives so each person sees their relevant connections
-- ============================================================================

-- 1. Dynamic Types Registry (Fixed + Extensible In-Game) ----------------------
create table if not exists public.dynamic_types (
  id text primary key,
  name text not null,
  category text not null check (category in ('player_player', 'player_staff', 'staff_staff', 'universal')),
  default_is_bidirectional boolean not null default true,
  description text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed the official predefined dynamic types
insert into public.dynamic_types (id, name, category, default_is_bidirectional, description, is_custom)
values
  -- Unidirectional
  ('idol', 'Idol', 'universal', false, 'A player models their game, mentality, or work ethic after their hero. Appears only on the admirer profile.', false),

  -- Player <-> Player
  ('franchise_teammates', 'Longtime Teammates', 'player_player', true, 'Core franchise veterans who have shared the same IPL dugout across multiple seasons.', false),
  ('national_teammates', 'National Compatriots', 'player_player', true, 'International teammates sharing national squad dressing-room brotherhood.', false),
  ('opening_partners', 'Opening Partners', 'player_player', true, 'Established opening batting pair with high mutual trust and running synergy.', false),
  ('spin_twins', 'Spin Bowling Tandem', 'player_player', true, 'Complementary spin bowlers operating in tandem to squeeze opposition lineups.', false),
  ('pace_tandem', 'Pace Bowling Tandem', 'player_player', true, 'Fast bowling strike pair hunting in pairs with the new ball or at the death.', false),
  ('mentor_protege', 'Mentor & Protégé', 'player_player', true, 'Senior player actively guiding and grooming a junior talent in the squad.', false),
  ('domestic_roots', 'State / Domestic Brothers', 'player_player', true, 'Grew up playing together in the same domestic state circuit (e.g. Ranji Trophy).', false),
  ('personal_bond', 'Close Personal Friends', 'player_player', true, 'Close off-pitch personal friendship and mutual trust.', false),
  ('on_field_rivalry', 'Fierce Rivals / Tension', 'player_player', true, 'Competitive tension, auction friction, or past heated on-field battles.', false),

  -- Player <-> Staff
  ('coached', 'Coached by / Mentored', 'player_staff', true, 'Coach who developed, unlocked, or elevated the player''s game.', false),
  ('former_teammates', 'Former Teammate (Now Coach)', 'player_staff', true, 'Previously teammates on the pitch who now share a coach-player dynamic.', false),
  ('captain_coach_synergy', 'Captain & Coach Brain Trust', 'player_staff', true, 'Tactical lockstep between captain on the pitch and head coach off the pitch.', false),
  ('specialist_tutelage', 'Specialist Tutelage', 'player_staff', true, 'Focused craft coaching from a specialist coach (yorkers, spin mechanics, batting trigger).', false),
  ('talent_champion', 'Backed / Discovered by', 'player_staff', true, 'Coach who scouted, bid hard for, or backed the player when they were unknown.', false),
  ('tactical_friction', 'Tactical Disagreement', 'player_staff', true, 'Player dissatisfied with role assignment, batting position, or coaching style.', false),

  -- Staff <-> Staff
  ('inner_circle_assistant', 'Inner Circle Assistant', 'staff_staff', true, 'Head coach''s trusted right-hand specialist who follows them across franchise jobs.', false),
  ('trusted_colleague', 'Trusted Coaching Colleague', 'staff_staff', true, 'Seasoned coaches with proven multi-season shared success in the same dugout.', false),
  ('mentor_coach', 'Senior Mentor & Coach', 'staff_staff', true, 'Franchise director or senior mentor working with and advising the head coach.', false),
  ('philosophical_clash', 'Contrasting Philosophies', 'staff_staff', true, 'Disagreement between coaches on strategic direction or team philosophy.', false)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  default_is_bidirectional = excluded.default_is_bidirectional,
  description = excluded.description;

-- 2. Relationships Table -----------------------------------------------------
create table if not exists public.person_dynamics (
  id bigserial primary key,
  relationship_category text not null check (relationship_category in ('player_player', 'player_staff', 'staff_staff')),
  dynamic_type text not null references public.dynamic_types(id) on update cascade,
  rating integer not null check (rating between 0 and 100),
  is_bidirectional boolean not null default true,

  -- Entity 1 (Subject / Admirer / Initiator)
  person_1_type text not null check (person_1_type in ('player', 'staff')),
  person_1_player_id bigint references public.players(id) on delete cascade,
  person_1_staff_id uuid references public.staff_members(id) on delete cascade,
  person_1_name text not null,
  person_1_role_label text not null default 'Peer',
  person_1_reason text not null,

  -- Entity 2 (Target / Partner / Idol)
  person_2_type text not null check (person_2_type in ('player', 'staff')),
  person_2_player_id bigint references public.players(id) on delete cascade,
  person_2_staff_id uuid references public.staff_members(id) on delete cascade,
  person_2_name text not null,
  person_2_role_label text not null default 'Peer',
  person_2_reason text not null,

  story text,
  evidence_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Rule: If dynamic_type is 'idol', is_bidirectional MUST be false
  constraint chk_idol_unidirectional check (
    (dynamic_type = 'idol' and is_bidirectional = false) or
    (dynamic_type <> 'idol')
  ),

  -- Integrity: Entity 1 must have matching foreign key
  constraint chk_person_1_id_present check (
    (person_1_type = 'player' and person_1_player_id is not null and person_1_staff_id is null) or
    (person_1_type = 'staff' and person_1_staff_id is not null and person_1_player_id is null)
  ),

  -- Integrity: Entity 2 must have matching foreign key
  constraint chk_person_2_id_present check (
    (person_2_type = 'player' and person_2_player_id is not null and person_2_staff_id is null) or
    (person_2_type = 'staff' and person_2_staff_id is not null and person_2_player_id is null)
  ),

  -- No self-relationship
  constraint chk_no_self_dynamic check (
    not (
      person_1_type = person_2_type and
      coalesce(person_1_player_id::text, person_1_staff_id::text) = 
      coalesce(person_2_player_id::text, person_2_staff_id::text)
    )
  )
);

-- 3. Indexes -----------------------------------------------------------------
-- Canonical uniqueness: prevents duplicate pair records regardless of order
create unique index if not exists person_dynamics_canonical_pair_idx on public.person_dynamics (
  least(
    person_1_type || ':' || coalesce(person_1_player_id::text, person_1_staff_id::text),
    person_2_type || ':' || coalesce(person_2_player_id::text, person_2_staff_id::text)
  ),
  greatest(
    person_1_type || ':' || coalesce(person_1_player_id::text, person_1_staff_id::text),
    person_2_type || ':' || coalesce(person_2_player_id::text, person_2_staff_id::text)
  ),
  dynamic_type
);

-- Fast lookup indexes
create index if not exists idx_person_dynamics_p1_player on public.person_dynamics(person_1_player_id) where person_1_player_id is not null;
create index if not exists idx_person_dynamics_p1_staff on public.person_dynamics(person_1_staff_id) where person_1_staff_id is not null;
create index if not exists idx_person_dynamics_p2_player on public.person_dynamics(person_2_player_id) where person_2_player_id is not null;
create index if not exists idx_person_dynamics_p2_staff on public.person_dynamics(person_2_staff_id) where person_2_staff_id is not null;
create index if not exists idx_person_dynamics_type on public.person_dynamics(dynamic_type);

-- 4. Row Level Security ------------------------------------------------------
alter table public.dynamic_types enable row level security;
alter table public.person_dynamics enable row level security;

-- Read policies
drop policy if exists "public read dynamic_types" on public.dynamic_types;
create policy "public read dynamic_types" on public.dynamic_types for select using (true);

-- Allow in-game creation of custom dynamic types
drop policy if exists "allow insert dynamic_types" on public.dynamic_types;
create policy "allow insert dynamic_types" on public.dynamic_types for insert with check (true);

drop policy if exists "public read person_dynamics" on public.person_dynamics;
create policy "public read person_dynamics" on public.person_dynamics for select using (true);

-- 5. Bidirectional View ------------------------------------------------------
-- Unrolls relationships:
-- - Bidirectional rows (is_bidirectional = true) appear for BOTH individuals
-- - Unidirectional rows (e.g. 'idol', is_bidirectional = false) appear ONLY for Person 1 (the admirer)
create or replace view public.person_dynamics_view as
-- Perspective 1: Person 1 looking at Person 2 (covers mutual and Admirer -> Idol)
select
  d.id as dynamic_id,
  d.relationship_category,
  d.dynamic_type,
  dt.name as dynamic_type_name,
  d.rating,
  d.is_bidirectional,
  -- Subject
  d.person_1_type as subject_type,
  coalesce(d.person_1_player_id::text, d.person_1_staff_id::text) as subject_id,
  d.person_1_name as subject_name,
  d.person_1_role_label as subject_role,
  d.person_1_reason as subject_reason,
  -- Partner / Idol
  d.person_2_type as partner_type,
  coalesce(d.person_2_player_id::text, d.person_2_staff_id::text) as partner_id,
  d.person_2_name as partner_name,
  d.person_2_role_label as partner_role,
  d.person_2_reason as partner_reason,
  d.story,
  d.evidence_url
from public.person_dynamics d
left join public.dynamic_types dt on d.dynamic_type = dt.id
where d.is_active = true

union all

-- Perspective 2: Person 2 looking at Person 1 (ONLY when is_bidirectional is true)
select
  d.id as dynamic_id,
  d.relationship_category,
  d.dynamic_type,
  dt.name as dynamic_type_name,
  d.rating,
  d.is_bidirectional,
  -- Subject (Now Person 2)
  d.person_2_type as subject_type,
  coalesce(d.person_2_player_id::text, d.person_2_staff_id::text) as subject_id,
  d.person_2_name as subject_name,
  d.person_2_role_label as subject_role,
  d.person_2_reason as subject_reason,
  -- Partner (Now Person 1)
  d.person_1_type as partner_type,
  coalesce(d.person_1_player_id::text, d.person_1_staff_id::text) as partner_id,
  d.person_1_name as partner_name,
  d.person_1_role_label as partner_role,
  d.person_1_reason as partner_reason,
  d.story,
  d.evidence_url
from public.person_dynamics d
left join public.dynamic_types dt on d.dynamic_type = dt.id
where d.is_active = true and d.is_bidirectional = true;
