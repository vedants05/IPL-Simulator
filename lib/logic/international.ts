import type { Player } from "@/lib/types";
import { generateInternationalName } from "@/lib/data/internationalNames";
import { bilateralVenue, worldCupVenue } from "@/lib/data/internationalVenues";
import { getRelativePhaseSignal } from "@/lib/logic/matchSimulation";

export type InternationalRole = Player["role"];

export interface InternationalTeamDefinition {
  id: string;
  name: string;
  shortName: string;
  strength: number;
  core: boolean;
  startingCaptainName?: string;
}

export interface InternationalPlayerProfile {
  id: string;
  fullPlayerId?: string;
  name: string;
  countryId: string;
  age: number;
  role: InternationalRole;
  batting: number;
  bowling: number;
  captaincy: number;
  isWicketkeeper?: boolean;
  isOpener?: boolean;
  isFinisher?: boolean;
  aggression: number;
  consistency: number;
  powerplayBatting: number;
  middleOversBatting: number;
  deathBatting: number;
  powerplayBowling: number;
  middleOversBowling: number;
  deathBowling: number;
  paceRating: number;
  spinRating: number;
  battingPositions: number[];
}

export interface InternationalPlayerStats {
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  notOuts: number;
  highestScore: number;
  bowlingInnings: number;
  bowlingBalls: number;
  runsConceded: number;
  wickets: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
}

export interface InternationalInningsScorecard {
  batting: Array<[string, number, number, 0 | 1]>;
  bowling: Array<[string, number, number, number]>;
}

export interface InternationalFixture {
  id: string;
  seriesId: string;
  date: string;
  matchNumber: number;
  teamA: string;
  teamB: string;
  venue: string;
  stage: "bilateral" | "world-cup-group" | "super-eight" | "semi-final" | "final";
  played: boolean;
  winner?: string;
  scoreA?: [number, number];
  scoreB?: [number, number];
  xiA?: string[];
  xiB?: string[];
  captainA?: string;
  captainB?: string;
  playerOfTheMatchId?: string;
  scorecard?: [InternationalInningsScorecard, InternationalInningsScorecard];
}

export interface InternationalSeries {
  id: string;
  season: number;
  hostCountry: string;
  touringCountry: string;
  matchCount: 3 | 5;
  fixtureIds: string[];
  homeWins: number;
  awayWins: number;
  completed: boolean;
}

export interface NationalTeamState {
  countryId: string;
  squad: string[];
  preferredXI: string[];
  captainId: string;
  viceCaptainId?: string;
  captainAppointedSeason: number;
  captainReviewSeason: number;
  interimCaptainId?: string;
  internationalStanding: Record<string, number>;
  pendingDebuts: Record<string, number>;
}

export interface InternationalSeasonArchive {
  season: number;
  series: InternationalSeries[];
  fixtures: InternationalFixture[];
  worldCupChampion?: string;
  seasonStats?: Record<string, InternationalPlayerStats>;
  profileNames?: Record<string, string>;
}

export interface InternationalCareerState {
  version: 1;
  season: number;
  teams: Record<string, NationalTeamState>;
  profiles: Record<string, InternationalPlayerProfile>;
  series: InternationalSeries[];
  fixtures: InternationalFixture[];
  careerStats: Record<string, InternationalPlayerStats>;
  seasonStats: Record<string, InternationalPlayerStats>;
  rankings: Record<string, number>;
  qualifiers: string[];
  history: InternationalSeasonArchive[];
}

const CORE = new Set(["IND", "AUS", "ENG", "SA", "NZ", "WI", "SL"]);
const TOP_FOUR = new Set(["IND", "AUS", "ENG", "SA"]);

export const INTERNATIONAL_TEAMS: InternationalTeamDefinition[] = [
  { id: "IND", name: "India", shortName: "IND", strength: 91, core: true, startingCaptainName: "Shreyas Iyer" },
  { id: "AUS", name: "Australia", shortName: "AUS", strength: 90, core: true, startingCaptainName: "Mitchell Marsh" },
  { id: "ENG", name: "England", shortName: "ENG", strength: 89, core: true, startingCaptainName: "Harry Brook" },
  { id: "SA", name: "South Africa", shortName: "SA", strength: 88, core: true, startingCaptainName: "Aiden Markram" },
  { id: "NZ", name: "New Zealand", shortName: "NZ", strength: 84, core: true, startingCaptainName: "Mitchell Santner" },
  { id: "WI", name: "West Indies", shortName: "WI", strength: 82, core: true, startingCaptainName: "Shai Hope" },
  { id: "SL", name: "Sri Lanka", shortName: "SL", strength: 80, core: true, startingCaptainName: "Kusal Mendis" },
  { id: "PAK", name: "Pakistan", shortName: "PAK", strength: 84, core: false },
  { id: "BAN", name: "Bangladesh", shortName: "BAN", strength: 76, core: false },
  { id: "AFG", name: "Afghanistan", shortName: "AFG", strength: 82, core: false },
  { id: "ZIM", name: "Zimbabwe", shortName: "ZIM", strength: 72, core: false },
  { id: "IRE", name: "Ireland", shortName: "IRE", strength: 71, core: false },
  { id: "SCO", name: "Scotland", shortName: "SCO", strength: 70, core: false },
  { id: "NED", name: "Netherlands", shortName: "NED", strength: 71, core: false },
  { id: "NEP", name: "Nepal", shortName: "NEP", strength: 69, core: false },
  { id: "USA", name: "United States", shortName: "USA", strength: 68, core: false },
  { id: "CAN", name: "Canada", shortName: "CAN", strength: 64, core: false },
  { id: "NAM", name: "Namibia", shortName: "NAM", strength: 68, core: false },
  { id: "UAE", name: "United Arab Emirates", shortName: "UAE", strength: 67, core: false },
  { id: "OMA", name: "Oman", shortName: "OMA", strength: 65, core: false },
  { id: "PNG", name: "Papua New Guinea", shortName: "PNG", strength: 61, core: false },
  { id: "UGA", name: "Uganda", shortName: "UGA", strength: 60, core: false },
  { id: "KEN", name: "Kenya", shortName: "KEN", strength: 62, core: false },
  { id: "HKG", name: "Hong Kong", shortName: "HKG", strength: 63, core: false },
  { id: "MAS", name: "Malaysia", shortName: "MAS", strength: 59, core: false },
  { id: "ITA", name: "Italy", shortName: "ITA", strength: 61, core: false },
  { id: "JER", name: "Jersey", shortName: "JER", strength: 60, core: false },
];

