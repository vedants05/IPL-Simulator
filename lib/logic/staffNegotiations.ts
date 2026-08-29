export interface StaffOfferInput {
  salaryExpectation: number;
  reputation: number;
  roleRating: number;
  roleCount: number;
  startSeason: number;
  endSeason: number | null;
  offeredSalary?: number;
  poaching?: boolean;
  currentPrimaryRole?: string;
  offeredPrimaryRole?: string;
  incumbentRenewal?: boolean;
  currentRoleCount?: number;
  loyalty?: number;
  ambition?: number;
  adaptability?: number;
  currentAffinity?: number;
  destinationAffinity?: number;
  remainingContractSeasons?: number;
  previousCounterOffer?: number;
  negotiationPatience?: number;
}

const roundTo = (value: number, increment: number) => Math.ceil(value / increment) * increment;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function calculateInitialStaffNegotiationPatience(input: StaffOfferInput): number {
  const loyaltyResistance = input.poaching ? Math.max(0, (input.loyalty ?? 50) - 50) * 0.22 : 0;
  const affinityResistance = input.poaching
    ? Math.max(0, (input.currentAffinity ?? 0) - (input.destinationAffinity ?? 0)) * 0.1
    : 0;
  return Math.round(clamp(
    68 + ((input.adaptability ?? 50) - 50) * 0.18 - ((input.ambition ?? 50) - 50) * 0.1
      - loyaltyResistance - affinityResistance,
    30,
    90,
  ));
}

export type StaffRecruitmentInterestLabel = "Very interested" | "Interested" | "Open" | "Reluctant" | "Very reluctant" | "Not interested";

export function calculateStaffRecruitmentInterest(input: StaffOfferInput, coolingDown = false): {
  score: number;
  label: StaffRecruitmentInterestLabel;
} {
  if (coolingDown) return { score: 0, label: "Not interested" };
  const freeAgentBonus = input.poaching ? 0 : 10;
  const contractSecurityPenalty = input.poaching
    ? Math.min(15, Math.max(0, (input.remainingContractSeasons ?? 1) - 1) * 5)
    : 0;
  const destinationPull = Math.max(0, (input.destinationAffinity ?? 0) - (input.currentAffinity ?? 0)) * 0.08;
  const score = Math.round(clamp(
    calculateInitialStaffNegotiationPatience(input) + freeAgentBonus - contractSecurityPenalty + destinationPull,
    0,
    100,
  ));
  const label: StaffRecruitmentInterestLabel = score >= 80 ? "Very interested"
    : score >= 65 ? "Interested"
      : score >= 50 ? "Open"
        : score >= 35 ? "Reluctant"
          : "Very reluctant";
  return { score, label };
}

