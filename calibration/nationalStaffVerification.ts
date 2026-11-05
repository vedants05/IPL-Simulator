import assert from "node:assert/strict";
import {
  appointNationalHeadCoach,
  initializeCareerStaffState,
  maintainNationalHeadCoaches,
  poachCareerStaff,
  releaseCareerStaff,
  reviewNationalStaffContracts,
  processStaffContractExpiries,
  synchronizeCareerStaffProfiles,
  validateCareerStaffState,
  staffContractOfferIssue,
  staffPoachingCompensation,
  type StaffDirectoryMember,
} from "../lib/logic/staffContracts";
import { calculateStaffMoveInterest, calculateStaffSalaryDemand, createStaffNegotiationSession, evaluateStaffNegotiationRound } from "../lib/logic/staffNegotiations";
import { processAIStaffMarket } from "../lib/logic/aiStaffMarket";
import { NATIONAL_STAFF_SEEDS } from "../lib/data/nationalStaffSeeds";

const member = (slug: string, country: string, rating = 82): StaffDirectoryMember => ({
  id: slug, slug, full_name: slug, country, primary_role: "head_coach",
  current_ability: rating, role_ratings: { head_coach: rating },
  salary_expectation: 12_000_000,
});
const members = [
  member("gautam-gambhir", "India", 92),
  member("brendon-mccullum", "New Zealand", 91),
  member("stephen-fleming", "New Zealand", 90),
  member("zaheer-khan", "India", 85),
  member("eoin-morgan", "England", 82),
  { ...member("england-replacement", "England", 78), role_ratings: { head_coach: 78, batting_coach: 75 } },
  ...Object.keys(NATIONAL_STAFF_SEEDS)
    .filter((slug) => !["gautam-gambhir", "brendon-mccullum", "stephen-fleming"].includes(slug))
    .map((slug) => member(slug, "Unknown", 82)),
];
const assignments = [{ staff_id: "zaheer-khan", team_id: "CSK", role: "head_coach", start_season: 2026 }];
const initial = initializeCareerStaffState(members, assignments, 2026);
assert.deepEqual(validateCareerStaffState(initial), []);
for (const [slug, seed] of Object.entries(NATIONAL_STAFF_SEEDS)) {
  assert.equal(initial.contracts[slug].nationalTeamId, seed.countryId, `${slug} national side`);
  assert.equal(initial.contracts[slug].nationalFormat, seed.format, `${slug} format`);
  assert.deepEqual(initial.contracts[slug].roles, [seed.role], `${slug} coaching role`);
}
assert.equal(initial.contracts["gautam-gambhir"].nationalTeamId, "IND");
assert.equal(initial.contracts["brendon-mccullum"].nationalFormat, "t20");
assert.equal(initial.contracts["stephen-fleming"].nationalFormat, "test");
assert.equal(initial.contracts["zaheer-khan"].teamId, "CSK");
assert.equal(initial.contracts["eoin-morgan"].status, "free_agent");
const renewed = reviewNationalStaffContracts(initial, 2029, "2029-06-01");
assert.ok((renewed.contracts["gautam-gambhir"].endSeason ?? 0) > 2029, "national contracts must be renewable");
const weakNational = structuredClone(initial);
weakNational.contracts["stephen-fleming"].roleRatings.head_coach = 60;
const expired = processStaffContractExpiries(reviewNationalStaffContracts(weakNational, 2029, "2029-06-01"), 2029);
assert.equal(expired.contracts["stephen-fleming"].status, "free_agent", "an unrenewed national contract must expire");
const annualReview = processAIStaffMarket({ state: weakNational, teamIds: [], userTeamId: "CSK", completedSeason: 2029, seed: "national-staff-test" });
assert.equal(annualReview.state.contracts["stephen-fleming"].status, "free_agent", "the annual staff review must process national expiries");
assert.ok((annualReview.state.contracts["gautam-gambhir"].endSeason ?? 0) > 2029, "the annual review must renew an eligible national coach");

const previousSave = structuredClone(initial);
previousSave.nationalStaffSeedRevision = 0;
for (const slug of ["gautam-gambhir", "brendon-mccullum", "stephen-fleming"]) {
  previousSave.contracts[slug] = {
    ...previousSave.contracts[slug], status: "free_agent", nationalTeamId: null,
    nationalFormat: null, roles: [], teamId: null,
  };
}
previousSave.contracts["brendon-mccullum"] = {
  ...previousSave.contracts["brendon-mccullum"], status: "contracted", teamId: "RR", roles: ["head_coach"],
};
previousSave.contracts["gautam-gambhir"].roleRatings.head_coach = 94;
previousSave.contracts["gautam-gambhir"].lastDevelopedSeason = 2027;
const migrated = synchronizeCareerStaffProfiles(previousSave, members, assignments, 2028);
assert.equal(migrated.contracts["gautam-gambhir"].nationalTeamId, "IND");
assert.equal(migrated.contracts["gautam-gambhir"].roleRatings.head_coach, 94, "migration must preserve developed ability");
assert.equal(migrated.contracts["stephen-fleming"].nationalFormat, "test");
assert.equal(migrated.contracts["brendon-mccullum"].teamId, "RR", "existing career moves must survive migration");
assert.equal(migrated.contracts["sitanshu-kotak"].primaryRole, "batting_coach", "migration must retain specialist roles");
assert.equal(migrated.contracts["morne-morkel"].primaryRole, "pace_bowling_coach");

