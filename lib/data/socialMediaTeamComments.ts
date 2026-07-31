const TEAM_REFERENCES: Record<string, string[]> = {
  MI: [
    "Duniya Hila Denge still captures exactly what Mumbai cricket should feel like", "the MI Paltan turning Wankhede blue and gold remains one of the league's great sights",
    "Rohit Sharma leading Mumbai through five championship seasons created an impossible standard", "Sachin Tendulkar wearing Mumbai colours gave this franchise its original heartbeat",
    "Lasith Malinga defending nine in the final over of the 2019 final will never stop feeling miraculous", "the one-run win over Pune in the 2017 final remains peak Mumbai resilience",
    "Kieron Pollard repeatedly rescuing impossible chases made him a true Mumbai icon", "Jasprit Bumrah developing from an unusual young quick into a global superstar defines MI scouting",
    "the 2015 recovery from a terrible start to becoming champions should inspire every struggling MI side", "Mumbai's 2020 team was one of the most complete XIs this competition has seen",
    "Hardik Pandya and Krunal Pandya emerging together showed how well Mumbai once developed overlooked talent", "Suryakumar Yadav finding his best cricket after returning to Mumbai changed both player and franchise",
    "the 2013 title finally turned years of promise into a genuine dynasty", "Wankhede should always encourage fearless chasing rather than cautious cricket",
    "Mahela Jayawardene and Rohit Sharma built a calm winning culture that supporters still expect", "the blue-and-gold shirt carries five-title pressure every time somebody puts it on",
    "Mumbai finding elite Indian talent before everybody else used to be the franchise's greatest advantage", "Pollard versus CSK became one of the most entertaining individual rivalries in IPL history",
    "Malinga's final IPL delivery winning a trophy is a finish no scriptwriter could improve", "MI supporters will always believe a late-season winning streak is possible",
  ],
  CSK: [
    "Whistle Podu is more than a slogan when Chepauk is roaring behind Chennai", "Yellove has become one of the strongest identities anywhere in franchise cricket",
    "MS Dhoni walking out at Chepauk still creates a noise no other entrance can match", "Suresh Raina earned the name Mr IPL by making Chennai's biggest nights his own",
    "Ravindra Jadeja hitting ten from the final two balls in 2023 gave CSK its perfect last-ball memory", "Shane Watson batting through injury in the 2018 final embodied Chennai's comeback season",
    "returning from two years away and immediately winning the 2018 title was extraordinary", "Murali Vijay's 95 in the 2011 final remains one of CSK's great championship innings",
    "Dwayne Bravo brought wickets, celebrations and personality to an entire Chennai era", "the Ashwin-Dhoni combination helped turn Chepauk into a tactical fortress",
    "Stephen Fleming's continuity has been as important to CSK as any auction signing", "Chennai backing experienced players repeatedly proved that age and decline are not the same thing",
    "the 2010 title began a culture where CSK expected to reach every playoff", "the 2021 title was the perfect answer to everybody who called the squad finished",
    "Ruturaj Gaikwad carrying the next generation matters deeply after the Dhoni era", "the bond between Chennai supporters and overseas icons like Hussey and Bravo is special",
    "Chepauk spin conditions should always be an advantage CSK understand better than visitors", "Dhoni's finishing made an entire generation believe no chase was dead",
    "five titles mean Chennai should never accept merely competing for fourth place", "Anbuden is fitting because loyalty has always defined the relationship between CSK and its fans",
  ],
  KKR: [
    "Korbo Lorbo Jeetbo is the standard every KKR side is expected to embody", "Eden Gardens under lights in purple and gold is one of cricket's greatest stages",
    "Gautam Gambhir transforming KKR into champions changed the franchise forever", "Manvinder Bisla's 89 in the 2012 final produced KKR's first perfect night",
    "Manish Pandey's 94 in the 2014 final completed an unforgettable championship chase", "Sunil Narine reinventing himself from mystery spinner to explosive opener is pure KKR ingenuity",
    "Andre Russell at full power has produced some of the most frightening hitting the IPL has seen", "Rinku Singh's five consecutive sixes created a moment KKR supporters will tell forever",
    "the 2024 title restored KKR to the top tier of IPL franchises", "Varun Chakravarthy continuing KKR's mystery-spin tradition feels completely right",
    "Brendon McCullum's 158 in the first IPL match gave Kolkata a permanent place in league history", "Yusuf Pathan's fearless hitting was made for the Eden Gardens crowd",
    "Robin Uthappa's consistency powered the remarkable winning run of 2014", "KKR are at their best when bold tactics matter more than conventional reputations",
    "purple and gold should always represent aggression rather than cautious survival", "Eden supporters appreciate effort and personality as much as star status",
    "Narine and Russell becoming long-term Kolkata icons shows the value of genuine franchise loyalty", "KKR's strongest teams have always combined elite spin with fearless middle-order power",
    "three championships give this club a history most franchises would envy", "Rinku's rise from squad player to Indian finisher is exactly the story fans want KKR to create",
  ],
  RCB: [
    "Ee Sala Cup Namdu finally becoming reality made years of belief worthwhile", "Virat Kohli's loyalty to Bengaluru is one of the defining stories of the IPL",
    "Kohli scoring 973 runs in 2016 remains the greatest batting season this league has witnessed", "Chris Gayle's unbeaten 175 at Chinnaswamy still feels like a video-game performance",
    "AB de Villiers made impossible shots feel normal whenever Bengaluru needed magic", "the Kohli-AB partnership against Gujarat in 2016 was batting from another planet",
    "the first championship proved that RCB support was never dependent on trophies", "Chinnaswamy's small boundaries demand courage from bowlers and relentless intent from batters",
    "Anil Kumble's five-wicket spell in 2009 belongs in every RCB history lesson", "Gayle, Kohli and AB together created the most glamorous top order of their era",
    "the red-and-black crowd remained loyal through heartbreak that would have broken other fanbases", "Mohammed Siraj's journey from difficult seasons to attack leader deserved the supporters' patience",
    "Rajat Patidar's playoff hundred announced a player built for major occasions", "Yuzvendra Chahal becoming an elite IPL spinner at batting-friendly Chinnaswamy was remarkable",
    "RCB's identity should always be attacking cricket with personality", "every Bengaluru season carries enormous pressure because the fanbase expects moments, not anonymity",
    "Kohli removing his helmet after finally winning the title is an image supporters will never forget", "the franchise's greatest strength has always been emotional connection with its stars",
    "Chinnaswamy chants can make an away player feel like the match is already slipping", "after finally reaching the summit, RCB should think like champions rather than hopeful outsiders",
  ],
  DC: [
    "Roar Macha should represent a fearless Delhi side rather than another rebuild", "the Kotla crowd deserves a team with a settled identity and long-term core",
    "Virender Sehwag gave the original Delhi Daredevils their most natural attacking personality", "Rishabh Pant's unbeaten 128 in 2018 remains one of Delhi's greatest individual innings",
    "reaching the 2020 final proved Delhi could build a genuine contender", "Shreyas Iyer captaining a young side to the final was a major moment in the franchise's growth",
    "Kagiso Rabada's Purple Cap season gave Delhi a world-class cutting edge", "Shikhar Dhawan's consistency helped turn Delhi from prospects into finalists",
    "Amit Mishra's wickets made him one of the most important players in Delhi IPL history", "David Warner's early Delhi years remind supporters how much elite talent has passed through the club",
    "the move from Daredevils to Capitals was supposed to signal a more stable era", "Delhi's best teams have combined young Indian batting with serious overseas pace",
    "the 2009 side topping the league stage remains a reminder of opportunities lost", "the 2012 team looked powerful enough to end the title wait before the playoffs went wrong",
    "Arun Jaitley Stadium demands adaptable bowlers because defending straight boundaries is difficult", "Delhi supporters have waited too long for the first title to accept directionless seasons",
    "Pant's fearless batting embodies exactly how a Delhi team should play", "Axar Patel's growth into a complete all-rounder has been one of Delhi's smartest investments",
    "the blue-and-red identity needs continuity instead of another annual reset", "a first Delhi championship would mean more because of every near miss that came before it",
  ],
  SRH: [
    "the Orange Army deserves a side as fearless as the colour it fills Hyderabad with", "David Warner's leadership and runs made the 2016 championship possible",
    "Ben Cutting's final cameo in 2016 remains one of the most valuable short innings in IPL history", "Bhuvneshwar Kumar winning consecutive Purple Caps defined Hyderabad's bowling-first identity",
    "Rashid Khan made world-class spin feel routine during his SRH years", "Kane Williamson leading Hyderabad to the 2018 final showed calm leadership at its best",
    "Warner's 848 runs in 2016 powered an entire title campaign", "the 2013 debut season reaching the playoffs established SRH immediately",
    "Hyderabad supporters will always value elite bowling more than fashionable names", "the Head-Abhishek opening partnership changed how aggressively an IPL powerplay could be played",
    "scoring 277 and then 287 in 2024 shattered the old limits of team batting", "Pat Cummins brought an attacking captaincy style that matched the new batting identity",
    "Rajiv Gandhi Stadium should feel like an Orange Army fortress", "Dale Steyn bowling in orange gave the young franchise instant fast-bowling credibility",
    "Shikhar Dhawan's consistency was vital during SRH's early seasons", "the franchise is strongest when Indian bowling depth supports explosive overseas quality",
    "the 2016 eliminator-to-title run showed Hyderabad could win without a top-two safety net", "supporters still measure every overseas opener against Warner's extraordinary standard",
    "SRH's greatest sides have never been afraid to defend totals", "orange-and-black cricket should combine powerplay aggression with bowlers trusted to attack",
  ],
  PBKS: [
    "Sadda Punjab captures the energy supporters still want reflected on the field", "the 2014 team remains the benchmark every Punjab squad is judged against",
    "Glenn Maxwell's 2014 hitting made Punjab the most entertaining side in the league", "Virender Sehwag's 122 in the 2014 qualifier was a perfect high-pressure innings",
    "Wriddhiman Saha's final hundred deserved to be remembered even though the title escaped", "Shaun Marsh winning the first Orange Cap gave Punjab an original IPL hero",
    "Yuvraj Singh leading the 2008 side connected the franchise instantly to Punjab cricket", "David Miller's 101 from 38 balls created the legend of Killer Miller",
    "KL Rahul's unbeaten 132 remains one of the finest Punjab innings", "Arshdeep Singh developing into an international death bowler is a major franchise success",
    "Mohali under lights should be one of the most intimidating away trips in the league", "Dharamsala provides Punjab with the most spectacular second home in the IPL",
    "supporters have endured too many name changes and near misses to settle for another reset", "the red-and-silver shirt needs a stable core that lasts longer than one auction cycle",
    "Punjab's fearless 2014 cricket showed exactly how this franchise can capture neutral fans", "Preity Zinta's visible passion has remained constant through every difficult season",
    "the franchise has often found explosive batters but struggled to preserve a complete attack", "a first Punjab title would release nearly two decades of frustration",
    "Saha, Maxwell, Miller and Sehwag made the 2014 final run unforgettable", "Punjab cricket should always be bold, emotional and willing to take the game on",
  ],
  RR: [
    "Halla Bol still sounds right for a Rajasthan side built to challenge bigger names", "Shane Warne turning unfancied players into 2008 champions created the franchise mythology",
    "the 2008 title remains the greatest underdog triumph in IPL history", "Yusuf Pathan's all-round performance in the inaugural final made him a Rajasthan immortal",
    "Sohail Tanvir's 6/14 set a bowling standard that lasted for years", "Shane Watson becoming a world-class all-rounder at Rajasthan showed the power of player development",
    "Rahul Dravid gave a young Royals squad credibility and calm leadership", "Sanju Samson growing from prospect to long-term captain is a genuine franchise story",
    "Jos Buttler's four hundreds drove Rajasthan back to the 2022 final", "Yuzvendra Chahal winning the Purple Cap in 2022 was an inspired signing",
    "Yashasvi Jaiswal's rapid rise represents everything Rajasthan scouting should pursue", "Vaibhav Suryavanshi's 35-ball century added a new chapter to the Royals' youth tradition",
    "the pink Jaipur crowd has become one of the IPL's most distinctive identities", "Rajasthan should never lose the courage to back unknown domestic talent",
    "reaching the 2022 final proved the club could contend again after a long wait", "Warne's faith in players others overlooked must remain part of Rajasthan's DNA",
    "the Royals are most authentic when smart recruitment defeats bigger budgets", "Sawai Mansingh Stadium should reward tactical bowling and fearless top-order batting",
    "one title from the very first season means Rajasthan history can never be dismissed", "every young Royals player is measured against the development stories that came before",
  ],
  GT: [
    "Aava De perfectly suits a Gujarat side that arrived without fear", "winning the title in the franchise's debut season was an extraordinary statement",
    "Hardik Pandya's all-round performance in the 2022 final completed a remarkable captaincy campaign", "Shubman Gill's 890-run 2023 season carried Gujarat back to another final",
    "Sai Sudharsan's 96 in the 2023 final deserved a championship ending", "Mohammed Shami's 2023 Purple Cap gave Gujarat relentless powerplay threat",
    "Rashid Khan's consistency made GT competitive even when matches looked lost", "Rahul Tewatia repeatedly finishing improbable chases created instant franchise folklore",
    "David Miller's calm finishing was essential to the first title", "Wriddhiman Saha's powerplay aggression balanced Gujarat's original batting order perfectly",
    "the Narendra Modi Stadium crowd saw a home title in GT's very first year", "losing the 2023 final from the final two balls remains the franchise's first great heartbreak",
    "Gujarat's early success came from defined roles rather than collecting the biggest names", "Ashish Nehra's relaxed coaching style became inseparable from the team's rise",
    "GT should protect the calm decision-making that distinguished its first two seasons", "navy-and-gold already carries more final experience than several older franchises",
    "Gill taking responsibility for the next era feels central to Gujarat's future", "the bowling attack has always been the foundation beneath Gujarat's finishers",
    "two finals in the first two seasons created expectations no new franchise had faced", "Aava De should always mean Gujarat attack pressure rather than wait for mistakes",
  ],
  LSG: [
    "Gazab Andaaz should mean Lucknow play with personality rather than caution", "reaching the playoffs in each of the first two seasons was a strong franchise beginning",
    "KL Rahul gave LSG immediate credibility as its first captain and batting star", "Quinton de Kock's unbeaten 140 in a 210-run opening stand remains an astonishing LSG night",
    "Marcus Stoinis scoring 124 not out in Chennai produced one of the franchise's greatest chases", "Nicholas Pooran's power makes him the kind of player Lucknow should build around",
    "Mayank Yadav's extreme pace gave LSG supporters a genuine breakout sensation", "Mohsin Khan defending eleven in the final over after injury showed remarkable nerve",
    "Ayush Badoni developing into a reliable Indian batter validates Lucknow's youth scouting", "Ravi Bishnoi has been central to LSG's identity from the very first season",
    "Ekana's difficult surface should be an advantage rather than an excuse for timid batting", "the blue-and-orange support in Lucknow deserves a clearer home style",
    "the franchise has reached playoffs but still needs its first defining knockout victory", "Lucknow's strongest combinations have balanced Pooran's power with serious Indian bowling",
    "Stoinis and Pooran have produced the late-over hitting every new franchise needs", "the first LSG title will require learning how to handle eliminator pressure",
    "supporters want Gazab Andaaz reflected in aggressive selections and tactics", "LSG have already discovered several Indian talents despite being a young franchise",
    "the Ekana crowd is still waiting for a championship memory to call its own", "Lucknow should create traditions around its own heroes rather than imitate older clubs",
  ],
};

