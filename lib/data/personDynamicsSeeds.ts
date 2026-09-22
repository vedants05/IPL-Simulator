import { STAFF_RELATIONSHIP_SEEDS } from "./staffRelationships";

export type PersonDynamicsSeed = {
  category: "player_player" | "player_staff" | "staff_staff";
  type: string;
  person1: string;
  person2: string;
  rating: number;
  reason: string;
  evidenceUrl: string;
  bidirectional?: false;
};

const playerPair = (person1: string, person2: string, type: string, rating: number, reason: string, evidenceUrl: string): PersonDynamicsSeed => ({
  category: "player_player", type, person1, person2, rating, reason, evidenceUrl,
});

const playerStaff = (person1: string, person2: string, type: string, rating: number, reason: string, evidenceUrl: string): PersonDynamicsSeed => ({
  category: "player_staff", type, person1, person2, rating, reason, evidenceUrl,
});

const staffPair = (person1: string, person2: string, type: string, rating: number, reason: string, evidenceUrl: string): PersonDynamicsSeed => ({
  category: "staff_staff", type, person1, person2, rating, reason, evidenceUrl,
});

/** Starting relationships approved for the 2026 database. Staff identifiers are slugs; player identifiers are exact database names. */
export const PERSON_DYNAMICS_SEEDS: PersonDynamicsSeed[] = [
  // --- Original 22 Player-Player Pairs ---
  playerPair("Travis Head", "Abhishek Sharma", "opening_partners", 94, "Established Sunrisers Hyderabad opening partnership.", "https://www.iplt20.com/news/article/tata-ipl-2025-match-27-srh-vs-pbks-match-report"),
  playerPair("Shubman Gill", "Sai Sudharsan", "opening_partners", 94, "Established Gujarat Titans opening partnership.", "https://www.iplt20.com/news/article/tata-ipl-2025-match-60-dc-vs-gt-match-report"),
  playerPair("Devon Conway", "Ruturaj Gaikwad", "opening_partners", 86, "Longstanding Chennai Super Kings opening partnership.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("Jos Buttler", "Yashasvi Jaiswal", "opening_partners", 83, "Former Rajasthan Royals opening partnership.", "https://www.iplt20.com/news/article/tata-ipl-2024-match-38-rr-vs-mi-match-report"),
  playerPair("MS Dhoni", "Ruturaj Gaikwad", "mentor_protege", 96, "Long Chennai tenure together and Dhoni's captaincy handover to Gaikwad.", "https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni"),
  playerPair("MS Dhoni", "Ravindra Jadeja", "franchise_teammates", 88, "Longstanding Chennai Super Kings core players.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("Sanju Samson", "Riyan Parag", "mentor_protege", 91, "Parag has described Samson's support and influence on his game.", "https://www.rajasthanroyals.com/latest-news/on-the-field-you-learn-a-lot-from-him---parag-underlines-sanju-samsons-influence-on-his-game"),
  playerPair("Sanju Samson", "Yashasvi Jaiswal", "franchise_teammates", 78, "Multiple Rajasthan Royals seasons in the same batting group.", "https://www.rajasthanroyals.com/static-assets/pdfs/IPL-2024.pdf"),
  playerPair("Sunil Narine", "Varun Chakravarthy", "spin_twins", 90, "Established Kolkata Knight Riders spin pairing.", "https://www.iplt20.com/news/article/tata-ipl-2023-match-09-kkr-vs-rcb-match-report"),
  playerPair("Axar Patel", "Kuldeep Yadav", "spin_twins", 84, "Delhi Capitals spin pairing across multiple seasons.", "https://www.iplt20.com/teams/delhi-capitals"),
  playerPair("Rishabh Pant", "Axar Patel", "franchise_teammates", 83, "Longstanding Delhi captain and senior all-rounder partnership.", "https://www.iplt20.com/news/3982/hardik-pandya-and-cameron-green-traded-to-mi-and-rcbWhatareyourthoughtsonthistrade"),
  playerPair("Virat Kohli", "Rajat Patidar", "franchise_teammates", 78, "Repeated Royal Challengers Bengaluru seasons together, including Patidar's captaincy.", "https://royalchallengers.com/rcb-cricket-news/news/rcb-podcast-mo-bobat-reveals-how-rajat-patidar-was-picked-as-captain-ahead-of"),
  playerPair("Rohit Sharma", "Jasprit Bumrah", "franchise_teammates", 88, "Longstanding Mumbai Indians captain and lead bowler partnership.", "https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling"),
  playerPair("Rohit Sharma", "Suryakumar Yadav", "franchise_teammates", 81, "Longstanding Mumbai Indians batting group.", "https://www.mumbaiindians.com/"),
  playerPair("Suryakumar Yadav", "Tilak Varma", "franchise_teammates", 79, "Several Mumbai Indians seasons in the middle order.", "https://www.mumbaiindians.com/"),
  playerPair("Rashid Khan", "Noor Ahmad", "spin_twins", 87, "Afghanistan and former Gujarat Titans spin pairing.", "https://www.iplt20.com/video/49636/on-the-mic-with-spin-twins-rashid-khan-noor-ahmad"),
  playerPair("Kuldeep Yadav", "Yuzvendra Chahal", "spin_twins", 88, "Established India wrist-spin pairing.", "https://www.bcci.tv/"),
  playerPair("Jasprit Bumrah", "Mohammed Shami", "pace_tandem", 78, "India pace attack across major tournaments.", "https://www.bcci.tv/"),
  playerPair("Virat Kohli", "Rohit Sharma", "national_teammates", 85, "Long tenure together in India's senior batting group.", "https://www.bcci.tv/"),
  playerPair("Travis Head", "Pat Cummins", "franchise_teammates", 77, "Australia teammates and Sunrisers Hyderabad senior players.", "https://www.iplt20.com/teams/sunrisers-hyderabad"),
  playerPair("Rinku Singh", "Venkatesh Iyer", "franchise_teammates", 75, "Multiple Kolkata Knight Riders seasons together.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerPair("Shubman Gill", "Rashid Khan", "franchise_teammates", 77, "Senior Gujarat Titans teammates through Gill's captaincy.", "https://www.gujarattitansipl.com/news/gujarat-titans-gt-tata-ipl-2026-pre-season-press-conference"),

  // --- Added Player-Player Opening Partners ---
  playerPair("Rohit Sharma", "Ishan Kishan", "opening_partners", 88, "Established Mumbai Indians multi-season opening batting combination.", "https://www.mumbaiindians.com/"),
  playerPair("Phil Salt", "Sunil Narine", "opening_partners", 91, "Explosive title-winning opening pair for Kolkata Knight Riders in 2024.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerPair("KL Rahul", "Quinton De Kock", "opening_partners", 87, "Prolific opening pair for Lucknow Super Giants across multiple campaigns.", "https://www.lucknowsupergiants.in/"),
  playerPair("Ruturaj Gaikwad", "Rachin Ravindra", "opening_partners", 84, "Chennai Super Kings opening combination following Conway's injury.", "https://www.iplt20.com/teams/chennai-super-kings"),

  // --- Added Player-Player Pace Tandems ---
  playerPair("Trent Boult", "Jasprit Bumrah", "pace_tandem", 92, "Devastating Mumbai Indians opening bowling partnership during title runs.", "https://www.mumbaiindians.com/"),
  playerPair("Trent Boult", "Sandeep Sharma", "pace_tandem", 85, "Complementary Rajasthan Royals new-ball and death-overs pace strike pair.", "https://www.rajasthanroyals.com/"),
  playerPair("Mohammed Siraj", "Jasprit Bumrah", "pace_tandem", 86, "Frontline India national team fast-bowling tandem across all formats.", "https://www.bcci.tv/"),
  playerPair("Arshdeep Singh", "Kagiso Rabada", "pace_tandem", 84, "Primary fast bowling strike pair for Punjab Kings across consecutive seasons.", "https://www.punjabkingsipl.in/"),
  playerPair("Pat Cummins", "Bhuvneshwar Kumar", "pace_tandem", 83, "Experienced senior Sunrisers Hyderabad pace attack leaders.", "https://www.sunrisershyderabad.in/"),
  playerPair("Harshit Rana", "Mitchell Starc", "pace_tandem", 85, "Title-winning Kolkata Knight Riders pace duo in 2024 IPL campaign.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerPair("Khaleel Ahmed", "Mukesh Kumar", "pace_tandem", 81, "Consistent Indian pace duo leading the Delhi Capitals bowling attack.", "https://www.delhicapitals.in/"),
  playerPair("Mohammed Shami", "Mohammed Siraj", "pace_tandem", 85, "Experienced senior pace strike partners for the Indian national team.", "https://www.bcci.tv/"),
  playerPair("Anrich Nortje", "Kagiso Rabada", "pace_tandem", 88, "Lethal South African express pace duo who also spearheaded Delhi Capitals attack.", "https://www.delhicapitals.in/"),
  playerPair("Matheesha Pathirana", "Tushar Deshpande", "pace_tandem", 82, "Chennai Super Kings frontline death and middle-overs seam attack.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("Akash Deep", "Mohammed Siraj", "pace_tandem", 79, "Shared new ball duties for Royal Challengers Bengaluru and India Test attack.", "https://www.royalchallengers.com/"),

  // --- Added Player-Player Spin Twins ---
  playerPair("Ravi Bishnoi", "Krunal Pandya", "spin_twins", 82, "Tightly-knit spin bowling tandem controlling the middle overs for Lucknow Super Giants.", "https://www.lucknowsupergiants.in/"),
  playerPair("Ravindra Jadeja", "Maheesh Theekshana", "spin_twins", 83, "Complementary finger-spin and mystery-spin pairing for Chennai Super Kings.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("Ravindra Jadeja", "Axar Patel", "spin_twins", 84, "National left-arm orthodox spin and all-round tandem for India.", "https://www.bcci.tv/"),
  playerPair("R. Sai Kishore", "Rashid Khan", "spin_twins", 81, "Sustained spin combination for Gujarat Titans through playoff runs.", "https://www.gujarattitansipl.com/"),
  playerPair("Rahul Chahar", "Harpreet Brar", "spin_twins", 80, "Primary spin pairing for Punjab Kings across multiple seasons.", "https://www.punjabkingsipl.in/"),
  playerPair("Mayank Markande", "Shahbaz Ahmed", "spin_twins", 78, "Spin bowling duo for Sunrisers Hyderabad during the 2024 campaign.", "https://www.sunrisershyderabad.in/"),
  playerPair("Suyash Sharma", "Varun Chakravarthy", "spin_twins", 80, "Part of Kolkata Knight Riders mystery spin attack unit.", "https://www.iplt20.com/teams/kolkata-knight-riders"),

  // --- Added Player-Player Mentor & Protege ---
  playerPair("Rohit Sharma", "Tilak Varma", "mentor_protege", 88, "Rohit took Tilak under his wing as Mumbai Indians groom him for top-order leadership.", "https://www.mumbaiindians.com/"),
  playerPair("Virat Kohli", "Mohammed Siraj", "mentor_protege", 92, "Kohli backed Siraj through career-defining early struggles at RCB to become an international spearhead.", "https://www.royalchallengers.com/"),
  playerPair("MS Dhoni", "Shivam Dube", "mentor_protege", 90, "Dhoni unlocked Dube's game by defining his spin-hitting middle-overs role at Chennai Super Kings.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("MS Dhoni", "Matheesha Pathirana", "mentor_protege", 91, "Dhoni closely mentored Pathirana's death bowling development and workload management at CSK.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("Rohit Sharma", "Ishan Kishan", "mentor_protege", 85, "Rohit continuously guided Kishan through batting form and wicketkeeping responsibilities at Mumbai Indians.", "https://www.mumbaiindians.com/"),
  playerPair("Ravindra Jadeja", "Rachin Ravindra", "mentor_protege", 82, "Jadeja guides the young Kiwi all-rounder within the CSK setup and international circuit.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("Suryakumar Yadav", "Nehal Wadhera", "mentor_protege", 83, "Suryakumar actively mentors Wadhera's 360-degree boundary hitting and game awareness at MI.", "https://www.mumbaiindians.com/"),
  playerPair("Hardik Pandya", "Tilak Varma", "mentor_protege", 80, "Pandya works closely with Varma on middle-order finishing under pressure.", "https://www.mumbaiindians.com/"),
  playerPair("Jasprit Bumrah", "Akash Madhwal", "mentor_protege", 84, "Bumrah worked directly with Madhwal on yorker execution and death bowling composure at MI.", "https://www.mumbaiindians.com/"),
  playerPair("Jasprit Bumrah", "Gerald Coetzee", "mentor_protege", 81, "Bumrah guides the young South African tearaway in the Mumbai Indians pace attack.", "https://www.mumbaiindians.com/"),
  playerPair("Pat Cummins", "Nitish Kumar Reddy", "mentor_protege", 85, "Cummins heavily backed and empowered young all-rounder Nitish Reddy during SRH's 2024 run.", "https://www.sunrisershyderabad.in/"),
  playerPair("Sunil Narine", "Angkrish Raghuvanshi", "mentor_protege", 79, "Narine guides the youngster in handling high-tempo batting at Kolkata Knight Riders.", "https://www.iplt20.com/teams/kolkata-knight-riders"),

  // --- Added Player-Player Domestic Roots ---
  playerPair("Shreyas Iyer", "Suryakumar Yadav", "domestic_roots", 88, "Grew up together through Mumbai maidans and domestic cricket setup (Ranji Trophy).", "https://www.mumbaicricket.com/"),
  playerPair("Rohit Sharma", "Shardul Thakur", "domestic_roots", 86, "Longstanding Mumbai domestic teammates and Ranji Trophy champions.", "https://www.mumbaicricket.com/"),
  playerPair("Hardik Pandya", "Krunal Pandya", "domestic_roots", 98, "Brothers who rose through Baroda domestic cricket and Mumbai Indians together.", "https://www.bcci.tv/"),
  playerPair("Sarfaraz Khan", "Musheer Khan", "domestic_roots", 96, "Brothers who trained together under father Naushad Khan and star for Mumbai domestic cricket.", "https://www.mumbaicricket.com/"),
  playerPair("Shubman Gill", "Arshdeep Singh", "domestic_roots", 89, "Came through Punjab junior and senior age-group cricket together.", "https://www.bcci.tv/"),
  playerPair("Abhishek Sharma", "Arshdeep Singh", "domestic_roots", 87, "Longtime Punjab domestic teammates and U19 state compatriots.", "https://www.bcci.tv/"),
  playerPair("Prithvi Shaw", "Sarfaraz Khan", "domestic_roots", 85, "Childhood Mumbai school and domestic cricket batting prodigies.", "https://www.mumbaicricket.com/"),
  playerPair("Ruturaj Gaikwad", "Rahul Tripathi", "domestic_roots", 83, "Longtime Maharashtra Ranji Trophy batting mainstays.", "https://www.bcci.tv/"),
  playerPair("Rinku Singh", "Dhruv Jurel", "domestic_roots", 84, "Uttar Pradesh domestic teammates sharing a close journey through state cricket.", "https://www.bcci.tv/"),
  playerPair("Yashasvi Jaiswal", "Sarfaraz Khan", "domestic_roots", 84, "Mumbai domestic batting linchpins who shared massive Ranji Trophy partnerships.", "https://www.mumbaicricket.com/"),
  playerPair("Tilak Varma", "Nitish Kumar Reddy", "domestic_roots", 81, "Hyderabad and Andhra South Zone domestic circuit peers from junior cricket.", "https://www.bcci.tv/"),
  playerPair("R. Sai Kishore", "Shahrukh Khan", "domestic_roots", 84, "Tamil Nadu domestic champions who won multiple Syed Mushtaq Ali Trophy titles together.", "https://www.bcci.tv/"),
  playerPair("R. Sai Kishore", "Washington Sundar", "domestic_roots", 82, "Tamil Nadu spin-bowling all-round compatriots since age-group cricket.", "https://www.bcci.tv/"),

  // --- Added Player-Player Personal Bond ---
  playerPair("KL Rahul", "Hardik Pandya", "personal_bond", 90, "Extremely close personal friendship off the pitch spanning many years.", "https://www.bcci.tv/"),
  playerPair("Ishan Kishan", "Rishabh Pant", "personal_bond", 89, "Close friends since India U19 World Cup 2016 campaign.", "https://www.bcci.tv/"),
  playerPair("Shubman Gill", "Ishan Kishan", "personal_bond", 88, "Close camaraderie and well-documented bonding on and off national tours.", "https://www.bcci.tv/"),
  playerPair("Sanju Samson", "Shimron Hetmyer", "personal_bond", 84, "Close personal friendship and mutual admiration forged at Rajasthan Royals.", "https://www.rajasthanroyals.com/"),
  playerPair("Rinku Singh", "Nitish Rana", "personal_bond", 86, "Deep friendship developed through Kolkata Knight Riders seasons.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerPair("Axar Patel", "Rishabh Pant", "personal_bond", 87, "Longstanding close bond on and off the field for Delhi Capitals and India.", "https://www.delhicapitals.in/"),

  // --- Added Player-Player Franchise Teammates ---
  playerPair("Hardik Pandya", "Jasprit Bumrah", "franchise_teammates", 86, "Foundational pillars of Mumbai Indians' multi-trophy dominance.", "https://www.mumbaiindians.com/"),
  playerPair("Hardik Pandya", "Rohit Sharma", "franchise_teammates", 84, "Longtime core Mumbai Indians stars sharing multiple championship celebrations.", "https://www.mumbaiindians.com/"),
  playerPair("Heinrich Klaasen", "Travis Head", "franchise_teammates", 86, "Explosive middle-order and top-order backbone of Sunrisers Hyderabad's record totals.", "https://www.sunrisershyderabad.in/"),
  playerPair("Pat Cummins", "Heinrich Klaasen", "franchise_teammates", 85, "Captain and premier match-winner core at Sunrisers Hyderabad.", "https://www.sunrisershyderabad.in/"),
  playerPair("Nicholas Pooran", "KL Rahul", "franchise_teammates", 84, "Senior batting leaders for Lucknow Super Giants across consecutive seasons.", "https://www.lucknowsupergiants.in/"),
  playerPair("Nicholas Pooran", "Ayush Badoni", "franchise_teammates", 80, "Middle-order batting partners finishing high-pressure chases for LSG.", "https://www.lucknowsupergiants.in/"),
  playerPair("Jos Buttler", "Sanju Samson", "franchise_teammates", 90, "Foundational senior batting leaders for Rajasthan Royals across six seasons.", "https://www.rajasthanroyals.com/"),
  playerPair("Riyan Parag", "Shimron Hetmyer", "franchise_teammates", 82, "Finishing duo who have sealed multiple tense finishes for Rajasthan Royals.", "https://www.rajasthanroyals.com/"),
  playerPair("Rahul Tewatia", "Rashid Khan", "franchise_teammates", 85, "Legendary finishing duo who produced miraculous final-over heists for Gujarat Titans.", "https://www.gujarattitansipl.com/"),
  playerPair("Shashank Singh", "Ashutosh Sharma", "franchise_teammates", 88, "Breakout dynamic finishing duo for Punjab Kings in 2024 who repeatedly turned games.", "https://www.punjabkingsipl.in/"),
  playerPair("Tristan Stubbs", "Rishabh Pant", "franchise_teammates", 82, "Key middle-order batting pillars for Delhi Capitals.", "https://www.delhicapitals.in/"),
  playerPair("Tristan Stubbs", "Axar Patel", "franchise_teammates", 80, "Lower-middle order game changers for Delhi Capitals in 2024.", "https://www.delhicapitals.in/"),
  playerPair("Shivam Dube", "Ravindra Jadeja", "franchise_teammates", 83, "Core middle-order and finishing all-rounders for Chennai Super Kings.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("Deepak Chahar", "Shardul Thakur", "franchise_teammates", 84, "Longtime Indian seam bowling core for Chennai Super Kings across title wins.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerPair("Harshal Patel", "Mohammed Siraj", "franchise_teammates", 82, "Pace attack partners during Royal Challengers Bengaluru's playoff campaigns.", "https://www.royalchallengers.com/"),

  // --- Added Player-Player National Teammates ---
  playerPair("Rohit Sharma", "Hardik Pandya", "national_teammates", 86, "Captain and vice-captain tandem who led India to the 2024 T20 World Cup triumph.", "https://www.bcci.tv/"),
  playerPair("Virat Kohli", "Hardik Pandya", "national_teammates", 85, "Senior match-winners who orchestrated famous international chases for India.", "https://www.bcci.tv/"),
  playerPair("Virat Kohli", "Jasprit Bumrah", "national_teammates", 89, "World-class batting and bowling superstars who anchored India across a decade of cricket.", "https://www.bcci.tv/"),
  playerPair("Rohit Sharma", "Ravindra Jadeja", "national_teammates", 87, "Longstanding senior India stalwarts across Test, ODI and T20 World Cup squads.", "https://www.bcci.tv/"),
  playerPair("Virat Kohli", "Ravindra Jadeja", "national_teammates", 88, "Teammates since the 2008 U19 World Cup win through senior Indian dominance.", "https://www.bcci.tv/"),
  playerPair("Suryakumar Yadav", "Hardik Pandya", "national_teammates", 85, "India T20I leadership core and middle-order power hitters.", "https://www.bcci.tv/"),
  playerPair("Jos Buttler", "Sam Curran", "national_teammates", 84, "England T20 World Cup title-winning captain and player of the tournament duo.", "https://www.ecb.co.uk/"),
  playerPair("Pat Cummins", "Travis Head", "national_teammates", 88, "Australia World Cup winning leaders and Ashes stalwarts.", "https://www.cricket.com.au/"),
  playerPair("Pat Cummins", "Mitchell Starc", "national_teammates", 92, "Longstanding Australia pace strike spearheads across all formats.", "https://www.cricket.com.au/"),
  playerPair("Pat Cummins", "Josh Hazlewood", "national_teammates", 90, "Australia's legendary pace attack foundation.", "https://www.cricket.com.au/"),
  playerPair("Mitchell Starc", "Josh Hazlewood", "national_teammates", 89, "Australia frontline strike pace partners for over a decade.", "https://www.cricket.com.au/"),
  playerPair("Rashid Khan", "Fazalhaq Farooqi", "national_teammates", 86, "Afghanistan senior bowling spearheads leading historic World Cup runs.", "https://www.icc-cricket.com/"),
  playerPair("Rashid Khan", "Rahmanullah Gurbaz", "national_teammates", 87, "Talismanic leaders of Afghanistan's explosive white-ball squad.", "https://www.icc-cricket.com/"),
  playerPair("Heinrich Klaasen", "David Miller", "national_teammates", 87, "South Africa's fearsome middle-order match-winning finishing core.", "https://cricket.co.za/"),
  playerPair("Kagiso Rabada", "Anrich Nortje", "national_teammates", 88, "South Africa's elite strike fast-bowling tandem.", "https://cricket.co.za/"),
  playerPair("Quinton De Kock", "David Miller", "national_teammates", 86, "Veteran South African white-ball pillars across multiple World Cups.", "https://cricket.co.za/"),
  playerPair("Wanindu Hasaranga", "Maheesh Theekshana", "national_teammates", 86, "Sri Lanka's twin spin bowling strike force across international tournaments.", "https://www.srilankacricket.lk/"),
  playerPair("Phil Salt", "Harry Brook", "national_teammates", 83, "England aggressive new-generation white-ball batting group.", "https://www.ecb.co.uk/"),

  // --- Original 18 Player-Staff Relationships ---
  playerStaff("Jasprit Bumrah", "lasith-malinga", "specialist_tutelage", 96, "Malinga mentored Bumrah's bowling at Mumbai Indians.", "https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling"),
  playerStaff("Jasprit Bumrah", "shane-bond", "specialist_tutelage", 89, "Bond coached Mumbai's bowling during Bumrah's development.", "https://www.mumbaiindians.com/news/brain-behind-bowling"),
  playerStaff("MS Dhoni", "stephen-fleming", "captain_coach_synergy", 98, "Exceptionally long Chennai captain and coach partnership.", "https://www.iplt20.com/news/article/msd-excellent-reader-of-the-game-fleming"),
  playerStaff("Ruturaj Gaikwad", "stephen-fleming", "captain_coach_synergy", 88, "Fleming coached Gaikwad through his move into Chennai captaincy.", "https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni"),
  playerStaff("Rishabh Pant", "ricky-ponting", "captain_coach_synergy", 88, "Former Delhi captain and head coach partnership.", "https://www.delhicapitals.in/news/ajit-agarkar-joins-delhi-capitals-as-assistant-coach"),
  playerStaff("Shreyas Iyer", "ricky-ponting", "captain_coach_synergy", 90, "Reunited as Punjab captain and head coach after working together at Delhi.", "https://www.punjabkingsipl.in/features/shreyas-iyer-to-lead-punjab-kings"),
  playerStaff("Rajat Patidar", "andy-flower", "captain_coach_synergy", 88, "Bengaluru captain and head coach; Flower publicly backed Patidar's leadership.", "https://royalchallengers.com/rcb-cricket-news/news/rajats-got-a-stubbornness-and-a-strength-and-a-steeliness-about-him-andy"),
  playerStaff("Virat Kohli", "andy-flower", "coached", 76, "Shared Royal Challengers Bengaluru coaching tenure.", "https://www.royalchallengers.com/"),
  playerStaff("Riyan Parag", "kumar-sangakkara", "coached", 91, "Parag credits Sangakkara's coaching and support during his development.", "https://www.rajasthanroyals.com/latest-news/on-the-field-you-learn-a-lot-from-him---parag-underlines-sanju-samsons-influence-on-his-game"),
  playerStaff("Sanju Samson", "kumar-sangakkara", "captain_coach_synergy", 87, "Former Rajasthan captain and cricket leader partnership.", "https://www.rajasthanroyals.com/static-assets/pdfs/royals-scoop-ipl-2024.pdf"),
  playerStaff("Shubman Gill", "ashish-nehra", "captain_coach_synergy", 90, "Gujarat Titans captain and head coach partnership.", "https://www.gujarattitansipl.com/news/gujarat-titans-gt-tata-ipl-2026-pre-season-press-conference"),
  playerStaff("Hardik Pandya", "ashish-nehra", "captain_coach_synergy", 86, "Former Gujarat Titans title-winning captain and head coach partnership.", "https://www.gujarattitansipl.com/news/season-of-firsts-begins-five-things-we-are-most-excited-about-in-our-debut-season"),
  playerStaff("Rohit Sharma", "mahela-jayawardene", "captain_coach_synergy", 88, "Mumbai captain and head coach through multiple title-winning seasons.", "https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025"),
  playerStaff("Hardik Pandya", "mahela-jayawardene", "captain_coach_synergy", 82, "Mumbai captain and returning head coach.", "https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025"),
  playerStaff("Abhishek Sharma", "yuvraj-singh", "specialist_tutelage", 95, "Sustained individual batting mentorship.", "https://www.hindustantimes.com/htcity/abhishek-sharma-on-comparisons-with-yuvraj-singh-he-taught-me-how-to-be-fearless-an-honour-to-have-him-as-my-mentor-101738671077665-amp.html"),
  playerStaff("Virat Kohli", "ravi-shastri", "captain_coach_synergy", 88, "Long India captain and head coach partnership.", "https://www.bcci.tv/news/article/most-challenging-satisfying-job-ive-had-shastri"),
  playerStaff("Sunil Narine", "gautam-gambhir", "former_teammates", 86, "Former Kolkata teammates; Gambhir backed Narine as an opener.", "https://www.iplt20.com/news/article/need-to-take-batting-tips-from-narine-gambhir"),
  playerStaff("Rinku Singh", "gautam-gambhir", "coached", 80, "Gambhir mentored Kolkata during Rinku's tenure.", "https://www.iplt20.com/teams/kolkata-knight-riders"),

  // --- Added Player-Staff Captain-Coach Synergy ---
  playerStaff("Pat Cummins", "daniel-vettori", "captain_coach_synergy", 92, "Highly successful captain and head coach partnership that took Sunrisers Hyderabad to the 2024 final.", "https://www.sunrisershyderabad.in/"),
  playerStaff("Shreyas Iyer", "chandrakant-pandit", "captain_coach_synergy", 88, "Captain and head coach pairing that delivered Kolkata Knight Riders the 2024 IPL trophy.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerStaff("KL Rahul", "justin-langer", "captain_coach_synergy", 82, "Captain and head coach leadership trust at Lucknow Super Giants.", "https://www.lucknowsupergiants.in/"),
  playerStaff("Sanju Samson", "rahul-dravid", "captain_coach_synergy", 90, "Samson reunites with Dravid at Rajasthan Royals after Dravid originally drafted and nurtured him.", "https://www.rajasthanroyals.com/"),
  playerStaff("Ruturaj Gaikwad", "dwayne-bravo", "captain_coach_synergy", 83, "Gaikwad leads CSK on field with Bravo managing bowling plans in the dugout.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerStaff("Axar Patel", "ricky-ponting", "captain_coach_synergy", 84, "Ponting elevated Axar to vice-captain and strategic sounding board at Delhi Capitals.", "https://www.delhicapitals.in/"),

  // --- Added Player-Staff Specialist Tutelage ---
  playerStaff("Varun Chakravarthy", "carl-crowe", "specialist_tutelage", 90, "Crowe worked intensively with Chakravarthy on grip variations, revolutions, and release points.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerStaff("Sunil Narine", "carl-crowe", "specialist_tutelage", 95, "Crowe remodelled Narine's bowling action and remains his personal bowling coach.", "https://www.espncricinfo.com/"),
  playerStaff("Matheesha Pathirana", "dwayne-bravo", "specialist_tutelage", 92, "Bravo closely coached Pathirana in the art of the slower ball, dipping yorker, and death bowling craft.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerStaff("Tushar Deshpande", "dwayne-bravo", "specialist_tutelage", 85, "Bravo coached Deshpande through death-over mechanics during CSK title campaigns.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerStaff("Mukesh Choudhary", "eric-simons", "specialist_tutelage", 82, "Simons mentored Choudhary's swing bowling craft and wrist position at CSK.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerStaff("Ravi Bishnoi", "anil-kumble", "specialist_tutelage", 91, "Kumble scouted Bishnoi and personally coached his unique googly trajectory and fast-arm action.", "https://www.punjabkingsipl.in/"),
  playerStaff("Arshdeep Singh", "bharat-arun", "specialist_tutelage", 84, "Arun worked with Arshdeep on yorker angles and seam presentation in national camps.", "https://www.bcci.tv/"),
  playerStaff("Kuldeep Yadav", "sairaj-bahutule", "specialist_tutelage", 83, "Bahutule worked with Kuldeep on release speed and flight mechanics.", "https://www.bcci.tv/"),
  playerStaff("Harshit Rana", "bharat-arun", "specialist_tutelage", 88, "Arun shaped Harshit Rana's bowling trajectory, bouncers and slower-ball variations at KKR.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerStaff("Vaibhav Arora", "bharat-arun", "specialist_tutelage", 83, "Arun developed Arora's two-way swing movement with the new ball at KKR.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerStaff("Mohsin Khan", "morne-morkel", "specialist_tutelage", 86, "Morkel coached Mohsin Khan's tall release and back-of-a-length bounce at LSG.", "https://www.lucknowsupergiants.in/"),
  playerStaff("Mayank Yadav", "morne-morkel", "specialist_tutelage", 87, "Morkel worked with the express pacer on runup rhythm and explosive seam release at LSG.", "https://www.lucknowsupergiants.in/"),
  playerStaff("Yashasvi Jaiswal", "vikram-rathour", "specialist_tutelage", 89, "Rathour coached Jaiswal's Test and T20 batting transitions for India and at RR.", "https://www.rajasthanroyals.com/"),
  playerStaff("Shubman Gill", "vikram-rathour", "specialist_tutelage", 88, "Rathour worked on Gill's weight transfer and back-foot defence across national squads.", "https://www.bcci.tv/"),
  playerStaff("Dhruv Jurel", "vikram-rathour", "specialist_tutelage", 84, "Rathour guided Jurel through his sensational India Test debut and batting development at RR.", "https://www.rajasthanroyals.com/"),
  playerStaff("Rajat Patidar", "dinesh-karthik", "specialist_tutelage", 83, "Karthik mentors Patidar on high-pressure tactical approach and spin execution at RCB.", "https://www.royalchallengers.com/"),
  playerStaff("Ruturaj Gaikwad", "michael-hussey", "specialist_tutelage", 91, "Hussey worked extensively with Gaikwad on tempo building and opening craft at CSK.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerStaff("Devon Conway", "michael-hussey", "specialist_tutelage", 86, "Hussey and Conway share detailed tactical preparation on subcontinental pitches at CSK.", "https://www.iplt20.com/teams/chennai-super-kings"),

  // --- Added Player-Staff Talent Champion ---
  playerStaff("Rohit Sharma", "ricky-ponting", "talent_champion", 92, "Ponting famously handed over Mumbai Indians captaincy to Rohit in 2013, launching MI's golden era.", "https://www.mumbaiindians.com/"),
  playerStaff("Rinku Singh", "abhishek-nayar", "talent_champion", 95, "Nayar transformed Rinku's career at the KKR Academy, backing him through years of injuries.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerStaff("Varun Chakravarthy", "abhishek-nayar", "talent_champion", 88, "Nayar advocated heavily for Chakravarthy's KKR recruitment and tactical role.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerStaff("Angkrish Raghuvanshi", "abhishek-nayar", "talent_champion", 91, "Nayar has personally coached and championed Raghuvanshi from childhood in Mumbai.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  playerStaff("Sanju Samson", "rahul-dravid", "talent_champion", 94, "Dravid scouted Samson at Rajasthan Royals trials in 2013 and gave him his IPL debut.", "https://www.rajasthanroyals.com/"),
  playerStaff("Karun Nair", "rahul-dravid", "talent_champion", 88, "Dravid championed Nair across Rajasthan Royals and India A setups.", "https://www.bcci.tv/"),
  playerStaff("Rishabh Pant", "rahul-dravid", "talent_champion", 89, "Dravid developed and backed Pant through the 2016 U19 World Cup and Delhi Daredevils.", "https://www.bcci.tv/"),
  playerStaff("Ishan Kishan", "rahul-dravid", "talent_champion", 87, "Dravid captained Kishan's development as India U19 head coach in 2016.", "https://www.bcci.tv/"),
  playerStaff("Washington Sundar", "rahul-dravid", "talent_champion", 85, "Dravid nurtured Sundar's early career in the India pathway system.", "https://www.bcci.tv/"),
  playerStaff("Ayush Badoni", "gautam-gambhir", "talent_champion", 90, "Gambhir scouted Badoni, backed him at the auction and gave him immediate finishing responsibility at LSG.", "https://www.lucknowsupergiants.in/"),
  playerStaff("Mayank Yadav", "gautam-gambhir", "talent_champion", 88, "Gambhir scouted the raw pace sensation and brought him to Lucknow Super Giants.", "https://www.lucknowsupergiants.in/"),
  playerStaff("Harshit Rana", "gautam-gambhir", "talent_champion", 92, "Gambhir backed Harshit's fiery temperament and promoted him to frontline death bowler at KKR and India.", "https://www.iplt20.com/teams/kolkata-knight-riders"),

  // --- Added Player-Staff Former Teammates ---
  playerStaff("Rohit Sharma", "kieron-pollard", "former_teammates", 93, "Legendary teammates who won five IPL titles together before Pollard transitioned to batting coach.", "https://www.mumbaiindians.com/"),
  playerStaff("Jasprit Bumrah", "kieron-pollard", "former_teammates", 88, "Longtime Mumbai Indians teammates across multiple trophy-winning campaigns.", "https://www.mumbaiindians.com/"),
  playerStaff("Suryakumar Yadav", "kieron-pollard", "former_teammates", 86, "Shared the Mumbai Indians middle order during championship-winning seasons.", "https://www.mumbaiindians.com/"),
  playerStaff("Hardik Pandya", "kieron-pollard", "former_teammates", 91, "Famous finishing brothers-in-arms for Mumbai Indians over numerous seasons.", "https://www.mumbaiindians.com/"),
  playerStaff("MS Dhoni", "dwayne-bravo", "former_teammates", 96, "Dhoni and Bravo shared over a decade of CSK brotherhood before Bravo joined the coaching staff.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerStaff("Ravindra Jadeja", "dwayne-bravo", "former_teammates", 92, "CSK's legendary all-round engine room for multiple title-winning campaigns.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerStaff("Ruturaj Gaikwad", "michael-hussey", "former_teammates", 78, "Teammates in CSK squad before Hussey focused full-time on coaching Gaikwad.", "https://www.iplt20.com/teams/chennai-super-kings"),
  playerStaff("Virat Kohli", "dinesh-karthik", "former_teammates", 92, "Longtime India and RCB teammates before Karthik became RCB's batting coach.", "https://www.royalchallengers.com/"),
  playerStaff("Mohammed Siraj", "dinesh-karthik", "former_teammates", 84, "Played together for multiple seasons at Royal Challengers Bengaluru.", "https://www.royalchallengers.com/"),
  playerStaff("Shubman Gill", "matthew-wade", "former_teammates", 83, "Gujarat Titans teammates in the 2022 title-winning squad.", "https://www.gujarattitansipl.com/"),
  playerStaff("Rashid Khan", "matthew-wade", "former_teammates", 82, "Shared the Gujarat Titans dugout during their championship run.", "https://www.gujarattitansipl.com/"),
  staffPair("dwayne-bravo", "andre-russell", "trusted_colleague", 88, "West Indies T20 World Cup champions and close Caribbean coaching compatriots.", "https://www.windiescricket.com/"),
  playerStaff("Sunil Narine", "dwayne-bravo", "former_teammates", 87, "Longtime West Indies international teammates and Caribbean premier league competitors.", "https://www.windiescricket.com/"),
  playerStaff("Nicholas Pooran", "kieron-pollard", "former_teammates", 89, "Pooran succeeded Pollard as West Indies white-ball captain and shares close mentorship.", "https://www.windiescricket.com/"),
  playerStaff("Shimron Hetmyer", "kieron-pollard", "former_teammates", 83, "West Indies international middle-order teammates.", "https://www.windiescricket.com/"),

  // --- Added Player-Staff Coached By / Mentored ---
  playerStaff("Rohit Sharma", "gautam-gambhir", "coached", 88, "Gambhir took over as India head coach with Rohit as his senior captain.", "https://www.bcci.tv/"),
  playerStaff("Virat Kohli", "gautam-gambhir", "coached", 86, "Longstanding Delhi cricket connection and senior player under Gambhir's India coaching tenure.", "https://www.bcci.tv/"),
  playerStaff("Rohit Sharma", "rahul-dravid", "coached", 94, "Captain and coach partnership that reached the 2023 ODI World Cup final and won the 2024 T20 World Cup.", "https://www.bcci.tv/"),
  playerStaff("Virat Kohli", "rahul-dravid", "coached", 90, "Shared leadership during Dravid's India head coach era.", "https://www.bcci.tv/"),
  playerStaff("Travis Head", "daniel-vettori", "coached", 87, "Vettori coached Head's devastating attacking game at Sunrisers Hyderabad.", "https://www.sunrisershyderabad.in/"),
  playerStaff("Heinrich Klaasen", "daniel-vettori", "coached", 86, "Vettori's SRH tactical setup gave Klaasen complete freedom against spin.", "https://www.sunrisershyderabad.in/"),
  playerStaff("Prithvi Shaw", "ricky-ponting", "coached", 84, "Ponting passionately worked with Shaw on batting trigger movements and off-field discipline at DC.", "https://www.delhicapitals.in/"),
  playerStaff("Arshdeep Singh", "ricky-ponting", "coached", 82, "Ponting leads Punjab Kings with Arshdeep as his frontline pace attack spearhead.", "https://www.punjabkingsipl.in/"),
  playerStaff("Sam Curran", "trevor-bayliss", "coached", 85, "Bayliss coached Curran across England national duties and Punjab Kings.", "https://www.ecb.co.uk/"),
  playerStaff("Liam Livingstone", "trevor-bayliss", "coached", 82, "Bayliss entrusted Livingstone with key middle-order batting duties at PBKS.", "https://www.punjabkingsipl.in/"),
  playerStaff("Jos Buttler", "trevor-bayliss", "coached", 90, "Bayliss built England's transformative white-ball batting philosophy around Buttler.", "https://www.ecb.co.uk/"),
  playerStaff("Harry Brook", "brendon-mccullum", "coached", 92, "McCullum shaped Brook's ultra-fearless batting style across England setups.", "https://www.ecb.co.uk/"),
  playerStaff("Phil Salt", "brendon-mccullum", "coached", 85, "McCullum backs Salt's attacking aggression as England white-ball coach.", "https://www.ecb.co.uk/"),

  // --- Original 23 Staff-Staff Relationships ---
  ...STAFF_RELATIONSHIP_SEEDS.map((seed): PersonDynamicsSeed => staffPair(
    seed.headCoachSlug,
    seed.staffSlug,
    seed.type === "essential_staff" ? "inner_circle_assistant" : seed.type === "preferred_assistant" ? "trusted_colleague" : seed.type,
    seed.strength,
    seed.evidence,
    seed.sourceUrl,
  )),
  staffPair("brendon-mccullum", "marcus-trescothick", "trusted_colleague", 80, "England senior coaching overlap.", "https://www.ecb.co.uk/news/4106595/ecb-announces-brendon-mccullum-as-england-mens-whiteball-head-coach"),
  staffPair("ashish-nehra", "parthiv-patel", "trusted_colleague", 76, "Gujarat Titans head coach and assistant coach partnership.", "https://www.gujarattitansipl.com/news/parthiv-patel-joins-gujarat-titans-as-assistant-coach-for-tata-ipl-2025"),
  staffPair("ravi-shastri", "bharat-arun", "trusted_colleague", 88, "Long India head coach and bowling coach partnership.", "https://www.bcci.tv/news/article/the-boys-have-become-men-ravi-shastri"),
  staffPair("andy-flower", "dinesh-karthik", "trusted_colleague", 80, "Bengaluru head coach and batting coach partnership.", "https://www.royalchallengers.com/rcb-cricket-news/news/ive-really-enjoyed-watching-andy-mo-bobat-on-the-dressing-room-atmosphere"),

  // --- Added Staff-Staff Trusted Colleagues ---
  staffPair("gautam-gambhir", "abhishek-nayar", "trusted_colleague", 95, "Architects of KKR's 2024 championship who joined forces again in the Indian national coaching setup.", "https://www.bcci.tv/"),
  staffPair("daniel-vettori", "james-franklin", "trusted_colleague", 85, "Vettori and Franklin work closely as head coach and bowling coach at Sunrisers Hyderabad.", "https://www.sunrisershyderabad.in/"),
  staffPair("daniel-vettori", "muttiah-muralitharan", "trusted_colleague", 87, "Vettori and Muralitharan direct Sunrisers Hyderabad's tactical bowling plans.", "https://www.sunrisershyderabad.in/"),
  staffPair("chandrakant-pandit", "bharat-arun", "trusted_colleague", 88, "Head coach and bowling coach partnership that delivered the 2024 IPL title for KKR.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  staffPair("chandrakant-pandit", "abhishek-nayar", "trusted_colleague", 86, "Pandit and Nayar formed the Indian domestic coaching brain trust at Kolkata Knight Riders.", "https://www.iplt20.com/teams/kolkata-knight-riders"),
  staffPair("justin-langer", "lance-klusener", "trusted_colleague", 84, "Langer and Klusener formed the head coach and assistant coach setup at Lucknow Super Giants.", "https://www.lucknowsupergiants.in/"),
  staffPair("stephen-fleming", "dwayne-bravo", "trusted_colleague", 92, "Fleming brought Bravo directly onto his CSK coaching staff upon Bravo's IPL retirement.", "https://www.iplt20.com/teams/chennai-super-kings"),
  staffPair("ashish-nehra", "aashish-kapoor", "trusted_colleague", 82, "Foundational members of Gujarat Titans' inaugural coaching and scouting staff.", "https://www.gujarattitansipl.com/"),
  staffPair("ashish-nehra", "naeem-amin", "trusted_colleague", 84, "Longstanding tactical and fielding collaboration within Gujarat Titans dugout.", "https://www.gujarattitansipl.com/"),
  staffPair("ashish-nehra", "narender-negi", "trusted_colleague", 82, "Part of Gujarat Titans' trusted core backroom team.", "https://www.gujarattitansipl.com/"),
  staffPair("mahela-jayawardene", "shane-bond", "trusted_colleague", 90, "Head coach and bowling coach partnership across multiple Mumbai Indians championship seasons.", "https://www.mumbaiindians.com/"),
  staffPair("mahela-jayawardene", "kumar-sangakkara", "trusted_colleague", 96, "Legendary Sri Lankan leadership duo who co-captained and shaped modern Sri Lankan cricket.", "https://www.srilankacricket.lk/"),
  staffPair("rahul-dravid", "kumar-sangakkara", "trusted_colleague", 88, "Senior cricket leadership peers who collaborated closely on Rajasthan Royals' strategic blueprint.", "https://www.rajasthanroyals.com/"),
  staffPair("gautam-gambhir", "sitanshu-kotak", "trusted_colleague", 85, "Kotak serves as key batting support and India A bridge in Gambhir's national coaching regime.", "https://www.bcci.tv/"),
  staffPair("andy-flower", "richard-halsall", "trusted_colleague", 88, "Halsall was Flower's trusted fielding coach during England's world number one era.", "https://www.ecb.co.uk/"),
  staffPair("ricky-ponting", "sairaj-bahutule", "trusted_colleague", 80, "Ponting brought Bahutule into Punjab Kings as his lead spin bowling coach.", "https://www.punjabkingsipl.in/"),
  staffPair("ricky-ponting", "matthew-wade", "trusted_colleague", 83, "Ponting selected Wade as assistant/wicketkeeping coach in his new Punjab Kings structure.", "https://www.punjabkingsipl.in/"),
  staffPair("sourav-ganguly", "ricky-ponting", "trusted_colleague", 91, "Director of Cricket and Head Coach brain trust at Delhi Capitals across five seasons.", "https://www.delhicapitals.in/"),
  staffPair("sourav-ganguly", "pravin-amre", "trusted_colleague", 85, "Delhi Capitals cricket operations and batting leadership colleagues.", "https://www.delhicapitals.in/"),

  // --- Original 2 One-Way Idols ---
  { category: "player_staff", type: "idol", person1: "Jasprit Bumrah", person2: "lasith-malinga", rating: 92, reason: "Mumbai Indians records Malinga as one of Bumrah's early idols.", evidenceUrl: "https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Jasprit Bumrah", person2: "zaheer-khan", rating: 84, reason: "Mumbai Indians records Zaheer as one of Bumrah's early idols.", evidenceUrl: "https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling", bidirectional: false },

  // --- Added One-Way Idols ---
  { category: "player_staff", type: "idol", person1: "Ruturaj Gaikwad", person2: "ms-dhoni", rating: 95, reason: "Gaikwad has frequently named MS Dhoni as his cricket hero and calm leadership model.", evidenceUrl: "https://www.iplt20.com/news/article/ruturaj-gaikwad-takes-over-chennai-super-kings-captaincy-from-ms-dhoni", bidirectional: false },
  { category: "player_player", type: "idol", person1: "Yashasvi Jaiswal", person2: "Virat Kohli", rating: 94, reason: "Jaiswal publicly stated Kohli is his ultimate batting idol and fitness benchmark.", evidenceUrl: "https://www.bcci.tv/", bidirectional: false },
  { category: "player_player", type: "idol", person1: "Shubman Gill", person2: "Virat Kohli", rating: 93, reason: "Gill has idolized Kohli since childhood, wearing #77 and modelling his intensity on him.", evidenceUrl: "https://www.bcci.tv/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Rinku Singh", person2: "suresh-raina", rating: 92, reason: "Rinku idolises UP legend Suresh Raina as his batting and fielding role model.", evidenceUrl: "https://www.bcci.tv/", bidirectional: false },
  { category: "player_player", type: "idol", person1: "Riyan Parag", person2: "Virat Kohli", rating: 93, reason: "Parag has consistently described Kohli as his idol and batting inspiration.", evidenceUrl: "https://www.rajasthanroyals.com/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Tilak Varma", person2: "suresh-raina", rating: 90, reason: "Tilak grew up idolising fellow left-hander and middle-order stalwart Suresh Raina.", evidenceUrl: "https://www.mumbaiindians.com/", bidirectional: false },
  { category: "player_player", type: "idol", person1: "Nitish Kumar Reddy", person2: "Virat Kohli", rating: 91, reason: "Nitish Reddy has named Kohli as his idol for game awareness and fitness.", evidenceUrl: "https://www.sunrisershyderabad.in/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Rohit Sharma", person2: "sachin-tendulkar", rating: 96, reason: "Rohit grew up worshiping Sachin Tendulkar before playing alongside him for Mumbai and India.", evidenceUrl: "https://www.mumbaiindians.com/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Virat Kohli", person2: "sachin-tendulkar", rating: 98, reason: "Kohli famously stated Tendulkar was the sole reason he picked up a cricket bat.", evidenceUrl: "https://www.bcci.tv/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Sanju Samson", person2: "rahul-dravid", rating: 92, reason: "Samson has frequently hailed Rahul Dravid as his lifelong idol and guiding light.", evidenceUrl: "https://www.rajasthanroyals.com/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Dhruv Jurel", person2: "ms-dhoni", rating: 93, reason: "Jurel considers MS Dhoni his wicketkeeping and finishing idol.", evidenceUrl: "https://www.rajasthanroyals.com/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Ishan Kishan", person2: "ms-dhoni", rating: 92, reason: "Hailing from Jharkhand, Kishan grew up modeling his wicketkeeping on MS Dhoni.", evidenceUrl: "https://www.mumbaiindians.com/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Rishabh Pant", person2: "ms-dhoni", rating: 94, reason: "Pant shares a deep bond with Dhoni, looking up to him as his elder brother and hero.", evidenceUrl: "https://www.bcci.tv/", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Mayank Yadav", person2: "dale-steyn", rating: 94, reason: "Mayank Yadav grew up watching Dale Steyn videos and modeled his fast bowling after him.", evidenceUrl: "https://www.lucknowsupergiants.in/", bidirectional: false },
];
