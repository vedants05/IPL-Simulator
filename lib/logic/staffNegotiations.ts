export interface StaffOfferInput {
  salaryExpectation: number;
  reputation: number;
  roleRating: number;
  roleCount: number;
  startSeason: number;
  endSeason: number | null;
  offeredSalary?: number;
  poaching?: boolean;
  nationalTeamAppointment?: boolean;
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
  offeredRoles?: string[];
  offeredRoleRatings?: Record<string, number>;
}

export interface StaffNegotiationPackage {
  annualSalary: number;
  primaryRole: string;
  roles: string[];
  endSeason: number | null;
}

export interface StaffNegotiationRound {
  round: number;
  offered: StaffNegotiationPackage;
  packageScore: number;
  salaryRatio: number;
  patienceChange: number;
  trustChange: number;
  outcome: StaffNegotiationOutcome;
}

export type StaffNegotiationOutcome = "accepted" | "exceptional-accepted" | "countered" | "rejected" | "walked-away";

export interface StaffNegotiationSession {
  id: string;
  staffId: string;
  teamId: string;
  action: "hire" | "poach" | "renew";
  openedOn: string;
  updatedOn: string;
  status: "active" | "accepted" | "failed" | "abandoned";
  patience: number;
  trust: number;
  rounds: StaffNegotiationRound[];
  targetSalary: number;
  reservationScore: number;
  concessionBudget: number;
  latestCounter: StaffNegotiationPackage | null;
}

export interface StaffNegotiationEvaluation {
  accepted: boolean;
  outcome: StaffNegotiationOutcome;
  session: StaffNegotiationSession;
  counterPackage: StaffNegotiationPackage | null;
  patienceAfter: number;
  patienceChange: number;
  trustAfter: number;
  trustChange: number;
  signals: string[];
  message: string;
}

const roundTo = (value: number, increment: number) => Math.ceil(value / increment) * increment;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

const stableFraction = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_295;
};

const packageDuration = (offer: StaffNegotiationPackage, startSeason: number) => (
  offer.endSeason === null ? 4 : Math.max(1, offer.endSeason - startSeason + 1)
);

export function createStaffNegotiationSession(input: StaffOfferInput & {
  staffId: string;
  teamId: string;
  action: "hire" | "poach" | "renew";
  openedOn: string;
}): StaffNegotiationSession {
  const personality = stableFraction(`${input.staffId}:${input.teamId}:${input.startSeason}:${input.action}`);
  const targetSalary = calculateStaffSalaryDemand(input);
  const resistance = input.poaching
    ? Math.max(0, (input.loyalty ?? 50) - 50) * 0.0008
      + Math.max(0, (input.currentAffinity ?? 0) - (input.destinationAffinity ?? 0)) * 0.00045
    : 0;
  return {
    id: `${input.staffId}:${input.teamId}:${input.startSeason}:${input.action}`,
    staffId: input.staffId,
    teamId: input.teamId,
    action: input.action,
    openedOn: input.openedOn,
    updatedOn: input.openedOn,
    status: "active",
    patience: calculateInitialStaffNegotiationPatience(input),
    trust: Math.round(clamp(58 + ((input.adaptability ?? 50) - 50) * 0.12 - resistance * 100, 35, 75)),
    rounds: [],
    targetSalary,
    // The floor is stable for this person/session but deliberately not derivable
    // from one public percentage or exposed to the UI.
    reservationScore: clamp(0.885 + personality * 0.045 + resistance, 0.88, 0.955),
    concessionBudget: clamp(0.055 + (input.adaptability ?? 50) * 0.00035 - resistance * 0.35, 0.025, 0.085),
    latestCounter: null,
  };
}

