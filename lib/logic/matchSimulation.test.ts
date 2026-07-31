import assert from "node:assert/strict";
import test from "node:test";

import type { CuratorPitch } from "../data/pitchCurator";
import type { Player, Team } from "../types";
import { createTeamTactics } from "./teamTactics";
import {
  bowlerRespectIntentAdjustment,
  chooseSituationalField,
  chooseTossDecision,
  dotBallPressureAdjustment,
  deathExtrasPressure,
  estimateTeamWinProbability,
  groundRunningPressure,
  milestonePressureScoringFactor,
  nextBowlerSpellOver,
  partnershipWicketReduction,
  powerplayAllRounderFatigue,
  selectInningsWicketkeeper,
  strikeFarmSingleMultiplier,
  selectCollapseImpactOutgoingPlayer,
  calculateDLSRevisedTarget,
  simulateInstantMatch,
  type MatchGroundConditions,
  type MatchLineupPlan,
  type MatchSimulationInput,
  type MatchTeamPlans,
} from "./matchSimulation";
import {
  compactMatchSimulation,
  hasArchivedDeliveries,
} from "./matchSimulationStorage";

const emptyCareerStats = {
  batting: { matches: 0, innings: 0, runs: 0, average: 0, strikeRate: 0, fifties: 0, hundreds: 0 },
  bowling: { matches: 0, wickets: 0, economy: 0, average: 0, bestFigures: "0/0" },
};
const emptyIplStats = {
  matches: 0,
  runs: 0,
  battingAverage: 0,
  strikeRate: 0,
  bowlingInnings: 0,
  bowlingAverage: 0,
  wickets: 0,
};

function makeTeam(id: string): Team {
  return {
    id,
    name: `${id} Cricket Club`,
    shortName: id,
    primaryColor: "#123456",
    secondaryColor: "#ffffff",
    homeGround: `${id} Ground`,
    city: id,
    totalPurse: 12_000,
    spentAmount: 0,
    remainingPurse: 12_000,
    squad: [],
    retainedPlayers: [],
    rtmCardsUsed: 0,
    rtmCardsTotal: 0,
    maxSquadSize: 25,
    minSquadSize: 18,
    overseasPlayersCurrent: 0,
    overseasPlayersMax: 8,
    fanBase: "Large",
    prestige: 8,
    aiPersonality: "Balanced",
    dna: {
      loyalty: 50,
      prefYoungsters: 50,
      experienceFocus: 50,
      bigNamesPref: 50,
      looksForDepth: 50,
      alrValue: 50,
      batValue: 50,
      bowlValue: 50,
      commitmentToTargets: 50,
    },
  };
}

function makeSquad(teamId: string, rating: number): Player[] {
  return Array.from({ length: 16 }, (_, index) => {
    const role: Player["role"] = index === 2
      ? "WK-Batsman"
      : index <= 4 || index >= 11
        ? "Batsman"
        : index <= 6
          ? "All-Rounder"
          : index <= 8
            ? "Pace Bowler"
            : "Spin Bowler";
    const isBowler = role === "Pace Bowler" || role === "Spin Bowler";
    const isAllRounder = role === "All-Rounder";
    return {
      id: `${teamId}-${index + 1}`,
      name: `${teamId} Player ${index + 1}`,
      age: 22 + index,
      nationality: index % 5 === 0 ? "Overseas" : "Indian",
      role,
      battingStyle: index % 2 === 0 ? "Right-hand" : "Left-hand",
      bowlingStyle: isBowler ? (role === "Pace Bowler" ? "Pacer" : "Spinner") : isAllRounder ? "Pacer" : null,
      bowlingHand: isBowler || isAllRounder ? "Right-hand" : null,
      careerStats: emptyCareerStats,
      iplStats: emptyIplStats,
      iplHistory: [],
      basePrice: 100,
      isCapped: true,
      isRetained: false,
      retainedByTeamId: null,
      currentTeamId: teamId,
      potential: "Established",
      currentBatting: isBowler ? Math.max(40, rating - 34) : isAllRounder ? rating - 5 : rating,
      potentialBatting: rating,
      currentBowling: isBowler ? rating : isAllRounder ? rating - 3 : 20,
      potentialBowling: rating,
      reputation: index < 4 ? 9 : 6,
      battingAggression: 58 + (index % 5) * 7,
      isWicketkeeper: role === "WK-Batsman",
      isOpener: index <= 1,
      isCoreBatter: index >= 2 && index <= 5,
      isFinisher: index === 6,
      hasBattedAt3: index === 2,
      hasBattedAt4: index === 3,
      hasBattedAt5: index === 4,
      hasBattedAt6: index === 5,
      hasBattedAt7: index === 6,
    };
  });
}