const COUNTRY_ALIASES: Record<string, string> = {
  Indian: "IND", India: "IND", Australia: "AUS", England: "ENG", "South Africa": "SA",
  "New Zealand": "NZ", "West Indies": "WI", "Sri Lanka": "SL", Pakistan: "PAK",
  Bangladesh: "BAN", Afghanistan: "AFG", Zimbabwe: "ZIM", Ireland: "IRE", Scotland: "SCO",
  Netherlands: "NED", Nepal: "NEP", USA: "USA", "United States": "USA", Canada: "CAN",
  Namibia: "NAM", "United Arab Emirates": "UAE", UAE: "UAE", Oman: "OMA",
  "Papua New Guinea": "PNG", Uganda: "UGA", Kenya: "KEN", "Hong Kong": "HKG",
  Malaysia: "MAS", Italy: "ITA", Jersey: "JER",
};

const EMPTY_STATS = (): InternationalPlayerStats => ({
  matches: 0, innings: 0, runs: 0, balls: 0, notOuts: 0, highestScore: 0,
  bowlingInnings: 0, bowlingBalls: 0, runsConceded: 0, wickets: 0,
  bestBowlingWickets: 0, bestBowlingRuns: 0,
});

function randomFor(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return () => { hash += 0x6d2b79f5; let value = hash; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}

function team(id: string): InternationalTeamDefinition { return INTERNATIONAL_TEAMS.find((row) => row.id === id)!; }
function countryId(player: Player): string | undefined { return COUNTRY_ALIASES[player.country ?? player.nationality]; }
function ability(player: Player): number { return Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0); }
function roleValue(profile: InternationalPlayerProfile): number { return Math.max(profile.batting, profile.bowling) + (profile.isWicketkeeper ? 2 : 0); }
function isInternationalBowlingOption(profile: InternationalPlayerProfile): boolean { return profile.role === "Pace Bowler" || profile.role === "Spin Bowler" || profile.role === "All-Rounder"; }
function internationalBowlingFloor(profile: InternationalPlayerProfile): number {
  const country = INTERNATIONAL_TEAMS.find((row) => row.id === profile.countryId);
  return Math.min(70, Math.max(50, (country?.strength ?? 80) - 10));
}
function isCredibleInternationalBowlingOption(profile: InternationalPlayerProfile): boolean {
  return isInternationalBowlingOption(profile) && profile.bowling >= internationalBowlingFloor(profile);
}
function isInternationalBattingOption(profile: InternationalPlayerProfile): boolean { return profile.role === "Batsman" || profile.role === "WK-Batsman" || profile.role === "All-Rounder"; }
function profileBattingPositions(profile: InternationalPlayerProfile): number[] {
  if (Array.isArray(profile.battingPositions) && profile.battingPositions.length > 0) return profile.battingPositions;
  if (profile.isOpener) return [1, 2];
  if (profile.role === "Batsman" || profile.role === "WK-Batsman") return [3, 4, 5];
  if (profile.role === "All-Rounder") return [6, 7];
  return [8, 9, 10, 11];
}
function isInternationalOpener(profile: InternationalPlayerProfile): boolean { return Boolean(profile.isOpener || profileBattingPositions(profile).some((position) => position <= 2)); }

function battingPositionFit(profile: InternationalPlayerProfile, position: number): number {
  const positions = profileBattingPositions(profile);
  if (positions.includes(position)) return 14;
  const nearest = positions.length > 0
    ? Math.min(...positions.map((listed) => Math.abs(listed - position)))
    : 4;
  if (isInternationalOpener(profile)) {
    if (position === 3) return 3;
    if (position === 4) return -12;
    if (position === 5) return -22;
    if (position === 6) return -32;
    if (position === 7) return -42;
  }
  if (position <= 2) return -18 - nearest * 4;
  return -nearest * 7;
}

function optimizeTopSeven(players: InternationalPlayerProfile[]): { order: InternationalPlayerProfile[]; score: number } {
  const requiredTopSevenIds = new Set(players
    .filter((profile) => profile.isWicketkeeper || isInternationalOpener(profile))
    .map((profile) => profile.id));
  const memo = new Map<string, { score: number; ids: string[] }>();
  const solve = (position: number, usedMask: number): { score: number; ids: string[] } => {
    if (position > 7) {
      const includesRequired = Array.from(requiredTopSevenIds).every((id) => {
        const index = players.findIndex((profile) => profile.id === id);
        return index >= 0 && (usedMask & (1 << index)) !== 0;
      });
      return includesRequired ? { score: 0, ids: [] } : { score: -Infinity, ids: [] };
    }
    const key = `${position}:${usedMask}`;
    const cached = memo.get(key); if (cached) return cached;
    let best = { score: -Infinity, ids: [] as string[] };
    players.forEach((profile, index) => {
      if ((usedMask & (1 << index)) !== 0) return;
      if (position <= 2 && !isInternationalOpener(profile)) return;
      const specialistPenalty = isInternationalBattingOption(profile) ? 0 : -48;
      const slotScore = profile.batting + battingPositionFit(profile, position) + specialistPenalty;
      const tail = solve(position + 1, usedMask | (1 << index));
      if (slotScore + tail.score > best.score) best = { score: slotScore + tail.score, ids: [profile.id, ...tail.ids] };
    });
    memo.set(key, best); return best;
  };
  const result = solve(1, 0);
  return { order: result.ids.map((id) => players.find((profile) => profile.id === id)!), score: result.score };
}

function fullProfile(player: Player, id: string): InternationalPlayerProfile {
  const isDedicatedKeeper = Boolean((player.isWicketkeeper || player.role === "WK-Batsman") && !player.isPartTimeWk);
  const normalizedRole: InternationalRole = isDedicatedKeeper ? "WK-Batsman" : player.role;
  const listedPositions = [
    ...(player.isOpener ? [1, 2] : []), ...(player.hasBattedAt3 ? [3] : []),
    ...(player.hasBattedAt4 || player.isCoreBatter ? [4] : []), ...(player.hasBattedAt5 ? [5] : []),
    ...(player.hasBattedAt6 || player.isFinisher ? [6] : []), ...(player.hasBattedAt7 ? [7] : []),
  ];
  return {
    id: `full:${player.id}`, fullPlayerId: player.id, name: player.name, countryId: id, age: player.age,
    role: normalizedRole, batting: player.currentBatting, bowling: player.currentBowling,
    captaincy: player.captaincy ?? 50, isWicketkeeper: isDedicatedKeeper || player.isPartTimeWk,
    isOpener: player.isOpener, isFinisher: player.isFinisher,
    aggression: player.battingAggression ?? player.aggression ?? 50,
    consistency: player.consistency ?? player.battingConsistency ?? 50,
    powerplayBatting: player.powerplayBatting ?? 50, middleOversBatting: player.middleOversBatting ?? 50, deathBatting: player.deathBatting ?? 50,
    powerplayBowling: player.powerplayBowling ?? 50, middleOversBowling: player.middleOversBowling ?? 50, deathBowling: player.deathBowling ?? 50,
    paceRating: player.paceRating ?? 50, spinRating: player.spinRating ?? 50,
    battingPositions: listedPositions.length > 0 ? listedPositions : normalizedRole === "WK-Batsman" || normalizedRole === "Batsman" ? [3, 4, 5] : normalizedRole === "All-Rounder" ? [6, 7] : [8, 9, 10, 11],
  };
}

