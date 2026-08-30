import type { ClubOwnershipRecord } from "@/lib/data/clubOwnership";
import type { Player, Team } from "@/lib/types";

export type SupporterGroupId =
  | "hardcore"
  | "traditional"
  | "family"
  | "fairWeather"
  | "digital"
  | "starDriven"
  | "corporate";

export interface SupporterGroupDefinition {
  id: SupporterGroupId;
  label: string;
  shortLabel: string;
  color: string;
  resultSensitivity: number;
}

export interface TeamSupporterCulture {
  teamId: string;
  identity: string;
  description: string;
  baseComposition: Record<SupporterGroupId, number>;
  loyalty: number;
  volatility: number;
  expectations: number;
  starFocus: number;
  youthPreference: number;
  localIdentity: number;
  boardScepticism: number;
}

export interface SupporterFixture {
  id: string;
  date?: string;
  teamA: string;
  teamB: string;
  played?: boolean;
  winner?: string | null;
  stage?: string;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  playerOfTheMatchId?: string | null;
}

export type SupporterEventCategory = "results" | "squad" | "staff" | "board" | "leadership" | "injuries";

export interface SupporterClubEvent {
  id: string;
  date: string;
  season: number;
  category: SupporterEventCategory;
  kind: string;
  title: string;
  detail: string;
  impact: number;
  subjectId?: string;
}

export interface SupporterDepartmentReview {
  season: number;
  expectedPosition: number;
  finalPosition: number;
  wonTitle?: boolean;
  batting?: { expectedRank: number; actualRank: number };
  bowling?: { expectedRank: number; actualRank: number };
  fielding?: { expectedRank: number; actualRank: number };
}

export interface SupporterBoardContext {
  annualStaffBudget?: number;
  committedStaffSalary?: number;
  compensationPaid?: number;
  activeProjects?: number;
}

export interface SupporterPlayerStats {
  matches?: number;
  runs?: number;
  wickets?: number;
  battingAverage?: number;
  strikeRate?: number;
  economy?: number;
  runsConceded?: number;
  oversBowled?: number;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
}

export interface SupporterStaffMember {
  id: string;
  fullName: string;
  primaryRole: string;
  roles: string[];
  currentAbility: number;
  reputation: number;
  loyalty: number;
  tenureSeasons: number;
}

export interface SupporterGroupView extends SupporterGroupDefinition {
  share: number;
  happiness: number;
  trend: number;
  priority: string;
}

export interface SupporterApprovalItem {
  id: string;
  name: string;
  detail: string;
  approval: number;
  trend: number;
}

export interface SupporterTrendPoint {
  date: string;
  label: string;
  happiness: number;
  delta: number;
}

export interface SupporterReaction {
  id: string;
  date: string;
  title: string;
  body: string;
  delta: number;
}

export interface SupporterConcern {
  id: string;
  title: string;
  evidence: string;
  severity: number;
  category: SupporterEventCategory;
}

export interface SupporterCategoryTrend {
  category: SupporterEventCategory;
  label: string;
  score: number;
  trend: number;
  explanation: string;
}

export interface TeamSupporterView {
  culture: TeamSupporterCulture;
  groups: SupporterGroupView[];
  overallHappiness: number;
  mood: string;
  trajectory: number;
  summary: string;
  expectation: string;
  homeAtmosphere: number;
  confidenceInDirection: number;
  categoryApproval: {
    results: number;
    squad: number;
    staff: number;
    board: number;
    leadership: number;
  };
  popularPlayers: SupporterApprovalItem[];
  playersUnderPressure: SupporterApprovalItem[];
  staffApproval: SupporterApprovalItem[];
  priorities: string[];
  trend: SupporterTrendPoint[];
  reactions: SupporterReaction[];
  eventLedger: SupporterClubEvent[];
  concerns: SupporterConcern[];
  categoryTrends: SupporterCategoryTrend[];
  fanbaseIndex: number;
  fanbaseGrowth: number;
  cultureEvolution: string[];
  memorySummary: string;
}

export const SUPPORTER_GROUPS: SupporterGroupDefinition[] = [
  { id: "hardcore", label: "Hardcore supporters", shortLabel: "Hardcore", color: "#dc2626", resultSensitivity: 0.7 },
  { id: "traditional", label: "Traditional and local", shortLabel: "Local", color: "#d97706", resultSensitivity: 0.55 },
  { id: "family", label: "Family supporters", shortLabel: "Family", color: "#16a34a", resultSensitivity: 0.7 },
  { id: "fairWeather", label: "Fair-weather followers", shortLabel: "Fair-weather", color: "#0ea5e9", resultSensitivity: 1.45 },
  { id: "digital", label: "Digital and social", shortLabel: "Digital", color: "#8b5cf6", resultSensitivity: 1.2 },
  { id: "starDriven", label: "Star-driven followers", shortLabel: "Star-driven", color: "#ec4899", resultSensitivity: 1.05 },
  { id: "corporate", label: "Corporate and casual", shortLabel: "Corporate", color: "#64748b", resultSensitivity: 1.0 },
];

