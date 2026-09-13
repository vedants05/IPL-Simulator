import type { Player } from "@/lib/types";
import { generateIndianStateRegenName, selectIndianRegenState } from "@/lib/data/indianStateRegenNames";

export type SmatDivision = "elite" | "plate";
export type SmatRole = Player["role"];

export interface SmatTeamDefinition {
  id: string;
  name: string;
  shortName: string;
  division: SmatDivision;
  strength: number;
}

export interface SmatSquadPlayer {
  id: string;
  fullPlayerId?: string;
  name: string;
  teamId: string;
  age: number;
  role: SmatRole;
  batting: number;
  bowling: number;
  potential: number;
  /** Recognised batting positions, numbered 1-11. */
  battingPositions?: number[];
}

export interface SmatPlayerStats {
  matches: number;
  runs: number;
  wickets: number;
  balls?: number;
  dismissals?: number;
  bowlingInnings?: number;
  bowlingBalls?: number;
  runsConceded?: number;
}

export interface SmatFixture {
  id: string;
  date: string;
  stage: "elite-group" | "plate-group" | "super-league" | "plate-final" | "final";
  group: string;
  teamA: string;
  teamB: string;
  played: boolean;
  winner?: string;
  scoreA?: { runs: number; wickets: number };
  scoreB?: { runs: number; wickets: number };
  playerStats?: Record<string, SmatPlayerStats>;
  scorecard?: {
    inningsA: SmatInningsScorecard;
    inningsB: SmatInningsScorecard;
  };
}

export interface SmatInningsScorecard {
  batting: Array<{ playerId: string; name: string; runs: number; balls: number; dismissed: boolean }>;
  bowling: Array<{ playerId: string; name: string; balls: number; runs: number; wickets: number }>;
}

export interface SmatStanding {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  runsFor: number;
  runsAgainst: number;
  nrr: number;
}

export interface SmatSeasonArchive {
  season: number;
  champion: string;
  runnerUp: string;
  plateChampion: string;
  promoted: string[];
  relegated: string[];
  eliteTables: Record<string, SmatStanding[]>;
  plateTable: SmatStanding[];
  knockoutResults: Array<Pick<SmatFixture, "stage" | "teamA" | "teamB" | "winner" | "scoreA" | "scoreB">>;
  leadingRunScorer?: { playerId: string; name: string; teamId: string; value: number };
  leadingWicketTaker?: { playerId: string; name: string; teamId: string; value: number };
}

export interface SmatSeason {
  season: number;
  retentionDate: string;
  startsOn: string;
  endsOn: string;
  squads: Record<string, SmatSquadPlayer[]>;
  fixtures: SmatFixture[];
  tables: Record<string, SmatStanding[]>;
  playerStats: Record<string, SmatPlayerStats>;
  completed: boolean;
}

export interface SmatCareerState {
  version: 1;
  activeSeason: SmatSeason | null;
  history: SmatSeasonArchive[];
  playerCareerStats: Record<string, SmatPlayerStats>;
}

const PLATE_IDS = new Set(["ARUNACHAL", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "SIKKIM"]);
const TEAM_ROWS: Array<[string, string, string, number]> = [
  ["ANDHRA", "Andhra", "AP", 68], ["ARUNACHAL", "Arunachal Pradesh", "ARP", 45],
  ["ASSAM", "Assam", "ASM", 61], ["BARODA", "Baroda", "BRD", 78],
  ["BENGAL", "Bengal", "BEN", 77], ["BIHAR", "Bihar", "BIH", 55],
  ["CHANDIGARH", "Chandigarh", "CHD", 59], ["CHHATTISGARH", "Chhattisgarh", "CG", 60],
  ["DELHI", "Delhi", "DEL", 76], ["GOA", "Goa", "GOA", 58],
  ["GUJARAT", "Gujarat", "GUJ", 72], ["HARYANA", "Haryana", "HAR", 73],
  ["HIMACHAL", "Himachal Pradesh", "HP", 67], ["HYDERABAD", "Hyderabad", "HYD", 71],
  ["JAMMU_KASHMIR", "Jammu & Kashmir", "J&K", 64], ["JHARKHAND", "Jharkhand", "JHA", 69],
  ["KARNATAKA", "Karnataka", "KAR", 81], ["KERALA", "Kerala", "KER", 70],
  ["MADHYA_PRADESH", "Madhya Pradesh", "MP", 75], ["MAHARASHTRA", "Maharashtra", "MAH", 70],
  ["MANIPUR", "Manipur", "MAN", 46], ["MEGHALAYA", "Meghalaya", "MEG", 48],
  ["MIZORAM", "Mizoram", "MIZ", 45], ["MUMBAI", "Mumbai", "MUM", 84],
  ["NAGALAND", "Nagaland", "NAG", 49], ["ODISHA", "Odisha", "ODI", 62],
  ["PONDICHERRY", "Pondicherry", "PON", 58], ["PUNJAB", "Punjab", "PUN", 80],
  ["RAILWAYS", "Railways", "RLY", 65], ["RAJASTHAN", "Rajasthan", "RAJ", 69],
  ["SAURASHTRA", "Saurashtra", "SAU", 76], ["SERVICES", "Services", "SER", 60],
  ["SIKKIM", "Sikkim", "SIK", 44], ["TAMIL_NADU", "Tamil Nadu", "TN", 82],
  ["TRIPURA", "Tripura", "TRI", 54], ["UTTAR_PRADESH", "Uttar Pradesh", "UP", 77],
  ["UTTARAKHAND", "Uttarakhand", "UTK", 63], ["VIDARBHA", "Vidarbha", "VID", 79],
];

