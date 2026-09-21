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

  { category: "player_staff", type: "idol", person1: "Jasprit Bumrah", person2: "lasith-malinga", rating: 92, reason: "Mumbai Indians records Malinga as one of Bumrah's early idols.", evidenceUrl: "https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling", bidirectional: false },
  { category: "player_staff", type: "idol", person1: "Jasprit Bumrah", person2: "zaheer-khan", rating: 84, reason: "Mumbai Indians records Zaheer as one of Bumrah's early idols.", evidenceUrl: "https://www.mumbaiindians.com/amp/news/jasprit-bumrah-blue-blood-death-bowling", bidirectional: false },
];
