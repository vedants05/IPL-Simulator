import type { Player, Team, TradeOffer, TradeRecord, TradeWillingness } from "@/lib/types";
import { addDaysToDateKey } from "./careerCalendar";
import { getPlayerSeasonHistory } from "./playerHistory";
import { getNextBidAmount, roundDownToLegalBid } from "./auctionRules";

export const TRADE_WINDOW_START_OFFSET_DAYS = 7;
export const TRADE_WINDOW_END_MONTH = 10;
export const TRADE_WINDOW_END_DAY = 31;
export const MAX_TRADE_COUNTER_OFFERS = 20;
export const MINI_TRADE_OVERDRAFT_LAKHS = 500;
export const REPUTATION_TEN_TRADE_PREMIUM = 1.45;

/** A trade may preserve, but must not worsen, an existing overseas overflow. */
export function getTradeOverseasLimit(team: Team, players: Record<string, Player>): number {
  const startingCount = team.squad.filter((id) => players[id]?.nationality === "Overseas").length;
  return Math.max(team.overseasPlayersMax ?? 8, startingCount);
}

export interface TradeWindowDates {
  startsOn: string;
  endsOn: string;
}

export function getTradeWindowDates(finalDate: string, season: number): TradeWindowDates {
  return {
    startsOn: addDaysToDateKey(finalDate, TRADE_WINDOW_START_OFFSET_DAYS),
    endsOn: `${season}-${String(TRADE_WINDOW_END_MONTH).padStart(2, "0")}-${TRADE_WINDOW_END_DAY}`,
  };
}

export function isTradeWindowOpen(date: string, finalDate?: string, season?: number): boolean {
  if (!finalDate || season === undefined) return false;
  const window = getTradeWindowDates(finalDate, season);
  return date >= window.startsOn && date <= window.endsOn;
}

function rating(player: Player): number {
  return Math.max(player.currentBatting ?? 0, player.currentBowling ?? 0);
}

function ageFactor(age: number): number {
  if (age <= 21) return 1.12;
  if (age <= 24) return 1.08;
  if (age <= 28) return 1.04;
  if (age <= 31) return 1;
  if (age <= 34) return 0.96;
  if (age <= 37) return 0.9;
  return 0.82;
}

function roleFamily(player: Player): "bat" | "pace" | "spin" | "allrounder" | "keeper" {
  if (player.role === "Pace Bowler") return "pace";
  if (player.role === "Spin Bowler") return "spin";
  if (player.role === "WK-Batsman") return "keeper";
  if (player.role === "All-Rounder") return "allrounder";
  return "bat";
}

export function allRounderTradeClass(player: Player): "batting" | "bowling" | "balanced" | null {
  if (player.role !== "All-Rounder") return null;
  const batting = player.currentBatting ?? 0;
  const bowling = player.currentBowling ?? 0;
  if (batting >= 72 && bowling >= 72 && Math.abs(batting - bowling) <= 5) return "balanced";
  if (batting >= bowling + 6 || bowling < 72) return "batting";
  return "bowling";
}

function performanceScore(player: Player, season: number): number {
  const seasons = [season, season - 1, season - 2];
  const weights = [0.6, 0.25, 0.15];
  let weighted = 0;
  let weightTotal = 0;
  seasons.forEach((year, index) => {
    const entry = getPlayerSeasonHistory(player.iplHistory, String(year));
    const stats = entry?.seasonStats;
    if (!stats) return;
    const sample = Math.max(stats.matches, stats.balls > 0 ? stats.balls / 30 : 0, stats.oversBowled > 0 ? stats.oversBowled / 4 : 0);
    if (sample < 1) return;
    const batRate = stats.balls >= 70 ? Math.min(1.3, (stats.runs / Math.max(1, stats.balls)) / 0.9) : 0;
    const bowlRate = stats.oversBowled >= 14 ? Math.min(1.3, (stats.wickets / Math.max(1, stats.oversBowled)) / 0.7) : 0;
    const relevant = player.role === "Pace Bowler" || player.role === "Spin Bowler"
      ? bowlRate
      : player.role === "All-Rounder" ? Math.max(batRate, bowlRate) : batRate;
    weighted += relevant * weights[index];
    weightTotal += weights[index];
  });
  return weightTotal > 0 ? weighted / weightTotal : 0.75;
}