export const SMAT_TEAMS: SmatTeamDefinition[] = TEAM_ROWS.map(([id, name, shortName, strength]) => ({
  id, name, shortName, strength, division: PLATE_IDS.has(id) ? "plate" : "elite",
}));

const aliases: Record<string, string> = {
  "ANDHRA PRADESH": "ANDHRA", "ARUNACHAL PRADESH": "ARUNACHAL", "HIMACHAL PRADESH": "HIMACHAL",
  "JAMMU AND KASHMIR": "JAMMU_KASHMIR", "JAMMU & KASHMIR": "JAMMU_KASHMIR", "MADHYA PRADESH": "MADHYA_PRADESH",
  "TAMIL NADU": "TAMIL_NADU", "UTTAR PRADESH": "UTTAR_PRADESH", "JHARKHAND STATE": "JHARKHAND",
};

function domesticTeamId(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase().replace(/[.-]/g, " ").replace(/\s+/g, " ");
  return aliases[normalized] ?? SMAT_TEAMS.find((team) => team.name.toUpperCase() === normalized || team.id === normalized.replace(/ /g, "_"))?.id;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

function random(seed: string, min = 0, max = 1): number {
  return min + (hash(seed) / 4294967295) * (max - min);
}

function dateOffset(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function roleFor(index: number): SmatRole {
  if (index === 0) return "WK-Batsman";
  if (index <= 5) return "Batsman";
  if (index <= 8) return "All-Rounder";
  if (index <= 11) return "Pace Bowler";
  return "Spin Bowler";
}

function fullPlayerBattingPositions(player: Player): number[] {
  const positions:number[] = [];
  if (player.isOpener) positions.push(1, 2);
  if (player.hasBattedAt3) positions.push(3);
  if (player.hasBattedAt4) positions.push(4);
  if (player.hasBattedAt5) positions.push(5);
  if (player.hasBattedAt6) positions.push(6);
  if (player.hasBattedAt7 || player.isFinisher) positions.push(7);
  if (!positions.length) {
    if (player.role === "Batsman" || player.role === "WK-Batsman") positions.push(3, 4, 5);
    else if (player.role === "All-Rounder") positions.push(5, 6, 7);
    else positions.push(8, 9, 10, 11);
  }
  return Array.from(new Set(positions));
}

function generatedBattingPositions(role:SmatRole, roleIndex:number):number[] {
  if (role === "WK-Batsman") return [1, 2, 3];
  if (role === "Batsman") return roleIndex < 2 ? [1, 2, 3] : roleIndex < 4 ? [3, 4, 5] : [5, 6, 7];
  if (role === "All-Rounder") return [5, 6, 7];
  return [8, 9, 10, 11];
}

const SMAT_TEAM_NAME_STATE: Record<string, string> = {
  ANDHRA: "andhra-pradesh", ARUNACHAL: "arunachal-pradesh", ASSAM: "assam", BARODA: "gujarat",
  BENGAL: "west-bengal", BIHAR: "bihar", CHANDIGARH: "punjab", CHHATTISGARH: "chhattisgarh",
  DELHI: "delhi", GOA: "goa", GUJARAT: "gujarat", HARYANA: "haryana", HIMACHAL: "himachal-pradesh",
  HYDERABAD: "telangana", JAMMU_KASHMIR: "jammu-kashmir", JHARKHAND: "jharkhand", KARNATAKA: "karnataka",
  KERALA: "kerala", MADHYA_PRADESH: "madhya-pradesh", MAHARASHTRA: "maharashtra", MANIPUR: "manipur",
  MEGHALAYA: "meghalaya", MIZORAM: "mizoram", MUMBAI: "maharashtra", NAGALAND: "nagaland",
  ODISHA: "odisha", PONDICHERRY: "tamil-nadu", PUNJAB: "punjab", RAJASTHAN: "rajasthan",
  SAURASHTRA: "gujarat", SIKKIM: "sikkim", TAMIL_NADU: "tamil-nadu", TRIPURA: "tripura",
  UTTAR_PRADESH: "uttar-pradesh", UTTARAKHAND: "uttarakhand", VIDARBHA: "maharashtra",
};

function generatedPlayerName(season: number, teamId: string, index: number, existingNames: Iterable<string>): string {
  let call = 0;
  const seeded = () => random(`${season}:${teamId}:${index}:state-name:${call++}`);
  const stateId = SMAT_TEAM_NAME_STATE[teamId] ?? selectIndianRegenState(seeded).id;
  return generateIndianStateRegenName(stateId, seeded, existingNames);
}

function createSquads(players: Record<string, Player>, season: number): Record<string, SmatSquadPlayer[]> {
  const squads = Object.fromEntries(SMAT_TEAMS.map((team) => [team.id, [] as SmatSquadPlayer[]]));
  const usedNames = new Set(Object.values(players).map((player) => player.name));
  Object.values(players).filter((player) => player.nationality === "Indian").forEach((player) => {
    const teamId = domesticTeamId(player.state);
    if (!teamId || !squads[teamId]) return;
    squads[teamId].push({
      id: `full:${player.id}`, fullPlayerId: player.id, name: player.name, teamId, age: player.age, role: player.role,
      batting: player.currentBatting, bowling: player.currentBowling,
      potential: Math.max(player.potentialBatting, player.potentialBowling),
      battingPositions: fullPlayerBattingPositions(player),
    });
  });
  SMAT_TEAMS.forEach((team) => {
    squads[team.id].sort((a, b) => Math.max(b.batting, b.bowling) - Math.max(a.batting, a.bowling));
    while (squads[team.id].length < 15) {
      const index = squads[team.id].length;
      const targets:Record<SmatRole,number> = { "WK-Batsman":1, Batsman:5, "All-Rounder":3, "Pace Bowler":3, "Spin Bowler":3 };
      const counts = squads[team.id].reduce((result, player) => ({ ...result, [player.role]: result[player.role] + 1 }), { "WK-Batsman":0, Batsman:0, "All-Rounder":0, "Pace Bowler":0, "Spin Bowler":0 } as Record<SmatRole,number>);
      const role = (Object.keys(targets) as SmatRole[]).sort((a,b) => (targets[b]-counts[b]) - (targets[a]-counts[a]))[0] ?? roleFor(index);
      const roleIndex = counts[role];
      const centre = team.strength - 4 + random(`${season}:${team.id}:${index}:rating`, -7, 7);
      squads[team.id].push({
        id: `smat:${season}:${team.id}:${index}`,
        name: generatedPlayerName(season, team.id, index, usedNames),
        teamId: team.id,
        age: Math.round(random(`${season}:${team.id}:${index}:age`, 18, 34)),
        role,
        batting: Math.round(role === "Batsman" || role === "WK-Batsman" ? centre + 4 : role === "All-Rounder" ? centre : centre - 14),
        bowling: Math.round(role === "Pace Bowler" || role === "Spin Bowler" ? centre + 4 : role === "All-Rounder" ? centre : centre - 15),
        potential: Math.min(92, Math.round(centre + random(`${season}:${team.id}:${index}:potential`, 2, 12))),
        battingPositions: generatedBattingPositions(role, roleIndex),
      });
      usedNames.add(squads[team.id].at(-1)!.name);
    }
  });
  return squads;
}

function repairPlaceholderNames(season: SmatSeason, players:Record<string,Player>): SmatSeason {
  const usedNames = new Set(Object.values(season.squads).flat().filter((player) => !player.id.startsWith("smat:")).map((player) => player.name));
  const targets:Record<SmatRole,number> = { "WK-Batsman":1, Batsman:5, "All-Rounder":3, "Pace Bowler":3, "Spin Bowler":3 };
  const squads = Object.fromEntries(Object.entries(season.squads).map(([teamId, squad]) => {
    const counts = squad.filter((player) => player.fullPlayerId).reduce((result, player) => ({ ...result, [player.role]: result[player.role] + 1 }), { "WK-Batsman":0, Batsman:0, "All-Rounder":0, "Pace Bowler":0, "Spin Bowler":0 } as Record<SmatRole,number>);
    return [teamId, squad.map((player) => {
    if (!player.id.startsWith("smat:")) {
      const full = player.fullPlayerId ? players[player.fullPlayerId] : undefined;
      return full ? { ...player, role:full.role, battingPositions:fullPlayerBattingPositions(full) } : player;
    }
    const index = Number(player.id.split(":").at(-1));
    const name = generatedPlayerName(season.season, teamId, Number.isFinite(index) ? index : 0, usedNames);
    usedNames.add(name);
    const role = (Object.keys(targets) as SmatRole[]).sort((a,b) => (targets[b]-counts[b]) - (targets[a]-counts[a]))[0];
    const roleIndex = counts[role]; counts[role] += 1;
    const centre = Math.max(player.batting,player.bowling)-4;
    return { ...player, name, role, battingPositions:generatedBattingPositions(role,roleIndex), batting:Math.round(role === "Batsman" || role === "WK-Batsman" ? centre+4 : role === "All-Rounder" ? centre : centre-14), bowling:Math.round(role === "Pace Bowler" || role === "Spin Bowler" ? centre+4 : role === "All-Rounder" ? centre : centre-15) };
  })]; }));
  return { ...season, squads };
}

function roundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const rotating = [...teamIds];
  const rounds: Array<Array<[string, string]>> = [];
  for (let round = 0; round < rotating.length - 1; round += 1) {
    const games: Array<[string, string]> = [];
    for (let index = 0; index < rotating.length / 2; index += 1) games.push([rotating[index], rotating[rotating.length - 1 - index]]);
    rounds.push(games);
    rotating.splice(1, 0, rotating.pop()!);
  }
  return rounds;
}

function fixture(id: string, date: string, stage: SmatFixture["stage"], group: string, teams: [string, string]): SmatFixture {
  return { id, date, stage, group, teamA: teams[0], teamB: teams[1], played: false };
}

function createInitialFixtures(retentionDate: string, previousArchive?: SmatSeasonArchive): SmatFixture[] {
  const previousPlate = previousArchive?.plateTable.map((row) => row.teamId);
  const plate = previousPlate
    ? [...previousPlate.filter((id) => !previousArchive!.promoted.includes(id)), ...previousArchive!.relegated]
    : SMAT_TEAMS.filter((team) => team.division === "plate").map((team) => team.id);
  const plateIds = new Set(plate);
  const elite = SMAT_TEAMS.filter((team) => !plateIds.has(team.id)).map((team) => team.id);
  const fixtures: SmatFixture[] = [];
  for (let groupIndex = 0; groupIndex < 4; groupIndex += 1) {
    const group = String.fromCharCode(65 + groupIndex);
    roundRobin(elite.filter((_, index) => index % 4 === groupIndex)).forEach((games, round) => {
      games.forEach((teams, index) => fixtures.push(fixture(`elite-${group}-${round}-${index}`, dateOffset(retentionDate, -25 + round * 2), "elite-group", group, teams)));
    });
  }
  roundRobin(plate).forEach((games, round) => {
    games.forEach((teams, index) => fixtures.push(fixture(`plate-${round}-${index}`, dateOffset(retentionDate, -25 + round * 2), "plate-group", "Plate", teams)));
  });
  return fixtures;
}

function emptyTable(ids: string[]): SmatStanding[] {
  return ids.map((teamId) => ({ teamId, played: 0, won: 0, lost: 0, points: 0, runsFor: 0, runsAgainst: 0, nrr: 0 }));
}

function calculateTables(fixtures: SmatFixture[]): Record<string, SmatStanding[]> {
  const groups = ["A", "B", "C", "D", "Plate", "S1", "S2"];
  const result: Record<string, SmatStanding[]> = {};
  groups.forEach((group) => {
    const ids = Array.from(new Set(fixtures.filter((match) => match.group === group).flatMap((match) => [match.teamA, match.teamB])));
    const table = emptyTable(ids);
    const byId = new Map(table.map((row) => [row.teamId, row]));
    fixtures.filter((match) => match.group === group && match.played && match.scoreA && match.scoreB).forEach((match) => {
      const a = byId.get(match.teamA)!; const b = byId.get(match.teamB)!;
      a.played += 1; b.played += 1; a.runsFor += match.scoreA!.runs; a.runsAgainst += match.scoreB!.runs;
      b.runsFor += match.scoreB!.runs; b.runsAgainst += match.scoreA!.runs;
      if (match.winner === match.teamA) { a.won += 1; b.lost += 1; a.points += 4; } else { b.won += 1; a.lost += 1; b.points += 4; }
    });
    table.forEach((row) => { row.nrr = row.played ? Number(((row.runsFor - row.runsAgainst) / row.played / 20).toFixed(3)) : 0; });
    result[group] = table.sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won || a.teamId.localeCompare(b.teamId));
  });
  return result;
}