export interface TeamCommentEvent {
  won: boolean;
  opponent: string;
  score: number;
  wickets: number;
  chased: boolean;
  closeMatch: boolean;
  consecutiveWins: number;
  consecutiveLosses: number;
  stage?: string;
  battingPerformance?: { name: string; runs: number; balls: number };
  bowlingPerformance?: { name: string; wickets: number; runsConceded: number; overs: number };
  allRoundPerformance?: { name: string; runs: number; wickets: number };
  seed: number;
}

type TeamHistoryCategory = "batting" | "bowling" | "all_round" | "big_game" | "team";

const TEAM_CATEGORY_ADDITIONS: Record<string, Partial<Record<TeamHistoryCategory, string[]>>> = {
  MI: {
    batting: ["Kieron Pollard's 87 not out against Chennai in 2021 remains one of Mumbai's defining power-hitting chases"],
    all_round: ["Kieron Pollard's greatest Mumbai performances combined decisive hitting, useful wickets and elite fielding"],
  },
  CSK: { all_round: ["Ravindra Jadeja's batting, bowling and fielding have repeatedly changed major matches for Chennai"] },
  KKR: { all_round: ["Andre Russell's best Kolkata nights have combined explosive runs with decisive wickets"] },
  RCB: { all_round: ["Jacques Kallis gave Bengaluru genuine match-winning value with both bat and ball"] },
  DC: { all_round: ["Axar Patel's growth into a player capable of changing games with both bat and ball is a major Delhi success"] },
  SRH: { all_round: ["Hyderabad's strongest balanced performances have come when an all-rounder contributes in both innings"] },
  PBKS: { all_round: ["Yuvraj Singh's ability to influence matches with batting, bowling and fielding set an early Punjab standard"] },
  RR: { all_round: ["Shane Watson became a Rajasthan icon by winning matches with both bat and ball"] },
  GT: { all_round: ["Hardik Pandya's runs and wickets in the 2022 final completed Gujarat's first championship"] },
  LSG: { all_round: ["Marcus Stoinis gives Lucknow its clearest example of a player capable of changing a match in both disciplines"] },
};

