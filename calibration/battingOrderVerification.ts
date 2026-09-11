import assert from "node:assert/strict";
import { reconcileBowlingFirstImpactPlan } from "../lib/logic/aiLineupSelector";
import { HOME_STADIUMS, getDefaultCuratorPitch } from "../lib/data/pitchCurator";
import { simulateInstantMatch } from "../lib/logic/matchSimulation";
import { calculateGroundScoringImpact, calculateOutfieldSpeedRating, getDefaultOutfieldSettings } from "../lib/logic/stadiumManagement";
import { createTeamTactics } from "../lib/logic/teamTactics";

const player = (id: string, role: "Batsman" | "Pace Bowler" | "Spin Bowler", batting: number, bowling: number, extras: Record<string, unknown> = {}) => ({
  id, name: id, role, nationality: "Indian", currentBatting: batting, currentBowling: bowling,
  potentialBatting: batting, potentialBowling: bowling, reputation: 5, ...extras,
}) as any;

const opener1 = player("opener-1", "Batsman", 78, 10, { isOpener: true });
const opener2 = player("opener-2", "Batsman", 76, 10, { isOpener: true });
const core1 = player("core-1", "Batsman", 88, 10, { isCoreBatter: true, hasBattedAt3: true });
const core2 = player("core-2", "Batsman", 80, 15, { isCoreBatter: true, hasBattedAt4: true });
const incumbentFinisher = player("incumbent-finisher", "Batsman", 72, 20, { isFinisher: true, hasBattedAt6: true });
const lowerBatter = player("lower-batter", "Batsman", 64, 15, { hasBattedAt7: true });
const bowlers = Array.from({ length: 5 }, (_, index) => player(
  `bowler-${index + 1}`,
  index === 4 ? "Spin Bowler" : "Pace Bowler",
  32 + index * 4,
  84 - index,
));
const bowlFirstXI = [opener1, opener2, core1, core2, incumbentFinisher, lowerBatter, ...bowlers];
const bowlFirstPlaceholderXI = [
  opener1, opener2, core1, core2, bowlers[0], incumbentFinisher, lowerBatter, ...bowlers.slice(1),
];
const ashutosh = player("ashutosh-impact", "Batsman", 80, 10, { isFinisher: true, hasBattedAt6: true, hasBattedAt7: true });
const reserveBatter = player("reserve-batter", "Batsman", 68, 10, { hasBattedAt7: true });

const reconciled = reconcileBowlingFirstImpactPlan(
  [...bowlFirstXI, ashutosh, reserveBatter],
  bowlFirstPlaceholderXI.map((candidate) => candidate.id),
  [reserveBatter.id, ashutosh.id],
);

assert.equal(reconciled.impactPlayerId, ashutosh.id, "the strongest suitable batting substitute should be selected");
assert.ok(
  reconciled.battingPosition !== null && reconciled.battingPosition >= 5 && reconciled.battingPosition <= 8,
  "a finisher should receive a suitable middle/lower-middle-order entry position",
);
assert.ok(
  reconciled.outgoingPlayerId === bowlers[0].id,
  "the batting substitute should replace the bowling placeholder occupying number five",
);

// A reciprocal bowl-first plan temporarily puts the extra bowler in the
// displaced batter's exact slot. Reconciliation must reverse that same pair,
// including at #1/#2, instead of removing a weaker lower-order bowler and
// leaving the placeholder to open the chase.
const head = player("travis-head", "Batsman", 89, 60, { isOpener: true, onlyOpensOrBenched: true });
const abhishek = player("abhishek-sharma", "Batsman", 90, 69, { isOpener: true, hasBattedAt3: true });
const tushar = player("tushar-deshpande", "Pace Bowler", 50, 80);
const weakerLowerOrderBowler = player("lower-order-bowler", "Pace Bowler", 35, 78);
const openingPlaceholderXI = [
  head,
  tushar,
  core1,
  core2,
  incumbentFinisher,
  lowerBatter,
  bowlers[0],
  weakerLowerOrderBowler,
  bowlers[2],
  bowlers[3],
  bowlers[4],
];
const openingPairRepair = reconcileBowlingFirstImpactPlan(
  [...openingPlaceholderXI, abhishek],
  openingPlaceholderXI.map((candidate) => candidate.id),
  [abhishek.id],
  new Set(),
  {
    impactPlayerId: abhishek.id,
    outgoingPlayerId: tushar.id,
    battingPosition: 2,
  },
);
assert.deepEqual(
  openingPairRepair,
  { impactPlayerId: abhishek.id, outgoingPlayerId: tushar.id, battingPosition: 2 },
  "the returning opener must replace the exact bowler occupying their opening slot",
);