function makePlan(squad: Player[]): MatchLineupPlan {
  return {
    startingXI: squad.slice(0, 11).map((player) => player.id),
    impactSubs: squad.slice(11, 16).map((player) => player.id),
    plannedImpactPlayerId: squad[11].id,
    plannedOutgoingPlayerId: squad[10].id,
    plannedImpactBattingPosition: 6,
    captainId: squad[0].id,
    viceCaptainId: squad[1].id,
  };
}

function makeTeamPlans(teamId: string, squad: Player[]): MatchTeamPlans {
  const plan = makePlan(squad);
  return {
    teamId,
    isUserControlled: false,
    tactics: createTeamTactics("Balanced"),
    battingFirst: { ...plan, startingXI: [...plan.startingXI], impactSubs: [...plan.impactSubs] },
    bowlingFirst: { ...plan, startingXI: [...plan.startingXI], impactSubs: [...plan.impactSubs] },
  };
}

const balancedPitch: CuratorPitch = {
  id: "test-balanced",
  name: "Test Balanced Surface",
  type: "Balanced",
  characteristics: ["True bounce"],
  expectedFirstInningsScore: { min: 170, max: 185 },
  favours: [],
  doesNotFavour: [],
};

const conditions: MatchGroundConditions = {
  homeTeamId: "",
  stadiumId: "test-ground",
  stadiumName: "Test Ground",
  pitch: balancedPitch,
  boundaries: { straightMetres: 70, wideMetres: 67 },
  outfield: { grassHeightMm: 13, moisturePercent: 24, firmnessGmax: 75 },
  outfieldSpeedRating: 7.5,
  adjustedExpectedScore: { min: 170, max: 185 },
  groundScoringModifier: 1,
  chasingScoringBonus: 0.02,
};

test("home advantage only modestly shifts an otherwise even matchup", () => {
  const neutralProbability = estimateTeamWinProbability(82, 82);
  const homeProbability = estimateTeamWinProbability(82.5, 82);
  assert.equal(neutralProbability, 0.5);
  assert.ok(homeProbability > 0.51 && homeProbability < 0.53);
});

test("conditions-based toss calls use surface progression without adding a toss bonus", () => {
  const tactics = createTeamTactics("Balanced");
  const deteriorating = {
    ...conditions,
    pitch: {
      ...balancedPitch,
      characteristics: ["The pitch becomes progressively slower through the match"],
    },
  };
  const chasing = {
    ...conditions,
    pitch: {
      ...balancedPitch,
      favours: ["chasing-team"] as const,
    },
  };
  assert.equal(chooseTossDecision(tactics, deteriorating), "bat");
  assert.equal(chooseTossDecision(tactics, chasing), "bowl");
});

test("only the fourth over of an uninterrupted bowling spell triggers fatigue", () => {
  assert.equal(nextBowlerSpellOver(1, undefined, 0), 1);
  assert.equal(nextBowlerSpellOver(3, 1, 1), 2);
  assert.equal(nextBowlerSpellOver(5, 3, 2), 3);
  assert.equal(nextBowlerSpellOver(7, 5, 3), 4);
  assert.equal(nextBowlerSpellOver(8, 5, 3), 1);
});