export function evaluateStaffNegotiationRound(
  session: StaffNegotiationSession,
  input: StaffOfferInput & { offeredPackage: StaffNegotiationPackage; currentDate: string },
): StaffNegotiationEvaluation {
  if (session.status !== "active") {
    return { accepted: false, outcome: "walked-away", session, counterPackage: null, patienceAfter: session.patience, patienceChange: 0, trustAfter: session.trust, trustChange: 0, signals: ["Talks have already ended"], message: "These negotiations have already ended." };
  }
  const offered = input.offeredPackage;
  // Revalue the actual package each round so changing to a more valuable role
  // or adding responsibilities cannot reuse a cheaper opening-round anchor.
  const target = Math.max(1, calculateStaffSalaryDemand({
    ...input,
    offeredSalary: offered.annualSalary,
    offeredPrimaryRole: offered.primaryRole,
    offeredRoles: offered.roles,
    roleCount: offered.roles.length,
    endSeason: offered.endSeason,
  }));
  const salaryRatio = offered.annualSalary / target;
  const duration = packageDuration(offered, input.startSeason);
  const desiredDuration = input.incumbentRenewal || (input.loyalty ?? 50) >= 65 ? 3 : (input.ambition ?? 50) >= 70 ? 2 : 3;
  const securityScore = offered.endSeason === null ? 0.82 : clamp(1 - Math.abs(duration - desiredDuration) * 0.055, 0.72, 1);
  const currentSeniority = roleSeniority(input.currentPrimaryRole ?? offered.primaryRole);
  const offeredSeniority = roleSeniority(offered.primaryRole);
  const roleScore = clamp(0.88 + (offeredSeniority - currentSeniority) * 0.055 + Math.min(1, offered.roles.length) * 0.025, 0.7, 1.08);
  const affinityScore = input.poaching
    ? clamp(0.9 + ((input.destinationAffinity ?? 0) - (input.currentAffinity ?? 0)) * 0.0015, 0.76, 1.04)
    : clamp(0.96 + (input.destinationAffinity ?? input.currentAffinity ?? 0) * 0.0008, 0.94, 1.04);
  const marketPressure = clamp(((input.reputation + input.roleRating) / 2 - 50) / 220, 0, 0.2);
  const packageScore = salaryRatio * 0.68 + roleScore * 0.13 + securityScore * 0.1 + affinityScore * 0.09;
  const previous = session.rounds.at(-1);
  const repeated = previous
    ? Math.abs(offered.annualSalary - previous.offered.annualSalary) < target * 0.0125
      && offered.primaryRole === previous.offered.primaryRole
      && offered.endSeason === previous.offered.endSeason
    : false;
  const salaryImprovement = previous ? (offered.annualSalary - previous.offered.annualSalary) / target : 0;
  const roleDowngrade = previous ? roleSeniority(offered.primaryRole) < roleSeniority(previous.offered.primaryRole) : false;
  const openingInsult = session.rounds.length === 0 && salaryRatio < 0.62;
  const nonCredible = salaryRatio < 0.7 && packageScore < 0.82;
  const conductPenalty = (repeated ? 13 : 0) + (roleDowngrade ? 10 : 0) + (salaryImprovement < 0 && previous ? 8 : 0);
  const gapPenalty = packageScore < 0.72 ? 42 : packageScore < 0.82 ? 25 : packageScore < 0.9 ? 12 : 4;
  const patienceLoss = Math.round(clamp(gapPenalty + conductPenalty + marketPressure * 20 - Math.max(0, salaryImprovement) * 35, 2, 70));
  const trustLoss = Math.round(clamp((openingInsult ? 24 : nonCredible ? 13 : 3) + conductPenalty * 0.7 - Math.max(0, salaryImprovement) * 25, 1, 35));
  const patienceAfter = Math.max(0, session.patience - patienceLoss);
  const trustAfter = Math.max(0, session.trust - trustLoss);
  const acceptanceThreshold = session.reservationScore + marketPressure * 0.12 + Math.max(0, 50 - trustAfter) * 0.0008;
  const hardSalaryFloor = Math.max(
    target * 0.9,
    input.incumbentRenewal ? Math.max(0, input.salaryExpectation) * 0.97 : 0,
  );
  const accepted = packageScore >= acceptanceThreshold && offered.annualSalary >= hardSalaryFloor && !roleDowngrade;
  const exceptional = packageScore >= 1.08;
  const walked = !accepted && (patienceAfter <= 0 || trustAfter <= 8);
  const outcome: StaffNegotiationOutcome = accepted ? (exceptional ? "exceptional-accepted" : "accepted") : walked ? "walked-away" : nonCredible ? "rejected" : "countered";
  const usedConcessions = session.rounds.filter((round) => round.outcome === "countered").length;
  const concession = Math.min(session.concessionBudget, usedConcessions * 0.012 + Math.max(0, trustAfter - 45) * 0.00035);
  const counterSalary = roundTo(Math.max(offered.annualSalary, target * (1 - concession)), 500_000);
  const counterPackage = outcome === "countered" ? {
    annualSalary: counterSalary,
    primaryRole: offeredSeniority < currentSeniority ? input.currentPrimaryRole ?? offered.primaryRole : offered.primaryRole,
    roles: offered.roles,
    endSeason: duration < desiredDuration && offered.endSeason !== null ? input.startSeason + desiredDuration - 1 : offered.endSeason,
  } : null;
  const round: StaffNegotiationRound = { round: session.rounds.length + 1, offered, packageScore, salaryRatio, patienceChange: -patienceLoss, trustChange: -trustLoss, outcome };
  const nextSession: StaffNegotiationSession = { ...session, updatedOn: input.currentDate, patience: accepted ? session.patience : patienceAfter, trust: accepted ? session.trust : trustAfter, rounds: [...session.rounds, round], latestCounter: counterPackage, status: accepted ? "accepted" : walked ? "failed" : "active" };
  const signals = [
    salaryRatio < 0.78 ? "Salary is not yet credible" : salaryRatio < 0.95 ? "Salary remains below expectations" : "Salary is competitive",
    roleScore < 0.9 ? "The proposed role is a concern" : "The role is acceptable",
    securityScore < 0.88 ? "Contract security needs improvement" : "Contract length is acceptable",
    repeated ? "Repeating the same terms damaged trust" : "They assessed the complete package",
  ];
  const message = accepted ? (exceptional ? "The strength of the overall package secured an immediate agreement." : "The overall contract package has been accepted.")
    : walked ? "Patience or trust has been exhausted. They have ended negotiations."
      : nonCredible ? "They rejected the proposal without revealing counter-terms. Improve the overall package."
        : "They remain in talks and have proposed revised package terms.";
  return { accepted, outcome, session: nextSession, counterPackage, patienceAfter: nextSession.patience, patienceChange: accepted ? 0 : -patienceLoss, trustAfter: nextSession.trust, trustChange: accepted ? 0 : -trustLoss, signals, message };
}