const historyCategory = (reference: string): TeamHistoryCategory => {
  if (/all-round/i.test(reference)) return "all_round";
  if (/bowl|wicket|spin|pace|attack|defend|yorker|purple cap|maiden/i.test(reference)) return "bowling";
  if (/batting|batter|runs|hitting|opener|innings|hundred|century|orange cap|six|score|partnership|finisher/i.test(reference)) return "batting";
  if (/final|title|champion|trophy|playoff|summit/i.test(reference)) return "big_game";
  return "team";
};

export const getTeamHistoryCategoryCounts = (teamId: string): Record<TeamHistoryCategory, number> => (
  (TEAM_REFERENCES[teamId] ?? []).reduce<Record<TeamHistoryCategory, number>>((counts, reference) => {
    counts[historyCategory(reference)] += 1;
    return counts;
  }, {
    batting: TEAM_CATEGORY_ADDITIONS[teamId]?.batting?.length ?? 0,
    bowling: TEAM_CATEGORY_ADDITIONS[teamId]?.bowling?.length ?? 0,
    all_round: TEAM_CATEGORY_ADDITIONS[teamId]?.all_round?.length ?? 0,
    big_game: TEAM_CATEGORY_ADDITIONS[teamId]?.big_game?.length ?? 0,
    team: TEAM_CATEGORY_ADDITIONS[teamId]?.team?.length ?? 0,
  })
);

