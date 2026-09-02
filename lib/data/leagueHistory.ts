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
  emergingPlayer?: LeagueHistoryHonour;
  mvp?: LeagueHistoryHonour;
  source: "historical" | "career";
  standings?: LeagueHistoryStanding[];
  teamOutcomes?: Record<string, LeagueHistoryTeamOutcome>;
}

export type LeagueHistoryPlayoffOutcome = "champion" | "runner-up" | "semi-final" | "eliminator" | "qualifier-2";

export interface LeagueHistoryTeamOutcome {
  leaguePosition: number;
  playoffOutcome?: LeagueHistoryPlayoffOutcome;
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
  CSK: team("CSK", "Chennai Super Kings", "CSK", "#f9cd05", "#0055a5"),
  MI: team("MI", "Mumbai Indians", "MI", "#004ba0"),
  KKR: team("KKR", "Kolkata Knight Riders", "KKR", "#3a225d", "#f5c842"),
  RCB: team("RCB", "Royal Challengers Bengaluru", "RCB", "#d71920"),
  SRH: team("SRH", "Sunrisers Hyderabad", "SRH", "#f26522", "#e5b842"),
  RR: team("RR", "Rajasthan Royals", "RR", "#ea1a85", "#0057e2"),
  DC: team("DC", "Delhi Capitals", "DC", "#17479e", "#ef4123"),
  DD: team("DD", "Delhi Daredevils", "DD", "#17479e", "#ef4123"),
  PBKS: team("PBKS", "Punjab Kings", "PBKS", "#dd1f2d", "#ffffff"),
  KXIP: team("KXIP", "Kings XI Punjab", "KXIP", "#dd1f2d", "#ffffff"),
  GT: team("GT", "Gujarat Titans", "GT", "#1b2133", "#e5b842"),
  LSG: team("LSG", "Lucknow Super Giants", "LSG", "#e21f26", "#0057e2"),
  DCG: team("DCG", "Deccan Chargers", "DCG", "#005fae"),
  RPS: team("RPS", "Rising Pune Supergiant", "RPS", "#d11d74"),
  GL: team("GL", "Gujarat Lions", "GL", "#f36f21", "#16130f"),
  KTK: team("KTK", "Kochi Tuskers Kerala", "KTK", "#7c3a93", "#f4c542"),
  PWI: team("PWI", "Pune Warriors India", "PWI", "#1f5fa8"),
};

