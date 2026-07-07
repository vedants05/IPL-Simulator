-- IPL teams config — generated from TEAMS_SEED. Run in Supabase SQL Editor.
drop table if exists teams cascade;

create table teams (
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

alter table teams enable row level security;
create policy "public read teams" on teams for select using (true);
create policy "public write teams" on teams for all using (true) with check (true);

insert into teams (id, name, short_name, primary_color, secondary_color, home_ground, city, total_purse, rtm_cards_total, max_squad_size, min_squad_size, overseas_players_max, fan_base, prestige, ai_personality, description, dna_loyalty, dna_pref_youngsters, dna_experience_focus, dna_big_names_pref, dna_looks_for_depth, dna_alr_value, dna_bat_value, dna_bowl_value, dna_commitment_to_targets, sf_overseas_pacers, sf_indian_pacers, sf_overseas_spinners, sf_indian_spinners, sf_overseas_all_rounders, sf_indian_all_rounders, sf_overseas_batters, sf_indian_batters, board_objectives) values
  ('MI', 'Mumbai Indians', 'MI', '#004BA0', '#D1AB3E', 'Wankhede Stadium', 'Mumbai', 12000, 6, 25, 18, 8, 'Massive', 10, 'Aggressive', 'Five-time champions with ₹120Cr purse. Retaining Rohit & Bumrah. Rebuilding around Indian core.', 78, 89, 67, 87, 40, 95, 80, 65, 80, 85, 70, 35, 40, 75, 85, 70, 85, '[{"id":"mi-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb),
  ('CSK', 'Chennai Super Kings', 'CSK', '#FDB913', '#141414', 'MA Chidambaram Stadium', 'Chennai', 12000, 6, 25, 18, 8, 'Massive', 10, 'Conservative', 'Five-time champions. Retaining Dhoni and Jadeja. Experienced squad, value-driven bidding.', 93, 44, 90, 80, 88, 75, 65, 50, 87, 75, 75, 65, 80, 80, 90, 70, 70, '[{"id":"csk-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb),
  ('KKR', 'Kolkata Knight Riders', 'KKR', '#3B215F', '#D4A017', 'Eden Gardens', 'Kolkata', 12000, 6, 25, 18, 8, 'Large', 9, 'Balanced', 'Three-time champions. Retaining Narine & Russell. Strong overseas core, seeking Indian stars.', 83, 68, 55, 86, 80, 90, 75, 75, 75, 65, 65, 85, 85, 95, 75, 60, 80, '[{"id":"kkr-1","description":"Win the IPL","type":"finish_position","target":1,"isCompleted":false}]'::jsonb),
  ('RCB', 'Royal Challengers Bengaluru', 'RCB', '#DA1818', '#D4A017', 'M. Chinnaswamy Stadium', 'Bengaluru', 12000, 6, 25, 18, 8, 'Massive', 8, 'Aggressive', 'Retaining Virat Kohli. High-spending franchise targeting marquee names to chase maiden title.', 60, 58, 74, 96, 40, 60, 90, 59, 45, 80, 60, 30, 55, 60, 60, 95, 90, '[{"id":"rcb-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb),
  ('DC', 'Delhi Capitals', 'DC', '#17449B', '#ffffff', 'Arun Jaitley Stadium', 'Delhi', 12000, 6, 25, 18, 8, 'Large', 7, 'Balanced', 'Rebuilding with Rishabh Pant as cornerstone. Aiming for first IPL title.', 50, 30, 80, 75, 74, 65, 55, 80, 60, 80, 65, 55, 75, 65, 70, 70, 60, '[{"id":"dc-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb),
  ('SRH', 'Sunrisers Hyderabad', 'SRH', '#F26522', '#000000', 'Rajiv Gandhi International Cricket Stadium', 'Hyderabad', 12000, 6, 25, 18, 8, 'Large', 7, 'Aggressive', 'Two-time champions. Retaining Head & Klaasen. Explosive batting-focused strategy.', 70, 83, 55, 65, 70, 75, 91, 45, 67, 75, 55, 45, 65, 70, 70, 90, 70, '[{"id":"srh-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb),
  ('PBKS', 'Punjab Kings', 'PBKS', '#DD1F2D', '#A7A9AC', 'Punjab Cricket Association Stadium', 'Mohali', 12000, 6, 25, 18, 8, 'Medium', 6, 'Balanced', 'Full rebuild after mega auction. Best chance to reshape the squad around young Indian talent.', 38, 55, 77, 68, 45, 76, 45, 30, 30, 75, 60, 45, 40, 75, 60, 70, 85, '[{"id":"pbks-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb),
  ('RR', 'Rajasthan Royals', 'RR', '#EA1A85', '#ffffff', 'Sawai Mansingh Stadium', 'Jaipur', 12000, 6, 25, 18, 8, 'Medium', 7, 'Conservative', 'Smart bidders who excel at finding undervalued talent. Retaining Samson and key domestic stars.', 80, 88, 26, 46, 70, 65, 81, 85, 67, 90, 85, 60, 75, 55, 70, 50, 85, '[{"id":"rr-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb),
  ('GT', 'Gujarat Titans', 'GT', '#1B2133', '#ffffff', 'Narendra Modi Stadium', 'Ahmedabad', 12000, 6, 25, 18, 8, 'Large', 8, 'Balanced', 'Two-time finalists. Retaining Shubman Gill & Rashid Khan. Strong bowling attack.', 70, 60, 55, 50, 88, 50, 80, 90, 75, 85, 95, 75, 75, 45, 65, 60, 85, '[{"id":"gt-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb),
  ('LSG', 'Lucknow Super Giants', 'LSG', '#0057e2', '#ffffff', 'BRSABV Ekana Cricket Stadium', 'Lucknow', 12000, 6, 25, 18, 8, 'Medium', 6, 'Aggressive', 'Newer franchise with deep pockets. Retaining KL Rahul. Targeting overseas power-hitters.', 20, 61, 60, 50, 80, 70, 65, 90, 70, 40, 90, 40, 70, 70, 70, 90, 55, '[{"id":"lsg-1","description":"Qualify for playoffs","type":"finish_position","target":4,"isCompleted":false}]'::jsonb);
