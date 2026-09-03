import {
  appointCareerStaff,
  getTeamStaffSalaryBudgetCap,
  poachCareerStaff,
  processStaffContractExpiries,
  releaseCareerStaff,
  renewCareerStaffContract,
  type CareerStaffContract,
  type CareerStaffState,
} from "./staffContracts";
import { calculateStaffMoveInterest, calculateStaffSalaryDemand } from "./staffNegotiations";
import { getStaffRelationshipRecruitmentBonus } from "../data/staffRelationships";
import { getStaffClubAffinity } from "../data/staffAffinities";
import { getStaffClubCulture } from "../data/staffClubCulture";
import { addDaysToDateKey } from "./careerCalendar";

export const AI_CORE_STAFF_ROLES = [
  "head_coach",
  "batting_coach",
  "pace_bowling_coach",
  "spin_bowling_coach",
  "fielding_coach",
] as const;

const AI_MENTOR_CLUBS = new Set(["CSK", "DC", "GT", "KKR", "LSG", "MI", "RCB", "RR"]);
const AI_ASSISTANT_COACH_CLUBS = new Set(["CSK", "KKR", "LSG", "MI", "PBKS"]);
const AI_GENERAL_COACH_CLUBS = new Set(["DC", "GT", "RCB"]);
export const MIN_AI_MENTOR_REPUTATION = 85;

/** A club's intended staff structure. Core technical coverage is universal;
 * support roles deliberately vary so every AI club does not build the same staff. */
export function getAITeamStaffRoleTargets(teamId: string): string[] {
  return [
    ...AI_CORE_STAFF_ROLES,
    ...(AI_MENTOR_CLUBS.has(teamId) ? ["mentor"] : []),
    ...(AI_ASSISTANT_COACH_CLUBS.has(teamId) ? ["assistant_coach"] : []),
    ...(AI_GENERAL_COACH_CLUBS.has(teamId) ? ["coach"] : []),
  ];
}

export const isEligibleForAIRole = (contract: CareerStaffContract, role: string, rating = roleRating(contract, role)) => (
  role !== "mentor" || ((contract.reputation ?? 0) >= MIN_AI_MENTOR_REPUTATION && rating >= 70)
);

export function ensureAIStaffBudgets(state: CareerStaffState, teamIds: string[]): CareerStaffState {
  let changed = false;
  const financesByTeam = { ...state.financesByTeam };
  teamIds.forEach((teamId) => {
    const finance = financesByTeam[teamId];
    const committedSalary = finance?.committedSalary ?? 0;
    const annualBudget = getTeamStaffSalaryBudgetCap(teamId, Object.values(state.contracts));
    if (finance?.annualBudget === annualBudget) return;
    financesByTeam[teamId] = {
      annualBudget,
      committedSalary,
      compensationPaid: finance?.compensationPaid ?? 0,
      compensationReceived: finance?.compensationReceived ?? 0,
    };
    changed = true;
  });
  return changed ? { ...state, financesByTeam } : state;
}

export interface AIStaffMarketResult {
  state: CareerStaffState;
  renewed: number;
  released: number;
  hired: number;
  poached: number;
}

const hash = (value: string) => {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
};

const roleRating = (contract: CareerStaffContract, role: string) => (
  contract.roleRatings?.[role]
  ?? (contract.primaryRole === role ? contract.currentAbility : 50)
  ?? 50
);

const contractRating = (contract: CareerStaffContract) => Math.max(
  ...contract.roles.map((role) => roleRating(contract, role)),
  contract.currentAbility ?? 50,
);

const renewalThreshold = (contract: CareerStaffContract) => (
  contract.roles.includes("head_coach") ? 78 : contract.roles.some((role) => AI_CORE_STAFF_ROLES.includes(role as typeof AI_CORE_STAFF_ROLES[number])) ? 70 : 68
);

const releasedByTeamThisSeason = (state: CareerStaffState, staffId: string, teamId: string, season: number) => (
  state.employmentHistory.some((event) => event.staffId === staffId && event.teamId === teamId
    && event.season === season && (event.kind === "released" || event.kind === "contract_expired"))
);

export interface AIStaffRenewalDecision {
  eligible: boolean;
  remainingSeasons: number | null;
  clubScore: number;
  clubThreshold: number;
  staffScore: number;
  staffThreshold: number;
  clubWantsRenewal: boolean;
  staffWantsRenewal: boolean;
  renew: boolean;
}