function selectedXI(squad: SmatSquadPlayer[]): SmatSquadPlayer[] {
  const keeper = squad.filter((p) => p.role === "WK-Batsman").sort((a, b) => b.batting - a.batting)[0];
  const specialists = squad.filter((p) => p.role === "Pace Bowler" || p.role === "Spin Bowler").sort((a, b) => b.bowling - a.bowling);
  const allRounders = squad.filter((p) => p.role === "All-Rounder").sort((a, b) => (b.batting + b.bowling) - (a.batting + a.bowling));
  const chosen = new Map<string, SmatSquadPlayer>();
  if (keeper) chosen.set(keeper.id, keeper);
  specialists.slice(0, 4).forEach((player) => chosen.set(player.id, player));
  if (allRounders[0]) chosen.set(allRounders[0].id, allRounders[0]);
  [...squad].sort((a, b) => (b.batting * 0.62 + b.bowling * 0.38) - (a.batting * 0.62 + a.bowling * 0.38))
    .forEach((player) => { if (chosen.size < 11) chosen.set(player.id, player); });
  const selected = Array.from(chosen.values());
  const ordered:Array<SmatSquadPlayer|undefined> = Array(11).fill(undefined);
  const place = (player:SmatSquadPlayer) => {
    const preferred = player.battingPositions?.filter((position) => !ordered[position - 1]) ?? [];
    const fallback = player.role === "Pace Bowler" || player.role === "Spin Bowler" ? [8,9,10,11] : player.role === "All-Rounder" ? [5,6,7] : [1,2,3,4,5,6,7];
    const position = preferred[0] ?? fallback.find((slot) => !ordered[slot - 1]) ?? ordered.findIndex((slot) => !slot) + 1;
    ordered[position - 1] = player;
  };
  selected.filter((player) => player.fullPlayerId).sort((a,b) => (a.battingPositions?.length ?? 9) - (b.battingPositions?.length ?? 9) || b.batting-a.batting).forEach(place);
  selected.filter((player) => !player.fullPlayerId).sort((a,b) => b.batting-a.batting).forEach(place);
  return ordered.filter((player):player is SmatSquadPlayer => Boolean(player));
}

