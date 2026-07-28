import assert from "node:assert/strict";
import test from "node:test";

import type { Player } from "@/lib/types";

import {
  buildAiMatchLineups,
  applyBowlingFirstImpactFinisherRule,
  resolveBowlingFirstImpactPlayer,
  currentAbility,
  isAiBowlingOption,
  isGenuineBatter,
  isImpactPlayerWithinOverseasLimit,
  isSpecialistBowler,
  maxSpecialistBowlersFor,
  MIN_GENUINE_BATTERS,
  isSuperstarYoungster,
  orderStartingXI,
  findOptimalImpactBattingPosition,
  selectBattingFirstImpactBowler,
  selectBattingFirstOutgoingBatter,
} from "./aiLineupSelector";
import { buildAutomaticLineupSelection } from "./automaticLineupBuilder";

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

type LineupFixturePlayer = Pick<
  Player,
  "id" | "name" | "role" | "currentBatting" | "currentBowling"
> & Partial<Player>;

const lineupFixturePlayers = (players: LineupFixturePlayer[]): Player[] => (
  players.map((candidate) => player(
    candidate.id,
    candidate.role,
    candidate.currentBatting,
    candidate.currentBowling,
    candidate,
  ))
);

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

test("the canonical auto-build creates both season-entry XIs and impact benches", () => {
  const completeSquad = [
    ...squad,
    player("reserve-two", "Pace Bowler", 20, 72),
    player("reserve-three", "Batsman", 68, 5),
    player("reserve-four", "All-Rounder", 64, 66),
    player("reserve-five", "Spin Bowler", 24, 70),
  ];
  const selection = buildAutomaticLineupSelection(completeSquad, {
    captainId: "travis-head",
    viceCaptainId: "keeper",
    useProvisionalCaptain: false,
  });

  assert.equal(selection.battingFirstXI.length, 11);
  assert.equal(selection.bowlingFirstXI.length, 11);
  assert.equal(selection.battingFirstImpactSubs.length, 5);
  assert.equal(selection.bowlingFirstImpactSubs.length, 5);
  assert.ok(selection.battingFirstXI.includes("travis-head"));
  assert.ok(selection.battingFirstXI.includes("keeper"));
  assert.ok(selection.bowlingFirstXI.includes("travis-head"));
  assert.ok(selection.bowlingFirstXI.includes("keeper"));
  assert.ok(selection.battingFirstImpactSubs.every((id) => !selection.battingFirstXI.includes(id)));
  assert.ok(selection.bowlingFirstImpactSubs.every((id) => !selection.bowlingFirstXI.includes(id)));
});

test("bat-first auto impact brings in the best bowler and removes the lowest eligible batter", () => {
  const starters = [
    player("captain", "Batsman", 70, 5),
    player("vice", "Batsman", 68, 5),
    player("keeper-low", "WK-Batsman", 40, 0, { isWicketkeeper: true }),
    player("icon-low", "Batsman", 42, 0, { reputation: 10 }),
    player("eligible-low", "Batsman", 55, 0),
    player("eligible-high", "All-Rounder", 76, 70),
  ];
  const impactBench = [
    player("weaker-bowler", "Pace Bowler", 15, 76),
    player("best-bowler", "Spin Bowler", 12, 88),
    player("bench-batter", "Batsman", 90, 0),
  ];
  const protectedIds = new Set(["captain", "vice"]);

  assert.equal(selectBattingFirstImpactBowler(impactBench)?.id, "best-bowler");
  assert.equal(selectBattingFirstOutgoingBatter(starters, protectedIds)?.id, "eligible-low");
});

test("bat-first auto protects the captain and only keeper before choosing the weakest non-required all-rounder", () => {
  const starters = [
    player("finn-allen", "WK-Batsman", 86, 0, { isWicketkeeper: true, isOpener: true }),
    player("venkatesh-iyer", "All-Rounder", 81, 66),
    player("sunil-narine", "All-Rounder", 88, 86),
    player("rinku-singh", "Batsman", 86, 0),
    player("marcus-stoinis", "All-Rounder", 82, 71),
    player("jacob-bethell", "All-Rounder", 82, 69),
    player("riyan-parag", "All-Rounder", 80, 68),
    player("naman-dhir", "All-Rounder", 79, 60),
    player("harshit-rana", "Pace Bowler", 25, 84),
    player("varun-chakravarthy", "Spin Bowler", 20, 91),
    player("prasidh-krishna", "Pace Bowler", 15, 82),
  ];

  assert.equal(
    selectBattingFirstOutgoingBatter(starters, new Set(["rinku-singh"]))?.id,
    "naman-dhir",
  );
});

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
    assert.ok(selected.filter(isGenuineBatter).length >= (plan === plans.bowlingFirst ? 4 : MIN_GENUINE_BATTERS));
    assert.ok(selected.filter(isSpecialistBowler).length <= maxSpecialistBowlersFor(selected));
    assert.ok(!impactPlayer || isImpactPlayerWithinOverseasLimit(selected, impactPlayer));
    assert.deepEqual(plan.startingXI.slice(0, 2), ["travis-head", "abhishek-sharma"]);
  }
});