const revisionOneSave = structuredClone(initial);
revisionOneSave.nationalStaffSeedRevision = 1;
for (const slug of Object.keys(NATIONAL_STAFF_SEEDS).filter((id) => !["gautam-gambhir", "brendon-mccullum", "stephen-fleming"].includes(id))) {
  revisionOneSave.contracts[slug] = {
    ...revisionOneSave.contracts[slug], status: "free_agent", nationalTeamId: null,
    nationalFormat: null, roles: [], teamId: null,
  };
}
const expanded = synchronizeCareerStaffProfiles(revisionOneSave, members, assignments, 2028);
assert.equal(expanded.contracts["andrew-mcdonald"].nationalTeamId, "AUS");
assert.equal(expanded.contracts["sitanshu-kotak"].primaryRole, "batting_coach");
assert.equal(expanded.contracts["morne-morkel"].primaryRole, "pace_bowling_coach");
assert.deepEqual(validateCareerStaffState(expanded), []);

const salaryOffer = {
  salaryExpectation: 18_000_000, reputation: 90, roleRating: 85, roleCount: 1,
  offeredRoles: ["head_coach"], startSeason: 2028, endSeason: 2030, poaching: true,
};
assert.ok(calculateStaffSalaryDemand({ ...salaryOffer, nationalTeamAppointment: true })
  > calculateStaffSalaryDemand(salaryOffer), "national duty must modestly increase salary demand");
const moveOffer = {
  loyalty: 65, ambition: 65, adaptability: 65, currentAffinity: 45, destinationAffinity: 50,
  currentSalary: 15_000_000, offeredSalary: 30_000_000, currentRoleRating: 85,
  offeredRoleRating: 85, currentPrimaryRole: "head_coach", offeredPrimaryRole: "head_coach",
  remainingContractSeasons: 1,
};
assert.ok(calculateStaffMoveInterest({ ...moveOffer, nationalTeamAppointment: true }).score
  < calculateStaffMoveInterest(moveOffer).score, "national duty must lower willingness to leave");

const vacant = releaseCareerStaff(initial, "brendon-mccullum", "staff_resigned", 2027, "2027-06-01");
assert.equal(vacant.contracts["brendon-mccullum"].status, "free_agent");
const refilled = maintainNationalHeadCoaches(vacant, 2028, "2028-06-01");
assert.equal(Object.values(refilled.contracts).filter((contract) => contract.nationalTeamId === "ENG"
  && contract.nationalFormat === "t20" && contract.roles.includes("head_coach")).length, 1);
for (const slug of ["kevin-pietersen", "marcus-trescothick", "sarah-taylor", "troy-cooley"]) {
  assert.equal(initial.contracts[slug].nationalTeamId, "ENG", `${slug} should start with England`);
}
assert.equal(initial.contracts["daniel-vettori"]?.nationalTeamId ?? null, null);
assert.equal(refilled.contracts["stephen-fleming"].nationalFormat, "test");
assert.deepEqual(validateCareerStaffState(refilled), []);
const specialistVacancy = releaseCareerStaff(initial, "sitanshu-kotak", "staff_resigned", 2027, "2027-06-01");
const specialistRefilled = maintainNationalHeadCoaches(specialistVacancy, 2028, "2028-06-01");
assert.ok(Object.values(specialistRefilled.contracts).some((contract) => contract.nationalTeamId === "IND"
  && contract.roles.includes("batting_coach")), "the national review must refill a specialist post");
assert.equal(specialistRefilled.contracts["gautam-gambhir"].nationalTeamId, "IND");
assert.equal(appointNationalHeadCoach(refilled, "eoin-morgan", "ENG", "t20", 2028, "2028-06-02"), refilled,
  "a national side must not receive a second T20 head coach");

