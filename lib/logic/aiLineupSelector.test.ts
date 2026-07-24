import assert from "node:assert/strict";
import test from "node:test";

import type { Player } from "@/lib/types";

import {
  buildAiMatchLineups,
  currentAbility,
  isAiBowlingOption,
  isGenuineBatter,
  isImpactPlayerWithinOverseasLimit,
  isSpecialistBowler,
  maxSpecialistBowlersFor,
  MIN_GENUINE_BATTERS,
  isSuperstarYoungster,
} from "./aiLineupSelector";

const player = (
  id: string,
  role: Player["role"],
  batting: number,
  bowling: number,
  overrides: Partial<Player> = {},
): Player => ({
  id,
  name: id,
  age: 29,
  nationality: "Indian",
  role,
  battingStyle: "Right-hand",
  bowlingStyle: role === "Spin Bowler" ? "Spinner" : role === "Pace Bowler" || role === "All-Rounder" ? "Pacer" : null,
  bowlingHand: role === "Batsman" || role === "WK-Batsman" ? null : "Right-hand",
  careerStats: {
    batting: { matches: 0, innings: 0, runs: 0, average: 0, strikeRate: 0, fifties: 0, hundreds: 0 },
    bowling: { matches: 0, wickets: 0, economy: 0, average: 0, bestFigures: "0/0" },
  },
  iplStats: {
    matches: 0,
    runs: 0,
    battingAverage: 0,
    strikeRate: 0,
    bowlingInnings: 0,
    bowlingAverage: 0,
    wickets: 0,
  },
  iplHistory: [],
  basePrice: 50,
  isCapped: true,
  isRetained: false,
  retainedByTeamId: null,
  currentTeamId: "TEST",
  potential: "Established",
  currentBatting: batting,
  potentialBatting: batting,
  currentBowling: bowling,
  potentialBowling: bowling,
  reputation: 5,
  captaincy: 50,
  ...overrides,
});

const squad = [
  player("travis-head", "Batsman", 88, 8, {
    nationality: "Overseas",
    isOpener: true,
    captaincy: 92,
  }),
  player("abhishek-sharma", "All-Rounder", 84, 65, { isOpener: true }),
  player("keeper", "WK-Batsman", 82, 0, { isWicketkeeper: true, isCoreBatter: true, hasBattedAt3: true }),
  player("elite-ar", "All-Rounder", 80, 81, { isCoreBatter: true, hasBattedAt4: true }),
  player("elite-pace", "Pace Bowler", 25, 87),
  player("elite-pace-os", "Pace Bowler", 24, 84, { nationality: "Overseas" }),
  player("elite-spin", "Spin Bowler", 32, 85),
  player("elite-spin-two", "Spin Bowler", 34, 80),
  player("franchise-icon", "Batsman", 65, 5, { reputation: 10, isCoreBatter: true, hasBattedAt5: true }),
  player("superstar-youngster", "Batsman", 74, 5, {
    age: 20,
    potential: "Wonderkid",
    potentialBatting: 92,
    isCoreBatter: true,
  }),
  player("extra-batter", "Batsman", 79, 5, { isFinisher: true, hasBattedAt6: true }),
  player("extra-ar", "All-Rounder", 76, 79),
  player("extra-bowler", "Spin Bowler", 28, 78),
  player("reserve", "Batsman", 70, 5),
];

const selectedPlayers = (ids: readonly string[]) => (
  ids.map((id) => squad.find((candidate) => candidate.id === id)!)
);

test("AI match plans obey hard balance rules and preserve the established opener partnership", () => {
  const plans = buildAiMatchLineups(squad);

  for (const plan of [plans.battingFirst, plans.bowlingFirst]) {
    const selected = selectedPlayers(plan.startingXI);
    const impactPlayer = squad.find((candidate) => candidate.id === plan.impactPlayerId);
    assert.equal(selected.length, 11);
    assert.equal(new Set(plan.startingXI).size, 11);
    assert.ok(selected.filter((candidate) => candidate.nationality === "Overseas").length <= 4);
    assert.ok(selected.some((candidate) => candidate.role === "WK-Batsman" || candidate.isWicketkeeper));
    assert.ok(selected.filter(isAiBowlingOption).length >= 5);
    assert.ok(selected.filter(isGenuineBatter).length >= MIN_GENUINE_BATTERS);
    assert.ok(selected.filter(isSpecialistBowler).length <= maxSpecialistBowlersFor(selected));
    assert.ok(!impactPlayer || isImpactPlayerWithinOverseasLimit(selected, impactPlayer));
    assert.deepEqual(plan.startingXI.slice(0, 2), ["travis-head", "abhishek-sharma"]);
  }
});

test("an overseas impact player cannot become a fifth overseas player in the match plan", () => {
  const fourOverseasStarters = [
    player("os-one", "Batsman", 82, 0, { nationality: "Overseas" }),
    player("os-two", "WK-Batsman", 81, 0, { nationality: "Overseas" }),
    player("os-three", "All-Rounder", 76, 78, { nationality: "Overseas" }),
    player("os-four", "Pace Bowler", 30, 82, { nationality: "Overseas" }),
    ...squad.filter((candidate) => candidate.nationality === "Indian").slice(0, 7),
  ];
  const overseasImpact = player("os-impact", "Spin Bowler", 30, 84, { nationality: "Overseas" });
  const indianImpact = player("indian-impact", "Spin Bowler", 30, 75);

  assert.equal(isImpactPlayerWithinOverseasLimit(fourOverseasStarters, overseasImpact), false);
  assert.equal(isImpactPlayerWithinOverseasLimit(fourOverseasStarters, indianImpact), true);
});