test("a competing keeper-opener cannot split the Head and Abhishek special partnership", () => {
  const srhLikeSquad = [
    ...squad.map((candidate) => {
      if (candidate.id === "travis-head") {
        return { ...candidate, currentBatting: 89, potentialBatting: 89 };
      }
      if (candidate.id === "abhishek-sharma") {
        return { ...candidate, currentBatting: 90, potentialBatting: 93 };
      }
      return candidate;
    }),
    player("ishan-kishan", "WK-Batsman", 88, 0, {
      isWicketkeeper: true,
      isOpener: true,
    }),
  ];

  const plans = buildAiMatchLineups(srhLikeSquad);
  for (const plan of [plans.battingFirst, plans.bowlingFirst]) {
    assert.deepEqual(plan.startingXI.slice(0, 2), ["travis-head", "abhishek-sharma"]);
    assert.notEqual(plan.impactPlayerId, "travis-head");
    assert.notEqual(plan.impactPlayerId, "abhishek-sharma");
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
  assert.ok(plans.bowlingFirst.startingXI.includes("extra-batter") || plans.bowlingFirst.impactPlayerId === "extra-batter");
});

test("bowl-first impact swaps a weak middle-order batter for the highest-rated finisher at eight", () => {
  const startingXI = [
    squad.find((candidate) => candidate.id === "travis-head")!,
    squad.find((candidate) => candidate.id === "abhishek-sharma")!,
    squad.find((candidate) => candidate.id === "keeper")!,
    squad.find((candidate) => candidate.id === "elite-ar")!,
    squad.find((candidate) => candidate.id === "superstar-youngster")!,
    squad.find((candidate) => candidate.id === "extra-ar")!,
    squad.find((candidate) => candidate.id === "franchise-icon")!,
    squad.find((candidate) => candidate.id === "elite-pace-os")!,
    squad.find((candidate) => candidate.id === "elite-spin")!,
    squad.find((candidate) => candidate.id === "elite-spin-two")!,
    squad.find((candidate) => candidate.id === "extra-bowler")!,
  ];
  const weakMiddleOrderImpact = player("weak-middle-order", "Batsman", 60, 0, { hasBattedAt5: true });
  const result = applyBowlingFirstImpactFinisherRule(
    [...squad, weakMiddleOrderImpact],
    startingXI,
    weakMiddleOrderImpact,
  );

  assert.equal(result.player?.id, "extra-batter");
  assert.equal(result.forcePosition8, true);
});

test("bowl-first impact replaces a weak opener with a middle-order option before applying the finisher fallback", () => {
  const startingXI = [
    squad.find((candidate) => candidate.id === "travis-head")!,
    squad.find((candidate) => candidate.id === "abhishek-sharma")!,
    squad.find((candidate) => candidate.id === "keeper")!,
    squad.find((candidate) => candidate.id === "elite-ar")!,
    squad.find((candidate) => candidate.id === "superstar-youngster")!,
    squad.find((candidate) => candidate.id === "extra-ar")!,
    squad.find((candidate) => candidate.id === "franchise-icon")!,
    squad.find((candidate) => candidate.id === "elite-pace-os")!,
    squad.find((candidate) => candidate.id === "elite-spin")!,
    squad.find((candidate) => candidate.id === "elite-spin-two")!,
    squad.find((candidate) => candidate.id === "extra-bowler")!,
  ];
  const weakOpener = player("weak-opener", "Batsman", 60, 0, { isOpener: true });
  const weakMiddleOrder = player("weak-middle-order-2", "Batsman", 62, 0, { hasBattedAt5: true });
  const result = resolveBowlingFirstImpactPlayer(
    [...startingXI, weakOpener, weakMiddleOrder, squad.find((candidate) => candidate.id === "extra-batter")!],
    startingXI,
    weakOpener,
    1,
  );

  assert.equal(result.player?.id, "extra-batter");
  assert.equal(result.forcePosition8, true);
  assert.equal(result.replacedOpener, true);
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

test("batting-first starting XI targets >= 7 batting options while bowl-first targets >= 6 with 7th batter impact sub", () => {
  const isBattingOpt = (p: Player) => p.role === "Batsman" || p.role === "WK-Batsman" || p.role === "All-Rounder";
  const plans = buildAiMatchLineups(squad);

  const batFirstStarters = plans.battingFirst.startingXI.map((id) => squad.find((p) => p.id === id)!);
  const batFirstBattingOptions = batFirstStarters.filter(isBattingOpt).length;
  assert.ok(batFirstBattingOptions >= 7, `Expected >= 7 batting options for bat-first starting XI, got ${batFirstBattingOptions}`);

  const bowlFirstStarters = plans.bowlingFirst.startingXI.map((id) => squad.find((p) => p.id === id)!);
  const bowlFirstBattingOptions = bowlFirstStarters.filter(isBattingOpt).length;
  assert.ok(bowlFirstBattingOptions >= 6, `Expected >= 6 batting options for bowl-first starting XI, got ${bowlFirstBattingOptions}`);

  const bowlFirstImpact = squad.find((p) => p.id === plans.bowlingFirst.impactPlayerId);
  assert.ok(bowlFirstImpact && isBattingOpt(bowlFirstImpact), "Expected 7th batter as impact sub for bowl-first plan");
});

test("bowl-first planning starts a strong all-rounder and reserves a pure batter for the chase", () => {
  const lsgLikeSquad = [
    player("josh-inglis", "WK-Batsman", 85, 0, {
      nationality: "Overseas",
      isWicketkeeper: true,
      isOpener: true,
    }),
    player("tom-banton", "WK-Batsman", 77, 0, {
      nationality: "Overseas",
      isWicketkeeper: true,
      isOpener: true,
    }),
    player("nicholas-pooran", "WK-Batsman", 86, 0, {
      nationality: "Overseas",
      isWicketkeeper: true,
      hasBattedAt3: true,
    }),
    player("mitchell-marsh", "All-Rounder", 84, 76, {
      nationality: "Overseas",
      hasBattedAt4: true,
    }),
    player("urvil-patel", "WK-Batsman", 79, 0, {
      isWicketkeeper: true,
      hasBattedAt5: true,
    }),
    player("suryansh-shedge", "All-Rounder", 79, 68, {
      hasBattedAt6: true,
    }),
    player("nitish-kumar-reddy", "All-Rounder", 81, 76, {
      isCoreBatter: true,
      hasBattedAt5: true,
    }),
    player("kuldeep-yadav", "Spin Bowler", 0, 88),
    player("mohammed-siraj", "Pace Bowler", 0, 84),
    player("rahul-chahar", "Spin Bowler", 0, 83),
    player("mohammed-shami", "Pace Bowler", 0, 86),
    player("khaleel-ahmed", "Pace Bowler", 10, 83),
    player("backup-batter", "Batsman", 78, 0, {
      hasBattedAt6: true,
    }),
  ];

  const plan = buildAiMatchLineups(lsgLikeSquad, {
    captainId: "mitchell-marsh",
    viceCaptainId: "nicholas-pooran",
  }).bowlingFirst;

  assert.ok(plan.startingXI.includes("nitish-kumar-reddy"));
  assert.equal(plan.impactPlayerId, "backup-batter");
  assert.equal(
    plan.startingXI
      .map((id) => lsgLikeSquad.find((candidate) => candidate.id === id)!)
      .filter(isSpecialistBowler)
      .length,
    4,
  );
});

test("bowl-first planning can bench a secondary keeper-opener and start the stronger bowling all-rounder", () => {
  const keeperOpenerImpactSquad = [
    player("josh-inglis", "WK-Batsman", 85, 0, {
      nationality: "Overseas",
      isWicketkeeper: true,
      isOpener: true,
    }),
    player("tom-banton", "WK-Batsman", 77, 0, {
      nationality: "Overseas",
      isWicketkeeper: true,
      isOpener: true,
      onlyOpensOrBenched: true,
    }),
    player("nicholas-pooran", "WK-Batsman", 86, 0, {
      nationality: "Overseas",
      isWicketkeeper: true,
      hasBattedAt3: true,
    }),
    player("mitchell-marsh", "All-Rounder", 84, 76, {
      nationality: "Overseas",
      hasBattedAt4: true,
    }),
    player("urvil-patel", "WK-Batsman", 83, 0, {
      isWicketkeeper: true,
      hasBattedAt5: true,
    }),
    player("suryansh-shedge", "All-Rounder", 82, 68, {
      hasBattedAt6: true,
    }),
    player("nitish-kumar-reddy", "All-Rounder", 81, 76, {
      isCoreBatter: true,
      hasBattedAt5: true,
    }),
    player("kuldeep-yadav", "Spin Bowler", 15, 88),
    player("mohammed-siraj", "Pace Bowler", 12, 84),
    player("rahul-chahar", "Spin Bowler", 10, 83),
    player("mohammed-shami", "Pace Bowler", 14, 86),
    player("khaleel-ahmed", "Pace Bowler", 11, 83),
  ];

  const plan = buildAiMatchLineups(keeperOpenerImpactSquad, {
    captainId: "mitchell-marsh",
    viceCaptainId: "nicholas-pooran",
  }).bowlingFirst;

  assert.ok(plan.startingXI.includes("nitish-kumar-reddy"));
  assert.equal(plan.startingXI.includes("tom-banton"), false);
  assert.equal(plan.impactPlayerId, "tom-banton");
  assert.equal(plan.impactBattingPosition, 2);
  assert.ok(
    plan.likelyOutgoingPlayerId
    && keeperOpenerImpactSquad.find(
      (candidate) => candidate.id === plan.likelyOutgoingPlayerId,
    )?.role.endsWith("Bowler"),
  );
  assert.ok(
    plan.startingXI.filter((id) => (
      id === "josh-inglis"
      || id === "nicholas-pooran"
      || id === "urvil-patel"
    )).length >= 2,
  );
});

test("bowl-first plan subbing in an all-rounder (>75 batting) replaces an out-and-out batter according to tie-breaking criteria", () => {
  const customSquad = lineupFixturePlayers([
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 85, currentBowling: 0, age: 28, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 84, currentBowling: 0, age: 27, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "wk1", name: "Keeper 1", role: "WK-Batsman", currentBatting: 83, currentBowling: 0, age: 26, reputation: 7, nationality: "Indian", hasBattedAt3: true },
    { id: "bat1", name: "Out of Position Batter", role: "Batsman", currentBatting: 74, currentBowling: 0, age: 30, reputation: 6, nationality: "Indian", hasBattedAt3: true }, // at #4, out of position
    { id: "bat2", name: "In Position Batter", role: "Batsman", currentBatting: 76, currentBowling: 0, age: 25, reputation: 6, nationality: "Indian", hasBattedAt5: true },
    { id: "bat3", name: "Batter 3", role: "Batsman", currentBatting: 82, currentBowling: 0, age: 26, reputation: 7, nationality: "Indian", hasBattedAt6: true },
    { id: "bow1", name: "Bowler 1", role: "Pace Bowler", currentBatting: 30, currentBowling: 85, age: 25, reputation: 7, nationality: "Indian" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 25, currentBowling: 84, age: 26, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 24, reputation: 6, nationality: "Indian" },
    { id: "bow4", name: "Bowler 4", role: "Spin Bowler", currentBatting: 20, currentBowling: 80, age: 28, reputation: 6, nationality: "Indian" },
    { id: "bow5", name: "Bowler 5", role: "Spin Bowler", currentBatting: 15, currentBowling: 78, age: 29, reputation: 6, nationality: "Indian" },
    { id: "ar-impact", name: "All Rounder Impact", role: "All-Rounder", currentBatting: 78, currentBowling: 70, age: 26, reputation: 7, nationality: "Indian" },
  ]);

  const plans = buildAiMatchLineups(customSquad);
  assert.equal(plans.bowlingFirst.startingXI.includes("ar-impact"), true);
  assert.equal(plans.bowlingFirst.impactPlayerId, "bat1");
});

test("bowl-first plan supports a 2nd All-Rounder exception when a 2nd All-Rounder has higher batting rating than the next candidate batter", () => {
  const squadWithTwoARs = lineupFixturePlayers([
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 89, currentBowling: 0, age: 26, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 87, currentBowling: 0, age: 25, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "wk1", name: "Keeper 1", role: "WK-Batsman", currentBatting: 87, currentBowling: 0, age: 34, reputation: 9, nationality: "Overseas", hasBattedAt3: true },
    { id: "bat1", name: "Batter 1", role: "Batsman", currentBatting: 75, currentBowling: 0, age: 36, reputation: 7, nationality: "Indian", hasBattedAt4: true },
    { id: "bat2", name: "Batter 2", role: "Batsman", currentBatting: 75, currentBowling: 0, age: 38, reputation: 8, nationality: "Indian", hasBattedAt3: true }, // Out of position at #6
    { id: "ar1", name: "AR 1", role: "All-Rounder", currentBatting: 83, currentBowling: 80, age: 36, reputation: 8, nationality: "Indian" },
    { id: "ar2", name: "AR 2", role: "All-Rounder", currentBatting: 81, currentBowling: 78, age: 31, reputation: 7, nationality: "Overseas" },
    { id: "ar3", name: "AR 3", role: "All-Rounder", currentBatting: 79, currentBowling: 80, age: 26, reputation: 7, nationality: "Indian" },
    { id: "ar4", name: "AR 4", role: "All-Rounder", currentBatting: 77, currentBowling: 78, age: 27, reputation: 7, nationality: "Indian" }, // 2nd AR with 77 > 75
    { id: "bow1", name: "Bowler 1", role: "Spin Bowler", currentBatting: 20, currentBowling: 88, age: 26, reputation: 9, nationality: "Overseas" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 28, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 15, currentBowling: 91, age: 29, reputation: 9, nationality: "Overseas" },
    { id: "bow4", name: "Bowler 4", role: "Pace Bowler", currentBatting: 10, currentBowling: 84, age: 30, reputation: 8, nationality: "Indian" },
  ]);

  const plans = buildAiMatchLineups(squadWithTwoARs);
  // AR 3 (79) starts in bowl-first XI over Bat 2 (75) (1st AR exception)
  assert.equal(plans.bowlingFirst.startingXI.includes("ar3"), true);
  // AR 4 (77) is impact sub and replaces Bat 1 (75) (2nd AR exception)
  assert.equal(plans.bowlingFirst.impactPlayerId, "ar4");
  assert.equal(plans.bowlingFirst.likelyOutgoingPlayerId, "bat1");
  // The 82+ protection rule keeps the higher-rated AR 1 in its established slot.
  assert.equal(plans.bowlingFirst.impactBattingPosition, 7);
});

test("impactBattingPosition calculates the exact 1-based batting position for an incoming batter subbed into the 2nd innings lineup", () => {
  const plans = buildAiMatchLineups(squad);
  assert.ok(typeof plans.bowlingFirst.impactBattingPosition === "number");
  assert.ok(plans.bowlingFirst.impactBattingPosition! >= 1 && plans.bowlingFirst.impactBattingPosition! <= 11);
});

test("bat-first plan promotes #8 core batter (>78, can bat at 5) to #5 if positions 5, 6, 7 are all finishers, shifting finishers down 1", () => {
  const squadForBatFirstRule = lineupFixturePlayers([
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 89, currentBowling: 0, age: 26, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 87, currentBowling: 0, age: 25, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "wk1", name: "Keeper 1", role: "WK-Batsman", currentBatting: 87, currentBowling: 0, age: 34, reputation: 9, nationality: "Overseas", hasBattedAt3: true },
    { id: "bat4", name: "Core Bat 4", role: "Batsman", currentBatting: 85, currentBowling: 0, age: 28, reputation: 8, nationality: "Indian", isCoreBatter: true, hasBattedAt4: true },
    { id: "fin1", name: "Finisher 1", role: "All-Rounder", currentBatting: 78, currentBowling: 75, age: 33, reputation: 8, nationality: "Indian", hasBattedAt5: true }, // pos 6
    { id: "fin2", name: "Finisher 2", role: "Batsman", currentBatting: 77, currentBowling: 0, age: 31, reputation: 7, nationality: "Indian", hasBattedAt5: true }, // pos 7
    { id: "fin3", name: "Finisher 3", role: "All-Rounder", currentBatting: 81, currentBowling: 78, age: 31, reputation: 7, nationality: "Overseas", hasBattedAt5: true }, // pos 5
    { id: "core8", name: "Core Bat 8", role: "Batsman", currentBatting: 82, currentBowling: 0, age: 36, reputation: 7, nationality: "Indian", isCoreBatter: true, hasBattedAt5: true }, // pos 8
    { id: "bow1", name: "Bowler 1", role: "Spin Bowler", currentBatting: 20, currentBowling: 88, age: 26, reputation: 9, nationality: "Overseas" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 28, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 15, currentBowling: 91, age: 29, reputation: 9, nationality: "Indian" },
  ]);

  const openingPair: [Player, Player] = [squadForBatFirstRule[0], squadForBatFirstRule[1]];
  const orderedXI = orderStartingXI(squadForBatFirstRule, openingPair, "battingFirst", squadForBatFirstRule);

  // Core Bat 8 (82) promoted to position 5 (index 4)
  assert.equal(orderedXI[4].id, "core8");
  assert.equal(orderedXI[5].id, "fin3");
  assert.equal(orderedXI[6].id, "fin1");
  // Position 8 pure batter (fin2) replaced by best available bowler/bench player (bow3)
  assert.equal(orderedXI[7].id, "bow3");
});