function lightweightProfile(country: InternationalTeamDefinition, season: number, index: number, roleSlot = index): InternationalPlayerProfile {
  const random = randomFor(`${country.id}:${season}:profile:${index}`);
  const roles: InternationalRole[] = ["Batsman", "Batsman", "WK-Batsman", "Batsman", "All-Rounder", "All-Rounder", "Pace Bowler", "Pace Bowler", "Pace Bowler", "Spin Bowler", "Spin Bowler", "Batsman", "All-Rounder", "Pace Bowler", "Spin Bowler", "Batsman", "Pace Bowler"];
  const slot = roleSlot % roles.length;
  const role = roles[slot];
  const spread = (random() + random() - 1) * 9;
  const main = Math.max(45, Math.min(91, Math.round(country.strength - 7 + spread)));
  const batting = role === "Batsman" || role === "WK-Batsman" ? main : role === "All-Rounder" ? main - 3 : Math.round(main * 0.45);
  const bowling = role === "Pace Bowler" || role === "Spin Bowler" ? main : role === "All-Rounder" ? main - 2 : Math.round(main * 0.35);
  const nameRandom = randomFor(`${country.id}:${season}:name:${index}`);
  return {
    id: `intl:${country.id}:${season}:${index}`, name: generateInternationalName(country.name, nameRandom), countryId: country.id,
    age: 20 + Math.floor(random() * 15), role, batting, bowling, captaincy: 40 + Math.floor(random() * 45),
    isWicketkeeper: role === "WK-Batsman", isOpener: slot < 2, isFinisher: slot === 5,
    aggression: 42 + Math.floor(random() * 42), consistency: 42 + Math.floor(random() * 38),
    powerplayBatting: 45 + Math.floor(random() * 36), middleOversBatting: 45 + Math.floor(random() * 36), deathBatting: 45 + Math.floor(random() * 36),
    powerplayBowling: 45 + Math.floor(random() * 36), middleOversBowling: 45 + Math.floor(random() * 36), deathBowling: 45 + Math.floor(random() * 36),
    paceRating: 45 + Math.floor(random() * 36), spinRating: 45 + Math.floor(random() * 36),
    battingPositions: slot < 2 ? [slot + 1] : role === "Batsman" || role === "WK-Batsman" ? [Math.min(6, slot + 1)] : role === "All-Rounder" ? [6, 7] : [8 + slot % 4],
  };
}

function selectSquad(country: InternationalTeamDefinition, profiles: InternationalPlayerProfile[], captainId?: string, standing: Record<string, number> = {}, forcedIds: string[] = []): string[] {
  const sorted = [...profiles].sort((a, b) => (roleValue(b) + (standing[b.id] ?? 0)) - (roleValue(a) + (standing[a.id] ?? 0)));
  const picked: InternationalPlayerProfile[] = [];
  const add = (rows: InternationalPlayerProfile[], count: number) => rows.forEach((row) => {
    if (picked.length < 17 && count > 0 && !picked.some((item) => item.id === row.id)) { picked.push(row); count -= 1; }
  });
  add(sorted.filter((row) => forcedIds.includes(row.id)), forcedIds.length);
  if (captainId) add(sorted.filter((row) => row.id === captainId), 1);
  add(sorted.filter((row) => row.isWicketkeeper), 2);
  add(sorted.filter(isInternationalOpener), 3);
  add(sorted.filter((row) => row.role === "Pace Bowler" && isCredibleInternationalBowlingOption(row)), 4);
  add(sorted.filter((row) => row.role === "Spin Bowler" && isCredibleInternationalBowlingOption(row)), 2);
  add(sorted.filter((row) => row.role === "All-Rounder" && isCredibleInternationalBowlingOption(row)), 2);
  add(sorted.filter((row) => profileBattingPositions(row).includes(3)), 2);
  add(sorted.filter((row) => profileBattingPositions(row).some((position) => position === 4 || position === 5)), 3);
  add(sorted.filter((row) => profileBattingPositions(row).some((position) => position === 6 || position === 7)), 2);
  add(sorted.filter((row) => row.role === "Batsman" || row.role === "WK-Batsman"), 17 - picked.length);
  add(sorted, 17 - picked.length);
  return picked.slice(0, 17).map((row) => row.id);
}

function selectXI(squad: string[], profiles: Record<string, InternationalPlayerProfile>, captainId: string, pending: Record<string, number>, season: number, standing: Record<string, number> = {}): string[] {
  const rows = squad.map((id) => profiles[id]).filter(Boolean).sort((a, b) => (roleValue(b) + (standing[b.id] ?? 0)) - (roleValue(a) + (standing[a.id] ?? 0)));
  const dueDebut = rows.find((row) => pending[row.id] && pending[row.id] <= season);
  const requiredIds = new Set([captainId, dueDebut?.id].filter(Boolean) as string[]);
  let chosen: InternationalPlayerProfile[] | null = null;
  let bestScore = -Infinity;
  const combinations = (start: number, picked: InternationalPlayerProfile[]) => {
    if (picked.length === 11) {
      if (Array.from(requiredIds).some((id) => !picked.some((row) => row.id === id))) return;
      const openers = picked.filter(isInternationalOpener).length;
      const keepers = picked.filter((row) => row.isWicketkeeper).length;
      const batters = picked.filter(isInternationalBattingOption).length;
      const pace = picked.filter((row) => row.role === "Pace Bowler" && isCredibleInternationalBowlingOption(row)).length;
      const spin = picked.filter((row) => row.role === "Spin Bowler" && isCredibleInternationalBowlingOption(row)).length;
      const bowling = picked.filter(isCredibleInternationalBowlingOption).length;
      if (openers < 2 || keepers < 1 || batters < 6 || pace < 2 || spin < 1 || bowling < 5) return;
      const score = picked.reduce((sum, row) => sum + roleValue(row) + (standing[row.id] ?? 0), 0)
        + Math.min(7, batters) * 1.5 + Math.min(5, bowling) * 1.5
        + [3, 4, 5, 6, 7].filter((position) => picked.some((row) => profileBattingPositions(row).includes(position))).length * 3
        - Math.max(0, openers - 2) * 14;
      if (score > bestScore) { bestScore = score; chosen = [...picked]; }
      return;
    }
    if (picked.length + rows.length - start < 11) return;
    for (let index = start; index < rows.length; index += 1) combinations(index + 1, [...picked, rows[index]]);
  };
  combinations(0, []);
  if (!chosen) chosen = rows.slice(0, 11);
  const optimized = optimizeTopSeven(chosen);
  const topSevenIds = new Set(optimized.order.map((row) => row.id));
  const lowerOrder = chosen.filter((row) => !topSevenIds.has(row.id)).sort((a, b) => {
    const battingDifference = Number(isInternationalBattingOption(b)) - Number(isInternationalBattingOption(a));
    return battingDifference || b.batting - a.batting || b.bowling - a.bowling;
  });
  return [...optimized.order, ...lowerOrder].slice(0, 11).map((row) => row.id);
}

