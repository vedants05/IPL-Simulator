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

export const MINOR_RECORDS: MinorRecord[] = [
  // --- BATTING POSITIONS (11) ---
  { id: "highest-score-pos-1", category: "batting_position", title: "Highest IPL score batting at #1", value: "175*", holder: "Chris Gayle", season: "2013", notes: "RCB vs Pune", source: "IPL records", verified: true },
  { id: "highest-score-pos-2", category: "batting_position", title: "Highest IPL score batting at #2", value: "158*", holder: "Brendon McCullum", season: "2008", notes: "KKR vs RCB", source: "IPL records", verified: true },
  { id: "highest-score-pos-3", category: "batting_position", title: "Highest IPL score batting at #3", value: "133*", holder: "AB de Villiers", season: "2015", notes: "RCB vs MI", source: "IPL records", verified: true },
  { id: "highest-score-pos-4", category: "batting_position", title: "Highest IPL score batting at #4", value: "128*", holder: "Rishabh Pant", season: "2018", notes: "DC vs SRH", source: "IPL records", verified: true },
  { id: "highest-score-pos-5", category: "batting_position", title: "Highest IPL score batting at #5", value: "103*", holder: "Ben Stokes", season: "2017", notes: "Pune vs Gujarat", source: "IPL records", verified: true },
  { id: "highest-score-pos-6", category: "batting_position", title: "Highest IPL score batting at #6", value: "91", holder: "Hardik Pandya", season: "2019", notes: "MI vs KKR", source: "IPL records", verified: true },
  { id: "highest-score-pos-7", category: "batting_position", title: "Highest IPL score batting at #7", value: "88*", holder: "Andre Russell", season: "2018", notes: "KKR vs CSK", source: "IPL records", verified: true },
  { id: "highest-score-pos-8", category: "batting_position", title: "Highest IPL score batting at #8", value: "79*", holder: "Rashid Khan", season: "2023", notes: "GT vs MI", source: "IPL records", verified: true },
  { id: "highest-score-pos-9", category: "batting_position", title: "Highest IPL score batting at #9", value: "49*", holder: "Harbhajan Singh", season: "2010", notes: "MI vs Deccan Chargers", source: "IPL records", verified: true },
  { id: "highest-score-pos-10", category: "batting_position", title: "Highest IPL score batting at #10", value: "28*", holder: "Dhawal Kulkarni", season: "2014", notes: "RR vs CSK", source: "IPL records", verified: true },
  { id: "highest-score-pos-11", category: "batting_position", title: "Highest IPL score batting at #11", value: "23*", holder: "Munaf Patel", season: "2009", notes: "RR vs DC", source: "IPL records", verified: true },

  { id: "season-most-runs-pos-1", category: "batting_position", title: "Most runs in a season batting at #1", value: "973", holder: "Virat Kohli", season: "2016", notes: "RCB", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-2", category: "batting_position", title: "Most runs in a season batting at #2", value: "890", holder: "Shubman Gill", season: "2023", notes: "GT", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-3", category: "batting_position", title: "Most runs in a season batting at #3", value: "735", holder: "Kane Williamson", season: "2018", notes: "SRH", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-4", category: "batting_position", title: "Most runs in a season batting at #4", value: "684", holder: "Rishabh Pant", season: "2018", notes: "DD", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-5", category: "batting_position", title: "Most runs in a season batting at #5", value: "624", holder: "Heinrich Klaasen", season: "2026", notes: "SRH", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-6", category: "batting_position", title: "Most runs in a season batting at #6", value: "510", holder: "Andre Russell", season: "2019", notes: "KKR", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-7", category: "batting_position", title: "Most runs in a season batting at #7", value: "455", holder: "MS Dhoni", season: "2018", notes: "CSK", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-8", category: "batting_position", title: "Most runs in a season batting at #8", value: "227", holder: "Ravindra Jadeja", season: "2021", notes: "CSK", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-9", category: "batting_position", title: "Most runs in a season batting at #9", value: "151", holder: "Harbhajan Singh", season: "2012", notes: "MI", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-10", category: "batting_position", title: "Most runs in a season batting at #10", value: "42", holder: "Umesh Yadav", season: "2017", notes: "KKR", source: "IPL records", verified: true },
  { id: "season-most-runs-pos-11", category: "batting_position", title: "Most runs in a season batting at #11", value: "22", holder: "Sandeep Sharma", season: "2014", notes: "PBKS", source: "IPL records", verified: true },
  
  // --- PARTNERSHIPS (11) ---
  { id: "highest-partnership-pos-1", category: "partnership_position", title: "Highest IPL partnership involving batting position #1", value: "210*", holder: "Quinton de Kock & KL Rahul", season: "2022", notes: "LSG vs KKR (1st wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-2", category: "partnership_position", title: "Highest IPL partnership involving batting position #2", value: "229", holder: "Virat Kohli & AB de Villiers", season: "2016", notes: "RCB vs GL (2nd wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-3", category: "partnership_position", title: "Highest IPL partnership involving batting position #3", value: "229", holder: "Virat Kohli & AB de Villiers", season: "2016", notes: "RCB vs GL (2nd wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-4", category: "partnership_position", title: "Highest IPL partnership involving batting position #4", value: "165", holder: "Robin Uthappa & Shivam Dube", season: "2022", notes: "CSK vs RCB (3rd wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-5", category: "partnership_position", title: "Highest IPL partnership involving batting position #5", value: "144", holder: "Shimron Hetmyer & Gurkeerat Singh", season: "2019", notes: "RCB vs SRH (4th wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-6", category: "partnership_position", title: "Highest IPL partnership involving batting position #6", value: "134*", holder: "Shakib Al Hasan & Yusuf Pathan", season: "2016", notes: "KKR vs GL (5th wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-7", category: "partnership_position", title: "Highest IPL partnership involving batting position #7", value: "122*", holder: "Ambati Rayudu & Kieron Pollard", season: "2012", notes: "MI vs RCB (6th wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-8", category: "partnership_position", title: "Highest IPL partnership involving batting position #8", value: "100", holder: "Harbhajan Singh & Jagadeesha Suchith", season: "2015", notes: "MI vs PBKS (7th wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-9", category: "partnership_position", title: "Highest IPL partnership involving batting position #9", value: "73*", holder: "Ayush Badoni & Arshad Khan", season: "2024", notes: "LSG vs DC (8th wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-10", category: "partnership_position", title: "Highest IPL partnership involving batting position #10", value: "88*", holder: "Rashid Khan & Alzarri Joseph", season: "2023", notes: "GT vs MI (9th wicket)", source: "IPL records", verified: true },
  { id: "highest-partnership-pos-11", category: "partnership_position", title: "Highest IPL partnership involving batting position #11", value: "55*", holder: "Shikhar Dhawan & Mohit Rathee", season: "2023", notes: "PBKS vs SRH (10th wicket)", source: "IPL records", verified: true },

  // --- TEAM HIGHEST SCORES (ACTIVE TEAMS ONLY) ---
  { id: "highest-score-srh", category: "team", title: "SRH highest ever score", value: "287/3", holder: "SRH", season: "2024", notes: "vs RCB", source: "IPL records", verified: true },
  { id: "highest-score-kkr", category: "team", title: "KKR highest ever score", value: "272/7", holder: "KKR", season: "2024", notes: "vs DC", source: "IPL records", verified: true },
  { id: "highest-score-rcb", category: "team", title: "RCB highest ever score", value: "263/5", holder: "RCB", season: "2013", notes: "vs Pune Warriors", source: "IPL records", verified: true },
  { id: "highest-score-pbks", category: "team", title: "PBKS highest ever score", value: "262/2", holder: "PBKS", season: "2024", notes: "vs KKR", source: "IPL records", verified: true },
  { id: "highest-score-dc", category: "team", title: "DC highest ever score", value: "257/4", holder: "DC", season: "2024", notes: "vs MI", source: "IPL records", verified: true },
  { id: "highest-score-lsg", category: "team", title: "LSG highest ever score", value: "257/5", holder: "LSG", season: "2023", notes: "vs PBKS", source: "IPL records", verified: true },
  { id: "highest-score-mi", category: "team", title: "MI highest ever score", value: "247/9", holder: "MI", season: "2024", notes: "vs SRH", source: "IPL records", verified: true },
  { id: "highest-score-csk", category: "team", title: "CSK highest ever score", value: "246/5", holder: "CSK", season: "2010", notes: "vs RR", source: "IPL records", verified: true },
  { id: "highest-score-gt", category: "team", title: "GT highest ever score", value: "233/3", holder: "GT", season: "2023", notes: "vs MI", source: "IPL records", verified: true },
  { id: "highest-score-rr", category: "team", title: "RR highest ever score", value: "243/8", holder: "RR", season: "2026", source: "IPL records", verified: true },

  // --- TEAM LOWEST SCORES (ACTIVE TEAMS ONLY) ---
  { id: "lowest-score-rcb", category: "team", title: "RCB lowest ever score", value: "49", holder: "RCB", season: "2017", notes: "vs KKR", source: "IPL records", verified: true },
  { id: "lowest-score-rr", category: "team", title: "RR lowest ever score", value: "58", holder: "RR", season: "2009", notes: "vs RCB", source: "IPL records", verified: true },
  { id: "lowest-score-dc", category: "team", title: "DC lowest ever score", value: "66", holder: "DC", season: "2017", notes: "vs MI", source: "IPL records", verified: true },
  { id: "lowest-score-kkr", category: "team", title: "KKR lowest ever score", value: "67", holder: "KKR", season: "2008", notes: "vs MI", source: "IPL records", verified: true },
  { id: "lowest-score-csk", category: "team", title: "CSK lowest ever score", value: "79", holder: "CSK", season: "2013", notes: "vs MI", source: "IPL records", verified: true },
  { id: "lowest-score-pbks", category: "team", title: "PBKS lowest ever score", value: "73", holder: "PBKS", season: "2017", notes: "vs RPS", source: "IPL records", verified: true },
  { id: "lowest-score-lsg", category: "team", title: "LSG lowest ever score", value: "82", holder: "LSG", season: "2022", notes: "vs GT", source: "IPL records", verified: true },
  { id: "lowest-score-srh", category: "team", title: "SRH lowest ever score", value: "96", holder: "SRH", season: "2019", notes: "vs MI", source: "IPL records", verified: true },
  { id: "lowest-score-mi", category: "team", title: "MI lowest ever score", value: "87", holder: "MI", season: "2018", notes: "vs SRH", source: "IPL records", verified: true },
  { id: "lowest-score-gt", category: "team", title: "GT lowest ever score", value: "89", holder: "GT", season: "2024", notes: "vs DC", source: "IPL records", verified: true },

  { id: "most-consecutive-wins", category: "team", title: "Most consecutive wins in a season", value: "10 wins", holder: "KKR", season: "2014", source: "IPL records", verified: true },
  { id: "largest-victory-runs", category: "team", title: "Largest margin of victory by runs", value: "146 runs", holder: "MI", season: "2017", notes: "vs DC", source: "IPL records", verified: true },
  { id: "most-runs-in-match", category: "team", title: "Most aggregate runs in a single IPL match", value: "549 runs", holder: "SRH vs RCB", season: "2024", notes: "SRH 287/3 & RCB 262/7", source: "IPL records", verified: true },
  { id: "most-sixes-in-match", category: "team", title: "Most sixes in a single IPL match", value: "38 sixes", holder: "SRH vs RCB / KKR vs PBKS", season: "2024", source: "IPL records", verified: true },
  { id: "most-boundaries-in-match", category: "team", title: "Most boundaries in a single IPL match", value: "81 boundaries", holder: "SRH vs RCB", season: "2024", notes: "vs RCB", source: "IPL records", verified: true },
  { id: "lowest-score-defended", category: "team", title: "Lowest score defended in IPL history (20 overs)", value: "116/9", holder: "CSK", season: "2009", notes: "vs PBKS", source: "IPL records", verified: true },
  { id: "most-extras-in-innings", category: "team", title: "Most extras conceded in an IPL innings", value: "38 extras", holder: "MI", season: "2008", notes: "vs KKR", source: "IPL records", verified: true },

  // --- SEASONAL & MATCH PLAYER MILESTONES ---
  { id: "fastest-fifty-ipl", category: "milestone", title: "Fastest fifty in IPL history (by balls)", value: "13 balls", holder: "Yashasvi Jaiswal", season: "2023", notes: "RR vs KKR", source: "IPL records", verified: true },
  { id: "fastest-century-ipl", category: "milestone", title: "Fastest century in IPL history (by balls)", value: "30 balls", holder: "Chris Gayle", season: "2013", notes: "RCB vs Pune", source: "IPL records", verified: true },
  { id: "most-runs-conceded-spell", category: "milestone", title: "Most runs conceded in a single IPL match", value: "76 runs", holder: "Jofra Archer", season: "2025", notes: "Spell: 4-0-76-0 vs SRH", source: "IPL records", verified: true },
  { id: "most-runs-in-over", category: "milestone", title: "Most runs scored off a single over", value: "37 runs", holder: "Chris Gayle & Ravindra Jadeja", notes: "Gayle off Parameswaran (2011); Jadeja off Harshal (2021)", source: "IPL records", verified: true },
  { id: "most-hat-tricks", category: "milestone", title: "Most hat-tricks in IPL history", value: "3 hat-tricks", holder: "Amit Mishra", notes: "Achieved for DC (2008), Deccan (2011), SRH (2013)", source: "IPL records", verified: true },
  { id: "highest-strike-rate-innings", category: "milestone", title: "Highest strike rate in a 50+ runs innings", value: "348.00", holder: "Pat Cummins", season: "2022", notes: "56* off 15 balls vs MI", source: "IPL records", verified: true },
  { id: "most-expensive-auction-buy", category: "milestone", title: "Most expensive player in IPL auction history", value: "₹24.75 Crore", holder: "Mitchell Starc", season: "2024", notes: "Bought by KKR", source: "IPL records", verified: true },
  { id: "youngest-player-ipl", category: "milestone", title: "Youngest player to debut in IPL history", value: "15 years, 273 days", holder: "Vaibhav Sooryavanshi", season: "2026", notes: "Debuted for RR vs PBKS", source: "IPL records", verified: true },
  { id: "oldest-player-ipl", category: "milestone", title: "Oldest player to play an IPL match", value: "45 years, 92 days", holder: "Brad Hogg", season: "2016", notes: "Played for KKR", source: "IPL records", verified: true },
  { id: "most-runs-conceded-in-over-bowler", category: "milestone", title: "Most runs conceded by a bowler in a single over", value: "37 runs", holder: "Prashanth Parameswaran & Harshal Patel", source: "IPL records", verified: true },

  // --- OVERSEAS vs INDIAN vs UNCAPPED UNIQUE SEASONAL RECORDS ---
  { id: "season-runs-uncapped-record", category: "season_batting", title: "Most runs in a season by an uncapped player", value: "788 runs", holder: "Vaibhav Sooryavanshi", season: "2026", notes: "RR", source: "IPL records", verified: true },
  { id: "season-runs-uncapped-previous", category: "season_batting", title: "Previous most runs in a season by an uncapped player", value: "625 runs", holder: "Yashasvi Jaiswal", season: "2023", notes: "RR", source: "IPL records", verified: true },
  { id: "season-wickets-uncapped-record", category: "season_bowling", title: "Most wickets in a season by an uncapped bowler", value: "32 wickets", holder: "Harshal Patel", season: "2021", notes: "RCB", source: "IPL records", verified: true },
  { id: "highest-score-uncapped-match", category: "milestone", title: "Highest individual score by an uncapped player", value: "124", holder: "Yashasvi Jaiswal", season: "2023", notes: "RR vs MI", source: "IPL records", verified: true },
  { id: "highest-score-uncapped-playoffs", category: "milestone", title: "Highest score by an uncapped player in playoffs", value: "112*", holder: "Rajat Patidar", season: "2022", notes: "RCB vs LSG", source: "IPL records", verified: true },
  { id: "first-uncapped-century-indian", category: "milestone", title: "First Indian uncapped player to score a century", value: "114*", holder: "Manish Pandey", season: "2009", notes: "RCB vs Hyderabad", source: "IPL records", verified: true },
  { id: "first-uncapped-century-overseas", category: "milestone", title: "First overseas uncapped player to score a century", value: "115*", holder: "Shaun Marsh", season: "2008", notes: "PBKS vs RR", source: "IPL records", verified: true },
  { id: "youngest-uncapped-fifty", category: "milestone", title: "Youngest uncapped player to score a fifty", value: "15 years, 280 days", holder: "Vaibhav Sooryavanshi", season: "2026", notes: "RR vs DC", source: "IPL records", verified: true },
  { id: "most-fifties-season-uncapped", category: "season_batting", title: "Most fifty-plus scores by an uncapped player in a season", value: "5", holder: "Yashasvi Jaiswal / Shaun Marsh", season: "2023/2008", source: "IPL records", verified: true },
  { id: "most-wickets-uncapped-debut", category: "milestone", title: "Most wickets on debut by an uncapped bowler", value: "6/12", holder: "Alzarri Joseph", season: "2019", notes: "MI vs SRH", source: "IPL records", verified: true },
  { id: "season-most-runs-overseas", category: "season_batting", title: "Most runs in a season by an Overseas player", value: "863 runs", holder: "Jos Buttler", season: "2022", notes: "RR", source: "IPL records", verified: true },
  { id: "season-most-runs-indian", category: "season_batting", title: "Most runs in a season by an Indian player", value: "973 runs", holder: "Virat Kohli", season: "2016", notes: "RCB", source: "IPL records", verified: true },
  { id: "season-most-wickets-overseas", category: "season_bowling", title: "Most wickets in a season by an Overseas bowler", value: "32 wickets", holder: "Dwayne Bravo", season: "2013", notes: "CSK", source: "IPL records", verified: true },
  { id: "season-most-wickets-indian", category: "season_bowling", title: "Most wickets in a season by an Indian bowler", value: "32 wickets", holder: "Harshal Patel", season: "2021", notes: "RCB", source: "IPL records", verified: true },

  // --- PLAYOFFS & FINALS SPECIFIC SEASONAL RECORDS ---
  { id: "highest-score-final", category: "milestone", title: "Highest individual score in an IPL Final", value: "117*", holder: "Shane Watson", season: "2018", notes: "CSK vs SRH", source: "IPL records", verified: true },
  { id: "best-bowling-final", category: "milestone", title: "Best bowling figures in an IPL Final", value: "4/16", holder: "Anil Kumble", season: "2009", notes: "RCB vs Hyderabad", source: "IPL records", verified: true },
  { id: "fastest-fifty-final", category: "milestone", title: "Fastest fifty in an IPL Final", value: "19 balls", holder: "Hardik Pandya / Venkatesh Iyer", season: "2015/2024", source: "IPL records", verified: true },
  { id: "highest-partnership-final", category: "milestone", title: "Highest partnership in an IPL Final", value: "121 runs", holder: "Manish Pandey & Robin Uthappa", season: "2014", notes: "KKR vs PBKS (2nd wicket)", source: "IPL records", verified: true },
  { id: "youngest-captain-title", category: "milestone", title: "Youngest captain to win an IPL title", value: "25 years, 244 days", holder: "Rohit Sharma", season: "2013", notes: "MI", source: "IPL records", verified: true },
  { id: "oldest-captain-title", category: "milestone", title: "Oldest captain to win an IPL title", value: "41 years, 326 days", holder: "MS Dhoni", season: "2023", notes: "CSK", source: "IPL records", verified: true },
  { id: "most-sixes-final", category: "milestone", title: "Most sixes by an individual in an IPL Final", value: "11 sixes", holder: "Shane Watson", season: "2018", notes: "CSK vs SRH", source: "IPL records", verified: true },
  { id: "highest-team-score-final", category: "team", title: "Highest team score in an IPL Final", value: "208/7", holder: "SRH", season: "2016", notes: "vs RCB", source: "IPL records", verified: true },
  { id: "lowest-team-score-final", category: "team", title: "Lowest team score in an IPL Final (completed 20 overs)", value: "125/9", holder: "CSK", season: "2013", notes: "vs MI", source: "IPL records", verified: true },

  // --- MISCELLANEOUS SPECIFIC SEASONAL/MATCH IPL RECORDS ---
  { id: "most-dot-balls-innings", category: "milestone", title: "Most dot balls bowled in an IPL innings", value: "20 dot balls", holder: "Ashish Nehra / Amit Mishra", source: "IPL records", verified: true },
  { id: "most-overs-conceded-sixes", category: "milestone", title: "Most sixes conceded by a bowler in an innings", value: "8 sixes", holder: "Yash Dayal & Anshul Kamboj", notes: "Dayal vs KKR (2023); Kamboj vs LSG (2026)", source: "IPL records", verified: true },
  { id: "most-player-match-season", category: "season_batting", title: "Most Player of the Match awards in a single season", value: "6 awards", holder: "Virat Kohli", season: "2016", notes: "RCB", source: "IPL records", verified: true },
  { id: "highest-percentage-team-runs", category: "season_batting", title: "Highest percentage of team runs in a season", value: "31.2%", holder: "Kane Williamson", season: "2018", notes: "Scored 735 of SRH's runs", source: "IPL records", verified: true },
  { id: "most-wickets-powerplay-season", category: "season_bowling", title: "Most powerplay wickets in a single IPL season", value: "16 wickets", holder: "Bhuvneshwar Kumar / Trent Boult", season: "2013/2020", source: "IPL records", verified: true },
  { id: "most-expensive-over-spinner", category: "milestone", title: "Most runs conceded in a single over by a spinner", value: "31 runs", holder: "Rahul Sharma", season: "2012", notes: "Conceded to Chris Gayle & Saurabh Tiwary (RCB)", source: "IPL records", verified: true },
  { id: "most-expensive-over-pacer", category: "milestone", title: "Most runs conceded in a single over by a pacer", value: "37 runs", holder: "Harshal Patel", source: "IPL records", verified: true },
  { id: "most-consecutive-fifties-ipl", category: "milestone", title: "Most consecutive fifties scored in IPL matches", value: "5 matches", holder: "Virender Sehwag & Jos Buttler", season: "2012/2018", source: "IPL records", verified: true },
  { id: "most-consecutive-fifties-warner", category: "milestone", title: "Most consecutive fifties against a single opponent", value: "9 matches", holder: "David Warner", notes: "Against PBKS (2015-2019)", source: "IPL records", verified: true },
  { id: "first-ball-wicket-debut", category: "milestone", title: "Wicket with the first ball of IPL career", value: "1 wicket", holder: "Alzarri Joseph / Ishant Sharma / Wilkin Mota", source: "IPL records", verified: true },
  { id: "most-maiden-overs-season-pacers", category: "season_bowling", title: "Most maiden overs by a pace bowler in a season", value: "6 maidens", holder: "Mohammed Siraj", season: "2023", notes: "RCB", source: "IPL records", verified: true },
  { id: "most-maiden-overs-season-spinners", category: "season_bowling", title: "Most maiden overs by a spinner in a season", value: "4 maidens", holder: "Daniel Vettori", season: "2011", notes: "RCB", source: "IPL records", verified: true },

  // --- EXTRA TEAM SUCCESS AND PURSE RECORDS ---
  { id: "highest-auction-purse-spent", category: "team", title: "Highest auction purse spent on a single player", value: "₹24.75 Cr", holder: "KKR", season: "2024", notes: "Mitchell Starc", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-csk", category: "team", title: "Lowest total defended by CSK", value: "116/9", holder: "CSK", season: "2009", notes: "vs PBKS", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-kkr", category: "team", title: "Lowest total defended by KKR", value: "129/7", holder: "KKR", season: "2010", notes: "vs Hyderabad", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-mi", category: "team", title: "Lowest total defended by Mumbai Indians", value: "120/9", holder: "MI", season: "2012", notes: "vs Pune", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-rcb", category: "team", title: "Lowest total defended by RCB", value: "126/9", holder: "RCB", season: "2023", notes: "vs LSG", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-srh", category: "team", title: "Lowest total defended by SRH", value: "118", holder: "SRH", season: "2018", notes: "vs MI", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-rr", category: "team", title: "Lowest total defended by RR", value: "119/6", holder: "RR", season: "2013", notes: "vs Pune", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-dc", category: "team", title: "Lowest total defended by DC", value: "120/8", holder: "DC", season: "2009", notes: "vs MI", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-pbks", category: "team", title: "Lowest total defended by PBKS", value: "111", holder: "PBKS", season: "2025", notes: "vs KKR", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-gt", category: "team", title: "Lowest total defended by GT", value: "130/8", holder: "GT", season: "2023", notes: "vs DC", source: "IPL records", verified: true },
  { id: "lowest-defended-totals-lsg", category: "team", title: "Lowest total defended by LSG", value: "154/7", holder: "LSG", season: "2023", notes: "vs RR", source: "IPL records", verified: true },

  { id: "highest-runs-chased-csk", category: "team", title: "Highest successful run chase by CSK", value: "207/5", holder: "CSK", season: "2018", notes: "vs RCB", source: "IPL records", verified: true },
  { id: "highest-runs-chased-rcb", category: "team", title: "Highest successful run chase by RCB", value: "230/7", holder: "RCB", season: "2025", notes: "vs LSG", source: "IPL records", verified: true },
  { id: "highest-runs-chased-mi", category: "team", title: "Highest successful run chase by Mumbai Indians", value: "219/6", holder: "MI", season: "2021", notes: "vs CSK", source: "IPL records", verified: true },
  { id: "highest-runs-chased-rr", category: "team", title: "Highest successful run chase by Rajasthan Royals", value: "226/6", holder: "RR", season: "2020", notes: "vs KXIP", source: "IPL records", verified: true },
  { id: "highest-runs-chased-kkr", category: "team", title: "Highest successful run chase by KKR", value: "207/7", holder: "KKR", season: "2023", notes: "vs GT", source: "IPL records", verified: true },
  { id: "highest-runs-chased-pbks", category: "team", title: "Highest successful run chase by PBKS", value: "265/4", holder: "PBKS", season: "2026", notes: "vs DC", source: "IPL records", verified: true },
  { id: "highest-runs-chased-srh", category: "team", title: "Highest successful run chase by SRH", value: "217/6", holder: "SRH", season: "2023", notes: "vs RR", source: "IPL records", verified: true },
  { id: "highest-runs-chased-dc", category: "team", title: "Highest successful run chase by DC", value: "214/3", holder: "DC", season: "2017", notes: "vs GL", source: "IPL records", verified: true },
  { id: "highest-runs-chased-gt", category: "team", title: "Highest successful run chase by GT", value: "219/7", holder: "GT", season: "2026", notes: "vs RR", source: "IPL records", verified: true },
  { id: "highest-runs-chased-lsg", category: "team", title: "Highest successful run chase by LSG", value: "213/9", holder: "LSG", season: "2023", notes: "vs RCB", source: "IPL records", verified: true },

  // --- SEASONAL & MATCH FIELDING RECORDS ---
  { id: "most-catches-innings", category: "fielding", title: "Most catches by a fielder in a single IPL match", value: "4 catches", holder: "Mohammad Nabi / Ravindra Jadeja / Rinku Singh", season: "Various", notes: "Shared Record", source: "IPL records", verified: true },
  { id: "most-dismissals-keeper-innings", category: "fielding", title: "Most dismissals by a keeper in a single IPL match", value: "5 dismissals", holder: "Kumar Sangakkara", season: "2011", notes: "Deccan Chargers vs RCB", source: "IPL records", verified: true },
  { id: "most-catches-season", category: "fielding", title: "Most catches by a fielder in a single IPL season", value: "19 catches", holder: "AB de Villiers", season: "2016", notes: "RCB", source: "IPL records", verified: true },
  { id: "most-dismissals-keeper-season", category: "fielding", title: "Most dismissals by a keeper in a single IPL season", value: "24 dismissals", holder: "Rishabh Pant", season: "2019", notes: "DC", source: "IPL records", verified: true },

  // --- MILESTONES SPEED METRICS ---
  { id: "fastest-10-wickets", category: "milestone", title: "Fastest to 10 wickets in a season", value: "5 matches", holder: "Kagiso Rabada / Harshal Patel", season: "2020/2021", source: "IPL records", verified: true },
  { id: "fastest-15-wickets", category: "milestone", title: "Fastest to 15 wickets in a season", value: "8 matches", holder: "Kagiso Rabada", season: "2020", source: "IPL records", verified: true },
  { id: "fastest-18-wickets", category: "milestone", title: "Fastest to 18 wickets in a season", value: "8 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "fastest-20-wickets", category: "milestone", title: "Fastest to 20 wickets in a season", value: "8 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "fastest-22-wickets", category: "milestone", title: "Fastest to 22 wickets in a season", value: "10 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "fastest-24-wickets", category: "milestone", title: "Fastest to 24 wickets in a season", value: "11 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "fastest-25-wickets", category: "milestone", title: "Fastest to 25 wickets in a season", value: "13 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "fastest-26-wickets", category: "milestone", title: "Fastest to 26 wickets in a season", value: "11 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "fastest-28-wickets", category: "milestone", title: "Fastest to 28 wickets in a season", value: "14 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "fastest-30-wickets", category: "milestone", title: "Fastest to 30 wickets in a season", value: "14 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },
  { id: "fastest-32-wickets", category: "milestone", title: "Fastest to 32 wickets in a season (All-time record)", value: "15 matches", holder: "Harshal Patel", season: "2021", source: "IPL records", verified: true },

  // --- SEASON RUN SPEED MILESTONES ---
  { id: "fastest-300-balls", category: "milestone", title: "Fastest to 300 runs in a season (by balls)", value: "186 balls", holder: "Chris Gayle", season: "2011", source: "IPL records", verified: true },
  { id: "fastest-400-balls", category: "milestone", title: "Fastest to 400 runs in a season (by balls)", value: "248 balls", holder: "Chris Gayle", season: "2011", source: "IPL records", verified: true },
  { id: "fastest-500-balls", category: "milestone", title: "Fastest to 500 runs in a season (by balls)", value: "320 balls", holder: "Chris Gayle", season: "2011", source: "IPL records", verified: true },
  { id: "fastest-600-balls", category: "milestone", title: "Fastest to 600 runs in a season (by balls)", value: "394 balls", holder: "Chris Gayle", season: "2011", source: "IPL records", verified: true },
  { id: "fastest-700-balls", category: "milestone", title: "Fastest to 700 runs in a season (by balls)", value: "472 balls", holder: "Chris Gayle", season: "2012", source: "IPL records", verified: true },
  { id: "fastest-800-balls", category: "milestone", title: "Fastest to 800 runs in a season (by balls)", value: "540 balls", holder: "Chris Gayle", season: "2012", source: "IPL records", verified: true },
  { id: "fastest-900-balls", category: "milestone", title: "Fastest to 900 runs in a season (by balls)", value: "612 balls", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },
  { id: "fastest-973-balls", category: "milestone", title: "Fastest to 973 runs in a season (by balls - All-time record)", value: "638 balls", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },

  { id: "fastest-300-innings", category: "milestone", title: "Fastest to 300 runs in a season (by innings)", value: "6 innings", holder: "Chris Gayle / Shaun Marsh", season: "2011/2008", source: "IPL records", verified: true },
  { id: "fastest-400-innings", category: "milestone", title: "Fastest to 400 runs in a season (by innings)", value: "7 innings", holder: "Chris Gayle / Jos Buttler", season: "2011/2022", source: "IPL records", verified: true },
  { id: "fastest-500-innings", category: "milestone", title: "Fastest to 500 runs in a season (by innings)", value: "9 innings", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },
  { id: "fastest-600-innings", category: "milestone", title: "Fastest to 600 runs in a season (by innings)", value: "11 innings", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },
  { id: "fastest-700-innings", category: "milestone", title: "Fastest to 700 runs in a season (by innings)", value: "12 innings", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },
  { id: "fastest-800-innings", category: "milestone", title: "Fastest to 800 runs in a season (by innings)", value: "13 innings", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },
  { id: "fastest-900-innings", category: "milestone", title: "Fastest to 900 runs in a season (by innings)", value: "15 innings", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },
  { id: "fastest-973-innings", category: "milestone", title: "Fastest to 973 runs in a season (by innings - All-time record)", value: "16 innings", holder: "Virat Kohli", season: "2016", source: "IPL records", verified: true },

  // --- MOST RUNS IN A SEASON BY AGE (21-39) ---
  { id: "runs-by-age-20", category: "milestone", title: "Most runs in a single season under age 21 (U21)", value: "778 runs", holder: "Vaibhav Sooryavanshi", season: "2026", notes: "RR", source: "IPL records", verified: true },
  { id: "runs-by-age-21", category: "milestone", title: "Most runs in a single season at age 21", value: "684 runs", holder: "Rishabh Pant", season: "2018", notes: "DC", source: "IPL records", verified: true },
  { id: "runs-by-age-22", category: "milestone", title: "Most runs in a single season at age 22", value: "625 runs", holder: "Yashasvi Jaiswal", season: "2023", notes: "RR", source: "IPL records", verified: true },
  { id: "runs-by-age-23", category: "milestone", title: "Most runs in a single season at age 23", value: "573 runs", holder: "Riyan Parag", season: "2024", notes: "RR", source: "IPL records", verified: true },
  { id: "runs-by-age-24", category: "milestone", title: "Most runs in a single season at age 24", value: "890 runs", holder: "Shubman Gill", season: "2023", notes: "GT", source: "IPL records", verified: true },
  { id: "runs-by-age-25", category: "milestone", title: "Most runs in a single season at age 25", value: "722 runs", holder: "B Sai Sudharsan", season: "2026", notes: "GT", source: "IPL records", verified: true },
  { id: "runs-by-age-26", category: "milestone", title: "Most runs in a single season at age 26", value: "659 runs", holder: "KL Rahul", season: "2018", notes: "PBKS", source: "IPL records", verified: true },
  { id: "runs-by-age-27", category: "milestone", title: "Most runs in a single season at age 27", value: "732 runs", holder: "Shubman Gill", season: "2026", notes: "GT", source: "IPL records", verified: true },
  { id: "runs-by-age-28", category: "milestone", title: "Most runs in a single season at age 28", value: "973 runs", holder: "Virat Kohli", season: "2016", notes: "RCB", source: "IPL records", verified: true },
  { id: "runs-by-age-29", category: "milestone", title: "Most runs in a single season at age 29", value: "660 runs", holder: "Robin Uthappa", season: "2014", notes: "KKR", source: "IPL records", verified: true },
  { id: "runs-by-age-30", category: "milestone", title: "Most runs in a single season at age 30", value: "848 runs", holder: "David Warner", season: "2016", notes: "SRH", source: "IPL records", verified: true },
  { id: "runs-by-age-31", category: "milestone", title: "Most runs in a single season at age 31", value: "641 runs", holder: "David Warner", season: "2017", notes: "SRH", source: "IPL records", verified: true },
  { id: "runs-by-age-32", category: "milestone", title: "Most runs in a single season at age 32", value: "863 runs", holder: "Jos Buttler", season: "2022", notes: "RR", source: "IPL records", verified: true },
  { id: "runs-by-age-33", category: "milestone", title: "Most runs in a single season at age 33", value: "733 runs", holder: "Chris Gayle", season: "2012", notes: "RCB", source: "IPL records", verified: true },
  { id: "runs-by-age-34", category: "milestone", title: "Most runs in a single season at age 34", value: "708 runs", holder: "Chris Gayle", season: "2013", notes: "RCB", source: "IPL records", verified: true },
  { id: "runs-by-age-35", category: "milestone", title: "Most runs in a single season at age 35", value: "717 runs", holder: "Suryakumar Yadav", season: "2025", notes: "MI", source: "IPL records", verified: true },
  { id: "runs-by-age-36", category: "milestone", title: "Most runs in a single season at age 36", value: "741 runs", holder: "Virat Kohli", season: "2024", notes: "RCB", source: "IPL records", verified: true },
  { id: "runs-by-age-37", category: "milestone", title: "Most runs in a single season at age 37", value: "657 runs", holder: "Virat Kohli", season: "2025", notes: "RCB", source: "IPL records", verified: true },
  { id: "runs-by-age-38", category: "milestone", title: "Most runs in a single season at age 38", value: "733 runs", holder: "Michael Hussey", season: "2013", notes: "CSK", source: "IPL records", verified: true },
  { id: "runs-by-age-39", category: "milestone", title: "Most runs in a single season at age 39", value: "730 runs", holder: "Faf du Plessis", season: "2023", notes: "RCB", source: "IPL records", verified: true },
  { id: "runs-by-age-40", category: "milestone", title: "Most runs in a single season at age 40", value: "414 runs", holder: "MS Dhoni", season: "2021", notes: "CSK", source: "IPL records", verified: true },
  { id: "runs-by-age-41", category: "milestone", title: "Most runs in a single season at age 41", value: "232 runs", holder: "MS Dhoni", season: "2023", notes: "CSK", source: "IPL records", verified: true },
  { id: "runs-by-age-42", category: "milestone", title: "Most runs in a single season at age 42", value: "161 runs", holder: "MS Dhoni", season: "2024", notes: "CSK", source: "IPL records", verified: true },
  { id: "runs-by-age-43", category: "milestone", title: "Most runs in a single season at age 43", value: "104 runs", holder: "MS Dhoni", season: "2025", notes: "CSK", source: "IPL records", verified: true },
  { id: "runs-by-age-44", category: "milestone", title: "Most runs in a single season at age 44", value: "84 runs", holder: "MS Dhoni", season: "2026", notes: "CSK", source: "IPL records", verified: true },

  // --- MOST WICKETS IN A SEASON BY AGE (U21-44) ---
  { id: "wickets-by-age-20", category: "milestone", title: "Most wickets in a single season under age 21 (U21)", value: "21 wickets", holder: "Rashid Khan", season: "2018", notes: "SRH", source: "IPL records", verified: true },
  { id: "wickets-by-age-21", category: "milestone", title: "Most wickets in a single season at age 21", value: "21 wickets", holder: "Pragyan Ojha", season: "2010", notes: "Deccan", source: "IPL records", verified: true },
  { id: "wickets-by-age-22", category: "milestone", title: "Most wickets in a single season at age 22", value: "18 wickets", holder: "Pragyan Ojha", season: "2009", notes: "Deccan", source: "IPL records", verified: true },
  { id: "wickets-by-age-23", category: "milestone", title: "Most wickets in a single season at age 23", value: "28 wickets", holder: "James Faulkner", season: "2013", notes: "RR", source: "IPL records", verified: true },
  { id: "wickets-by-age-24", category: "milestone", title: "Most wickets in a single season at age 24", value: "25 wickets", holder: "Kagiso Rabada", season: "2019", notes: "DC", source: "IPL records", verified: true },
  { id: "wickets-by-age-25", category: "milestone", title: "Most wickets in a single season at age 25", value: "30 wickets", holder: "Kagiso Rabada", season: "2020", notes: "DC", source: "IPL records", verified: true },
  { id: "wickets-by-age-26", category: "milestone", title: "Most wickets in a single season at age 26", value: "27 wickets", holder: "Jasprit Bumrah", season: "2020", notes: "MI", source: "IPL records", verified: true },
  { id: "wickets-by-age-27", category: "milestone", title: "Most wickets in a single season at age 27", value: "26 wickets", holder: "Bhuvneshwar Kumar", season: "2017", notes: "SRH", source: "IPL records", verified: true },
  { id: "wickets-by-age-28", category: "milestone", title: "Most wickets in a single season at age 28", value: "28 wickets", holder: "Lasith Malinga", season: "2011", notes: "MI", source: "IPL records", verified: true },
  { id: "wickets-by-age-29", category: "milestone", title: "Most wickets in a single season at age 29", value: "32 wickets", holder: "Dwayne Bravo", season: "2013", notes: "CSK", source: "IPL records", verified: true },
  { id: "wickets-by-age-30", category: "milestone", title: "Most wickets in a single season at age 30", value: "29 wickets", holder: "Kagiso Rabada", season: "2026", notes: "PBKS", source: "IPL records", verified: true },
  { id: "wickets-by-age-31", category: "milestone", title: "Most wickets in a single season at age 31", value: "32 wickets", holder: "Harshal Patel", season: "2021", notes: "RCB", source: "IPL records", verified: true },
  { id: "wickets-by-age-32", category: "milestone", title: "Most wickets in a single season at age 32", value: "27 wickets", holder: "Yuzvendra Chahal", season: "2022", notes: "RR", source: "IPL records", verified: true },
  { id: "wickets-by-age-33", category: "milestone", title: "Most wickets in a single season at age 33", value: "28 wickets", holder: "Mohammed Shami", season: "2023", notes: "GT", source: "IPL records", verified: true },
  { id: "wickets-by-age-34", category: "milestone", title: "Most wickets in a single season at age 34", value: "22 wickets", holder: "Lasith Malinga", season: "2017", notes: "MI", source: "IPL records", verified: true },
  { id: "wickets-by-age-35", category: "milestone", title: "Most wickets in a single season at age 35", value: "27 wickets", holder: "Mohit Sharma", season: "2023", notes: "GT", source: "IPL records", verified: true },
  { id: "wickets-by-age-36", category: "milestone", title: "Most wickets in a single season at age 36", value: "28 wickets", holder: "Bhuvneshwar Kumar", season: "2026", notes: "RCB", source: "IPL records", verified: true },
  { id: "wickets-by-age-37", category: "milestone", title: "Most wickets in a single season at age 37", value: "22 wickets", holder: "Ashish Nehra", season: "2015", notes: "CSK", source: "IPL records", verified: true },
  { id: "wickets-by-age-38", category: "milestone", title: "Most wickets in a single season at age 38", value: "15 wickets", holder: "Muttiah Muralitharan", season: "2010", notes: "CSK", source: "IPL records", verified: true },
  { id: "wickets-by-age-39", category: "milestone", title: "Most wickets in a single season at age 39", value: "19 wickets", holder: "Shane Warne", season: "2008", notes: "RR", source: "IPL records", verified: true },
  { id: "wickets-by-age-40", category: "milestone", title: "Most wickets in a single season at age 40", value: "26 wickets", holder: "Imran Tahir", season: "2019", notes: "CSK", source: "IPL records", verified: true },
  { id: "wickets-by-age-41", category: "milestone", title: "Most wickets in a single season at age 41", value: "11 wickets", holder: "Shane Warne", season: "2010", notes: "RR", source: "IPL records", verified: true },
  { id: "wickets-by-age-42", category: "milestone", title: "Most wickets in a single season at age 42", value: "15 wickets", holder: "Imran Tahir", season: "2021", notes: "CSK", source: "IPL records", verified: true },
  { id: "wickets-by-age-43", category: "milestone", title: "Most wickets in a single season at age 43", value: "13 wickets", holder: "Shane Warne", season: "2011", notes: "RR", source: "IPL records", verified: true },
  { id: "wickets-by-age-44", category: "milestone", title: "Most wickets in a single season at age 44", value: "9 wickets", holder: "Brad Hogg", season: "2015", notes: "KKR", source: "IPL records", verified: true },
];

export function applyMinorRecordBaselineUpdates(records: readonly MinorRecord[]): MinorRecord[] {
  const rrHighestScore = MINOR_RECORDS.find((record) => record.id === "highest-score-rr");
  if (!rrHighestScore) return [...records];

  const savedRecord = records.find((record) => record.id === rrHighestScore.id);
  if (!savedRecord) return [...records, { ...rrHighestScore }];

  const savedRuns = Number.parseInt(savedRecord.value.split("/")[0], 10);
  const baselineRuns = Number.parseInt(rrHighestScore.value.split("/")[0], 10);
  if (Number.isFinite(savedRuns) && savedRuns > baselineRuns) return [...records];

  return records.map((record) => (
    record.id === rrHighestScore.id ? { ...rrHighestScore } : record
  ));
}