test("bat-first plan does NOT promote #8 core batter if #8 rating is lower than ALL 3 finishers at 5, 6, and 7", () => {
  const squadForException = lineupFixturePlayers([
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 89, currentBowling: 0, age: 26, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 87, currentBowling: 0, age: 25, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "wk1", name: "Keeper 1", role: "WK-Batsman", currentBatting: 87, currentBowling: 0, age: 34, reputation: 9, nationality: "Overseas", hasBattedAt3: true },
    { id: "bat4", name: "Core Bat 4", role: "Batsman", currentBatting: 86, currentBowling: 0, age: 28, reputation: 8, nationality: "Indian", isCoreBatter: true, hasBattedAt4: true },
    { id: "fin1", name: "Finisher 1", role: "All-Rounder", currentBatting: 84, currentBowling: 75, age: 33, reputation: 8, nationality: "Indian", hasBattedAt5: true },
    { id: "fin2", name: "Finisher 2", role: "Batsman", currentBatting: 83, currentBowling: 0, age: 31, reputation: 7, nationality: "Indian", hasBattedAt5: true },
    { id: "fin3", name: "Finisher 3", role: "All-Rounder", currentBatting: 85, currentBowling: 78, age: 31, reputation: 7, nationality: "Overseas", hasBattedAt5: true },
    { id: "core8", name: "Core Bat 8", role: "Batsman", currentBatting: 79, currentBowling: 0, age: 36, reputation: 7, nationality: "Indian", isCoreBatter: true, hasBattedAt5: true },
    { id: "bow1", name: "Bowler 1", role: "Spin Bowler", currentBatting: 20, currentBowling: 88, age: 26, reputation: 9, nationality: "Overseas" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 28, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 15, currentBowling: 91, age: 29, reputation: 9, nationality: "Indian" },
  ]);

  const openingPair: [Player, Player] = [squadForException[0], squadForException[1]];
  const orderedXI = orderStartingXI(squadForException, openingPair, "battingFirst", squadForException);

  // Position 8 pure batter (core8) replaced by best available bowler/bench player (bow3)
  assert.equal(orderedXI[7].id, "bow3");
});

