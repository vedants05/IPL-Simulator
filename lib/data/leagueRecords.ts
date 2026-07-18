export type MajorRecordCategoryId = "appearances" | "runs" | "wickets" | "batting-average";

export interface RetiredRecordEntry {
  name: string;
  value: number;
  teamId: string;
  matches?: number;
  runs?: number;
}

export const BATTING_AVERAGE_MINIMUM_MATCHES = 50;
export const BATTING_AVERAGE_MINIMUM_RUNS = 1000;

export const qualifiesForBattingAverageRecord = ({
  matches,
  runs,
  battingAverage,
}: {
  matches: number;
  runs: number;
  battingAverage: number;
}) => matches >= BATTING_AVERAGE_MINIMUM_MATCHES
  && runs >= BATTING_AVERAGE_MINIMUM_RUNS
  && battingAverage > 0;

export interface OtherLeagueRecord {
  id: string;
  label: string;
  value: string;
  holder: string;
  detail: string;
  playerNames?: string[];
}

// Retired leaders are merged with the live player database at render time.
// Entries below the likely top five are retained so future live totals can be
// compared without losing a relevant historical player.
export const RETIRED_MAJOR_RECORDS: Record<MajorRecordCategoryId, RetiredRecordEntry[]> = {
  appearances: [
    { name: "Dinesh Karthik", value: 257, teamId: "RCB" },
    { name: "Shikhar Dhawan", value: 222, teamId: "PBKS" },
    { name: "Suresh Raina", value: 205, teamId: "CSK" },
    { name: "Robin Uthappa", value: 205, teamId: "CSK" },
    { name: "Ambati Rayudu", value: 204, teamId: "CSK" },
  ],
  runs: [
    { name: "Shikhar Dhawan", value: 6769, teamId: "PBKS" },
    { name: "David Warner", value: 6565, teamId: "DC" },
    { name: "Suresh Raina", value: 5528, teamId: "CSK" },
    { name: "AB de Villiers", value: 5162, teamId: "RCB" },
    { name: "Chris Gayle", value: 4965, teamId: "PBKS" },
  ],
  wickets: [
    { name: "Piyush Chawla", value: 192, teamId: "MI" },
    { name: "Dwayne Bravo", value: 183, teamId: "CSK" },
    { name: "Amit Mishra", value: 174, teamId: "LSG" },
    { name: "Lasith Malinga", value: 170, teamId: "MI" },
    { name: "Harbhajan Singh", value: 150, teamId: "KKR" },
  ],
  "batting-average": [
    { name: "David Warner", value: 40.52, teamId: "DC", matches: 184, runs: 6565 },
    { name: "Shaun Marsh", value: 39.95, teamId: "KXIP", matches: 71, runs: 2477 },
    { name: "JP Duminy", value: 39.78, teamId: "MI", matches: 83, runs: 2029 },
    { name: "Chris Gayle", value: 39.72, teamId: "PBKS", matches: 142, runs: 4965 },
    { name: "AB de Villiers", value: 39.70, teamId: "RCB", matches: 184, runs: 5162 },
  ],
};

export const OTHER_LEAGUE_RECORDS: OtherLeagueRecord[] = [
  { id: "highest-total", label: "Highest team total", value: "287/3", holder: "Sunrisers Hyderabad", detail: "vs RCB · 2024" },
  { id: "lowest-total", label: "Lowest team total", value: "49", holder: "Royal Challengers Bengaluru", detail: "vs KKR · 2017" },
  { id: "highest-chase", label: "Highest successful chase", value: "265/4", holder: "Punjab Kings", detail: "vs DC · 2026" },
  { id: "individual-score", label: "Highest individual score", value: "175*", holder: "Chris Gayle", detail: "RCB vs PWI · 2013", playerNames: ["Chris Gayle"] },
  { id: "bowling-figures", label: "Best bowling figures", value: "6/12", holder: "Alzarri Joseph", detail: "MI vs SRH · 2019", playerNames: ["Alzarri Joseph"] },
  { id: "batting-season", label: "Best batting season", value: "973 runs", holder: "Virat Kohli", detail: "RCB · 2016", playerNames: ["Virat Kohli"] },
  { id: "bowling-season", label: "Most wickets in a season", value: "32", holder: "D. Bravo / H. Patel", detail: "2013 / 2021", playerNames: ["Dwayne Bravo", "Harshal Patel"] },
  { id: "partnership", label: "Highest partnership", value: "229", holder: "Kohli & de Villiers", detail: "RCB vs GL · 2016", playerNames: ["Virat Kohli", "AB de Villiers"] },
];
