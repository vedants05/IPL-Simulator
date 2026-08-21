import type { StaffRatingAttributes, StaffRatingRole } from "./staffRatings";
import { calculateStaffPotentialAbility, calculateStaffRoleRatings, isStaffRatingRole } from "./staffRatings";
import { recalculateStaffFinances, releaseCareerStaff, type CareerStaffContract, type CareerStaffState } from "./staffContracts";
import type { StaffSeasonReview } from "./staffPerformanceReview";

const ATTRIBUTE_KEYS = [
  "batting_coaching", "pace_bowling_coaching", "spin_bowling_coaching", "fielding_coaching",
  "wicketkeeping_coaching", "technical_coaching", "tactical_knowledge", "player_development",
  "youth_development", "judging_ability", "judging_potential", "man_management", "motivation",
] as const satisfies readonly (keyof StaffRatingAttributes)[];

const ROLE_ATTRIBUTES: Record<StaffRatingRole, readonly (keyof StaffRatingAttributes)[]> = {
  head_coach: ["tactical_knowledge", "technical_coaching", "player_development", "man_management", "motivation", "judging_ability"],
  assistant_coach: ["tactical_knowledge", "technical_coaching", "player_development", "youth_development", "man_management", "motivation"],
  mentor: ["tactical_knowledge", "player_development", "man_management", "motivation"],
  batting_coach: ["batting_coaching", "technical_coaching", "player_development", "judging_ability"],
  pace_bowling_coach: ["pace_bowling_coaching", "technical_coaching", "player_development", "judging_ability"],
  spin_bowling_coach: ["spin_bowling_coaching", "technical_coaching", "player_development", "judging_ability"],
  fielding_coach: ["fielding_coaching", "technical_coaching", "player_development", "motivation"],
  wicketkeeping_coach: ["wicketkeeping_coaching", "technical_coaching", "player_development", "judging_ability"],
  coach: ["technical_coaching", "player_development", "youth_development", "judging_ability", "judging_potential", "man_management"],
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const hashUnit = (value: string) => {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return (output >>> 0) / 4294967296;
};

const ageInSeason = (dateOfBirth: string | null, season: number): number | null => {
  if (!dateOfBirth) return null;
  const year = Number(dateOfBirth.slice(0, 4));
  return Number.isFinite(year) ? season - year : null;
};

function phaseFor(contract: CareerStaffContract, age: number | null): string {
  if (contract.experienceYears <= 3 && (age == null || age < 52)) return "developing";
  if (contract.experienceYears <= 8 && (age == null || age < 58)) return "emerging";
  if (age != null && age >= contract.retirementAge - 7) return "veteran";
  return "peak";
}

function reviewFor(contract: CareerStaffContract, reviews: StaffSeasonReview[], season: number): StaffSeasonReview | null {
  return reviews.find((review) => review.season === season && (
    review.teamId === contract.teamId
    || review.headCoachStaffId === contract.staffId
    || review.assistantDismissals.includes(contract.staffId)
    || review.specialistDismissals.includes(contract.staffId)
    || review.specialistSurvivors.includes(contract.staffId)
  )) ?? null;
}

function rolePressure(role: string, review: StaffSeasonReview | null): number {
  if (!review) return 50;
  if (role === "batting_coach" || role === "wicketkeeping_coach") return review.departments.batting.pressure;
  if (role === "pace_bowling_coach" || role === "spin_bowling_coach") return review.departments.bowling.pressure;
  if (role === "fielding_coach") return review.departments.fielding.pressure;
  return review.rawPressure;
}

function attributeExposure(contract: CareerStaffContract, key: keyof StaffRatingAttributes): number {
  const primary = isStaffRatingRole(contract.primaryRole) ? contract.primaryRole : "coach";
  let exposure = ROLE_ATTRIBUTES[primary].includes(key) ? 1 : 0.08;
  contract.roles.filter((role) => role !== contract.primaryRole && isStaffRatingRole(role)).forEach((role) => {
    if (ROLE_ATTRIBUTES[role as StaffRatingRole].includes(key)) exposure = Math.max(exposure, 0.55);
  });
  return exposure;
}

function retirementProbability(contract: CareerStaffContract, age: number | null, review: StaffSeasonReview | null): number {
  if (age == null || age < contract.retirementAge - 3) return 0;
  const offset = age - contract.retirementAge;
  let chance = offset <= -3 ? 0.01 : offset === -2 ? 0.02 : offset === -1 ? 0.04 : offset === 0 ? 0.08
    : offset === 1 ? 0.13 : offset === 2 ? 0.2 : offset === 3 ? 0.28 : offset === 4 ? 0.38
      : offset <= 6 ? 0.5 : offset <= 8 ? 0.65 : 0.82;
  if (contract.status === "free_agent") chance *= 1.45;
  if (contract.reputation >= 85) chance *= 0.72;
  else if (contract.reputation >= 70) chance *= 0.86;
  if (review && review.finalPosition <= 2) chance *= 0.68;
  if (review && review.rawPressure >= 80) chance *= 1.18;
  return clamp(chance, 0, 0.92);
}

function developContract(contract: CareerStaffContract, review: StaffSeasonReview | null, season: number, seed: string): CareerStaffContract {
  const age = ageInSeason(contract.dateOfBirth, season);
  const phase = phaseFor(contract, age);
  const performance = clamp((50 - rolePressure(contract.primaryRole, review)) / 50, -1, 1);
  const employedFactor = contract.status === "contracted" ? 1 : 0.35;
  const learningFactor = clamp(0.65 + (contract.learningRate - 50) / 80, 0.55, 1.25);
  const potentialHeadroom = clamp((contract.potentialAbility - contract.currentAbility) / 12, 0.18, 1);
  const phaseGrowth = phase === "developing" ? 0.42 : phase === "emerging" ? 0.3 : phase === "peak" ? 0.16 : 0.07;
  const veteranYears = age == null ? 0 : Math.max(0, age - (contract.retirementAge - 5));
  const attributes: StaffRatingAttributes = { ...contract.coachingAttributes, reputation: contract.reputation };
  const bank = { ...contract.developmentBank };

  ATTRIBUTE_KEYS.forEach((key) => {
    const current = clamp(Number(attributes[key] ?? 1), 1, 20);
    const difficulty = clamp((21 - current) / 12, 0.18, 1);
    const exposure = attributeExposure(contract, key);
    const variance = 0.88 + hashUnit(`${seed}:${season}:${contract.staffId}:${key}:development`) * 0.24;
    const performanceFactor = clamp(1 + performance * 0.32, 0.62, 1.32);
    let delta = phaseGrowth * employedFactor * learningFactor * potentialHeadroom * difficulty * exposure * performanceFactor * variance;
    if (phase === "veteran" && veteranYears > 0) {
      const knowledgeProtected = key === "tactical_knowledge" || key === "judging_ability" || key === "judging_potential" || key === "man_management";
      const decline = (0.045 + veteranYears * 0.028) * (knowledgeProtected ? 0.45 : 1);
      delta -= decline;
    }
    let accumulated = Number(bank[key] ?? 0) + delta;
    let next = current;
    while (accumulated >= 1 && next < 20) { next += 1; accumulated -= 1; }
    while (accumulated <= -1 && next > 1) { next -= 1; accumulated += 1; }
    attributes[key] = next;
    bank[key] = accumulated;
  });

  let reputationGain = contract.status === "contracted" ? 0.15 : -0.08;
  if (review) {
    reputationGain += clamp((review.expectedPosition - review.finalPosition) * 0.25, -0.75, 1.25);
    const wasHeadCoach = contract.roles.includes("head_coach") || review.headCoachStaffId === contract.staffId;
    if (review.wonTitle) reputationGain += wasHeadCoach ? 2.5 : 0.9;
    else if (review.finalPosition <= 2) reputationGain += wasHeadCoach ? 0.8 : 0.3;
  }
  let reputationBank = contract.reputationDevelopmentBank + reputationGain;
  let reputation = contract.reputation;
  while (reputationBank >= 1 && reputation < 100) { reputation += 1; reputationBank -= 1; }
  while (reputationBank <= -1 && reputation > 0) { reputation -= 1; reputationBank += 1; }
  attributes.reputation = reputation;
  const roleRatings = calculateStaffRoleRatings(attributes);
  const primary = isStaffRatingRole(contract.primaryRole) ? contract.primaryRole : "coach";
  const currentAbility = roleRatings[primary];
  const modelPotential = calculateStaffPotentialAbility({
    currentAbility, dateOfBirth: contract.dateOfBirth, experienceYears: contract.experienceYears + 1,
    learningRate: contract.learningRate, adaptability: contract.adaptability, ambition: contract.ambition,
    developmentPhase: phase, retirementAge: contract.retirementAge, profileConfidence: contract.profileConfidence,
    asOfDate: `${season}-12-31`,
  });
  const potentialAbility = Math.max(currentAbility, Math.min(95, Math.round(contract.potentialAbility * 0.65 + modelPotential * 0.35)));
  return {
    ...contract,
    coachingAttributes: attributes,
    roleRatings,
    currentAbility,
    potentialAbility,
    reputation,
    experienceYears: contract.experienceYears + (contract.status === "contracted" ? 1 : 0),
    developmentPhase: phase,
    lastDevelopedSeason: season,
    developmentBank: bank,
    reputationDevelopmentBank: reputationBank,
  };
}

export interface StaffDevelopmentResult { state: CareerStaffState; retiredStaffIds: string[]; }

export function processAnnualStaffDevelopment(input: { state: CareerStaffState; completedSeason: number; seed: string }): StaffDevelopmentResult {
  if (!input.state.initialized || input.state.lastDevelopmentSeason === input.completedSeason) return { state: input.state, retiredStaffIds: [] };
  let state = input.state;
  const retiredStaffIds: string[] = [];
  const contracts = { ...state.contracts };
  Object.values(contracts).forEach((original) => {
    if (original.status === "retired" || original.lastDevelopedSeason === input.completedSeason) return;
    const review = reviewFor(original, state.performanceReviews, input.completedSeason);
    contracts[original.staffId] = developContract(original, review, input.completedSeason, input.seed);
  });
  state = { ...state, contracts };

  Object.values(state.contracts).forEach((contract) => {
    if (contract.status === "retired") return;
    const review = reviewFor(contract, state.performanceReviews, input.completedSeason);
    const probability = retirementProbability(contract, ageInSeason(contract.dateOfBirth, input.completedSeason), review);
    if (probability <= 0 || hashUnit(`${input.seed}:${input.completedSeason}:${contract.staffId}:retirement`) >= probability) return;
    retiredStaffIds.push(contract.staffId);
    if (contract.status === "contracted") {
      state = releaseCareerStaff(state, contract.staffId, "retired", input.completedSeason, `${input.completedSeason}-06-02`);
    } else {
      state = {
        ...state,
        contracts: { ...state.contracts, [contract.staffId]: { ...contract, status: "retired", releasedOn: `${input.completedSeason}-06-02` } },
        employmentHistory: [...state.employmentHistory, {
          id: `${contract.staffId}:${input.completedSeason}:retired:${state.employmentHistory.length}`,
          staffId: contract.staffId, teamId: null, roles: [], season: input.completedSeason,
          effectiveOn: `${input.completedSeason}-06-02`, kind: "released", reason: "retired", compensation: 0,
        }],
      };
    }
    state = { ...state, newsEvents: [...state.newsEvents, {
      id: `staff-news:retired:${contract.staffId}:${input.completedSeason}`,
      kind: "staff_retired", teamId: contract.teamId ?? "league", staffId: contract.staffId,
      publishedOn: `${input.completedSeason}-06-02`,
    }] };
  });
  return {
    retiredStaffIds,
    state: {
      ...state,
      lastDevelopmentSeason: input.completedSeason,
      financesByTeam: recalculateStaffFinances(state.contracts, state.financesByTeam),
    },
  };
}
