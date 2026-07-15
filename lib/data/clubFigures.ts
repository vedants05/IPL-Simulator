import type { Player } from "@/lib/types";

export type ClubFigureTier = "legend" | "icon" | "hero";
export type ClubFigureTierOverrides = Record<string, ClubFigureTier>;

interface ClubFigureDefinition {
  name: string;
  tier: ClubFigureTier;
}

export interface ResolvedClubFigure {
  name: string;
  baseTier: ClubFigureTier;
  tier: ClubFigureTier;
  playerId: string | null;
  currentTeamId: string | null;
  overrideKey: string;
  isLinked: boolean;
}

const figures = (
  legends: string[],
  icons: string[],
  heroes: string[],
): ClubFigureDefinition[] => [
  ...legends.map((name) => ({ name, tier: "legend" as const })),
  ...icons.map((name) => ({ name, tier: "icon" as const })),
  ...heroes.map((name) => ({ name, tier: "hero" as const })),
];

const CLUB_FIGURES: Record<string, ClubFigureDefinition[]> = {
  MI: figures(
    ["Rohit Sharma", "Sachin Tendulkar", "Lasith Malinga"],
    ["Kieron Pollard", "Jasprit Bumrah", "Harbhajan Singh"],
    ["Suryakumar Yadav", "Hardik Pandya", "Ambati Rayudu"],
  ),
  CSK: figures(
    ["MS Dhoni", "Suresh Raina", "Ravindra Jadeja"],
    ["Dwayne Bravo", "Michael Hussey", "Ravichandran Ashwin"],
    ["Shane Watson", "Faf du Plessis", "Ruturaj Gaikwad"],
  ),
  KKR: figures(
    ["Gautam Gambhir", "Sunil Narine", "Andre Russell"],
    ["Sourav Ganguly", "Yusuf Pathan", "Jacques Kallis"],
    ["Manish Pandey", "Robin Uthappa", "Rinku Singh"],
  ),
  RCB: figures(
    ["Virat Kohli", "AB de Villiers", "Chris Gayle"],
    ["Yuzvendra Chahal", "Anil Kumble", "Rahul Dravid"],
    ["Rajat Patidar", "Mohammed Siraj", "Faf du Plessis"],
  ),
  SRH: figures(
    ["David Warner", "Bhuvneshwar Kumar", "Rashid Khan"],
    ["Kane Williamson", "Shikhar Dhawan", "T. Natarajan"],
    ["Ben Cutting", "Sandeep Sharma", "Heinrich Klaasen"],
  ),
  RR: figures(
    ["Shane Warne", "Sanju Samson", "Jos Buttler"],
    ["Shane Watson", "Ajinkya Rahane", "Yusuf Pathan"],
    ["Yuzvendra Chahal", "James Faulkner", "Sohail Tanvir"],
  ),
  DC: figures(
    ["Virender Sehwag", "Rishabh Pant", "Amit Mishra"],
    ["Shreyas Iyer", "David Warner", "Kagiso Rabada"],
    ["Axar Patel", "Morne Morkel", "Prithvi Shaw"],
  ),
  PBKS: figures(
    ["Yuvraj Singh", "Shaun Marsh", "David Miller"],
    ["KL Rahul", "Glenn Maxwell", "Piyush Chawla"],
    ["George Bailey", "Arshdeep Singh", "Wriddhiman Saha"],
  ),
  GT: figures(
    ["Hardik Pandya", "Rashid Khan", "Shubman Gill"],
    ["Mohammed Shami", "David Miller", "Sai Sudharsan"],
    ["Rahul Tewatia", "Mohit Sharma", "Wriddhiman Saha"],
  ),
  LSG: figures(
    ["KL Rahul", "Nicholas Pooran", "Ravi Bishnoi"],
    ["Quinton de Kock", "Marcus Stoinis", "Krunal Pandya"],
    ["Ayush Badoni", "Mohsin Khan", "Mayank Yadav"],
  ),
};

const PLAYER_NAME_ALIASES: Record<string, string[]> = {
  "T. Natarajan": ["T Natarajan", "Thangarasu Natarajan"],
};

export function normalizeClubFigureName(name: string): string {
  return name.toLocaleLowerCase("en-GB").replace(/[^a-z0-9]/g, "");
}

export function getClubFigureOverrideKey(teamId: string, playerId: string | null, name: string): string {
  return `${teamId}:${playerId ?? normalizeClubFigureName(name)}`;
}

export function promoteClubFigureTier(tier: ClubFigureTier): ClubFigureTier {
  if (tier === "hero") return "icon";
  return "legend";
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
    const overrideKey = getClubFigureOverrideKey(teamId, playerId, figure.name);

    return {
      name: linkedPlayer?.name ?? figure.name,
      baseTier: figure.tier,
      tier: tierOverrides[overrideKey] ?? figure.tier,
      playerId,
      currentTeamId: linkedPlayer?.currentTeamId ?? null,
      overrideKey,
      isLinked: playerId !== null,
    };
  });
}
