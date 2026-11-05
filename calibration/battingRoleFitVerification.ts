import assert from "node:assert/strict";
import type { Player } from "../lib/types";
import { battingFitPhases, prepareBattingRoleFit, reviewBattingPhasePlan, suggestLineupBattingCoverage } from "../lib/logic/battingRoleFit";
import { createTeamTactics } from "../lib/logic/teamTactics";
import { BATTING_COVERAGE_INTENTS, type BattingCoverage, type BattingCoverageIntent } from "../lib/logic/tacticalMatchPlan";

const elite = {
  id: "opener", role: "Batsman", battingStyle: "Right-hand", currentBatting: 99,
  battingAggression: 58, isOpener: true, battingConsistency: 99, pressureRating: 99,
  bigMatchRating: 99, stamina: 99, paceRating: 99, spinRating: 99,
  powerplayBatting: 59, middleOversBatting: 56, deathBatting: 53,
} as Player;
const partner = { ...elite, id: "partner", battingStyle: "Left-hand" } as Player;
const context = {
  lineup: [elite, partner], order: [elite.id, partner.id],
  coverage: {}, tactics: createTeamTactics("Balanced"), chasing: false,
};
const opener = prepareBattingRoleFit(elite, 1, context);
const best = opener.suggest({ chase: "attack" });
assert.equal(best.chase, "attack", "Auto preserves instructions outside the grid");
assert.ok(battingFitPhases.every(phase => best[phase]), "Auto assigns an explicit instruction to every phase");
assert.ok(opener.evaluate(best).total > opener.evaluate({}).total, "Explicit recommendations beat the fallback plan");
assert.equal(opener.evaluate(best).score, 10, "An exceptional fit can earn ten");
assert.deepEqual(opener.suggest(best), best, "Auto is stable when pressed again");

const weak: Player = { ...elite, role: "Pace Bowler", isOpener: false, currentBatting: 35 };
const tail = prepareBattingRoleFit(weak, 10, context);
assert.ok(tail.evaluate(tail.suggest({})).score < 10, "Auto cannot turn low batting ability into a perfect fit");
assert.ok(tail.evaluate({ death: "attack" }).total > tail.evaluate({ death: "all-out" }).total);

const positionTestBatter = { ...elite, currentBatting: 75 };
const positionTestContext = { ...context, lineup: [positionTestBatter] };
const earlyDemand = prepareBattingRoleFit(positionTestBatter, 3, positionTestContext).evaluate({
  powerplay: "all-out", earlyMiddle: "all-out", lateMiddle: "all-out", death: "all-out",
});
const lateDemand = prepareBattingRoleFit(positionTestBatter, 7, positionTestContext).evaluate({
  powerplay: "all-out", earlyMiddle: "all-out", lateMiddle: "all-out", death: "all-out",
});
assert.notEqual(earlyDemand.positionDemand, lateDemand.positionDemand);
assert.ok(earlyDemand.factors[0].points < lateDemand.factors[0].points,
  "The same player and instructions face different ability demands at different slots");

const steadyPlan: BattingCoverage = { powerplay: "steady", earlyMiddle: "steady", lateMiddle: "steady", death: "steady" };
const abilityPoints = (currentBatting: number, slot: number, coverage = steadyPlan) =>
  prepareBattingRoleFit({ ...elite, currentBatting }, slot, context).evaluate(coverage).factors[0].points;
assert.ok(Math.abs(abilityPoints(61, 9) - abilityPoints(85, 3)) < 0.15,
  "Strong batters in their respective slots receive similar ability credit");
assert.ok(abilityPoints(61, 9) > abilityPoints(61, 3) + 1,
  "A batter can suit a lower slot without meeting top-order demands");
assert.ok(abilityPoints(61, 9, { ...steadyPlan, death: "attack" })
  > abilityPoints(61, 9, { ...steadyPlan, death: "all-out" }),
  "Higher-risk instructions still demand more ability in the tail");

