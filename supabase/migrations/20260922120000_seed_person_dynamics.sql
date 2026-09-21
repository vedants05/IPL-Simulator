-- Approved 2026 starting roster: 22 player pairs, 18 player/staff pairs,
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
  ('player_player', 'opening_partners', 'Travis Head', 'Abhishek Sharma', 94, true, 'Established Sunrisers Hyderabad opening partnership.', 'https://www.iplt20.com/news/article/tata-ipl-2025-match-27-srh-vs-pbks-match-report'),
  ('player_player', 'opening_partners', 'Shubman Gill', 'Sai Sudharsan', 94, true, 'Established Gujarat Titans opening partnership.', 'https://www.iplt20.com/news/article/tata-ipl-2025-match-60-dc-vs-gt-match-report'),
  ('player_player', 'opening_partners', 'Devon Conway', 'Ruturaj Gaikwad', 86, true, 'Longstanding Chennai Super Kings opening partnership.', 'https://www.iplt20.com/teams/chennai-super-kings'),
  ('player_player', 'opening_partners', 'Jos Buttler', 'Yashasvi Jaiswal', 83, true, 'Former Rajasthan Royals opening partnership.', 'https://www.iplt20.com/news/article/tata-ipl-2024-match-38-rr-vs-mi-match-report'),
  ('player_player', 'mentor_protege', 'MS Dhoni', 'Ruturaj Gaikwad', 96, true, 'Long Chennai tenure together and Dhoni''s captaincy handover to Gaikwad.', 'https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni'),
  ('player_player', 'franchise_teammates', 'MS Dhoni', 'Ravindra Jadeja', 88, true, 'Longstanding Chennai Super Kings core players.', 'https://www.iplt20.com/teams/chennai-super-kings'),
  ('player_player', 'mentor_protege', 'Sanju Samson', 'Riyan Parag', 91, true, 'Parag has described Samson''s support and influence on his game.', 'https://www.rajasthanroyals.com/latest-news/on-the-field-you-learn-a-lot-from-him---parag-underlines-sanju-samsons-influence-on-his-game'),
  ('player_player', 'franchise_teammates', 'Sanju Samson', 'Yashasvi Jaiswal', 78, true, 'Multiple Rajasthan Royals seasons in the same batting group.', 'https://www.rajasthanroyals.com/static-assets/pdfs/IPL-2024.pdf'),
  ('player_player', 'spin_twins', 'Sunil Narine', 'Varun Chakravarthy', 90, true, 'Established Kolkata Knight Riders spin pairing.', 'https://www.iplt20.com/news/article/tata-ipl-2023-match-09-kkr-vs-rcb-match-report'),
  ('player_player', 'spin_twins', 'Axar Patel', 'Kuldeep Yadav', 84, true, 'Delhi Capitals spin pairing across multiple seasons.', 'https://www.iplt20.com/teams/delhi-capitals'),
  ('player_player', 'franchise_teammates', 'Rishabh Pant', 'Axar Patel', 83, true, 'Longstanding Delhi captain and senior all-rounder partnership.', 'https://www.iplt20.com/news/3982/hardik-pandya-and-cameron-green-traded-to-mi-and-rcbWhatareyourthoughtsonthistrade'),
  ('player_player', 'franchise_teammates', 'Virat Kohli', 'Rajat Patidar', 78, true, 'Repeated Royal Challengers Bengaluru seasons together, including Patidar''s captaincy.', 'https://royalchallengers.com/rcb-cricket-news/news/rcb-podcast-mo-bobat-reveals-how-rajat-patidar-was-picked-as-captain-ahead-of'),
  ('player_player', 'franchise_teammates', 'Rohit Sharma', 'Jasprit Bumrah', 88, true, 'Longstanding Mumbai Indians captain and lead bowler partnership.', 'https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling'),
  ('player_player', 'franchise_teammates', 'Rohit Sharma', 'Suryakumar Yadav', 81, true, 'Longstanding Mumbai Indians batting group.', 'https://www.mumbaiindians.com/'),
  ('player_player', 'franchise_teammates', 'Suryakumar Yadav', 'Tilak Varma', 79, true, 'Several Mumbai Indians seasons in the middle order.', 'https://www.mumbaiindians.com/'),
  ('player_player', 'spin_twins', 'Rashid Khan', 'Noor Ahmad', 87, true, 'Afghanistan and former Gujarat Titans spin pairing.', 'https://www.iplt20.com/video/49636/on-the-mic-with-spin-twins-rashid-khan-noor-ahmad'),
  ('player_player', 'spin_twins', 'Kuldeep Yadav', 'Yuzvendra Chahal', 88, true, 'Established India wrist-spin pairing.', 'https://www.bcci.tv/'),
  ('player_player', 'pace_tandem', 'Jasprit Bumrah', 'Mohammed Shami', 78, true, 'India pace attack across major tournaments.', 'https://www.bcci.tv/'),
  ('player_player', 'national_teammates', 'Virat Kohli', 'Rohit Sharma', 85, true, 'Long tenure together in India''s senior batting group.', 'https://www.bcci.tv/'),
  ('player_player', 'franchise_teammates', 'Travis Head', 'Pat Cummins', 77, true, 'Australia teammates and Sunrisers Hyderabad senior players.', 'https://www.iplt20.com/teams/sunrisers-hyderabad'),
  ('player_player', 'franchise_teammates', 'Rinku Singh', 'Venkatesh Iyer', 75, true, 'Multiple Kolkata Knight Riders seasons together.', 'https://www.iplt20.com/teams/kolkata-knight-riders'),
  ('player_player', 'franchise_teammates', 'Shubman Gill', 'Rashid Khan', 77, true, 'Senior Gujarat Titans teammates through Gill''s captaincy.', 'https://www.gujarattitansipl.com/news/gujarat-titans-gt-tata-ipl-2026-pre-season-press-conference'),
  ('player_staff', 'specialist_tutelage', 'Jasprit Bumrah', 'lasith-malinga', 96, true, 'Malinga mentored Bumrah''s bowling at Mumbai Indians.', 'https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling'),
  ('player_staff', 'specialist_tutelage', 'Jasprit Bumrah', 'shane-bond', 89, true, 'Bond coached Mumbai''s bowling during Bumrah''s development.', 'https://www.mumbaiindians.com/news/brain-behind-bowling'),
  ('player_staff', 'captain_coach_synergy', 'MS Dhoni', 'stephen-fleming', 98, true, 'Exceptionally long Chennai captain and coach partnership.', 'https://www.iplt20.com/news/article/msd-excellent-reader-of-the-game-fleming'),
  ('player_staff', 'captain_coach_synergy', 'Ruturaj Gaikwad', 'stephen-fleming', 88, true, 'Fleming coached Gaikwad through his move into Chennai captaincy.', 'https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni'),
  ('player_staff', 'captain_coach_synergy', 'Rishabh Pant', 'ricky-ponting', 88, true, 'Former Delhi captain and head coach partnership.', 'https://www.delhicapitals.in/news/ajit-agarkar-joins-delhi-capitals-as-assistant-coach'),
  ('player_staff', 'captain_coach_synergy', 'Shreyas Iyer', 'ricky-ponting', 90, true, 'Reunited as Punjab captain and head coach after working together at Delhi.', 'https://www.punjabkingsipl.in/features/shreyas-iyer-to-lead-punjab-kings'),
  ('player_staff', 'captain_coach_synergy', 'Rajat Patidar', 'andy-flower', 88, true, 'Bengaluru captain and head coach; Flower publicly backed Patidar''s leadership.', 'https://royalchallengers.com/rcb-cricket-news/news/rajats-got-a-stubbornness-and-a-strength-and-a-steeliness-about-him-andy'),
  ('player_staff', 'coached', 'Virat Kohli', 'andy-flower', 76, true, 'Shared Royal Challengers Bengaluru coaching tenure.', 'https://www.royalchallengers.com/'),
  ('player_staff', 'coached', 'Riyan Parag', 'kumar-sangakkara', 91, true, 'Parag credits Sangakkara''s coaching and support during his development.', 'https://www.rajasthanroyals.com/latest-news/on-the-field-you-learn-a-lot-from-him---parag-underlines-sanju-samsons-influence-on-his-game'),
  ('player_staff', 'captain_coach_synergy', 'Sanju Samson', 'kumar-sangakkara', 87, true, 'Former Rajasthan captain and cricket leader partnership.', 'https://www.rajasthanroyals.com/static-assets/pdfs/royals-scoop-ipl-2024.pdf'),
  ('player_staff', 'captain_coach_synergy', 'Shubman Gill', 'ashish-nehra', 90, true, 'Gujarat Titans captain and head coach partnership.', 'https://www.gujarattitansipl.com/news/gujarat-titans-gt-tata-ipl-2026-pre-season-press-conference'),
  ('player_staff', 'captain_coach_synergy', 'Hardik Pandya', 'ashish-nehra', 86, true, 'Former Gujarat Titans title-winning captain and head coach partnership.', 'https://www.gujarattitansipl.com/news/season-of-firsts-begins-five-things-we-are-most-excited-about-in-our-debut-season'),
  ('player_staff', 'captain_coach_synergy', 'Rohit Sharma', 'mahela-jayawardene', 88, true, 'Mumbai captain and head coach through multiple title-winning seasons.', 'https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025'),
  ('player_staff', 'captain_coach_synergy', 'Hardik Pandya', 'mahela-jayawardene', 82, true, 'Mumbai captain and returning head coach.', 'https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025'),
  ('player_staff', 'specialist_tutelage', 'Abhishek Sharma', 'yuvraj-singh', 95, true, 'Sustained individual batting mentorship.', 'https://www.hindustantimes.com/htcity/abhishek-sharma-on-comparisons-with-yuvraj-singh-he-taught-me-how-to-be-fearless-an-honour-to-have-him-as-my-mentor-101738671077665-amp.html'),
  ('player_staff', 'captain_coach_synergy', 'Virat Kohli', 'ravi-shastri', 88, true, 'Long India captain and head coach partnership.', 'https://www.bcci.tv/news/article/most-challenging-satisfying-job-ive-had-shastri'),
  ('player_staff', 'former_teammates', 'Sunil Narine', 'gautam-gambhir', 86, true, 'Former Kolkata teammates; Gambhir backed Narine as an opener.', 'https://www.iplt20.com/news/article/need-to-take-batting-tips-from-narine-gambhir'),
  ('player_staff', 'coached', 'Rinku Singh', 'gautam-gambhir', 80, true, 'Gambhir mentored Kolkata during Rinku''s tenure.', 'https://www.iplt20.com/teams/kolkata-knight-riders'),
  ('staff_staff', 'inner_circle_assistant', 'trevor-bayliss', 'paul-farbrace', 100, true, 'Bayliss personally recruited Farbrace as his assistant for Sri Lanka and reunited with him in the same structure for England.', 'https://www.bbc.co.uk/sport/cricket/41917102'),
  ('staff_staff', 'inner_circle_assistant', 'ricky-ponting', 'james-hopes', 96, true, 'Hopes worked under Ponting at Delhi and declined a Delhi extension to continue alongside him at Punjab.', 'https://www.cricbuzz.com/cricket-news/132208/pbks-retain-brad-haddin-and-sunil-joshi-james-hopes-may-join-support-staff-cricbuzzcom'),
  ('staff_staff', 'inner_circle_assistant', 'rahul-dravid', 'vikram-rathour', 95, true, 'After their successful India partnership, Rathour explicitly reunited with Dravid at Rajasthan and described their strong rapport.', 'https://www.espn.com/cricket/story/_/id/41338406/ipl-vikram-rathour-joins-rajasthan-royals-batting-coach'),
  ('staff_staff', 'inner_circle_assistant', 'gautam-gambhir', 'ryan-ten-doeschate', 94, true, 'Ten Doeschate moved from Gambhir''s KKR group into his India support staff.', 'https://www.aajtak.in/sports/cricket/story/gautam-gambhir-coaching-staff-is-inexperienced-ryan-ten-doeschate-abhishek-nayar-not-play-test-cricket-team-india-tspo-dskc-2087793-2024-11-04'),
  ('staff_staff', 'inner_circle_assistant', 'gautam-gambhir', 'morne-morkel', 93, true, 'Morkel worked in Gambhir-led structures at Lucknow before being recommended by Gambhir as bowling coach for his India staff.', 'https://www.espn.in/cricket/story/_/id/40856135/morne-morkel-appointed-india-bowling-coach'),
  ('staff_staff', 'inner_circle_assistant', 'mickey-arthur', 'grant-flower', 92, true, 'Flower served in Arthur''s Pakistan staff and subsequently joined the Sri Lanka coaching structure led by Arthur.', 'https://tribune.com.pk/story/1099949/arthurs-roots-to-grow-wings-to-fly-mantra-for-pakistan'),
  ('staff_staff', 'trusted_colleague', 'stephen-fleming', 'eric-simons', 90, true, 'Simons has served for years in Fleming-led Chennai and Joburg Super Kings structures.', 'https://www.wisden.com/cricket-news/sa20-2024-coaches-full-list-support-staff-each-sa20-team'),
  ('staff_staff', 'trusted_colleague', 'tom-moody', 'simon-helmot', 90, true, 'Helmot was Moody''s long-serving assistant through the original Sunrisers cycle and their later return.', 'https://www.espn.com/cricket/story/_/id/34508567/ipl-2023-srh-brian-lara-takes-tom-moody-sunrisers-head-coach'),
  ('staff_staff', 'trusted_colleague', 'stephen-fleming', 'michael-hussey', 87, true, 'Hussey has remained a central batting coach throughout Fleming''s long-running Chennai staff.', 'https://www.iplt20.com/teams/chennai-super-kings'),
  ('staff_staff', 'trusted_colleague', 'rahul-dravid', 'paras-mhambrey', 86, true, 'Mhambrey worked in Dravid-led India pathway and senior national-team structures across multiple cycles.', 'https://www.bcci.tv/articles/2021/news/155451/rahul-dravid-appointed-head-coach-of-team-india-men-s-senior-national-team'),
  ('staff_staff', 'trusted_colleague', 'mahela-jayawardene', 'lasith-malinga', 85, true, 'Malinga served as a Mumbai bowling mentor under Jayawardene in 2018 and returned to his later Mumbai coaching group.', 'https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025'),
  ('staff_staff', 'trusted_colleague', 'ricky-ponting', 'pravin-amre', 83, true, 'Amre was a long-serving senior member of Ponting''s Delhi Capitals coaching group.', 'https://www.espn.com/cricket/story/_/id/40553669/ricky-ponting-delhi-capitals-part-ways'),
  ('staff_staff', 'trusted_colleague', 'tom-moody', 'muttiah-muralitharan', 82, true, 'Muralitharan was the specialist constant across Moody''s long Sunrisers coaching tenure.', 'https://www.iplt20.com/teams/sunrisers-hyderabad'),
  ('staff_staff', 'trusted_colleague', 'mahela-jayawardene', 'kieron-pollard', 81, true, 'Pollard was a senior leader throughout Jayawardene''s title-winning Mumbai tenure and later joined the franchise coaching staff.', 'https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025'),
  ('staff_staff', 'trusted_colleague', 'ricky-ponting', 'brad-haddin', 78, true, 'Haddin forms part of Ponting''s senior Punjab support group after their overlapping Australia coaching work.', 'https://www.espn.in/cricket/story/_/id/44385100/ipl-2025-brad-haddin-backs-ricky-ponting-view-build-greatest-punjab-kings-team'),
  ('staff_staff', 'trusted_colleague', 'rahul-dravid', 't-dilip', 76, true, 'Dilip served throughout Dravid''s senior India head-coach cycle, including the 2024 T20 World Cup success.', 'https://www.bcci.tv/articles/2021/news/155451/rahul-dravid-appointed-head-coach-of-team-india-men-s-senior-national-team'),
  ('staff_staff', 'trusted_colleague', 'mickey-arthur', 'morne-morkel', 75, true, 'Arthur selected Morkel for the Pakistan structure he assembled as team director.', 'https://www.wisden.com/cricket-interviews/cricket-interviews/mickey-arthur-i-continually-witness-pakistan-cricket-nailing-it-in-the-foot'),
  ('staff_staff', 'trusted_colleague', 'kumar-sangakkara', 'trevor-penney', 74, true, 'Penney has served in Rajasthan''s senior coaching group during Sangakkara''s extended cricket-leadership tenure.', 'https://www.rajasthanroyals.com/latest-news/kumar-sangakkara-rr-new-head-coach-ipl-2026'),
  ('staff_staff', 'trusted_colleague', 'justin-langer', 'brad-haddin', 72, true, 'Haddin served as Australia''s fielding coach during the opening period of Langer''s national-team tenure.', 'https://www.cricket.com.au/news/3303872/mcdonald-secures-australia-assistant-coach-role'),
  ('staff_staff', 'trusted_colleague', 'brendon-mccullum', 'marcus-trescothick', 80, true, 'England senior coaching overlap.', 'https://www.ecb.co.uk/news/4106595/ecb-announces-brendon-mccullum-as-england-mens-whiteball-head-coach'),
  ('staff_staff', 'trusted_colleague', 'ashish-nehra', 'parthiv-patel', 76, true, 'Gujarat Titans head coach and assistant coach partnership.', 'https://www.gujarattitansipl.com/news/parthiv-patel-joins-gujarat-titans-as-assistant-coach-for-tata-ipl-2025'),
  ('staff_staff', 'trusted_colleague', 'ravi-shastri', 'bharat-arun', 88, true, 'Long India head coach and bowling coach partnership.', 'https://www.bcci.tv/news/article/the-boys-have-become-men-ravi-shastri'),
  ('staff_staff', 'trusted_colleague', 'andy-flower', 'dinesh-karthik', 80, true, 'Bengaluru head coach and batting coach partnership.', 'https://www.royalchallengers.com/rcb-cricket-news/news/ive-really-enjoyed-watching-andy-mo-bobat-on-the-dressing-room-atmosphere'),
  ('player_staff', 'idol', 'Jasprit Bumrah', 'lasith-malinga', 92, false, 'Mumbai Indians records Malinga as one of Bumrah''s early idols.', 'https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling'),
  ('player_staff', 'idol', 'Jasprit Bumrah', 'zaheer-khan', 84, false, 'Mumbai Indians records Zaheer as one of Bumrah''s early idols.', 'https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling');

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