function chooseCaptain(definition: InternationalTeamDefinition, profiles: InternationalPlayerProfile[], previous?: NationalTeamState): InternationalPlayerProfile {
  if (previous) {
    const incumbent = profiles.find((row) => row.id === previous.captainId);
    if (incumbent && incumbent.age < 39 && roleValue(incumbent) >= definition.strength - 18) return incumbent;
  }
  const named = definition.startingCaptainName
    ? profiles.find((row) => row.name.toLowerCase() === definition.startingCaptainName!.toLowerCase())
    : undefined;
  return named ?? [...profiles].sort((a, b) => (roleValue(b) + b.captaincy * 0.18) - (roleValue(a) + a.captaincy * 0.18))[0];
}

function buildTeams(players: Record<string, Player>, season: number, previous?: InternationalCareerState): Pick<InternationalCareerState, "teams" | "profiles"> {
  const profiles: Record<string, InternationalPlayerProfile> = {};
  const teams: Record<string, NationalTeamState> = {};
  INTERNATIONAL_TEAMS.forEach((definition) => {
    const available = definition.core
      ? Object.values(players).filter((player) => countryId(player) === definition.id && player.age <= 39).map((player) => fullProfile(player, definition.id))
      : [];
    const priorLightweights = Object.values(previous?.profiles ?? {}).filter((profile) => profile.countryId === definition.id && !profile.fullPlayerId && profile.age < 38).map((profile) => ({ ...profile, age: profile.age + Math.max(0, season - (previous?.season ?? season)) }));
    const pool = [...available, ...priorLightweights];
    const existingCount = pool.length;
    for (let index = existingCount; index < 22; index += 1) pool.push(lightweightProfile(definition, season, index, index - existingCount));
    const bowlingSlots = [6, 7, 8, 9, 10, 12, 13, 14, 16];
    let bowlingSlotIndex = 0;
    while (pool.filter(isCredibleInternationalBowlingOption).length < 7) {
      const index = 100 + bowlingSlotIndex;
      pool.push(lightweightProfile(definition, season, index, bowlingSlots[bowlingSlotIndex % bowlingSlots.length]));
      bowlingSlotIndex += 1;
    }
    pool.forEach((profile) => { profiles[profile.id] = profile; });
    const captain = chooseCaptain(definition, pool, previous?.teams[definition.id]);
    const priorStanding = previous?.teams[definition.id]?.internationalStanding ?? {};
    const squad = selectSquad(definition, pool, captain.id, priorStanding, Object.keys(previous?.teams[definition.id]?.pendingDebuts ?? {}));
    const pendingDebuts = { ...(previous?.teams[definition.id]?.pendingDebuts ?? {}) };
    squad.forEach((id) => {
      const profile = profiles[id];
      const player = profile?.fullPlayerId ? players[profile.fullPlayerId] : undefined;
      if (player && !player.isCapped && player.internationalCallUpSeason !== undefined) pendingDebuts[id] ??= season;
    });
    const preferredXI = selectXI(squad, profiles, captain.id, pendingDebuts, season, priorStanding);
    const vice = squad.map((id) => profiles[id]).filter((row) => row.id !== captain.id).sort((a, b) => b.captaincy - a.captaincy)[0];
    teams[definition.id] = {
      countryId: definition.id, squad, preferredXI, captainId: captain.id, viceCaptainId: vice?.id,
      captainAppointedSeason: previous?.teams[definition.id]?.captainId === captain.id ? previous.teams[definition.id].captainAppointedSeason : season,
      captainReviewSeason: season + 2, internationalStanding: { ...priorStanding }, pendingDebuts,
    };
  });
  return { teams, profiles };
}

function chooseQualifiers(season: number): string[] {
  const random = randomFor(`world-cup:${season}:qualifiers`);
  const pool = INTERNATIONAL_TEAMS.filter((row) => !row.core).map((row) => ({ ...row, key: Math.pow(random(), 1 / Math.max(1, row.strength - 54)) }));
  return pool.sort((a, b) => b.key - a.key).slice(0, 13).map((row) => row.id);
}

