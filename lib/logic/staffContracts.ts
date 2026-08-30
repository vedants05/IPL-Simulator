import type { StaffAffinityProfile, StaffClubAffinity } from "../data/staffAffinities";
import type { StaffSeasonReview } from "./staffPerformanceReview";
import { calculateStaffSalaryDemand } from "./staffNegotiations";
import type { StaffRatingAttributes } from "./staffRatings";

export const STAFF_SALARY_MODEL_VERSION = 3;

export type StaffContractType = "fixed_term" | "rolling";
export type StaffEmploymentStatus = "contracted" | "free_agent" | "retired";
export type StaffDepartureReason = "contract_expired" | "club_sacked" | "mutual_termination" | "staff_resigned" | "retired";
export const MAX_STAFF_CONTRACT_ROLES = 2;

export interface StaffDirectoryMember {
  id: string;
  slug?: string;
  full_name?: string;
  primary_role: string;
  salary_expectation?: number | null;
  contract_start_year?: number | null;
  contract_end_year?: number | null;
  role_ratings?: Record<string, number>;
  reputation?: number | null;
  current_ability?: number | null;
  potential_ability?: number | null;
  country?: string | null;
  loyalty?: number | null;
  ambition?: number | null;
  adaptability?: number | null;
  affinity_profile?: StaffAffinityProfile;
  [key: string]: unknown;
}

export type GeneratedStaffProfile = StaffDirectoryMember & {
  id: string;
  slug: string;
  full_name: string;
  known_as: string | null;
  date_of_birth: string | null;
  secondary_roles: string[];
  current_real_team_id: string | null;
  role_ratings: Record<string, number>;
  affinity_profile: StaffAffinityProfile;
  source_player_id: string;
  converted_in_season: number;
};

export interface StaffStartingAssignment {
  staff_id: string;
  team_id: string;
  role: string;
  start_season: number;
}

export interface CareerStaffContract {
  staffId: string;
  staffSlug: string;
  fullName: string;
  teamId: string | null;
  roles: string[];
  primaryRole: string;
  startSeason: number | null;
  endSeason: number | null;
  contractType: StaffContractType | null;
  annualSalary: number;
  status: StaffEmploymentStatus;
  joinedOn: string | null;
  releasedOn: string | null;
  roleRatings: Record<string, number>;
  reputation: number;
  currentAbility: number;
  potentialAbility: number;
  country: string;
  loyalty: number;
  ambition: number;
  adaptability: number;
  coachingPhilosophy: string | null;
  preferredTeamStrategy: string | null;
  traits: string[];
  traitPreferences: Record<string, number>;
  affinityProfile: StaffAffinityProfile;
  coachingAttributes: StaffRatingAttributes;
  dateOfBirth: string | null;
  retirementAge: number;
  experienceYears: number;
  learningRate: number;
  developmentPhase: string;
  profileConfidence: "low" | "medium" | "high";
  lastDevelopedSeason: number | null;
  developmentBank: Partial<Record<keyof StaffRatingAttributes, number>>;
  reputationDevelopmentBank: number;
}

export interface StaffEmploymentEvent {
  id: string;
  staffId: string;
  teamId: string | null;
  roles: string[];
  season: number;
  effectiveOn: string;
  kind: "appointed" | "released" | "contract_expired" | "contract_renewed" | "role_changed";
  reason?: StaffDepartureReason;
  compensation: number;
  paidByTeamId?: string;
  previousRoles?: string[];
}

export interface TeamStaffFinance {
  annualBudget: number;
  committedSalary: number;
  compensationPaid: number;
  compensationReceived: number;
}

export interface CareerStaffState {
  initialized: boolean;
  contracts: Record<string, CareerStaffContract>;
  employmentHistory: StaffEmploymentEvent[];
  financesByTeam: Record<string, TeamStaffFinance>;
  lastProcessedSeason: number | null;
  lastAIProcessedSeason: number | null;
  recruitmentSearches: StaffRecruitmentSearch[];
  newsEvents: StaffNewsEvent[];
  performanceReviews: StaffSeasonReview[];
  lastReviewedSeason: number | null;
  salaryModelVersion: number;
  /** Save-specific profiles created from retiring players. Never written to the shared staff database. */
  generatedProfiles: Record<string, GeneratedStaffProfile>;
  lastDevelopmentSeason: number | null;
  negotiationCooldowns: Record<string, string>;
}

export interface StaffRecruitmentSearch {
  id: string;
  teamId: string;
  role: string;
  openedOn: string;
  decisionOn: string;
  status: "active" | "completed" | "cancelled";
  interimStaffId: string | null;
  appointedStaffId: string | null;
  attempts: number;
}

