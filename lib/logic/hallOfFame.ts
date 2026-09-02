import type { Player } from "../types";
import { LEAGUE_HALL_OF_FAME } from "../data/leagueHallOfFame";
import { HISTORICAL_LEAGUE_HISTORY, type LeagueHistorySeason } from "../data/leagueHistory";
import type { HistoricalPlayerSnapshot } from "./careerLifecycle";

export interface HallOfFameEvaluation {
  playerId: string;
  name: string;
  role: HistoricalPlayerSnapshot["role"];
  retirementSeason: number | null;
  isRetired: boolean;
  foundingMember: boolean;
  matches: number;
  runs: number;
  wickets: number;
  battingAverage: number;
  strikeRate: number;
  bowlingAverage: number;
  economy: number;
  orangeCaps: number;
  purpleCaps: number;
  seasonMvps: number;
  score: number;
  inducted: boolean;
  qualificationReasons: string[];
}

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

/** Immediate post-retirement Hall of Fame evaluation; there is no waiting period. */
type HallOfFameCandidateSource = Pick<Player, "id" | "name" | "role" | "iplStats" | "iplHistory" | "reputation"> & {
  retirementSeason?: number;
};

const normalizeName = (name: string) => name.toLocaleLowerCase("en-GB").replace(/[^a-z0-9]/g, "");
const foundingMemberNames = new Set(LEAGUE_HALL_OF_FAME.map((member) => normalizeName(member.name)));

