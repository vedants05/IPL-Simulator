import assert from "node:assert/strict";
import { HOME_STADIUMS, getDefaultCuratorPitch } from "../lib/data/pitchCurator";
import { getDefaultOutfieldSettings } from "../lib/logic/stadiumManagement";
import { simulateInstantMatch, simulatePlayableMatch, type MatchSimulationInput, type MatchTeamPlans } from "../lib/logic/matchSimulation";
import { createTeamTactics, normalizeTeamTactics, applyTeamTacticsPreset } from "../lib/logic/teamTactics";
import { activeBattingTarget, applyBattingTarget, applyBowlerOverTargetModes, emptyTacticalMatchPlan, normalizeTacticalMatchPlan, matchOverAssignments, canCompleteAssignedOvers, bowlingPlanWarnings, chooseFloater, battingRoleIntent, battingCoveragePhase, shapeBattingTargetRuns, toggleBattingTargetMode, type TacticalMatchPlan } from "../lib/logic/tacticalMatchPlan";
import type { Player, Team } from "../lib/types";
import { resolveSpecialBattingRule, selectSpecialBattingRule, applySpecialBattingRuleIntent, shapeSpecialBattingRuleRuns, type BattingSpecialRule } from "../lib/logic/tacticalMatchPlan";
import { getFloaterRules, floaterRulesConflict, floaterRuleError, normalizeFloaterRules, type FloaterRule } from "../lib/logic/tacticalMatchPlan";

{
const boundaryRules: BattingSpecialRule[] = [{ kind: "boundary-target", threshold: 1, fromOver: 7, untilOver: 15 }];
const specialState = { over: 7, boundariesThisOver: 0, inningsBalls: 36, wickets: 2 };
assert.deepEqual(resolveSpecialBattingRule(boundaryRules, specialState), ["attack", "boundaries"]);
assert.equal(resolveSpecialBattingRule(boundaryRules, { ...specialState, boundariesThisOver: 1 }), undefined, "Either batter meeting the team's target releases the boundary instruction");
assert.equal(resolveSpecialBattingRule(boundaryRules, { ...specialState, boundariesThisOver: 1, strikerBatting: 45, partnerBatting: 90 }), undefined, "Changing striker does not restart the team's boundary target");
assert.deepEqual(resolveSpecialBattingRule(boundaryRules, { ...specialState, over: 8 }), ["attack", "boundaries"], "A new over restarts the target");
assert.equal(resolveSpecialBattingRule(boundaryRules, { ...specialState, over: 6 }), undefined);
assert.deepEqual(resolveSpecialBattingRule(boundaryRules, { ...specialState, over: 15 }), ["attack", "boundaries"]);
assert.equal(resolveSpecialBattingRule(boundaryRules, { ...specialState, over: 16 }), undefined);
const settle: BattingSpecialRule = { kind: "settle-in", threshold: 6, fromOver: 1, untilOver: 20 };
assert.deepEqual(resolveSpecialBattingRule([settle, ...boundaryRules], { ...specialState, inningsBalls: 5 }), ["see-off", "rotate"], "First matching rule wins");
assert.deepEqual(resolveSpecialBattingRule([settle, ...boundaryRules], { ...specialState, inningsBalls: 6 }), ["attack", "boundaries"], "Settling ends at the innings balls threshold and does not restart for a new batter");
const chaseRule: BattingSpecialRule = { kind: "chase-rate", threshold: 10, fromOver: 1, untilOver: 20 };
assert.equal(resolveSpecialBattingRule([chaseRule], specialState), undefined, "Chase rule is inactive batting first");
assert.equal(resolveSpecialBattingRule([chaseRule], { ...specialState, requiredRate: 9 }), undefined);
assert.deepEqual(resolveSpecialBattingRule([chaseRule], { ...specialState, requiredRate: 10 }), ["attack", "rotate"]);
for (const [kind, threshold, wickets, expected] of [
  ["rebuild", 3, 3, ["see-off"]], ["finish", 5, 5, ["all-out"]],
] as const) assert.deepEqual(resolveSpecialBattingRule([{ kind, threshold, fromOver: 1, untilOver: 20 }], { ...specialState, wickets }), expected);
assert.equal(resolveSpecialBattingRule([{ kind: "finish", threshold: 5, fromOver: 1, untilOver: 20 }], { ...specialState, wickets: 6 }), undefined);
const shield: BattingSpecialRule[] = [{ kind: "shield-tail", threshold: 7, fromOver: 1, untilOver: 20 }];
assert.deepEqual(resolveSpecialBattingRule(shield, { ...specialState, wickets: 7, strikerBatting: 80, partnerBatting: 40, partnerPosition: 10 }), ["keep-strike"]);
assert.equal(resolveSpecialBattingRule(shield, { ...specialState, wickets: 7, strikerBatting: 40, partnerBatting: 80, partnerPosition: 5 }), undefined, "The tailender must not shield the stronger batter");
assert.equal(resolveSpecialBattingRule(shield, { ...specialState, wickets: 7, strikerBatting: 83, partnerBatting: 79, partnerPosition: 8 }), undefined, "Similar-strength batters do not shield each other");
const normalizedSpecial = normalizeTacticalMatchPlan({ battingSpecialRules: {
  a: [{ kind: "invalid" }, { kind: "boundary-target", threshold: 100, fromOver: 7, untilOver: 3 }, settle, chaseRule, settle],
  b: "bad",
} });
assert.equal(normalizedSpecial.battingTeamRules?.length, 3);
assert.deepEqual(normalizedSpecial.battingTeamRules?.[0], { kind: "boundary-target", threshold: 3, fromOver: 7, untilOver: 7, priority: 2 });
assert.deepEqual(normalizeTacticalMatchPlan({ battingSpecialRules: { a: [settle], b: [settle] } }).battingTeamRules, [{ ...settle, priority: 2 }], "Legacy player rules become deduplicated team rules with a default strong priority");
assert.equal(normalizeTacticalMatchPlan({ battingSpecialRules: { a: [settle] }, battingTeamRules: [] }).battingTeamRules, undefined, "Clearing team rules must not revive legacy player rules");
assert.deepEqual(normalizeTacticalMatchPlan(JSON.parse(JSON.stringify(normalizedSpecial))), normalizedSpecial, "Special rules survive save/load");
const priorityRules = ([1, 2, 3] as const).map(priority => ({ ...boundaryRules[0], priority }));
assert.equal(selectSpecialBattingRule(priorityRules, specialState)?.priority, 3, "Highest matching priority wins regardless of row order");
assert.equal(selectSpecialBattingRule([{ ...settle, priority: 3 }, ...priorityRules], { ...specialState, inningsBalls: 6 })?.kind, "boundary-target", "An inactive must-do rule cannot block matching rules");
assert.equal(selectSpecialBattingRule([{ ...settle, priority: 3 }, ...priorityRules], { ...specialState, inningsBalls: 5 })?.kind, "settle-in", "Equal priorities use first listed matching rule");
const priorityIntents = priorityRules.map(rule => applySpecialBattingRuleIntent(-0.18, rule));
assert.ok(priorityIntents[0] > -0.18 && priorityIntents[0] < priorityIntents[1] && priorityIntents[1] < priorityIntents[2], "Priority progressively increases influence over player intent");
assert.equal(priorityIntents[2], 0.13, "Must do applies the rule's required attack intent fully");
assert.equal(applySpecialBattingRuleIntent(0.2, { ...settle, priority: 3 }), -0.12, "Must-do recovery overrides a player's all-out instruction");
const baseWeights = { dot: 0.3, single: 0.4, two: 0.1, three: 0.01, four: 0.12, six: 0.05 };
const boundaryWeights = priorityRules.map(rule => shapeSpecialBattingRuleRuns(baseWeights, ["see-off"], rule, false));
assert.ok(boundaryWeights[0].four < boundaryWeights[1].four && boundaryWeights[1].four < boundaryWeights[2].four, "Scoring decisions also change with priority");
assert.deepEqual(boundaryWeights[2], shapeBattingTargetRuns(baseWeights, ["attack", "boundaries"], false), "Must-do scoring fully replaces conflicting matchup instructions");
assert.deepEqual(shapeSpecialBattingRuleRuns(baseWeights, ["rotate"], undefined, false), shapeBattingTargetRuns(baseWeights, ["rotate"], false), "No rule preserves existing batting behaviour");
assert.equal(normalizeTacticalMatchPlan({ battingTeamRules: [{ ...settle, priority: 99 }] }).battingTeamRules?.[0].priority, 3);
}