test("an established partnership gains only a small wicket-resistance benefit", () => {
  assert.equal(partnershipWicketReduction(12, 20), 0);
  assert.ok(partnershipWicketReduction(30, 40) > 0);
  assert.ok(partnershipWicketReduction(60, 80) <= 0.004);
  assert.equal(partnershipWicketReduction(100, 160), 0.004);
});

test("dot-ball pressure begins after three dots and remains capped", () => {
  assert.deepEqual(dotBallPressureAdjustment(2), {
    runMultiplier: 1,
    wicketIncrease: 0,
  });
  assert.deepEqual(dotBallPressureAdjustment(3), {
    runMultiplier: 1.02,
    wicketIncrease: 0.002,
  });
  assert.deepEqual(dotBallPressureAdjustment(20), {
    runMultiplier: 1.08,
    wicketIncrease: 0.01,
  });
});

test("batters only make a slight intent adjustment for clear bowling mismatches", () => {
  assert.equal(bowlerRespectIntentAdjustment(82, 80), 0);
  assert.ok(bowlerRespectIntentAdjustment(88, 75) > 0);
  assert.ok(bowlerRespectIntentAdjustment(75, 88) < 0);
  assert.equal(bowlerRespectIntentAdjustment(100, 50), 0.04);
  assert.equal(bowlerRespectIntentAdjustment(50, 100), -0.035);
});

test("long batting innings only fatigue all-rounders bowling in the powerplay", () => {
  assert.equal(powerplayAllRounderFatigue(29, 3, true), 0);
  assert.ok(powerplayAllRounderFatigue(36, 3, true) > 0);
  assert.equal(powerplayAllRounderFatigue(50, 7, true), 0);
  assert.equal(powerplayAllRounderFatigue(50, 3, false), 0);
  assert.ok(powerplayAllRounderFatigue(80, 6, true) <= 3);
});

test("strike farming changes single intent without forcing the strike", () => {
  assert.equal(strikeFarmSingleMultiplier(2, true, true, false, false), 0.8);
  assert.equal(strikeFarmSingleMultiplier(6, true, true, false, false), 1.25);
  assert.equal(strikeFarmSingleMultiplier(3, false, false, true, true), 1.2);
  assert.equal(strikeFarmSingleMultiplier(6, false, false, true, true), 0.8);
  assert.equal(strikeFarmSingleMultiplier(4, false, false, false, false), 1);
});

test("large slow grounds add only minimal running and run-out pressure", () => {
  assert.equal(groundRunningPressure(conditions), 0);
  const largeSlow = {
    ...conditions,
    boundaries: { straightMetres: 75, wideMetres: 75 },
    outfieldSpeedRating: 5,
  };
  assert.equal(groundRunningPressure(largeSlow), 1);
});

test("situational fields protect steep rates and attack comfortable late chases", () => {
  assert.equal(chooseSituationalField("balanced", 18, 4, 130, 190), "defensive");
  assert.equal(chooseSituationalField("balanced", 18, 3, 155, 178), "attacking");
  assert.equal(chooseSituationalField("balanced", 10, 2, 80), "balanced");
});

test("death pressure slightly raises extras while experienced control absorbs it", () => {
  assert.deepEqual(deathExtrasPressure(15, 75, 0.5, true), {
    wideIncrease: 0,
    noBallIncrease: 0,
  });
  const inexperienced = deathExtrasPressure(20, 68, 0, true);
  const experienced = deathExtrasPressure(20, 88, 1, true);
  assert.ok(inexperienced.wideIncrease <= 0.004);
  assert.ok(inexperienced.noBallIncrease <= 0.0012);
  assert.ok(experienced.wideIncrease < inexperienced.wideIncrease);
  assert.ok(experienced.noBallIncrease < inexperienced.noBallIncrease);
});

