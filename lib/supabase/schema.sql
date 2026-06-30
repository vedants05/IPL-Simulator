-- Players table
create table if not exists players (
  id text primary key,
  name text not null,
  age integer,
  nationality text,
  role text,
  batting_style text,
  bowling_style text,
  star_rating numeric(2,1),
  base_price integer,
  is_capped boolean default true,
  current_team_id text,
  potential text,

  -- Attributes (1-20)
  attr_technique integer default 10,
  attr_power integer default 10,
  attr_timing integer default 10,
  attr_placement integer default 10,
  attr_running integer default 12,
  attr_pace integer default 8,
  attr_swing integer default 8,
  attr_seam integer default 8,
  attr_spin integer default 8,
  attr_flight integer default 8,
  attr_accuracy integer default 10,
  attr_variation integer default 8,
  attr_catching integer default 13,
  attr_throwing integer default 12,
  attr_agility integer default 13,
  attr_composure integer default 12,
  attr_leadership integer default 10,
  attr_determination integer default 13,

  -- Batting career stats (T20)
  bat_matches integer default 0,
  bat_innings integer default 0,
  bat_runs integer default 0,
  bat_average numeric(5,2) default 0,
  bat_strike_rate numeric(5,1) default 0,
  bat_fifties integer default 0,
  bat_hundreds integer default 0,

  -- Bowling career stats (T20)
  bowl_matches integer default 0,
  bowl_wickets integer default 0,
  bowl_economy numeric(4,2) default 0,
  bowl_average numeric(5,2) default 0,
  bowl_best_figures text default '0/0',

  created_at timestamptz default now()
);

-- IPL history (one row per player per season)
create table if not exists ipl_history (
  id serial primary key,
  player_id text references players(id) on delete cascade,
  team_id text not null,
  season text not null,
  price integer not null,
  unique (player_id, season)
);

-- Enable RLS but allow public reads (no auth needed for this app)
alter table players enable row level security;
alter table ipl_history enable row level security;

create policy "Public read players" on players for select using (true);
create policy "Public read ipl_history" on ipl_history for select using (true);
create policy "Public insert players" on players for insert with check (true);
create policy "Public insert ipl_history" on ipl_history for insert with check (true);
create policy "Public update players" on players for update using (true);
create policy "Public delete players" on players for delete using (true);
create policy "Public delete ipl_history" on ipl_history for delete using (true);