/**
 * Returns franchise-history reactions only when the latest match supplies a
 * matching current-season trigger. The history colours the reaction; it is
 * never used as an unprompted filler post.
 */
export function getTriggeredTeamSocialComments(teamId: string, event: TeamCommentEvent): string[] {
  const references = TEAM_REFERENCES[teamId] ?? [];
  const byCategory = references.reduce<Record<TeamHistoryCategory, string[]>>((groups, reference) => {
    groups[historyCategory(reference)].push(reference);
    return groups;
  }, { batting: [], bowling: [], all_round: [], big_game: [], team: [] });
  (Object.entries(TEAM_CATEGORY_ADDITIONS[teamId] ?? {}) as Array<[TeamHistoryCategory, string[]]>).forEach(([category, additions]) => {
    byCategory[category].push(...additions);
  });
  const candidates: Array<{ key: string; text: string }> = [];
  const add = (category: TeamHistoryCategory, lead: string) => {
    byCategory[category].forEach((reference) => {
      candidates.push({ key: `${category}:${reference}`, text: `${lead} It brings back how ${reference}.` });
    });
  };

  const batting = event.battingPerformance;
  const battingStrikeRate = batting?.balls ? batting.runs / batting.balls * 100 : 0;
  const eliteBatting = Boolean(batting && (batting.runs >= 90 || (batting.runs >= 75 && battingStrikeRate >= 140)));
  const bowling = event.bowlingPerformance;
  const bowlingEconomy = bowling?.overs ? bowling.runsConceded / bowling.overs : Number.POSITIVE_INFINITY;
  const eliteBowling = Boolean(bowling && (bowling.wickets >= 4 || (bowling.wickets >= 3 && bowling.overs >= 3 && bowlingEconomy <= 6.5)));
  const allRound = event.allRoundPerformance;
  const eliteAllRound = Boolean(allRound && ((allRound.runs >= 35 && allRound.wickets >= 2) || (allRound.runs >= 50 && allRound.wickets >= 1)));
  const knockoutWin = Boolean(event.won && event.stage && ["qualifier1", "eliminator", "qualifier2", "final"].includes(event.stage));
  const eliteTeamWin = event.won && (event.consecutiveWins >= 3 || event.score >= 200 || (event.chased && event.score >= 190) || event.closeMatch);

  const stageLabel = event.stage === "qualifier1" ? "Qualifier 1"
    : event.stage === "qualifier2" ? "Qualifier 2"
      : event.stage === "eliminator" ? "the Eliminator"
        : "the Final";
  if (knockoutWin) add("big_game", `Winning ${stageLabel} against ${event.opponent} is a genuine big-game achievement for this season.`);
  if (eliteAllRound && allRound) add("all_round", `${allRound.name}'s ${allRound.runs} runs and ${allRound.wickets} wickets against ${event.opponent} is rare enough to merit an all-round franchise comparison.`);
  if (eliteBatting && batting) add("batting", `${batting.name}'s ${batting.runs} from ${batting.balls} against ${event.opponent} clears the high standard for a batting-history comparison.`);
  if (eliteBowling && bowling) add("bowling", `${bowling.name}'s ${bowling.wickets}/${bowling.runsConceded} against ${event.opponent} clears the high standard for a bowling-history comparison.`);
  if (eliteTeamWin) add("team", `${event.score}/${event.wickets} in a win over ${event.opponent}${event.consecutiveWins >= 3 ? ` made it ${event.consecutiveWins} wins in succession` : ""}. That is a team achievement worthy of club-history context.`);
  const unique = Array.from(new Map(candidates.map((candidate) => [candidate.key, candidate.text])).values());
  if (!unique.length) return [];
  const start = event.seed % unique.length;
  // One historical comparison per match is enough. Multiple qualifying facts
  // from the same innings should not summon several different club legends.
  return [...unique.slice(start), ...unique.slice(0, start)].slice(0, 1);
}