function createSeasonSchedule(season: number): { series: InternationalSeries[]; fixtures: InternationalFixture[]; qualifiers: string[] } {
  const series: InternationalSeries[] = [];
  const fixtures: InternationalFixture[] = [];
  const rotation = [...INTERNATIONAL_TEAMS.filter((row) => row.core).map((row) => row.id), "BYE"];
  // One international reporting year runs from the end of the previous IPL
  // through the end of the current IPL. The bilateral blocks therefore sit in
  // the previous calendar year, followed by the World Cup in Jan/Feb.
  const cycleStartYear = season - 1;
  const roundStarts = [`${cycleStartYear}-06-10`, `${cycleStartYear}-08-05`, `${cycleStartYear}-10-05`];
  for (let round = 0; round < 3; round += 1) {
    for (let pair = 0; pair < rotation.length / 2; pair += 1) {
      const left = rotation[pair]; const right = rotation[rotation.length - 1 - pair];
      if (left === "BYE" || right === "BYE") continue;
      const host = (round + pair + season) % 2 === 0 ? left : right;
      const away = host === left ? right : left;
      const matchCount: 3 | 5 = TOP_FOUR.has(host) || TOP_FOUR.has(away) ? 5 : 3;
      const id = `intl:${season}:${round}:${host}:${away}`;
      const start = addDays(roundStarts[round], pair * 2);
      const fixtureIds: string[] = [];
      for (let match = 1; match <= matchCount; match += 1) {
        const fixtureId = `${id}:${match}`; fixtureIds.push(fixtureId);
        fixtures.push({ id: fixtureId, seriesId: id, date: addDays(start, (match - 1) * 3), matchNumber: match, teamA: host, teamB: away, venue: bilateralVenue(host, match, round + pair), stage: "bilateral", played: false });
      }
      series.push({ id, season, hostCountry: host, touringCountry: away, matchCount, fixtureIds, homeWins: 0, awayWins: 0, completed: false });
    }
    const fixed = rotation[0]; const rest = rotation.slice(1); rest.unshift(rest.pop()!); rotation.splice(0, rotation.length, fixed, ...rest);
  }
  const qualifiers = season % 2 === 0 ? chooseQualifiers(season) : [];
  if (qualifiers.length) {
    const participants = [...Array.from(CORE), ...qualifiers];
    const random = randomFor(`world-cup:${season}:draw`);
    participants.sort(() => random() - 0.5);
    for (let group = 0; group < 4; group += 1) {
      const ids = participants.slice(group * 5, group * 5 + 5);
      let game = 0;
      for (let a = 0; a < ids.length; a += 1) for (let b = a + 1; b < ids.length; b += 1) {
        const id = `wc:${season}:g${group + 1}:${game++}`;
        fixtures.push({ id, seriesId: `wc:${season}:group:${group + 1}`, date: addDays(`${season}-01-12`, group * 2 + game), matchNumber: game, teamA: ids[a], teamB: ids[b], venue: worldCupVenue(season, group * 10 + game), stage: "world-cup-group", played: false });
      }
    }
  }
  return { series, fixtures, qualifiers };
}

export function internationalProgrammePreview(season: number): Pick<InternationalCareerState, "series" | "fixtures"> {
  const schedule = createSeasonSchedule(season);
  return { series: schedule.series, fixtures: schedule.fixtures };
}

export function internationalSeasonForDate(iplSeason: number, currentDate: string): number {
  const calendarYear = Number(currentDate.slice(0, 4));
  if (!Number.isFinite(calendarYear)) return iplSeason;
  // The international statistical year changes after the IPL window. Its
  // programme is announced earlier, but matches from June belong to the next
  // IPL-final-to-IPL-final reporting period.
  const nextWindowHasStarted = currentDate >= `${calendarYear}-06-01`;
  return Math.max(iplSeason, nextWindowHasStarted ? calendarYear + 1 : calendarYear);
}

function groupLeaders(fixtures: InternationalFixture[], seriesId: string): string[] {
  const games = fixtures.filter((fixture) => fixture.seriesId === seriesId);
  const ids = Array.from(new Set(games.flatMap((fixture) => [fixture.teamA, fixture.teamB])));
  return ids.map((id) => ({ id, wins: games.filter((fixture) => fixture.winner === id).length, strength: team(id).strength }))
    .sort((a, b) => b.wins - a.wins || b.strength - a.strength).slice(0, 2).map((row) => row.id);
}

function addWorldCupStages(career: InternationalCareerState): boolean {
  if (!career.qualifiers.length) return false;
  const groupGames = career.fixtures.filter((fixture) => fixture.stage === "world-cup-group");
  if (groupGames.length && groupGames.every((fixture) => fixture.played) && !career.fixtures.some((fixture) => fixture.stage === "super-eight")) {
    const qualifiers = [1, 2, 3, 4].flatMap((group) => groupLeaders(career.fixtures, `wc:${career.season}:group:${group}`));
    const pools = [qualifiers.filter((_, index) => index % 2 === 0), qualifiers.filter((_, index) => index % 2 === 1)];
    pools.forEach((ids, group) => { let game = 0; for (let a = 0; a < 4; a += 1) for (let b = a + 1; b < 4; b += 1) { const id = `wc:${career.season}:s${group + 1}:${game++}`; career.fixtures.push({ id, seriesId: `wc:${career.season}:super:${group + 1}`, date: addDays(`${career.season}-02-05`, group * 2 + game), matchNumber: game, teamA: ids[a], teamB: ids[b], venue: worldCupVenue(career.season, group * 6 + game, 3), stage: "super-eight", played: false }); } });
    return true;
  }
  const superGames = career.fixtures.filter((fixture) => fixture.stage === "super-eight");
  if (superGames.length && superGames.every((fixture) => fixture.played) && !career.fixtures.some((fixture) => fixture.stage === "semi-final")) {
    const first = groupLeaders(career.fixtures, `wc:${career.season}:super:1`); const second = groupLeaders(career.fixtures, `wc:${career.season}:super:2`);
    [[first[0], second[1]], [second[0], first[1]]].forEach((ids, index) => career.fixtures.push({ id: `wc:${career.season}:semi:${index + 1}`, seriesId: `wc:${career.season}:knockout`, date: addDays(`${career.season}-02-20`, index * 2), matchNumber: index + 1, teamA: ids[0], teamB: ids[1], venue: worldCupVenue(career.season, index, 7), stage: "semi-final", played: false }));
    return true;
  }
  const semis = career.fixtures.filter((fixture) => fixture.stage === "semi-final");
  if (semis.length === 2 && semis.every((fixture) => fixture.played) && !career.fixtures.some((fixture) => fixture.stage === "final")) {
    career.fixtures.push({ id: `wc:${career.season}:final`, seriesId: `wc:${career.season}:knockout`, date: `${career.season}-02-25`, matchNumber: 1, teamA: semis[0].winner!, teamB: semis[1].winner!, venue: worldCupVenue(career.season, 0), stage: "final", played: false }); return true;
  }
  return false;
}