test("bat-first plan promotes Dewald Brevis (81) 3 positions directly to #5 and shifts Miller, Dube, Dhoni down 1", () => {
  const brevisSquad = lineupFixturePlayers([
    { id: "samson", name: "Sanju Samson", role: "WK-Batsman", currentBatting: 89, currentBowling: 0, age: 31, reputation: 9, isOpener: true, nationality: "Indian" },
    { id: "gaikwad", name: "Ruturaj Gaikwad", role: "Batsman", currentBatting: 83, currentBowling: 0, age: 29, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "sky", name: "Suryakumar Yadav", role: "Batsman", currentBatting: 85, currentBowling: 0, age: 35, reputation: 9, hasBattedAt3: true, hasBattedAt4: true, nationality: "Indian" },
    { id: "rachin", name: "Rachin Ravindra", role: "All-Rounder", currentBatting: 82, currentBowling: 78, age: 26, reputation: 8, hasBattedAt4: true, nationality: "Overseas" },
    { id: "dube", name: "Shivam Dube", role: "All-Rounder", currentBatting: 85, currentBowling: 72, age: 32, reputation: 8, isCoreBatter: true, hasBattedAt5: true, nationality: "Indian" },
    { id: "miller", name: "David Miller", role: "Batsman", currentBatting: 81, currentBowling: 0, age: 36, reputation: 8, isCoreBatter: true, hasBattedAt5: true, nationality: "Overseas" },
    { id: "dhoni", name: "MS Dhoni", role: "WK-Batsman", currentBatting: 77, currentBowling: 0, age: 44, reputation: 10, hasBattedAt7: true, nationality: "Indian" },
    { id: "brevis", name: "Dewald Brevis", role: "Batsman", currentBatting: 81, currentBowling: 0, age: 22, reputation: 7, isCoreBatter: true, hasBattedAt5: true, nationality: "Overseas" },
    { id: "dhir", name: "Naman Dhir", role: "All-Rounder", currentBatting: 74, currentBowling: 74, age: 26, reputation: 7, nationality: "Indian" },
    { id: "harshal", name: "Harshal Patel", role: "Pace Bowler", currentBatting: 45, currentBowling: 80, age: 35, reputation: 8, nationality: "Indian" },
    { id: "noor", name: "Noor Ahmad", role: "Spin Bowler", currentBatting: 15, currentBowling: 84, age: 21, reputation: 8, nationality: "Overseas" },
  ]);

  const openingPair: [Player, Player] = [brevisSquad[0], brevisSquad[1]];
  const orderedXI = orderStartingXI(brevisSquad, openingPair, "battingFirst");

  // Dube (85) at position 5 (index 4)
  assert.equal(orderedXI[4].id, "dube");
  // Miller (81) at position 6 (index 5)
  assert.equal(orderedXI[5].id, "miller");
  // Brevis (81) at position 7 (index 6)
  assert.equal(orderedXI[6].id, "brevis");
  // Dhoni (77) at position 8 (index 7)
  assert.equal(orderedXI[7].id, "dhoni");
});

