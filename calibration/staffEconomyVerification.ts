import assert from "node:assert/strict";
import {
  calculateStaffSalaryDemand,
  createStaffNegotiationSession,
  evaluateStaffNegotiationRound,
  evaluateStaffContractOffer,
} from "../lib/logic/staffNegotiations";

const profile = {
  salaryExpectation: 30_000_000,
  reputation: 88,
  roleRating: 90,
  roleCount: 1,
  offeredRoles: ["head_coach"],
  offeredRoleRatings: { head_coach: 90, coach: 58, batting_coach: 92 },
  startSeason: 2032,
  endSeason: 2035,
  currentPrimaryRole: "head_coach",
  offeredPrimaryRole: "head_coach",
  loyalty: 80,
  ambition: 60,
  adaptability: 60,
};

const newContract = calculateStaffSalaryDemand(profile);
const renewal = calculateStaffSalaryDemand({
  ...profile,
  salaryExpectation: newContract,
  incumbentRenewal: true,
  currentRoleCount: 1,
});
assert.ok(renewal >= newContract * 0.97, "renewal must preserve the live-contract salary floor");

const cheapPrimary = calculateStaffSalaryDemand({
  ...profile,
  roleRating: 58,
  roleCount: 1,
  offeredRoles: ["coach"],
  offeredPrimaryRole: "coach",
});
const eliteSecondary = calculateStaffSalaryDemand({
  ...profile,
  roleRating: 58,
  roleCount: 2,
  offeredRoles: ["coach", "batting_coach"],
  offeredPrimaryRole: "coach",
});
assert.ok(eliteSecondary > cheapPrimary * 2, "an elite secondary speciality must be materially valued");

const lowball = evaluateStaffContractOffer({ ...profile, offeredSalary: newContract * 0.45, negotiationPatience: 90 });
assert.equal(lowball.outcome, "instant-rejected", "the old 45%-offer counter exploit must be closed");
assert.equal(lowball.counterOffer, null);

const credible = evaluateStaffContractOffer({ ...profile, offeredSalary: newContract * 0.9, negotiationPatience: 90 });
assert.equal(credible.outcome, "countered");
assert.ok((credible.counterOffer ?? 0) >= newContract * 0.91, "counter discounts must stay within the reservation band");

const sessionInput = {
  ...profile,
  staffId: "elite-head-coach",
  teamId: "MI",
  action: "hire" as const,
  openedOn: "2032-01-01",
};
const session = createStaffNegotiationSession(sessionInput);
const lowballRound = evaluateStaffNegotiationRound(session, {
  ...profile,
  currentDate: "2032-01-01",
  offeredPackage: { annualSalary: newContract * 0.51, primaryRole: "head_coach", roles: ["head_coach"], endSeason: 2035 },
});
assert.equal(lowballRound.outcome, "rejected", "a 51% opening must be rejected without exposing the reservation point");
assert.equal(lowballRound.counterPackage, null, "a non-credible offer must not reveal a numerical counter");
assert.ok(lowballRound.trustAfter < session.trust - 10, "an insulting opening must damage trust, not only patience");

const repeatedRound = evaluateStaffNegotiationRound(lowballRound.session, {
  ...profile,
  currentDate: "2032-01-02",
  offeredPackage: { annualSalary: newContract * 0.51, primaryRole: "head_coach", roles: ["head_coach"], endSeason: 2035 },
});
assert.ok(repeatedRound.patienceChange < lowballRound.patienceChange, "repeating unchanged terms must be punished more heavily");
assert.ok(repeatedRound.session.rounds.length === 2, "round history must remain part of the persisted session");

const credibleSession = createStaffNegotiationSession({ ...sessionInput, staffId: "credible-coach" });
const credibleRound = evaluateStaffNegotiationRound(credibleSession, {
  ...profile,
  currentDate: "2032-01-01",
  offeredPackage: { annualSalary: newContract * 0.9, primaryRole: "head_coach", roles: ["head_coach"], endSeason: 2035 },
});
assert.notEqual(credibleRound.outcome, "rejected", "credible complete packages should enter substantive talks");
assert.ok(credibleRound.counterPackage && credibleRound.counterPackage.annualSalary >= newContract * 0.9, "staff concessions must be limited and remain contract-valid");

const shortWeakPackage = evaluateStaffNegotiationRound(createStaffNegotiationSession({ ...sessionInput, staffId: "security-test" }), {
  ...profile,
  loyalty: 90,
  currentDate: "2032-01-01",
  offeredPackage: { annualSalary: newContract * 0.9, primaryRole: "coach", roles: ["coach"], endSeason: 2032 },
});
assert.ok(shortWeakPackage.signals.some((signal) => signal.includes("role") || signal.includes("security")), "role and security must affect feedback independently of salary");

console.log("Staff economy exploit checks passed.");