const HISTORICAL_LEAGUE_HISTORY_BASE: LeagueHistorySeason[] = [
  { season: 2026, championTeamId: "RCB", runnerUpTeamId: "GT", orangeCap: { name: "Vaibhav Suryavanshi", teamId: "RR" }, purpleCap: { name: "Kagiso Rabada", teamId: "GT" }, emergingPlayer: { name: "Vaibhav Suryavanshi", teamId: "RR" }, mvp: { name: "Vaibhav Suryavanshi", teamId: "RR" }, source: "historical" },
  { season: 2025, championTeamId: "RCB", runnerUpTeamId: "PBKS", orangeCap: { name: "Sai Sudharsan", teamId: "GT" }, purpleCap: { name: "Prasidh Krishna", teamId: "GT" }, emergingPlayer: { name: "Sai Sudharsan", teamId: "GT" }, mvp: { name: "Suryakumar Yadav", teamId: "MI" }, source: "historical" },
  { season: 2024, championTeamId: "KKR", runnerUpTeamId: "SRH", orangeCap: { name: "Virat Kohli", teamId: "RCB" }, purpleCap: { name: "Harshal Patel", teamId: "PBKS" }, emergingPlayer: { name: "Nitish Kumar Reddy", teamId: "SRH" }, mvp: { name: "Sunil Narine", teamId: "KKR" }, source: "historical" },
  { season: 2023, championTeamId: "CSK", runnerUpTeamId: "GT", orangeCap: { name: "Shubman Gill", teamId: "GT" }, purpleCap: { name: "Mohammed Shami", teamId: "GT" }, emergingPlayer: { name: "Yashasvi Jaiswal", teamId: "RR" }, mvp: { name: "Shubman Gill", teamId: "GT" }, source: "historical" },
  { season: 2022, championTeamId: "GT", runnerUpTeamId: "RR", orangeCap: { name: "Jos Buttler", teamId: "RR" }, purpleCap: { name: "Yuzvendra Chahal", teamId: "RR" }, emergingPlayer: { name: "Umran Malik", teamId: "SRH" }, mvp: { name: "Jos Buttler", teamId: "RR" }, source: "historical" },
  { season: 2021, championTeamId: "CSK", runnerUpTeamId: "KKR", orangeCap: { name: "Ruturaj Gaikwad", teamId: "CSK" }, purpleCap: { name: "Harshal Patel", teamId: "RCB" }, emergingPlayer: { name: "Ruturaj Gaikwad", teamId: "CSK" }, mvp: { name: "Harshal Patel", teamId: "RCB" }, source: "historical" },
  { season: 2020, championTeamId: "MI", runnerUpTeamId: "DC", orangeCap: { name: "KL Rahul", teamId: "KXIP" }, purpleCap: { name: "Kagiso Rabada", teamId: "DC" }, emergingPlayer: { name: "Devdutt Padikkal", teamId: "RCB" }, mvp: { name: "Jofra Archer", teamId: "RR" }, source: "historical" },
  { season: 2019, championTeamId: "MI", runnerUpTeamId: "CSK", orangeCap: { name: "David Warner", teamId: "SRH" }, purpleCap: { name: "Imran Tahir", teamId: "CSK" }, emergingPlayer: { name: "Shubman Gill", teamId: "KKR" }, mvp: { name: "Andre Russell", teamId: "KKR" }, source: "historical" },
  { season: 2018, championTeamId: "CSK", runnerUpTeamId: "SRH", orangeCap: { name: "Kane Williamson", teamId: "SRH" }, purpleCap: { name: "Andrew Tye", teamId: "KXIP" }, emergingPlayer: { name: "Rishabh Pant", teamId: "DD" }, mvp: { name: "Sunil Narine", teamId: "KKR" }, source: "historical" },
  { season: 2017, championTeamId: "MI", runnerUpTeamId: "RPS", orangeCap: { name: "David Warner", teamId: "SRH" }, purpleCap: { name: "Bhuvneshwar Kumar", teamId: "SRH" }, emergingPlayer: { name: "Basil Thampi", teamId: "GL" }, mvp: { name: "Ben Stokes", teamId: "RPS" }, source: "historical" },
  { season: 2016, championTeamId: "SRH", runnerUpTeamId: "RCB", orangeCap: { name: "Virat Kohli", teamId: "RCB" }, purpleCap: { name: "Bhuvneshwar Kumar", teamId: "SRH" }, emergingPlayer: { name: "Mustafizur Rahman", teamId: "SRH" }, mvp: { name: "Virat Kohli", teamId: "RCB" }, source: "historical" },
  { season: 2015, championTeamId: "MI", runnerUpTeamId: "CSK", orangeCap: { name: "David Warner", teamId: "SRH" }, purpleCap: { name: "Dwayne Bravo", teamId: "CSK" }, emergingPlayer: { name: "Shreyas Iyer", teamId: "DD" }, mvp: { name: "Andre Russell", teamId: "KKR" }, source: "historical" },
  { season: 2014, championTeamId: "KKR", runnerUpTeamId: "KXIP", orangeCap: { name: "Robin Uthappa", teamId: "KKR" }, purpleCap: { name: "Mohit Sharma", teamId: "CSK" }, emergingPlayer: { name: "Axar Patel", teamId: "KXIP" }, mvp: { name: "Glenn Maxwell", teamId: "KXIP" }, source: "historical" },
  { season: 2013, championTeamId: "MI", runnerUpTeamId: "CSK", orangeCap: { name: "Michael Hussey", teamId: "CSK" }, purpleCap: { name: "Dwayne Bravo", teamId: "CSK" }, emergingPlayer: { name: "Sanju Samson", teamId: "RR" }, mvp: { name: "Shane Watson", teamId: "RR" }, source: "historical" },
  { season: 2012, championTeamId: "KKR", runnerUpTeamId: "CSK", orangeCap: { name: "Chris Gayle", teamId: "RCB" }, purpleCap: { name: "Morne Morkel", teamId: "DD" }, emergingPlayer: { name: "Mandeep Singh", teamId: "KXIP" }, mvp: { name: "Sunil Narine", teamId: "KKR" }, source: "historical" },
  { season: 2011, championTeamId: "CSK", runnerUpTeamId: "RCB", orangeCap: { name: "Chris Gayle", teamId: "RCB" }, purpleCap: { name: "Lasith Malinga", teamId: "MI" }, emergingPlayer: { name: "Iqbal Abdulla", teamId: "KKR" }, mvp: { name: "Chris Gayle", teamId: "RCB" }, source: "historical" },
  { season: 2010, championTeamId: "CSK", runnerUpTeamId: "MI", orangeCap: { name: "Sachin Tendulkar", teamId: "MI" }, purpleCap: { name: "Pragyan Ojha", teamId: "DCG" }, emergingPlayer: { name: "Saurabh Tiwary", teamId: "MI" }, mvp: { name: "Sachin Tendulkar", teamId: "MI" }, source: "historical" },
  { season: 2009, championTeamId: "DCG", runnerUpTeamId: "RCB", orangeCap: { name: "Matthew Hayden", teamId: "CSK" }, purpleCap: { name: "RP Singh", teamId: "DCG" }, emergingPlayer: { name: "Rohit Sharma", teamId: "DCG" }, mvp: { name: "Adam Gilchrist", teamId: "DCG" }, source: "historical" },
  { season: 2008, championTeamId: "RR", runnerUpTeamId: "CSK", orangeCap: { name: "Shaun Marsh", teamId: "KXIP" }, purpleCap: { name: "Sohail Tanvir", teamId: "RR" }, emergingPlayer: { name: "Shreevats Goswami", teamId: "RCB" }, mvp: { name: "Shane Watson", teamId: "RR" }, source: "historical" },
];