test("bowl-first plan also promotes #8 core batter to #5 if positions 5-8 are all batters/all-rounders", () => {
  const squadForBowlFirstPromotion = lineupFixturePlayers([
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 89, currentBowling: 0, age: 26, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 87, currentBowling: 0, age: 25, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "wk1", name: "Keeper 1", role: "WK-Batsman", currentBatting: 87, currentBowling: 0, age: 34, reputation: 9, nationality: "Overseas", hasBattedAt3: true },
    { id: "bat4", name: "Core Bat 4", role: "Batsman", currentBatting: 85, currentBowling: 0, age: 28, reputation: 8, nationality: "Indian", isCoreBatter: true, hasBattedAt4: true },
    { id: "fin1", name: "Finisher 1", role: "All-Rounder", currentBatting: 78, currentBowling: 75, age: 33, reputation: 8, nationality: "Indian", hasBattedAt5: true },
    { id: "fin2", name: "Finisher 2", role: "Batsman", currentBatting: 77, currentBowling: 0, age: 31, reputation: 7, nationality: "Indian", hasBattedAt5: true },
    { id: "fin3", name: "Finisher 3", role: "All-Rounder", currentBatting: 81, currentBowling: 78, age: 31, reputation: 7, nationality: "Overseas", hasBattedAt5: true },
    { id: "core8", name: "Core Bat 8", role: "Batsman", currentBatting: 82, currentBowling: 0, age: 36, reputation: 7, nationality: "Indian", isCoreBatter: true, hasBattedAt5: true },
    { id: "bow1", name: "Bowler 1", role: "Spin Bowler", currentBatting: 20, currentBowling: 88, age: 26, reputation: 9, nationality: "Overseas" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 28, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 15, currentBowling: 91, age: 29, reputation: 9, nationality: "Indian" },
  ]);

  const openingPair: [Player, Player] = [squadForBowlFirstPromotion[0], squadForBowlFirstPromotion[1]];
  const orderedXI = orderStartingXI(squadForBowlFirstPromotion, openingPair, "bowlingFirst");

  // Core Bat 8 (82) promoted to position 5 (index 4) in bowl-first mode as well
  assert.equal(orderedXI[4].id, "core8");
  assert.equal(orderedXI[5].id, "fin3");
  // Position 8 pure batter (fin2) replaced by best available bowler/bench player (bow3)
  assert.equal(orderedXI[7].id, "bow3");
});

