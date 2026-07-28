import type { Player } from "@/lib/types";

export type ClubFigureTier = "legend" | "icon" | "hero";
export type ClubFigureTierOverrides = Record<string, ClubFigureTier>;

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

function getLegacyClubFigureOverrideKey(teamId: string, playerId: string | null, name: string): string {
  return `${teamId}:${playerId ?? normalizeClubFigureName(name)}`;
}

export function getClubFigures(
  teamId: string,
  players: Record<string, Player>,
  tierOverrides: ClubFigureTierOverrides = {},
): ResolvedClubFigure[] {
  const playerByName = new Map<string, Player>();
  Object.values(players).forEach((player) => {
    playerByName.set(normalizeClubFigureName(player.name), player);
  });

  return (CLUB_FIGURES[teamId] ?? []).map((figure) => {
    const possibleNames = [figure.name, ...(PLAYER_NAME_ALIASES[figure.name] ?? [])];
    const linkedPlayer = possibleNames
      .map((name) => playerByName.get(normalizeClubFigureName(name)))
      .find((player): player is Player => Boolean(player));
    const playerId = linkedPlayer?.id ?? null;
    const legacyOverrideKey = getLegacyClubFigureOverrideKey(teamId, playerId, figure.name);

    return {
      id: figure.id,
      name: linkedPlayer?.name ?? figure.name,
      baseTier: figure.tier,
      tier: tierOverrides[figure.id] ?? tierOverrides[legacyOverrideKey] ?? figure.tier,
      playerId,
      currentTeamId: linkedPlayer?.currentTeamId ?? null,
      isLinked: playerId !== null,
    };
  });
}