const restricted = { ...elite, onlyOpensOrBenched: true };
assert.equal(prepareBattingRoleFit(restricted, 6, context).evaluate({}).factors
  .find(factor => factor.label === "Batting position")?.points, 0);
assert.ok(prepareBattingRoleFit({ ...elite, paceRating: undefined }, 1, context).evaluate({}).lowEvidence);

const aggressivePeers = prepareBattingRoleFit(elite, 1, {
  ...context, coverage: { partner: { powerplay: "all-out" } },
});
const balance = (fit: ReturnType<typeof opener.evaluate>) => fit.factors.find(factor => factor.label === "XI balance")!.points;
assert.ok(balance(aggressivePeers.evaluate({ powerplay: "attack" })) < balance(opener.evaluate({ powerplay: "attack" })));

const choices = [undefined, ...Object.keys(BATTING_COVERAGE_INTENTS) as BattingCoverageIntent[]];
for (const assessment of [opener, tail, aggressivePeers]) {
  const auto = assessment.evaluate(assessment.suggest({})).total;
  for (const first of choices) for (const second of choices) for (const third of choices) for (const fourth of choices) {
    const coverage = Object.fromEntries([first, second, third, fourth].map((choice, i) => [battingFitPhases[i], choice]));
    assert.ok(assessment.evaluate(coverage).total <= auto + 1e-9, "Auto maximises the displayed fit");
  }
}

const lineup = Array.from({ length: 11 }, (_, index) => ({
  ...elite,
  id: `batter-${index}`,
  currentBatting: 94 - index * 5,
  battingAggression: 94 - index * 5,
  isOpener: index < 2,
}));
const lineupContext = { ...context, lineup, order: lineup.map(player => player.id) };
const review = reviewBattingPhasePlan({
  ...lineupContext,
  coverage: {
    [lineup[0].id]: { powerplay: "all-out" },
    [lineup[1].id]: { powerplay: "all-out" },
    [lineup[5].id]: { death: "attack" },
    [lineup[6].id]: { death: "all-out" },
  },
});
assert.ok(review.Risk.cons.includes("Both openers go all-out in the powerplay."));
assert.ok(review.Risk.cons.some(message => message.includes("override")));
assert.ok(review.Roles.pros.includes("2 late-order options attack at the death."));
assert.ok(review.Phases.pros.includes("Death overs: 2 attacking options."));
assert.ok(review.Depth.cons.includes("Nos. 7–8 offer limited batting depth."));
assert.ok(review["Role fit"].pros.some(message => message.includes("8+ role fit")));
const tailOnly = reviewBattingPhasePlan({ ...lineupContext, coverage: { [lineup[10].id]: { death: "attack" } } });
assert.ok(tailOnly.Roles.cons.includes("Nos. 5–8 lack an attacking option at the death."));
const planWithManualChoices = {
  [lineup[0].id]: { powerplay: "survive", chase: "attack" },
  reserve: { death: "all-out" },
} satisfies Record<string, BattingCoverage>;
const selected = suggestLineupBattingCoverage({ ...lineupContext, coverage: planWithManualChoices });
assert.deepEqual(suggestLineupBattingCoverage({ ...lineupContext, coverage: selected }), selected);
const teamDefaults = suggestLineupBattingCoverage(lineupContext);
for (const player of lineup) for (const phase of battingFitPhases) {
  assert.ok(selected[player.id][phase], "Bulk Auto fills every phase for every batter");
  assert.equal(selected[player.id][phase], teamDefaults[player.id][phase],
    "Bulk selection does not depend on prior phase choices");
}
assert.equal(selected[lineup[0].id].chase, "attack");
assert.deepEqual(selected.reserve, { death: "all-out" });
assert.equal(planWithManualChoices[lineup[0].id].powerplay, "survive");

console.log("Batting role fit checks passed");
