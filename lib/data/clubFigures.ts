import type { Player } from "@/lib/types";

export type ClubFigureTier = "legend" | "icon" | "hero";
export type ClubFigureTierOverrides = Record<string, ClubFigureTier>;

export interface ClubFigureProgressRecord {
  id: string;
  teamId: string;
  playerId: string;
  playerName: string;
  points: number;
  seasonKeys: string[];
  processedSeasons: number[];
  tier: ClubFigureTier | null;
  promotions?: Array<{
    season: number;
    tier: "icon" | "legend";
  }>;
}

export type ClubFigureProgression = Record<string, ClubFigureProgressRecord>;

interface ClubFigureDefinition {
  id: string;
  name: string;
  tier: ClubFigureTier;
}

export interface ResolvedClubFigure {
  id: string;
  name: string;
  baseTier: ClubFigureTier;
  tier: ClubFigureTier;
  playerId: string | null;
  currentTeamId: string | null;
  isLinked: boolean;
  legacyPoints?: number;
  clubSeasons?: number;
}

const figures = (
  teamId: string,
  legends: string[],
  icons: string[],
  heroes: string[],
): ClubFigureDefinition[] => [
  ...legends.map((name) => ({ id: getClubFigureId(teamId, name), name, tier: "legend" as const })),
  ...icons.map((name) => ({ id: getClubFigureId(teamId, name), name, tier: "icon" as const })),
  ...heroes.map((name) => ({ id: getClubFigureId(teamId, name), name, tier: "hero" as const })),
];

const CLUB_FIGURES: Record<string, ClubFigureDefinition[]> = {
  MI: figures(
    "MI",
    ["Rohit Sharma", "Sachin Tendulkar", "Lasith Malinga"],
    ["Kieron Pollard", "Jasprit Bumrah", "Harbhajan Singh", "Zaheer Khan", "Mitchell McClenaghan"],
    ["Suryakumar Yadav", "Hardik Pandya", "Ambati Rayudu", "Ishan Kishan", "Krunal Pandya", "Lendl Simmons", "Dwayne Smith"],
  ),
  CSK: figures(
    "CSK",
    ["MS Dhoni", "Suresh Raina", "Ravindra Jadeja"],
    ["Dwayne Bravo", "Michael Hussey", "Ravichandran Ashwin", "Murali Vijay", "Subramaniam Badrinath"],
    ["Shane Watson", "Faf du Plessis", "Ruturaj Gaikwad", "Deepak Chahar", "Albie Morkel", "Imran Tahir", "Mohit Sharma"],
  ),
  KKR: figures(
    "KKR",
    ["Gautam Gambhir", "Sunil Narine", "Andre Russell"],
    ["Sourav Ganguly", "Yusuf Pathan", "Jacques Kallis", "Piyush Chawla", "Varun Chakravarthy"],
    ["Manish Pandey", "Robin Uthappa", "Rinku Singh", "Venkatesh Iyer", "Nitish Rana", "Shubman Gill", "Kuldeep Yadav"],
  ),
  RCB: figures(
    "RCB",
    ["Virat Kohli", "AB de Villiers", "Chris Gayle"],
    ["Yuzvendra Chahal", "Anil Kumble", "Rahul Dravid", "Glenn Maxwell", "Rajat Patidar"],
    ["Vinay Kumar", "Mohammed Siraj", "Faf du Plessis", "Dale Steyn", "Mitchell Starc", "Harshal Patel", "Devdutt Padikkal"],
  ),
  SRH: figures(
    "SRH",
    ["David Warner", "Bhuvneshwar Kumar", "Rashid Khan"],
    ["Kane Williamson", "Shikhar Dhawan", "T. Natarajan", "Jonny Bairstow", "Moises Henriques"],
    ["Ben Cutting", "Sandeep Sharma", "Heinrich Klaasen", "Manish Pandey", "Abhishek Sharma", "Siddarth Kaul", "Wriddhiman Saha"],
  ),
  RR: figures(
    "RR",
    ["Shane Warne", "Sanju Samson", "Jos Buttler"],
    ["Shane Watson", "Ajinkya Rahane", "Yusuf Pathan", "Rahul Dravid", "Steve Smith"],
    ["Yuzvendra Chahal", "James Faulkner", "Sohail Tanvir", "Jofra Archer", "Yashasvi Jaiswal", "Pravin Tambe", "Rahul Tewatia"],
  ),
  DC: figures(
    "DC",
    ["Virender Sehwag", "Rishabh Pant", "Amit Mishra"],
    ["Shreyas Iyer", "David Warner", "Kagiso Rabada", "Shikhar Dhawan", "JP Duminy"],
    ["Axar Patel", "Morne Morkel", "Prithvi Shaw", "Kuldeep Yadav", "Ishant Sharma", "Chris Morris", "Quinton de Kock"],
  ),
  PBKS: figures(
    "PBKS",
    ["Yuvraj Singh", "Shaun Marsh", "David Miller"],
    ["KL Rahul", "Glenn Maxwell", "Piyush Chawla", "Virender Sehwag", "Sandeep Sharma"],
    ["George Bailey", "Arshdeep Singh", "Wriddhiman Saha", "Chris Gayle", "Mohammed Shami", "Axar Patel", "Irfan Pathan"],
  ),
  GT: figures(
    "GT",
    ["Hardik Pandya", "Rashid Khan", "Shubman Gill"],
    ["Mohammed Shami", "David Miller", "Sai Sudharsan", "Noor Ahmad", "Sai Kishore"],
    ["Rahul Tewatia", "Mohit Sharma", "Wriddhiman Saha", "Vijay Shankar", "Matthew Wade", "Abhinav Manohar", "Yash Dayal"],
  ),
  LSG: figures(
    "LSG",
    ["KL Rahul", "Nicholas Pooran", "Ravi Bishnoi"],
    ["Quinton de Kock", "Marcus Stoinis", "Krunal Pandya", "Avesh Khan", "Deepak Hooda"],
    ["Ayush Badoni", "Mohsin Khan", "Mayank Yadav", "Kyle Mayers", "Naveen-ul-Haq", "Yash Thakur", "Mark Wood"],
  ),
};