test("AI impact selection uses an Indian reserve when the starting XI already has four overseas players", () => {
  const overseasHeavySquad = squad.map((candidate) => {
    if (["keeper", "elite-spin", "extra-bowler"].includes(candidate.id)) {
      return { ...candidate, nationality: "Overseas" as const };
    }
    if (candidate.id === "extra-ar") {
      return { ...candidate, currentBowling: 70, potentialBowling: 70 };
    }
    return candidate;
  });
  const plan = buildAiMatchLineups(overseasHeavySquad).battingFirst;
  const starters = plan.startingXI.map(
    (playerId) => overseasHeavySquad.find((candidate) => candidate.id === playerId)!,
  );
  const impactPlayer = overseasHeavySquad.find((candidate) => candidate.id === plan.impactPlayerId);

  assert.equal(starters.filter((candidate) => candidate.nationality === "Overseas").length, 4);
  assert.ok(impactPlayer);
  assert.equal(impactPlayer.nationality, "Indian");
});

test("batting orders place core batters before finishers and the specialist tail", () => {
  const plan = buildAiMatchLineups(squad).battingFirst;
  const selected = selectedPlayers(plan.startingXI);
  const coreIndices = selected
    .map((candidate, index) => candidate.isCoreBatter && !candidate.isFinisher ? index : -1)
    .filter((index) => index >= 2);
  const finisherIndex = selected.findIndex((candidate) => candidate.id === "extra-batter");
  const firstSpecialistBowlerIndex = selected.findIndex(isSpecialistBowler);

  assert.ok(coreIndices.length > 0);
  assert.ok(finisherIndex > Math.max(...coreIndices));
  assert.ok(firstSpecialistBowlerIndex > finisherIndex);
});

test("the specialist-bowler cap tightens when all-rounders provide more balance", () => {
  const ordinaryAllRounder = player("ordinary-ar", "All-Rounder", 72, 70);
  const eliteAllRounder = player("elite-bowling-ar", "All-Rounder", 76, 82);

  assert.equal(maxSpecialistBowlersFor([]), 5);
  assert.equal(maxSpecialistBowlersFor([ordinaryAllRounder, eliteAllRounder]), 4);
  assert.equal(maxSpecialistBowlersFor([
    ordinaryAllRounder,
    eliteAllRounder,
    player("ar-three", "All-Rounder", 73, 72),
    player("ar-four", "All-Rounder", 71, 69),
  ]), 3);
});

test("reputation 10, the provisional captain, and superstar youngsters are protected", () => {
  const plans = buildAiMatchLineups(squad);
  const playersRatedAtLeast80 = squad.filter((candidate) => currentAbility(candidate) >= 80);

  assert.equal(plans.battingFirst.captainId, "travis-head");
  assert.equal(plans.battingFirst.usesProvisionalCaptain, true);
  assert.equal(isSuperstarYoungster(squad.find((candidate) => candidate.id === "superstar-youngster")!), true);

  for (const plan of [plans.battingFirst, plans.bowlingFirst]) {
    assert.ok(plan.startingXI.includes("franchise-icon"));
    assert.ok(plan.startingXI.includes("travis-head"));
    assert.ok(plan.startingXI.includes("superstar-youngster"));
    playersRatedAtLeast80.forEach((candidate) => assert.ok(
      plan.startingXI.includes(candidate.id),
      `${candidate.id} was displaced despite having CA ${currentAbility(candidate)}`,
    ));
  }
});

test("bat-first and bowl-first plans use complementary impact profiles even when balance requires the same XI", () => {
  const plans = buildAiMatchLineups(squad);
  const battingImpact = squad.find((candidate) => candidate.id === plans.battingFirst.impactPlayerId);
  const bowlingImpact = squad.find((candidate) => candidate.id === plans.bowlingFirst.impactPlayerId);

  assert.ok(battingImpact && isAiBowlingOption(battingImpact));
  assert.ok(bowlingImpact && bowlingImpact.currentBatting >= 68);
  assert.equal(plans.battingFirst.startingXI.includes("extra-batter"), true);
  assert.equal(plans.bowlingFirst.startingXI.includes("extra-batter"), true);
});

test("designated leadership replaces the provisional choice and remains in both XIs", () => {
  const plans = buildAiMatchLineups(squad, {
    captainId: "extra-ar",
    viceCaptainId: "extra-batter",
  });

  for (const plan of [plans.battingFirst, plans.bowlingFirst]) {
    assert.equal(plan.captainId, "extra-ar");
    assert.equal(plan.viceCaptainId, "extra-batter");
    assert.equal(plan.usesProvisionalCaptain, false);
    assert.ok(plan.startingXI.includes("extra-ar"));
    assert.ok(plan.startingXI.includes("extra-batter"));
  }
});