function simulateInnings(batting: InternationalPlayerProfile[], bowling: InternationalPlayerProfile[], seed: string, target?: number): { score: [number, number]; card: InternationalInningsScorecard; stats: Record<string, InternationalPlayerStats> } {
  const random = randomFor(seed);
  const batStrength = batting.slice(0, 7).reduce((sum, row) => sum + row.batting + ((row.aggression ?? 50) - 50) / 35, 0) / 7;
  const eligibleBowlers = bowling.filter(isCredibleInternationalBowlingOption);
  const bowlers = [...eligibleBowlers].sort((a, b) => b.bowling - a.bowling).slice(0, 5);
  const bowlStrength = bowlers.reduce((sum, row) => sum + row.bowling, 0) / 5;
  const dismissalChance = Math.max(0.18, Math.min(0.82, 0.5 + (bowlStrength - batStrength) / 85 + (random() - 0.5) * 0.46));
  let wickets = 0;
  for (let chance = 0; chance < 10; chance += 1) if (random() < dismissalChance) wickets += 1;
  const scoringNoise = (random() + random() + random() - 1.5) * 32;
  let runs = Math.round(164 + (batStrength - bowlStrength) * 1.05 + scoringNoise + (5 - wickets) * 4.2);
  if (target) runs = Math.min(runs, target + Math.round((random() - 0.48) * 18));
  runs = Math.max(wickets === 10 ? 62 : 78, Math.min(245, runs));
  const balls = target && runs >= target
    ? Math.max(60, Math.min(119, Math.round(116 * runs / Math.max(runs, target) - random() * 12)))
    : wickets === 10
      ? Math.max(72, Math.min(119, Math.round(82 + runs / 5 + random() * 12)))
      : 120;
  const stats: Record<string, InternationalPlayerStats> = {};
  const battingRows: InternationalInningsScorecard["batting"] = [];
  const activeCount = Math.min(11, wickets + 2);
  const battingWeights = batting.slice(0, activeCount).map((player, index) => {
    const rolePhase = index < 2 ? "powerplay" : index < 6 ? "middle" : "death";
    const phaseSignal = getRelativePhaseSignal(player, "batting", rolePhase);
    const noiseWidth = 0.7 - (player.consistency ?? 50) / 200;
    const inningsForm = 0.3 + Math.pow(random(), 1.55) * 2.15;
    return Math.max(0.05, player.batting / 75 * (1 + phaseSignal * 0.22) * (index < 2 ? 1.28 : index < 6 ? 1 : 0.48) * (1 - noiseWidth / 2 + random() * noiseWidth) * inningsForm);
  });
  const totalBattingWeight = battingWeights.reduce((sum, value) => sum + value, 0);
  const runsByBatter = battingWeights.map((weight) => Math.floor(runs * weight / totalBattingWeight));
  let unassignedBattingRuns = runs - runsByBatter.reduce((sum, value) => sum + value, 0);
  for (let index = 0; unassignedBattingRuns > 0; index = (index + 1) % runsByBatter.length) { runsByBatter[index] += 1; unassignedBattingRuns -= 1; }
  const rawBalls = runsByBatter.map((playerRuns, index) => {
    const player = batting[index];
    const strikeRate = Math.max(75, 112 + (player.batting - 70) + random() * 55);
    return playerRuns > 0 ? playerRuns * 100 / strikeRate : 0;
  });
  const rawBallTotal = rawBalls.reduce((sum, value) => sum + value, 0) || 1;
  const ballsByBatter = rawBalls.map((value) => Math.floor(balls * value / rawBallTotal));
  let unassignedBattingBalls = balls - ballsByBatter.reduce((sum, value) => sum + value, 0);
  for (let index = 0; unassignedBattingBalls > 0; index = (index + 1) % ballsByBatter.length) { ballsByBatter[index] += 1; unassignedBattingBalls -= 1; }
  batting.forEach((player, index) => {
    const active = index < activeCount;
    const row = EMPTY_STATS(); row.matches = 1;
    if (active) {
      row.innings = 1;
      const playerRuns = runsByBatter[index];
      const playerBalls = ballsByBatter[index];
      row.runs = playerRuns; row.balls = playerBalls; row.highestScore = playerRuns; row.notOuts = wickets < 10 && index >= wickets ? 1 : 0;
      battingRows.push([player.id, playerRuns, playerBalls, row.notOuts ? 0 : 1]);
    }
    stats[player.id] = row;
  });
  const bowlingRows: InternationalInningsScorecard["bowling"] = [];
  const bowlingBalls = bowlers.map(() => Math.floor(balls / bowlers.length));
  for (let index = 0; index < balls % bowlers.length; index += 1) bowlingBalls[index] += 1;
  const wicketShares = bowlers.map((player) => {
    const bestPhaseSignal = Math.max(
      getRelativePhaseSignal(player, "bowling", "powerplay"),
      getRelativePhaseSignal(player, "bowling", "middle"),
      getRelativePhaseSignal(player, "bowling", "death"),
    );
    return Math.max(1, Math.pow(Math.max(1, player.bowling - 42), 1.45) * (1 + bestPhaseSignal * 0.12));
  });
  const wicketsByBowler = bowlers.map(() => 0);
  for (let wicket = 0; wicket < wickets; wicket += 1) {
    const totalWeight = wicketShares.reduce((sum, value) => sum + value, 0);
    let draw = random() * totalWeight;
    let selected = wicketShares.length - 1;
    for (let index = 0; index < wicketShares.length; index += 1) { draw -= wicketShares[index]; if (draw <= 0) { selected = index; break; } }
    wicketsByBowler[selected] += 1;
  }
  const concessionWeights = bowlers.map((player, index) => bowlingBalls[index] * Math.max(20, 112 - player.bowling) * (0.88 + random() * 0.24));
  const totalConcessionWeight = concessionWeights.reduce((sum, value) => sum + value, 0);
  const concededByBowler = concessionWeights.map((value) => Math.floor(runs * value / totalConcessionWeight));
  let unassignedRuns = runs - concededByBowler.reduce((sum, value) => sum + value, 0);
  for (let index = 0; unassignedRuns > 0; index = (index + 1) % concededByBowler.length) { concededByBowler[index] += 1; unassignedRuns -= 1; }
  bowlers.forEach((player, index) => {
    const row = stats[player.id] ?? EMPTY_STATS(); row.matches = 1; row.bowlingInnings = 1;
    const bowled = bowlingBalls[index];
    const taken = wicketsByBowler[index];
    const conceded = concededByBowler[index];
    row.bowlingBalls = bowled; row.runsConceded = conceded; row.wickets = taken; row.bestBowlingWickets = taken; row.bestBowlingRuns = conceded;
    stats[player.id] = row;
    bowlingRows.push([player.id, bowled, conceded, taken]);
  });
  return { score: [runs, wickets], card: { batting: battingRows, bowling: bowlingRows }, stats };
}

function mergeStats(target: Record<string, InternationalPlayerStats>, additions: Record<string, InternationalPlayerStats>) {
  Object.entries(additions).forEach(([id, row]) => {
    const current = target[id] ?? EMPTY_STATS();
    current.matches += row.matches; current.innings += row.innings; current.runs += row.runs; current.balls += row.balls; current.notOuts += row.notOuts;
    current.highestScore = Math.max(current.highestScore, row.highestScore); current.bowlingInnings += row.bowlingInnings; current.bowlingBalls += row.bowlingBalls;
    current.runsConceded += row.runsConceded; current.wickets += row.wickets;
    if (row.bestBowlingWickets > current.bestBowlingWickets || (row.bestBowlingWickets === current.bestBowlingWickets && row.bestBowlingRuns < current.bestBowlingRuns)) { current.bestBowlingWickets = row.bestBowlingWickets; current.bestBowlingRuns = row.bestBowlingRuns; }
    target[id] = current;
  });
}

