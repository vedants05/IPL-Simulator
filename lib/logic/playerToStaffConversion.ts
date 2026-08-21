import type { Player } from "../types";
import type { CareerRetirementRecord } from "./careerLifecycle";
import {
  recalculateStaffFinances,
  type CareerStaffContract,
  type CareerStaffState,
  type GeneratedStaffProfile,
} from "./staffContracts";
import {
  calculateStaffPotentialAbility,
  calculateStaffRoleRatings,
  type StaffRatingAttributes,
  type StaffRatingRole,
} from "./staffRatings";
import { calculateStaffSalaryDemand } from "./staffNegotiations";
import type { StaffAffinityProfile, StaffAffinityReason } from "../data/staffAffinities";

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const staff20 = (value: number) => clamp(Math.round(value), 1, 20);

function hashUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function normalizeStaffIdentity(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function careerTotals(player: Player) {
  return {
    matches: Math.max(player.careerStats.batting.matches, player.careerStats.bowling.matches, player.iplStats.matches),
    runs: Math.max(player.careerStats.batting.runs, player.iplStats.runs),
    wickets: Math.max(player.careerStats.bowling.wickets, player.iplStats.wickets),
    seasons: new Set(player.iplHistory.map((entry) => entry.season)).size,
  };
}

/** Role-neutral shortlist score: volume is normalized so batters cannot crowd out bowlers or keepers. */
export function calculatePlayerStaffQualification(player: Player): number {
  const totals = careerTotals(player);
  const reputation = clamp(player.reputation ?? 5, 1, 10);
  const peak = Math.max(player.currentBatting, player.currentBowling);
  const captaincy = clamp(player.captaincy ?? 45, 0, 100);
  const battingMerit = clamp(totals.runs / 8000, 0, 1);
  const bowlingMerit = clamp(totals.wickets / 300, 0, 1);
  const keeperMerit = player.isWicketkeeper || player.role === "WK-Batsman"
    ? clamp(0.45 + totals.matches / 500, 0, 1) : 0;
  const specialistMerit = Math.max(battingMerit, bowlingMerit, keeperMerit);
  const versatility = player.role === "All-Rounder" ? 1 : player.isWicketkeeper ? 0.75 : 0.35;
  return Math.round(
    reputation * 4.2
    + clamp((peak - 60) / 35, 0, 1) * 16
    + specialistMerit * 16
    + clamp(totals.seasons / 14, 0, 1) * 10
    + clamp((captaincy - 40) / 50, 0, 1) * 12
    + versatility * 4,
  );
}

export function calculatePlayerCoachingInterest(player: Player, qualification: number): number {
  const captaincy = clamp(player.captaincy ?? 45, 0, 100);
  const reputation = clamp(player.reputation ?? 5, 1, 10);
  const totals = careerTotals(player);
  // Distinguished leadership profiles are interested more often, but no retiree is guaranteed to convert.
  return clamp(
    0.04
      + Math.max(0, qualification - 65) * 0.009
      + Math.max(0, captaincy - 55) * 0.0025
      + Math.max(0, reputation - 7) * 0.025
      + Math.min(0.05, totals.seasons * 0.003),
    0.05,
    0.38,
  );
}

function affinityProfile(player: Player): StaffAffinityProfile {
  const seasonsByTeam = new Map<string, number>();
  player.iplHistory.forEach((entry) => seasonsByTeam.set(entry.teamId, (seasonsByTeam.get(entry.teamId) ?? 0) + 1));
  const maximum = Math.max(1, ...Array.from(seasonsByTeam.values()));
  return {
    homeRegion: null,
    homeCountry: player.country?.trim() || (player.nationality === "Indian" ? "India" : "Unknown"),
    clubs: Array.from(seasonsByTeam.entries()).map(([teamId, seasons]) => {
      const reasons: StaffAffinityReason[] = ["played"];
      if (seasons >= 5) reasons.push("long_service");
      return { teamId, strength: clamp(Math.round(38 + seasons / maximum * 47 + Math.min(10, seasons * 2)), 0, 95), reasons };
    }).sort((left, right) => right.strength - left.strength || left.teamId.localeCompare(right.teamId)),
  };
}

function convertedAttributes(player: Player, qualification: number): StaffRatingAttributes & {
  loyalty: number; ambition: number; adaptability: number; learningRate: number;
} {
  const totals = careerTotals(player);
  const leadership = clamp(player.captaincy ?? 45, 20, 95);
  const reputation = clamp((player.reputation ?? 5) * 10, 10, 100);
  const longevity = clamp(totals.seasons / 14, 0, 1);
  const versatility = player.role === "All-Rounder" ? 1 : player.isWicketkeeper ? 0.75 : 0.35;
  const adaptability = clamp(Math.round(55 + new Set(player.iplHistory.map((entry) => entry.teamId)).size * 5 + versatility * 10), 45, 88);
  const professionalism = clamp(52 + reputation * 0.25 + longevity * 15, 50, 90);
  const communication = clamp(40 + leadership * 0.35 + professionalism * 0.2, 40, 88);
  const teachingAptitude = clamp((communication + adaptability + professionalism) / 3, 40, 88);
  const battingKnowledge = clamp(4 + (player.currentBatting - 45) * 0.24 + longevity * 2, 3, 19);
  const bowlingKnowledge = clamp(4 + (player.currentBowling - 45) * 0.24 + longevity * 2, 3, 19);
  const isPace = player.role === "Pace Bowler" || player.bowlingStyle === "Pacer";
  const isSpin = player.role === "Spin Bowler" || player.bowlingStyle === "Spinner";
  const transfer = teachingAptitude / 100;
  const specialist = (knowledge: number, relevant: boolean) => staff20(relevant ? 5 + knowledge * 0.55 + transfer * 4 : 3 + transfer * 3);
  const tactical = staff20(5 + leadership * 0.075 + longevity * 2.2 + versatility * 1.3 + adaptability * 0.025);
  const manManagement = staff20(5 + leadership * 0.07 + communication * 0.045 + reputation * 0.015);
  const motivation = staff20(6 + leadership * 0.065 + professionalism * 0.045 + qualification * 0.012);
  const technical = staff20(3 + Math.max(battingKnowledge, bowlingKnowledge) * 0.28 + teachingAptitude * 0.055 + tactical * 0.12);
  const judgingAbility = staff20(5 + tactical * 0.32 + longevity * 2.5 + adaptability * 0.025);
  const judgingPotential = staff20(4 + judgingAbility * 0.45 + adaptability * 0.035);
  const playerDevelopment = staff20(3 + technical * 0.25 + manManagement * 0.2 + motivation * 0.15 + judgingAbility * 0.1);
  const youthDevelopment = staff20(3 + playerDevelopment * 0.35 + adaptability * 0.035);
  return {
    reputation,
    batting_coaching: specialist(battingKnowledge, player.role !== "Pace Bowler" && player.role !== "Spin Bowler"),
    pace_bowling_coaching: specialist(bowlingKnowledge, isPace),
    spin_bowling_coaching: specialist(bowlingKnowledge, isSpin),
    fielding_coaching: staff20(5 + transfer * 5 + (player.isWicketkeeper ? 2 : 0)),
    wicketkeeping_coaching: staff20(player.isWicketkeeper || player.role === "WK-Batsman" ? 8 + transfer * 6 + longevity * 2 : 3 + transfer * 3),
    technical_coaching: Math.min(16, technical),
    tactical_knowledge: Math.min(18, tactical),
    player_development: Math.min(16, playerDevelopment),
    youth_development: Math.min(14, youthDevelopment),
    judging_ability: Math.min(17, judgingAbility),
    judging_potential: Math.min(16, judgingPotential),
    man_management: Math.min(18, manManagement),
    motivation: Math.min(18, motivation),
    loyalty: clamp(Math.round(58 + longevity * 22 - Math.max(0, seasonsByClubCount(player) - 3) * 3), 35, 92),
    ambition: clamp(Math.round(50 + reputation * 0.25 + leadership * 0.12), 45, 90),
    adaptability,
    learningRate: clamp(Math.round(48 + adaptability * 0.3 + teachingAptitude * 0.2), 50, 88),
  };
}

const seasonsByClubCount = (player: Player) => new Set(player.iplHistory.map((entry) => entry.teamId)).size;

function selectRoles(player: Player, ratings: Record<StaffRatingRole, number>): { primary: StaffRatingRole; secondary: StaffRatingRole[] } {
  const credible = new Set<StaffRatingRole>(["coach", "assistant_coach", "mentor"]);
  if (player.role === "Batsman" || player.role === "All-Rounder" || player.role === "WK-Batsman") credible.add("batting_coach");
  if (player.role === "Pace Bowler" || player.bowlingStyle === "Pacer") credible.add("pace_bowling_coach");
  if (player.role === "Spin Bowler" || player.bowlingStyle === "Spinner") credible.add("spin_bowling_coach");
  if (player.isWicketkeeper || player.role === "WK-Batsman") credible.add("wicketkeeping_coach");
  // Head coach is deliberately excluded at conversion: it must be earned through coaching work.
  const ranked = Array.from(credible).sort((left, right) => ratings[right] - ratings[left] || left.localeCompare(right));
  return { primary: ranked[0] ?? "coach", secondary: ranked[1] && ratings[ranked[1]] >= 70 ? [ranked[1]] : [] };
}

function createProfile(player: Player, record: CareerRetirementRecord, qualification: number): GeneratedStaffProfile {
  const attributes = convertedAttributes(player, qualification);
  const roleRatings = calculateStaffRoleRatings(attributes);
  const roles = selectRoles(player, roleRatings);
  const slug = `${slugify(player.name)}-${record.season}`;
  const dateOfBirth = `${Math.max(1900, record.season - record.age)}-01-01`;
  const currentAbility = roleRatings[roles.primary];
  const retirementAge = clamp(Math.round(66 + hashUnit(`${player.id}:staff-retirement`) * 8), 66, 74);
  const potentialAbility = calculateStaffPotentialAbility({
    currentAbility,
    dateOfBirth,
    experienceYears: 0,
    learningRate: attributes.learningRate,
    adaptability: attributes.adaptability,
    ambition: attributes.ambition,
    developmentPhase: "developing",
    retirementAge,
    profileConfidence: "medium",
    asOfDate: `${record.season}-12-31`,
  });
  const country = player.country?.trim() || (player.nationality === "Indian" ? "India" : "Unknown");
  const affinity = affinityProfile(player);
  return {
    id: `converted-staff:${player.id}`,
    slug,
    full_name: player.name,
    known_as: player.name,
    date_of_birth: dateOfBirth,
    country,
    primary_role: roles.primary,
    secondary_roles: roles.secondary,
    current_real_team_id: null,
    salary_expectation: 0,
    current_ability: currentAbility,
    potential_ability: potentialAbility,
    ...attributes,
    reputation: attributes.reputation,
    loyalty: attributes.loyalty,
    ambition: attributes.ambition,
    adaptability: attributes.adaptability,
    learning_rate: attributes.learningRate,
    experience_years: 0,
    development_phase: "developing",
    retirement_age: retirementAge,
    personality: Number(attributes.man_management) >= 15 ? "leader" : Number(attributes.technical_coaching) >= 14 ? "analytical" : "professional",
    profile_confidence: "medium",
    rating_basis: "Save-generated profile derived conservatively from playing role, career achievement, captaincy, longevity and club history. Playing greatness supplies knowledge and reputation, not automatic coaching excellence.",
    biography: null,
    is_available: true,
    is_generated: true,
    is_active: true,
    role_ratings: roleRatings,
    affinity_profile: affinity,
    source_player_id: player.id,
    converted_in_season: record.season,
  };
}

export interface PlayerToStaffConversionResult {
  state: CareerStaffState;
  converted: GeneratedStaffProfile[];
}

export function convertRetiredPlayersToStaff(input: {
  state: CareerStaffState;
  retiredPlayers: Player[];
  retirements: CareerRetirementRecord[];
  season: number;
  seed: string;
}): PlayerToStaffConversionResult {
  if (!input.state.initialized || input.retiredPlayers.length === 0) return { state: input.state, converted: [] };
  const retirementByPlayer = new Map(input.retirements.map((record) => [record.playerId, record]));
  const identities = new Set([
    ...Object.values(input.state.contracts).flatMap((contract) => [normalizeStaffIdentity(contract.fullName), normalizeStaffIdentity(contract.staffSlug)]),
    ...Object.values(input.state.generatedProfiles).map((profile) => normalizeStaffIdentity(profile.full_name)),
  ]);
  const sourcePlayerIds = new Set(Object.values(input.state.generatedProfiles).map((profile) => profile.source_player_id));
  const profiles: GeneratedStaffProfile[] = [];
  input.retiredPlayers.forEach((player) => {
    const record = retirementByPlayer.get(player.id);
    if (!record || sourcePlayerIds.has(player.id) || identities.has(normalizeStaffIdentity(player.name))) return;
    const qualification = calculatePlayerStaffQualification(player);
    if (qualification < 68) return;
    const probability = calculatePlayerCoachingInterest(player, qualification);
    if (hashUnit(`${input.seed}:${input.season}:${player.id}:coaching-interest`) >= probability) return;
    const profile = createProfile(player, record, qualification);
    profiles.push(profile);
    identities.add(normalizeStaffIdentity(profile.full_name));
    sourcePlayerIds.add(player.id);
  });
  if (profiles.length === 0) return { state: input.state, converted: [] };
  const contracts = { ...input.state.contracts };
  const generatedProfiles = { ...input.state.generatedProfiles };
  profiles.forEach((profile) => {
    const demand = calculateStaffSalaryDemand({
      salaryExpectation: 5_000_000,
      reputation: Number(profile.reputation),
      roleRating: Number(profile.current_ability),
      roleCount: 1,
      startSeason: input.season + 1,
      endSeason: null,
      offeredPrimaryRole: profile.primary_role,
    });
    profile.salary_expectation = demand;
    generatedProfiles[profile.id] = profile;
    contracts[profile.id] = {
      staffId: profile.id,
      staffSlug: profile.slug,
      fullName: profile.full_name,
      teamId: null,
      roles: [],
      primaryRole: profile.primary_role,
      startSeason: null,
      endSeason: null,
      contractType: null,
      annualSalary: demand,
      status: "free_agent",
      joinedOn: null,
      releasedOn: null,
      roleRatings: profile.role_ratings,
      reputation: Number(profile.reputation),
      currentAbility: Number(profile.current_ability),
      potentialAbility: Number(profile.potential_ability),
      country: String(profile.country),
      loyalty: Number(profile.loyalty),
      ambition: Number(profile.ambition),
      adaptability: Number(profile.adaptability),
      affinityProfile: profile.affinity_profile,
      coachingAttributes: {
        reputation: Number(profile.reputation),
        batting_coaching: Number(profile.batting_coaching),
        pace_bowling_coaching: Number(profile.pace_bowling_coaching),
        spin_bowling_coaching: Number(profile.spin_bowling_coaching),
        fielding_coaching: Number(profile.fielding_coaching),
        wicketkeeping_coaching: Number(profile.wicketkeeping_coaching),
        technical_coaching: Number(profile.technical_coaching),
        tactical_knowledge: Number(profile.tactical_knowledge),
        player_development: Number(profile.player_development),
        youth_development: Number(profile.youth_development),
        judging_ability: Number(profile.judging_ability),
        judging_potential: Number(profile.judging_potential),
        man_management: Number(profile.man_management),
        motivation: Number(profile.motivation),
      },
      dateOfBirth: profile.date_of_birth,
      retirementAge: Number(profile.retirement_age),
      experienceYears: 0,
      learningRate: Number(profile.learning_rate),
      developmentPhase: "developing",
      profileConfidence: "medium",
      lastDevelopedSeason: null,
      developmentBank: {},
      reputationDevelopmentBank: 0,
    } satisfies CareerStaffContract;
  });
  return {
    converted: profiles,
    state: {
      ...input.state,
      contracts,
      generatedProfiles,
      financesByTeam: recalculateStaffFinances(contracts, input.state.financesByTeam),
    },
  };
}