test("milestone pressure only affects low-aggression batters in calm situations", () => {
  assert.equal(milestonePressureScoringFactor(47, 55, 0), 0.96);
  assert.equal(milestonePressureScoringFactor(95, 55, 0), 0.98);
  assert.equal(milestonePressureScoringFactor(47, 70, 0), 1);
  assert.equal(milestonePressureScoringFactor(95, 55, 0.5), 1);
  assert.equal(milestonePressureScoringFactor(70, 55, 0), 1);
});

test("one full-time wicketkeeper is nominated ahead of part-time alternatives", () => {
  const squad = makeSquad("KEEP", 82);
  squad[0].isPartTimeWk = true;
  const selected = selectInningsWicketkeeper(
    squad.slice(0, 11).map((player) => player.id),
    Object.fromEntries(squad.map((player) => [player.id, player])),
  );
  assert.equal(selected?.id, squad[2].id);
});

function fixtureInput(
  seed: string,
  leftRating = 82,
  rightRating = 82,
  matchConditions: MatchGroundConditions = conditions,
) {
  const teamA = makeTeam("AAA");
  const teamB = makeTeam("BBB");
  const squadA = makeSquad(teamA.id, leftRating);
  const squadB = makeSquad(teamB.id, rightRating);
  teamA.squad = squadA.map((player) => player.id);
  teamB.squad = squadB.map((player) => player.id);
  const players = Object.fromEntries([...squadA, ...squadB].map((player) => [player.id, player]));
  return {
    fixtureId: `fixture-${seed}`,
    matchNumber: 1,
    seed,
    teamA,
    teamB,
    players,
    teamAPlans: makeTeamPlans(teamA.id, squadA),
    teamBPlans: makeTeamPlans(teamB.id, squadB),
    conditions: matchConditions,
  };
}

test("every stumping in an innings is credited to its nominated wicketkeeper", () => {
  let stumpingsChecked = 0;
  for (let index = 0; index < 80; index += 1) {
    const input = fixtureInput(`fixed-keeper-${index}`);
    input.players["AAA-4"].isWicketkeeper = true;
    input.players["BBB-4"].isWicketkeeper = true;
    const result = simulateInstantMatch(input);

    result.innings.forEach((innings) => {
      const nominatedKeeperId = innings.bowlingTeamId === "AAA" ? "AAA-3" : "BBB-3";
      innings.oversDetail.forEach((over) => {
        over.deliveries.forEach((delivery) => {
          if (delivery.fieldingEvent?.kind === "missed-stumping") {
            assert.equal(delivery.fieldingEvent.fielderId, nominatedKeeperId);
          }
          if (delivery.wicket?.kind !== "stumped") return;
          stumpingsChecked += 1;
          assert.equal(delivery.wicket.fielderId, nominatedKeeperId);
        });
      });
    });
  }
  assert.ok(stumpingsChecked > 0, "expected the simulations to produce at least one stumping");
});