export function evaluateAIStaffRenewal(input: {
  contract: CareerStaffContract;
  completedSeason: number;
  retentionScore: number;
  performancePressure: number;
  seed: string;
}): AIStaffRenewalDecision {
  const { contract } = input;
  const remainingSeasons = contract.contractType === "fixed_term" && contract.endSeason !== null
    ? Math.max(0, contract.endSeason - input.completedSeason)
    : null;
  const eligible = remainingSeasons !== null && remainingSeasons <= 1;
  const affinity = getStaffClubAffinity(contract.affinityProfile, contract.teamId ?? "");
  const patience = getStaffClubCulture(contract.teamId ?? "").patienceModifier;
  const clubTieBreak = (hash(`${input.seed}:${input.completedSeason}:club-renew:${contract.staffId}`) % 81) / 20;
  const staffTieBreak = (hash(`${input.seed}:${input.completedSeason}:staff-renew:${contract.staffId}`) % 81) / 20;
  // Clubs only renew a year early when conviction is strong. At expiry, urgency
  // lowers the bar, but poor performance can still trigger a deliberate reset.
  const clubThreshold = renewalThreshold(contract) + (remainingSeasons === 1 ? 6 : 0) - patience * 0.35;
  const clubScore = input.retentionScore + clubTieBreak;
  // Renewal is two-sided. Loyalty, existing club ties and adaptability encourage
  // continuity; ambition and pressure make testing the market more attractive.
  const staffThreshold = remainingSeasons === 1 ? 58 : 52;
  const staffScore = 50
    + (contract.loyalty - 50) * 0.28
    - (contract.ambition - 50) * 0.14
    + (contract.adaptability - 50) * 0.08
    + (affinity - 50) * 0.16
    - input.performancePressure * 0.08
    + staffTieBreak;
  const clubWantsRenewal = eligible && clubScore >= clubThreshold;
  const staffWantsRenewal = eligible && staffScore >= staffThreshold;
  return {
    eligible,
    remainingSeasons,
    clubScore,
    clubThreshold,
    staffScore,
    staffThreshold,
    clubWantsRenewal,
    staffWantsRenewal,
    renew: clubWantsRenewal && staffWantsRenewal,
  };
}