test("if position 8 is a pure batter, it is switched to the best available all-rounder", () => {
  const squadWithBatterAt8: any[] = [
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 89, currentBowling: 0, age: 26, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 87, currentBowling: 0, age: 25, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "wk1", name: "Keeper 1", role: "WK-Batsman", currentBatting: 87, currentBowling: 0, age: 34, reputation: 9, nationality: "Overseas" },
    { id: "bat3", name: "Batter 3", role: "Batsman", currentBatting: 85, currentBowling: 0, age: 28, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat4", name: "Batter 4", role: "Batsman", currentBatting: 84, currentBowling: 0, age: 29, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat5", name: "Batter 5", role: "Batsman", currentBatting: 82, currentBowling: 0, age: 30, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat6", name: "Batter 6", role: "Batsman", currentBatting: 81, currentBowling: 0, age: 31, reputation: 7, nationality: "Indian" },
    { id: "bat7", name: "Pure Batter 7", role: "Batsman", currentBatting: 79, currentBowling: 0, age: 32, reputation: 7, nationality: "Indian" }, // at #8
    { id: "bow1", name: "Bowler 1", role: "Spin Bowler", currentBatting: 20, currentBowling: 88, age: 26, reputation: 9, nationality: "Overseas" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 28, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 15, currentBowling: 91, age: 29, reputation: 9, nationality: "Indian" },
    { id: "ar_bench", name: "Bench All-Rounder", role: "All-Rounder", currentBatting: 76, currentBowling: 76, age: 27, reputation: 7, nationality: "Indian" },
  ];

  const openingPair: [Player, Player] = [squadWithBatterAt8[0], squadWithBatterAt8[1]];
  const orderedXI = orderStartingXI(squadWithBatterAt8, openingPair, "battingFirst", squadWithBatterAt8);

  // Position 8 (index 7) should be switched from Pure Batter 7 to the best available all-rounder (ar_bench)
  assert.equal(orderedXI[7].id, "ar_bench");
});