export function calculateInitialStaffNegotiationPatience(input: StaffOfferInput): number {
  const loyaltyResistance = input.poaching ? Math.max(0, (input.loyalty ?? 50) - 50) * 0.22 : 0;
  const affinityResistance = input.poaching
    ? Math.max(0, (input.currentAffinity ?? 0) - (input.destinationAffinity ?? 0)) * 0.1
    : 0;
  return Math.round(clamp(
    68 + ((input.adaptability ?? 50) - 50) * 0.18 - ((input.ambition ?? 50) - 50) * 0.1
      - loyaltyResistance - affinityResistance - (input.poaching && input.nationalTeamAppointment ? 5 : 0),
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
    calculateInitialStaffNegotiationPatience(input) + freeAgentBonus - contractSecurityPenalty + destinationPull
      - (input.poaching && input.nationalTeamAppointment ? 5 : 0),
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
  const ratingMarketFor = (value: number) => {
    const rating = clamp(value, 50, 94);
    const quality = (rating - 50) / 44;
    return 5_000_000 + 27_000_000 * Math.pow(quality, 1.65);
  };
  // Ratings establish the market rather than the previous contract. This avoids
  // renewals recursively multiplying an already-inflated salary every season.
  const ratingMarket = ratingMarketFor(input.roleRating);
  const statedExpectation = Math.max(0, input.salaryExpectation || 0);
  const boundedExpectation = clamp(statedExpectation, ratingMarket * 0.7, ratingMarket * 1.3);
  const marketBaseline = input.incumbentRenewal
    ? ratingMarket
    : ratingMarket * 0.82 + boundedExpectation * 0.18;
  const reputationMultiplier = 0.92 + clamp(input.reputation, 0, 100) * 0.0016;
  const salaryRoleMultiplier = (role?: string) => role === "head_coach" ? 1.55
    : role === "mentor" ? 1.18
      : role === "assistant_coach" ? 1.12
        : role === "batting_coach" || role === "pace_bowling_coach" || role === "spin_bowling_coach"
          || role === "fielding_coach" || role === "wicketkeeping_coach" ? 1.08
          : role === "coach" ? 0.95 : 1;
  const offeredRoles = Array.from(new Set(input.offeredRoles?.length
    ? input.offeredRoles
    : [input.offeredPrimaryRole ?? input.currentPrimaryRole ?? "coach"]));
  const primaryRole = input.offeredPrimaryRole ?? offeredRoles[0];
  const primaryRoleMarket = ratingMarket * salaryRoleMultiplier(primaryRole);
  const secondaryRoleMarket = offeredRoles
    .filter((role) => role !== primaryRole)
    .reduce((sum, role) => sum + ratingMarketFor(input.offeredRoleRatings?.[role] ?? input.roleRating)
      * salaryRoleMultiplier(role) * 0.62, 0);
  const roleValuedMarket = primaryRoleMarket + secondaryRoleMarket;
  const expectationRatio = marketBaseline / Math.max(1, ratingMarket);
  const outOfRoleMultiplier = input.currentPrimaryRole && input.offeredPrimaryRole
    && input.currentPrimaryRole !== input.offeredPrimaryRole ? 1.18 : 1;
  const duration = input.endSeason === null ? null : input.endSeason - input.startSeason + 1;
  const durationMultiplier = duration === null ? 1.03 : duration <= 1 ? 1.08 : duration === 2 ? 1.03 : 1;
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
  const calculatedDemand = roleValuedMarket * expectationRatio * reputationMultiplier * durationMultiplier
      * outOfRoleMultiplier * poachingMultiplier * loyaltyPremium
      * affinityPremium * securityPremium * Math.max(0.88, mobilityDiscount)
      * (input.poaching && input.nationalTeamAppointment ? 1.08 : 1);
  // An incumbent can resist a pay cut, but their old wage is only a floor—not
  // the base to which all valuation multipliers are applied again.
  const renewalFloor = input.incumbentRenewal ? statedExpectation * 0.97 : 0;
  return roundTo(Math.max(calculatedDemand, renewalFloor), 500_000);
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
  const patienceLoss = offerRatio < 0.5 ? 65
    : offerRatio < 0.7 ? 45
      : offerRatio < 0.82 ? 24
        : offerRatio < 0.88 ? 12
          : Math.max(3, Math.round((1 - offerRatio) * 45));
  const patienceAfter = Math.max(0, patience - patienceLoss);
  if (patienceAfter <= 0) {
    return { accepted: false, outcome: "walked-away", demand, counterOffer: null, shortfall, patienceAfter, patienceChange: -patienceLoss, message: "Patience exhausted. The staff member has ended negotiations." };
  }
  if (offerRatio < 0.7) {
    return { accepted: false, outcome: "instant-rejected", demand, counterOffer: null, shortfall, patienceAfter, patienceChange: -patienceLoss, message: "The offer was rejected immediately as far below credible terms." };
  }
  const reservationFactor = clamp(
    0.92 + ((input.loyalty ?? 50) - 50) * 0.0005
      + ((input.ambition ?? 50) - 50) * 0.0003
      - ((input.adaptability ?? 50) - 50) * 0.0002,
    0.91,
    0.97,
  );
  const reservation = roundTo(Math.max(
    demand * reservationFactor,
    input.incumbentRenewal ? Math.max(0, input.salaryExpectation) * 0.97 : 0,
  ), 500_000);
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
  nationalTeamAppointment?: boolean;
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
    nationalDuty: input.nationalTeamAppointment ? -8 : 0,
  };
  const score = Math.round(Math.max(0, Math.min(100,
    Object.values(factors).reduce((sum, value) => sum + value, 0),
  )) * 10) / 10;
  return { score, interested: score >= 55, factors };
}