const simulationSquad = (prefix: string) => {
  const cloned = [...bowlFirstXI, ashutosh].map((candidate) => ({
    ...candidate,
    id: `${prefix}-${candidate.id}`,
    name: `${prefix}-${candidate.name}`,
  }));
  const byOriginalId = Object.fromEntries(
    [...bowlFirstXI, ashutosh].map((candidate, index) => [candidate.id, cloned[index]]),
  );
  const placeholderOrder = [
    opener1, opener2, core1, core2, bowlers[0], incumbentFinisher, lowerBatter, ...bowlers.slice(1),
  ].map((candidate) => byOriginalId[candidate.id].id);
  return {
    players: cloned,
    startingXI: placeholderOrder,
    incomingId: byOriginalId[ashutosh.id].id,
    outgoingId: byOriginalId[bowlers[0].id].id,
  };
};

const squadA = simulationSquad("A");
const squadB = simulationSquad("B");
const simulationPlayers = Object.fromEntries(
  [...squadA.players, ...squadB.players].map((candidate) => [candidate.id, candidate]),
);
const planFor = (teamId: string, squad: ReturnType<typeof simulationSquad>) => ({
  teamId,
  isUserControlled: true,
  tactics: createTeamTactics("Balanced"),
  battingFirst: { startingXI: squad.startingXI, impactSubs: [squad.incomingId] },
  bowlingFirst: {
    startingXI: squad.startingXI,
    impactSubs: [squad.incomingId],
    plannedImpactPlayerId: squad.incomingId,
    plannedOutgoingPlayerId: squad.outgoingId,
    plannedImpactBattingPosition: 5,
    // Captains/vice-captains may legally be nominated as the outgoing Impact
    // Player; the simulator must respect the explicit plan in that case.
    captainId: squad.outgoingId,
  },
});
const stadium = HOME_STADIUMS[0];
const pitch = getDefaultCuratorPitch(stadium.teamId)!;
const outfield = getDefaultOutfieldSettings(stadium.teamId)!;
const groundImpact = calculateGroundScoringImpact(stadium.teamId, stadium.defaultBoundaryDimensions, outfield);
const simulated = simulateInstantMatch({
  fixtureId: "impact-placeholder-regression",
  matchNumber: 1,
  seed: "impact-placeholder-regression",
  teamA: { id: "A", name: "A", squad: squadA.players.map((candidate) => candidate.id) } as any,
  teamB: { id: "B", name: "B", squad: squadB.players.map((candidate) => candidate.id) } as any,
  players: simulationPlayers,
  teamAPlans: planFor("A", squadA),
  teamBPlans: planFor("B", squadB),
  conditions: {
    homeTeamId: "A",
    stadiumId: stadium.id,
    stadiumName: stadium.name,
    pitch,
    boundaries: stadium.defaultBoundaryDimensions,
    outfield,
    outfieldSpeedRating: calculateOutfieldSpeedRating(stadium.teamId, outfield),
    adjustedExpectedScore: pitch.expectedFirstInningsScore,
    groundScoringModifier: groundImpact.modifier,
    chasingScoringBonus: 0,
  },
  weatherScenario: {
    kind: "clear",
    rainDelayMinutes: 0,
    firstInningsOvers: 20,
    secondInningsOvers: 20,
    summary: "Clear weather.",
  },
});
const chasingSquad = simulated.bowlingFirstTeamId === "A" ? squadA : squadB;
const chasingImpact = simulated.impactDecisions.find((decision) => decision.teamId === simulated.bowlingFirstTeamId)!;
assert.equal(chasingImpact.used, true, "the bowling-first plan must activate before the chase");
assert.equal(chasingImpact.incomingPlayerId, chasingSquad.incomingId);
assert.equal(chasingImpact.outgoingPlayerId, chasingSquad.outgoingId);
assert.equal(chasingImpact.battingPosition, 5);
assert.equal(
  simulated.innings[1].batting[4]?.id,
  chasingSquad.incomingId,
  "the batting Impact Player must replace the top-order bowling placeholder at number five",
);

console.log("Bowling-first Impact-plan verification passed.");