// Final league-table order before the playoffs. Keeping this separate from the
// honours data makes every participating club's season record explicit.
const HISTORICAL_LEAGUE_ORDER: Record<number, string[]> = {
  2026: ["RCB", "GT", "RR", "PBKS", "MI", "SRH", "LSG", "KKR", "DC", "CSK"],
  2025: ["PBKS", "RCB", "GT", "MI", "DC", "SRH", "LSG", "KKR", "RR", "CSK"],
  2024: ["KKR", "SRH", "RR", "RCB", "CSK", "DC", "LSG", "GT", "PBKS", "MI"],
  2023: ["GT", "CSK", "LSG", "MI", "RR", "RCB", "KKR", "PBKS", "DC", "SRH"],
  2022: ["GT", "RR", "LSG", "RCB", "DC", "PBKS", "KKR", "SRH", "CSK", "MI"],
  2021: ["DC", "CSK", "RCB", "KKR", "MI", "PBKS", "RR", "SRH"],
  2020: ["MI", "DC", "SRH", "RCB", "KKR", "KXIP", "CSK", "RR"],
  2019: ["MI", "CSK", "DC", "SRH", "KKR", "KXIP", "RR", "RCB"],
  2018: ["SRH", "CSK", "KKR", "RR", "MI", "RCB", "KXIP", "DD"],
  2017: ["MI", "RPS", "SRH", "KKR", "KXIP", "DD", "GL", "RCB"],
  2016: ["GL", "RCB", "SRH", "KKR", "MI", "DD", "RPS", "KXIP"],
  2015: ["CSK", "MI", "RCB", "RR", "KKR", "SRH", "DD", "KXIP"],
  2014: ["KXIP", "KKR", "CSK", "MI", "RR", "SRH", "RCB", "DD"],
  2013: ["CSK", "MI", "RR", "SRH", "RCB", "KXIP", "KKR", "PWI", "DD"],
  2012: ["DD", "KKR", "MI", "CSK", "RCB", "KXIP", "RR", "DCG", "PWI"],
  2011: ["RCB", "CSK", "MI", "KKR", "KXIP", "RR", "DCG", "KTK", "PWI", "DD"],
  2010: ["MI", "DCG", "CSK", "RCB", "DD", "KKR", "RR", "KXIP"],
  2009: ["DD", "CSK", "RCB", "DCG", "KXIP", "RR", "MI", "KKR"],
  2008: ["RR", "KXIP", "CSK", "DD", "MI", "KKR", "RCB", "DCG"],
};

