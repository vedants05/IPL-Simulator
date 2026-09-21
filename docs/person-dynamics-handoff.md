# Person dynamics: 65 relationship handoff

## Current state (checked 22 September 2026)

- The user approved all 65 relationships below: 22 player–player, 18 player–staff, 23 staff–staff and 2 one-way idols.
- The live Supabase `person_dynamics` table had **0 rows** at the last check. An insert with the project's `NEXT_PUBLIC_SUPABASE_ANON_KEY` returned HTTP 401 / PostgreSQL 42501: row-level security rejected it. Do not claim the seed is live without rechecking.
- The roster's source of truth is [`lib/data/personDynamicsSeeds.ts`](../lib/data/personDynamicsSeeds.ts). It imports 19 existing staff bonds from [`lib/data/staffRelationships.ts`](../lib/data/staffRelationships.ts). The staff bonds are still used directly by staff recruitment logic; keep that behavior until the game reads the new table.
- The ready-to-run, idempotent SQL is [`supabase/migrations/20260922120000_seed_person_dynamics.sql`](../supabase/migrations/20260922120000_seed_person_dynamics.sql). It resolves exact player names and staff slugs to database IDs, validates every participant and type, then inserts the rows.
- [`calibration/syncPersonDynamics.ts`](../calibration/syncPersonDynamics.ts) validates the roster against live Supabase and can insert it with a server-only `SUPABASE_SERVICE_ROLE_KEY`. Use `node --env-file=.env.local --import tsx calibration/syncPersonDynamics.ts --dry-run` to validate without writing. The key is not currently present in `.env.local`. A connected Supabase admin integration or authenticated SQL editor can apply the SQL instead.
- The schema is [`supabase/migrations/20260920140000_add_person_dynamics.sql`](../supabase/migrations/20260920140000_add_person_dynamics.sql). It allows public reads but has no anonymous insert/update policy for `person_dynamics`. Keep administrative writes off the public key.

## How to extend the roster

1. Add evidence-backed pairs to `PERSON_DYNAMICS_SEEDS`. Use exact `players.name` values for players and `staff_members.slug` values for staff. Include type, 0–100 strength, reason and a direct evidence URL. Do not infer a private friendship or conflict merely from shared nationality or team.
2. Check for the same pair and type in either order. `idol` is one-way, with the admirer as person 1. If a pair has two types, keep gameplay bonuses from stacking excessively.
3. Validate all participants and type categories against live Supabase. Extend the generator's count checks when intentionally adding rows.
4. If the 65-row migration has **not** been applied, regenerate it with `npx --no-install tsx calibration/generatePersonDynamicsMigration.ts`. If it **has** been applied, preserve that historical migration and create a new, idempotent migration for added rows.
5. Refresh this handoff note and verify row counts after any live write. Database seeding alone does not wire these relationships into gameplay or profile UI.

Strengths are proposed game ratings, not factual measurements of personal closeness. Historical bonds remain recorded; their gameplay effects should apply only when the people work or play together again.

## Player ↔ player (22)

