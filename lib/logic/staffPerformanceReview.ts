import { HISTORICAL_LEAGUE_HISTORY, type LeagueHistorySeason } from "../data/leagueHistory";
import { getStaffRelationship } from "../data/staffRelationships";
import type { Player, Team } from "../types";
import {
  releaseCareerStaff,
  type CareerStaffContract,
  type CareerStaffState,
  type StaffNewsEvent,
} from "./staffContracts";
import {
  calculateEffectiveJobPressure,
  calculateSeasonUnderperformancePressure,
  calculateTwoSeasonPerformancePressure,
  getStaffJobSecurityState,
  trophyProtectionPreventsDismissal,
  type StaffJobSecurityState,
} from "./staffJobSecurity";

export interface StaffReviewStanding { teamId: string; played?: number; }
export interface StaffReviewPlayerStats {
  teamId?: string; matches?: number; runs?: number; wickets?: number; runsConceded?: number;
  oversBowled?: number; catches?: number; stumpings?: number; runOuts?: number;
}

export interface StaffDepartmentReview {
  expectedRank: number;
  actualRank: number;
  pressure: number;
}

export interface StaffSeasonReview {
  season: number;
  teamId: string;
  expectedPosition: number;
  finalPosition: number;
  rawPressure: number;
  effectivePressure: number;
  security: StaffJobSecurityState;
  trophyProtected: boolean;
  wonTitle?: boolean;
  headCoachStaffId: string | null;
  headCoachDismissed: boolean;
  assistantDismissals: string[];
  specialistDismissals: string[];
  specialistSurvivors: string[];
  departments: {
    batting: StaffDepartmentReview;
    bowling: StaffDepartmentReview;
    fielding: StaffDepartmentReview;
  };
}

const clamp = (value: number, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));
const hashUnit = (value: string) => {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return (output >>> 0) / 4294967296;
};

const averageTop = (values: number[], count: number) => {
  const selected = [...values].sort((a, b) => b - a).slice(0, count);
  return selected.length ? selected.reduce((sum, value) => sum + value, 0) / selected.length : 50;
};

const rankScores = (teamIds: string[], scores: Record<string, number>) => Object.fromEntries(
  [...teamIds]
    .sort((left, right) => (scores[right] ?? 0) - (scores[left] ?? 0) || left.localeCompare(right))
    .map((teamId, index) => [teamId, index + 1]),
) as Record<string, number>;

const normalizeHistoricalTeam = (teamId: string) => teamId === "DD" ? "DC" : teamId === "KXIP" ? "PBKS" : teamId;

export function calculateStaffExpectedRanks(input: {
  teamIds: string[];
  teams: Record<string, Team>;
  players: Record<string, Player>;
  staffState: CareerStaffState;
  previousSeason: LeagueHistorySeason | null;
}): { overall: Record<string, number>; batting: Record<string, number>; bowling: Record<string, number>; fielding: Record<string, number> } {
  const previousPositions = Object.fromEntries((input.previousSeason?.standings ?? []).map((standing, index) => [standing.teamId, index + 1]));
  const titleCounts: Record<string, number> = Object.fromEntries(input.teamIds.map((teamId) => [teamId, 0]));
  HISTORICAL_LEAGUE_HISTORY.forEach((season) => {
    const champion = normalizeHistoricalTeam(season.championTeamId);
    if (champion in titleCounts) titleCounts[champion] += 1;
  });
  const battingScores: Record<string, number> = {};
  const bowlingScores: Record<string, number> = {};
  const overallScores: Record<string, number> = {};
  input.teamIds.forEach((teamId) => {
    const squad = Object.values(input.players).filter((player) => player.currentTeamId === teamId);
    const batting = averageTop(squad.map((player) => player.currentBatting), 7);
    const bowling = averageTop(squad.map((player) => player.currentBowling), 5);
    const headCoach = Object.values(input.staffState.contracts).find((staff) => (
      staff.status === "contracted" && staff.teamId === teamId && staff.roles.includes("head_coach")
    ));
    const previous = previousPositions[teamId] ?? 6;
    battingScores[teamId] = batting;
    bowlingScores[teamId] = bowling;
    overallScores[teamId] = batting * 0.44 + bowling * 0.36
      + (headCoach?.currentAbility ?? 65) * 0.1
      + (11 - previous) * 0.65
      + (titleCounts[teamId] ?? 0) * 0.35;
  });
  const overall = rankScores(input.teamIds, overallScores);
  return {
    overall,
    batting: rankScores(input.teamIds, battingScores),
    bowling: rankScores(input.teamIds, bowlingScores),
    // No persistent player fielding attribute exists yet; overall squad quality
    // is the fairest preseason proxy, while actual fielding uses recorded events.
    fielding: { ...overall },
  };
}