export interface StaffNewsEvent {
  id: string;
  kind: "head_coach_vacancy" | "head_coach_appointed" | "head_coach_sacked" | "staff_poached" | "staff_retired";
  teamId: string;
  sourceTeamId?: string | null;
  staffId: string | null;
  publishedOn: string;
}

export const emptyCareerStaffState = (): CareerStaffState => ({
  initialized: false,
  contracts: {},
  employmentHistory: [],
  financesByTeam: {},
  lastProcessedSeason: null,
  lastAIProcessedSeason: null,
  recruitmentSearches: [],
  newsEvents: [],
  performanceReviews: [],
  lastReviewedSeason: null,
  salaryModelVersion: 0,
  generatedProfiles: {},
  lastDevelopmentSeason: null,
  negotiationCooldowns: {},
});

const normalizeContractRoles = (roleValues: string[], requestedPrimaryRole: string) => {
  const distinctRoles = Array.from(new Set(roleValues));
  const primaryRole = distinctRoles.includes("head_coach") ? "head_coach" : requestedPrimaryRole;
  const roles = [primaryRole, ...distinctRoles.filter((role) => role !== primaryRole)]
    .filter(Boolean)
    .slice(0, MAX_STAFF_CONTRACT_ROLES);
  return { roles, primaryRole };
};

export function normalizeCareerStaffState(state: CareerStaffState | null | undefined): CareerStaffState {
  if (!state) return emptyCareerStaffState();
  return {
    ...emptyCareerStaffState(),
    ...state,
    contracts: Object.fromEntries(Object.entries(state.contracts ?? {}).map(([staffId, contract]) => {
      const normalizedRoles = normalizeContractRoles(contract.roles ?? [], contract.primaryRole);
      return [staffId, {
      ...contract,
      roles: normalizedRoles.roles,
      primaryRole: normalizedRoles.primaryRole,
      staffSlug: contract.staffSlug ?? staffId,
      fullName: contract.fullName ?? staffId,
      roleRatings: contract.roleRatings ?? {},
      reputation: contract.reputation ?? 50,
      currentAbility: contract.currentAbility ?? 50,
      potentialAbility: contract.potentialAbility ?? contract.currentAbility ?? 50,
      country: contract.country ?? "Unknown",
      loyalty: contract.loyalty ?? 70,
      ambition: contract.ambition ?? 70,
      adaptability: contract.adaptability ?? 70,
      coachingPhilosophy: contract.coachingPhilosophy ?? null,
      preferredTeamStrategy: contract.preferredTeamStrategy ?? null,
      traits: Array.isArray(contract.traits) ? contract.traits : [],
      traitPreferences: contract.traitPreferences ?? {},
      affinityProfile: contract.affinityProfile ?? { homeRegion: null, homeCountry: contract.country ?? "Unknown", clubs: [] },
      coachingAttributes: contract.coachingAttributes ?? {
        reputation: contract.reputation ?? 50,
        batting_coaching: null, pace_bowling_coaching: null, spin_bowling_coaching: null,
        fielding_coaching: null, wicketkeeping_coaching: null, technical_coaching: null,
        tactical_knowledge: null, player_development: null, youth_development: null,
        judging_ability: null, judging_potential: null, man_management: null, motivation: null,
      },
      dateOfBirth: contract.dateOfBirth ?? null,
      retirementAge: contract.retirementAge ?? 68,
      experienceYears: contract.experienceYears ?? 10,
      learningRate: contract.learningRate ?? 70,
      developmentPhase: contract.developmentPhase ?? "peak",
      profileConfidence: contract.profileConfidence ?? "medium",
      lastDevelopedSeason: contract.lastDevelopedSeason ?? null,
      developmentBank: contract.developmentBank ?? {},
      reputationDevelopmentBank: contract.reputationDevelopmentBank ?? 0,
    }];
    })),
    employmentHistory: state.employmentHistory ?? [],
    financesByTeam: state.financesByTeam ?? {},
    recruitmentSearches: state.recruitmentSearches ?? [],
    newsEvents: state.newsEvents ?? [],
    performanceReviews: state.performanceReviews ?? [],
    lastReviewedSeason: state.lastReviewedSeason ?? null,
    salaryModelVersion: state.salaryModelVersion ?? 0,
    generatedProfiles: state.generatedProfiles ?? {},
    lastDevelopmentSeason: state.lastDevelopmentSeason ?? null,
    negotiationCooldowns: state.negotiationCooldowns ?? {},
  };
}

const unique = <T extends string>(values: T[]) => Array.from(new Set(values));

