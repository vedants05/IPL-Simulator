export interface LeagueHistoryStanding {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  noResults: number;
  points: number;
  nrr: number;
}

export interface LeagueHistoryHonour {
  name: string;
  teamId: string;
}

export interface LeagueHistorySeason {
  season: number;
  championTeamId: string;
  runnerUpTeamId: string;
  orangeCap: LeagueHistoryHonour;
  purpleCap: LeagueHistoryHonour;
  source: "historical" | "career";
  standings?: LeagueHistoryStanding[];
}

export interface LeagueHistoryTeam {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
}

const team = (id: string, name: string, shortName: string, primaryColor: string, secondaryColor = "#ffffff"): LeagueHistoryTeam => ({
  id,
  name,
  shortName,
  primaryColor,
  secondaryColor,
});

export const LEAGUE_HISTORY_TEAMS: Record<string, LeagueHistoryTeam> = {
  CSK: team("CSK", "Chennai Super Kings", "CSK", "#f9cd05", "#16130f"),
  MI: team("MI", "Mumbai Indians", "MI", "#004ba0"),
  KKR: team("KKR", "Kolkata Knight Riders", "KKR", "#3a225d", "#f5c842"),
  RCB: team("RCB", "Royal Challengers Bengaluru", "RCB", "#d71920"),
  SRH: team("SRH", "Sunrisers Hyderabad", "SRH", "#f26522", "#16130f"),
  RR: team("RR", "Rajasthan Royals", "RR", "#ea1a85"),
  DC: team("DC", "Delhi Capitals", "DC", "#17479e"),
  DD: team("DD", "Delhi Daredevils", "DD", "#17479e"),
  PBKS: team("PBKS", "Punjab Kings", "PBKS", "#dd1f2d"),
  KXIP: team("KXIP", "Kings XI Punjab", "KXIP", "#dd1f2d"),
  GT: team("GT", "Gujarat Titans", "GT", "#1b2133", "#e5b842"),
  LSG: team("LSG", "Lucknow Super Giants", "LSG", "#00a0e3", "#16130f"),
  DCG: team("DCG", "Deccan Chargers", "DCG", "#005fae"),
  RPS: team("RPS", "Rising Pune Supergiant", "RPS", "#d11d74"),
  GL: team("GL", "Gujarat Lions", "GL", "#f36f21", "#16130f"),
  KTK: team("KTK", "Kochi Tuskers Kerala", "KTK", "#7c3a93", "#f4c542"),
  PWI: team("PWI", "Pune Warriors India", "PWI", "#1f5fa8"),
};

export const HISTORICAL_LEAGUE_HISTORY: LeagueHistorySeason[] = [
  { season: 2026, championTeamId: "RCB", runnerUpTeamId: "GT", orangeCap: { name: "Vaibhav Suryavanshi", teamId: "RR" }, purpleCap: { name: "Kagiso Rabada", teamId: "GT" }, source: "historical" },
  { season: 2025, championTeamId: "RCB", runnerUpTeamId: "PBKS", orangeCap: { name: "Sai Sudharsan", teamId: "GT" }, purpleCap: { name: "Prasidh Krishna", teamId: "GT" }, source: "historical" },
  { season: 2024, championTeamId: "KKR", runnerUpTeamId: "SRH", orangeCap: { name: "Virat Kohli", teamId: "RCB" }, purpleCap: { name: "Harshal Patel", teamId: "PBKS" }, source: "historical" },
  { season: 2023, championTeamId: "CSK", runnerUpTeamId: "GT", orangeCap: { name: "Shubman Gill", teamId: "GT" }, purpleCap: { name: "Mohammed Shami", teamId: "GT" }, source: "historical" },
  { season: 2022, championTeamId: "GT", runnerUpTeamId: "RR", orangeCap: { name: "Jos Buttler", teamId: "RR" }, purpleCap: { name: "Yuzvendra Chahal", teamId: "RR" }, source: "historical" },
  { season: 2021, championTeamId: "CSK", runnerUpTeamId: "KKR", orangeCap: { name: "Ruturaj Gaikwad", teamId: "CSK" }, purpleCap: { name: "Harshal Patel", teamId: "RCB" }, source: "historical" },
  { season: 2020, championTeamId: "MI", runnerUpTeamId: "DC", orangeCap: { name: "KL Rahul", teamId: "KXIP" }, purpleCap: { name: "Kagiso Rabada", teamId: "DC" }, source: "historical" },
  { season: 2019, championTeamId: "MI", runnerUpTeamId: "CSK", orangeCap: { name: "David Warner", teamId: "SRH" }, purpleCap: { name: "Imran Tahir", teamId: "CSK" }, source: "historical" },
  { season: 2018, championTeamId: "CSK", runnerUpTeamId: "SRH", orangeCap: { name: "Kane Williamson", teamId: "SRH" }, purpleCap: { name: "Andrew Tye", teamId: "KXIP" }, source: "historical" },
  { season: 2017, championTeamId: "MI", runnerUpTeamId: "RPS", orangeCap: { name: "David Warner", teamId: "SRH" }, purpleCap: { name: "Bhuvneshwar Kumar", teamId: "SRH" }, source: "historical" },
  { season: 2016, championTeamId: "SRH", runnerUpTeamId: "RCB", orangeCap: { name: "Virat Kohli", teamId: "RCB" }, purpleCap: { name: "Bhuvneshwar Kumar", teamId: "SRH" }, source: "historical" },
  { season: 2015, championTeamId: "MI", runnerUpTeamId: "CSK", orangeCap: { name: "David Warner", teamId: "SRH" }, purpleCap: { name: "Dwayne Bravo", teamId: "CSK" }, source: "historical" },
  { season: 2014, championTeamId: "KKR", runnerUpTeamId: "KXIP", orangeCap: { name: "Robin Uthappa", teamId: "KKR" }, purpleCap: { name: "Mohit Sharma", teamId: "CSK" }, source: "historical" },
  { season: 2013, championTeamId: "MI", runnerUpTeamId: "CSK", orangeCap: { name: "Michael Hussey", teamId: "CSK" }, purpleCap: { name: "Dwayne Bravo", teamId: "CSK" }, source: "historical" },
  { season: 2012, championTeamId: "KKR", runnerUpTeamId: "CSK", orangeCap: { name: "Chris Gayle", teamId: "RCB" }, purpleCap: { name: "Morne Morkel", teamId: "DD" }, source: "historical" },
  { season: 2011, championTeamId: "CSK", runnerUpTeamId: "RCB", orangeCap: { name: "Chris Gayle", teamId: "RCB" }, purpleCap: { name: "Lasith Malinga", teamId: "MI" }, source: "historical" },
  { season: 2010, championTeamId: "CSK", runnerUpTeamId: "MI", orangeCap: { name: "Sachin Tendulkar", teamId: "MI" }, purpleCap: { name: "Pragyan Ojha", teamId: "DCG" }, source: "historical" },
  { season: 2009, championTeamId: "DCG", runnerUpTeamId: "RCB", orangeCap: { name: "Matthew Hayden", teamId: "CSK" }, purpleCap: { name: "RP Singh", teamId: "DCG" }, source: "historical" },
  { season: 2008, championTeamId: "RR", runnerUpTeamId: "CSK", orangeCap: { name: "Shaun Marsh", teamId: "KXIP" }, purpleCap: { name: "Sohail Tanvir", teamId: "RR" }, source: "historical" },
];