const actualDepartmentRanks = (
  teamIds: string[], standings: StaffReviewStanding[], playerStats: Record<string, StaffReviewPlayerStats>,
) => {
  const played = Object.fromEntries(standings.map((row) => [row.teamId, Math.max(1, Number(row.played ?? 14))]));
  const batting = Object.fromEntries(teamIds.map((teamId) => [teamId, 0])) as Record<string, number>;
  const bowling = { ...batting };
  const fielding = { ...batting };
  const bowlingRuns = { ...batting };
  const bowlingOvers = { ...batting };
  Object.values(playerStats).forEach((stats) => {
    const teamId = stats.teamId;
    if (!teamId || !(teamId in batting)) return;
    batting[teamId] += Number(stats.runs ?? 0);
    bowling[teamId] += Number(stats.wickets ?? 0);
    bowlingRuns[teamId] += Number(stats.runsConceded ?? 0);
    bowlingOvers[teamId] += Number(stats.oversBowled ?? 0);
    fielding[teamId] += Number(stats.catches ?? 0) + Number(stats.runOuts ?? 0) * 1.25 + Number(stats.stumpings ?? 0) * 1.1;
  });
  teamIds.forEach((teamId) => {
    batting[teamId] /= played[teamId] ?? 14;
    const economy = bowlingOvers[teamId] > 0 ? bowlingRuns[teamId] / bowlingOvers[teamId] : 8.5;
    bowling[teamId] = bowling[teamId] * 8 - economy * (played[teamId] ?? 14);
    fielding[teamId] /= played[teamId] ?? 14;
  });
  const hasFieldingSample = Object.values(fielding).some((score) => score > 0);
  return {
    batting: rankScores(teamIds, batting),
    bowling: rankScores(teamIds, bowling),
    fielding: hasFieldingSample ? rankScores(teamIds, fielding) : null,
  };
};

const departmentPressure = (expectedRank: number, actualRank: number) => (
  calculateSeasonUnderperformancePressure(expectedRank, actualRank)
);

const shouldDismissHeadCoach = (pressure: number, seed: string) => pressure >= 90
  || (pressure >= 80 && hashUnit(`${seed}:head`) < 0.7)
  || (pressure >= 65 && hashUnit(`${seed}:head`) < 0.25);

const specialistDepartment = (contract: CareerStaffContract): "batting" | "bowling" | "fielding" | null => {
  if (contract.roles.some((role) => role === "batting_coach" || role === "wicketkeeping_coach")) return "batting";
  if (contract.roles.some((role) => role === "pace_bowling_coach" || role === "spin_bowling_coach")) return "bowling";
  if (contract.roles.includes("fielding_coach")) return "fielding";
  return null;
};