const moveAffinityToCurrentClub = (profile: StaffAffinityProfile, teamId: string): StaffAffinityProfile => {
  const prior: StaffClubAffinity[] = profile.clubs.map((club): StaffClubAffinity => ({
    ...club,
    reasons: club.reasons.filter((reason) => reason !== "current_club"),
  }));
  const index = prior.findIndex((club) => club.teamId === teamId);
  if (index >= 0) prior[index] = {
    ...prior[index],
    strength: Math.max(prior[index].strength, 45),
    reasons: unique([...prior[index].reasons, "current_club"]),
  };
  else prior.push({ teamId, strength: 45, reasons: ["current_club"] });
  return { ...profile, clubs: prior.sort((left, right) => right.strength - left.strength || left.teamId.localeCompare(right.teamId)) };
};

export function recalculateStaffFinances(
  contracts: Record<string, CareerStaffContract>,
  previous: Record<string, TeamStaffFinance> = {},
  refreshAnnualBudgets = false,
): Record<string, TeamStaffFinance> {
  const committed = new Map<string, number>();
  Object.values(contracts).forEach((contract) => {
    if (contract.status !== "contracted" || !contract.teamId) return;
    committed.set(contract.teamId, (committed.get(contract.teamId) ?? 0) + contract.annualSalary);
  });
  const teamIds = new Set([...Object.keys(previous), ...Array.from(committed.keys())]);
  return Object.fromEntries(Array.from(teamIds).map((teamId) => {
    const committedSalary = committed.get(teamId) ?? 0;
    const prior = previous[teamId];
    return [teamId, {
      annualBudget: !refreshAnnualBudgets && prior?.annualBudget
        ? prior.annualBudget
        : getTeamStaffSalaryBudgetCap(teamId, Object.values(contracts)),
      committedSalary,
      compensationPaid: prior?.compensationPaid ?? 0,
      compensationReceived: prior?.compensationReceived ?? 0,
    }];
  }));
}