function simulateFixture(match: SmatFixture, squads: Record<string, SmatSquadPlayer[]>, season: number): SmatFixture {
  const xiA = selectedXI(squads[match.teamA]); const xiB = selectedXI(squads[match.teamB]);
  const battingStrength = (xi: SmatSquadPlayer[]) => xi.slice(0, 7).reduce((sum, player) => sum + player.batting, 0) / 7;
  const bowlingStrength = (xi: SmatSquadPlayer[]) => [...xi].sort((a, b) => b.bowling - a.bowling).slice(0, 5).reduce((sum, player) => sum + player.bowling, 0) / 5;
  const batA = battingStrength(xiA), batB = battingStrength(xiB), bowlA = bowlingStrength(xiA), bowlB = bowlingStrength(xiB);
  let runsA = Math.round(150 + (batA - 65) * 1.2 - (bowlB - 65) * 0.75 + random(`${season}:${match.id}:a`, -24, 25));
  const chaseEstimate = Math.round(150 + (batB - 65) * 1.2 - (bowlA - 65) * 0.75 + random(`${season}:${match.id}:b`, -24, 25));
  let runsB = chaseEstimate > runsA ? runsA + 1 : chaseEstimate;
  runsA = Math.max(72, Math.min(245, runsA)); runsB = Math.max(72, Math.min(245, runsB));
  if (runsA === runsB) runsB += random(`${match.id}:tie`) > 0.5 ? 1 : -1;
  const wicketsA = Math.max(2, Math.min(10, Math.round(6.5 + (bowlB - batA) / 8 + random(`${match.id}:wa`, -2, 2))));
  const wicketsB = Math.max(1, Math.min(10, Math.round(6.5 + (bowlA - batB) / 8 + random(`${match.id}:wb`, -2, 2))));
  const playerStats: Record<string, SmatPlayerStats> = {};
  const allocate = (xi: SmatSquadPlayer[], opponent: SmatSquadPlayer[], runs: number, wickets: number, totalBalls: number, key: string) => {
    const battingWeights = xi.map((p, index) => Math.max(4, p.batting * (1.2 - index * 0.035) * random(`${key}:${p.id}:bat`, 0.55, 1.35)));
    const weightTotal = battingWeights.reduce((sum, value) => sum + value, 0);
    let allocated = 0; const rawBalls:number[] = [];
    xi.forEach((player, index) => {
      const value = index === xi.length - 1 ? Math.max(0, runs - allocated) : Math.round(runs * battingWeights[index] / weightTotal);
      allocated += value; rawBalls.push(Math.max(value ? 1 : 0, value / random(`${key}:${player.id}:sr`, 0.9, 1.75)));
      playerStats[player.id] = { matches: 1, runs: value, wickets: 0, balls: 0, dismissals: 0 };
    });
    const rawBallTotal = rawBalls.reduce((sum, value) => sum + value, 0) || 1; let usedBalls = 0;
    xi.forEach((player, index) => { const balls = index === xi.length - 1 ? Math.max(0, totalBalls - usedBalls) : Math.min(totalBalls - usedBalls, Math.round(rawBalls[index] * totalBalls / rawBallTotal)); playerStats[player.id].balls = balls; usedBalls += balls; });
    [...xi].sort((a, b) => (a.batting + random(`${key}:${a.id}:dismiss`, -12, 12)) - (b.batting + random(`${key}:${b.id}:dismiss`, -12, 12))).slice(0, wickets)
      .forEach((player) => { playerStats[player.id].dismissals = 1; });
    const options = [...opponent].sort((a, b) => b.bowling - a.bowling).slice(0, 6);
    const bowlerBalls = new Map(options.map((player) => [player.id, 0]));
    for (let ball = 0; ball < totalBalls; ball += 1) {
      const available = options.filter((player) => (bowlerBalls.get(player.id) ?? 0) < 24);
      const totalWeight = available.reduce((sum, player) => sum + Math.max(1, player.bowling - 30), 0);
      let pick = random(`${key}:ball:${ball}`, 0, totalWeight);
      const bowler = available.find((player) => (pick -= Math.max(1, player.bowling - 30)) <= 0) ?? available[0];
      bowlerBalls.set(bowler.id, (bowlerBalls.get(bowler.id) ?? 0) + 1);
    }
    const economyWeights = options.map((player) => Math.max(0.35, (100 - player.bowling) * random(`${key}:${player.id}:econ`, 0.8, 1.2)) * (bowlerBalls.get(player.id) ?? 0));
    const economyTotal = economyWeights.reduce((sum, value) => sum + value, 0) || 1; let conceded = 0;
    options.forEach((bowler, index) => {
      const row = playerStats[bowler.id] ?? { matches: 1, runs: 0, wickets: 0 };
      row.bowlingInnings = 1; row.bowlingBalls = bowlerBalls.get(bowler.id) ?? 0;
      row.runsConceded = index === options.length - 1 ? Math.max(0, runs - conceded) : Math.round(runs * economyWeights[index] / economyTotal); conceded += row.runsConceded;
      playerStats[bowler.id] = row;
    });
    for (let index = 0; index < wickets; index += 1) {
      const wicketWeight = options.reduce((sum, player) => sum + player.bowling ** 2, 0); let pick = random(`${key}:w:${index}`, 0, wicketWeight);
      const bowler = options.find((player) => (pick -= player.bowling ** 2) <= 0) ?? options[0];
      const row = playerStats[bowler.id] ?? { matches: 1, runs: 0, wickets: 0 }; row.wickets += 1; playerStats[bowler.id] = row;
    }
  };
  const chaseWon = runsB > runsA;
  const chaseBalls = chaseWon ? Math.max(66, Math.min(119, Math.round((runsB / Math.max(1, chaseEstimate)) * 116 + random(`${match.id}:chase-balls`, -5, 5)))) : 120;
  allocate(xiA, xiB, runsA, wicketsA, wicketsA === 10 ? Math.round(random(`${match.id}:a-balls`, 94, 119)) : 120, `${match.id}:a`);
  allocate(xiB, xiA, runsB, wicketsB, chaseBalls, `${match.id}:b`);
  const innings = (batting: SmatSquadPlayer[], bowling: SmatSquadPlayer[]): SmatInningsScorecard => ({
    batting: batting.map((player) => ({
      playerId: player.id, name: player.name, runs: playerStats[player.id]?.runs ?? 0,
      balls: playerStats[player.id]?.balls ?? 0, dismissed: Boolean(playerStats[player.id]?.dismissals),
    })),
    bowling: bowling.filter((player) => (playerStats[player.id]?.bowlingBalls ?? 0) > 0).map((player) => ({
      playerId: player.id, name: player.name, balls: playerStats[player.id]?.bowlingBalls ?? 0,
      runs: playerStats[player.id]?.runsConceded ?? 0, wickets: playerStats[player.id]?.wickets ?? 0,
    })),
  });
  return {
    ...match, played: true, winner: runsA > runsB ? match.teamA : match.teamB,
    scoreA: { runs: runsA, wickets: wicketsA }, scoreB: { runs: runsB, wickets: wicketsB }, playerStats,
    scorecard: { inningsA: innings(xiA, xiB), inningsB: innings(xiB, xiA) },
  };
}