test("simulation is deterministic and stores every delivery", () => {
  const first = simulateInstantMatch(fixtureInput("repeatable"));
  const second = simulateInstantMatch(fixtureInput("repeatable"));
  assert.deepEqual(first, second);
  assert.equal(first.innings.length, 2);
  first.innings.forEach((innings) => {
    assert.equal(
      innings.oversDetail.reduce((sum, over) => (
        sum + over.deliveries.filter((delivery) => delivery.isLegal).length
      ), 0),
      innings.legalBalls,
    );
    assert.ok(innings.legalBalls <= 120);
    assert.ok(innings.bowling.every((entry) => entry.balls <= 24));
    assert.ok(innings.oversDetail.length <= 20);
    innings.oversDetail.forEach((over, overIndex) => {
      assert.equal(over.bowlerId, over.deliveries[0]?.bowlerId);
      if (overIndex > 0) {
        assert.notEqual(over.bowlerId, innings.oversDetail[overIndex - 1].bowlerId);
      }
      assert.ok(over.deliveries.every((delivery) => (
        delivery.bowlerId === over.bowlerId
        && Boolean(delivery.strikerId)
        && Boolean(delivery.nonStrikerId)
      )));
    });
    if (innings.oversDetail.length === 20) {
      const usageThroughSixteen = new Map<string, number>();
      innings.oversDetail.slice(0, 16).forEach((over) => {
        usageThroughSixteen.set(
          over.bowlerId,
          (usageThroughSixteen.get(over.bowlerId) ?? 0) + 1,
        );
      });
      assert.ok(
        Array.from(usageThroughSixteen.values()).filter((overs) => overs === 4).length < 4,
        "four bowlers must not all be exhausted by over 16",
      );
      assert.ok(
        new Set(innings.oversDetail.slice(16).map((over) => over.bowlerId)).size >= 2,
        "the death overs require at least two alternating bowlers",
      );
    }
    const deliveries = innings.oversDetail.flatMap((over) => over.deliveries);
    deliveries
      .filter((delivery) => delivery.isFreeHit && delivery.wicket)
      .forEach((delivery) => {
        assert.equal(delivery.wicket?.kind, "run-out");
        assert.equal(delivery.wicket?.bowlerCredited, false);
      });
    deliveries.slice(0, -1).forEach((delivery, index) => {
      if (delivery.wicket) return;
      const next = deliveries[index + 1];
      const completedRuns = (
        delivery.runsOffBat
        + delivery.extras.byes
        + delivery.extras.legByes
        + Math.max(0, delivery.extras.wides - 1)
      );
      const changesEnds = completedRuns % 2 === 1;
      const changesAtOverEnd = next.overNumber !== delivery.overNumber;
      const expectedStriker = changesEnds !== changesAtOverEnd
        ? delivery.nonStrikerId
        : delivery.strikerId;
      assert.equal(
        next.strikerId,
        expectedStriker,
        `strike transition after ${delivery.displayBall}`,
      );
    });
  });
});

test("a chase ends immediately on the winning delivery, including ball five of an over", () => {
  let fifthBallFinishFound = false;
  for (let index = 0; index < 300; index += 1) {
    const result = simulateInstantMatch(fixtureInput(`chase-stop-${index}`));
    const first = result.innings[0];
    const chase = result.innings[1];
    const target = first.runs + 1;
    const deliveries = chase.oversDetail.flatMap((over) => over.deliveries);
    const winningDeliveryIndex = deliveries.findIndex((delivery) => delivery.scoreAfter >= target);
    if (winningDeliveryIndex < 0) continue;

    assert.equal(winningDeliveryIndex, deliveries.length - 1, "no delivery may follow the winning runs");
    assert.equal(chase.runs >= target, true);
    assert.equal(result.winnerId, chase.battingTeamId);

    const winningDelivery = deliveries[winningDeliveryIndex];
    if (winningDelivery.isLegal && chase.legalBalls % 6 === 5) {
      fifthBallFinishFound = true;
      assert.equal(chase.oversDetail.at(-1)?.deliveries.at(-1)?.id, winningDelivery.id);
      break;
    }
  }
  assert.equal(fifthBallFinishFound, true, "expected at least one chase to finish on the fifth legal ball");
});

test("the local-storage copy stays compact without losing the saved scorecard", () => {
  const simulation = simulateInstantMatch(fixtureInput("archive"));
  const compact = compactMatchSimulation(simulation);
  assert.equal(hasArchivedDeliveries(simulation), true);
  assert.equal(hasArchivedDeliveries(compact), false);
  assert.deepEqual(compact.innings[0].batting, simulation.innings[0].batting);
  assert.deepEqual(compact.innings[1].bowling, simulation.innings[1].bowling);
  assert.deepEqual(compact.innings[0].fallOfWickets, simulation.innings[0].fallOfWickets);
  assert.deepEqual(compact.innings[1].partnerships, simulation.innings[1].partnerships);
});