const PLAYER_NAME_ALIASES: Record<string, string[]> = {
  "T. Natarajan": ["T Natarajan", "Thangarasu Natarajan"],
  "Sai Kishore": ["R Sai Kishore", "R. Sai Kishore"],
};

export function normalizeClubFigureName(name: string): string {
  return name.toLocaleLowerCase("en-GB").replace(/[^a-z0-9]/g, "");
}

export function getClubFigureId(teamId: string, name: string): string {
  return `${teamId}:${normalizeClubFigureName(name)}`;
}

const TIER_RANK: Record<ClubFigureTier, number> = { hero: 1, icon: 2, legend: 3 };

export function clubFigureTierFloor(tier: ClubFigureTier): number {
  return tier === "legend" ? 220 : tier === "icon" ? 120 : 50;
}

export function higherClubFigureTier(
  left: ClubFigureTier | null,
  right: ClubFigureTier | null,
): ClubFigureTier | null {
  if (!left) return right;
  if (!right) return left;
  return TIER_RANK[left] >= TIER_RANK[right] ? left : right;
}

export function getBaseClubFigureTier(teamId: string, playerName: string): ClubFigureTier | null {
  const normalizedName = normalizeClubFigureName(playerName);
  return (CLUB_FIGURES[teamId] ?? []).find((figure) => {
    const possibleNames = [figure.name, ...(PLAYER_NAME_ALIASES[figure.name] ?? [])];
    return possibleNames.some((name) => normalizeClubFigureName(name) === normalizedName);
  })?.tier ?? null;
}

function getLegacyClubFigureOverrideKey(teamId: string, playerId: string | null, name: string): string {
  return `${teamId}:${playerId ?? normalizeClubFigureName(name)}`;
}

export function getClubFigures(
  teamId: string,
  players: Record<string, Player>,
  tierOverrides: ClubFigureTierOverrides = {},
  progression: ClubFigureProgression = {},
): ResolvedClubFigure[] {
  const playerByName = new Map<string, Player>();
  Object.values(players).forEach((player) => {
    playerByName.set(normalizeClubFigureName(player.name), player);
  });

  const resolved = (CLUB_FIGURES[teamId] ?? []).map((figure) => {
    const possibleNames = [figure.name, ...(PLAYER_NAME_ALIASES[figure.name] ?? [])];
    const linkedPlayer = possibleNames
      .map((name) => playerByName.get(normalizeClubFigureName(name)))
      .find((player): player is Player => Boolean(player));
    const playerId = linkedPlayer?.id ?? null;
    const legacyOverrideKey = getLegacyClubFigureOverrideKey(teamId, playerId, figure.name);
    const progress = Object.values(progression).find((record) => (
      record.teamId === teamId
      && (record.playerId === playerId || normalizeClubFigureName(record.playerName) === normalizeClubFigureName(figure.name))
    ));
    const progressedTier = higherClubFigureTier(figure.tier, progress?.tier ?? null) ?? figure.tier;
    const overriddenTier = tierOverrides[figure.id] ?? tierOverrides[legacyOverrideKey] ?? null;

    return {
      id: figure.id,
      name: linkedPlayer?.name ?? figure.name,
      baseTier: figure.tier,
      tier: higherClubFigureTier(progressedTier, overriddenTier) ?? progressedTier,
      playerId,
      currentTeamId: linkedPlayer?.currentTeamId ?? null,
      isLinked: playerId !== null,
      legacyPoints: progress?.points ?? clubFigureTierFloor(figure.tier),
      clubSeasons: progress?.seasonKeys.length,
    };
  });

  Object.values(progression)
    .filter((record) => record.teamId === teamId && record.tier)
    .forEach((record) => {
      const existing = resolved.find((figure) => (
        figure.playerId === record.playerId
        || normalizeClubFigureName(figure.name) === normalizeClubFigureName(record.playerName)
      ));
      if (existing) return;
      const linkedPlayer = players[record.playerId];
      const overriddenTier = tierOverrides[record.id] ?? null;
      resolved.push({
        id: record.id,
        name: linkedPlayer?.name ?? record.playerName,
        baseTier: record.tier!,
        tier: higherClubFigureTier(record.tier, overriddenTier) ?? record.tier!,
        playerId: linkedPlayer?.id ?? null,
        currentTeamId: linkedPlayer?.currentTeamId ?? null,
        isLinked: Boolean(linkedPlayer),
        legacyPoints: record.points,
        clubSeasons: record.seasonKeys.length,
      });
    });

  return resolved;
}
