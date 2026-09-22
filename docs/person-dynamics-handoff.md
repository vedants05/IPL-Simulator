# Person dynamics: 248 relationship handoff

## Current state (checked 22 September 2026)

- Roster expanded from 65 to **248 relationships**:
  - **108 player–player** bidirectional dynamics (opening partners, pace tandems, spin twins, mentor & protégé, domestic roots, personal bonds, franchise teammates, national teammates)
  - **81 player–staff** bidirectional dynamics (captain–coach synergy, specialist tutelage, talent champions, former teammates now coach, coached by)
  - **43 staff–staff** bidirectional dynamics (inner circle assistants, trusted colleagues)
  - **16 one-way idols** (players looking up to senior players or legendary coaches/mentors)
- The live Supabase `person_dynamics` table had **0 rows** at the last check. An insert with the project's `NEXT_PUBLIC_SUPABASE_ANON_KEY` returned HTTP 401 / PostgreSQL 42501: row-level security rejected it. Do not claim the seed is live without rechecking.
- The roster's source of truth is [`lib/data/personDynamicsSeeds.ts`](../lib/data/personDynamicsSeeds.ts). It imports 19 existing staff bonds from [`lib/data/staffRelationships.ts`](../lib/data/staffRelationships.ts). The staff bonds are still used directly by staff recruitment logic; keep that behavior until the game reads the new table.
- The ready-to-run, idempotent SQL is [`supabase/migrations/20260922120000_seed_person_dynamics.sql`](../supabase/migrations/20260922120000_seed_person_dynamics.sql). It resolves exact player names and staff slugs to database IDs, validates every participant and type, then inserts the rows.
- [`calibration/syncPersonDynamics.ts`](../calibration/syncPersonDynamics.ts) validates the roster against live Supabase and can insert it with a server-only `SUPABASE_SERVICE_ROLE_KEY`. Use `node --env-file=.env.local --import tsx calibration/syncPersonDynamics.ts --dry-run` to validate without writing.
- The schema is [`supabase/migrations/20260920140000_add_person_dynamics.sql`](../supabase/migrations/20260920140000_add_person_dynamics.sql). It allows public reads but has no anonymous insert/update policy for `person_dynamics`. Keep administrative writes off the public key.

## How to extend the roster

1. Add evidence-backed pairs to `PERSON_DYNAMICS_SEEDS`. Use exact `players.name` values for players and `staff_members.slug` values for staff. Include type, 0–100 strength, reason and a direct evidence URL. Do not infer a private friendship or conflict merely from shared nationality or team.
2. Check for the same pair and type in either order. `idol` is one-way, with the admirer as person 1. If a pair has two types, keep gameplay bonuses from stacking excessively.
3. Validate all participants and type categories against live Supabase. Extend the generator's count checks when intentionally adding rows.
4. Regenerate the idempotent migration with `npx --no-install tsx calibration/generatePersonDynamicsMigration.ts`.
5. Refresh this handoff note and verify row counts after any live write. Database seeding alone does not wire these relationships into gameplay or profile UI.

Strengths are proposed game ratings, not factual measurements of personal closeness. Historical bonds remain recorded; their gameplay effects should apply only when the people work or play together again.