const normalizedBowlerTargets = normalizeTeamTactics({ bowlerBattingInstructions: { bowler: { approach: "normal", overs: ["react", "react", "rotate", "boundary"] } } });
assert.deepEqual(normalizedBowlerTargets.bowlerBattingInstructions?.bowler.overs, ["follow", "react", "rotate", "boundary"], "Only the first bowler over cannot react to a previous over");
const shotWeights = { dot: 0.3, single: 0.4, two: 0.1, three: 0.01, four: 0.12, six: 0.05 };
const rotateModes = applyBowlerOverTargetModes(["keep-strike", "attack"], "rotate");
assert.deepEqual(rotateModes, ["attack", "rotate"]);
assert.ok(shapeSpecialBattingRuleRuns(shotWeights, rotateModes, undefined, false).single > shotWeights.single, "Rotate increases singles");
const boundaryModes = applyBowlerOverTargetModes(["rotate"], "boundary");
assert.ok(shapeSpecialBattingRuleRuns(shotWeights, boundaryModes, undefined, false).four > shotWeights.four, "Boundary target increases boundary weighting");
assert.deepEqual(applyBowlerOverTargetModes(["rotate"], "follow"), ["rotate"]);
assert.deepEqual(shapeSpecialBattingRuleRuns(shotWeights, boundaryModes, { kind: "rebuild", threshold: 3, fromOver: 1, untilOver: 20, priority: 3 }, false), shapeBattingTargetRuns(shotWeights, ["see-off"], false), "Must-do team rules override bowler-specific scoring");
assert.equal(normalizeTeamTactics({}).matchPlans, undefined, "old saves retain automatic selection");
const malformed = normalizeTacticalMatchPlan({overs: [{playerId: "a", mode: "bad"}], roles: {a: "bad"}, floater: {playerId: "b", earliestPosition: 20, latestPosition: -1, fromOver: 100}});
assert.equal(malformed.overs.length, 20);
assert.equal(malformed.overs[0], null);
assert.deepEqual(malformed.roles, {});
assert.equal(malformed.floater?.earliestPosition, 11);
assert.equal(malformed.floater?.latestPosition, 11);
assert.equal(malformed.floater?.fromOver, 20);
const targets = normalizeTacticalMatchPlan({
  battingTargets: {
    a: { spin: "attack", pace: "invalid" },
    b: { pace: { modes: ["rotate", "keep-strike", "boundaries"], fromOver: 7, untilOver: 15 } },
    c: { spin: { mode: "see-off", fromOver: 2, untilOver: 4 } },
    spin: "attack",
  },
}).battingTargets;
assert.deepEqual(targets, {
  a: { spin: { modes: ["attack"], fromOver: 1, untilOver: 20 } },
  b: { pace: { modes: ["keep-strike", "boundaries"], fromOver: 7, untilOver: 15 } },
  c: { spin: { modes: ["see-off"], fromOver: 2, untilOver: 4 } },
} as const);
const spinTarget = activeBattingTarget(targets?.a, "spin", 1);
assert.equal(applyBattingTarget(-0.12, spinTarget), 0.13);
assert.equal(applyBattingTarget(0.20, spinTarget), 0.20, "Attack does not reduce existing intent");
assert.equal(applyBattingTarget(0.20, ["see-off"]), -0.12);
assert.equal(activeBattingTarget(targets?.b, "spin", 10), undefined, "A teammate's spin instruction does not apply");
for (const over of [6, 16]) assert.equal(activeBattingTarget(targets?.b, "pace", over), undefined);
for (const over of [7, 15]) assert.deepEqual(activeBattingTarget(targets?.b, "pace", over), ["keep-strike", "boundaries"]);
const neutralRuns = { dot: 0.3, single: 0.4, two: 0.1, three: 0.01, four: 0.12, six: 0.05 };
const combination = toggleBattingTargetMode(["keep-strike"], "boundaries");
assert.deepEqual(combination, ["keep-strike", "boundaries"]);
assert.deepEqual(toggleBattingTargetMode(combination, "rotate"), ["boundaries", "rotate"]);
assert.deepEqual(toggleBattingTargetMode(combination, "boundaries"), ["keep-strike"]);
const earlyRuns = shapeBattingTargetRuns(neutralRuns, combination, false);
assert.ok(earlyRuns.single < neutralRuns.single && earlyRuns.six > neutralRuns.six);
const lastBallRuns = shapeBattingTargetRuns(neutralRuns, combination, true);
assert.ok(lastBallRuns.single > neutralRuns.single && lastBallRuns.six > neutralRuns.six);
assert.ok(shapeBattingTargetRuns(neutralRuns, ["rotate"], false).single > neutralRuns.single);
assert.deepEqual(shapeBattingTargetRuns(neutralRuns, undefined, false), neutralRuns);
assert.equal(normalizeTacticalMatchPlan({ battingTargets: { pace: "attack" } }).battingTargets, undefined,
  "Old team-wide instructions are not assigned to individual batters");