| People | Type | Strength / 100 | Reason | Evidence |
|---|---|---:|---|---|
| Travis Head ↔ Abhishek Sharma | `opening_partners` | 94 | Established Sunrisers Hyderabad opening partnership. | [Source](https://www.iplt20.com/news/article/tata-ipl-2025-match-27-srh-vs-pbks-match-report) |
| Shubman Gill ↔ Sai Sudharsan | `opening_partners` | 94 | Established Gujarat Titans opening partnership. | [Source](https://www.iplt20.com/news/article/tata-ipl-2025-match-60-dc-vs-gt-match-report) |
| Devon Conway ↔ Ruturaj Gaikwad | `opening_partners` | 86 | Longstanding Chennai Super Kings opening partnership. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Jos Buttler ↔ Yashasvi Jaiswal | `opening_partners` | 83 | Former Rajasthan Royals opening partnership. | [Source](https://www.iplt20.com/news/article/tata-ipl-2024-match-38-rr-vs-mi-match-report) |
| MS Dhoni ↔ Ruturaj Gaikwad | `mentor_protege` | 96 | Long Chennai tenure together and Dhoni's captaincy handover to Gaikwad. | [Source](https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni) |
| MS Dhoni ↔ Ravindra Jadeja | `franchise_teammates` | 88 | Longstanding Chennai Super Kings core players. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Sanju Samson ↔ Riyan Parag | `mentor_protege` | 91 | Parag has described Samson's support and influence on his game. | [Source](https://www.rajasthanroyals.com/latest-news/on-the-field-you-learn-a-lot-from-him---parag-underlines-sanju-samsons-influence-on-his-game) |
| Sanju Samson ↔ Yashasvi Jaiswal | `franchise_teammates` | 78 | Multiple Rajasthan Royals seasons in the same batting group. | [Source](https://www.rajasthanroyals.com/static-assets/pdfs/IPL-2024.pdf) |
| Sunil Narine ↔ Varun Chakravarthy | `spin_twins` | 90 | Established Kolkata Knight Riders spin pairing. | [Source](https://www.iplt20.com/news/article/tata-ipl-2023-match-09-kkr-vs-rcb-match-report) |
| Axar Patel ↔ Kuldeep Yadav | `spin_twins` | 84 | Delhi Capitals spin pairing across multiple seasons. | [Source](https://www.iplt20.com/teams/delhi-capitals) |
| Rishabh Pant ↔ Axar Patel | `franchise_teammates` | 83 | Longstanding Delhi captain and senior all-rounder partnership. | [Source](https://www.iplt20.com/news/3982/hardik-pandya-and-cameron-green-traded-to-mi-and-rcbWhatareyourthoughtsonthistrade) |
| Virat Kohli ↔ Rajat Patidar | `franchise_teammates` | 78 | Repeated Royal Challengers Bengaluru seasons together, including Patidar's captaincy. | [Source](https://royalchallengers.com/rcb-cricket-news/news/rcb-podcast-mo-bobat-reveals-how-rajat-patidar-was-picked-as-captain-ahead-of) |
| Rohit Sharma ↔ Jasprit Bumrah | `franchise_teammates` | 88 | Longstanding Mumbai Indians captain and lead bowler partnership. | [Source](https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling) |
| Rohit Sharma ↔ Suryakumar Yadav | `franchise_teammates` | 81 | Longstanding Mumbai Indians batting group. | [Source](https://www.mumbaiindians.com/) |
| Suryakumar Yadav ↔ Tilak Varma | `franchise_teammates` | 79 | Several Mumbai Indians seasons in the middle order. | [Source](https://www.mumbaiindians.com/) |
| Rashid Khan ↔ Noor Ahmad | `spin_twins` | 87 | Afghanistan and former Gujarat Titans spin pairing. | [Source](https://www.iplt20.com/video/49636/on-the-mic-with-spin-twins-rashid-khan-noor-ahmad) |
| Kuldeep Yadav ↔ Yuzvendra Chahal | `spin_twins` | 88 | Established India wrist-spin pairing. | [Source](https://www.bcci.tv/) |
| Jasprit Bumrah ↔ Mohammed Shami | `pace_tandem` | 78 | India pace attack across major tournaments. | [Source](https://www.bcci.tv/) |
| Virat Kohli ↔ Rohit Sharma | `national_teammates` | 85 | Long tenure together in India's senior batting group. | [Source](https://www.bcci.tv/) |
| Travis Head ↔ Pat Cummins | `franchise_teammates` | 77 | Australia teammates and Sunrisers Hyderabad senior players. | [Source](https://www.iplt20.com/teams/sunrisers-hyderabad) |
| Rinku Singh ↔ Venkatesh Iyer | `franchise_teammates` | 75 | Multiple Kolkata Knight Riders seasons together. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Shubman Gill ↔ Rashid Khan | `franchise_teammates` | 77 | Senior Gujarat Titans teammates through Gill's captaincy. | [Source](https://www.gujarattitansipl.com/news/gujarat-titans-gt-tata-ipl-2026-pre-season-press-conference) |

## Player ↔ staff (18)

| People | Type | Strength / 100 | Reason | Evidence |
|---|---|---:|---|---|
| Jasprit Bumrah ↔ Lasith Malinga (lasith-malinga) | `specialist_tutelage` | 96 | Malinga mentored Bumrah's bowling at Mumbai Indians. | [Source](https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling) |
| Jasprit Bumrah ↔ Shane Bond (shane-bond) | `specialist_tutelage` | 89 | Bond coached Mumbai's bowling during Bumrah's development. | [Source](https://www.mumbaiindians.com/news/brain-behind-bowling) |
| MS Dhoni ↔ Stephen Fleming (stephen-fleming) | `captain_coach_synergy` | 98 | Exceptionally long Chennai captain and coach partnership. | [Source](https://www.iplt20.com/news/article/msd-excellent-reader-of-the-game-fleming) |
| Ruturaj Gaikwad ↔ Stephen Fleming (stephen-fleming) | `captain_coach_synergy` | 88 | Fleming coached Gaikwad through his move into Chennai captaincy. | [Source](https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni) |
| Rishabh Pant ↔ Ricky Ponting (ricky-ponting) | `captain_coach_synergy` | 88 | Former Delhi captain and head coach partnership. | [Source](https://www.delhicapitals.in/news/ajit-agarkar-joins-delhi-capitals-as-assistant-coach) |
| Shreyas Iyer ↔ Ricky Ponting (ricky-ponting) | `captain_coach_synergy` | 90 | Reunited as Punjab captain and head coach after working together at Delhi. | [Source](https://www.punjabkingsipl.in/features/shreyas-iyer-to-lead-punjab-kings) |
| Rajat Patidar ↔ Andy Flower (andy-flower) | `captain_coach_synergy` | 88 | Bengaluru captain and head coach; Flower publicly backed Patidar's leadership. | [Source](https://royalchallengers.com/rcb-cricket-news/news/rajats-got-a-stubbornness-and-a-strength-and-a-steeliness-about-him-andy) |
| Virat Kohli ↔ Andy Flower (andy-flower) | `coached` | 76 | Shared Royal Challengers Bengaluru coaching tenure. | [Source](https://www.royalchallengers.com/) |
| Riyan Parag ↔ Kumar Sangakkara (kumar-sangakkara) | `coached` | 91 | Parag credits Sangakkara's coaching and support during his development. | [Source](https://www.rajasthanroyals.com/latest-news/on-the-field-you-learn-a-lot-from-him---parag-underlines-sanju-samsons-influence-on-his-game) |
| Sanju Samson ↔ Kumar Sangakkara (kumar-sangakkara) | `captain_coach_synergy` | 87 | Former Rajasthan captain and cricket leader partnership. | [Source](https://www.rajasthanroyals.com/static-assets/pdfs/royals-scoop-ipl-2024.pdf) |
| Shubman Gill ↔ Ashish Nehra (ashish-nehra) | `captain_coach_synergy` | 90 | Gujarat Titans captain and head coach partnership. | [Source](https://www.gujarattitansipl.com/news/gujarat-titans-gt-tata-ipl-2026-pre-season-press-conference) |
| Hardik Pandya ↔ Ashish Nehra (ashish-nehra) | `captain_coach_synergy` | 86 | Former Gujarat Titans title-winning captain and head coach partnership. | [Source](https://www.gujarattitansipl.com/news/season-of-firsts-begins-five-things-we-are-most-excited-about-in-our-debut-season) |
| Rohit Sharma ↔ Mahela Jayawardene (mahela-jayawardene) | `captain_coach_synergy` | 88 | Mumbai captain and head coach through multiple title-winning seasons. | [Source](https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025) |
| Hardik Pandya ↔ Mahela Jayawardene (mahela-jayawardene) | `captain_coach_synergy` | 82 | Mumbai captain and returning head coach. | [Source](https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025) |
| Abhishek Sharma ↔ Yuvraj Singh (yuvraj-singh) | `specialist_tutelage` | 95 | Sustained individual batting mentorship. | [Source](https://www.hindustantimes.com/htcity/abhishek-sharma-on-comparisons-with-yuvraj-singh-he-taught-me-how-to-be-fearless-an-honour-to-have-him-as-my-mentor-101738671077665-amp.html) |
| Virat Kohli ↔ Ravi Shastri (ravi-shastri) | `captain_coach_synergy` | 88 | Long India captain and head coach partnership. | [Source](https://www.bcci.tv/news/article/most-challenging-satisfying-job-ive-had-shastri) |
| Sunil Narine ↔ Gautam Gambhir (gautam-gambhir) | `former_teammates` | 86 | Former Kolkata teammates; Gambhir backed Narine as an opener. | [Source](https://www.iplt20.com/news/article/need-to-take-batting-tips-from-narine-gambhir) |
| Rinku Singh ↔ Gautam Gambhir (gautam-gambhir) | `coached` | 80 | Gambhir mentored Kolkata during Rinku's tenure. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |

## Staff ↔ staff (23)

| People | Type | Strength / 100 | Reason | Evidence |
|---|---|---:|---|---|
| Trevor Bayliss (trevor-bayliss) ↔ Paul Farbrace (paul-farbrace) | `inner_circle_assistant` | 100 | Bayliss personally recruited Farbrace as his assistant for Sri Lanka and reunited with him in the same structure for England. | [Source](https://www.bbc.co.uk/sport/cricket/41917102) |
| Ricky Ponting (ricky-ponting) ↔ James Hopes (james-hopes) | `inner_circle_assistant` | 96 | Hopes worked under Ponting at Delhi and declined a Delhi extension to continue alongside him at Punjab. | [Source](https://www.cricbuzz.com/cricket-news/132208/pbks-retain-brad-haddin-and-sunil-joshi-james-hopes-may-join-support-staff-cricbuzzcom) |
| Rahul Dravid (rahul-dravid) ↔ Vikram Rathour (vikram-rathour) | `inner_circle_assistant` | 95 | After their successful India partnership, Rathour explicitly reunited with Dravid at Rajasthan and described their strong rapport. | [Source](https://www.espn.com/cricket/story/_/id/41338406/ipl-vikram-rathour-joins-rajasthan-royals-batting-coach) |
| Gautam Gambhir (gautam-gambhir) ↔ Ryan ten Doeschate (ryan-ten-doeschate) | `inner_circle_assistant` | 94 | Ten Doeschate moved from Gambhir's KKR group into his India support staff. | [Source](https://www.aajtak.in/sports/cricket/story/gautam-gambhir-coaching-staff-is-inexperienced-ryan-ten-doeschate-abhishek-nayar-not-play-test-cricket-team-india-tspo-dskc-2087793-2024-11-04) |
| Gautam Gambhir (gautam-gambhir) ↔ Morne Morkel (morne-morkel) | `inner_circle_assistant` | 93 | Morkel worked in Gambhir-led structures at Lucknow before being recommended by Gambhir as bowling coach for his India staff. | [Source](https://www.espn.in/cricket/story/_/id/40856135/morne-morkel-appointed-india-bowling-coach) |
| Mickey Arthur (mickey-arthur) ↔ Grant Flower (grant-flower) | `inner_circle_assistant` | 92 | Flower served in Arthur's Pakistan staff and subsequently joined the Sri Lanka coaching structure led by Arthur. | [Source](https://tribune.com.pk/story/1099949/arthurs-roots-to-grow-wings-to-fly-mantra-for-pakistan) |
| Stephen Fleming (stephen-fleming) ↔ Eric Simons (eric-simons) | `trusted_colleague` | 90 | Simons has served for years in Fleming-led Chennai and Joburg Super Kings structures. | [Source](https://www.wisden.com/cricket-news/sa20-2024-coaches-full-list-support-staff-each-sa20-team) |
| Tom Moody (tom-moody) ↔ Simon Helmot (simon-helmot) | `trusted_colleague` | 90 | Helmot was Moody's long-serving assistant through the original Sunrisers cycle and their later return. | [Source](https://www.espn.com/cricket/story/_/id/34508567/ipl-2023-srh-brian-lara-takes-tom-moody-sunrisers-head-coach) |
| Stephen Fleming (stephen-fleming) ↔ Michael Hussey (michael-hussey) | `trusted_colleague` | 87 | Hussey has remained a central batting coach throughout Fleming's long-running Chennai staff. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Rahul Dravid (rahul-dravid) ↔ Paras Mhambrey (paras-mhambrey) | `trusted_colleague` | 86 | Mhambrey worked in Dravid-led India pathway and senior national-team structures across multiple cycles. | [Source](https://www.bcci.tv/articles/2021/news/155451/rahul-dravid-appointed-head-coach-of-team-india-men-s-senior-national-team) |
| Mahela Jayawardene (mahela-jayawardene) ↔ Lasith Malinga (lasith-malinga) | `trusted_colleague` | 85 | Malinga served as a Mumbai bowling mentor under Jayawardene in 2018 and returned to his later Mumbai coaching group. | [Source](https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025) |
| Ricky Ponting (ricky-ponting) ↔ Pravin Amre (pravin-amre) | `trusted_colleague` | 83 | Amre was a long-serving senior member of Ponting's Delhi Capitals coaching group. | [Source](https://www.espn.com/cricket/story/_/id/40553669/ricky-ponting-delhi-capitals-part-ways) |
| Tom Moody (tom-moody) ↔ Muttiah Muralitharan (muttiah-muralitharan) | `trusted_colleague` | 82 | Muralitharan was the specialist constant across Moody's long Sunrisers coaching tenure. | [Source](https://www.iplt20.com/teams/sunrisers-hyderabad) |
| Mahela Jayawardene (mahela-jayawardene) ↔ Kieron Pollard (kieron-pollard) | `trusted_colleague` | 81 | Pollard was a senior leader throughout Jayawardene's title-winning Mumbai tenure and later joined the franchise coaching staff. | [Source](https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025) |
| Ricky Ponting (ricky-ponting) ↔ Brad Haddin (brad-haddin) | `trusted_colleague` | 78 | Haddin forms part of Ponting's senior Punjab support group after their overlapping Australia coaching work. | [Source](https://www.espn.in/cricket/story/_/id/44385100/ipl-2025-brad-haddin-backs-ricky-ponting-view-build-greatest-punjab-kings-team) |
| Rahul Dravid (rahul-dravid) ↔ T. Dilip (t-dilip) | `trusted_colleague` | 76 | Dilip served throughout Dravid's senior India head-coach cycle, including the 2024 T20 World Cup success. | [Source](https://www.bcci.tv/articles/2021/news/155451/rahul-dravid-appointed-head-coach-of-team-india-men-s-senior-national-team) |
| Mickey Arthur (mickey-arthur) ↔ Morne Morkel (morne-morkel) | `trusted_colleague` | 75 | Arthur selected Morkel for the Pakistan structure he assembled as team director. | [Source](https://www.wisden.com/cricket-interviews/cricket-interviews/mickey-arthur-i-continually-witness-pakistan-cricket-nailing-it-in-the-foot) |
| Kumar Sangakkara (kumar-sangakkara) ↔ Trevor Penney (trevor-penney) | `trusted_colleague` | 74 | Penney has served in Rajasthan's senior coaching group during Sangakkara's extended cricket-leadership tenure. | [Source](https://www.rajasthanroyals.com/latest-news/kumar-sangakkara-rr-new-head-coach-ipl-2026) |
| Justin Langer (justin-langer) ↔ Brad Haddin (brad-haddin) | `trusted_colleague` | 72 | Haddin served as Australia's fielding coach during the opening period of Langer's national-team tenure. | [Source](https://www.cricket.com.au/news/3303872/mcdonald-secures-australia-assistant-coach-role) |
| Brendon Mccullum (brendon-mccullum) ↔ Marcus Trescothick (marcus-trescothick) | `trusted_colleague` | 80 | England senior coaching overlap. | [Source](https://www.ecb.co.uk/news/4106595/ecb-announces-brendon-mccullum-as-england-mens-whiteball-head-coach) |
| Ashish Nehra (ashish-nehra) ↔ Parthiv Patel (parthiv-patel) | `trusted_colleague` | 76 | Gujarat Titans head coach and assistant coach partnership. | [Source](https://www.gujarattitansipl.com/news/parthiv-patel-joins-gujarat-titans-as-assistant-coach-for-tata-ipl-2025) |
| Ravi Shastri (ravi-shastri) ↔ Bharat Arun (bharat-arun) | `trusted_colleague` | 88 | Long India head coach and bowling coach partnership. | [Source](https://www.bcci.tv/news/article/the-boys-have-become-men-ravi-shastri) |
| Andy Flower (andy-flower) ↔ Dinesh Karthik (dinesh-karthik) | `trusted_colleague` | 80 | Bengaluru head coach and batting coach partnership. | [Source](https://www.royalchallengers.com/rcb-cricket-news/news/ive-really-enjoyed-watching-andy-mo-bobat-on-the-dressing-room-atmosphere) |

## One-way idols (2)

| People | Type | Strength / 100 | Reason | Evidence |
|---|---|---:|---|---|
| Jasprit Bumrah → Lasith Malinga (lasith-malinga) | `idol` | 92 | Mumbai Indians records Malinga as one of Bumrah's early idols. | [Source](https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling) |
| Jasprit Bumrah → Zaheer Khan (zaheer-khan) | `idol` | 84 | Mumbai Indians records Zaheer as one of Bumrah's early idols. | [Source](https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling) |
