import assert from "node:assert/strict";
import test from "node:test";

import type { Player, Team } from "@/lib/types";

import {
  appointAiTeamLeadership,
  hasConsecutiveFranchiseSeasons,
  reconcileAiLeagueLeadership,
  type AiLeagueLeadership,
} from "./aiLeadership";
import { buildAiMatchLineups } from "./aiLineupSelector";

const teamId = "TEST";
const season = 2027;

const history = (years: number) => Array.from({ length: years }, (_, offset) => ({
  teamId,
  season: String(season - offset),
  price: 500,
}));

const player = (
  id: string,
  role: Player["role"],
  batting: number,
  bowling: number,
  overrides: Partial<Player> = {},
): Player => ({
  id,
  name: id,
  age: 30,
  nationality: "Indian",
  role,
  currentTeamId: teamId,
  currentBatting: batting,
  currentBowling: bowling,
  potentialBatting: batting,
  potentialBowling: bowling,
  reputation: 6,
  captaincy: 55,
  isOpener: false,
  isWicketkeeper: role === "WK-Batsman",
  isPartTimeWk: false,
  onlyOpensOrBenched: false,
  isIplCaptaincyUnavailable: false,
  iplHistory: [],
  ...overrides,
} as Player);

const squad = [
  player("indian-veteran", "Batsman", 82, 5, {
    captaincy: 78,
    isOpener: true,
    iplHistory: history(3),
  }),
  player("second-opener", "Batsman", 84, 5, { isOpener: true }),
  player("keeper", "WK-Batsman", 83, 0),
  player("overseas-leader", "Batsman", 85, 5, {
    nationality: "Overseas",
    captaincy: 95,
    reputation: 9,
  }),
  player("young-successor", "All-Rounder", 80, 75, {
    age: 26,
    captaincy: 70,
    potentialBatting: 89,
    iplHistory: history(3),
  }),
  player("second-best-leader", "All-Rounder", 81, 78, { captaincy: 90 }),
  player("pace-one", "Pace Bowler", 22, 88),
  player("pace-two", "Pace Bowler", 24, 84, { nationality: "Overseas" }),
  player("spin-one", "Spin Bowler", 30, 86),
  player("spin-two", "Spin Bowler", 32, 81),
  player("support-ar", "All-Rounder", 76, 79),
  player("extra-batter", "Batsman", 79, 4),
  player("unavailable-star", "Batsman", 86, 4, {
    captaincy: 100,
    isIplCaptaincyUnavailable: true,
  }),
  player("weak-leader", "Batsman", 55, 2, { captaincy: 99 }),
];

const team = {
  id: teamId,
  name: "Test Team",
  shortName: "TST",
  squad: squad.map((candidate) => candidate.id),
} as Team;

test("three consecutive franchise seasons include the active season", () => {
  const veteran = squad.find((candidate) => candidate.id === "indian-veteran")!;
  assert.equal(hasConsecutiveFranchiseSeasons(veteran, teamId, season), true);
  assert.equal(hasConsecutiveFranchiseSeasons(
    { ...veteran, iplHistory: veteran.iplHistory.filter((entry) => entry.season !== "2026") },
    teamId,
    season,
  ), false);
});

test("an established Indian starter rated 75+ for captaincy takes priority", () => {
  const organic = buildAiMatchLineups(squad, { useProvisionalCaptain: false });
  const commonIds = organic.battingFirst.startingXI.filter((id) => organic.bowlingFirst.startingXI.includes(id));
  assert.ok(commonIds.includes("indian-veteran"));
  assert.ok(commonIds.includes("overseas-leader"));
  assert.ok(!commonIds.includes("weak-leader"));

  const appointment = appointAiTeamLeadership(team, squad, season);
  assert.equal(appointment.captainId, "indian-veteran");
  assert.equal(appointment.captainReason, "indian-three-year-leader");
  assert.notEqual(appointment.captainId, "unavailable-star");
  assert.notEqual(appointment.viceCaptainId, "unavailable-star");
});