export function calculateStaffSalaryDemand(input: StaffOfferInput): number {
  const baseline = Math.max(5_000_000, input.salaryExpectation || 0);
  const roleMultiplier = 0.8 + Math.max(0, input.roleRating - 60) * 0.0125;
  const reputationMultiplier = 0.9 + Math.max(0, Math.min(100, input.reputation)) * 0.002;
  const salaryRoleMultiplier = (role?: string) => role === "head_coach" ? 1.55
    : role === "mentor" ? 1.18
      : role === "assistant_coach" ? 1.12
        : role === "batting_coach" || role === "pace_bowling_coach" || role === "spin_bowling_coach"
          || role === "fielding_coach" || role === "wicketkeeping_coach" ? 1.08
          : role === "coach" ? 0.95 : 1;
  const offeredRoleMultiplier = salaryRoleMultiplier(input.offeredPrimaryRole);
  const currentRoleMultiplier = salaryRoleMultiplier(input.currentPrimaryRole);
  const hierarchyMultiplier = input.incumbentRenewal
    ? offeredRoleMultiplier / Math.max(0.8, currentRoleMultiplier)
    : offeredRoleMultiplier;
  const outOfRoleMultiplier = input.currentPrimaryRole && input.offeredPrimaryRole
    && input.currentPrimaryRole !== input.offeredPrimaryRole ? 1.18 : 1;
  const duration = input.endSeason === null ? null : input.endSeason - input.startSeason + 1;
  const durationMultiplier = duration === null ? 1.05 : duration <= 1 ? 1.12 : duration === 2 ? 1.04 : 1;
  const responsibilityMultiplier = input.incumbentRenewal
    ? 1 + Math.max(0, input.roleCount - Math.max(1, input.currentRoleCount ?? 1)) * 0.28
    : 1 + Math.max(0, input.roleCount - 1) * 0.28;
  const poachingMultiplier = input.poaching ? 1.1 : 1;
  const loyaltyPremium = input.poaching
    ? 1 + Math.max(0, (input.loyalty ?? 50) - 40) * 0.006
    : input.incumbentRenewal ? 1 - Math.max(0, (input.loyalty ?? 50) - 50) * 0.002 : 1;
  const affinityPremium = input.poaching
    ? 1 + Math.max(0, (input.currentAffinity ?? 0) - (input.destinationAffinity ?? 0)) * 0.0025
    : 1;
  const securityPremium = input.poaching
    ? 1 + Math.min(3, Math.max(0, (input.remainingContractSeasons ?? 1) - 1)) * 0.06
    : 1;
  const mobilityDiscount = input.poaching
    ? 1 - (Math.max(0, (input.ambition ?? 50) - 50) + Math.max(0, (input.adaptability ?? 50) - 50)) * 0.0015
    : 1;
  return roundTo(
    baseline * roleMultiplier * reputationMultiplier * durationMultiplier * hierarchyMultiplier
      * outOfRoleMultiplier * responsibilityMultiplier * poachingMultiplier * loyaltyPremium
      * affinityPremium * securityPremium * Math.max(0.88, mobilityDiscount),
    500_000,
  );
}

export function evaluateStaffContractOffer(input: StaffOfferInput): {
  accepted: boolean;
  outcome: "accepted" | "exceptional-accepted" | "countered" | "instant-rejected" | "walked-away";
  demand: number;
  counterOffer: number | null;
  shortfall: number;
  patienceAfter: number;
  patienceChange: number;
  message: string;
} {
  const demand = calculateStaffSalaryDemand(input);
  const offered = Math.max(0, Math.round(input.offeredSalary ?? 0));
  const agreedCounter = Math.max(0, input.previousCounterOffer ?? 0);
  const patience = clamp(input.negotiationPatience ?? calculateInitialStaffNegotiationPatience(input), 0, 100);
  if (offered >= demand * 1.12) {
    return { accepted: true, outcome: "exceptional-accepted", demand, counterOffer: null, shortfall: 0, patienceAfter: patience, patienceChange: 0, message: "The exceptional offer was accepted immediately." };
  }
  if (offered >= demand || (agreedCounter > 0 && offered >= agreedCounter)) {
    return { accepted: true, outcome: "accepted", demand, counterOffer: null, shortfall: 0, patienceAfter: patience, patienceChange: 0, message: "Contract terms accepted." };
  }
  const shortfall = demand - offered;
  const offerRatio = offered / Math.max(1, demand);
  const patienceLoss = offerRatio < 0.45 ? 55
    : offerRatio < 0.6 ? 38
      : offerRatio < 0.75 ? 24
        : offerRatio < 0.88 ? 12
          : Math.max(3, Math.round((1 - offerRatio) * 45));
  const patienceAfter = Math.max(0, patience - patienceLoss);
  if (patienceAfter <= 0) {
    return { accepted: false, outcome: "walked-away", demand, counterOffer: null, shortfall, patienceAfter, patienceChange: -patienceLoss, message: "Patience exhausted. The staff member has ended negotiations." };
  }
  if (offerRatio < 0.45) {
    return { accepted: false, outcome: "instant-rejected", demand, counterOffer: null, shortfall, patienceAfter, patienceChange: -patienceLoss, message: "The offer was rejected immediately as far below credible terms." };
  }
  const reservation = roundTo(demand * 0.88, 500_000);
  const freshCounter = Math.min(demand, Math.max(reservation, roundTo(offered + shortfall * 0.55, 500_000)));
  // Once staff name a figure it is an anchor. An improved bid can hold that
  // figure or earn a small concession toward the club; it can never make the
  // staff member increase the counter they already made.
  const concession = agreedCounter > 0 && offerRatio >= 0.75
    ? Math.min(1_000_000, Math.floor(Math.max(0, agreedCounter - offered) * 0.15 / 500_000) * 500_000)
    : 0;
  const counterOffer = agreedCounter > 0
    ? Math.max(offered, Math.min(agreedCounter, agreedCounter - concession))
    : freshCounter;
  return {
    accepted: false,
    outcome: "countered",
    demand,
    counterOffer,
    shortfall,
    patienceAfter,
    patienceChange: -patienceLoss,
    message: `The staff member has countered at ${counterOffer}.`,
  };
}