/** Rebuild scorecards for saves created before aggregate scorecards were stored. */
export function ensureSmatFixtureScorecard(match: SmatFixture, squads: Record<string, SmatSquadPlayer[]>, season: number): SmatFixture {
  return match.scorecard ? match : simulateFixture({ ...match, played: false }, squads, season);
}

function addQualificationFixtures(season: SmatSeason): SmatSeason {
  let fixtures = season.fixtures;
  const tables = calculateTables(fixtures);
  if (!fixtures.some((match) => match.stage === "super-league") && ["A", "B", "C", "D"].every((group) => (tables[group]?.[0]?.played ?? 0) === 7)) {
    const qualifiers = ["A", "B", "C", "D"].flatMap((group) => tables[group].slice(0, 2).map((row) => row.teamId));
    const groups = [qualifiers.filter((_, index) => index % 2 === 0), qualifiers.filter((_, index) => index % 2 === 1)];
    groups.forEach((ids, groupIndex) => roundRobin(ids).forEach((games, round) => games.forEach((teams, index) => {
      fixtures = [...fixtures, fixture(`super-${groupIndex}-${round}-${index}`, dateOffset(season.retentionDate, -9 + round * 2), "super-league", `S${groupIndex + 1}`, teams)];
    })));
  }
  const refreshed = calculateTables(fixtures);
  if (!fixtures.some((match) => match.stage === "plate-final") && (refreshed.Plate?.[0]?.played ?? 0) === 5) {
    fixtures = [...fixtures, fixture("plate-final", dateOffset(season.retentionDate, -15), "plate-final", "Plate Final", [refreshed.Plate[0].teamId, refreshed.Plate[1].teamId])];
  }
  if (!fixtures.some((match) => match.stage === "final") && ["S1", "S2"].every((group) => (refreshed[group]?.[0]?.played ?? 0) === 3)) {
    fixtures = [...fixtures, fixture("elite-final", dateOffset(season.retentionDate, -3), "final", "Final", [refreshed.S1[0].teamId, refreshed.S2[0].teamId])];
  }
  return { ...season, fixtures, tables: calculateTables(fixtures) };
}