const GROUP_CATEGORY_WEIGHTS: Record<SupporterGroupId, Record<SupporterEventCategory, number>> = {
  hardcore: { results: 1.05, squad: 0.7, staff: 0.85, board: 0.9, leadership: 1.15, injuries: 0.7 },
  traditional: { results: 0.8, squad: 0.75, staff: 1.05, board: 1.15, leadership: 1.15, injuries: 0.75 },
  family: { results: 0.85, squad: 0.7, staff: 0.65, board: 0.65, leadership: 0.75, injuries: 0.85 },
  fairWeather: { results: 1.55, squad: 1.05, staff: 0.45, board: 0.45, leadership: 0.65, injuries: 0.5 },
  digital: { results: 1.25, squad: 1.15, staff: 0.75, board: 0.95, leadership: 1.0, injuries: 0.8 },
  starDriven: { results: 1.0, squad: 1.55, staff: 0.45, board: 0.55, leadership: 1.15, injuries: 1.0 },
  corporate: { results: 1.2, squad: 0.9, staff: 0.7, board: 1.0, leadership: 0.8, injuries: 0.55 },
};

const structure = (
  hardcore: number,
  traditional: number,
  family: number,
  fairWeather: number,
  digital: number,
  starDriven: number,
  corporate: number,
): Record<SupporterGroupId, number> => ({ hardcore, traditional, family, fairWeather, digital, starDriven, corporate });

