import { addDaysToDateKey } from "./careerCalendar";
import {
  AI_CORE_STAFF_ROLES,
  ensureAIStaffBudgets,
  getAITeamStaffRoleTargets,
  isEligibleForAIRole,
} from "./aiStaffMarket";
import { getStaffRelationshipRecruitmentBonus } from "../data/staffRelationships";
import {
  appointCareerStaff,
  poachCareerStaff,
  normalizeCareerStaffState,
  renewCareerStaffContract,
  type CareerStaffContract,
  type CareerStaffState,
  type StaffNewsEvent,
  type StaffRecruitmentSearch,
} from "./staffContracts";
import { calculateStaffMoveInterest, calculateStaffSalaryDemand } from "./staffNegotiations";
import { getStaffClubAffinity } from "../data/staffAffinities";

const hash = (value: string) => {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
};

const roleRating = (contract: CareerStaffContract, role: string) => (
  contract.roleRatings?.[role] ?? (contract.primaryRole === role ? contract.currentAbility : 50)
);

const interimPriority = (contract: CareerStaffContract, role: string) => {
  if (role !== "head_coach") return roleRating(contract, role);
  const priority = contract.roles.includes("assistant_coach") ? 300
    : contract.roles.includes("mentor") ? 200
      : contract.roles.includes("coach") ? 100
        : 0;
  return priority + roleRating(contract, "head_coach");
};

const minimumRating = (role: string) => role === "head_coach" ? 72
  : AI_CORE_STAFF_ROLES.includes(role as typeof AI_CORE_STAFF_ROLES[number]) ? 65
    : 62;

const releasedByTeamThisSeason = (state: CareerStaffState, staffId: string, teamId: string, season: number) => (
  state.employmentHistory.some((event) => event.staffId === staffId && event.teamId === teamId
    && event.season === season && (event.kind === "released" || event.kind === "contract_expired"))
);

export interface AIMidseasonRecruitmentResult {
  state: CareerStaffState;
  searchesStarted: number;
  appointments: number;
  retries: number;
}