const saved = {...createTeamTactics(), matchPlans: {battingFirst: emptyTacticalMatchPlan()}};
saved.matchPlans.battingFirst.overs[19] = {playerId: "a", mode: "fixed"};
assert.deepEqual(normalizeTeamTactics(JSON.parse(JSON.stringify(saved))).matchPlans, saved.matchPlans);
assert.deepEqual(applyTeamTacticsPreset(saved, "Ultra Aggressive").matchPlans, saved.matchPlans);
assert.equal(matchOverAssignments(saved.matchPlans.battingFirst, 12)[11]?.playerId, "a");
const impossible = emptyTacticalMatchPlan();
impossible.overs[18] = impossible.overs[19] = {playerId: "a", mode: "fixed"};
assert.equal(canCompleteAssignedOvers(1, 20, null, new Map([...["a", "b", "c", "d", "e"].map(id => [id, 4] as const)]), impossible.overs), false);
assert.ok(bowlingPlanWarnings(impossible, ["a"]).some(w => w.includes("consecutive")));
const reserved = emptyTacticalMatchPlan();
[13, 15, 17, 19].forEach(i => reserved.overs[i] = {playerId: "a", mode: "fixed"});
assert.equal(canCompleteAssignedOvers(2, 20, "a", new Map([["a", 3], ["b", 4], ["c", 4], ["d", 4], ["e", 4]]), reserved.overs), false, "auto selection must preserve all four late overs");
assert.equal(canCompleteAssignedOvers(2, 20, "b", new Map([["a", 4], ["b", 3], ["c", 4], ["d", 4], ["e", 4]]), reserved.overs), true);

