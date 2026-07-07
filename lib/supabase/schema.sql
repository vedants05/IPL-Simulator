-- ---------------------------------------------------------------------------
-- Supabase schema for IPL Simulator (canonical reference).
--
-- This file documents the tables the app reads via fetchPlayers.ts /
-- fetchTeams.ts. It is NOT the seed mechanism — data is loaded by the
-- generated scripts in scripts/:
--   * scripts/load_players.sql  (players, generated from IPLMainGameDatabase.csv)
--   * scripts/load_teams.sql    (teams config)
-- Run those in the Supabase SQL Editor to (re)create + populate the tables.
-- ---------------------------------------------------------------------------

-- Players -------------------------------------------------------------------
-- One row per player. Salary history is denormalised into team_YYYY / salary_YYYY
-- columns (salary in crore). There is no separate ipl_history table.
create table if not exists players (
  id bigserial primary key,
  team text,
  name text not null,
  age integer,
  nationality text,
  primary_role text,
  ipl_2026_salary numeric,
  overseas_status text,
  status text,
  bowling_type text,
  bowling_hand text,
  batting_hand text,
  current_batting integer,
  potential_batting integer,
  current_bowling integer,
  potential_bowling integer,
  reputation integer,
  batting_aggression integer,
  can_keep_wickets boolean,
  part_time_wicketkeeper boolean,
  core_batter boolean,
  finisher boolean,
  captaincy integer,
  opener boolean,
  only_opener boolean,
  has_batted_at_3 boolean,
  has_batted_at_4 boolean,
  has_batted_at_5 boolean,
  has_batted_at_6 boolean,
  has_batted_at_7 boolean,
  ipl_captain_desire boolean,
  team_2026 text, salary_2026 numeric,
  team_2025 text, salary_2025 numeric,
  team_2024 text, salary_2024 numeric,
  team_2023 text, salary_2023 numeric,
  team_2022 text, salary_2022 numeric,
  team_2021 text, salary_2021 numeric,
  team_2020 text, salary_2020 numeric,
  team_2019 text, salary_2019 numeric,
  team_2018 text, salary_2018 numeric,
  team_2017 text, salary_2017 numeric,
  team_2016 text, salary_2016 numeric,
  team_2015 text, salary_2015 numeric,
  team_2014 text, salary_2014 numeric,
  team_2013 text, salary_2013 numeric,
  team_2012 text, salary_2012 numeric,
  team_2011 text, salary_2011 numeric,
  team_2010 text, salary_2010 numeric,
  team_2009 text, salary_2009 numeric,
  team_2008 text, salary_2008 numeric,
  t20_games integer,
  t20_batting_innings integer,
  t20_batting_average numeric,
  t20_runs integer,
  t20_strike_rate numeric,
  t20_bowling_innings integer,
  t20_bowling_average numeric,
  t20_wickets integer,
  t20_wk_catches integer,
  t20_wk_stumpings integer,
  ipl_games integer,
  ipl_runs integer,
  ipl_average numeric,
  ipl_strike_rate numeric,
  ipl_bowling_innings integer,
  ipl_bowling_average numeric,
  ipl_wickets integer
);

-- Teams ---------------------------------------------------------------------
-- Static franchise config only. Runtime state (squad, purse spent, RTM used,
-- overseas count) is initialised in the store per game, not stored here.
-- DNA + segment focus are flat columns; board objectives are JSONB.
create table if not exists teams (
  id text primary key,
  name text not null,
  short_name text,
  primary_color text,
  secondary_color text,
  home_ground text,
  city text,
  total_purse integer,
  rtm_cards_total integer,
  max_squad_size integer,
  min_squad_size integer,
  overseas_players_max integer,
  fan_base text,
  prestige integer,
  ai_personality text,
  description text,
  dna_loyalty integer,
  dna_pref_youngsters integer,
  dna_experience_focus integer,
  dna_big_names_pref integer,
  dna_looks_for_depth integer,
  dna_alr_value integer,
  dna_bat_value integer,
  dna_bowl_value integer,
  dna_commitment_to_targets integer,
  sf_overseas_pacers integer,
  sf_indian_pacers integer,
  sf_overseas_spinners integer,
  sf_indian_spinners integer,
  sf_overseas_all_rounders integer,
  sf_indian_all_rounders integer,
  sf_overseas_batters integer,
  sf_indian_batters integer,
  board_objectives jsonb
);

-- Row level security: public read + write (app uses the anon key). ----------
alter table players enable row level security;
alter table teams enable row level security;

create policy "public read players"  on players for select using (true);
create policy "public write players" on players for all    using (true) with check (true);
create policy "public read teams"    on teams   for select using (true);
create policy "public write teams"   on teams   for all    using (true) with check (true);