function aggregatePlayerStats(fixtures: SmatFixture[]): Record<string, SmatPlayerStats> {
  const totals: Record<string, SmatPlayerStats> = {};
  fixtures.forEach((match) => Object.entries(match.playerStats ?? {}).forEach(([id, stats]) => {
    const current = totals[id] ?? { matches: 0, runs: 0, wickets: 0 };
    current.matches += stats.matches; current.runs += stats.runs; current.wickets += stats.wickets;
    current.balls = (current.balls ?? 0) + (stats.balls ?? 0); current.dismissals = (current.dismissals ?? 0) + (stats.dismissals ?? 0);
    current.bowlingInnings = (current.bowlingInnings ?? 0) + (stats.bowlingInnings ?? 0); current.bowlingBalls = (current.bowlingBalls ?? 0) + (stats.bowlingBalls ?? 0);
    current.runsConceded = (current.runsConceded ?? 0) + (stats.runsConceded ?? 0); totals[id] = current;
  }));
  return totals;
}

export function createSmatSeason(season: number, retentionDate: string, players: Record<string, Player>, previousArchive?: SmatSeasonArchive): SmatSeason {
  const fixtures = createInitialFixtures(retentionDate, previousArchive);
  return { season, retentionDate, startsOn: dateOffset(retentionDate, -25), endsOn: dateOffset(retentionDate, -3), squads: createSquads(players, season), fixtures, tables: calculateTables(fixtures), playerStats: {}, completed: false };
}

