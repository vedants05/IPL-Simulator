export interface MinorRecord {
  id: string;
  category: "batting_position" | "partnership_position" | "season_batting" | "season_bowling" | "milestone" | "fielding" | "team";
  title: string;
  value: string;
  holder: string;
  season?: string;
  notes?: string;
  source?: string;
  verified: boolean;
}

// Deliberately kept as plain data: values can be corrected or replaced later
// without changing the Minor Records page component.
export const MINOR_RECORDS: MinorRecord[] = [
  { id: "highest-score-pos-1", category: "batting_position", title: "Highest IPL score batting at #1", value: "175", holder: "Chris Gayle", season: "2013", notes: "RCB vs PWI", source: "IPL records", verified: true },
  { id: "highest-score-pos-2", category: "batting_position", title: "Highest IPL score batting at #2", value: "158*", holder: "AB de Villiers", season: "2016", source: "IPL records", verified: true },
  { id: "highest-score-pos-3", category: "batting_position", title: "Highest IPL score batting at #3", value: "133*", holder: "KL Rahul", season: "2020", source: "IPL records", verified: true },
  { id: "highest-score-pos-4", category: "batting_position", title: "Highest IPL score batting at #4", value: "129*", holder: "Shubman Gill", season: "2023", source: "IPL records", verified: true },
  { id: "highest-score-pos-5", category: "batting_position", title: "Highest IPL score batting at #5", value: "101*", holder: "David Miller", season: "2013", source: "IPL records", verified: true },
  { id: "highest-score-pos-6", category: "batting_position", title: "Highest IPL score batting at #6", value: "100*", holder: "Yusuf Pathan", season: "2010", source: "IPL records", verified: true },
  { id: "highest-score-pos-7", category: "batting_position", title: "Highest IPL score batting at #7", value: "87*", holder: "Ravindra Jadeja", season: "2021", source: "To verify against ball-by-ball archive", verified: false },
  { id: "highest-score-pos-8", category: "batting_position", title: "Highest IPL score batting at #8", value: "65*", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "highest-score-pos-9", category: "batting_position", title: "Highest IPL score batting at #9", value: "55*", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "highest-score-pos-10", category: "batting_position", title: "Highest IPL score batting at #10", value: "40*", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "highest-score-pos-11", category: "batting_position", title: "Highest IPL score batting at #11", value: "30*", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  ...Array.from({ length: 11 }, (_, index) => ({ id: `highest-partnership-pos-${index + 1}`, category: "partnership_position" as const, title: `Highest IPL partnership involving batting position #${index + 1}`, value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false })),
  { id: "season-most-runs", category: "season_batting", title: "Most runs in an IPL season", value: "973", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },
  { id: "season-most-runs-2", category: "season_batting", title: "Second-most runs in an IPL season", value: "848", holder: "Shubman Gill", season: "2023", source: "IPL records", verified: true },
  { id: "season-most-runs-3", category: "season_batting", title: "Third-most runs in an IPL season", value: "863", holder: "Jos Buttler", season: "2022", source: "IPL records", verified: true },
  { id: "season-most-runs-conceded", category: "season_bowling", title: "Most runs conceded in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-ducks", category: "season_batting", title: "Most ducks in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-golden-ducks", category: "season_batting", title: "Most golden ducks in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-sixes", category: "season_batting", title: "Most sixes in an IPL season", value: "39", holder: "Chris Gayle", season: "2012", source: "IPL records", verified: true },
  { id: "season-most-fours", category: "season_batting", title: "Most fours in an IPL season", value: "128", holder: "David Warner", season: "2017", source: "IPL records", verified: true },
  { id: "season-highest-strike-rate", category: "season_batting", title: "Highest season strike rate (minimum 100 balls)", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-best-average", category: "season_batting", title: "Best season batting average (minimum 300 runs)", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-fifties", category: "season_batting", title: "Most fifties in an IPL season", value: "8", holder: "David Warner", season: "2016", source: "IPL records", verified: true },
  { id: "season-most-centuries", category: "season_batting", title: "Most centuries in an IPL season", value: "4", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },
  { id: "season-most-boundaries", category: "season_batting", title: "Most total boundaries in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-300-balls", category: "milestone", title: "Fastest to 300 runs in a season by balls", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-400-balls", category: "milestone", title: "Fastest to 400 runs in a season by balls", value: "167 balls", holder: "Vaibhav Sooryavanshi", season: "2026", source: "Rajasthan Royals / IPL reporting", verified: true },
  { id: "fastest-500-balls", category: "milestone", title: "Fastest to 500 runs in a season by balls", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-600-balls", category: "milestone", title: "Fastest to 600 runs in a season by balls", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-700-balls", category: "milestone", title: "Fastest to 700 runs in a season by balls", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-800-balls", category: "milestone", title: "Fastest to 800 runs in a season by balls", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-900-balls", category: "milestone", title: "Fastest to 900 runs in a season by balls", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-300-innings", category: "milestone", title: "Fastest to 300 runs in a season by innings", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-400-innings", category: "milestone", title: "Fastest to 400 runs in a season by innings", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-500-innings", category: "milestone", title: "Fastest to 500 runs in a season by innings", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-600-innings", category: "milestone", title: "Fastest to 600 runs in a season by innings", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-700-innings", category: "milestone", title: "Fastest to 700 runs in a season by innings", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-800-innings", category: "milestone", title: "Fastest to 800 runs in a season by innings", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-900-innings", category: "milestone", title: "Fastest to 900 runs in a season by innings", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-10-wickets", category: "milestone", title: "Fastest to 10 wickets in a season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-15-wickets", category: "milestone", title: "Fastest to 15 wickets in a season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-20-wickets", category: "milestone", title: "Fastest to 20 wickets in a season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "fastest-25-wickets", category: "milestone", title: "Fastest to 25 wickets in a season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-best-bowling", category: "season_bowling", title: "Best bowling figures in an IPL season", value: "32 wickets", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "season-best-economy", category: "season_bowling", title: "Best season economy (minimum 20 overs)", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-best-bowling-average", category: "season_bowling", title: "Best season bowling average (minimum 20 overs)", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-dot-balls", category: "season_bowling", title: "Most dot balls in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-maidens", category: "season_bowling", title: "Most maidens in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-boundaries-conceded", category: "season_bowling", title: "Most boundaries conceded in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-catches", category: "fielding", title: "Most catches in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-stumpings", category: "fielding", title: "Most stumpings in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-team-runs", category: "team", title: "Most team runs in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
  { id: "season-most-team-wickets", category: "team", title: "Most team wickets in an IPL season", value: "To verify", holder: "To verify", source: "Ball-by-ball archive", verified: false },
];