const order = ["a", "b", "c", "d", "e", "f"];
const rule = {playerId: "f", earliestPosition: 3, latestPosition: 5, fromOver: 8, trigger: "spin" as const, requiredRate: 10};
assert.equal(chooseFloater(rule, order, 2, order, 48, 20, "spin"), "f");
assert.equal(chooseFloater(rule, order, 2, order, 12, 20, "spin"), undefined);
assert.equal(chooseFloater(rule, order, 2, order, 48, 20, "pace"), undefined);
assert.equal(chooseFloater(rule, order, 2, order.slice(0, 5), 48, 20, "spin"), undefined);
assert.equal(chooseFloater(rule, ["a", "f", "b", "c"], 2, order, 48, 20, "spin"), undefined);
assert.equal(chooseFloater({...rule, trigger: "required-rate"}, order, 2, order, 48, 20, "spin", 9), undefined);
assert.equal(chooseFloater({...rule, trigger: "required-rate"}, order, 2, order, 48, 20, "spin", 11), "f");
assert.equal(chooseFloater(rule, order, 2, order, 24, 10, "spin"), "f");
{
  const wicketRule: FloaterRule = { ...rule, trigger: "wickets", wickets: 3, earliestPosition: 4, latestPosition: 5, fromOver: 1 };
  const migrated = normalizeTacticalMatchPlan({ floater: wicketRule });
  assert.equal(migrated.floaters?.[0].earliestPosition, 5, "Three wickets down requires No. 5 or later");
  assert.equal(getFloaterRules(migrated).length, 1, "Legacy single floaters migrate");
  assert.deepEqual(getFloaterRules(normalizeTacticalMatchPlan({ floater: wicketRule, floaters: [] })), [], "An explicit empty list clears a legacy floater");
  assert.equal(chooseFloater(wicketRule, order, 3, order, 48, 20, "spin", undefined, 3), undefined);
  assert.equal(chooseFloater(wicketRule, order, 4, order, 48, 20, "spin", undefined, 3), "f");
  assert.match(floaterRuleError(wicketRule, order, [])!, /No\. 5/);
  const extendedOrder = [...order, "g", "h", "i", "j", "k"];
  const windows: FloaterRule[] = [
    { ...rule, playerId: "g", trigger: "over", fromOver: 1, untilOver: 6 },
    { ...rule, playerId: "h", trigger: "over", fromOver: 7, untilOver: 15 },
    { ...rule, playerId: "i", trigger: "over", fromOver: 16, untilOver: 20 },
  ];
  assert.equal(normalizeFloaterRules(windows).length, 3);
  assert.equal(normalizeFloaterRules([...windows, { ...windows[0], playerId: "j" }]).length, 3);
  for (const [balls, expected] of [[30, "g"], [36, "h"], [90, "i"]] as const) {
    assert.equal(chooseFloater(windows, extendedOrder, 2, extendedOrder, balls, 20, "spin"), expected);
  }
  assert.equal(chooseFloater(windows, extendedOrder, 2, extendedOrder, 120, 20, "spin"), undefined);
  const spin: FloaterRule = { ...windows[0], trigger: "spin", untilOver: 20 };
  const pace: FloaterRule = { ...spin, playerId: "h", trigger: "pace" };
  assert.equal(floaterRulesConflict(spin, pace), false);
  assert.equal(chooseFloater([spin, pace], extendedOrder, 2, extendedOrder, 48, 20, "spin"), "g");
  assert.equal(chooseFloater([spin, pace], extendedOrder, 2, extendedOrder, 48, 20, "pace"), "h");
  assert.equal(floaterRulesConflict(spin, { ...pace, trigger: "over" }), true);
  assert.equal(floaterRulesConflict(spin, { ...pace, playerId: spin.playerId }), true, "Only one rule per floater");
  assert.equal(floaterRulesConflict(spin, { ...pace, earliestPosition: 6, latestPosition: 6, trigger: "over" }), false);
  assert.equal(floaterRulesConflict({ ...spin, trigger: "wickets", wickets: 2 }, { ...pace, trigger: "wickets", wickets: 3 }), true, "Different minimum wicket triggers can overlap");
  assert.equal(floaterRulesConflict({ ...spin, trigger: "required-rate" }, { ...pace, trigger: "wickets", wickets: 2 }), true);
  assert.match(floaterRuleError({ ...spin, playerId: "h" }, extendedOrder, [spin])!, /Overlaps/);
  assert.match(floaterRuleError({ ...spin, earliestPosition: 7, latestPosition: 7 }, extendedOrder, [])!, /earlier/);
  assert.equal(normalizeFloaterRules([spin, { ...pace, trigger: "over" }]).length, 1, "Invalid saved overlaps are removed");
  const savedFloaters = normalizeTacticalMatchPlan({ floaters: windows });
  assert.deepEqual(normalizeTacticalMatchPlan(JSON.parse(JSON.stringify(savedFloaters))), savedFloaters);
  const shortWindows: FloaterRule[] = [{ ...spin, fromOver: 1, untilOver: 1, trigger: "over" }, { ...pace, fromOver: 2, untilOver: 2, trigger: "over" }];
  assert.equal(chooseFloater(shortWindows, extendedOrder, 2, extendedOrder, 0, 5, "pace"), undefined, "Rain-compressed conflicting entries stay automatic");
}
assert.equal(battingRoleIntent("powerplay-aggressor", 2, 20, 0, "pace"), .1);
assert.equal(battingRoleIntent("powerplay-aggressor", 9, 20, 0, "pace"), 0);
assert.equal(battingRoleIntent("stabiliser", 9, 20, 2, "spin"), -.1);
assert.equal(battingRoleIntent("spin-attacker", 9, 20, 0, "pace"), 0);
assert.equal(battingRoleIntent("finisher", 18, 20, 0, "pace"), .12);