export function calculateStaffRenewalInterest(input: {
  loyalty: number;
  ambition: number;
  adaptability: number;
  clubAffinity: number;
  currentSalary: number;
  offeredSalary: number;
  remainingContractSeasons: number;
}): { score: number; interested: boolean } {
  const salaryRaise = input.currentSalary > 0
    ? Math.max(-0.25, Math.min(1, (input.offeredSalary - input.currentSalary) / input.currentSalary))
    : 0.2;
  const score = Math.round(Math.max(0, Math.min(100,
    50
    + (input.loyalty - 50) * 0.28
    - (input.ambition - 50) * 0.14
    + (input.adaptability - 50) * 0.08
    + (input.clubAffinity - 50) * 0.16
    + salaryRaise * 20
    - Math.max(0, input.remainingContractSeasons - 1) * 3,
  )) * 10) / 10;
  return { score, interested: score >= 52 };
}

export interface StaffMoveInterestInput {
  loyalty: number;
  ambition: number;
  adaptability: number;
  currentAffinity: number;
  destinationAffinity: number;
  currentSalary: number;
  offeredSalary: number;
  currentRoleRating: number;
  offeredRoleRating: number;
  currentPrimaryRole: string;
  offeredPrimaryRole: string;
  remainingContractSeasons: number;
  sameCountryAsHeadCoach?: boolean;
  relationshipBonus?: number;
}

const roleSeniority = (role: string) => role === "head_coach" ? 5
  : role === "assistant_coach" ? 4
    : role === "mentor" ? 3
      : role.endsWith("_coach") ? 2
        : 1;

export function calculateStaffMoveInterest(input: StaffMoveInterestInput): {
  score: number;
  interested: boolean;
  factors: Record<string, number>;
} {
  const salaryRaise = input.currentSalary > 0
    ? Math.max(-0.25, Math.min(1, (input.offeredSalary - input.currentSalary) / input.currentSalary))
    : 0.25;
  const promotion = Math.max(-2, Math.min(4,
    roleSeniority(input.offeredPrimaryRole) - roleSeniority(input.currentPrimaryRole),
  ));
  const factors = {
    baseline: 34,
    ambition: (input.ambition - 50) * 0.22,
    adaptability: (input.adaptability - 50) * 0.1,
    loyaltyResistance: -(input.loyalty - 50) * 0.34,
    destinationAffinity: input.destinationAffinity * 0.28,
    currentAffinityResistance: -input.currentAffinity * 0.3,
    salary: salaryRaise * 22,
    promotion: promotion * 8,
    roleQuality: (input.offeredRoleRating - input.currentRoleRating) * 0.35,
    contractSecurity: -Math.max(0, input.remainingContractSeasons - 1) * 4,
    compatriotHeadCoach: input.sameCountryAsHeadCoach ? 3 : 0,
    relationship: Math.min(20, Math.max(0, input.relationshipBonus ?? 0)),
  };
  const score = Math.round(Math.max(0, Math.min(100,
    Object.values(factors).reduce((sum, value) => sum + value, 0),
  )) * 10) / 10;
  return { score, interested: score >= 55, factors };
}