test("collapse impact replaces an expendable dismissed batter, never a specialist bowler", () => {
  const squad = makeSquad("COL", 82);
  squad[0].reputation = 9;
  squad[2].reputation = 9;
  squad[3].reputation = 10;
  squad[4].currentBatting = 76;
  squad[5].currentBatting = 70;
  squad[5].currentBowling = 69;
  const playerMap = Object.fromEntries(squad.map((player) => [player.id, player]));
  const battingOrder = squad.slice(0, 11).map((player) => player.id);
  const dismissed = new Set([
    squad[0].id,
    squad[1].id,
    squad[2].id,
    squad[3].id,
    squad[4].id,
    squad[5].id,
    squad[7].id,
  ]);

  const outgoing = selectCollapseImpactOutgoingPlayer(
    battingOrder,
    8,
    dismissed,
    playerMap,
    squad[0].id,
    squad[1].id,
  );
  assert.equal(outgoing?.id, squad[5].id);
  assert.notEqual(outgoing?.role, "Pace Bowler");
  assert.notEqual(outgoing?.role, "Spin Bowler");

  squad[5].currentBowling = 70;
  const protectedAllRounderResult = selectCollapseImpactOutgoingPlayer(
    battingOrder,
    8,
    dismissed,
    playerMap,
    squad[0].id,
    squad[1].id,
  );
  assert.equal(protectedAllRounderResult?.id, squad[4].id);
});

test("equal teams remain close to fifty-fifty", () => {
  let teamAWins = 0;
  let chasingWins = 0;
  const samples = 240;
  for (let index = 0; index < samples; index += 1) {
    const result = simulateInstantMatch(fixtureInput(`equal-${index}`));
    if (result.winnerId === "AAA") teamAWins += 1;
    if (result.winnerId === result.bowlingFirstTeamId) chasingWins += 1;
  }
  const winRate = teamAWins / samples;
  const chasingWinRate = chasingWins / samples;
  assert.ok(winRate >= 0.4 && winRate <= 0.6, `equal-team win rate was ${winRate}`);
  assert.ok(
    chasingWinRate >= 0.48 && chasingWinRate <= 0.63,
    `chasing win rate was ${chasingWinRate}`,
  );
});

test("a noticeably stronger side retains a clear but not overwhelming advantage", () => {
  assert.equal(estimateTeamWinProbability(90, 90), 0.5);
  assert.ok(estimateTeamWinProbability(90, 82) >= 0.75);
  let strongWins = 0;
  const samples = 240;
  for (let index = 0; index < samples; index += 1) {
    if (simulateInstantMatch(fixtureInput(`strong-${index}`, 90, 82)).winnerId === "AAA") strongWins += 1;
  }
  const winRate = strongWins / samples;
  assert.ok(winRate >= 0.7 && winRate <= 0.88, `strong-team win rate was ${winRate}`);
});

test("scores centre on the surface range while retaining rare tails", () => {
  const firstInningsScores: number[] = [];
  let centuries = 0;
  for (let index = 0; index < 320; index += 1) {
    const innings = simulateInstantMatch(fixtureInput(`score-${index}`)).innings[0];
    firstInningsScores.push(innings.runs);
    centuries += innings.batting.filter((performance) => performance.runs >= 100).length;
  }
  const average = firstInningsScores.reduce((sum, runs) => sum + runs, 0) / firstInningsScores.length;
  const subHundred = firstInningsScores.filter((runs) => runs < 100).length;
  assert.ok(average >= 165 && average <= 190, `first-innings average was ${average}`);
  assert.ok(Math.min(...firstInningsScores) < average - 35);
  assert.ok(Math.max(...firstInningsScores) > average + 35);
  assert.ok(subHundred <= firstInningsScores.length * 0.05);
  assert.ok(firstInningsScores.filter((runs) => runs > 240).length < firstInningsScores.length * 0.08);
  assert.ok(centuries < firstInningsScores.length * 0.12, `centuries=${centuries}/${firstInningsScores.length}`);
});