function repairAppearanceCounts(stats: Record<string, InternationalPlayerStats>, fixtures: InternationalFixture[]): void {
  const appearances: Record<string, number> = {};
  fixtures.forEach((fixture) => {
    if (!fixture.played) return;
    new Set([...(fixture.xiA ?? []), ...(fixture.xiB ?? [])]).forEach((id) => {
      appearances[id] = (appearances[id] ?? 0) + 1;
    });
  });
  Object.entries(stats).forEach(([id, row]) => {
    if (appearances[id] !== undefined) row.matches = appearances[id];
  });
}

function simulateFixture(fixture: InternationalFixture, state: InternationalCareerState, players: Record<string, Player>): { fixture: InternationalFixture; playerUpdates: Record<string, Player> } {
  const home = state.teams[fixture.teamA]; const away = state.teams[fixture.teamB];
  const xiA = selectXI(home.squad, state.profiles, home.captainId, home.pendingDebuts, state.season, home.internationalStanding);
  const xiB = selectXI(away.squad, state.profiles, away.captainId, away.pendingDebuts, state.season, away.internationalStanding);
  const inningsA = simulateInnings(xiA.map((id) => state.profiles[id]), xiB.map((id) => state.profiles[id]), `${fixture.id}:a`);
  const inningsB = simulateInnings(xiB.map((id) => state.profiles[id]), xiA.map((id) => state.profiles[id]), `${fixture.id}:b`, inningsA.score[0] + 1);
  const winner = inningsB.score[0] > inningsA.score[0] ? fixture.teamB : fixture.teamA;
  const ratingA = state.rankings[fixture.teamA] ?? team(fixture.teamA).strength;
  const ratingB = state.rankings[fixture.teamB] ?? team(fixture.teamB).strength;
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 18));
  const actualA = winner === fixture.teamA ? 1 : 0;
  const importance = fixture.stage === "bilateral" ? 1 : fixture.stage === "final" ? 1.5 : 1.2;
  const movement = Math.max(-2.5, Math.min(2.5, (actualA - expectedA) * 2.4 * importance));
  state.rankings[fixture.teamA] = Math.round((ratingA + movement) * 100) / 100;
  state.rankings[fixture.teamB] = Math.round((ratingB - movement) * 100) / 100;
  const matchStats: Record<string, InternationalPlayerStats> = {};
  mergeStats(matchStats, inningsA.stats); mergeStats(matchStats, inningsB.stats);
  Object.values(matchStats).forEach((row) => { row.matches = Math.min(1, row.matches); });
  mergeStats(state.careerStats, matchStats);
  mergeStats(state.seasonStats, matchStats);
  for (const [id, row] of Object.entries(matchStats)) {
    const profile = state.profiles[id]; if (!profile) continue;
    const standing = state.teams[profile.countryId].internationalStanding;
    const matchImpact = Math.max(-1.5, Math.min(4, row.runs / 28 + row.wickets * 0.9 - (row.innings && row.runs < 8 ? 0.7 : 0)));
    standing[id] = Math.max(-5, Math.min(8, (standing[id] ?? 0) * 0.9 + matchImpact));
  }
  const updates: Record<string, Player> = {};
  [...xiA, ...xiB].forEach((id) => {
    const profile = state.profiles[id]; if (!profile?.fullPlayerId) return;
    delete state.teams[profile.countryId].pendingDebuts[id];
    const player = players[profile.fullPlayerId]; if (!player || player.isCapped || player.internationalDebutDate) return;
    updates[player.id] = {
      ...player,
      internationalCallUpSeason: player.internationalCallUpSeason ?? state.season - 1,
      internationalDebutDate: fixture.date,
      internationalDebutCountry: player.internationalDebutCountry ?? team(profile.countryId).name,
    };
  });
  const all = [...xiA, ...xiB]; const potm = all.sort((a, b) => (matchStats[b]?.runs ?? 0) + (matchStats[b]?.wickets ?? 0) * 22 - ((matchStats[a]?.runs ?? 0) + (matchStats[a]?.wickets ?? 0) * 22))[0];
  return { fixture: { ...fixture, played: true, winner, scoreA: inningsA.score, scoreB: inningsB.score, xiA, xiB, captainA: home.captainId, captainB: away.captainId, playerOfTheMatchId: potm, scorecard: [inningsA.card, inningsB.card] }, playerUpdates: updates };
}

export function createInternationalCareer(season: number, players: Record<string, Player>): InternationalCareerState {
  const roster = buildTeams(players, season); const schedule = createSeasonSchedule(season);
  return { version: 1, season, ...roster, ...schedule, careerStats: {}, seasonStats: {}, rankings: Object.fromEntries(INTERNATIONAL_TEAMS.map((row) => [row.id, row.strength])), history: [] };
}

