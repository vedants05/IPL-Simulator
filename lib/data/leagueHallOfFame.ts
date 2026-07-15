export type HallOfFameRole = "Batter" | "Wicketkeeper" | "All-rounder" | "Bowler";

export interface LeagueHallOfFameMember {
  name: string;
  role: HallOfFameRole;
  nationality: string;
  primaryTeamId: string;
  teamIds: string[];
  era: string;
  legacy: string;
  cornerstone?: boolean;
}

// The initial class is intentionally limited to the clearest first-ballot names.
// Borderline candidates can be reviewed and added without changing the page UI.
export const LEAGUE_HALL_OF_FAME: LeagueHallOfFameMember[] = [
  { name: "MS Dhoni", role: "Wicketkeeper", nationality: "India", primaryTeamId: "CSK", teamIds: ["CSK", "RPS"], era: "2008–present", legacy: "The benchmark IPL captain, finisher and keeper.", cornerstone: true },
  { name: "Virat Kohli", role: "Batter", nationality: "India", primaryTeamId: "RCB", teamIds: ["RCB"], era: "2008–present", legacy: "The league's defining run-maker and one-club standard bearer.", cornerstone: true },
  { name: "Rohit Sharma", role: "Batter", nationality: "India", primaryTeamId: "MI", teamIds: ["DCG", "MI"], era: "2008–present", legacy: "A serial champion who built Mumbai's title dynasty.", cornerstone: true },
  { name: "AB de Villiers", role: "Batter", nationality: "South Africa", primaryTeamId: "RCB", teamIds: ["DD", "RCB"], era: "2008–2021", legacy: "The 360-degree match-winner who reimagined IPL batting." },
  { name: "Chris Gayle", role: "Batter", nationality: "West Indies", primaryTeamId: "RCB", teamIds: ["KKR", "RCB", "KXIP"], era: "2009–2021", legacy: "The league's most fearsome power hitter at his peak." },
  { name: "Suresh Raina", role: "Batter", nationality: "India", primaryTeamId: "CSK", teamIds: ["CSK", "RPS"], era: "2008–2021", legacy: "Mr IPL: relentless runs, fielding and playoff performances." },
  { name: "David Warner", role: "Batter", nationality: "Australia", primaryTeamId: "SRH", teamIds: ["DD", "SRH", "DC"], era: "2009–2024", legacy: "An elite opener, three-time Orange Cap winner and champion captain." },
  { name: "Shikhar Dhawan", role: "Batter", nationality: "India", primaryTeamId: "SRH", teamIds: ["DD", "MI", "DCG", "SRH", "DC", "PBKS"], era: "2008–2024", legacy: "A model of top-order consistency across the league's eras." },
  { name: "Gautam Gambhir", role: "Batter", nationality: "India", primaryTeamId: "KKR", teamIds: ["DD", "KKR"], era: "2008–2018", legacy: "The captain who transformed Kolkata into two-time champions." },
  { name: "Sachin Tendulkar", role: "Batter", nationality: "India", primaryTeamId: "MI", teamIds: ["MI"], era: "2008–2013", legacy: "Mumbai's original icon and the 2010 Orange Cap winner." },
  { name: "Adam Gilchrist", role: "Wicketkeeper", nationality: "Australia", primaryTeamId: "DCG", teamIds: ["DCG", "KXIP"], era: "2008–2013", legacy: "Explosive keeper-opener and captain of the 2009 champions." },
  { name: "Kieron Pollard", role: "All-rounder", nationality: "West Indies", primaryTeamId: "MI", teamIds: ["MI"], era: "2010–2022", legacy: "Mumbai's ultimate big-game finisher and dynasty constant." },
  { name: "Dwayne Bravo", role: "All-rounder", nationality: "West Indies", primaryTeamId: "CSK", teamIds: ["MI", "CSK", "GL"], era: "2008–2022", legacy: "A championship all-rounder who mastered the death overs." },
  { name: "Sunil Narine", role: "All-rounder", nationality: "West Indies", primaryTeamId: "KKR", teamIds: ["KKR"], era: "2012–present", legacy: "A mystery-spin great who evolved into a devastating opener.", cornerstone: true },
  { name: "Andre Russell", role: "All-rounder", nationality: "West Indies", primaryTeamId: "KKR", teamIds: ["DD", "KKR"], era: "2012–2026", legacy: "The league's defining high-impact power all-rounder." },
  { name: "Ravindra Jadeja", role: "All-rounder", nationality: "India", primaryTeamId: "CSK", teamIds: ["RR", "KTK", "CSK", "GL"], era: "2008–present", legacy: "An elite three-discipline match-winner at the heart of champions." },
  { name: "Shane Watson", role: "All-rounder", nationality: "Australia", primaryTeamId: "RR", teamIds: ["RR", "RCB", "CSK"], era: "2008–2020", legacy: "The inaugural MVP and one of the league's great final performers." },
  { name: "Hardik Pandya", role: "All-rounder", nationality: "India", primaryTeamId: "MI", teamIds: ["MI", "GT"], era: "2015–present", legacy: "A multi-title all-rounder and championship-winning captain." },
  { name: "Lasith Malinga", role: "Bowler", nationality: "Sri Lanka", primaryTeamId: "MI", teamIds: ["MI"], era: "2009–2019", legacy: "The yorker master who set the standard for IPL fast bowling." },
  { name: "Jasprit Bumrah", role: "Bowler", nationality: "India", primaryTeamId: "MI", teamIds: ["MI"], era: "2013–present", legacy: "The modern gold standard for pace, control and pressure overs." },
  { name: "Yuzvendra Chahal", role: "Bowler", nationality: "India", primaryTeamId: "RCB", teamIds: ["MI", "RCB", "RR", "PBKS"], era: "2013–present", legacy: "The league's landmark wicket-taking leg-spinner." },
  { name: "Bhuvneshwar Kumar", role: "Bowler", nationality: "India", primaryTeamId: "SRH", teamIds: ["PWI", "SRH", "RCB"], era: "2011–present", legacy: "A two-time Purple Cap winner with new-ball and death-over mastery." },
  { name: "Ravichandran Ashwin", role: "Bowler", nationality: "India", primaryTeamId: "CSK", teamIds: ["CSK", "RPS", "KXIP", "DC", "RR"], era: "2009–2026", legacy: "A tactical spin innovator with enduring championship influence." },
  { name: "Shane Warne", role: "Bowler", nationality: "Australia", primaryTeamId: "RR", teamIds: ["RR"], era: "2008–2011", legacy: "The inspirational captain who made the inaugural champions believe." },
];
