import assert from "node:assert/strict";
import { HEAD_COACH_SECONDARY_ROLES, staffRolesAreCompatible } from "../lib/logic/staffRoleRules";
import { initializeCareerStaffState, normalizeCareerStaffState, enforceHeadCoachSecondaryRoles, renewCareerStaffContract, validateCareerStaffState } from "../lib/logic/staffContracts";
import { processAIStaffMarket } from "../lib/logic/aiStaffMarket";

const seed = initializeCareerStaffState([{ id: "coach", slug: "coach", full_name: "Test Coach", primary_role: "head_coach", current_ability: 90, role_ratings: { head_coach: 90, batting_coach: 90, pace_bowling_coach: 90, spin_bowling_coach: 90, fielding_coach: 90, mentor: 95, assistant_coach: 95 }, salary_expectation: 20_000_000 }], [{ staff_id: "coach", team_id: "KKR", role: "head_coach", start_season: 2027 }], 2027);
for (const role of HEAD_COACH_SECONDARY_ROLES) {
  assert.equal(staffRolesAreCompatible(["head_coach", role]), true);
  const saved = structuredClone(seed);
  saved.contracts.coach.roles = ["head_coach", role];
  assert.deepEqual(normalizeCareerStaffState(saved).contracts.coach.roles, ["head_coach", role]);
}
for (const role of ["mentor", "assistant_coach", "coach", "wicketkeeping_coach"]) {
  assert.equal(staffRolesAreCompatible(["head_coach", role]), false);
  const saved = structuredClone(seed);
  saved.contracts.coach.roles = ["head_coach", role];
  const repaired = enforceHeadCoachSecondaryRoles(saved);
  assert.deepEqual(repaired.contracts.coach.roles, ["head_coach"]);
  assert.equal(repaired.contracts.coach.annualSalary, saved.contracts.coach.annualSalary);
  assert.equal(enforceHeadCoachSecondaryRoles(repaired), repaired, "repair must be idempotent");
  assert.deepEqual(normalizeCareerStaffState(saved).contracts.coach.roles, ["head_coach"]);
  assert.equal(renewCareerStaffContract(seed, { staffId: "coach", season: 2027, effectiveOn: "2027-06-01", annualSalary: 100_000_000, endSeason: null, primaryRole: "head_coach", roles: ["head_coach", role] }), seed, "contract writes must reject forbidden secondary roles");
}
assert.equal(staffRolesAreCompatible(["assistant_coach", "mentor"]), true, "other combinations are unchanged");
const reviewed = processAIStaffMarket({ state: seed, teamIds: ["KKR"], userTeamId: "CSK", completedSeason: 2027, seed: "head-coach-role-rules" }).state;
assert.ok(Object.values(reviewed.contracts).every(contract => staffRolesAreCompatible([contract.primaryRole, ...contract.roles])), "AI must obey the same restriction");
assert.deepEqual(validateCareerStaffState(reviewed), []);
console.log("Head coach roles verified: allowed specialities, forbidden roles, save repair, write rejection and AI recruitment.");