function archiveSeason(season: SmatSeason): SmatSeasonArchive {
  const final = season.fixtures.find((match) => match.stage === "final")!;
  const plateFinal = season.fixtures.find((match) => match.stage === "plate-final")!;
  const playerById = new Map(Object.values(season.squads).flat().map((player) => [player.id, player]));
  const leaders = Object.entries(season.playerStats);
  const runs = [...leaders].sort((a, b) => b[1].runs - a[1].runs)[0]; const wickets = [...leaders].sort((a, b) => b[1].wickets - a[1].wickets)[0];
  const eliteTables = Object.fromEntries(["A", "B", "C", "D"].map((group) => [group, season.tables[group] ?? []]));
  const relegated = Object.values(eliteTables).map((table) => table.at(-1)?.teamId).filter((id): id is string => Boolean(id)).sort().slice(0, 2);
  const promoted = (season.tables.Plate ?? []).slice(0, 2).map((row) => row.teamId);
  const leader = (row: [string, SmatPlayerStats] | undefined, value: "runs" | "wickets") => row ? { playerId: row[0], name: playerById.get(row[0])?.name ?? row[0], teamId: playerById.get(row[0])?.teamId ?? "", value: row[1][value] } : undefined;
  return { season: season.season, champion: final.winner!, runnerUp: final.winner === final.teamA ? final.teamB : final.teamA, plateChampion: plateFinal.winner!, promoted, relegated, eliteTables, plateTable: season.tables.Plate ?? [], knockoutResults: season.fixtures.filter((match) => match.stage !== "elite-group" && match.stage !== "plate-group").map(({ stage, teamA, teamB, winner, scoreA, scoreB }) => ({ stage, teamA, teamB, winner, scoreA, scoreB })), leadingRunScorer: leader(runs, "runs"), leadingWicketTaker: leader(wickets, "wickets") };
}