test("if position 8 is a pure batter and no all-rounders are available, it selects the candidate with highest potential ability", () => {
  const squadWithNoAR: any[] = [
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 89, currentBowling: 0, age: 26, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 87, currentBowling: 0, age: 25, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "wk1", name: "Keeper 1", role: "WK-Batsman", currentBatting: 87, currentBowling: 0, age: 34, reputation: 9, nationality: "Overseas" },
    { id: "bat3", name: "Batter 3", role: "Batsman", currentBatting: 85, currentBowling: 0, age: 28, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat4", name: "Batter 4", role: "Batsman", currentBatting: 84, currentBowling: 0, age: 29, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat5", name: "Batter 5", role: "Batsman", currentBatting: 82, currentBowling: 0, age: 30, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat6", name: "Batter 6", role: "Batsman", currentBatting: 81, currentBowling: 0, age: 31, reputation: 7, nationality: "Indian" },
    { id: "bat7", name: "Pure Batter 7", role: "Batsman", currentBatting: 79, currentBowling: 0, age: 32, reputation: 7, nationality: "Indian" }, // at #8
    { id: "bow1", name: "Bowler 1", role: "Spin Bowler", currentBatting: 20, currentBowling: 88, age: 26, reputation: 9, nationality: "Overseas" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 28, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 15, currentBowling: 91, age: 29, reputation: 9, nationality: "Indian" },
    { id: "bench_low_pot", name: "Bench Low Potential", role: "Spin Bowler", currentBatting: 30, potentialBatting: 30, currentBowling: 75, potentialBowling: 80, age: 28, reputation: 6, nationality: "Indian" },
    { id: "bench_high_pot", name: "Bench High Potential", role: "Pace Bowler", currentBatting: 20, potentialBatting: 20, currentBowling: 74, potentialBowling: 92, age: 20, reputation: 6, nationality: "Indian" },
  ];

  const openingPair: [Player, Player] = [squadWithNoAR[0], squadWithNoAR[1]];
  const orderedXI = orderStartingXI(squadWithNoAR, openingPair, "battingFirst", squadWithNoAR);

  // Position 8 (index 7) should be switched to bench_high_pot (potential 92)
  assert.equal(orderedXI[7].id, "bench_high_pot");
});