const players: Record<string, Player> = Object.fromEntries(["A", "B"].flatMap(team => Array.from({length: 11}, (_, i) => {
  const id = `${team}-${i}`;
  return [id, {id, name: id, role: i < 6 ? "Batsman" : "Pace Bowler", nationality: "Indian", currentBatting: i < 6 ? 85 : 35, currentBowling: i < 6 ? 0 : 80, potentialBatting: 85, potentialBowling: 80, reputation: 5, battingAggression: 65, bowlingEconomyControl: 70} as Player];
})));
const team = (id: string) => ({id, name: id, squad: Object.keys(players).filter(key => key.startsWith(id))} as Team);
function instructions(id: string, offset: number): TacticalMatchPlan {
  const result = emptyTacticalMatchPlan();
  result.overs = Array.from({length: 20}, (_, i) => ({playerId: `${id}-${6 + (i + offset) % 5}`, mode: "fixed"}));
  result.floater = {playerId: `${id}-5`, earliestPosition: 3, latestPosition: 5, fromOver: 1, trigger: "over", requiredRate: 10};
  return result;
}
const plans = (id: string): MatchTeamPlans => ({teamId: id, isUserControlled: true, tactics: {...createTeamTactics(), matchPlans: {battingFirst: instructions(id, 0), bowlingFirst: instructions(id, 1)}}, battingFirst: {startingXI: team(id).squad, impactSubs: []}, bowlingFirst: {startingXI: team(id).squad, impactSubs: []}});
const stadium = HOME_STADIUMS[0];
const input: MatchSimulationInput = {fixtureId: "tactical-plan", matchNumber: 1, seed: "tactical-plan", teamA: team("A"), teamB: team("B"), players, teamAPlans: plans("A"), teamBPlans: plans("B"), conditions: {homeTeamId: "A", stadiumId: stadium.id, stadiumName: stadium.name, pitch: getDefaultCuratorPitch(stadium.teamId)!, boundaries: stadium.defaultBoundaryDimensions, outfield: getDefaultOutfieldSettings(stadium.teamId)!, outfieldSpeedRating: 7.5, adjustedExpectedScore: {min: 180, max: 180}, groundScoringModifier: 0, chasingScoringBonus: 0}, weatherScenario: {kind: "clear", rainDelayMinutes: 0, firstInningsOvers: 20, secondInningsOvers: 20, summary: "Clear"}};
let verifiedOvers = 0;
for (let seed = 0; seed < 8; seed++) {
  const result = simulateInstantMatch({...input, seed: `tactical-plan-${seed}`});
  result.innings.forEach((innings, index) => {
    const bowlingId = innings.battingTeamId === "A" ? "B" : "A";
    const slots = instructions(bowlingId, index === 0 ? 1 : 0).overs;
    for (const over of innings.oversDetail) {
      assert.equal(over.bowlerId, slots[over.number - 1]?.playerId, "legal fixed overs must be followed in the correct scenario");
      verifiedOvers++;
    }
    if (innings.wickets > 0) assert.equal(innings.batting.filter(row => !row.didNotBat)[2]?.id, `${innings.battingTeamId}-5`, "floater must enter at first wicket");
    assert.equal(innings.batting.filter(row => row.id === `${innings.battingTeamId}-5`).length, 1, "floater appears once");
  });
}
const baseline = simulateInstantMatch(input);
{
  const multiPlans = (id: string) => {
    const result = plans(id);
    const floaters: FloaterRule[] = [5, 6, 7].map((playerIndex, index) => ({ playerId: `${id}-${playerIndex}`,
      earliestPosition: index + 3, latestPosition: index + 3, fromOver: 1, trigger: "over", requiredRate: 10 }));
    for (const scenario of ["battingFirst", "bowlingFirst"] as const) result.tactics!.matchPlans![scenario] = { ...result.tactics!.matchPlans![scenario]!, floaters };
    return result;
  };
  const multi = simulateInstantMatch({ ...input, teamAPlans: multiPlans("A"), teamBPlans: multiPlans("B"), seed: "multi-floaters" });
  for (const innings of multi.innings) {
    const entrants = innings.batting.filter(row => !row.didNotBat);
    for (let index = 0; index < Math.min(3, entrants.length - 2); index++) {
      assert.equal(entrants[index + 2]?.id, `${innings.battingTeamId}-${index + 5}`, "The match engine executes all three non-conflicting promotions");
    }
  }
}
const userBowlingInnings = baseline.innings[0].battingTeamId === "A" ? 2 : 1;
const userBattingInnings = 3 - userBowlingInnings;
const decisions = {tossDecision: baseline.tossDecision, tossResultAcknowledged: true, deliveryControls: {}, bowlerByOver: {[`${userBowlingInnings}-1`]: "A-10"}, batterByWicket: {[`${userBattingInnings}-1`]: "A-4"}};
const live = simulatePlayableMatch(input, "A", decisions, 10000);
assert.ok(live.complete && live.simulation);
assert.equal(live.simulation.innings[userBowlingInnings - 1].oversDetail[0].bowlerId, "A-10", "manual bowling overrides the saved plan");
assert.equal(live.simulation.innings[userBattingInnings - 1].batting.filter(row => !row.didNotBat)[2]?.id, "A-4", "manual batting overrides the floater");
assert.deepEqual(simulatePlayableMatch(input, "A", decisions, 10000).simulation?.innings, live.simulation.innings, "saved plans replay deterministically");