const HISTORICAL_PLAYOFF_EXITS: Record<number, Partial<Record<LeagueHistoryPlayoffOutcome, string | string[]>>> = {
  2026: { "qualifier-2": "RR", eliminator: "PBKS" },
  2025: { "qualifier-2": "MI", eliminator: "GT" },
  2024: { "qualifier-2": "RR", eliminator: "RCB" },
  2023: { "qualifier-2": "MI", eliminator: "LSG" },
  2022: { "qualifier-2": "RCB", eliminator: "LSG" },
  2021: { "qualifier-2": "DC", eliminator: "RCB" },
  2020: { "qualifier-2": "SRH", eliminator: "RCB" },
  2019: { "qualifier-2": "DC", eliminator: "SRH" },
  2018: { "qualifier-2": "KKR", eliminator: "RR" },
  2017: { "qualifier-2": "KKR", eliminator: "SRH" },
  2016: { "qualifier-2": "GL", eliminator: "KKR" },
  2015: { "qualifier-2": "RCB", eliminator: "RR" },
  2014: { "qualifier-2": "CSK", eliminator: "MI" },
  2013: { "qualifier-2": "RR", eliminator: "SRH" },
  2012: { "qualifier-2": "DD", eliminator: "MI" },
  2011: { "qualifier-2": "MI", eliminator: "KKR" },
  2010: { "semi-final": ["DCG", "RCB"] },
  2009: { "semi-final": ["DD", "CSK"] },
  2008: { "semi-final": ["DD", "KXIP"] },
};

function historicalTeamOutcomes(season: LeagueHistorySeason): Record<string, LeagueHistoryTeamOutcome> {
  const outcomes: Record<string, LeagueHistoryTeamOutcome> = {};
  (HISTORICAL_LEAGUE_ORDER[season.season] ?? []).forEach((teamId, index) => {
    outcomes[teamId] = { leaguePosition: index + 1 };
  });
  if (outcomes[season.championTeamId]) outcomes[season.championTeamId].playoffOutcome = "champion";
  if (outcomes[season.runnerUpTeamId]) outcomes[season.runnerUpTeamId].playoffOutcome = "runner-up";
  Object.entries(HISTORICAL_PLAYOFF_EXITS[season.season] ?? {}).forEach(([outcome, teamIds]) => {
    for (const teamId of Array.isArray(teamIds) ? teamIds : [teamIds]) {
      if (teamId && outcomes[teamId]) outcomes[teamId].playoffOutcome = outcome as LeagueHistoryPlayoffOutcome;
    }
  });
  return outcomes;
}

export const HISTORICAL_LEAGUE_HISTORY: LeagueHistorySeason[] = HISTORICAL_LEAGUE_HISTORY_BASE.map((season) => ({
  ...season,
  teamOutcomes: historicalTeamOutcomes(season),
}));

interface PlayoffFixtureResult {
  stage?: string;
  teamA?: string;
  teamB?: string;
  winner?: string | null;
  played?: boolean;
}

export function buildLeagueHistoryTeamOutcomes(
  standings: Array<{ teamId: string }>,
  fixtures: unknown[],
): Record<string, LeagueHistoryTeamOutcome> {
  const playoffFixtures = fixtures.filter((entry): entry is PlayoffFixtureResult => Boolean(entry && typeof entry === "object"));
  const outcomes: Record<string, LeagueHistoryTeamOutcome> = {};
  standings.forEach((standing, index) => { outcomes[standing.teamId] = { leaguePosition: index + 1 }; });
  const applyLoser = (stage: string, playoffOutcome: LeagueHistoryPlayoffOutcome) => {
    const fixture = playoffFixtures.find((entry) => entry.stage === stage && entry.played && entry.winner);
    if (!fixture?.winner || !fixture.teamA || !fixture.teamB) return;
    const loser = fixture.winner === fixture.teamA ? fixture.teamB : fixture.teamA;
    if (outcomes[loser]) outcomes[loser].playoffOutcome = playoffOutcome;
  };
  applyLoser("eliminator", "eliminator");
  applyLoser("qualifier2", "qualifier-2");
  const final = playoffFixtures.find((entry) => entry.stage === "final" && entry.played && entry.winner);
  if (final?.winner && final.teamA && final.teamB) {
    const runnerUp = final.winner === final.teamA ? final.teamB : final.teamA;
    if (outcomes[final.winner]) outcomes[final.winner].playoffOutcome = "champion";
    if (outcomes[runnerUp]) outcomes[runnerUp].playoffOutcome = "runner-up";
  }
  return outcomes;
}