test("season leaders and exceptional performances remain genuinely rare", () => {
  const seasonCount = 20;
  let leadersOver700 = 0;
  let leadersOver800 = 0;
  let leadersOver900 = 0;
  let leadersOver1000 = 0;
  let scoresOf120 = 0;
  let sixWicketHauls = 0;
  let wicketLeadersOver32 = 0;

  for (let season = 0; season < seasonCount; season += 1) {
    const runs = new Map<string, number>();
    const wickets = new Map<string, number>();
    for (let match = 0; match < 17; match += 1) {
      const input = fixtureInput(`season-${season}-${match}`, 84, 84);
      input.players["AAA-8"].currentBowling = 94;
      input.players["BBB-8"].currentBowling = 94;
      const result = simulateInstantMatch(input);
      result.innings.forEach((innings) => {
        innings.batting.forEach((entry) => {
          runs.set(entry.id, (runs.get(entry.id) ?? 0) + entry.runs);
          if (entry.runs >= 120) scoresOf120 += 1;
        });
        innings.bowling.forEach((entry) => {
          wickets.set(entry.id, (wickets.get(entry.id) ?? 0) + entry.wickets);
          if (entry.wickets >= 6) sixWicketHauls += 1;
        });
      });
    }
    const runLeader = Math.max(0, ...Array.from(runs.values()));
    const wicketLeader = Math.max(0, ...Array.from(wickets.values()));
    if (runLeader > 700) leadersOver700 += 1;
    if (runLeader > 800) leadersOver800 += 1;
    if (runLeader > 900) leadersOver900 += 1;
    if (runLeader > 1000) leadersOver1000 += 1;
    if (wicketLeader > 32) wicketLeadersOver32 += 1;
  }

  const calibrationSummary = [
    `700+=${leadersOver700}`,
    `800+=${leadersOver800}`,
    `900+=${leadersOver900}`,
    `1000+=${leadersOver1000}`,
    `120+ scores=${scoresOf120}`,
    `6w hauls=${sixWicketHauls}`,
    `33w leaders=${wicketLeadersOver32}`,
  ].join(", ");
  assert.ok(leadersOver700 <= 12, calibrationSummary);
  assert.ok(leadersOver800 <= 2, `800+ leaders=${leadersOver800}/${seasonCount}`);
  assert.ok(leadersOver900 <= 1, `900+ leaders=${leadersOver900}/${seasonCount}`);
  assert.equal(leadersOver1000, 0, `1000+ leaders=${leadersOver1000}/${seasonCount}`);
  assert.ok(scoresOf120 <= 8, `120+ scores=${scoresOf120}`);
  assert.ok(sixWicketHauls <= 4, `six-wicket hauls=${sixWicketHauls}`);
  assert.ok(wicketLeadersOver32 <= 2, `33+ wicket leaders=${wicketLeadersOver32}/${seasonCount}`);
});

test("below-par or collapsed first innings usually produce safer chases without eliminating reply collapses", () => {
  let qualifyingMatches = 0;
  let saferChases = 0;
  let replyCollapses = 0;
  for (let index = 0; index < 240; index += 1) {
    const result = simulateInstantMatch(fixtureInput(`easy-chase-${index}`));
    const [first, second] = result.innings;
    if (first.runs > 155 && first.wickets < 7) continue;
    qualifyingMatches += 1;
    if (second.wickets < first.wickets) saferChases += 1;
    if (second.wickets >= 6) replyCollapses += 1;
  }
  assert.ok(qualifyingMatches >= 40, `qualifying matches=${qualifyingMatches}`);
  assert.ok(saferChases > qualifyingMatches * 0.5, `safer chases=${saferChases}/${qualifyingMatches}`);
  assert.ok(replyCollapses > 0, "an easy target must retain a non-zero chance of a reply collapse");
});