function tenureSeasons(player: Player, teamId: string, season: number): number {
  return new Set((player.iplHistory ?? [])
    .filter((entry) => entry.teamId === teamId && Number(entry.season) <= season)
    .map((entry) => entry.season)).size;
}

function teamRoleNeed(team: Team, player: Player, players: Record<string, Player>): number {
  const family = roleFamily(player);
  const sameRole = team.squad
    .map((id) => players[id])
    .filter((candidate): candidate is Player => Boolean(candidate && roleFamily(candidate) === family));
  // Squad need should break close decisions, not overwhelm a huge ability gap.
  if (sameRole.length <= 2) return 1.12;
  if (sameRole.length <= 4) return 1.05;
  if (sameRole.length >= 7) return 0.94;
  return 1;
}

export function calculateTeamTradeValue(input: {
  player: Player;
  team: Team;
  players: Record<string, Player>;
  season: number;
  auctionType?: "mini" | "mega";
  currentInjured?: boolean;
}): number {
  const { player, team, players, season } = input;
  const current = rating(player);
  const potential = Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0);
  const headroom = Math.max(0, potential - current);
  const performance = performanceScore(player, season);
  const salary = getPlayerSeasonHistory(player.iplHistory, String(season))?.price ?? player.basePrice;
  const salaryEfficiency = salary > 0 ? Math.max(0.78, Math.min(1.18, 1 + ((current * 10 - salary) / 500))) : 1;
  const reputation = player.reputation ?? 5;
  const leadership = team.captainContinuityId === player.id || team.viceCaptainContinuityId === player.id ? 1.18 : 1;
  const loyalty = 1 + Math.min(6, tenureSeasons(player, team.id, season)) * 0.025;
  const injury = input.currentInjured ? 0.75 : 1;
  // Current ability is intentionally non-linear. The difference between an 87
  // and a 72 is far more important in a win-now IPL trade than the raw 15-point
  // rating gap, so low-CA prospects cannot buy established stars through PA.
  const caBase = Math.max(30, Math.pow(Math.max(0, current - 55), 2) * 1.7);
  const headroomRate = player.age <= 21 ? 20 : player.age <= 24 ? 16 : player.age <= 28 ? 10 : 4;
  const cappedHeadroom = Math.min(headroom, player.age <= 24 ? 18 : player.age <= 28 ? 12 : 6);
  const highPotentialBonus = player.age <= 28 ? Math.pow(Math.max(0, potential - 82), 2) * 2.5 : 0;
  const eliteCaPremium = current >= 89 ? 1.35 : current >= 86 ? 1.22 : current >= 82 ? 1.1 : 1;
  const base = (caBase + cappedHeadroom * headroomRate + highPotentialBonus) * eliteCaPremium;
  const reputationValuePremium = reputation >= 10 ? 1.35 : reputation >= 9 ? 1.16 : reputation >= 8 ? 1.07 : 1;
  const value = base * ageFactor(player.age) * (0.72 + performance * 0.28) * salaryEfficiency
    * teamRoleNeed(team, player, players) * reputationValuePremium * leadership * loyalty * injury;
  return Math.round(value);
}

export function getTradeSalaryBand(player: Player, season: number): { minimum: number; maximum: number; demand: number } {
  const currentSalary = getPlayerSeasonHistory(player.iplHistory, String(season))?.price ?? player.basePrice;
  const current = rating(player);
  const potential = Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0);
  const performance = performanceScore(player, season);
  const reputation = player.reputation ?? 5;
  const legalCurrent = roundUpToLegalTradeSalary(Math.max(20, currentSalary));
  const wantsRaise = current >= 82 || potential - current >= 5 || performance >= 0.92 || reputation >= 8;
  if (!wantsRaise) return { minimum: legalCurrent, maximum: legalCurrent, demand: legalCurrent };
  const raise = current >= 88 || reputation >= 9 ? 1.12 : current >= 84 || performance >= 1.05 ? 1.08 : 1.05;
  const demand = roundUpToLegalTradeSalary(legalCurrent * raise);
  const hasRoom = reputation < 9 && performance < 1.1;
  const minimum = hasRoom ? Math.max(legalCurrent, previousLegalTradeSalary(demand)) : demand;
  return { minimum, maximum: demand, demand };
}