const approachable = structuredClone(initial);
approachable.contracts["gautam-gambhir"].loyalty = 30;
approachable.contracts["gautam-gambhir"].annualSalary = 10_000_000;
approachable.contracts["gautam-gambhir"].affinityProfile.clubs = [{ teamId: "KKR", strength: 97, reasons: ["played"] }];
approachable.financesByTeam.KKR = { annualBudget: 500_000_000, committedSalary: 0, compensationPaid: 0, compensationReceived: 0 };
const poachingSalary = calculateStaffSalaryDemand({
  salaryExpectation: 10_000_000, reputation: 50, roleRating: 92, roleCount: 1,
  offeredRoles: ["head_coach"], startSeason: 2027, endSeason: 2030,
  poaching: true, nationalTeamAppointment: true, currentPrimaryRole: "head_coach", offeredPrimaryRole: "head_coach",
  loyalty: 30, ambition: 70, adaptability: 70,
});
const poached = poachCareerStaff(approachable, {
  staffId: "gautam-gambhir", teamId: "KKR", roles: ["head_coach"], primaryRole: "head_coach",
  startSeason: 2027, endSeason: 2030, annualSalary: poachingSalary * 1.2, effectiveOn: "2027-06-01",
});
assert.notEqual(poached, approachable, "a strong enough offer must be able to recruit national staff");
assert.equal(poached.contracts["gautam-gambhir"].teamId, "KKR");
assert.equal(poached.contracts["gautam-gambhir"].nationalTeamId, null);
assert.deepEqual(validateCareerStaffState(poached), []);

const reluctant = structuredClone(initial);
const reluctantCoach = reluctant.contracts["gautam-gambhir"];
reluctantCoach.loyalty = 100;
reluctantCoach.ambition = 0;
reluctantCoach.adaptability = 0;
reluctantCoach.affinityProfile.clubs = [];
reluctant.financesByTeam.KKR = { annualBudget: 1_000_000_000, committedSalary: 0, compensationPaid: 0, compensationReceived: 0 };
const agreedOffer = { annualSalary: poachingSalary * 3, primaryRole: "head_coach", roles: ["head_coach"], endSeason: 2030 };
const moveInput = { ...agreedOffer, staffId: reluctantCoach.staffId, teamId: "KKR", startSeason: 2027, effectiveOn: "2027-06-01" };
assert.equal(poachCareerStaff(reluctant, moveInput), reluctant, "personal resistance should apply before an agreement");
const agreedProfile = { salaryExpectation: reluctantCoach.annualSalary, reputation: reluctantCoach.reputation, roleRating: 92, roleCount: 1, startSeason: 2027, endSeason: 2030 };
const liveTalks = createStaffNegotiationSession({ ...agreedProfile, staffId: reluctantCoach.staffId, teamId: "KKR", action: "poach", openedOn: "2027-06-01" });
const agreement = evaluateStaffNegotiationRound({ ...liveTalks, latestCounter: agreedOffer }, { ...agreedProfile, currentDate: "2027-06-01", offeredPackage: agreedOffer });
reluctant.activeNegotiations[reluctantCoach.staffId] = agreement.session;
assert.equal(poachCareerStaff(reluctant, moveInput).contracts[reluctantCoach.staffId].teamId, "KKR", "contract completion must honour a negotiated agreement");
const overBudget = structuredClone(reluctant);
overBudget.financesByTeam.KKR.annualBudget = 1;
assert.equal(poachCareerStaff(overBudget, moveInput), overBudget, "an agreement must not bypass the club budget");
console.log("National staff checks passed, including accepted package completion and budget protection.");

// A club transfer must budget for compensation as well as the visible annual wage.
const clubTransfer = structuredClone(reluctant);
const clubCoach = clubTransfer.contracts["zaheer-khan"];
clubCoach.annualSalary = 20_000_000;
clubCoach.endSeason = null;
clubTransfer.financesByTeam.KKR = { annualBudget: 55_700_000, committedSalary: 0, compensationPaid: 0, compensationReceived: 0 };
const blockedOffer = { staffId: clubCoach.staffId, teamId: "KKR", action: "poach" as const, season: 2027, date: "2027-06-01", primaryRole: "head_coach", roles: ["head_coach"], annualSalary: 49_000_000, endSeason: null };
assert.equal(staffPoachingCompensation(clubCoach, 2027), 20_000_000);
assert.match(staffContractOfferIssue(clubTransfer, blockedOffer) ?? "", /transfer compensation/);
assert.match(staffContractOfferIssue(clubTransfer, blockedOffer) ?? "", /₹6,90,00,000/);
assert.equal(staffContractOfferIssue(clubTransfer, { ...blockedOffer, annualSalary: 35_700_000 }), null, "salary plus compensation may exactly equal the budget");
clubCoach.endSeason = 2029;
assert.equal(staffPoachingCompensation(clubCoach, 2027), 60_000_000, "fixed contracts charge all remaining seasons");
assert.equal(staffPoachingCompensation(reluctant.contracts["gautam-gambhir"], 2027), 0, "national appointments have no club compensation");
console.log("Transfer validation checks passed: hidden-fee reproduction, exact budget boundary, rolling/fixed fees and national appointments.");