// Invalid/unavailable assignments must complete safely with legal replacements.
const invalidInput = {...input, teamAPlans: plans("A"), teamBPlans: plans("B")};
for (const teamPlan of [invalidInput.teamAPlans, invalidInput.teamBPlans]) for (const plan of Object.values(teamPlan.tactics.matchPlans!)) plan!.overs = Array.from({length: 20}, (_, i) => ({playerId: i % 2 ? `${teamPlan.teamId}-6` : "missing-player", mode: "fixed"}));
const fallback = simulateInstantMatch(invalidInput);
for (const innings of fallback.innings) {
  const counts = new Map<string, number>();
  innings.oversDetail.forEach((over, i) => {
    assert.notEqual(over.bowlerId, "missing-player");
    if (i) assert.notEqual(over.bowlerId, innings.oversDetail[i - 1].bowlerId);
    counts.set(over.bowlerId, (counts.get(over.bowlerId) ?? 0) + 1);
  });
  assert.ok(Array.from(counts.values()).every(count => count <= 4));
}
const reservedInput = {...input, teamAPlans: plans("A"), teamBPlans: plans("B")};
for (const teamPlan of [reservedInput.teamAPlans, reservedInput.teamBPlans]) for (const plan of Object.values(teamPlan.tactics.matchPlans!)) {
  plan!.overs = emptyTacticalMatchPlan().overs;
  [13, 15, 17, 19].forEach(i => plan!.overs[i] = {playerId: `${teamPlan.teamId}-6`, mode: "fixed"});
}
for (let seed = 0; seed < 5; seed++) {
  const match = simulateInstantMatch({...reservedInput, seed: `reserved-${seed}`});
  for (const innings of match.innings) {
    const id = `${innings.battingTeamId === "A" ? "B" : "A"}-6`;
    for (const over of innings.oversDetail) assert.equal(over.bowlerId === id, [14, 16, 18, 20].includes(over.number), "automatic overs preserve the bowler's late fixed allocation");
  }
}
const shortInput = {...input, teamAPlans: plans("A"), teamBPlans: plans("B"), weatherScenario: {...input.weatherScenario!, firstInningsOvers: 10, secondInningsOvers: 10}};
for (const teamPlan of [shortInput.teamAPlans, shortInput.teamBPlans]) for (const plan of Object.values(teamPlan.tactics.matchPlans!)) {
  plan!.overs = emptyTacticalMatchPlan().overs;
  plan!.overs[17] = {playerId: `${teamPlan.teamId}-6`, mode: "fixed"};
  plan!.overs[19] = {playerId: `${teamPlan.teamId}-6`, mode: "fixed"};
}
const short = simulateInstantMatch(shortInput);
for (const innings of short.innings) {
  const id = `${innings.battingTeamId === "A" ? "B" : "A"}-6`;
  for (const over of innings.oversDetail) if ([8, 10].includes(over.number)) assert.equal(over.bowlerId, id, "death slots move to the shortened innings finish");
  assert.ok(innings.bowling.every(row => row.balls <= 12), "short innings quota respected");
}
const automaticInput = {...input, teamAPlans: plans("A"), teamBPlans: plans("B")};
for (const p of [automaticInput.teamAPlans, automaticInput.teamBPlans]) p.tactics = createTeamTactics();
const automatic = simulateInstantMatch(automaticInput);
for (const p of [automaticInput.teamAPlans, automaticInput.teamBPlans]) p.tactics.matchPlans = {battingFirst: emptyTacticalMatchPlan(), bowlingFirst: emptyTacticalMatchPlan()};
assert.deepEqual(simulateInstantMatch(automaticInput).innings, automatic.innings, "empty plans preserve existing seeded simulation behaviour");
{
  const targetedInput = { ...input, teamAPlans: plans("A"), teamBPlans: plans("B") };
  for (const p of [targetedInput.teamAPlans, targetedInput.teamBPlans]) {
    p.tactics = createTeamTactics();
    const opponent = p.teamId === "A" ? "B" : "A";
    p.tactics.oppositionTargetBowlers = Object.fromEntries(team(opponent).squad.map(id => [id, `${p.teamId}-6`]));
  }
  const targeted = simulateInstantMatch(targetedInput);
  for (const innings of targeted.innings) {
    const fielding = innings.battingTeamId === "A" ? "B" : "A";
    assert.equal(innings.oversDetail[0].bowlerId, `${fielding}-6`, "A legal targeted bowler is preferred against the opening pair");
    assert.ok(innings.bowling.every(row => row.balls <= 24), "Target preferences respect over quotas");
    assert.ok(innings.oversDetail.every((over, i, overs) => i === 0 || over.bowlerId !== overs[i - 1].bowlerId), `Target preferences never allow consecutive overs: ${innings.oversDetail.map(over => `${over.number}:${over.bowlerId}`).join(", ")}`);
  }
  for (const p of [targetedInput.teamAPlans, targetedInput.teamBPlans]) p.tactics.matchPlans = plans(p.teamId).tactics.matchPlans;
  const fixedTargeted = simulateInstantMatch(targetedInput);
  fixedTargeted.innings.forEach((innings, index) => {
    const fielding = innings.battingTeamId === "A" ? "B" : "A";
    const slots = instructions(fielding, index === 0 ? 1 : 0).overs;
    assert.ok(innings.oversDetail.every(over => over.bowlerId === slots[over.number - 1]?.playerId), "Fixed overs take priority over requested matchups");
  });
}
console.log(`Tactical plans passed: ${verifiedOvers} fixed overs across 8 matches; floater promotion, save normalization, invalid plans, shortened matches, late-over reservations and live overrides verified.`);

const { suggestBowlingOvers } = require("../lib/logic/suggestBowlingOvers") as typeof import("../lib/logic/suggestBowlingOvers");
const attack = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  role: i === 2 || i === 3 ? "Spin Bowler" : "Pace Bowler",
  currentBowling: 88 - i,
  bowlingEconomyControl: 83 - i,
  powerplayBowling: i < 2 ? 62 : 46,
  middleOversBowling: i === 2 || i === 3 ? 62 : 46,
  deathBowling: i === 4 || i === 5 ? 65 : 46,
})) as import("../lib/types").Player[];
const existing = emptyTacticalMatchPlan().overs;
existing[0] = { playerId: "0", mode: "fixed" };
for (const bowlers of [attack, attack.filter(p => p.id !== "3")]) {
  const suggested = suggestBowlingOvers(bowlers, existing, "balanced");
  assert.equal(suggested.length, 20);
  assert.ok(suggested.every(Boolean));
  assert.deepEqual(suggested[0], existing[0]);
  assert.ok(suggested.some(slot => slot?.mode === "preferred"));
  assert.ok(suggested.some((slot, i) => i > 0 && slot?.mode === "fixed"));
  assert.ok(suggested.every((slot, i) => slot?.playerId !== suggested[i + 1]?.playerId));
  assert.ok(bowlers.every(p => suggested.filter(slot => slot?.playerId === p.id).length <= 4));
  assert.ok(suggested.every((slot, i) => ![2, 4, 6].every(offset => suggested[i + offset]?.playerId === slot?.playerId)));
}
const spinPlan = suggestBowlingOvers(attack, existing, "spin-choke");
assert.ok(spinPlan.slice(6, 15).filter(slot => slot?.playerId === "2" || slot?.playerId === "3").length >= 5);
console.log("Bowling suggestions passed: complete schedules, fixed overs, workload, spells and middle-overs spin.");