## Player ↔ player (108)

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
| Rohit Sharma ↔ Ishan Kishan | `opening_partners` | 88 | Established Mumbai Indians multi-season opening batting combination. | [Source](https://www.mumbaiindians.com/) |
| Phil Salt ↔ Sunil Narine | `opening_partners` | 91 | Explosive title-winning opening pair for Kolkata Knight Riders in 2024. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| KL Rahul ↔ Quinton De Kock | `opening_partners` | 87 | Prolific opening pair for Lucknow Super Giants across multiple campaigns. | [Source](https://www.lucknowsupergiants.in/) |
| Ruturaj Gaikwad ↔ Rachin Ravindra | `opening_partners` | 84 | Chennai Super Kings opening combination following Conway's injury. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Trent Boult ↔ Jasprit Bumrah | `pace_tandem` | 92 | Devastating Mumbai Indians opening bowling partnership during title runs. | [Source](https://www.mumbaiindians.com/) |
| Trent Boult ↔ Sandeep Sharma | `pace_tandem` | 85 | Complementary Rajasthan Royals new-ball and death-overs pace strike pair. | [Source](https://www.rajasthanroyals.com/) |
| Mohammed Siraj ↔ Jasprit Bumrah | `pace_tandem` | 86 | Frontline India national team fast-bowling tandem across all formats. | [Source](https://www.bcci.tv/) |
| Arshdeep Singh ↔ Kagiso Rabada | `pace_tandem` | 84 | Primary fast bowling strike pair for Punjab Kings across consecutive seasons. | [Source](https://www.punjabkingsipl.in/) |
| Pat Cummins ↔ Bhuvneshwar Kumar | `pace_tandem` | 83 | Experienced senior Sunrisers Hyderabad pace attack leaders. | [Source](https://www.sunrisershyderabad.in/) |
| Harshit Rana ↔ Mitchell Starc | `pace_tandem` | 85 | Title-winning Kolkata Knight Riders pace duo in 2024 IPL campaign. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Khaleel Ahmed ↔ Mukesh Kumar | `pace_tandem` | 81 | Consistent Indian pace duo leading the Delhi Capitals bowling attack. | [Source](https://www.delhicapitals.in/) |
| Mohammed Shami ↔ Mohammed Siraj | `pace_tandem` | 85 | Experienced senior pace strike partners for the Indian national team. | [Source](https://www.bcci.tv/) |
| Anrich Nortje ↔ Kagiso Rabada | `pace_tandem` | 88 | Lethal South African express pace duo who also spearheaded Delhi Capitals attack. | [Source](https://www.delhicapitals.in/) |
| Matheesha Pathirana ↔ Tushar Deshpande | `pace_tandem` | 82 | Chennai Super Kings frontline death and middle-overs seam attack. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Akash Deep ↔ Mohammed Siraj | `pace_tandem` | 79 | Shared new ball duties for Royal Challengers Bengaluru and India Test attack. | [Source](https://www.royalchallengers.com/) |
| Ravi Bishnoi ↔ Krunal Pandya | `spin_twins` | 82 | Tightly-knit spin bowling tandem controlling the middle overs for Lucknow Super Giants. | [Source](https://www.lucknowsupergiants.in/) |
| Ravindra Jadeja ↔ Maheesh Theekshana | `spin_twins` | 83 | Complementary finger-spin and mystery-spin pairing for Chennai Super Kings. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Ravindra Jadeja ↔ Axar Patel | `spin_twins` | 84 | National left-arm orthodox spin and all-round tandem for India. | [Source](https://www.bcci.tv/) |
| R. Sai Kishore ↔ Rashid Khan | `spin_twins` | 81 | Sustained spin combination for Gujarat Titans through playoff runs. | [Source](https://www.gujarattitansipl.com/) |
| Rahul Chahar ↔ Harpreet Brar | `spin_twins` | 80 | Primary spin pairing for Punjab Kings across multiple seasons. | [Source](https://www.punjabkingsipl.in/) |
| Mayank Markande ↔ Shahbaz Ahmed | `spin_twins` | 78 | Spin bowling duo for Sunrisers Hyderabad during the 2024 campaign. | [Source](https://www.sunrisershyderabad.in/) |
| Suyash Sharma ↔ Varun Chakravarthy | `spin_twins` | 80 | Part of Kolkata Knight Riders mystery spin attack unit. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Rohit Sharma ↔ Tilak Varma | `mentor_protege` | 88 | Rohit took Tilak under his wing as Mumbai Indians groom him for top-order leadership. | [Source](https://www.mumbaiindians.com/) |
| Virat Kohli ↔ Mohammed Siraj | `mentor_protege` | 92 | Kohli backed Siraj through career-defining early struggles at RCB to become an international spearhead. | [Source](https://www.royalchallengers.com/) |
| MS Dhoni ↔ Shivam Dube | `mentor_protege` | 90 | Dhoni unlocked Dube's game by defining his spin-hitting middle-overs role at Chennai Super Kings. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| MS Dhoni ↔ Matheesha Pathirana | `mentor_protege` | 91 | Dhoni closely mentored Pathirana's death bowling development and workload management at CSK. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Rohit Sharma ↔ Ishan Kishan | `mentor_protege` | 85 | Rohit continuously guided Kishan through batting form and wicketkeeping responsibilities at Mumbai Indians. | [Source](https://www.mumbaiindians.com/) |
| Ravindra Jadeja ↔ Rachin Ravindra | `mentor_protege` | 82 | Jadeja guides the young Kiwi all-rounder within the CSK setup and international circuit. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Suryakumar Yadav ↔ Nehal Wadhera | `mentor_protege` | 83 | Suryakumar actively mentors Wadhera's 360-degree boundary hitting and game awareness at MI. | [Source](https://www.mumbaiindians.com/) |
| Hardik Pandya ↔ Tilak Varma | `mentor_protege` | 80 | Pandya works closely with Varma on middle-order finishing under pressure. | [Source](https://www.mumbaiindians.com/) |
| Jasprit Bumrah ↔ Akash Madhwal | `mentor_protege` | 84 | Bumrah worked directly with Madhwal on yorker execution and death bowling composure at MI. | [Source](https://www.mumbaiindians.com/) |
| Jasprit Bumrah ↔ Gerald Coetzee | `mentor_protege` | 81 | Bumrah guides the young South African tearaway in the Mumbai Indians pace attack. | [Source](https://www.mumbaiindians.com/) |
| Pat Cummins ↔ Nitish Kumar Reddy | `mentor_protege` | 85 | Cummins heavily backed and empowered young all-rounder Nitish Reddy during SRH's 2024 run. | [Source](https://www.sunrisershyderabad.in/) |
| Sunil Narine ↔ Angkrish Raghuvanshi | `mentor_protege` | 79 | Narine guides the youngster in handling high-tempo batting at Kolkata Knight Riders. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Shreyas Iyer ↔ Suryakumar Yadav | `domestic_roots` | 88 | Grew up together through Mumbai maidans and domestic cricket setup (Ranji Trophy). | [Source](https://www.mumbaicricket.com/) |
| Rohit Sharma ↔ Shardul Thakur | `domestic_roots` | 86 | Longstanding Mumbai domestic teammates and Ranji Trophy champions. | [Source](https://www.mumbaicricket.com/) |
| Hardik Pandya ↔ Krunal Pandya | `domestic_roots` | 98 | Brothers who rose through Baroda domestic cricket and Mumbai Indians together. | [Source](https://www.bcci.tv/) |
| Sarfaraz Khan ↔ Musheer Khan | `domestic_roots` | 96 | Brothers who trained together under father Naushad Khan and star for Mumbai domestic cricket. | [Source](https://www.mumbaicricket.com/) |
| Shubman Gill ↔ Arshdeep Singh | `domestic_roots` | 89 | Came through Punjab junior and senior age-group cricket together. | [Source](https://www.bcci.tv/) |
| Abhishek Sharma ↔ Arshdeep Singh | `domestic_roots` | 87 | Longtime Punjab domestic teammates and U19 state compatriots. | [Source](https://www.bcci.tv/) |
| Prithvi Shaw ↔ Sarfaraz Khan | `domestic_roots` | 85 | Childhood Mumbai school and domestic cricket batting prodigies. | [Source](https://www.mumbaicricket.com/) |
| Ruturaj Gaikwad ↔ Rahul Tripathi | `domestic_roots` | 83 | Longtime Maharashtra Ranji Trophy batting mainstays. | [Source](https://www.bcci.tv/) |
| Rinku Singh ↔ Dhruv Jurel | `domestic_roots` | 84 | Uttar Pradesh domestic teammates sharing a close journey through state cricket. | [Source](https://www.bcci.tv/) |
| Yashasvi Jaiswal ↔ Sarfaraz Khan | `domestic_roots` | 84 | Mumbai domestic batting linchpins who shared massive Ranji Trophy partnerships. | [Source](https://www.mumbaicricket.com/) |
| Tilak Varma ↔ Nitish Kumar Reddy | `domestic_roots` | 81 | Hyderabad and Andhra South Zone domestic circuit peers from junior cricket. | [Source](https://www.bcci.tv/) |
| R. Sai Kishore ↔ Shahrukh Khan | `domestic_roots` | 84 | Tamil Nadu domestic champions who won multiple Syed Mushtaq Ali Trophy titles together. | [Source](https://www.bcci.tv/) |
| R. Sai Kishore ↔ Washington Sundar | `domestic_roots` | 82 | Tamil Nadu spin-bowling all-round compatriots since age-group cricket. | [Source](https://www.bcci.tv/) |
| KL Rahul ↔ Hardik Pandya | `personal_bond` | 90 | Extremely close personal friendship off the pitch spanning many years. | [Source](https://www.bcci.tv/) |
| Ishan Kishan ↔ Rishabh Pant | `personal_bond` | 89 | Close friends since India U19 World Cup 2016 campaign. | [Source](https://www.bcci.tv/) |
| Shubman Gill ↔ Ishan Kishan | `personal_bond` | 88 | Close camaraderie and well-documented bonding on and off national tours. | [Source](https://www.bcci.tv/) |
| Sanju Samson ↔ Shimron Hetmyer | `personal_bond` | 84 | Close personal friendship and mutual admiration forged at Rajasthan Royals. | [Source](https://www.rajasthanroyals.com/) |
| Rinku Singh ↔ Nitish Rana | `personal_bond` | 86 | Deep friendship developed through Kolkata Knight Riders seasons. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Axar Patel ↔ Rishabh Pant | `personal_bond` | 87 | Longstanding close bond on and off the field for Delhi Capitals and India. | [Source](https://www.delhicapitals.in/) |
| Hardik Pandya ↔ Jasprit Bumrah | `franchise_teammates` | 86 | Foundational pillars of Mumbai Indians' multi-trophy dominance. | [Source](https://www.mumbaiindians.com/) |
| Hardik Pandya ↔ Rohit Sharma | `franchise_teammates` | 84 | Longtime core Mumbai Indians stars sharing multiple championship celebrations. | [Source](https://www.mumbaiindians.com/) |
| Heinrich Klaasen ↔ Travis Head | `franchise_teammates` | 86 | Explosive middle-order and top-order backbone of Sunrisers Hyderabad's record totals. | [Source](https://www.sunrisershyderabad.in/) |
| Pat Cummins ↔ Heinrich Klaasen | `franchise_teammates` | 85 | Captain and premier match-winner core at Sunrisers Hyderabad. | [Source](https://www.sunrisershyderabad.in/) |
| Nicholas Pooran ↔ KL Rahul | `franchise_teammates` | 84 | Senior batting leaders for Lucknow Super Giants across consecutive seasons. | [Source](https://www.lucknowsupergiants.in/) |
| Nicholas Pooran ↔ Ayush Badoni | `franchise_teammates` | 80 | Middle-order batting partners finishing high-pressure chases for LSG. | [Source](https://www.lucknowsupergiants.in/) |
| Jos Buttler ↔ Sanju Samson | `franchise_teammates` | 90 | Foundational senior batting leaders for Rajasthan Royals across six seasons. | [Source](https://www.rajasthanroyals.com/) |
| Riyan Parag ↔ Shimron Hetmyer | `franchise_teammates` | 82 | Finishing duo who have sealed multiple tense finishes for Rajasthan Royals. | [Source](https://www.rajasthanroyals.com/) |
| Rahul Tewatia ↔ Rashid Khan | `franchise_teammates` | 85 | Legendary finishing duo who produced miraculous final-over heists for Gujarat Titans. | [Source](https://www.gujarattitansipl.com/) |
| Shashank Singh ↔ Ashutosh Sharma | `franchise_teammates` | 88 | Breakout dynamic finishing duo for Punjab Kings in 2024 who repeatedly turned games. | [Source](https://www.punjabkingsipl.in/) |
| Tristan Stubbs ↔ Rishabh Pant | `franchise_teammates` | 82 | Key middle-order batting pillars for Delhi Capitals. | [Source](https://www.delhicapitals.in/) |
| Tristan Stubbs ↔ Axar Patel | `franchise_teammates` | 80 | Lower-middle order game changers for Delhi Capitals in 2024. | [Source](https://www.delhicapitals.in/) |
| Shivam Dube ↔ Ravindra Jadeja | `franchise_teammates` | 83 | Core middle-order and finishing all-rounders for Chennai Super Kings. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Deepak Chahar ↔ Shardul Thakur | `franchise_teammates` | 84 | Longtime Indian seam bowling core for Chennai Super Kings across title wins. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Harshal Patel ↔ Mohammed Siraj | `franchise_teammates` | 82 | Pace attack partners during Royal Challengers Bengaluru's playoff campaigns. | [Source](https://www.royalchallengers.com/) |
| Rohit Sharma ↔ Hardik Pandya | `national_teammates` | 86 | Captain and vice-captain tandem who led India to the 2024 T20 World Cup triumph. | [Source](https://www.bcci.tv/) |
| Virat Kohli ↔ Hardik Pandya | `national_teammates` | 85 | Senior match-winners who orchestrated famous international chases for India. | [Source](https://www.bcci.tv/) |
| Virat Kohli ↔ Jasprit Bumrah | `national_teammates` | 89 | World-class batting and bowling superstars who anchored India across a decade of cricket. | [Source](https://www.bcci.tv/) |
| Rohit Sharma ↔ Ravindra Jadeja | `national_teammates` | 87 | Longstanding senior India stalwarts across Test, ODI and T20 World Cup squads. | [Source](https://www.bcci.tv/) |
| Virat Kohli ↔ Ravindra Jadeja | `national_teammates` | 88 | Teammates since the 2008 U19 World Cup win through senior Indian dominance. | [Source](https://www.bcci.tv/) |
| Suryakumar Yadav ↔ Hardik Pandya | `national_teammates` | 85 | India T20I leadership core and middle-order power hitters. | [Source](https://www.bcci.tv/) |
| Jos Buttler ↔ Sam Curran | `national_teammates` | 84 | England T20 World Cup title-winning captain and player of the tournament duo. | [Source](https://www.ecb.co.uk/) |
| Pat Cummins ↔ Travis Head | `national_teammates` | 88 | Australia World Cup winning leaders and Ashes stalwarts. | [Source](https://www.cricket.com.au/) |
| Pat Cummins ↔ Mitchell Starc | `national_teammates` | 92 | Longstanding Australia pace strike spearheads across all formats. | [Source](https://www.cricket.com.au/) |
| Pat Cummins ↔ Josh Hazlewood | `national_teammates` | 90 | Australia's legendary pace attack foundation. | [Source](https://www.cricket.com.au/) |
| Mitchell Starc ↔ Josh Hazlewood | `national_teammates` | 89 | Australia frontline strike pace partners for over a decade. | [Source](https://www.cricket.com.au/) |
| Rashid Khan ↔ Fazalhaq Farooqi | `national_teammates` | 86 | Afghanistan senior bowling spearheads leading historic World Cup runs. | [Source](https://www.icc-cricket.com/) |
| Rashid Khan ↔ Rahmanullah Gurbaz | `national_teammates` | 87 | Talismanic leaders of Afghanistan's explosive white-ball squad. | [Source](https://www.icc-cricket.com/) |
| Heinrich Klaasen ↔ David Miller | `national_teammates` | 87 | South Africa's fearsome middle-order match-winning finishing core. | [Source](https://cricket.co.za/) |
| Kagiso Rabada ↔ Anrich Nortje | `national_teammates` | 88 | South Africa's elite strike fast-bowling tandem. | [Source](https://cricket.co.za/) |
| Quinton De Kock ↔ David Miller | `national_teammates` | 86 | Veteran South African white-ball pillars across multiple World Cups. | [Source](https://cricket.co.za/) |
| Wanindu Hasaranga ↔ Maheesh Theekshana | `national_teammates` | 86 | Sri Lanka's twin spin bowling strike force across international tournaments. | [Source](https://www.srilankacricket.lk/) |
| Phil Salt ↔ Harry Brook | `national_teammates` | 83 | England aggressive new-generation white-ball batting group. | [Source](https://www.ecb.co.uk/) |


## Player ↔ staff (81)

| People | Type | Strength / 100 | Reason | Evidence |
|---|---|---:|---|---|
| Jasprit Bumrah ↔ lasith-malinga (lasith-malinga) | `specialist_tutelage` | 96 | Malinga mentored Bumrah's bowling at Mumbai Indians. | [Source](https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling) |
| Jasprit Bumrah ↔ shane-bond (shane-bond) | `specialist_tutelage` | 89 | Bond coached Mumbai's bowling during Bumrah's development. | [Source](https://www.mumbaiindians.com/news/brain-behind-bowling) |
| MS Dhoni ↔ stephen-fleming (stephen-fleming) | `captain_coach_synergy` | 98 | Exceptionally long Chennai captain and coach partnership. | [Source](https://www.iplt20.com/news/article/msd-excellent-reader-of-the-game-fleming) |
| Ruturaj Gaikwad ↔ stephen-fleming (stephen-fleming) | `captain_coach_synergy` | 88 | Fleming coached Gaikwad through his move into Chennai captaincy. | [Source](https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni) |
| Rishabh Pant ↔ ricky-ponting (ricky-ponting) | `captain_coach_synergy` | 88 | Former Delhi captain and head coach partnership. | [Source](https://www.delhicapitals.in/news/ajit-agarkar-joins-delhi-capitals-as-assistant-coach) |
| Shreyas Iyer ↔ ricky-ponting (ricky-ponting) | `captain_coach_synergy` | 90 | Reunited as Punjab captain and head coach after working together at Delhi. | [Source](https://www.punjabkingsipl.in/features/shreyas-iyer-to-lead-punjab-kings) |
| Rajat Patidar ↔ andy-flower (andy-flower) | `captain_coach_synergy` | 88 | Bengaluru captain and head coach; Flower publicly backed Patidar's leadership. | [Source](https://royalchallengers.com/rcb-cricket-news/news/rajats-got-a-stubbornness-and-a-strength-and-a-steeliness-about-him-andy) |
| Virat Kohli ↔ andy-flower (andy-flower) | `coached` | 76 | Shared Royal Challengers Bengaluru coaching tenure. | [Source](https://www.royalchallengers.com/) |
| Riyan Parag ↔ kumar-sangakkara (kumar-sangakkara) | `coached` | 91 | Parag credits Sangakkara's coaching and support during his development. | [Source](https://www.rajasthanroyals.com/latest-news/on-the-field-you-learn-a-lot-from-him---parag-underlines-sanju-samsons-influence-on-his-game) |
| Sanju Samson ↔ kumar-sangakkara (kumar-sangakkara) | `captain_coach_synergy` | 87 | Former Rajasthan captain and cricket leader partnership. | [Source](https://www.rajasthanroyals.com/static-assets/pdfs/royals-scoop-ipl-2024.pdf) |
| Shubman Gill ↔ ashish-nehra (ashish-nehra) | `captain_coach_synergy` | 90 | Gujarat Titans captain and head coach partnership. | [Source](https://www.gujarattitansipl.com/news/gujarat-titans-gt-tata-ipl-2026-pre-season-press-conference) |
| Hardik Pandya ↔ ashish-nehra (ashish-nehra) | `captain_coach_synergy` | 86 | Former Gujarat Titans title-winning captain and head coach partnership. | [Source](https://www.gujarattitansipl.com/news/season-of-firsts-begins-five-things-we-are-most-excited-about-in-our-debut-season) |
| Rohit Sharma ↔ mahela-jayawardene (mahela-jayawardene) | `captain_coach_synergy` | 88 | Mumbai captain and head coach through multiple title-winning seasons. | [Source](https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025) |
| Hardik Pandya ↔ mahela-jayawardene (mahela-jayawardene) | `captain_coach_synergy` | 82 | Mumbai captain and returning head coach. | [Source](https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025) |
| Abhishek Sharma ↔ yuvraj-singh (yuvraj-singh) | `specialist_tutelage` | 95 | Sustained individual batting mentorship. | [Source](https://www.hindustantimes.com/htcity/abhishek-sharma-on-comparisons-with-yuvraj-singh-he-taught-me-how-to-be-fearless-an-honour-to-have-him-as-my-mentor-101738671077665-amp.html) |
| Virat Kohli ↔ ravi-shastri (ravi-shastri) | `captain_coach_synergy` | 88 | Long India captain and head coach partnership. | [Source](https://www.bcci.tv/news/article/most-challenging-satisfying-job-ive-had-shastri) |
| Sunil Narine ↔ gautam-gambhir (gautam-gambhir) | `former_teammates` | 86 | Former Kolkata teammates; Gambhir backed Narine as an opener. | [Source](https://www.iplt20.com/news/article/need-to-take-batting-tips-from-narine-gambhir) |
| Rinku Singh ↔ gautam-gambhir (gautam-gambhir) | `coached` | 80 | Gambhir mentored Kolkata during Rinku's tenure. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Pat Cummins ↔ daniel-vettori (daniel-vettori) | `captain_coach_synergy` | 92 | Highly successful captain and head coach partnership that took Sunrisers Hyderabad to the 2024 final. | [Source](https://www.sunrisershyderabad.in/) |
| Shreyas Iyer ↔ chandrakant-pandit (chandrakant-pandit) | `captain_coach_synergy` | 88 | Captain and head coach pairing that delivered Kolkata Knight Riders the 2024 IPL trophy. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| KL Rahul ↔ justin-langer (justin-langer) | `captain_coach_synergy` | 82 | Captain and head coach leadership trust at Lucknow Super Giants. | [Source](https://www.lucknowsupergiants.in/) |
| Sanju Samson ↔ rahul-dravid (rahul-dravid) | `captain_coach_synergy` | 90 | Samson reunites with Dravid at Rajasthan Royals after Dravid originally drafted and nurtured him. | [Source](https://www.rajasthanroyals.com/) |
| Ruturaj Gaikwad ↔ dwayne-bravo (dwayne-bravo) | `captain_coach_synergy` | 83 | Gaikwad leads CSK on field with Bravo managing bowling plans in the dugout. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Axar Patel ↔ ricky-ponting (ricky-ponting) | `captain_coach_synergy` | 84 | Ponting elevated Axar to vice-captain and strategic sounding board at Delhi Capitals. | [Source](https://www.delhicapitals.in/) |
| Varun Chakravarthy ↔ carl-crowe (carl-crowe) | `specialist_tutelage` | 90 | Crowe worked intensively with Chakravarthy on grip variations, revolutions, and release points. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Sunil Narine ↔ carl-crowe (carl-crowe) | `specialist_tutelage` | 95 | Crowe remodelled Narine's bowling action and remains his personal bowling coach. | [Source](https://www.espncricinfo.com/) |
| Matheesha Pathirana ↔ dwayne-bravo (dwayne-bravo) | `specialist_tutelage` | 92 | Bravo closely coached Pathirana in the art of the slower ball, dipping yorker, and death bowling craft. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Tushar Deshpande ↔ dwayne-bravo (dwayne-bravo) | `specialist_tutelage` | 85 | Bravo coached Deshpande through death-over mechanics during CSK title campaigns. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Mukesh Choudhary ↔ eric-simons (eric-simons) | `specialist_tutelage` | 82 | Simons mentored Choudhary's swing bowling craft and wrist position at CSK. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Ravi Bishnoi ↔ anil-kumble (anil-kumble) | `specialist_tutelage` | 91 | Kumble scouted Bishnoi and personally coached his unique googly trajectory and fast-arm action. | [Source](https://www.punjabkingsipl.in/) |
| Arshdeep Singh ↔ bharat-arun (bharat-arun) | `specialist_tutelage` | 84 | Arun worked with Arshdeep on yorker angles and seam presentation in national camps. | [Source](https://www.bcci.tv/) |
| Kuldeep Yadav ↔ sairaj-bahutule (sairaj-bahutule) | `specialist_tutelage` | 83 | Bahutule worked with Kuldeep on release speed and flight mechanics. | [Source](https://www.bcci.tv/) |
| Harshit Rana ↔ bharat-arun (bharat-arun) | `specialist_tutelage` | 88 | Arun shaped Harshit Rana's bowling trajectory, bouncers and slower-ball variations at KKR. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Vaibhav Arora ↔ bharat-arun (bharat-arun) | `specialist_tutelage` | 83 | Arun developed Arora's two-way swing movement with the new ball at KKR. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Mohsin Khan ↔ morne-morkel (morne-morkel) | `specialist_tutelage` | 86 | Morkel coached Mohsin Khan's tall release and back-of-a-length bounce at LSG. | [Source](https://www.lucknowsupergiants.in/) |
| Mayank Yadav ↔ morne-morkel (morne-morkel) | `specialist_tutelage` | 87 | Morkel worked with the express pacer on runup rhythm and explosive seam release at LSG. | [Source](https://www.lucknowsupergiants.in/) |
| Yashasvi Jaiswal ↔ vikram-rathour (vikram-rathour) | `specialist_tutelage` | 89 | Rathour coached Jaiswal's Test and T20 batting transitions for India and at RR. | [Source](https://www.rajasthanroyals.com/) |
| Shubman Gill ↔ vikram-rathour (vikram-rathour) | `specialist_tutelage` | 88 | Rathour worked on Gill's weight transfer and back-foot defence across national squads. | [Source](https://www.bcci.tv/) |
| Dhruv Jurel ↔ vikram-rathour (vikram-rathour) | `specialist_tutelage` | 84 | Rathour guided Jurel through his sensational India Test debut and batting development at RR. | [Source](https://www.rajasthanroyals.com/) |
| Rajat Patidar ↔ dinesh-karthik (dinesh-karthik) | `specialist_tutelage` | 83 | Karthik mentors Patidar on high-pressure tactical approach and spin execution at RCB. | [Source](https://www.royalchallengers.com/) |
| Ruturaj Gaikwad ↔ michael-hussey (michael-hussey) | `specialist_tutelage` | 91 | Hussey worked extensively with Gaikwad on tempo building and opening craft at CSK. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Devon Conway ↔ michael-hussey (michael-hussey) | `specialist_tutelage` | 86 | Hussey and Conway share detailed tactical preparation on subcontinental pitches at CSK. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Rohit Sharma ↔ ricky-ponting (ricky-ponting) | `talent_champion` | 92 | Ponting famously handed over Mumbai Indians captaincy to Rohit in 2013, launching MI's golden era. | [Source](https://www.mumbaiindians.com/) |
| Rinku Singh ↔ abhishek-nayar (abhishek-nayar) | `talent_champion` | 95 | Nayar transformed Rinku's career at the KKR Academy, backing him through years of injuries. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Varun Chakravarthy ↔ abhishek-nayar (abhishek-nayar) | `talent_champion` | 88 | Nayar advocated heavily for Chakravarthy's KKR recruitment and tactical role. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Angkrish Raghuvanshi ↔ abhishek-nayar (abhishek-nayar) | `talent_champion` | 91 | Nayar has personally coached and championed Raghuvanshi from childhood in Mumbai. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Sanju Samson ↔ rahul-dravid (rahul-dravid) | `talent_champion` | 94 | Dravid scouted Samson at Rajasthan Royals trials in 2013 and gave him his IPL debut. | [Source](https://www.rajasthanroyals.com/) |
| Karun Nair ↔ rahul-dravid (rahul-dravid) | `talent_champion` | 88 | Dravid championed Nair across Rajasthan Royals and India A setups. | [Source](https://www.bcci.tv/) |
| Rishabh Pant ↔ rahul-dravid (rahul-dravid) | `talent_champion` | 89 | Dravid developed and backed Pant through the 2016 U19 World Cup and Delhi Daredevils. | [Source](https://www.bcci.tv/) |
| Ishan Kishan ↔ rahul-dravid (rahul-dravid) | `talent_champion` | 87 | Dravid captained Kishan's development as India U19 head coach in 2016. | [Source](https://www.bcci.tv/) |
| Washington Sundar ↔ rahul-dravid (rahul-dravid) | `talent_champion` | 85 | Dravid nurtured Sundar's early career in the India pathway system. | [Source](https://www.bcci.tv/) |
| Ayush Badoni ↔ gautam-gambhir (gautam-gambhir) | `talent_champion` | 90 | Gambhir scouted Badoni, backed him at the auction and gave him immediate finishing responsibility at LSG. | [Source](https://www.lucknowsupergiants.in/) |
| Mayank Yadav ↔ gautam-gambhir (gautam-gambhir) | `talent_champion` | 88 | Gambhir scouted the raw pace sensation and brought him to Lucknow Super Giants. | [Source](https://www.lucknowsupergiants.in/) |
| Harshit Rana ↔ gautam-gambhir (gautam-gambhir) | `talent_champion` | 92 | Gambhir backed Harshit's fiery temperament and promoted him to frontline death bowler at KKR and India. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| Rohit Sharma ↔ kieron-pollard (kieron-pollard) | `former_teammates` | 93 | Legendary teammates who won five IPL titles together before Pollard transitioned to batting coach. | [Source](https://www.mumbaiindians.com/) |
| Jasprit Bumrah ↔ kieron-pollard (kieron-pollard) | `former_teammates` | 88 | Longtime Mumbai Indians teammates across multiple trophy-winning campaigns. | [Source](https://www.mumbaiindians.com/) |
| Suryakumar Yadav ↔ kieron-pollard (kieron-pollard) | `former_teammates` | 86 | Shared the Mumbai Indians middle order during championship-winning seasons. | [Source](https://www.mumbaiindians.com/) |
| Hardik Pandya ↔ kieron-pollard (kieron-pollard) | `former_teammates` | 91 | Famous finishing brothers-in-arms for Mumbai Indians over numerous seasons. | [Source](https://www.mumbaiindians.com/) |
| MS Dhoni ↔ dwayne-bravo (dwayne-bravo) | `former_teammates` | 96 | Dhoni and Bravo shared over a decade of CSK brotherhood before Bravo joined the coaching staff. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Ravindra Jadeja ↔ dwayne-bravo (dwayne-bravo) | `former_teammates` | 92 | CSK's legendary all-round engine room for multiple title-winning campaigns. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Ruturaj Gaikwad ↔ michael-hussey (michael-hussey) | `former_teammates` | 78 | Teammates in CSK squad before Hussey focused full-time on coaching Gaikwad. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| Virat Kohli ↔ dinesh-karthik (dinesh-karthik) | `former_teammates` | 92 | Longtime India and RCB teammates before Karthik became RCB's batting coach. | [Source](https://www.royalchallengers.com/) |
| Mohammed Siraj ↔ dinesh-karthik (dinesh-karthik) | `former_teammates` | 84 | Played together for multiple seasons at Royal Challengers Bengaluru. | [Source](https://www.royalchallengers.com/) |
| Shubman Gill ↔ matthew-wade (matthew-wade) | `former_teammates` | 83 | Gujarat Titans teammates in the 2022 title-winning squad. | [Source](https://www.gujarattitansipl.com/) |
| Rashid Khan ↔ matthew-wade (matthew-wade) | `former_teammates` | 82 | Shared the Gujarat Titans dugout during their championship run. | [Source](https://www.gujarattitansipl.com/) |
| Sunil Narine ↔ dwayne-bravo (dwayne-bravo) | `former_teammates` | 87 | Longtime West Indies international teammates and Caribbean premier league competitors. | [Source](https://www.windiescricket.com/) |
| Nicholas Pooran ↔ kieron-pollard (kieron-pollard) | `former_teammates` | 89 | Pooran succeeded Pollard as West Indies white-ball captain and shares close mentorship. | [Source](https://www.windiescricket.com/) |
| Shimron Hetmyer ↔ kieron-pollard (kieron-pollard) | `former_teammates` | 83 | West Indies international middle-order teammates. | [Source](https://www.windiescricket.com/) |
| Rohit Sharma ↔ gautam-gambhir (gautam-gambhir) | `coached` | 88 | Gambhir took over as India head coach with Rohit as his senior captain. | [Source](https://www.bcci.tv/) |
| Virat Kohli ↔ gautam-gambhir (gautam-gambhir) | `coached` | 86 | Longstanding Delhi cricket connection and senior player under Gambhir's India coaching tenure. | [Source](https://www.bcci.tv/) |
| Rohit Sharma ↔ rahul-dravid (rahul-dravid) | `coached` | 94 | Captain and coach partnership that reached the 2023 ODI World Cup final and won the 2024 T20 World Cup. | [Source](https://www.bcci.tv/) |
| Virat Kohli ↔ rahul-dravid (rahul-dravid) | `coached` | 90 | Shared leadership during Dravid's India head coach era. | [Source](https://www.bcci.tv/) |
| Travis Head ↔ daniel-vettori (daniel-vettori) | `coached` | 87 | Vettori coached Head's devastating attacking game at Sunrisers Hyderabad. | [Source](https://www.sunrisershyderabad.in/) |
| Heinrich Klaasen ↔ daniel-vettori (daniel-vettori) | `coached` | 86 | Vettori's SRH tactical setup gave Klaasen complete freedom against spin. | [Source](https://www.sunrisershyderabad.in/) |
| Prithvi Shaw ↔ ricky-ponting (ricky-ponting) | `coached` | 84 | Ponting passionately worked with Shaw on batting trigger movements and off-field discipline at DC. | [Source](https://www.delhicapitals.in/) |
| Arshdeep Singh ↔ ricky-ponting (ricky-ponting) | `coached` | 82 | Ponting leads Punjab Kings with Arshdeep as his frontline pace attack spearhead. | [Source](https://www.punjabkingsipl.in/) |
| Sam Curran ↔ trevor-bayliss (trevor-bayliss) | `coached` | 85 | Bayliss coached Curran across England national duties and Punjab Kings. | [Source](https://www.ecb.co.uk/) |
| Liam Livingstone ↔ trevor-bayliss (trevor-bayliss) | `coached` | 82 | Bayliss entrusted Livingstone with key middle-order batting duties at PBKS. | [Source](https://www.punjabkingsipl.in/) |
| Jos Buttler ↔ trevor-bayliss (trevor-bayliss) | `coached` | 90 | Bayliss built England's transformative white-ball batting philosophy around Buttler. | [Source](https://www.ecb.co.uk/) |
| Harry Brook ↔ brendon-mccullum (brendon-mccullum) | `coached` | 92 | McCullum shaped Brook's ultra-fearless batting style across England setups. | [Source](https://www.ecb.co.uk/) |
| Phil Salt ↔ brendon-mccullum (brendon-mccullum) | `coached` | 85 | McCullum backs Salt's attacking aggression as England white-ball coach. | [Source](https://www.ecb.co.uk/) |


## Staff ↔ staff (43)

| People | Type | Strength / 100 | Reason | Evidence |
|---|---|---:|---|---|
| dwayne-bravo (dwayne-bravo) ↔ andre-russell (andre-russell) | `trusted_colleague` | 88 | West Indies T20 World Cup champions and close Caribbean coaching compatriots. | [Source](https://www.windiescricket.com/) |
| trevor-bayliss (trevor-bayliss) ↔ paul-farbrace (paul-farbrace) | `inner_circle_assistant` | 100 | Bayliss personally recruited Farbrace as his assistant for Sri Lanka and reunited with him in the same structure for England. | [Source](https://www.bbc.co.uk/sport/cricket/41917102) |
| ricky-ponting (ricky-ponting) ↔ james-hopes (james-hopes) | `inner_circle_assistant` | 96 | Hopes worked under Ponting at Delhi and declined a Delhi extension to continue alongside him at Punjab. | [Source](https://www.cricbuzz.com/cricket-news/132208/pbks-retain-brad-haddin-and-sunil-joshi-james-hopes-may-join-support-staff-cricbuzzcom) |
| rahul-dravid (rahul-dravid) ↔ vikram-rathour (vikram-rathour) | `inner_circle_assistant` | 95 | After their successful India partnership, Rathour explicitly reunited with Dravid at Rajasthan and described their strong rapport. | [Source](https://www.espn.com/cricket/story/_/id/41338406/ipl-vikram-rathour-joins-rajasthan-royals-batting-coach) |
| gautam-gambhir (gautam-gambhir) ↔ ryan-ten-doeschate (ryan-ten-doeschate) | `inner_circle_assistant` | 94 | Ten Doeschate moved from Gambhir's KKR group into his India support staff. | [Source](https://www.aajtak.in/sports/cricket/story/gautam-gambhir-coaching-staff-is-inexperienced-ryan-ten-doeschate-abhishek-nayar-not-play-test-cricket-team-india-tspo-dskc-2087793-2024-11-04) |
| gautam-gambhir (gautam-gambhir) ↔ morne-morkel (morne-morkel) | `inner_circle_assistant` | 93 | Morkel worked in Gambhir-led structures at Lucknow before being recommended by Gambhir as bowling coach for his India staff. | [Source](https://www.espn.in/cricket/story/_/id/40856135/morne-morkel-appointed-india-bowling-coach) |
| mickey-arthur (mickey-arthur) ↔ grant-flower (grant-flower) | `inner_circle_assistant` | 92 | Flower served in Arthur's Pakistan staff and subsequently joined the Sri Lanka coaching structure led by Arthur. | [Source](https://tribune.com.pk/story/1099949/arthurs-roots-to-grow-wings-to-fly-mantra-for-pakistan) |
| stephen-fleming (stephen-fleming) ↔ eric-simons (eric-simons) | `trusted_colleague` | 90 | Simons has served for years in Fleming-led Chennai and Joburg Super Kings structures. | [Source](https://www.wisden.com/cricket-news/sa20-2024-coaches-full-list-support-staff-each-sa20-team) |
| tom-moody (tom-moody) ↔ simon-helmot (simon-helmot) | `trusted_colleague` | 90 | Helmot was Moody's long-serving assistant through the original Sunrisers cycle and their later return. | [Source](https://www.espn.com/cricket/story/_/id/34508567/ipl-2023-srh-brian-lara-takes-tom-moody-sunrisers-head-coach) |
| stephen-fleming (stephen-fleming) ↔ michael-hussey (michael-hussey) | `trusted_colleague` | 87 | Hussey has remained a central batting coach throughout Fleming's long-running Chennai staff. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| rahul-dravid (rahul-dravid) ↔ paras-mhambrey (paras-mhambrey) | `trusted_colleague` | 86 | Mhambrey worked in Dravid-led India pathway and senior national-team structures across multiple cycles. | [Source](https://www.bcci.tv/articles/2021/news/155451/rahul-dravid-appointed-head-coach-of-team-india-men-s-senior-national-team) |
| mahela-jayawardene (mahela-jayawardene) ↔ lasith-malinga (lasith-malinga) | `trusted_colleague` | 85 | Malinga served as a Mumbai bowling mentor under Jayawardene in 2018 and returned to his later Mumbai coaching group. | [Source](https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025) |
| ricky-ponting (ricky-ponting) ↔ pravin-amre (pravin-amre) | `trusted_colleague` | 83 | Amre was a long-serving senior member of Ponting's Delhi Capitals coaching group. | [Source](https://www.espn.com/cricket/story/_/id/40553669/ricky-ponting-delhi-capitals-part-ways) |
| tom-moody (tom-moody) ↔ muttiah-muralitharan (muttiah-muralitharan) | `trusted_colleague` | 82 | Muralitharan was the specialist constant across Moody's long Sunrisers coaching tenure. | [Source](https://www.iplt20.com/teams/sunrisers-hyderabad) |
| mahela-jayawardene (mahela-jayawardene) ↔ kieron-pollard (kieron-pollard) | `trusted_colleague` | 81 | Pollard was a senior leader throughout Jayawardene's title-winning Mumbai tenure and later joined the franchise coaching staff. | [Source](https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025) |
| ricky-ponting (ricky-ponting) ↔ brad-haddin (brad-haddin) | `trusted_colleague` | 78 | Haddin forms part of Ponting's senior Punjab support group after their overlapping Australia coaching work. | [Source](https://www.espn.in/cricket/story/_/id/44385100/ipl-2025-brad-haddin-backs-ricky-ponting-view-build-greatest-punjab-kings-team) |
| rahul-dravid (rahul-dravid) ↔ t-dilip (t-dilip) | `trusted_colleague` | 76 | Dilip served throughout Dravid's senior India head-coach cycle, including the 2024 T20 World Cup success. | [Source](https://www.bcci.tv/articles/2021/news/155451/rahul-dravid-appointed-head-coach-of-team-india-men-s-senior-national-team) |
| mickey-arthur (mickey-arthur) ↔ morne-morkel (morne-morkel) | `trusted_colleague` | 75 | Arthur selected Morkel for the Pakistan structure he assembled as team director. | [Source](https://www.wisden.com/cricket-interviews/cricket-interviews/mickey-arthur-i-continually-witness-pakistan-cricket-nailing-it-in-the-foot) |
| kumar-sangakkara (kumar-sangakkara) ↔ trevor-penney (trevor-penney) | `trusted_colleague` | 74 | Penney has served in Rajasthan's senior coaching group during Sangakkara's extended cricket-leadership tenure. | [Source](https://www.rajasthanroyals.com/latest-news/kumar-sangakkara-rr-new-head-coach-ipl-2026) |
| justin-langer (justin-langer) ↔ brad-haddin (brad-haddin) | `trusted_colleague` | 72 | Haddin served as Australia's fielding coach during the opening period of Langer's national-team tenure. | [Source](https://www.cricket.com.au/news/3303872/mcdonald-secures-australia-assistant-coach-role) |
| brendon-mccullum (brendon-mccullum) ↔ marcus-trescothick (marcus-trescothick) | `trusted_colleague` | 80 | England senior coaching overlap. | [Source](https://www.ecb.co.uk/news/4106595/ecb-announces-brendon-mccullum-as-england-mens-whiteball-head-coach) |
| ashish-nehra (ashish-nehra) ↔ parthiv-patel (parthiv-patel) | `trusted_colleague` | 76 | Gujarat Titans head coach and assistant coach partnership. | [Source](https://www.gujarattitansipl.com/news/parthiv-patel-joins-gujarat-titans-as-assistant-coach-for-tata-ipl-2025) |
| ravi-shastri (ravi-shastri) ↔ bharat-arun (bharat-arun) | `trusted_colleague` | 88 | Long India head coach and bowling coach partnership. | [Source](https://www.bcci.tv/news/article/the-boys-have-become-men-ravi-shastri) |
| andy-flower (andy-flower) ↔ dinesh-karthik (dinesh-karthik) | `trusted_colleague` | 80 | Bengaluru head coach and batting coach partnership. | [Source](https://www.royalchallengers.com/rcb-cricket-news/news/ive-really-enjoyed-watching-andy-mo-bobat-on-the-dressing-room-atmosphere) |
| gautam-gambhir (gautam-gambhir) ↔ abhishek-nayar (abhishek-nayar) | `trusted_colleague` | 95 | Architects of KKR's 2024 championship who joined forces again in the Indian national coaching setup. | [Source](https://www.bcci.tv/) |
| daniel-vettori (daniel-vettori) ↔ james-franklin (james-franklin) | `trusted_colleague` | 85 | Vettori and Franklin work closely as head coach and bowling coach at Sunrisers Hyderabad. | [Source](https://www.sunrisershyderabad.in/) |
| daniel-vettori (daniel-vettori) ↔ muttiah-muralitharan (muttiah-muralitharan) | `trusted_colleague` | 87 | Vettori and Muralitharan direct Sunrisers Hyderabad's tactical bowling plans. | [Source](https://www.sunrisershyderabad.in/) |
| chandrakant-pandit (chandrakant-pandit) ↔ bharat-arun (bharat-arun) | `trusted_colleague` | 88 | Head coach and bowling coach partnership that delivered the 2024 IPL title for KKR. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| chandrakant-pandit (chandrakant-pandit) ↔ abhishek-nayar (abhishek-nayar) | `trusted_colleague` | 86 | Pandit and Nayar formed the Indian domestic coaching brain trust at Kolkata Knight Riders. | [Source](https://www.iplt20.com/teams/kolkata-knight-riders) |
| justin-langer (justin-langer) ↔ lance-klusener (lance-klusener) | `trusted_colleague` | 84 | Langer and Klusener formed the head coach and assistant coach setup at Lucknow Super Giants. | [Source](https://www.lucknowsupergiants.in/) |
| stephen-fleming (stephen-fleming) ↔ dwayne-bravo (dwayne-bravo) | `trusted_colleague` | 92 | Fleming brought Bravo directly onto his CSK coaching staff upon Bravo's IPL retirement. | [Source](https://www.iplt20.com/teams/chennai-super-kings) |
| ashish-nehra (ashish-nehra) ↔ aashish-kapoor (aashish-kapoor) | `trusted_colleague` | 82 | Foundational members of Gujarat Titans' inaugural coaching and scouting staff. | [Source](https://www.gujarattitansipl.com/) |
| ashish-nehra (ashish-nehra) ↔ naeem-amin (naeem-amin) | `trusted_colleague` | 84 | Longstanding tactical and fielding collaboration within Gujarat Titans dugout. | [Source](https://www.gujarattitansipl.com/) |
| ashish-nehra (ashish-nehra) ↔ narender-negi (narender-negi) | `trusted_colleague` | 82 | Part of Gujarat Titans' trusted core backroom team. | [Source](https://www.gujarattitansipl.com/) |
| mahela-jayawardene (mahela-jayawardene) ↔ shane-bond (shane-bond) | `trusted_colleague` | 90 | Head coach and bowling coach partnership across multiple Mumbai Indians championship seasons. | [Source](https://www.mumbaiindians.com/) |
| mahela-jayawardene (mahela-jayawardene) ↔ kumar-sangakkara (kumar-sangakkara) | `trusted_colleague` | 96 | Legendary Sri Lankan leadership duo who co-captained and shaped modern Sri Lankan cricket. | [Source](https://www.srilankacricket.lk/) |
| rahul-dravid (rahul-dravid) ↔ kumar-sangakkara (kumar-sangakkara) | `trusted_colleague` | 88 | Senior cricket leadership peers who collaborated closely on Rajasthan Royals' strategic blueprint. | [Source](https://www.rajasthanroyals.com/) |
| gautam-gambhir (gautam-gambhir) ↔ sitanshu-kotak (sitanshu-kotak) | `trusted_colleague` | 85 | Kotak serves as key batting support and India A bridge in Gambhir's national coaching regime. | [Source](https://www.bcci.tv/) |
| andy-flower (andy-flower) ↔ richard-halsall (richard-halsall) | `trusted_colleague` | 88 | Halsall was Flower's trusted fielding coach during England's world number one era. | [Source](https://www.ecb.co.uk/) |
| ricky-ponting (ricky-ponting) ↔ sairaj-bahutule (sairaj-bahutule) | `trusted_colleague` | 80 | Ponting brought Bahutule into Punjab Kings as his lead spin bowling coach. | [Source](https://www.punjabkingsipl.in/) |
| ricky-ponting (ricky-ponting) ↔ matthew-wade (matthew-wade) | `trusted_colleague` | 83 | Ponting selected Wade as assistant/wicketkeeping coach in his new Punjab Kings structure. | [Source](https://www.punjabkingsipl.in/) |
| sourav-ganguly (sourav-ganguly) ↔ ricky-ponting (ricky-ponting) | `trusted_colleague` | 91 | Director of Cricket and Head Coach brain trust at Delhi Capitals across five seasons. | [Source](https://www.delhicapitals.in/) |
| sourav-ganguly (sourav-ganguly) ↔ pravin-amre (pravin-amre) | `trusted_colleague` | 85 | Delhi Capitals cricket operations and batting leadership colleagues. | [Source](https://www.delhicapitals.in/) |


## One-way idols (16)

| People | Type | Strength / 100 | Reason | Evidence |
|---|---|---:|---|---|
| Jasprit Bumrah → lasith-malinga (lasith-malinga) | `idol` | 92 | Mumbai Indians records Malinga as one of Bumrah's early idols. | [Source](https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling) |
| Jasprit Bumrah → zaheer-khan (zaheer-khan) | `idol` | 84 | Mumbai Indians records Zaheer as one of Bumrah's early idols. | [Source](https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling) |
| Ruturaj Gaikwad → ms-dhoni (ms-dhoni) | `idol` | 95 | Gaikwad has frequently named MS Dhoni as his cricket hero and calm leadership model. | [Source](https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni) |
| Yashasvi Jaiswal → Virat Kohli | `idol` | 94 | Jaiswal publicly stated Kohli is his ultimate batting idol and fitness benchmark. | [Source](https://www.bcci.tv/) |
| Shubman Gill → Virat Kohli | `idol` | 93 | Gill has idolized Kohli since childhood, wearing #77 and modelling his intensity on him. | [Source](https://www.bcci.tv/) |
| Rinku Singh → suresh-raina (suresh-raina) | `idol` | 92 | Rinku idolises UP legend Suresh Raina as his batting and fielding role model. | [Source](https://www.bcci.tv/) |
| Riyan Parag → Virat Kohli | `idol` | 93 | Parag has consistently described Kohli as his idol and batting inspiration. | [Source](https://www.rajasthanroyals.com/) |
| Tilak Varma → suresh-raina (suresh-raina) | `idol` | 90 | Tilak grew up idolising fellow left-hander and middle-order stalwart Suresh Raina. | [Source](https://www.mumbaiindians.com/) |
| Nitish Kumar Reddy → Virat Kohli | `idol` | 91 | Nitish Reddy has named Kohli as his idol for game awareness and fitness. | [Source](https://www.sunrisershyderabad.in/) |
| Rohit Sharma → sachin-tendulkar (sachin-tendulkar) | `idol` | 96 | Rohit grew up worshiping Sachin Tendulkar before playing alongside him for Mumbai and India. | [Source](https://www.mumbaiindians.com/) |
| Virat Kohli → sachin-tendulkar (sachin-tendulkar) | `idol` | 98 | Kohli famously stated Tendulkar was the sole reason he picked up a cricket bat. | [Source](https://www.bcci.tv/) |
| Sanju Samson → rahul-dravid (rahul-dravid) | `idol` | 92 | Samson has frequently hailed Rahul Dravid as his lifelong idol and guiding light. | [Source](https://www.rajasthanroyals.com/) |
| Dhruv Jurel → ms-dhoni (ms-dhoni) | `idol` | 93 | Jurel considers MS Dhoni his wicketkeeping and finishing idol. | [Source](https://www.rajasthanroyals.com/) |
| Ishan Kishan → ms-dhoni (ms-dhoni) | `idol` | 92 | Hailing from Jharkhand, Kishan grew up modeling his wicketkeeping on MS Dhoni. | [Source](https://www.mumbaiindians.com/) |
| Rishabh Pant → ms-dhoni (ms-dhoni) | `idol` | 94 | Pant shares a deep bond with Dhoni, looking up to him as his elder brother and hero. | [Source](https://www.bcci.tv/) |
| Mayank Yadav → dale-steyn (dale-steyn) | `idol` | 94 | Mayank Yadav grew up watching Dale Steyn videos and modeled his fast bowling after him. | [Source](https://www.lucknowsupergiants.in/) |