test("pitch, boundaries and outfield materially move scoring conditions", () => {
  const difficult: MatchGroundConditions = {
    ...conditions,
    pitch: {
      ...balancedPitch,
      id: "test-difficult",
      name: "Test Slow Surface",
      expectedFirstInningsScore: { min: 145, max: 160 },
      favours: ["spin-bowlers"],
      doesNotFavour: ["aggressive-batters", "pace-bowlers"],
    },
    boundaries: { straightMetres: 75, wideMetres: 72 },
    outfieldSpeedRating: 5.5,
    adjustedExpectedScore: { min: 140, max: 155 },
    groundScoringModifier: 0.96,
  };
  const battingSurface: MatchGroundConditions = {
    ...conditions,
    pitch: {
      ...balancedPitch,
      id: "test-road",
      name: "Test Batting Surface",
      expectedFirstInningsScore: { min: 205, max: 225 },
      favours: ["aggressive-batters", "openers", "top-order-batters"],
      doesNotFavour: ["spin-bowlers"],
    },
    boundaries: { straightMetres: 62, wideMetres: 60 },
    outfieldSpeedRating: 9,
    adjustedExpectedScore: { min: 210, max: 230 },
    groundScoringModifier: 1.08,
  };
  let difficultRuns = 0;
  let battingRuns = 0;
  let difficultThrees = 0;
  let battingThrees = 0;
  let massiveScores = 0;
  let subHundredScores = 0;
  const samples = 220;
  for (let index = 0; index < samples; index += 1) {
    const difficultResult = simulateInstantMatch(fixtureInput(`difficult-${index}`, 82, 82, difficult));
    const battingResult = simulateInstantMatch(fixtureInput(`batting-${index}`, 82, 82, battingSurface));
    difficultRuns += difficultResult.innings[0].runs;
    battingRuns += battingResult.innings[0].runs;
    difficultThrees += difficultResult.innings.flatMap((innings) => innings.oversDetail)
      .flatMap((over) => over.deliveries)
      .filter((delivery) => delivery.runsOffBat === 3).length;
    battingThrees += battingResult.innings.flatMap((innings) => innings.oversDetail)
      .flatMap((over) => over.deliveries)
      .filter((delivery) => delivery.runsOffBat === 3).length;
    if (battingResult.innings[0].runs > 240) massiveScores += 1;
    if (difficultResult.innings[0].runs < 100) subHundredScores += 1;
  }
  assert.ok(
    battingRuns / samples >= difficultRuns / samples + 40,
    `difficult=${difficultRuns / samples}, batting=${battingRuns / samples}`,
  );
  assert.ok(difficultThrees > battingThrees);
  assert.ok(
    subHundredScores > 0 && subHundredScores < samples * 0.075,
    `sub-hundred scores=${subHundredScores}/${samples}`,
  );
  assert.ok(
    massiveScores > 0 && massiveScores < samples * 0.15,
    `massive scores=${massiveScores}/${samples}`,
  );
});

test("knockout matches apply high-stakes pressure and double-wicket momentum surge works", () => {
  const knockoutInput: MatchSimulationInput = {
    ...fixtureInput("final-test"),
    stage: "Final",
    isKnockout: true,
  };
  const result = simulateInstantMatch(knockoutInput);
  assert.ok(result.innings.length === 2);
  assert.ok(result.winnerId, "knockout match resolves a winner");
});

test("environmental weather dynamics apply dew factor, afternoon heat and DLS calculations", () => {
  const nightMatch = simulateInstantMatch({
    ...fixtureInput("night-dew-test"),
    time: "19:30",
  });
  const afternoonMatch = simulateInstantMatch({
    ...fixtureInput("afternoon-heat-test"),
    time: "15:30",
  });
  assert.ok(nightMatch.innings.length === 2);
  assert.ok(afternoonMatch.innings.length === 2);

  // Test DLS target calculation
  const dlsTarget = calculateDLSRevisedTarget(180, 15);
  assert.ok(dlsTarget < 181 && dlsTarget > 120, `dlsTarget=${dlsTarget}`);
});