const staleSuggestion = emptyTacticalMatchPlan().overs;
staleSuggestion[0] = { playerId: "0", mode: "fixed" };
staleSuggestion[2] = { playerId: "1", mode: "fixed", suggested: true };
staleSuggestion[5] = { playerId: "0", mode: "fixed", suggested: true };
const refreshed = suggestBowlingOvers(attack, normalizeTacticalMatchPlan({ overs: staleSuggestion }).overs, "balanced");
assert.deepEqual(refreshed[0], staleSuggestion[0]);
assert.equal(refreshed[2]?.playerId, "0");
assert.ok(refreshed.every(Boolean));

const openingAttack = attack.map(p => p.id === "1" ? { ...p, powerplayBowling: 65 } : p);
const openingPlan = suggestBowlingOvers(openingAttack, emptyTacticalMatchPlan().overs, "balanced");
assert.equal(openingPlan[0]?.playerId, "1");
assert.equal(openingPlan[2]?.playerId, "1");

const { defaultBattingRule, resolveBattingRule } = require("../lib/logic/tacticalMatchPlan") as typeof import("../lib/logic/tacticalMatchPlan");
const recovery = { ...defaultBattingRule, balls: 6 };
const chaseRule = { ...defaultBattingRule, trigger: "required-rate", action: "attack", threshold: 11, releaseRate: 10 } as const;
const savedBattingPlan = normalizeTacticalMatchPlan({
  battingRules: { a: [recovery, chaseRule] }, response: { collapseResponse: "deep-rebuild" },
});
assert.deepEqual(savedBattingPlan.battingRules?.a, [recovery, chaseRule]);
assert.equal(savedBattingPlan.response?.collapseResponse, "deep-rebuild");
const ruleStarts: (number | undefined)[] = [];
const resolve = (over: number, batterBalls: number, requiredRate?: number) =>
  resolveBattingRule(savedBattingPlan.battingRules?.a, ruleStarts, { over, batterBalls, wickets: 3, recentWickets: 2, requiredRate });
assert.equal(resolve(7, 4, 12), -0.18, "first rule wins over a matching chase rule");
assert.equal(resolve(8, 9, 10.5), -0.18, "recovery continues beyond its trigger window");
assert.equal(resolve(8, 10, 10.5), 0.13, "after six balls the chase rule takes over");
assert.equal(resolve(8, 11, 9.9), undefined, "chase pressure releases below the configured rate");
assert.equal(resolve(9, 12, 10.5), undefined, "released chase rule needs its original trigger to reactivate");
assert.equal(resolve(9, 12), undefined, "no required-rate instruction when batting first");
const protectedFloater = { playerId: "e", earliestPosition: 4, latestPosition: 5, fromOver: 4, untilOver: 11,
  trigger: "wickets", wickets: 3, requiredRate: 10, protectCollapse: true } as const;
const testOrder = ["a", "b", "c", "d", "f", "e"];
assert.equal(chooseFloater(protectedFloater, testOrder, 4, testOrder, 42, 20, undefined, undefined, 3), undefined);
assert.equal(chooseFloater(protectedFloater, testOrder, 4, testOrder, 48, 20, undefined, undefined, 3), "e");
assert.equal(chooseFloater(protectedFloater, testOrder, 4, testOrder, 66, 20, undefined, undefined, 3), undefined);
console.log("Batting plans passed: save normalization, rule priority, recovery expiry, chase pressure release and floater protection.");

{
  const approachInput = { ...input, teamAPlans: plans("A"), teamBPlans: plans("B") };
  const fieldingPlan = baseline.innings[0].battingTeamId === "A" ? approachInput.teamBPlans : approachInput.teamAPlans;
  fieldingPlan.tactics.oppositionApproaches = Object.fromEntries(baseline.innings[0].batting.map(batter => [batter.id, "defensive"]));
  const defensive = simulateInstantMatch(approachInput);
  fieldingPlan.tactics.oppositionApproaches = Object.fromEntries(baseline.innings[0].batting.map(batter => [batter.id, "attacking"]));
  const attacking = simulateInstantMatch(approachInput);
  assert.notDeepEqual(defensive.innings[0].oversDetail, attacking.innings[0].oversDetail, "Opposition batter approaches affect simulated deliveries");
  const targetedInput = { ...input, teamAPlans: plans("A"), teamBPlans: plans("B") };
  const battingPlan = baseline.innings[0].battingTeamId === "A" ? targetedInput.teamAPlans : targetedInput.teamBPlans;
  const bowlingId = baseline.innings[0].battingTeamId === "A" ? "B" : "A";
  battingPlan.tactics.bowlerBattingInstructions = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`${bowlingId}-${i + 6}`, { approach: "normal", overs: Array(4).fill("boundary") }]));
  assert.notDeepEqual(simulateInstantMatch(targetedInput).innings[0].oversDetail, baseline.innings[0].oversDetail, "Bowler-specific over targets affect simulated deliveries");
}
const conditionalInput = { ...input, teamAPlans: plans("A"), teamBPlans: plans("B") };
const firstBattingTeam = baseline.innings[0].battingTeamId;
const specialInput = { ...input, teamAPlans: plans("A"), teamBPlans: plans("B") };
const specialTeam = firstBattingTeam === "A" ? specialInput.teamAPlans : specialInput.teamBPlans;
specialTeam.tactics.matchPlans!.battingFirst!.battingTeamRules = [
  { kind: "boundary-target", threshold: 1, fromOver: 1, untilOver: 20 },
];
const specialMatch = simulateInstantMatch(specialInput);
assert.notDeepEqual(specialMatch.innings[0].oversDetail, baseline.innings[0].oversDetail,
  "A saved team boundary target changes actual simulated deliveries");