test("position 8 pure batter with reputation 10 is protected and NOT switched out", () => {
  const squadWithRep10At8: any[] = [
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 89, currentBowling: 0, age: 26, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 87, currentBowling: 0, age: 25, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "wk1", name: "Keeper 1", role: "WK-Batsman", currentBatting: 87, currentBowling: 0, age: 34, reputation: 9, nationality: "Overseas" },
    { id: "bat3", name: "Batter 3", role: "Batsman", currentBatting: 85, currentBowling: 0, age: 28, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat4", name: "Batter 4", role: "Batsman", currentBatting: 84, currentBowling: 0, age: 29, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat5", name: "Batter 5", role: "Batsman", currentBatting: 82, currentBowling: 0, age: 30, reputation: 8, nationality: "Indian", isCoreBatter: true },
    { id: "bat6", name: "Batter 6", role: "Batsman", currentBatting: 81, currentBowling: 0, age: 31, reputation: 7, nationality: "Indian" },
    { id: "rep10_bat", name: "Rep 10 Star", role: "Batsman", currentBatting: 79, currentBowling: 0, age: 35, reputation: 10, nationality: "Indian" }, // at #8 with rep 10
    { id: "bow1", name: "Bowler 1", role: "Spin Bowler", currentBatting: 20, currentBowling: 88, age: 26, reputation: 9, nationality: "Overseas" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 28, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 15, currentBowling: 91, age: 29, reputation: 9, nationality: "Indian" },
    { id: "ar_bench", name: "Bench All-Rounder", role: "All-Rounder", currentBatting: 76, currentBowling: 76, age: 27, reputation: 7, nationality: "Indian" },
  ];

  const openingPair: [Player, Player] = [squadWithRep10At8[0], squadWithRep10At8[1]];
  const orderedXI = orderStartingXI(squadWithRep10At8, openingPair, "battingFirst", squadWithRep10At8);

  // Position 8 (index 7) with reputation 10 must NOT be switched out
  assert.equal(orderedXI[7].id, "rep10_bat");
});

test("findOptimalImpactBattingPosition inserts core batter and verifies downward shifted players fit", () => {
  const starters: any[] = [
    { id: "op1", name: "Opener 1", role: "Batsman", currentBatting: 89, currentBowling: 0, age: 26, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "op2", name: "Opener 2", role: "Batsman", currentBatting: 87, currentBowling: 0, age: 25, reputation: 8, isOpener: true, nationality: "Indian" },
    { id: "sky", name: "Suryakumar Yadav", role: "Batsman", currentBatting: 85, currentBowling: 0, age: 35, reputation: 9, hasBattedAt3: true, hasBattedAt4: true, nationality: "Indian" },
    { id: "rachin", name: "Rachin Ravindra", role: "All-Rounder", currentBatting: 82, currentBowling: 78, age: 26, reputation: 8, hasBattedAt4: true, hasBattedAt5: true, nationality: "Overseas" },
    { id: "miller", name: "David Miller", role: "Batsman", currentBatting: 81, currentBowling: 0, age: 36, reputation: 8, isCoreBatter: true, hasBattedAt5: true, hasBattedAt6: true, nationality: "Overseas" },
    { id: "dube", name: "Shivam Dube", role: "All-Rounder", currentBatting: 85, currentBowling: 72, age: 32, reputation: 8, isCoreBatter: true, hasBattedAt5: true, hasBattedAt6: true, hasBattedAt7: true, nationality: "Indian" },
    { id: "dhoni", name: "MS Dhoni", role: "WK-Batsman", currentBatting: 77, currentBowling: 0, age: 44, reputation: 10, hasBattedAt7: true, nationality: "Indian" },
    { id: "bow1", name: "Bowler 1", role: "Spin Bowler", currentBatting: 20, currentBowling: 88, age: 26, reputation: 9, nationality: "Overseas" },
    { id: "bow2", name: "Bowler 2", role: "Pace Bowler", currentBatting: 20, currentBowling: 82, age: 28, reputation: 7, nationality: "Indian" },
    { id: "bow3", name: "Bowler 3", role: "Pace Bowler", currentBatting: 15, currentBowling: 91, age: 29, reputation: 9, nationality: "Indian" },
    { id: "bow4", name: "Bowler 4", role: "Pace Bowler", currentBatting: 10, currentBowling: 85, age: 27, reputation: 8, nationality: "Indian" },
  ];

  const brevis: any = { id: "brevis", name: "Dewald Brevis", role: "Batsman", currentBatting: 81, currentBowling: 0, age: 22, reputation: 7, isCoreBatter: true, hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, nationality: "Overseas" };
  const outgoing: Player = starters[10];

  const pos = findOptimalImpactBattingPosition(starters, brevis, outgoing);
  assert.equal(pos, 3);
});

test("impact position checks both opener orders and restores a special partnership", () => {
  const head = player("travis-head", "Batsman", 89, 0, {
    nationality: "Overseas",
    isOpener: true,
  });
  const abhishek = player("abhishek-sharma", "All-Rounder", 90, 69, {
    isOpener: true,
  });
  const ishan = player("ishan-kishan", "WK-Batsman", 88, 0, {
    isWicketkeeper: true,
    isOpener: true,
  });
  const starters = [
    abhishek,
    ishan,
    player("three", "Batsman", 84, 0, { hasBattedAt3: true }),
    player("four", "Batsman", 83, 0, { hasBattedAt4: true }),
    player("five", "Batsman", 82, 0, { hasBattedAt5: true }),
    player("six", "All-Rounder", 80, 75, { hasBattedAt6: true }),
    player("seven", "All-Rounder", 79, 76, { hasBattedAt7: true }),
    player("eight", "Pace Bowler", 30, 85),
    player("nine", "Spin Bowler", 25, 84),
    player("ten", "Pace Bowler", 20, 82),
    player("eleven", "Spin Bowler", 15, 80),
  ];

  assert.equal(findOptimalImpactBattingPosition(starters, head, ishan, true), 1);
});