export function initializeCareerStaffState(
  members: StaffDirectoryMember[],
  assignments: StaffStartingAssignment[],
  activeSeason: number,
): CareerStaffState {
  const assignmentsByStaff = new Map<string, StaffStartingAssignment[]>();
  assignments.forEach((assignment) => assignmentsByStaff.set(
    assignment.staff_id,
    [...(assignmentsByStaff.get(assignment.staff_id) ?? []), assignment],
  ));
  const contracts = Object.fromEntries(members.map((member) => {
    const staffAssignments = assignmentsByStaff.get(member.id) ?? [];
    const teamIds = unique(staffAssignments.map((assignment) => assignment.team_id));
    if (teamIds.length > 1) throw new Error(`${member.id} has starting assignments at multiple clubs.`);
    const teamId = teamIds[0] ?? null;
    const assignedRoles = unique(staffAssignments.map((assignment) => assignment.role)).slice(0, MAX_STAFF_CONTRACT_ROLES);
    const normalizedRoles = normalizeContractRoles(assignedRoles, assignedRoles[0] ?? member.primary_role);
    const roles = normalizedRoles.roles;
    const primaryRole = normalizedRoles.primaryRole;
    const contracted = teamId !== null;
    const endSeason = contracted ? (member.contract_end_year ?? null) : null;
    return [member.id, {
      staffId: member.id,
      staffSlug: member.slug ?? member.id,
      fullName: member.full_name ?? member.id,
      teamId,
      roles: contracted ? (roles.length ? roles : [member.primary_role]) : [],
      primaryRole,
      startSeason: contracted
        ? (member.contract_start_year ?? Math.min(...staffAssignments.map((assignment) => assignment.start_season), activeSeason))
        : null,
      endSeason,
      contractType: contracted ? (endSeason == null ? "rolling" : "fixed_term") : null,
      annualSalary: contracted ? calculateStaffSalaryDemand({
        salaryExpectation: Math.max(0, Math.round(member.salary_expectation ?? 0)),
        reputation: member.reputation ?? 50,
        roleRating: member.role_ratings?.[primaryRole] ?? member.current_ability ?? 50,
        roleCount: Math.max(1, roles.length),
        startSeason: activeSeason,
        endSeason,
        currentPrimaryRole: primaryRole,
        offeredPrimaryRole: primaryRole,
      }) : Math.max(0, Math.round(member.salary_expectation ?? 0)),
      status: contracted ? "contracted" : "free_agent",
      joinedOn: contracted ? `season:${activeSeason}:career-start` : null,
      releasedOn: null,
      roleRatings: { ...(member.role_ratings ?? {}) },
      reputation: Math.max(0, Math.min(100, member.reputation ?? 50)),
      currentAbility: Math.max(50, Math.min(94, member.current_ability ?? 50)),
      potentialAbility: Math.max(50, Math.min(95, member.potential_ability ?? member.current_ability ?? 50)),
      country: member.country?.trim() || "Unknown",
      loyalty: Math.max(0, Math.min(100, member.loyalty ?? 70)),
      ambition: Math.max(0, Math.min(100, member.ambition ?? 70)),
      adaptability: Math.max(0, Math.min(100, member.adaptability ?? 70)),
      coachingPhilosophy: typeof member.coaching_philosophy === "string" ? member.coaching_philosophy : null,
      preferredTeamStrategy: typeof member.preferred_team_strategy === "string" ? member.preferred_team_strategy : null,
      traits: Array.isArray(member.traits) ? member.traits.filter((trait): trait is string => typeof trait === "string") : [],
      traitPreferences: member.trait_preferences && typeof member.trait_preferences === "object"
        ? Object.fromEntries(Object.entries(member.trait_preferences).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
        : {},
      affinityProfile: member.affinity_profile ?? { homeRegion: null, homeCountry: member.country?.trim() || "Unknown", clubs: [] },
      coachingAttributes: {
        reputation: member.reputation ?? 50,
        batting_coaching: Number(member.batting_coaching ?? 1),
        pace_bowling_coaching: Number(member.pace_bowling_coaching ?? 1),
        spin_bowling_coaching: Number(member.spin_bowling_coaching ?? 1),
        fielding_coaching: Number(member.fielding_coaching ?? 1),
        wicketkeeping_coaching: Number(member.wicketkeeping_coaching ?? 1),
        technical_coaching: Number(member.technical_coaching ?? 1),
        tactical_knowledge: Number(member.tactical_knowledge ?? 1),
        player_development: Number(member.player_development ?? 1),
        youth_development: Number(member.youth_development ?? 1),
        judging_ability: Number(member.judging_ability ?? 1),
        judging_potential: Number(member.judging_potential ?? 1),
        man_management: Number(member.man_management ?? 1),
        motivation: Number(member.motivation ?? 1),
      },
      dateOfBirth: typeof member.date_of_birth === "string" ? member.date_of_birth : null,
      retirementAge: Number(member.retirement_age ?? 68),
      experienceYears: Number(member.experience_years ?? 10),
      learningRate: Number(member.learning_rate ?? 70),
      developmentPhase: String(member.development_phase ?? "peak"),
      profileConfidence: member.profile_confidence === "low" || member.profile_confidence === "high" ? member.profile_confidence : "medium",
      lastDevelopedSeason: null,
      developmentBank: {},
      reputationDevelopmentBank: 0,
    } satisfies CareerStaffContract];
  }));
  return {
    initialized: true,
    contracts,
    employmentHistory: [],
    financesByTeam: recalculateStaffFinances(contracts),
    lastProcessedSeason: null,
    lastAIProcessedSeason: null,
    recruitmentSearches: [],
    newsEvents: [],
    performanceReviews: [],
    lastReviewedSeason: null,
    salaryModelVersion: STAFF_SALARY_MODEL_VERSION,
    generatedProfiles: {},
    lastDevelopmentSeason: null,
    negotiationCooldowns: {},
  };
}

export function synchronizeCareerStaffProfiles(
  state: CareerStaffState,
  members: StaffDirectoryMember[],
  assignments: StaffStartingAssignment[] = [],
  activeSeason = 2026,
): CareerStaffState {
  if (!state.initialized) return state;
  let changed = false;
  const contracts = { ...state.contracts };
  members.forEach((member) => {
    const contract = contracts[member.id];
    if (!contract) return;
    const hasCareerDevelopment = contract.lastDevelopedSeason !== null;
    const roleRatings = { ...(hasCareerDevelopment ? contract.roleRatings : member.role_ratings ?? contract.roleRatings ?? {}) };
    const fullName = member.full_name ?? contract.fullName ?? member.id;
    const staffSlug = member.slug ?? contract.staffSlug ?? member.id;
    const reputation = Math.max(0, Math.min(100, hasCareerDevelopment ? contract.reputation : member.reputation ?? contract.reputation ?? 50));
    const currentAbility = Math.max(50, Math.min(94, hasCareerDevelopment ? contract.currentAbility : member.current_ability ?? contract.currentAbility ?? 50));
    const potentialAbility = Math.max(50, Math.min(95, hasCareerDevelopment ? contract.potentialAbility : member.potential_ability ?? contract.potentialAbility ?? currentAbility));
    const country = member.country?.trim() || contract.country || "Unknown";
    const loyalty = Math.max(0, Math.min(100, member.loyalty ?? contract.loyalty ?? 70));
    const ambition = Math.max(0, Math.min(100, member.ambition ?? contract.ambition ?? 70));
    const adaptability = Math.max(0, Math.min(100, member.adaptability ?? contract.adaptability ?? 70));
    const coachingPhilosophy = typeof member.coaching_philosophy === "string" ? member.coaching_philosophy : contract.coachingPhilosophy ?? null;
    const preferredTeamStrategy = typeof member.preferred_team_strategy === "string" ? member.preferred_team_strategy : contract.preferredTeamStrategy ?? null;
    const traits = Array.isArray(member.traits)
      ? member.traits.filter((trait): trait is string => typeof trait === "string")
      : contract.traits ?? [];
    const traitPreferences = member.trait_preferences && typeof member.trait_preferences === "object"
      ? Object.fromEntries(Object.entries(member.trait_preferences).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
      : contract.traitPreferences ?? {};
    const affinityProfile = contract.affinityProfile?.clubs?.length
      ? contract.affinityProfile
      : member.affinity_profile ?? contract.affinityProfile ?? { homeRegion: null, homeCountry: country, clubs: [] };
    const coachingAttributes = hasCareerDevelopment ? contract.coachingAttributes : {
      reputation,
      batting_coaching: Number(member.batting_coaching ?? contract.coachingAttributes.batting_coaching ?? 1),
      pace_bowling_coaching: Number(member.pace_bowling_coaching ?? contract.coachingAttributes.pace_bowling_coaching ?? 1),
      spin_bowling_coaching: Number(member.spin_bowling_coaching ?? contract.coachingAttributes.spin_bowling_coaching ?? 1),
      fielding_coaching: Number(member.fielding_coaching ?? contract.coachingAttributes.fielding_coaching ?? 1),
      wicketkeeping_coaching: Number(member.wicketkeeping_coaching ?? contract.coachingAttributes.wicketkeeping_coaching ?? 1),
      technical_coaching: Number(member.technical_coaching ?? contract.coachingAttributes.technical_coaching ?? 1),
      tactical_knowledge: Number(member.tactical_knowledge ?? contract.coachingAttributes.tactical_knowledge ?? 1),
      player_development: Number(member.player_development ?? contract.coachingAttributes.player_development ?? 1),
      youth_development: Number(member.youth_development ?? contract.coachingAttributes.youth_development ?? 1),
      judging_ability: Number(member.judging_ability ?? contract.coachingAttributes.judging_ability ?? 1),
      judging_potential: Number(member.judging_potential ?? contract.coachingAttributes.judging_potential ?? 1),
      man_management: Number(member.man_management ?? contract.coachingAttributes.man_management ?? 1),
      motivation: Number(member.motivation ?? contract.coachingAttributes.motivation ?? 1),
    };
    if (JSON.stringify(roleRatings) === JSON.stringify(contract.roleRatings ?? {})
      && fullName === contract.fullName
      && staffSlug === contract.staffSlug
      && reputation === contract.reputation
      && currentAbility === contract.currentAbility
      && potentialAbility === contract.potentialAbility
      && country === contract.country && loyalty === contract.loyalty && ambition === contract.ambition
      && adaptability === contract.adaptability
      && coachingPhilosophy === contract.coachingPhilosophy
      && preferredTeamStrategy === contract.preferredTeamStrategy
      && JSON.stringify(traits) === JSON.stringify(contract.traits ?? [])
      && JSON.stringify(traitPreferences) === JSON.stringify(contract.traitPreferences ?? {})
      && JSON.stringify(coachingAttributes) === JSON.stringify(contract.coachingAttributes)
      && JSON.stringify(affinityProfile) === JSON.stringify(contract.affinityProfile)) return;
    contracts[member.id] = {
      ...contract, staffSlug, fullName, roleRatings, reputation, currentAbility, potentialAbility, coachingAttributes,
      country, loyalty, ambition, adaptability, coachingPhilosophy, preferredTeamStrategy, traits, traitPreferences, affinityProfile,
    };
    changed = true;
  });
  // Existing saves predate some staff additions. Seed any new directory member
  // into the live career without rebuilding or overwriting existing contracts.
  const seeded = initializeCareerStaffState(members, assignments, activeSeason);
  const newlySeededIds = new Set<string>();
  Object.entries(seeded.contracts).forEach(([staffId, contract]) => {
    if (contracts[staffId]) return;
    contracts[staffId] = contract;
    newlySeededIds.add(staffId);
    changed = true;
  });
  let salaryModelVersion = state.salaryModelVersion ?? 0;
  if (salaryModelVersion < STAFF_SALARY_MODEL_VERSION) {
    Object.entries(contracts).forEach(([staffId, contract]) => {
      if (newlySeededIds.has(staffId) || contract.status !== "contracted" || contract.roles.length === 0) return;
      contracts[staffId] = {
        ...contract,
        annualSalary: calculateStaffSalaryDemand({
          salaryExpectation: contract.annualSalary,
          reputation: contract.reputation,
          roleRating: contract.roleRatings[contract.primaryRole] ?? contract.currentAbility,
          roleCount: contract.roles.length,
          startSeason: activeSeason,
          endSeason: contract.endSeason,
          currentPrimaryRole: contract.primaryRole,
          offeredPrimaryRole: contract.primaryRole,
        }),
      };
    });
    salaryModelVersion = STAFF_SALARY_MODEL_VERSION;
    changed = true;
  }
  return changed ? {
    ...state,
    contracts,
    salaryModelVersion,
    financesByTeam: recalculateStaffFinances(contracts, state.financesByTeam, (state.salaryModelVersion ?? 0) < STAFF_SALARY_MODEL_VERSION),
  } : state;
}

export function releaseCareerStaff(
  state: CareerStaffState,
  staffId: string,
  reason: StaffDepartureReason,
  season: number,
  effectiveOn: string,
): CareerStaffState {
  const contract = state.contracts[staffId];
  if (!contract || contract.status !== "contracted" || !contract.teamId) return state;
  const compensation = reason === "club_sacked" ? contract.annualSalary : 0;
  const previousTeamId = contract.teamId;
  const releasedContract: CareerStaffContract = {
    ...contract,
    teamId: null,
    roles: [],
    startSeason: null,
    endSeason: null,
    contractType: null,
    status: reason === "retired" ? "retired" : "free_agent",
    releasedOn: effectiveOn,
  };
  const nextContracts: Record<string, CareerStaffContract> = {
    ...state.contracts,
    [staffId]: releasedContract,
  };
  const financesByTeam = recalculateStaffFinances(nextContracts, state.financesByTeam);
  financesByTeam[previousTeamId] = {
    ...financesByTeam[previousTeamId],
    compensationPaid: (financesByTeam[previousTeamId]?.compensationPaid ?? 0) + compensation,
  };
  return {
    ...state,
    contracts: nextContracts,
    financesByTeam,
    employmentHistory: [...state.employmentHistory, {
      id: `${staffId}:${season}:${reason}:${state.employmentHistory.length}`,
      staffId,
      teamId: previousTeamId,
      roles: contract.roles,
      season,
      effectiveOn,
      kind: reason === "contract_expired" ? "contract_expired" : "released",
      reason,
      compensation,
    }],
  };
}

export function appointCareerStaff(
  state: CareerStaffState,
  input: {
    staffId: string;
    teamId: string;
    roles: string[];
    primaryRole: string;
    startSeason: number;
    endSeason: number | null;
    annualSalary: number;
    effectiveOn: string;
  },
): CareerStaffState {
  const contract = state.contracts[input.staffId];
  if (!contract || contract.status !== "free_agent") return state;
  const requestedRoles = unique([input.primaryRole, ...(input.roles.length ? input.roles : [input.primaryRole])]);
  if (requestedRoles.length > MAX_STAFF_CONTRACT_ROLES || !requestedRoles.includes(input.primaryRole)) return state;
  const { roles, primaryRole } = normalizeContractRoles(requestedRoles, input.primaryRole);
  if (roles.includes("head_coach") && Object.values(state.contracts).some((candidate) => (
    candidate.staffId !== input.staffId
    && candidate.status === "contracted"
    && candidate.teamId === input.teamId
    && candidate.roles.includes("head_coach")
  ))) return state;
  const teamFinance = state.financesByTeam[input.teamId];
  const annualBudget = teamFinance?.annualBudget ?? 100_000_000;
  const committedSalary = teamFinance?.committedSalary ?? 0;
  if (committedSalary + Math.max(0, input.annualSalary) > annualBudget) return state;
  const appointed: CareerStaffContract = {
    ...contract,
    teamId: input.teamId,
    roles,
    primaryRole,
    startSeason: input.startSeason,
    endSeason: input.endSeason,
    contractType: input.endSeason == null ? "rolling" : "fixed_term",
    annualSalary: Math.max(0, Math.round(input.annualSalary)),
    status: "contracted",
    joinedOn: input.effectiveOn,
    releasedOn: null,
    affinityProfile: moveAffinityToCurrentClub(contract.affinityProfile, input.teamId),
  };
  const contracts = { ...state.contracts, [input.staffId]: appointed };
  return {
    ...state,
    contracts,
    financesByTeam: recalculateStaffFinances(contracts, state.financesByTeam),
    employmentHistory: [...state.employmentHistory, {
      id: `${input.staffId}:${input.startSeason}:appointed:${state.employmentHistory.length}`,
      staffId: input.staffId,
      teamId: input.teamId,
      roles,
      season: input.startSeason,
      effectiveOn: input.effectiveOn,
      kind: "appointed",
      compensation: 0,
    }],
  };
}

export function renewCareerStaffContract(
  state: CareerStaffState,
  input: {
    staffId: string;
    endSeason: number | null;
    annualSalary: number;
    season: number;
    effectiveOn: string;
    roles?: string[];
    primaryRole?: string;
  },
): CareerStaffState {
  const contract = state.contracts[input.staffId];
  if (!contract || contract.status !== "contracted" || !contract.teamId) return state;
  if (input.endSeason !== null && input.endSeason < input.season) return state;
  const teamFinance = state.financesByTeam[contract.teamId];
  const annualBudget = teamFinance?.annualBudget ?? 100_000_000;
  const nextCommittedSalary = (teamFinance?.committedSalary ?? contract.annualSalary)
    - contract.annualSalary + Math.max(0, input.annualSalary);
  if (nextCommittedSalary > annualBudget) return state;
  const requestedPrimaryRole = input.primaryRole ?? contract.primaryRole;
  const requestedRoles = unique([requestedPrimaryRole, ...(input.roles ?? contract.roles)]);
  if (requestedRoles.length === 0 || requestedRoles.length > MAX_STAFF_CONTRACT_ROLES || !requestedRoles.includes(requestedPrimaryRole)) return state;
  const { roles, primaryRole } = normalizeContractRoles(requestedRoles, requestedPrimaryRole);
  if (roles.includes("head_coach") && Object.values(state.contracts).some((candidate) => (
    candidate.staffId !== input.staffId && candidate.status === "contracted"
    && candidate.teamId === contract.teamId && candidate.roles.includes("head_coach")
  ))) return state;
  const renewed: CareerStaffContract = {
    ...contract,
    roles,
    primaryRole,
    endSeason: input.endSeason,
    contractType: input.endSeason == null ? "rolling" : "fixed_term",
    annualSalary: Math.max(0, Math.round(input.annualSalary)),
  };
  const contracts = { ...state.contracts, [input.staffId]: renewed };
  const rolesChanged = primaryRole !== contract.primaryRole
    || roles.length !== contract.roles.length
    || roles.some((role) => !contract.roles.includes(role));
  const renewalEvent: StaffEmploymentEvent = {
    id: `${input.staffId}:${input.season}:renewed:${state.employmentHistory.length}`,
    staffId: input.staffId,
    teamId: contract.teamId,
    roles,
    season: input.season,
    effectiveOn: input.effectiveOn,
    kind: "contract_renewed",
    compensation: 0,
  };
  return {
    ...state,
    contracts,
    financesByTeam: recalculateStaffFinances(contracts, state.financesByTeam),
    employmentHistory: [
      ...state.employmentHistory,
      ...(rolesChanged ? [{
        ...renewalEvent,
        id: `${input.staffId}:${input.season}:role-changed:${state.employmentHistory.length}`,
        kind: "role_changed" as const,
        previousRoles: contract.roles,
      }] : [renewalEvent]),
    ],
  };
}

export function poachCareerStaff(
  state: CareerStaffState,
  input: {
    staffId: string;
    teamId: string;
    roles: string[];
    primaryRole: string;
    startSeason: number;
    endSeason: number | null;
    annualSalary: number;
    effectiveOn: string;
  },
): CareerStaffState {
  const existing = state.contracts[input.staffId];
  if (!existing || existing.status !== "contracted" || !existing.teamId || existing.teamId === input.teamId) return state;
  const remainingSeasons = existing.endSeason == null
    ? 1
    : Math.max(1, existing.endSeason - input.startSeason + 1);
  const compensation = existing.annualSalary * remainingSeasons;
  const released = releaseCareerStaff(state, input.staffId, "staff_resigned", input.startSeason, input.effectiveOn);
  const appointed = appointCareerStaff(released, input);
  if (appointed === released) return state;
  const teamFinance = appointed.financesByTeam[input.teamId];
  const sourceFinance = appointed.financesByTeam[existing.teamId];
  const financesByTeam = {
    ...appointed.financesByTeam,
    [input.teamId]: {
      ...teamFinance,
      compensationPaid: (teamFinance?.compensationPaid ?? 0) + compensation,
    },
    [existing.teamId]: {
      ...sourceFinance,
      compensationReceived: (sourceFinance?.compensationReceived ?? 0) + compensation,
    },
  };
  const employmentHistory = [...appointed.employmentHistory];
  const appointment = employmentHistory[employmentHistory.length - 1];
  employmentHistory[employmentHistory.length - 1] = {
    ...appointment,
    compensation,
    paidByTeamId: input.teamId,
  };
  return { ...appointed, financesByTeam, employmentHistory };
}

export const getExpiringStaffContracts = (state: CareerStaffState, season: number) => (
  Object.values(state.contracts).filter((contract) => (
    contract.status === "contracted"
    && contract.contractType === "fixed_term"
    && contract.endSeason === season
  ))
);

export function processStaffContractExpiries(
  state: CareerStaffState,
  completedSeason: number,
  effectiveOn = `${completedSeason}-06-02`,
): CareerStaffState {
  if (!state.initialized || state.lastProcessedSeason === completedSeason) return state;
  let next = state;
  Object.values(state.contracts).forEach((contract) => {
    if (contract.status === "contracted" && contract.contractType === "fixed_term"
      && contract.endSeason !== null && contract.endSeason <= completedSeason) {
      next = releaseCareerStaff(next, contract.staffId, "contract_expired", completedSeason, effectiveOn);
    }
  });
  return { ...next, lastProcessedSeason: completedSeason };
}

export function validateCareerStaffState(state: CareerStaffState): string[] {
  const errors: string[] = [];
  const headCoachByTeam = new Map<string, string>();
  Object.values(state.contracts).forEach((contract) => {
    if (contract.status === "contracted" && !contract.teamId) errors.push(`${contract.staffId}: contracted without a club`);
    if (contract.status === "free_agent" && contract.teamId) errors.push(`${contract.staffId}: free agent still has a club`);
    if (contract.contractType === "fixed_term" && contract.endSeason == null) errors.push(`${contract.staffId}: fixed contract has no expiry`);
    if (contract.roles.length > MAX_STAFF_CONTRACT_ROLES) errors.push(`${contract.staffId}: more than ${MAX_STAFF_CONTRACT_ROLES} contracted roles`);
    if (contract.roles.includes("head_coach") && contract.primaryRole !== "head_coach") errors.push(`${contract.staffId}: head coach role is not primary`);
    if (contract.status === "contracted" && contract.teamId && contract.roles.includes("head_coach")) {
      const existing = headCoachByTeam.get(contract.teamId);
      if (existing && existing !== contract.staffId) errors.push(`${contract.teamId}: multiple active head coaches`);
      headCoachByTeam.set(contract.teamId, contract.staffId);
    }
  });
  return errors;
}

import { getClubOwnership } from "../data/clubOwnership";

/** Builds the board allowance around actual staff wage demands. */
export function getTeamStaffSalaryBudgetCap(
  teamId: string,
  contracts: CareerStaffContract[] = [],
): number {
  const ownership = getClubOwnership(teamId);
  const activeSalaries = contracts
    .filter((contract) => contract.status === "contracted" && contract.teamId === teamId)
    .map((contract) => Math.max(0, contract.annualSalary));
  const committedDemand = activeSalaries.reduce((sum, salary) => sum + salary, 0);
  const averageDemand = committedDemand / Math.max(1, activeSalaries.length);
  const recruitmentReserve = averageDemand * (
    1.1
    + ownership.staff_budget_flexibility * 0.035
    + ownership.financial_generosity * 0.012
  );
  const emptyStaffFloor = 80_000_000
    + Math.pow(ownership.financial_generosity, 1.35) * 1_650_000
    + ownership.staff_budget_flexibility * 425_000;
  return Math.round(Math.max(committedDemand + recruitmentReserve, emptyStaffFloor) / 100_000) * 100_000;
}

export function getOwnerOfferedContractYears(teamId: string): number {
  const ownership = getClubOwnership(teamId);
  if (ownership.patience_modifier < 0) return 2;
  if (ownership.patience_modifier < 5) return 3;
  return 4;
}

export function checkEmergencyBudgetExtensionApproval(teamId: string): { approved: boolean; chance: number } {
  const ownership = getClubOwnership(teamId);
  const chance = ownership.staff_budget_flexibility * 0.05;
  return {
    approved: Math.random() < chance,
    chance: Math.round(chance * 100),
  };
}