assert.deepEqual(simulateInstantMatch(specialInput).innings, specialMatch.innings,
  "Special rules replay deterministically under the same seed");
console.log("Special batting rules passed: targets, expiry, priority, save/load and deterministic match integration.");
const firstBattingPlan = firstBattingTeam === "A" ? conditionalInput.teamAPlans : conditionalInput.teamBPlans;
firstBattingPlan.tactics.matchPlans!.battingFirst!.battingRules = {
  [`${firstBattingTeam}-0`]: [{ ...defaultBattingRule, trigger: "wickets-in-hand", threshold: 5, over: 1, action: "all-out" }],
};
const conditionalMatch = simulateInstantMatch(conditionalInput);
assert.equal(conditionalMatch.innings[0].battingTeamId, firstBattingTeam);
assert.notDeepEqual(conditionalMatch.innings[0].oversDetail, baseline.innings[0].oversDetail,
  "the saved opening batter rule changes the simulated innings");

const coverageInput = { ...input, teamAPlans: plans("A"), teamBPlans: plans("B") };
const coverageTeamPlan = firstBattingTeam === "A" ? coverageInput.teamAPlans : coverageInput.teamBPlans;
const coveragePlan = coverageTeamPlan.tactics.matchPlans!.battingFirst!;
const openerId = firstBattingTeam + "-0";
coveragePlan.battingCoverage = { [openerId]: { powerplay: "all-out" } };
assert.deepEqual(normalizeTacticalMatchPlan(coveragePlan).battingCoverage, coveragePlan.battingCoverage);
assert.notDeepEqual(simulateInstantMatch(coverageInput).innings[0].oversDetail, baseline.innings[0].oversDetail,
  "an editable powerplay approach changes the simulated innings");
coveragePlan.roles[openerId] = "powerplay-aggressor";
assert.equal(normalizeTacticalMatchPlan(coveragePlan).battingCoverage?.[openerId].powerplay, "all-out",
  "explicit choices supersede old role defaults");
const migrated = normalizeTacticalMatchPlan({ roles: { a: "spin-attacker", b: "finisher" },
  battingCoverage: { a: { middle: "protect", lateMiddle: "all-out" } } });
assert.deepEqual(migrated.battingCoverage, {
  a: { earlyMiddle: "protect", lateMiddle: "all-out" }, b: { death: "attack" },
});
assert.deepEqual(normalizeTacticalMatchPlan(migrated), migrated, "migrated choices survive a reload");
assert.deepEqual([6, 7, 11, 12, 15, 16].map(over => battingCoveragePhase(over, 6, 16)),
  ["powerplay", "earlyMiddle", "earlyMiddle", "lateMiddle", "lateMiddle", "death"]);
assert.deepEqual([3, 4, 5, 6, 7, 8].map(over => battingCoveragePhase(over, 3, 8)),
  ["powerplay", "earlyMiddle", "earlyMiddle", "lateMiddle", "lateMiddle", "death"]);

coveragePlan.roles = {};
coveragePlan.battingCoverage = Object.fromEntries(Object.keys(players).map(id => [id, { powerplay: "survive" }]));
assert.equal(normalizeTacticalMatchPlan(coveragePlan).battingCoverage?.[openerId].powerplay, "survive");
const powerplayResults = () => simulateInstantMatch(coverageInput).innings[0].oversDetail
  .slice(0, 6).flatMap(over => over.deliveries.map(ball => ball.resultCode)).join(",");
const survivePowerplay = powerplayResults();
coveragePlan.battingCoverage = Object.fromEntries(Object.keys(players).map(id => [id, { powerplay: "protect" }]));
assert.notEqual(survivePowerplay, powerplayResults(), "survive and protect produce distinct powerplays under the same seed");

for (const [phase, firstOver] of [["earlyMiddle", 7], ["lateMiddle", 12]] as const) {
  coveragePlan.battingCoverage = Object.fromEntries(Object.keys(players).map(id => [id, { [phase]: "all-out" }]));
  const overs = simulateInstantMatch(coverageInput).innings[0].oversDetail;
  const baselineOvers = baseline.innings[0].oversDetail;
  assert.deepEqual(overs.slice(0, firstOver - 1), baselineOvers.slice(0, firstOver - 1));
  assert.notDeepEqual(overs.slice(firstOver - 1), baselineOvers.slice(firstOver - 1), `${phase} changes the simulated innings`);
}