test("a sole eligible starter rated above 86 for captaincy overrides the franchise preference", () => {
  const soleEliteLeaderSquad = squad.map((candidate) => (
    candidate.id === "second-best-leader"
      ? { ...candidate, captaincy: 86 }
      : candidate
  ));
  const appointment = appointAiTeamLeadership(
    { ...team, squad: soleEliteLeaderSquad.map((candidate) => candidate.id) },
    soleEliteLeaderSquad,
    season,
  );

  assert.equal(appointment.captainId, "overseas-leader");
  assert.equal(appointment.captainReason, "sole-elite-leader");
});

test("a young three-year franchise successor takes vice-captaincy over the second-ranked leader", () => {
  const appointment = appointAiTeamLeadership(team, squad, season);
  assert.equal(appointment.viceCaptainId, "young-successor");
  assert.equal(appointment.viceCaptainReason, "franchise-successor");

  const finalPlans = buildAiMatchLineups(squad, {
    captainId: appointment.captainId,
    viceCaptainId: appointment.viceCaptainId,
  });
  for (const plan of [finalPlans.battingFirst, finalPlans.bowlingFirst]) {
    assert.ok(plan.startingXI.includes("indian-veteran"));
    assert.ok(plan.startingXI.includes("young-successor"));
    assert.notEqual(plan.impactPlayerId, "indian-veteran");
    assert.notEqual(plan.impactPlayerId, "young-successor");
  }
});

test("a franchise youngster needs at least 60 captaincy to receive the succession preference", () => {
  const lowCaptaincySuccessorSquad = squad.map((candidate) => (
    candidate.id === "young-successor"
      ? { ...candidate, captaincy: 59 }
      : candidate
  ));
  const appointment = appointAiTeamLeadership(
    { ...team, squad: lowCaptaincySuccessorSquad.map((candidate) => candidate.id) },
    lowCaptaincySuccessorSquad,
    season,
  );

  assert.equal(appointment.viceCaptainId, "overseas-leader");
  assert.equal(appointment.viceCaptainReason, "second-best-current-leader");
});

test("the franchise youngster succession preference is restricted to Indian players", () => {
  const overseasSuccessorSquad = squad.map((candidate) => (
    candidate.id === "young-successor"
      ? { ...candidate, nationality: "Overseas" as const }
      : candidate
  ));
  const appointment = appointAiTeamLeadership(
    { ...team, squad: overseasSuccessorSquad.map((candidate) => candidate.id) },
    overseasSuccessorSquad,
    season,
  );

  assert.equal(appointment.viceCaptainId, "overseas-leader");
  assert.equal(appointment.viceCaptainReason, "second-best-current-leader");
});

test("without tenure exceptions, current captaincy, reputation, and CA decide leadership", () => {
  const noTenureSquad = squad.map((candidate) => ({
    ...candidate,
    iplHistory: [],
    potentialBatting: candidate.currentBatting,
    potentialBowling: candidate.currentBowling,
  }));
  const appointment = appointAiTeamLeadership(
    { ...team, squad: noTenureSquad.map((candidate) => candidate.id) },
    noTenureSquad,
    season,
  );

  assert.equal(appointment.captainId, "overseas-leader");
  assert.equal(appointment.captainReason, "best-current-leader");
  assert.equal(appointment.viceCaptainId, "second-best-leader");
  assert.equal(appointment.viceCaptainReason, "second-best-current-leader");
});

test("a saved in-season appointment is not recalculated", () => {
  const saved: AiLeagueLeadership = {
    [teamId]: {
      teamId,
      season,
      captainId: "second-best-leader",
      viceCaptainId: "keeper",
      captainReason: "best-current-leader",
      viceCaptainReason: "second-best-current-leader",
    },
  };
  const reconciled = reconcileAiLeagueLeadership(
    saved,
    { [teamId]: team },
    Object.fromEntries(squad.map((candidate) => [candidate.id, candidate])),
    "USER",
    season,
  );

  assert.deepEqual(reconciled[teamId], saved[teamId]);
});