export const TEAM_SUPPORTER_CULTURES: Record<string, TeamSupporterCulture> = {
  CSK: { teamId: "CSK", identity: "Continuity and icons", description: "A deeply established support that values stability, experience and respectful treatment of club figures.", baseComposition: structure(25, 24, 12, 5, 8, 21, 5), loyalty: 94, volatility: 28, expectations: 88, starFocus: 79, youthPreference: 38, localIdentity: 91, boardScepticism: 31 },
  MI: { teamId: "MI", identity: "Elite standards", description: "A prestigious, success-expectant following that demands elite squad construction and title contention.", baseComposition: structure(18, 14, 13, 12, 12, 20, 11), loyalty: 76, volatility: 56, expectations: 96, starFocus: 83, youthPreference: 66, localIdentity: 70, boardScepticism: 35 },
  KKR: { teamId: "KKR", identity: "Passion and identity", description: "An expressive, culturally attached and digitally active fanbase that wants bold cricket and visible commitment.", baseComposition: structure(22, 20, 12, 8, 18, 14, 6), loyalty: 86, volatility: 64, expectations: 82, starFocus: 68, youthPreference: 58, localIdentity: 91, boardScepticism: 51 },
  RCB: { teamId: "RCB", identity: "Stars and relevance", description: "An enormous but fluid audience driven primarily by superstar attachment, online relevance and visible success.", baseComposition: structure(7, 5, 5, 20, 26, 32, 5), loyalty: 31, volatility: 91, expectations: 90, starFocus: 98, youthPreference: 45, localIdentity: 35, boardScepticism: 64 },
  RR: { teamId: "RR", identity: "Discovery and development", description: "A youth-friendly, recruitment-aware following that values intelligent planning and outperforming richer teams.", baseComposition: structure(14, 14, 18, 9, 20, 10, 15), loyalty: 63, volatility: 47, expectations: 64, starFocus: 43, youthPreference: 95, localIdentity: 61, boardScepticism: 43 },
  SRH: { teamId: "SRH", identity: "Local and competitive", description: "A locally grounded support that values home strength, consistency and a clear cricketing identity.", baseComposition: structure(19, 22, 18, 10, 12, 10, 9), loyalty: 78, volatility: 53, expectations: 72, starFocus: 49, youthPreference: 55, localIdentity: 87, boardScepticism: 68 },
  DC: { teamId: "DC", identity: "Progress overdue", description: "A metropolitan fanbase willing to accept a clear rebuild but impatient with repeated resets and wasted potential.", baseComposition: structure(13, 17, 13, 19, 15, 12, 11), loyalty: 57, volatility: 75, expectations: 76, starFocus: 61, youthPreference: 73, localIdentity: 69, boardScepticism: 76 },
  PBKS: { teamId: "PBKS", identity: "Loyal but frustrated", description: "A resilient regional core that stays attached while demanding stability and an end to repeated rebuilding.", baseComposition: structure(20, 23, 14, 16, 11, 10, 6), loyalty: 84, volatility: 67, expectations: 66, starFocus: 52, youthPreference: 59, localIdentity: 92, boardScepticism: 84 },
  GT: { teamId: "GT", identity: "A tradition taking shape", description: "A newer, family-oriented following building attachment through consistency, home success and emerging club figures.", baseComposition: structure(12, 18, 22, 17, 13, 9, 9), loyalty: 55, volatility: 58, expectations: 78, starFocus: 45, youthPreference: 63, localIdentity: 72, boardScepticism: 37 },
  LSG: { teamId: "LSG", identity: "Identity in progress", description: "A newer, digitally engaged and results-sensitive audience still waiting for durable traditions and icons.", baseComposition: structure(10, 15, 18, 20, 19, 10, 8), loyalty: 44, volatility: 82, expectations: 79, starFocus: 58, youthPreference: 58, localIdentity: 63, boardScepticism: 79 },
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const rounded = (value: number) => Math.round(clamp(value));

const fallbackCulture = (teamId: string): TeamSupporterCulture => ({
  teamId,
  identity: "Developing support",
  description: "A balanced supporter culture that will take shape through the club's results and decisions.",
  baseComposition: structure(15, 15, 15, 15, 15, 15, 10),
  loyalty: 60,
  volatility: 55,
  expectations: 65,
  starFocus: 55,
  youthPreference: 55,
  localIdentity: 60,
  boardScepticism: 50,
});

const matchDelta = (fixture: SupporterFixture, teamId: string, culture: TeamSupporterCulture) => {
  const knockout = fixture.stage && fixture.stage !== "league";
  if (!fixture.winner) return knockout ? -2 : 0;
  const won = fixture.winner === teamId;
  const volatility = 0.75 + culture.volatility / 200;
  const rivalries: Record<string, string[]> = {
    CSK: ["MI", "RCB"], MI: ["CSK"], RCB: ["CSK", "KKR"], KKR: ["RCB"],
    DC: ["PBKS"], PBKS: ["DC"], SRH: ["RCB"], RR: ["GT"], GT: ["RR"], LSG: ["GT"],
  };
  const opponent = fixture.teamA === teamId ? fixture.teamB : fixture.teamA;
  const rivalryMultiplier = rivalries[teamId]?.includes(opponent) ? 1.3 : 1;
  const ownScore = fixture.teamA === teamId ? fixture.scoreA : fixture.scoreB;
  const opposingScore = fixture.teamA === teamId ? fixture.scoreB : fixture.scoreA;
  const runMargin = ownScore && opposingScore ? Math.abs(ownScore.runs - opposingScore.runs) : 0;
  const marginMultiplier = 1 + Math.min(0.35, runMargin / 180);
  const homeModifier = fixture.teamA === teamId && !won ? 1.12 : 1;
  return (won ? (knockout ? 8 : 4) : (knockout ? -10 : -4)) * volatility * rivalryMultiplier * marginMultiplier * homeModifier;
};

const moodFor = (score: number) => {
  if (score >= 90) return "Jubilant";
  if (score >= 82) return "Delighted";
  if (score >= 73) return "Optimistic";
  if (score >= 63) return "Content";
  if (score >= 54) return "Patient";
  if (score >= 45) return "Uncertain";
  if (score >= 35) return "Concerned";
  if (score >= 24) return "Frustrated";
  if (score >= 12) return "Angry";
  return "Hostile";
};

const expectationFor = (culture: TeamSupporterCulture, position: number | null) => {
  const target = culture.expectations >= 90 ? 2 : culture.expectations >= 78 ? 4 : culture.expectations >= 65 ? 6 : 8;
  if (!position) return `Supporters expect a finish around ${target}${target === 2 ? "nd" : "th"} or better.`;
  const difference = target - position;
  if (difference >= 2) return `The club is comfortably exceeding a minimum expectation of ${target}th.`;
  if (difference >= 0) return `The club is currently meeting supporter expectations of a top-${target} finish.`;
  if (difference === -1) return `The club is narrowly below the expected top-${target} pace.`;
  return `Supporters believe the club is falling well short of a top-${target} expectation.`;
};

const playerPerformance = (stats: SupporterPlayerStats | undefined) => {
  if (!stats || (stats.matches ?? 0) === 0) return 42;
  const matches = Math.max(1, stats.matches ?? 1);
  const runsPerMatch = (stats.runs ?? 0) / matches;
  const wicketsPerMatch = (stats.wickets ?? 0) / matches;
  return clamp(38 + runsPerMatch * 0.75 + wicketsPerMatch * 16 + ((stats.strikeRate ?? 125) - 125) * 0.08 - Math.max(0, (stats.economy ?? 8.5) - 8.5) * 2);
};

const groupPriority = (
  group: SupporterGroupId,
  categories: TeamSupporterView["categoryApproval"],
  culture: TeamSupporterCulture,
) => {
  if (group === "starDriven") return categories.squad < 58 ? "Recruit or restore a marquee performer" : "Keep the club's leading personalities central";
  if (group === "traditional") return culture.localIdentity >= 75 ? "Protect the club's identity and long-serving core" : "Build stronger local connections";
  if (group === "family") return "Sustain an entertaining and welcoming home matchday";
  if (group === "digital") return categories.results < 55 ? "Create a result that changes the online narrative" : "Keep the club relevant through standout performances";
  if (group === "corporate") return categories.results < 60 ? "Return the club to visible contention" : "Maintain the club's prestige and profile";
  if (group === "fairWeather") return "Stay in the playoff race";
  return categories.leadership < 55 ? "Restore leadership and competitive standards" : "Reward commitment and beat major rivals";
};

export function buildTeamSupporterView(input: {
  team: Team;
  fixtures: SupporterFixture[];
  standingPosition: number | null;
  squadPlayers: Player[];
  playerStats: Record<string, SupporterPlayerStats>;
  staff: SupporterStaffMember[];
  ownership: ClubOwnershipRecord;
  captainId?: string | null;
  viceCaptainId?: string | null;
  activeInjuryCount?: number;
  clubEvents?: SupporterClubEvent[];
  departmentReviews?: SupporterDepartmentReview[];
  boardContext?: SupporterBoardContext;
  currentSeason?: number;
}): TeamSupporterView {
  const { team, standingPosition, squadPlayers, playerStats, staff, ownership } = input;
  const culture = TEAM_SUPPORTER_CULTURES[team.id] ?? fallbackCulture(team.id);
  const fixtures = input.fixtures
    .filter((fixture) => fixture.played && (fixture.teamA === team.id || fixture.teamB === team.id))
    .sort((left, right) => (left.date ?? "").localeCompare(right.date ?? ""));
  const clubEvents = [...(input.clubEvents ?? [])].sort((left, right) => left.date.localeCompare(right.date));
  const recent = fixtures.slice(-8);
  const wins = fixtures.filter((fixture) => fixture.winner === team.id).length;
  const recentWins = recent.filter((fixture) => fixture.winner === team.id).length;
  const winRate = fixtures.length ? wins / fixtures.length : 0.5;
  const recentWinRate = recent.length ? recentWins / recent.length : winRate;
  const expectedPosition = ownership.expected_position_baseline ?? 5;
  const positionScore = standingPosition
    ? clamp(62 + (expectedPosition - standingPosition) * 8)
    : 55;
  const resultEvents = clubEvents.filter((event) => event.category === "results");
  const resultsApproval = rounded(positionScore * 0.42 + winRate * 100 * 0.23 + recentWinRate * 100 * 0.3
    + resultEvents.slice(-6).reduce((sum, event) => sum + event.impact, 0) * 0.35);

  const averageAbility = squadPlayers.length
    ? squadPlayers.reduce((total, player) => total + (player.reputation ?? 50) * 0.65 + playerPerformance(playerStats[player.id]) * 0.35, 0) / squadPlayers.length
    : 55;
  const highPotentialCount = squadPlayers.filter((player) => Math.max(player.potentialBatting ?? 0, player.potentialBowling ?? 0) >= 82 && player.age <= 25).length;
  const starCount = squadPlayers.filter((player) => (player.reputation ?? 0) >= 80).length;
  const squadApproval = rounded(35 + averageAbility * 0.38 + highPotentialCount * culture.youthPreference / 500 + starCount * culture.starFocus / 450);
  const captain = input.captainId ? squadPlayers.find((player) => player.id === input.captainId) : null;
  const leadershipApproval = rounded(
    captain
      ? 40 + (captain.captaincy ?? 50) * 0.32 + playerPerformance(playerStats[captain.id]) * 0.28
      : 32,
  );
  const teamMatchCount = Math.max(1, ...squadPlayers.map((player) => playerStats[player.id]?.matches ?? 0));
  const squadStatLines = squadPlayers.map((player) => playerStats[player.id]).filter(Boolean);
  const teamRuns = squadStatLines.reduce((total, stats) => total + (stats.runs ?? 0), 0);
  const teamWickets = squadStatLines.reduce((total, stats) => total + (stats.wickets ?? 0), 0);
  const bowlingRuns = squadStatLines.reduce((total, stats) => total + (stats.runsConceded ?? 0), 0);
  const bowlingOvers = squadStatLines.reduce((total, stats) => total + (stats.oversBowled ?? 0), 0);
  const teamEconomy = bowlingOvers > 0 ? bowlingRuns / bowlingOvers : 8.7;
  const fieldingDismissals = squadStatLines.reduce((total, stats) => total + (stats.catches ?? 0) + (stats.stumpings ?? 0) + (stats.runOuts ?? 0), 0);
  const battingUnitApproval = rounded(52 + (teamRuns / teamMatchCount - 160) * 0.32);
  const bowlingUnitApproval = rounded(52 + (teamWickets / teamMatchCount - 6) * 5 + (8.7 - teamEconomy) * 8);
  const fieldingUnitApproval = rounded(50 + (fieldingDismissals / teamMatchCount - 4) * 6);
  const injuryEvents = clubEvents.filter((event) => event.category === "injuries");
  const medicalUnitApproval = rounded(82 - (input.activeInjuryCount ?? 0) * 9
    + injuryEvents.slice(-8).reduce((sum, event) => sum + event.impact, 0) * 0.65);
  const developmentUnitApproval = rounded(squadApproval * 0.62 + clamp(40 + highPotentialCount * 9) * 0.38);
  const rolePerformance = (member: SupporterStaffMember) => {
    const roles = new Set([member.primaryRole, ...member.roles].map((role) => role.toLowerCase().replaceAll(" ", "_")));
    if (roles.has("head_coach")) return { score: rounded(resultsApproval * 0.58 + squadApproval * 0.22 + leadershipApproval * 0.2), label: "Overall team performance" };
    const latestReview = [...(input.departmentReviews ?? [])].sort((a, b) => b.season - a.season)[0];
    const reviewScore = (department?: { expectedRank: number; actualRank: number }) => department
      ? clamp(55 + (department.expectedRank - department.actualRank) * 7)
      : null;
    if (roles.has("batting_coach")) return { score: rounded(battingUnitApproval * 0.7 + (reviewScore(latestReview?.batting) ?? battingUnitApproval) * 0.3), label: "Batting output versus expectation" };
    if (roles.has("pace_bowling_coach")) return { score: rounded(bowlingUnitApproval * 0.7 + (reviewScore(latestReview?.bowling) ?? bowlingUnitApproval) * 0.3), label: "Bowling output versus expectation" };
    if (roles.has("spin_bowling_coach")) return { score: rounded(bowlingUnitApproval * 0.7 + (reviewScore(latestReview?.bowling) ?? bowlingUnitApproval) * 0.3), label: "Spin and bowling output versus expectation" };
    if (roles.has("fielding_coach") || roles.has("wicketkeeping_coach")) return { score: rounded(fieldingUnitApproval * 0.7 + (reviewScore(latestReview?.fielding) ?? fieldingUnitApproval) * 0.3), label: "Fielding output versus expectation" };
    if (roles.has("physio") || roles.has("fitness_coach") || roles.has("conditioning_coach")) return { score: medicalUnitApproval, label: "Squad fitness and availability" };
    if (roles.has("mentor")) return { score: rounded(leadershipApproval * 0.55 + developmentUnitApproval * 0.45), label: "Leadership and player development" };
    if (roles.has("scout") || roles.has("recruitment_analyst") || roles.has("director_of_cricket")) return { score: developmentUnitApproval, label: "Squad building and prospects" };
    return { score: rounded(resultsApproval * 0.55 + squadApproval * 0.45), label: "Visible team and squad progress" };
  };
  const staffApprovalItems = staff
    .map<SupporterApprovalItem>((member) => {
      const performance = rolePerformance(member);
      const loyaltyScore = clamp(member.loyalty * 0.65 + Math.min(8, member.tenureSeasons) * 4.5);
      const loyaltyBonus = loyaltyScore * 0.15;
      return {
        id: member.id,
        name: member.fullName,
        detail: `${member.primaryRole} · ${performance.label} ${performance.score} · Loyalty +${Math.round(loyaltyBonus)}`,
        approval: rounded(
          performance.score * 0.5
          + member.reputation * 0.18
          + resultsApproval * 0.17
          + loyaltyBonus,
        ),
        trend: rounded(50 + (performance.score - 50) * 0.34 + (resultsApproval - 50) * 0.12) - 50,
      };
    })
    .sort((left, right) => right.approval - left.approval);
  const staffApproval = staffApprovalItems.length
    ? rounded(staffApprovalItems.reduce((total, member) => total + member.approval, 0) / staffApprovalItems.length)
    : 48;
  const boardBase = ownership.financial_generosity * 2
    + ownership.scouting_investment_level * 1.2
    + ownership.stadium_upgrade_willingness
    + ownership.ceo_patience * 0.8;
  const boardEvents = clubEvents.filter((event) => event.category === "board" || event.category === "staff");
  const budgetUse = input.boardContext?.annualStaffBudget
    ? clamp((input.boardContext.committedStaffSalary ?? 0) / input.boardContext.annualStaffBudget * 100)
    : 50;
  const boardApproval = rounded(boardBase * 0.55 + resultsApproval * 0.2 + budgetUse * 0.1
    + (input.boardContext?.activeProjects ?? 0) * 3
    + boardEvents.slice(-8).reduce((sum, event) => sum + event.impact, 0) * 0.45
    - culture.boardScepticism * 0.16);
  const categories = { results: resultsApproval, squad: squadApproval, staff: staffApproval, board: boardApproval, leadership: leadershipApproval };

  const performanceMomentum = (recentWinRate - 0.5) * 24;
  const compositionRaw = { ...culture.baseComposition };
  compositionRaw.fairWeather += performanceMomentum * 0.3;
  compositionRaw.digital += performanceMomentum * 0.14;
  compositionRaw.starDriven += (starCount - 2) * culture.starFocus / 180;
  compositionRaw.hardcore += Math.max(0, fixtures.length - 14) * culture.loyalty / 5000;
  const compositionTotal = Object.values(compositionRaw).reduce((sum, value) => sum + Math.max(1, value), 0);
  const normalizedShares = Object.fromEntries(Object.entries(compositionRaw).map(([key, value]) => [
    key,
    Math.max(1, value) / compositionTotal * 100,
  ])) as Record<SupporterGroupId, number>;

  const groups = SUPPORTER_GROUPS.map<SupporterGroupView>((group) => {
    const groupEventImpact = clubEvents.slice(-12).reduce((sum, event, index, events) => (
      sum + event.impact * GROUP_CATEGORY_WEIGHTS[group.id][event.category] * (0.35 + 0.65 * ((index + 1) / events.length))
    ), 0);
    const identityModifier = group.id === "traditional" ? (culture.localIdentity - 50) * 0.08
      : group.id === "starDriven" ? (starCount - 2) * culture.starFocus * 0.025
        : group.id === "digital" ? performanceMomentum * 0.35
          : group.id === "hardcore" ? (culture.loyalty - 50) * 0.06
            : 0;
    const groupHappiness = rounded(
      52
      + (resultsApproval - 50) * group.resultSensitivity * 0.55
      + (squadApproval - 50) * (group.id === "starDriven" ? 0.35 : 0.14)
      + (boardApproval - 50) * (group.id === "traditional" ? 0.18 : 0.08)
      + identityModifier
      + groupEventImpact * 0.24,
    );
    return {
      ...group,
      share: Number(normalizedShares[group.id].toFixed(1)),
      happiness: groupHappiness,
      trend: rounded(50 + performanceMomentum * group.resultSensitivity + groupEventImpact * 0.35) - 50,
      priority: groupPriority(group.id, categories, culture),
    };
  });
  const overallHappiness = rounded(groups.reduce((total, group) => total + group.happiness * group.share / 100, 0));
  const trajectory = recent.length >= 2
    ? rounded(50 + (recent.slice(-4).filter((fixture) => fixture.winner === team.id).length / Math.min(4, recent.length) - recentWinRate) * 50) - 50
    : 0;

  const playerApprovals = squadPlayers.map<SupporterApprovalItem>((player) => {
    const performance = playerPerformance(playerStats[player.id]);
    const historySeasons = player.iplHistory?.filter((entry) => entry.teamId === team.id).length ?? 0;
    const latestDeal = [...(player.iplHistory ?? [])].filter((entry) => entry.teamId === team.id).sort((a, b) => Number(b.season) - Number(a.season))[0];
    const publicProfile = player.reputation ?? 50;
    const expectedOutput = clamp(38 + publicProfile * 0.35 + Math.min(18, (latestDeal?.price ?? player.basePrice) * 1.5));
    const expectationGap = performance - expectedOutput;
    const matchWinnerCount = fixtures.filter((fixture) => fixture.playerOfTheMatchId === player.id && fixture.winner === team.id).length;
    const iconBonus = Math.min(14, historySeasons * culture.loyalty / 130);
    const starBonus = Math.max(0, publicProfile - 76) * culture.starFocus / 300;
    const captainBonus = player.id === input.captainId ? 8 : player.id === input.viceCaptainId ? 3 : 0;
    const approval = rounded(performance * 0.5 + publicProfile * 0.22 + clamp(50 + expectationGap) * 0.12
      + iconBonus + starBonus + captainBonus + Math.min(8, matchWinnerCount * 2));
    const matches = playerStats[player.id]?.matches ?? 0;
    return {
      id: player.id,
      name: player.name,
      approval,
      trend: rounded(50 + (performance - 50) * 0.45) - 50,
      detail: player.id === input.captainId
        ? "Captain and visible leader"
        : historySeasons >= 4
          ? "Long-serving club figure"
          : matches === 0
            ? "Still waiting for a sustained opportunity"
            : performance >= 70
              ? `${matchWinnerCount ? `${matchWinnerCount} match-winning display${matchWinnerCount === 1 ? "" : "s"}; ` : ""}performances are exceeding expectations`
              : performance < 43
                ? `Current output is under scrutiny versus a ${Math.round(expectedOutput)} expectation`
                : `Opinion is mixed against a ${Math.round(expectedOutput)} role and price expectation`,
    };
  });
  const popularPlayers = [...playerApprovals].sort((left, right) => right.approval - left.approval).slice(0, 5);
  const playersUnderPressure = [...playerApprovals]
    .filter((item) => item.approval < 58)
    .sort((left, right) => left.approval - right.approval)
    .slice(0, 5);
  let runningHappiness = 55 + (culture.loyalty - 50) * 0.05;
  const trend: SupporterTrendPoint[] = fixtures.slice(-24).map((fixture) => {
    const delta = matchDelta(fixture, team.id, culture);
    runningHappiness = clamp(runningHappiness + delta);
    return {
      date: fixture.date ?? "Matchday",
      label: fixture.winner === team.id ? "Win" : fixture.winner ? "Defeat" : "No result",
      happiness: rounded(runningHappiness),
      delta: Math.round(delta),
    };
  });
  if (trend.length === 0) trend.push({ date: "Preseason", label: "Preseason", happiness: overallHappiness, delta: 0 });
  const reactions = fixtures.slice(-6).reverse().map<SupporterReaction>((fixture) => {
    const opponentId = fixture.teamA === team.id ? fixture.teamB : fixture.teamA;
    const delta = Math.round(matchDelta(fixture, team.id, culture));
    const won = fixture.winner === team.id;
    return {
      id: fixture.id,
      date: fixture.date ?? "Matchday",
      title: fixture.winner ? `${won ? "Victory" : "Defeat"} against ${opponentId}` : `No result against ${opponentId}`,
      body: won
        ? `${culture.identity} supporters responded positively to another competitive result.`
        : fixture.winner
          ? `${groupForReaction(culture)} supporters registered the sharpest drop after the result.`
          : "The abandoned result produced little lasting change in supporter opinion.",
      delta,
    };
  });

  const weakest = Object.entries(categories).sort((left, right) => left[1] - right[1]);
  const priorities = weakest.slice(0, 3).map(([category, score]) => {
    if (category === "results") return score < 45 ? "Stop the current run of results" : "Remain firmly in the playoff race";
    if (category === "squad") return culture.starFocus >= 75 ? "Build around recognisable match-winners" : culture.youthPreference >= 75 ? "Give high-potential players meaningful opportunities" : "Address the squad's weakest roles";
    if (category === "staff") return "Show visible improvement from the coaching setup";
    if (category === "board") return "Demonstrate greater ambition and long-term direction";
    return "Provide stable and convincing on-field leadership";
  });
  const bestCategory = Object.entries(categories).sort((left, right) => right[1] - left[1])[0];
  const worstCategory = weakest[0];
  const summary = `${team.shortName} supporters are ${moodFor(overallHappiness).toLowerCase()} overall. ${labelCategory(bestCategory[0])} is earning the strongest approval, while ${labelCategory(worstCategory[0])} is the principal concern.`;

  const matchEvents = fixtures.map<SupporterClubEvent>((fixture, index) => {
    const opponent = fixture.teamA === team.id ? fixture.teamB : fixture.teamA;
    const won = fixture.winner === team.id;
    const delta = Math.round(matchDelta(fixture, team.id, culture));
    return {
      id: `supporter-match-${fixture.id}`,
      date: fixture.date ?? `Match ${index + 1}`,
      season: Number((fixture.date ?? "").slice(0, 4)) || input.currentSeason || 0,
      category: "results",
      kind: fixture.stage && fixture.stage !== "league" ? "knockout" : "match",
      title: fixture.winner ? `${won ? "Beat" : "Lost to"} ${opponent}` : `No result against ${opponent}`,
      detail: `${fixture.stage && fixture.stage !== "league" ? "Knockout" : fixture.teamA === team.id ? "Home" : "Away"} result${Math.abs(delta) >= 7 ? " with a major supporter reaction" : ""}.`,
      impact: delta,
      subjectId: fixture.playerOfTheMatchId ?? undefined,
    };
  });
  const eventLedger = [...matchEvents, ...clubEvents]
    .sort((left, right) => left.date.localeCompare(right.date));
  const recentLedger = eventLedger.slice(-30);
  const weightedEventImpact = recentLedger.reduce((sum, event, index) => {
    const recency = 0.25 + 0.75 * ((index + 1) / Math.max(1, recentLedger.length));
    const loyaltyMemory = event.impact < 0 ? 0.75 + (100 - culture.loyalty) / 250 : 0.8;
    return sum + event.impact * recency * loyaltyMemory;
  }, 0);
  const categoryTrends = (Object.entries(categories) as Array<[Exclude<SupporterEventCategory, "injuries">, number]>).map<SupporterCategoryTrend>(([category, score]) => {
    const relevant = recentLedger.filter((event) => event.category === category || (category === "staff" && event.category === "injuries")).slice(-6);
    const movement = Math.round(relevant.reduce((sum, event) => sum + event.impact, 0));
    return {
      category,
      label: labelCategory(category),
      score,
      trend: movement,
      explanation: relevant.length
        ? `${relevant.length} recent recorded event${relevant.length === 1 ? "" : "s"}; strongest influence: ${[...relevant].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0].title}.`
        : "Driven by current performance and visible club conditions; no recent discrete event is recorded.",
    };
  });
  const concernCandidates: SupporterConcern[] = categoryTrends
    .filter((category) => category.score < 64 || category.trend < -3)
    .map((category) => ({
      id: `concern-${category.category}`,
      title: `${category.label} concern`,
      evidence: category.explanation,
      severity: rounded(100 - category.score + Math.max(0, -category.trend)),
      category: category.category,
    }));
  if ((input.activeInjuryCount ?? 0) > 0) concernCandidates.push({
    id: "concern-availability",
    title: "Squad availability",
    evidence: `${input.activeInjuryCount} first-team player${input.activeInjuryCount === 1 ? " is" : "s are"} currently unavailable. Medical approval also reflects recovery history.`,
    severity: rounded(38 + (input.activeInjuryCount ?? 0) * 11),
    category: "injuries",
  });
  const concerns = concernCandidates.sort((left, right) => right.severity - left.severity).slice(0, 5);
  const seasonsObserved = new Set(eventLedger.map((event) => event.season).filter(Boolean)).size;
  const fanbaseGrowth = Math.round((winRate - 0.5) * 12 + (overallHappiness - 50) * 0.12
    + starCount * culture.starFocus / 450 - Math.max(0, weightedEventImpact < 0 ? -weightedEventImpact / 20 : 0));
  const fanbaseIndex = rounded(50 + Math.min(18, seasonsObserved * culture.loyalty / 80) + fanbaseGrowth);
  const cultureEvolution = [
    `${fanbaseGrowth >= 0 ? "Growing" : "Contracting"} reach: ${fanbaseGrowth >= 0 ? "+" : ""}${fanbaseGrowth}% momentum index.`,
    recentWinRate >= 0.6 ? "Success is increasing fair-weather and digital participation." : recentWinRate <= 0.35 ? "Poor form is concentrating the audience around its loyal core." : "The group mix is broadly stable through mixed form.",
    starCount >= 3 ? "A star-heavy squad is strengthening personality-led support." : highPotentialCount >= 4 ? "A young squad is gradually attracting development-focused supporters." : "No single squad-building identity currently dominates.",
  ];

  return {
    culture,
    groups,
    overallHappiness,
    mood: moodFor(overallHappiness),
    trajectory,
    summary,
    expectation: expectationFor(culture, standingPosition),
    homeAtmosphere: rounded(35 + culture.loyalty * 0.35 + overallHappiness * 0.3),
    confidenceInDirection: rounded(resultsApproval * 0.42 + squadApproval * 0.22 + staffApproval * 0.16 + boardApproval * 0.2),
    categoryApproval: categories,
    popularPlayers,
    playersUnderPressure,
    staffApproval: staffApprovalItems,
    priorities,
    trend,
    reactions,
    eventLedger: eventLedger.slice(-18).reverse(),
    concerns,
    categoryTrends,
    fanbaseIndex,
    fanbaseGrowth,
    cultureEvolution,
    memorySummary: eventLedger.length
      ? `${eventLedger.length} observable club events across ${Math.max(1, seasonsObserved)} season${seasonsObserved === 1 ? "" : "s"}; older events decay but major moments remain influential.`
      : "No club events have yet been recorded in this save.",
  };
}

function labelCategory(category: string) {
  if (category === "results") return "Recent performance";
  if (category === "squad") return "The playing squad";
  if (category === "staff") return "The coaching staff";
  if (category === "board") return "The board and ownership";
  return "Leadership";
}

function groupForReaction(culture: TeamSupporterCulture) {
  if (culture.volatility >= 80) return "Digital and fair-weather";
  if (culture.localIdentity >= 85) return "Hardcore and local";
  if (culture.starFocus >= 80) return "Star-driven";
  return "Results-focused";
}