function evaluateHallOfFameSource(
  source: HallOfFameCandidateSource,
  isRetired: boolean,
  leagueHistory: LeagueHistorySeason[],
): HallOfFameEvaluation {
  const stats = source.iplStats;
  const battingAverage = stats.battingAverage || 0;
  const strikeRate = stats.strikeRate || 0;
  const bowlingAverage = stats.bowlingAverage || 0;
  const economy = stats.bowlingBalls
    ? (stats.bowlingRunsConceded ?? 0) / (stats.bowlingBalls / 6)
    : 0;
  const seasons = source.iplHistory.filter((entry) => (entry.seasonStats?.matches ?? 0) > 0);
  const bestRuns = Math.max(0, ...seasons.map((entry) => entry.seasonStats?.runs ?? 0));
  const bestWickets = Math.max(0, ...seasons.map((entry) => entry.seasonStats?.wickets ?? 0));
  const productiveSeasons = seasons.filter((entry) => (
    (entry.seasonStats?.runs ?? 0) >= 300 || (entry.seasonStats?.wickets ?? 0) >= 12
  )).length;
  const candidateName = normalizeName(source.name);
  const orangeCaps = leagueHistory.filter((season) => normalizeName(season.orangeCap?.name ?? "") === candidateName).length;
  const purpleCaps = leagueHistory.filter((season) => normalizeName(season.purpleCap?.name ?? "") === candidateName).length;
  const seasonMvps = leagueHistory.filter((season) => normalizeName(season.mvp?.name ?? "") === candidateName).length;

  const longevity = 15 * clamp(stats.matches / 220);
  const battingCareer = 25 * (
    0.62 * clamp(stats.runs / 7000)
    + 0.2 * clamp((battingAverage - 18) / 22)
    + 0.18 * clamp((strikeRate - 105) / 50)
  );
  const bowlingCareer = 25 * (
    0.68 * clamp(stats.wickets / 230)
    + 0.18 * clamp((34 - bowlingAverage) / 16)
    + 0.14 * clamp((9.5 - economy) / 3.2)
  );
  const battingPeak = 20 * clamp(bestRuns / 750);
  const bowlingPeak = 20 * clamp(bestWickets / 28);
  const isAllRounder = source.role === "All-Rounder";
  const primaryCareer = Math.max(battingCareer, bowlingCareer);
  const secondaryCareer = Math.min(battingCareer, bowlingCareer);
  const primaryPeak = Math.max(battingPeak, bowlingPeak);
  const secondaryPeak = Math.min(battingPeak, bowlingPeak);
  const production = isAllRounder
    ? primaryCareer + secondaryCareer * 0.45
    : primaryCareer;
  const peak = isAllRounder
    ? primaryPeak + secondaryPeak * 0.35
    : primaryPeak;
  const sustainedExcellence = 20 * clamp(productiveSeasons / 10);
  const reputationLegacy = 10 * clamp((source.reputation ?? 0) / 100);
  // Historical database careers predate compact seasonStats, so landmark
  // totals must carry their own legacy credit instead of depending entirely
  // on season-by-season peak rows that only exist in simulated seasons.
  const careerMilestones = Math.min(18,
    (stats.runs >= 3000 ? 3 : 0)
    + (stats.runs >= 5000 ? 5 : 0)
    + (stats.runs >= 7000 ? 5 : 0)
    + (stats.wickets >= 100 ? 3 : 0)
    + (stats.wickets >= 150 ? 4 : 0)
    + (stats.wickets >= 200 ? 5 : 0)
    + (stats.matches >= 150 ? 2 : 0)
    + (stats.matches >= 200 ? 2 : 0));
  const awardLegacy = Math.min(18, orangeCaps * 6 + purpleCaps * 6 + seasonMvps * 5);
  const score = Math.round(Math.min(100, longevity + production + peak + sustainedExcellence + reputationLegacy + careerMilestones + awardLegacy) * 10) / 10;
  const minimumCareer = stats.matches >= 50 && (
    stats.runs >= 3500
    || stats.wickets >= 120
    || (stats.runs >= 1800 && stats.wickets >= 75)
  );
  const foundingMember = foundingMemberNames.has(normalizeName(source.name));
  const qualificationReasons: string[] = [];
  if (foundingMember) qualificationReasons.push("Existing Hall of Fame member");
  if (stats.runs >= 4500) qualificationReasons.push("4,500+ IPL runs");
  if (stats.wickets >= 175) qualificationReasons.push("175+ IPL wickets");
  if (stats.wickets >= 150 && bowlingAverage > 0 && bowlingAverage <= 32) qualificationReasons.push("150+ wickets at a strong average");
  if (stats.matches >= 200 && (stats.runs >= 3000 || stats.wickets >= 100)) qualificationReasons.push("200+ matches with elite production");
  if (stats.runs >= 2000 && stats.wickets >= 100) qualificationReasons.push("Landmark all-round career");
  if (orangeCaps >= 2 && stats.matches >= 50 && stats.runs >= 2000) qualificationReasons.push("Multiple Orange Caps");
  if (purpleCaps >= 2 && stats.matches >= 50 && stats.wickets >= 75) qualificationReasons.push("Multiple Purple Caps");
  if (orangeCaps >= 1 && stats.runs >= 3500) qualificationReasons.push("Orange Cap and 3,500+ runs");
  if (purpleCaps >= 1 && stats.wickets >= 120) qualificationReasons.push("Purple Cap and 120+ wickets");
  // The fallback remains stricter for active players, while landmark paths
  // are career-complete achievements and apply regardless of retirement.
  const threshold = isRetired ? 55 : 65;
  if (minimumCareer && score >= threshold) qualificationReasons.push(`${score.toFixed(1)} Hall of Fame score`);

  return {
    playerId: source.id,
    name: source.name,
    role: source.role,
    retirementSeason: source.retirementSeason ?? null,
    isRetired,
    foundingMember,
    matches: stats.matches,
    runs: stats.runs,
    wickets: stats.wickets,
    battingAverage,
    strikeRate,
    bowlingAverage,
    economy,
    orangeCaps,
    purpleCaps,
    seasonMvps,
    score,
    inducted: qualificationReasons.length > 0,
    qualificationReasons,
  };
}

export function evaluateHallOfFameCandidate(snapshot: HistoricalPlayerSnapshot): HallOfFameEvaluation {
  return evaluateHallOfFameSource(snapshot, true, HISTORICAL_LEAGUE_HISTORY);
}

export function evaluateRetiredHallOfFameClass(
  snapshots: Record<string, HistoricalPlayerSnapshot>,
): HallOfFameEvaluation[] {
  return Object.values(snapshots)
    .map(evaluateHallOfFameCandidate)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

export function evaluateCareerHallOfFame(
  activePlayers: Record<string, Player>,
  snapshots: Record<string, HistoricalPlayerSnapshot>,
  simulatedLeagueHistory: LeagueHistorySeason[] = [],
): HallOfFameEvaluation[] {
  const leagueHistory = [...HISTORICAL_LEAGUE_HISTORY, ...simulatedLeagueHistory];
  return [
    ...Object.values(activePlayers).map((player) => evaluateHallOfFameSource(player, false, leagueHistory)),
    ...Object.values(snapshots).map((snapshot) => evaluateHallOfFameSource(snapshot, true, leagueHistory)),
  ].sort((left, right) => (
    Number(right.inducted) - Number(left.inducted)
    || right.score - left.score
    || left.name.localeCompare(right.name)
  ));
}