export function reconcileInternationalCareer(state: InternationalCareerState | null, season: number, currentDate: string, players: Record<string, Player>): { state: InternationalCareerState; playerUpdates: Record<string, Player> } {
  let career = state?.version === 1 ? structuredClone(state) : createInternationalCareer(season, players);
  const targetSeason = internationalSeasonForDate(season, currentDate);
  const playerUpdates: Record<string, Player> = {};
  // Migrate schedules produced before international years were aligned to IPL
  // season boundaries. Scores and scorecards remain untouched.
  career.fixtures = career.fixtures.map((fixture) => fixture.stage === "bilateral" && fixture.date.startsWith(`${career.season}-`)
    ? { ...fixture, date: `${career.season - 1}${fixture.date.slice(4)}` }
    : fixture);
  career.fixtures = career.fixtures.map((fixture, index) => {
    if (!fixture.venue.includes("home venue") && !fixture.venue.startsWith("T20 World Cup")) return fixture;
    const venue = fixture.stage === "bilateral"
      ? bilateralVenue(fixture.teamA, fixture.matchNumber, index)
      : worldCupVenue(career.season, index, fixture.stage === "semi-final" ? 7 : 0);
    return { ...fixture, venue };
  });
  Object.entries(career.profiles).forEach(([id, profile]) => {
    if (profile.fullPlayerId && players[profile.fullPlayerId]) {
      career.profiles[id] = fullProfile(players[profile.fullPlayerId], profile.countryId);
      return;
    }
    career.profiles[id] = { ...profile, battingPositions: profileBattingPositions(profile) };
  });
  // Career progression can award a cap before this module next opens. Treat a
  // recent capped player with no international appearance as a mandatory
  // debutant, rebuild the squad around them, and keep them pending until they
  // actually appear in an XI.
  Object.values(career.teams).forEach((nationalTeam) => {
    nationalTeam.pendingDebuts ??= {};
    const definition = team(nationalTeam.countryId);
    const pool = Object.values(career.profiles).filter((profile) => profile.countryId === nationalTeam.countryId);
    Object.keys(nationalTeam.pendingDebuts).forEach((id) => {
      const profile = career.profiles[id];
      const player = profile?.fullPlayerId ? players[profile.fullPlayerId] : undefined;
      if (player && !player.isCapped && player.internationalCallUpSeason === undefined && !player.internationalDebutDate) delete nationalTeam.pendingDebuts[id];
    });
    pool.forEach((profile) => {
      if (!profile.fullPlayerId) return;
      const player = players[profile.fullPlayerId];
      const hasPlayed = (career.careerStats[profile.id]?.matches ?? 0) > 0
        || career.fixtures.some((fixture) => fixture.played && [...(fixture.xiA ?? []), ...(fixture.xiB ?? [])].includes(profile.id));
      const recentCallUp = player?.internationalCallUpSeason !== undefined
        && player.internationalCallUpSeason >= career.season - 1;
      const legacyRecentCap = player?.isCapped
        && player.internationalDebutSeason !== undefined
        && player.internationalDebutSeason >= career.season - 1;
      if ((recentCallUp || legacyRecentCap) && !hasPlayed) nationalTeam.pendingDebuts[profile.id] ??= career.season;
    });
    nationalTeam.squad = selectSquad(
      definition,
      pool,
      nationalTeam.captainId,
      nationalTeam.internationalStanding,
      Object.keys(nationalTeam.pendingDebuts),
    );
  });
  Object.values(career.teams).forEach((nationalTeam) => {
    nationalTeam.preferredXI = selectXI(nationalTeam.squad, career.profiles, nationalTeam.captainId, nationalTeam.pendingDebuts, career.season, nationalTeam.internationalStanding);
  });
  if (career.season < targetSeason) {
    // Catch up the closing reporting window before archiving it. This matters
    // when the international page has not been opened since before its World
    // Cup or final bilateral block.
    let closingWindowHasWork = true;
    while (closingWindowHasWork) {
      let played = false;
      career.fixtures = career.fixtures.map((fixture) => {
        if (fixture.played || fixture.date > currentDate) return fixture;
        played = true;
        const result = simulateFixture(fixture, career, { ...players, ...playerUpdates });
        Object.assign(playerUpdates, result.playerUpdates);
        return result.fixture;
      });
      const stageAdded = addWorldCupStages(career);
      closingWindowHasWork = stageAdded || (played && career.fixtures.some((fixture) => !fixture.played && fixture.date <= currentDate));
    }
    career.series = career.series.map((series) => {
      const matches = series.fixtureIds.map((id) => career.fixtures.find((fixture) => fixture.id === id)).filter(Boolean) as InternationalFixture[];
      return { ...series, homeWins: matches.filter((match) => match.winner === series.hostCountry).length, awayWins: matches.filter((match) => match.winner === series.touringCountry).length, completed: matches.length === series.matchCount && matches.every((match) => match.played) };
    });
    const worldCupFinal = career.fixtures.find((fixture) => fixture.stage === "final" && fixture.played);
    career.history = [...career.history, {
      season: career.season,
      series: career.series,
      fixtures: career.fixtures,
      worldCupChampion: worldCupFinal?.winner,
      seasonStats: career.seasonStats,
      profileNames: Object.fromEntries(Object.entries(career.profiles).map(([id, profile]) => [id, profile.name])),
    }].slice(-12);
    const roster = buildTeams(players, targetSeason, career); const schedule = createSeasonSchedule(targetSeason);
    career = { ...career, season: targetSeason, ...roster, ...schedule, seasonStats: {} };
  }
  let more = true;
  while (more) {
    let played = false;
    career.fixtures = career.fixtures.map((fixture) => {
      if (fixture.played || fixture.date > currentDate) return fixture;
      played = true; const result = simulateFixture(fixture, career, { ...players, ...playerUpdates }); Object.assign(playerUpdates, result.playerUpdates); return result.fixture;
    });
    const stageAdded = addWorldCupStages(career);
    more = stageAdded || (played && career.fixtures.some((fixture) => !fixture.played && fixture.date <= currentDate));
  }
  career.series = career.series.map((series) => {
    const matches = series.fixtureIds.map((id) => career.fixtures.find((fixture) => fixture.id === id)).filter(Boolean) as InternationalFixture[];
    return { ...series, homeWins: matches.filter((match) => match.winner === series.hostCountry).length, awayWins: matches.filter((match) => match.winner === series.touringCountry).length, completed: matches.length === series.matchCount && matches.every((match) => match.played) };
  });
  career.history.forEach((archive) => {
    if (archive.seasonStats) repairAppearanceCounts(archive.seasonStats, archive.fixtures);
  });
  repairAppearanceCounts(career.seasonStats, career.fixtures);
  repairAppearanceCounts(career.careerStats, [...career.history.flatMap((archive) => archive.fixtures), ...career.fixtures]);
  Object.values({ ...players, ...playerUpdates }).forEach((player) => {
    if (player.isCapped || !player.internationalDebutDate || player.internationalDebutDate >= currentDate) return;
    playerUpdates[player.id] = {
      ...player,
      isCapped: true,
      internationalDebutSeason: player.internationalDebutSeason ?? Number(player.internationalDebutDate.slice(0, 4)),
      internationalDebutCountry: player.internationalDebutCountry ?? player.country ?? (player.nationality === "Indian" ? "India" : "Overseas"),
    };
  });
  return { state: career, playerUpdates };
}

export function internationalStorageKey(careerId: string): string { return `ipl_international_${careerId}_v1`; }
export function internationalTeamName(id: string): string { return team(id)?.name ?? id; }
export function internationalProfileName(state: InternationalCareerState, id: string): string { return state.profiles[id]?.name ?? id; }
export function internationalCareerStatsForPlayer(state: InternationalCareerState, playerId: string): InternationalPlayerStats | undefined { return state.careerStats[`full:${playerId}`]; }
export function getInternationalLeaders(state: InternationalCareerState) {
  const rows = Object.entries(state.seasonStats);
  return {
    batting: [...rows].sort((a, b) => b[1].runs - a[1].runs),
    bowling: [...rows].sort((a, b) => b[1].wickets - a[1].wickets),
  };
}
