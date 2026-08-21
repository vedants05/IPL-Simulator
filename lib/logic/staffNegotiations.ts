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
}

const roundTo = (value: number, increment: number) => Math.ceil(value / increment) * increment;

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
  return roundTo(
    baseline * roleMultiplier * reputationMultiplier * durationMultiplier * hierarchyMultiplier
      * outOfRoleMultiplier * responsibilityMultiplier * poachingMultiplier,
    500_000,
  );
}

export function evaluateStaffContractOffer(input: StaffOfferInput): {
  accepted: boolean;
  demand: number;
  shortfall: number;
  message: string;
} {
  const demand = calculateStaffSalaryDemand(input);
  const offered = Math.max(0, Math.round(input.offeredSalary ?? 0));
  if (offered >= demand) {
    return { accepted: true, demand, shortfall: 0, message: "Contract terms accepted." };
  }
  const shortfall = demand - offered;
  return {
    accepted: false,
    demand,
    shortfall,
    message: `Offer rejected. The staff member is seeking at least ${demand}.`,
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