export function reconcileAIMidseasonRecruitment(input: {
  state: CareerStaffState;
  teamIds: string[];
  userTeamId: string;
  delegateUserTeam?: boolean;
  currentDate: string;
  currentSeason: number;
  seed: string;
}): AIMidseasonRecruitmentResult {
  const aiTeams = input.teamIds
    .filter((teamId) => input.delegateUserTeam || teamId !== input.userTeamId)
    .sort();
  let state = ensureAIStaffBudgets(normalizeCareerStaffState(input.state), aiTeams);
  let searches = [...state.recruitmentSearches];
  let newsEvents = [...state.newsEvents];
  let searchesStarted = 0;
  let appointments = 0;
  let retries = 0;

  aiTeams.forEach((teamId) => {
    const teamContracts = () => Object.values(state.contracts).filter((contract) => (
      contract.status === "contracted" && contract.teamId === teamId
    ));
    const desiredRoles = getAITeamStaffRoleTargets(teamId);
    desiredRoles.forEach((role) => {
      const occupied = teamContracts().some((contract) => contract.roles.includes(role));
      const activeIndex = searches.findIndex((search) => search.teamId === teamId && search.role === role && search.status === "active");
      if (occupied) {
        if (activeIndex >= 0) searches[activeIndex] = { ...searches[activeIndex], status: "cancelled" };
        return;
      }
      const canConsolidateRole = teamContracts().length >= desiredRoles.length - 1;
      const internal = teamContracts()
        .filter((contract) => (role === "head_coach" || canConsolidateRole) && contract.roles.length < 2 && !contract.roles.includes(role))
        .map((contract) => ({ contract, rating: roleRating(contract, role) }))
        .filter((candidate) => candidate.rating >= (role === "head_coach" ? 75 : 80))
        .filter((candidate) => isEligibleForAIRole(candidate.contract, role, candidate.rating))
        .sort((left, right) => right.rating - left.rating || left.contract.staffId.localeCompare(right.contract.staffId))[0];
      if (internal) {
        const roles = role === "head_coach" ? [role] : [...internal.contract.roles, role];
        const primaryRole = role === "head_coach" ? role : internal.contract.primaryRole;
        const annualSalary = calculateStaffSalaryDemand({
          salaryExpectation: internal.contract.annualSalary,
          reputation: internal.contract.reputation,
          roleRating: internal.rating,
          roleCount: roles.length,
          startSeason: input.currentSeason,
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
          season: input.currentSeason,
          effectiveOn: input.currentDate,
          roles,
          primaryRole,
        });
        if (next !== state) {
          state = next;
          if (activeIndex >= 0) searches[activeIndex] = { ...searches[activeIndex], status: "cancelled" };
          if (role === "head_coach") newsEvents.push({
            id: `staff-news:head-appointed:internal:${teamId}:${input.currentDate}:${internal.contract.staffId}`,
            kind: "head_coach_appointed",
            teamId,
            staffId: internal.contract.staffId,
            publishedOn: input.currentDate,
          });
          return;
        }
      }
      if (activeIndex >= 0) return;
      const interim = teamContracts()
        .map((contract) => ({ contract, score: interimPriority(contract, role) }))
        .filter((candidate) => candidate.score >= (role === "head_coach" ? 100 : 55))
        .sort((left, right) => right.score - left.score || left.contract.staffId.localeCompare(right.contract.staffId))[0]?.contract;
      const delay = role === "head_coach"
        ? 3 + hash(`${input.seed}:${teamId}:${role}:${input.currentDate}`) % 5
        : 5 + hash(`${input.seed}:${teamId}:${role}:${input.currentDate}`) % 6;
      const search: StaffRecruitmentSearch = {
        id: `${teamId}:${role}:${input.currentDate}`,
        teamId,
        role,
        openedOn: input.currentDate,
        decisionOn: addDaysToDateKey(input.currentDate, delay),
        status: "active",
        interimStaffId: interim?.staffId ?? null,
        appointedStaffId: null,
        attempts: 1,
      };
      searches.push(search);
      searchesStarted += 1;
      if (role === "head_coach") {
        newsEvents.push({
          id: `staff-news:head-vacancy:${search.id}`,
          kind: "head_coach_vacancy",
          teamId,
          staffId: interim?.staffId ?? null,
          publishedOn: input.currentDate,
        });
      }
    });
  });

  searches.forEach((search, index) => {
    if (search.status !== "active" || search.decisionOn > input.currentDate) return;
    const alreadyFilled = Object.values(state.contracts).some((contract) => (
      contract.status === "contracted" && contract.teamId === search.teamId && contract.roles.includes(search.role)
    ));
    if (alreadyFilled) {
      searches[index] = { ...search, status: "cancelled" };
      return;
    }
    const candidates = Object.values(state.contracts)
      .filter((contract) => contract.status === "free_agent" || (
        search.attempts >= 2 && contract.status === "contracted"
        && contract.teamId !== search.teamId
        && (input.delegateUserTeam || contract.teamId !== input.userTeamId)
      ))
      .filter((contract) => !releasedByTeamThisSeason(state, contract.staffId, search.teamId, input.currentSeason))
      .map((contract) => {
        const headCoach = Object.values(state.contracts).find((member) => (
          member.status === "contracted" && member.teamId === search.teamId && member.roles.includes("head_coach")
        ));
        const rating = roleRating(contract, search.role);
        const relationshipBonus = getStaffRelationshipRecruitmentBonus(headCoach?.staffSlug, contract.staffSlug);
        const destinationAffinity = getStaffClubAffinity(contract.affinityProfile, search.teamId);
        return { contract, rating, relationshipBonus, destinationAffinity, headCoach, recruitmentScore: rating + relationshipBonus + destinationAffinity * 0.12 };
      })
      .filter((candidate) => candidate.rating >= minimumRating(search.role))
      .filter((candidate) => isEligibleForAIRole(candidate.contract, search.role, candidate.rating))
      .sort((left, right) => (
        right.recruitmentScore - left.recruitmentScore
        || right.rating - left.rating
        || right.contract.potentialAbility - left.contract.potentialAbility
        || hash(`${input.seed}:${search.id}:${left.contract.staffId}`) - hash(`${input.seed}:${search.id}:${right.contract.staffId}`)
      ));
    let appointed: CareerStaffContract | null = null;
    for (const candidate of candidates) {
      const destinationContracts = Object.values(state.contracts).filter((contract) => (
        contract.status === "contracted" && contract.teamId === search.teamId
      ));
      const canMakeDualHire = destinationContracts.length >= getAITeamStaffRoleTargets(search.teamId).length - 1
        && hash(`${input.seed}:${search.teamId}:${search.role}:${candidate.contract.staffId}:dual-role`) % 100 < 20;
      const companionSearchIndex = canMakeDualHire ? searches.findIndex((candidateSearch) => (
        candidateSearch.status === "active"
        && candidateSearch.teamId === search.teamId
        && candidateSearch.id !== search.id
        && roleRating(candidate.contract, candidateSearch.role) >= 80
        && isEligibleForAIRole(candidate.contract, candidateSearch.role)
      )) : -1;
      const offeredRoles = [
        search.role,
        ...(companionSearchIndex >= 0 ? [searches[companionSearchIndex].role] : []),
      ].slice(0, 2);
      const endSeason = input.currentSeason + 1;
      const annualSalary = calculateStaffSalaryDemand({
        salaryExpectation: candidate.contract.annualSalary,
        reputation: candidate.contract.reputation,
        roleRating: candidate.rating,
        roleCount: offeredRoles.length,
        startSeason: input.currentSeason,
        endSeason,
        poaching: candidate.contract.status === "contracted",
        currentPrimaryRole: candidate.contract.primaryRole,
        offeredPrimaryRole: search.role,
      });
      if (candidate.contract.status === "contracted") {
        const remainingContractSeasons = candidate.contract.endSeason == null
          ? 1 : Math.max(0, candidate.contract.endSeason - input.currentSeason + 1);
        const interest = calculateStaffMoveInterest({
          loyalty: candidate.contract.loyalty,
          ambition: candidate.contract.ambition,
          adaptability: candidate.contract.adaptability,
          currentAffinity: getStaffClubAffinity(candidate.contract.affinityProfile, candidate.contract.teamId ?? ""),
          destinationAffinity: candidate.destinationAffinity,
          currentSalary: candidate.contract.annualSalary,
          offeredSalary: annualSalary,
          currentRoleRating: roleRating(candidate.contract, candidate.contract.primaryRole),
          offeredRoleRating: candidate.rating,
          currentPrimaryRole: candidate.contract.primaryRole,
          offeredPrimaryRole: search.role,
          remainingContractSeasons,
          sameCountryAsHeadCoach: Boolean(candidate.headCoach && candidate.headCoach.country !== "Unknown" && candidate.headCoach.country === candidate.contract.country),
          relationshipBonus: candidate.relationshipBonus,
        });
        if (!interest.interested) continue;
      }
      const transferInput = {
        staffId: candidate.contract.staffId,
        teamId: search.teamId,
        roles: offeredRoles,
        primaryRole: search.role,
        startSeason: input.currentSeason,
        endSeason,
        annualSalary,
        effectiveOn: input.currentDate,
      };
      const wasPoached = candidate.contract.status === "contracted";
      const previousTeamId = candidate.contract.teamId;
      const next = wasPoached ? poachCareerStaff(state, transferInput) : appointCareerStaff(state, transferInput);
      if (next === state) continue;
      state = next;
      appointed = state.contracts[candidate.contract.staffId];
      if (companionSearchIndex >= 0) searches[companionSearchIndex] = {
        ...searches[companionSearchIndex],
        status: "completed",
        appointedStaffId: candidate.contract.staffId,
      };
      if (wasPoached) newsEvents.push({
        id: `staff-news:poached:${candidate.contract.staffId}:${input.currentDate}:${search.teamId}`,
        kind: "staff_poached",
        teamId: search.teamId,
        sourceTeamId: previousTeamId,
        staffId: candidate.contract.staffId,
        publishedOn: input.currentDate,
      });
      break;
    }
    if (!appointed) {
      searches[index] = {
        ...search,
        decisionOn: addDaysToDateKey(input.currentDate, 14),
        attempts: search.attempts + 1,
      };
      retries += 1;
      return;
    }
    searches[index] = { ...search, status: "completed", appointedStaffId: appointed.staffId };
    appointments += 1;
    if (search.role === "head_coach") {
      const event: StaffNewsEvent = {
        id: `staff-news:head-appointed:${search.id}:${appointed.staffId}`,
        kind: "head_coach_appointed",
        teamId: search.teamId,
        staffId: appointed.staffId,
        publishedOn: input.currentDate,
      };
      newsEvents.push(event);
    }
  });

  state = { ...state, recruitmentSearches: searches, newsEvents };
  return { state, searchesStarted, appointments, retries };
}