export function reconcileSmatCareer(state: SmatCareerState | null, season: number, retentionDate: string, currentDate: string, players: Record<string, Player>): SmatCareerState {
  let career: SmatCareerState = state?.version === 1
    ? { ...state, playerCareerStats: state.playerCareerStats ?? {} }
    : { version: 1, activeSeason: null, history: [], playerCareerStats: {} };
  if (career.activeSeason && career.activeSeason.season < season && !career.activeSeason.completed) {
    career = reconcileSmatCareer(career, career.activeSeason.season, career.activeSeason.retentionDate, career.activeSeason.endsOn, players);
  }
  if (!career.activeSeason || career.activeSeason.season !== season) {
    if (career.history.some((archive) => archive.season === season)) return career;
    const previousArchive = [...career.history].filter((archive) => archive.season < season).sort((a, b) => b.season - a.season)[0];
    career = { ...career, activeSeason: createSmatSeason(season, retentionDate, players, previousArchive) };
  }
  const currentActiveSeason = career.activeSeason ? repairPlaceholderNames(career.activeSeason, players) : null;
  if (!currentActiveSeason) return career;
  const seasonWithScorecards = {
    ...currentActiveSeason,
    fixtures: currentActiveSeason.fixtures.map((match) => (
      match.played && !match.scorecard
        ? simulateFixture({ ...match, played: false }, currentActiveSeason.squads, currentActiveSeason.season)
        : match
    )),
  };
  let active = addQualificationFixtures(seasonWithScorecards);
  let changed = false;
  active = { ...active, fixtures: active.fixtures.map((match) => {
    if (match.played || match.date > currentDate) return match;
    changed = true; return simulateFixture(match, active.squads, active.season);
  }) };
  if (changed) active = addQualificationFixtures({ ...active, playerStats: aggregatePlayerStats(active.fixtures) });
  // Newly-created qualification fixtures may also fall before a skipped-to date.
  while (active.fixtures.some((match) => !match.played && match.date <= currentDate)) {
    active = { ...active, fixtures: active.fixtures.map((match) => match.played || match.date > currentDate ? match : simulateFixture(match, active.squads, active.season)) };
    active = addQualificationFixtures({ ...active, playerStats: aggregatePlayerStats(active.fixtures) });
  }
  const finalPlayed = active.fixtures.some((match) => match.stage === "final" && match.played);
  if (finalPlayed) {
    active = { ...active, completed: true, playerStats: aggregatePlayerStats(active.fixtures), tables: calculateTables(active.fixtures) };
    const archive = archiveSeason(active);
    const isNewArchive = !career.history.some((item) => item.season === archive.season);
    const playerCareerStats = isNewArchive ? { ...career.playerCareerStats } : career.playerCareerStats;
    if (isNewArchive) Object.entries(active.playerStats).forEach(([id, stats]) => {
      const current = playerCareerStats[id] ?? { matches: 0, runs: 0, wickets: 0 };
      playerCareerStats[id] = {
        matches: current.matches + stats.matches, runs: current.runs + stats.runs, wickets: current.wickets + stats.wickets,
        balls: (current.balls ?? 0) + (stats.balls ?? 0), dismissals: (current.dismissals ?? 0) + (stats.dismissals ?? 0),
        bowlingInnings: (current.bowlingInnings ?? 0) + (stats.bowlingInnings ?? 0), bowlingBalls: (current.bowlingBalls ?? 0) + (stats.bowlingBalls ?? 0),
        runsConceded: (current.runsConceded ?? 0) + (stats.runsConceded ?? 0),
      };
    });
    return { version: 1, activeSeason: active, playerCareerStats, history: [...career.history.filter((item) => item.season !== archive.season), archive].sort((a, b) => b.season - a.season) };
  }
  return { ...career, activeSeason: { ...active, playerStats: aggregatePlayerStats(active.fixtures), tables: calculateTables(active.fixtures) } };
}

export function smatStorageKey(careerId: string): string { return `ipl_smat_${careerId}_v1`; }