export function processAIStaffMarket(input: {
  state: CareerStaffState;
  teamIds: string[];
  userTeamId: string;
  delegateUserTeam?: boolean;
  completedSeason: number;
  seed: string;
  effectiveOn?: string;
}): AIStaffMarketResult {
  if (!input.state.initialized || input.state.lastAIProcessedSeason === input.completedSeason) {
    return { state: input.state, renewed: 0, released: 0, hired: 0, poached: 0 };
  }
  const aiTeamIds = input.teamIds
    .filter((teamId) => input.delegateUserTeam || teamId !== input.userTeamId)
    .sort();
  let state = ensureAIStaffBudgets(input.state, aiTeamIds);
  let renewed = 0;
  let released = 0;
  let hired = 0;
  let poached = 0;
  const effectiveOn = input.effectiveOn ?? `${input.completedSeason}-06-02`;
  const nextSeason = input.completedSeason + 1;
  const newlyHiredStaffIds = new Set<string>();

  Object.values(state.contracts)
    .filter((contract) => contract.status === "contracted" && contract.teamId && aiTeamIds.includes(contract.teamId))
    .sort((left, right) => left.staffId.localeCompare(right.staffId))
    .forEach((contract) => {
      const rating = contractRating(contract);
      const review = state.performanceReviews.find((candidate) => candidate.season === input.completedSeason && candidate.teamId === contract.teamId);
      const departmentPressure = contract.roles.some((role) => role === "batting_coach" || role === "wicketkeeping_coach")
        ? review?.departments.batting.pressure ?? 0
        : contract.roles.some((role) => role === "pace_bowling_coach" || role === "spin_bowling_coach")
          ? review?.departments.bowling.pressure ?? 0
          : contract.roles.includes("fielding_coach") ? review?.departments.fielding.pressure ?? 0 : 0;
      const performancePenalty = contract.roles.includes("head_coach")
        ? (review?.trophyProtected ? 0 : (review?.effectivePressure ?? 0) * 0.28)
        : contract.roles.includes("assistant_coach") ? (review?.effectivePressure ?? 0) * 0.12
          : departmentPressure * 0.2;
      const retentionScore = rating
        + (contract.loyalty - 70) * 0.12
        - (contract.ambition - 70) * 0.05
        + Math.max(0, getStaffClubAffinity(contract.affinityProfile, contract.teamId ?? "") - 50) * 0.12
        - performancePenalty;
      const renewalDecision = evaluateAIStaffRenewal({
        contract,
        completedSeason: input.completedSeason,
        retentionScore,
        performancePressure: contract.roles.includes("head_coach")
          ? review?.effectivePressure ?? 0
          : departmentPressure,
        seed: input.seed,
      });
      if (renewalDecision.renew) {
          const endSeason = input.completedSeason + (rating >= 85 ? 3 : 2);
          const annualSalary = calculateStaffSalaryDemand({
            salaryExpectation: contract.annualSalary,
            reputation: contract.reputation ?? 50,
            roleRating: rating,
            roleCount: contract.roles.length,
            startSeason: nextSeason,
            endSeason,
            currentPrimaryRole: contract.primaryRole,
            offeredPrimaryRole: contract.primaryRole,
            incumbentRenewal: true,
            currentRoleCount: contract.roles.length,
          });
          const next = renewCareerStaffContract(state, {
            staffId: contract.staffId,
            endSeason,
            annualSalary,
            season: input.completedSeason,
            effectiveOn,
          });
          if (next !== state) {
            state = next;
            renewed += 1;
          }
      }
    });

  const beforeExpiryCount = Object.values(state.contracts).filter((contract) => contract.status === "contracted").length;
  state = processStaffContractExpiries(state, input.completedSeason, effectiveOn);
  const afterExpiryCount = Object.values(state.contracts).filter((contract) => contract.status === "contracted").length;
  released += Math.max(0, beforeExpiryCount - afterExpiryCount);

  aiTeamIds.forEach((teamId) => {
    const teamContracts = () => Object.values(state.contracts)
      .filter((contract) => contract.status === "contracted" && contract.teamId === teamId);
    const desiredRoles = getAITeamStaffRoleTargets(teamId);
    const occupied = new Set(teamContracts()
      .flatMap((contract) => contract.roles));
    desiredRoles.forEach((vacantRole) => {
      if (occupied.has(vacantRole)) return;
      const appointmentOn = addDaysToDateKey(effectiveOn, 3 + hash(`${input.seed}:${teamId}:${vacantRole}:appointment-delay`) % 8);
      // A second role is a contingency for an otherwise complete department,
      // not the default way to avoid employing another specialist.
      const canConsolidateRole = teamContracts().length >= desiredRoles.length - 1;
      const internal = teamContracts()
        .filter((contract) => (vacantRole === "head_coach" || canConsolidateRole)
          && contract.roles.length < 2 && !contract.roles.includes(vacantRole)
          && !newlyHiredStaffIds.has(contract.staffId))
        .map((contract) => ({ contract, rating: roleRating(contract, vacantRole) }))
        .filter((candidate) => candidate.rating >= (vacantRole === "head_coach" ? 75 : 80))
        .filter((candidate) => isEligibleForAIRole(candidate.contract, vacantRole, candidate.rating))
        .sort((left, right) => right.rating - left.rating || left.contract.staffId.localeCompare(right.contract.staffId))[0];
      if (internal) {
        const roles = vacantRole === "head_coach" ? [vacantRole] : [...internal.contract.roles, vacantRole];
        const primaryRole = vacantRole === "head_coach" ? vacantRole : internal.contract.primaryRole;
        const annualSalary = calculateStaffSalaryDemand({
          salaryExpectation: internal.contract.annualSalary,
          reputation: internal.contract.reputation ?? 50,
          roleRating: internal.rating,
          roleCount: roles.length,
          startSeason: nextSeason,
          endSeason: internal.contract.endSeason,
          currentPrimaryRole: internal.contract.primaryRole,
          offeredPrimaryRole: primaryRole,
          incumbentRenewal: true,
          currentRoleCount: internal.contract.roles.length,
        });
        const next = renewCareerStaffContract(state, {
          staffId: internal.contract.staffId,
          endSeason: internal.contract.endSeason,
          annualSalary,
          season: input.completedSeason,
          effectiveOn: appointmentOn,
          roles,
          primaryRole,
        });
        if (next !== state) {
          state = next;
          occupied.add(vacantRole);
          renewed += 1;
          return;
        }
      }
      const headCoach = Object.values(state.contracts).find((member) => (
        member.status === "contracted" && member.teamId === teamId && member.roles.includes("head_coach")
      ));
      const candidates = Object.values(state.contracts)
        .filter((contract) => contract.status === "free_agent" || (
          contract.status === "contracted" && contract.teamId !== teamId
          && (input.delegateUserTeam || contract.teamId !== input.userTeamId)
        ))
        .filter((contract) => !releasedByTeamThisSeason(state, contract.staffId, teamId, input.completedSeason))
        .map((contract) => {
          const rating = roleRating(contract, vacantRole);
          const relationshipBonus = getStaffRelationshipRecruitmentBonus(headCoach?.staffSlug, contract.staffSlug);
          const destinationAffinity = getStaffClubAffinity(contract.affinityProfile, teamId);
          return { contract, rating, relationshipBonus, destinationAffinity, recruitmentScore: rating + relationshipBonus + destinationAffinity * 0.12 };
        })
        .filter((candidate) => candidate.rating >= 65)
        .filter((candidate) => isEligibleForAIRole(candidate.contract, vacantRole, candidate.rating))
        .sort((left, right) => (
          right.recruitmentScore - left.recruitmentScore
          || right.rating - left.rating
          || (right.contract.potentialAbility ?? 50) - (left.contract.potentialAbility ?? 50)
          || (hash(`${input.seed}:${teamId}:${vacantRole}:${left.contract.staffId}`)
            - hash(`${input.seed}:${teamId}:${vacantRole}:${right.contract.staffId}`))
        ));
      for (const candidate of candidates) {
        const canMakeDualHire = teamContracts().length >= desiredRoles.length - 1
          && hash(`${input.seed}:${teamId}:${vacantRole}:${candidate.contract.staffId}:dual-role`) % 100 < 20;
        const additionalRoles = canMakeDualHire ? desiredRoles.filter((role) => (
          role !== vacantRole && !occupied.has(role)
          && roleRating(candidate.contract, role) >= Math.max(80, candidate.rating - 3)
          && isEligibleForAIRole(candidate.contract, role)
        )).slice(0, 1) : [];
        const roles = [vacantRole, ...additionalRoles];
        const endSeason = nextSeason + (candidate.rating >= 85 ? 2 : 1);
        const annualSalary = calculateStaffSalaryDemand({
          salaryExpectation: candidate.contract.annualSalary,
          reputation: candidate.contract.reputation ?? 50,
          roleRating: candidate.rating,
          roleCount: roles.length,
          startSeason: nextSeason,
          endSeason,
          poaching: candidate.contract.status === "contracted",
          currentPrimaryRole: candidate.contract.primaryRole,
          offeredPrimaryRole: vacantRole,
        });
        if (candidate.contract.status === "contracted") {
          const currentRoleRating = roleRating(candidate.contract, candidate.contract.primaryRole);
          const remainingContractSeasons = candidate.contract.endSeason == null
            ? 1 : Math.max(0, candidate.contract.endSeason - nextSeason + 1);
          const interest = calculateStaffMoveInterest({
            loyalty: candidate.contract.loyalty,
            ambition: candidate.contract.ambition,
            adaptability: candidate.contract.adaptability,
            currentAffinity: getStaffClubAffinity(candidate.contract.affinityProfile, candidate.contract.teamId ?? ""),
            destinationAffinity: candidate.destinationAffinity,
            currentSalary: candidate.contract.annualSalary,
            offeredSalary: annualSalary,
            currentRoleRating,
            offeredRoleRating: candidate.rating,
            currentPrimaryRole: candidate.contract.primaryRole,
            offeredPrimaryRole: vacantRole,
            remainingContractSeasons,
            sameCountryAsHeadCoach: Boolean(headCoach && headCoach.country !== "Unknown" && headCoach.country === candidate.contract.country),
            relationshipBonus: candidate.relationshipBonus,
          });
          if (!interest.interested) continue;
        }
        const transferInput = {
          staffId: candidate.contract.staffId,
          teamId,
          roles,
          primaryRole: vacantRole,
          startSeason: nextSeason,
          endSeason,
          annualSalary,
          effectiveOn: appointmentOn,
        };
        const wasPoached = candidate.contract.status === "contracted";
        const previousTeamId = candidate.contract.teamId;
        const next = wasPoached ? poachCareerStaff(state, transferInput) : appointCareerStaff(state, transferInput);
        if (next === state) continue;
        state = next;
        newlyHiredStaffIds.add(candidate.contract.staffId);
        roles.forEach((role) => occupied.add(role));
        hired += 1;
        if (wasPoached) {
          poached += 1;
          state = { ...state, newsEvents: [...state.newsEvents, {
            id: `staff-news:poached:${candidate.contract.staffId}:${input.completedSeason}:${teamId}`,
            kind: "staff_poached",
            teamId,
            sourceTeamId: previousTeamId,
            staffId: candidate.contract.staffId,
            publishedOn: appointmentOn,
          }] };
        }
        break;
      }
    });
  });

  state = { ...state, lastAIProcessedSeason: input.completedSeason };
  return { state, renewed, released, hired, poached };
}