export function roundUpToLegalTradeSalary(amount: number): number {
  const safe = Math.max(20, Math.ceil(amount));
  const down = roundDownToLegalBid(20, safe);
  return down >= safe ? down : getNextBidAmount(down);
}

function previousLegalTradeSalary(amount: number): number {
  let previous = 20;
  let next = 20;
  while (next < amount) { previous = next; next = getNextBidAmount(next); }
  return previous;
}

export function getTradeSalaryOptions(player: Player, season: number): number[] {
  const { minimum, demand } = getTradeSalaryBand(player, season);
  const options = [minimum];
  while (options[options.length - 1] < demand) options.push(getNextBidAmount(options[options.length - 1]));
  return options.filter((amount) => amount <= demand);
}

export function isLegalTradeSalary(amount: number): boolean {
  return roundUpToLegalTradeSalary(amount) === amount;
}

export function getTeamTradeWillingness(input: {
  player: Player;
  team: Team;
  players: Record<string, Player>;
  season: number;
  currentInjured?: boolean;
}): TradeWillingness {
  const { player, team, players, season } = input;
  const value = calculateTeamTradeValue(input);
  const tenure = tenureSeasons(player, team.id, season);
  const role = teamRoleNeed(team, player, players);
  const perf = performanceScore(player, season);
  // Rated 82+ players are never considered freely available. They can still be
  // moved by an exceptional offer, but their baseline willingness is reluctant.
  if (rating(player) >= 82) return tenure >= 5 || rating(player) >= 86 || (player.reputation ?? 0) >= 9
    ? "highly-reluctant"
    : "reluctant";
  if (player.setForRelease || role <= 0.9 || (perf < 0.55 && tenure < 2)) return "available";
  if (tenure >= 6 || rating(player) >= 88 || (player.reputation ?? 0) >= 10) return "highly-reluctant";
  if (tenure >= 3 || value >= 900 || role < 1) return "reluctant";
  return "open";
}

const willingnessThreshold: Record<TradeWillingness, number> = {
  available: 0.98,
  open: 1.05,
  reluctant: 1.16,
  "highly-reluctant": 1.3,
};

export function isTradeBalanced(input: {
  offeredValue: number;
  requestedValue: number;
  requestedWillingness: TradeWillingness;
  requestedPremium?: number;
}): boolean {
  if (input.requestedValue <= 0) return false;
  const required = input.requestedValue
    * willingnessThreshold[input.requestedWillingness]
    * Math.max(1, input.requestedPremium ?? 1);
  // Avoid rounding noise making marginal low-value swaps appear acceptable.
  return input.offeredValue >= Math.ceil(required);
}

/** Reputation-10 players are franchise assets: a merely fair package is never enough. */
export function getRequestedTradePremium(players: Player[]): number {
  return players.some((player) => (player.reputation ?? 0) >= 10)
    ? REPUTATION_TEN_TRADE_PREMIUM
    : 1;
}

export function calculateTradePackageValue(values: number[]): number {
  const sorted = [...values].sort((a, b) => b - a);
  // Additional players help, but roster spots are finite: quantity cannot be
  // treated as a perfect substitute for one elite match-winner.
  const weights = [1, 0.88, 0.76];
  return Math.round(sorted.slice(0, 3).reduce((sum, value, index) => sum + value * weights[index], 0));
}

export function explainTradeNeed(team: Team, incoming: Player, players: Record<string, Player>): string {
  const family = roleFamily(incoming);
  const count = team.squad.map((id) => players[id]).filter((p) => p && roleFamily(p) === family).length;
  if (count <= 2) return `improves ${family} depth`;
  if (incoming.potentialBatting > incoming.currentBatting + 6 || incoming.potentialBowling > incoming.currentBowling + 6) return "adds development upside";
  return "improves squad balance";
}

export function tradeRecordForOffer(input: {
  offer: TradeOffer;
  date: string;
  salaries: Record<string, number>;
  explanation?: string;
}): TradeRecord {
  return {
    id: `trade:${input.offer.id}`,
    season: input.offer.season,
    date: input.date,
    fromTeamId: input.offer.proposerTeamId,
    toTeamId: input.offer.recipientTeamId,
    outgoingPlayerIds: input.offer.offeredPlayerIds,
    incomingPlayerIds: input.offer.requestedPlayerIds,
    salaries: input.salaries,
    explanation: input.explanation,
  };
}