export function processStaffSeasonPerformanceReview(input: {
  state: CareerStaffState;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  userTeamId: string;
  completedSeason: number;
  standings: StaffReviewStanding[];
  playerStats: Record<string, StaffReviewPlayerStats>;
  leagueHistory: LeagueHistorySeason[];
  seed: string;
}): CareerStaffState {
  if (!input.state.initialized || input.state.lastReviewedSeason === input.completedSeason || input.standings.length === 0) return input.state;
  let state = input.state;
  const teamIds = input.standings.map((standing) => standing.teamId);
  const previousSeason = input.leagueHistory.find((season) => season.season === input.completedSeason - 1) ?? null;
  const completed = input.leagueHistory.find((season) => season.season === input.completedSeason) ?? null;
  const expected = calculateStaffExpectedRanks({ teamIds, teams: input.teams, players: input.players, staffState: state, previousSeason });
  const actualOverall = Object.fromEntries(teamIds.map((teamId) => [teamId, input.standings.findIndex((standing) => standing.teamId === teamId) + 1]));
  const actualDepartments = actualDepartmentRanks(teamIds, input.standings, input.playerStats);
  const priorReviews = state.performanceReviews ?? [];
  const reviews: StaffSeasonReview[] = [];
  let newsEvents = [...state.newsEvents];

  teamIds.forEach((teamId) => {
    const finalPosition = actualOverall[teamId];
    const currentPressure = calculateSeasonUnderperformancePressure(expected.overall[teamId], finalPosition);
    const previousReview = priorReviews.find((review) => review.teamId === teamId && review.season === input.completedSeason - 1);
    const headCoach = Object.values(state.contracts).find((contract) => (
      contract.status === "contracted" && contract.teamId === teamId && contract.roles.includes("head_coach")
    )) ?? null;
    const sameHeadCoachCycle = Boolean(
      headCoach
      && previousReview?.headCoachStaffId === headCoach.staffId
      && (headCoach.startSeason ?? input.completedSeason) <= previousReview.season,
    );
    const rawPressure = calculateTwoSeasonPerformancePressure(
      currentPressure,
      sameHeadCoachCycle ? previousReview?.rawPressure ?? null : null,
    );
    const effectivePressure = calculateEffectiveJobPressure({ rawPressure, teamId });
    const wonPreviousSeason = sameHeadCoachCycle && previousSeason?.championTeamId === teamId;
    const trophyProtected = trophyProtectionPreventsDismissal(wonPreviousSeason, effectivePressure);
    const departments = {
      batting: { expectedRank: expected.batting[teamId], actualRank: actualDepartments.batting[teamId], pressure: departmentPressure(expected.batting[teamId], actualDepartments.batting[teamId]) },
      bowling: { expectedRank: expected.bowling[teamId], actualRank: actualDepartments.bowling[teamId], pressure: departmentPressure(expected.bowling[teamId], actualDepartments.bowling[teamId]) },
      fielding: {
        expectedRank: expected.fielding[teamId],
        actualRank: actualDepartments.fielding?.[teamId] ?? finalPosition,
        pressure: departmentPressure(expected.fielding[teamId], actualDepartments.fielding?.[teamId] ?? finalPosition),
      },
    };
    const aiControlled = teamId !== input.userTeamId;
    const headDismissed = Boolean(headCoach && aiControlled && !trophyProtected
      && shouldDismissHeadCoach(effectivePressure, `${input.seed}:${input.completedSeason}:${teamId}`));
    const assistantDismissals: string[] = [];
    const specialistDismissals: string[] = [];
    const specialistSurvivors: string[] = [];
    const originalTeam = Object.values(state.contracts).filter((contract) => contract.status === "contracted" && contract.teamId === teamId);

    if (headDismissed && headCoach) {
      state = releaseCareerStaff(state, headCoach.staffId, "club_sacked", input.completedSeason, `${input.completedSeason}-06-01`);
      newsEvents.push({ id: `staff-news:head-sacked:${teamId}:${input.completedSeason}`, kind: "head_coach_sacked", teamId, staffId: headCoach.staffId, publishedOn: `${input.completedSeason}-06-01` });
      originalTeam.filter((contract) => contract.staffId !== headCoach.staffId && contract.roles.includes("assistant_coach")).forEach((assistant) => {
        state = releaseCareerStaff(state, assistant.staffId, "club_sacked", input.completedSeason, `${input.completedSeason}-06-01`);
        assistantDismissals.push(assistant.staffId);
      });
    }

    if (aiControlled) originalTeam.filter((contract) => contract.staffId !== headCoach?.staffId && !contract.roles.includes("assistant_coach")).forEach((specialist) => {
      const department = specialistDepartment(specialist);
      if (!department) return;
      const review = departments[department];
      const excellent = review.actualRank <= 3 || review.actualRank <= review.expectedRank - 2;
      const relationship = headCoach ? getStaffRelationship(headCoach.staffSlug, specialist.staffSlug) : null;
      const followsDepartingHead = Boolean(headDismissed && relationship
        && hashUnit(`${input.seed}:${input.completedSeason}:${headCoach?.staffId}:${specialist.staffId}:follow`) < relationship.followChance);
      let dismissalChance = headDismissed ? 0.25 + review.pressure * 0.006 : review.pressure >= 80 ? 0.35 + (review.pressure - 80) * 0.02 : 0;
      if (excellent) dismissalChance -= 0.45;
      dismissalChance = clamp(dismissalChance, 0, 0.95);
      const dismissed = followsDepartingHead || hashUnit(`${input.seed}:${input.completedSeason}:${teamId}:${specialist.staffId}:specialist`) < dismissalChance;
      if (dismissed) {
        state = releaseCareerStaff(state, specialist.staffId, followsDepartingHead ? "staff_resigned" : "club_sacked", input.completedSeason, `${input.completedSeason}-06-01`);
        specialistDismissals.push(specialist.staffId);
      } else if (headDismissed) specialistSurvivors.push(specialist.staffId);
    });

    reviews.push({
      season: input.completedSeason, teamId, expectedPosition: expected.overall[teamId], finalPosition,
      rawPressure, effectivePressure, security: getStaffJobSecurityState(effectivePressure), trophyProtected,
      wonTitle: completed?.championTeamId === teamId,
      headCoachStaffId: headCoach?.staffId ?? null, headCoachDismissed: headDismissed,
      assistantDismissals, specialistDismissals, specialistSurvivors, departments,
    });
  });

  return {
    ...state,
    performanceReviews: [...priorReviews.filter((review) => review.season >= input.completedSeason - 1), ...reviews],
    lastReviewedSeason: input.completedSeason,
    newsEvents,
  };
}
