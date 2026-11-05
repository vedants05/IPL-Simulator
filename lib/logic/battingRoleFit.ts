import type { Player } from "../types";
import { battingIntent, getRelativePhaseSignal } from "./matchSimulation";
import { getTopSevenBattingPositions } from "./playerBattingPositions";
import { BATTING_COVERAGE_INTENTS, type BattingCoverage, type BattingCoverageIntent } from "./tacticalMatchPlan";
import type { TeamTactics } from "./teamTactics";

export const battingFitPhases = ["powerplay", "earlyMiddle", "lateMiddle", "death"] as const;
type Phase = typeof battingFitPhases[number];
type Choice = BattingCoverageIntent | undefined;
const explicitChoices = Object.keys(BATTING_COVERAGE_INTENTS) as BattingCoverageIntent[];
const choices = [undefined, ...explicitChoices];
const sumPoints = (points: number[]) => points.reduce((total, value) => total + value, 0);
const steadyRisk = (BATTING_COVERAGE_INTENTS.steady + 0.18) / 0.38;

interface FitContext {
  lineup: readonly Player[];
  order: readonly string[];
  coverage: Readonly<Record<string, BattingCoverage>>;
  tactics: TeamTactics;
  chasing: boolean;
}

// Relative opportunities by slot, starting with the opening pair. Each row is
// normalised below. Even unlikely phases retain some weight for a collapse.
const phaseOpportunity = [
  [7, 5, 3, 2], [7, 5, 3, 2], [5, 6, 4, 2], [3, 6, 5, 3],
  [2, 5, 6, 4], [1, 3, 6, 6], [1, 2, 5, 7], [1, 2, 4, 7],
  [1, 1, 3, 7], [1, 1, 2, 7], [1, 1, 2, 7],
];
const overs = [3, 9, 14, 18];
// The baseline is the skill expected for steady batting in this part of the
// order. Phase premiums and the selected intent adjust that expectation.
const slotDemands = {
  opener: { label: "Set the tempo", baseline: 79, skill: [8, 6, 4, 2], tempo: [0.035, 0, 0, 0], composure: 0.06 },
  top: { label: "Handle early wickets", baseline: 77, skill: [10, 8, 4, 2], tempo: [-0.045, -0.025, 0, 0], composure: 0.13 },
  middle: { label: "Build and accelerate", baseline: 72, skill: [6, 6, 7, 5], tempo: [-0.035, -0.015, 0.035, 0.02], composure: 0.08 },
  finisher: { label: "Close the innings", baseline: 65, skill: [3, 4, 6, 8], tempo: [-0.05, -0.035, 0.035, 0.045], composure: 0.04 },
  tail: { label: "Play a short cameo", baseline: 55, skill: [2, 2, 2, 3], tempo: [-0.06, -0.05, -0.025, 0], composure: 0 },
} as const;
const factorWeights = [
  ["Batting ability for slot", 3], ["Tempo match", 2], ["Phase strengths", 1.25],
  ["Reliability under pressure", 1], ["Pace and spin", 0.5], ["XI balance", 1.25],
] as const;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const rating = (value: number | undefined, fallback = 50) => Number.isFinite(value) ? clamp(value!, 0, 100) : fallback;
const aggression = (player: Player) => rating(player.battingAggression ?? player.aggression, 65);

function positionFit(player: Player, position: number) {
  if (player.onlyOpensOrBenched) return position <= 2 ? 1 : 0;
  const preferred = getTopSevenBattingPositions(player);
  if (preferred.includes(position)) return 1;
  if (preferred.length) {
    const distance = Math.min(...preferred.map(slot => Math.abs(slot - position)));
    return clamp(1 - distance * 0.19, 0.15);
  }
  if (player.isCoreBatter && position >= 3 && position <= 5) return 0.85;
  // Limited position data is common for bowlers and new players.
  const naturalSlot = player.currentBatting >= 70 ? 5 : player.currentBatting >= 55 ? 7 : 9;
  return clamp(0.9 - Math.abs(naturalSlot - position) * 0.13, 0.15);
}

export function prepareBattingRoleFit(player: Player, position: number, context: FitContext) {
  const slot = clamp(position || 11, 1, 11);
  const demands = slot <= 2 ? slotDemands.opener : slot <= 4 ? slotDemands.top
    : slot <= 6 ? slotDemands.middle : slot <= 8 ? slotDemands.finisher : slotDemands.tail;
  const ability = rating(player.currentBatting);
  const temperament = aggression(player);
  const consistency = rating(player.battingConsistency ?? player.consistency);
  const pressure = rating(player.pressureRating);
  const bigMatch = rating(player.bigMatchRating, pressure);
  const stamina = rating(player.stamina);
  const positionPoints = positionFit(player, slot);
  const opportunities = phaseOpportunity[slot - 1];
  const opportunityTotal = opportunities.reduce((sum, weight) => sum + weight, 0);
  const peers = context.lineup.filter(teammate => teammate.id !== player.id);
  const positionOf = (teammate: Player) => context.order.indexOf(teammate.id) + 1;
  const battingDepth = peers.filter(teammate => positionOf(teammate) > slot && teammate.currentBatting >= 65).length;
  const nearby = peers.filter(teammate => Math.abs(positionOf(teammate) - slot) <= 2);
  const oppositeHand = nearby.some(teammate => teammate.battingStyle !== player.battingStyle);
  const tailSupport = slot >= 9 && nearby.some(teammate => teammate.currentBatting >= 65);
  const lowEvidence = [
    player.battingAggression ?? player.aggression, player.battingConsistency ?? player.consistency,
    player.pressureRating, player.paceRating, player.spinRating,
    player.powerplayBatting, player.middleOversBatting, player.deathBatting,
  ].some(value => !Number.isFinite(value));

  const phaseScores = battingFitPhases.map((phase, index) => {
    const enginePhase = index === 0 ? "powerplay" : index === 3 ? "death" : "middle";
    // An on-rate chase reflects the chosen chase approach without assuming
    // a particular score, required rate spike, or collapse.
    const over = overs[index];
    const teamIntent = context.chasing
      ? battingIntent(context.tactics, over, 0, (over - 1) * 9, 180)
      : battingIntent(context.tactics, over, 0, 0);
    const phaseStrength = getRelativePhaseSignal(player, "batting", enginePhase);
    const matchup = index === 0
      ? rating(player.paceRating) * 0.8 + rating(player.spinRating) * 0.2
      : index === 3
        ? rating(player.paceRating) * 0.7 + rating(player.spinRating) * 0.3
        : rating(player.spinRating) * 0.65 + rating(player.paceRating) * 0.35;
    const comparisonGroup = nearby.length ? nearby : peers;
    const peerIntent = comparisonGroup.length
      ? comparisonGroup.reduce((sum, teammate) => {
        const instruction = context.coverage[teammate.id]?.[phase];
        return sum + (instruction ? BATTING_COVERAGE_INTENTS[instruction] : teamIntent);
      }, 0) / comparisonGroup.length
      : teamIntent;
    const target = clamp(
      [-0.005, -0.025, 0.05, 0.14][index] + teamIntent * 0.35
        + demands.tempo[index] - (tailSupport && index === 3 ? 0.075 : 0)
        - (peerIntent - teamIntent) * 0.45
        + (index === 3 ? 0 : Math.min(battingDepth, 4) * 0.015 - 0.025)
        + (context.chasing ? 0.015 : 0),
      -0.12, 0.2,
    );
    const weight = opportunities[index] / opportunityTotal;
    const scores = choices.map(choice => {
      const intent = choice ? BATTING_COVERAGE_INTENTS[choice] : teamIntent;
      const risk = clamp((intent + 0.18) / 0.38);
      // Meeting the slot's demand earns most of the points. Stronger batting
      // can still earn extra credit, and all-out asks more than attack.
      const skillDemand = demands.baseline + demands.skill[index] + 16 * (risk - steadyRisk);
      const desiredAggression = 35 + risk * 60 + 8 * phaseStrength + (index - 1.5) * 3;
      const factors = [
        clamp(0.88 + (ability - skillDemand) / 60),
        clamp(1 - Math.max(0, Math.abs(temperament - desiredAggression) - 4) / 57),
        clamp(0.96 + 0.38 * phaseStrength - risk * 0.06),
        clamp((consistency * (0.55 - 0.2 * risk - demands.composure) + pressure * (0.30 + 0.12 * risk + demands.composure)
          + bigMatch * 0.08 * risk + stamina * 0.15) / 91),
        clamp(matchup / 90),
        clamp(1 - Math.max(0, Math.abs(intent - target) - 0.035) / 0.34) * (oppositeHand ? 1 : 0.97),
      ];
      return factors.map((factor, factorIndex) => factor * factorWeights[factorIndex][1] * weight);
    });
    // A team default is a fallback. When it already fits well, give the
    // best individual instruction a small edge in the role-fit comparison.
    const bestExplicit = Math.max(...scores.slice(1).map(sumPoints));
    const inheritedScore = sumPoints(scores[0]);
    if (inheritedScore > bestExplicit * 0.99) {
      scores[0] = scores[0].map(points => points * bestExplicit * 0.99 / inheritedScore);
    }
    return scores;
  });

  return {
    evaluate(coverage: BattingCoverage) {
      const points: { label: string; max: number; points: number }[] = factorWeights.map(([label, max], factorIndex) => ({
        label, max,
        points: phaseScores.reduce((total, scores, phaseIndex) =>
          total + scores[choices.indexOf(coverage[battingFitPhases[phaseIndex]])][factorIndex], 0),
      }));
      points.splice(3, 0, { label: "Batting position", max: 1, points: positionPoints });
      const total = sumPoints(points.map(factor => factor.points));
      return {
        score: total >= 9.65 ? 10 : Math.min(9, Math.round(total)),
        total, factors: points, lowEvidence,
        positionDemand: tailSupport ? "Support the set batter" : demands.label,
      };
    },
    suggest(coverage: BattingCoverage): BattingCoverage {
      const next = { ...coverage };
      battingFitPhases.forEach((phase, phaseIndex) => {
        const scores = phaseScores[phaseIndex];
        // Each phase contributes independently. Keep the current choice on a tie.
        const best = explicitChoices.reduce((winner, candidate) =>
          sumPoints(scores[choices.indexOf(candidate)]) > sumPoints(scores[choices.indexOf(winner)]) + 1e-9 ? candidate : winner,
        coverage[phase] ?? explicitChoices[0]);
        next[phase] = best;
      });
      return next;
    },
  };
}

export type BattingRoleFit = ReturnType<ReturnType<typeof prepareBattingRoleFit>["evaluate"]>;

export const battingReviewCategories = ["Overview", "Role fit", "Roles", "Depth", "Phases", "Risk"] as const;
export type BattingReviewCategory = typeof battingReviewCategories[number];
type Review = { pros: string[]; cons: string[] };

export function reviewBattingPhasePlan(
  context: FitContext,
  displayedFits?: ReadonlyMap<string, BattingRoleFit>,
): Record<BattingReviewCategory, Review> {
  const batters = context.lineup.map(player => ({
    player,
    id: player.id,
    slot: context.order.indexOf(player.id) + 1,
  })).filter(({ slot }) => slot > 0);
  const intent = (id: string, phase: Phase) => {
    const choice = context.coverage[id]?.[phase];
    if (choice) return BATTING_COVERAGE_INTENTS[choice];
    const over = overs[battingFitPhases.indexOf(phase)];
    return context.chasing
      ? battingIntent(context.tactics, over, 0, (over - 1) * 9, 180)
      : battingIntent(context.tactics, over, 0, 0);
  };
  const attacks = (id: string, phase: Phase) => intent(id, phase) >= 0.1;
  const openers = batters.filter(({ slot }) => slot <= 2);
  const topOrder = batters.filter(({ slot }) => slot >= 3 && slot <= 5);
  const middleOrder = batters.filter(({ slot }) => slot >= 3 && slot <= 7);
  const lateOptions = batters.filter(({ slot }) => slot >= 5 && slot <= 8);
  const earlyAttack = openers.filter(({ id }) => attacks(id, "powerplay")).length;
  const hasCover = topOrder.some(({ id }) => intent(id, "powerplay") <= 0 && intent(id, "earlyMiddle") <= 0);
  const finishers = lateOptions.filter(({ id }) => attacks(id, "death")).length;
  const fit: Review = { pros: [], cons: [] };
  const roles: Review = { pros: [], cons: [] };
  const depth: Review = { pros: [], cons: [] };
  const phases: Review = { pros: [], cons: [] };
  const risk: Review = { pros: [], cons: [] };

  const rankedFits = batters.map(({ player, slot }) => ({
    name: player.name || `No. ${slot}`,
    fit: displayedFits?.get(player.id) ?? prepareBattingRoleFit(player, slot, context).evaluate(context.coverage[player.id] ?? {}),
  })).sort((a, b) => b.fit.total - a.fit.total);
  const strongFits = rankedFits.filter(row => row.fit.score >= 8).length;
  if (strongFits) fit.pros.push(`${strongFits}/${batters.length} batters have 8+ role fit.`);
  const weakest = rankedFits[rankedFits.length - 1];
  if (weakest && weakest.fit.score <= 6) fit.cons.push(`${weakest.name} has the lowest fit (${weakest.fit.score}/10).`);
  if (rankedFits.some(row => row.fit.lowEvidence)) fit.cons.push("Some fit scores use estimated ratings.");

  if (hasCover) roles.pros.push("A top-order batter is set to rebuild early.");
  else if (topOrder.length >= 2) roles.cons.push("Little top-order cover for early wickets.");
  const buildsThenAttacks = middleOrder.filter(({ id }) => intent(id, "earlyMiddle") <= 0 && attacks(id, "lateMiddle")).length;
  if (buildsThenAttacks) roles.pros.push(`${buildsThenAttacks} in the middle can build, then accelerate.`);
  if (finishers >= 2) roles.pros.push(`${finishers} late-order options attack at the death.`);
  else if (lateOptions.length >= 2) {
    roles.cons.push(finishers ? "Only one likely late hitter is set to attack." : "Nos. 5–8 lack an attacking option at the death.");
  }

  const lateDepth = lateOptions.filter(({ player, slot }) => slot >= 7 && player.currentBatting >= 65).length;
  if (lateDepth) depth.pros.push(`${lateDepth} of Nos. 7–8 have 65+ batting.`);
  else if (lateOptions.some(({ slot }) => slot >= 7)) depth.cons.push("Nos. 7–8 offer limited batting depth.");
  const reliableFinishers = lateOptions.filter(({ player, id }) => player.currentBatting >= 65 && attacks(id, "death")).length;
  if (reliableFinishers >= 2) depth.pros.push(`${reliableFinishers} rated batting options can finish aggressively.`);
  if (finishers > 0 && reliableFinishers < 2) depth.cons.push("Late attacking options have limited batting depth.");
  const handedness = new Set(middleOrder.map(({ player }) => player.battingStyle).filter(Boolean));
  if (handedness.size > 1) depth.pros.push("Left- and right-hand options in the middle.");
  else if (handedness.size === 1 && middleOrder.length >= 3) depth.cons.push("One batting hand throughout Nos. 3–7.");

  if (earlyAttack) phases.pros.push(earlyAttack === 2 ? "Both openers look to score early." : "One opener attacks in the powerplay.");
  else if (openers.length === 2) phases.cons.push("Neither opener attacks in the powerplay.");
  for (const [phase, label, pool] of [
    ["earlyMiddle", "Early middle", middleOrder],
    ["lateMiddle", "Late middle", middleOrder],
    ["death", "Death overs", lateOptions],
  ] as const) {
    if (!pool.length) continue;
    const count = pool.filter(({ id }) => attacks(id, phase)).length;
    if (count >= 2) phases.pros.push(`${label}: ${count} attacking options.`);
    else phases.cons.push(`${label}: ${count === 0 ? "no attacking option" : "only one attacker"}.`);
  }

  if (openers.length === 2 && openers.every(({ id }) => intent(id, "powerplay") >= 0.18)) {
    risk.cons.push("Both openers go all-out in the powerplay.");
  }
  if (topOrder.length >= 2 && topOrder.every(({ id }) => attacks(id, "earlyMiddle"))) {
    risk.cons.push("Nos. 3–5 all attack in the early middle.");
  }
  if (hasCover) risk.pros.push("A calmer top-order option limits collapse risk.");
  if (earlyAttack === 1 && openers.length === 2) risk.pros.push("Opening pair splits scoring and risk.");
  if (context.tactics.batting.collapseResponse !== "keep-attacking") {
    const overrides = [...openers, ...topOrder].filter(({ id }) =>
      (["powerplay", "earlyMiddle"] as const).some(phase => Boolean(context.coverage[id]?.[phase]) && attacks(id, phase)),
    ).length;
    if (overrides >= 2) risk.cons.push("Early attack instructions override the team’s collapse response.");
    else risk.pros.push("The team plan can ease off after a collapse.");
  }

  return {
    Overview: {
      pros: [fit, roles, depth, phases, risk].flatMap(group => group.pros.slice(0, 1)).slice(0, 3),
      cons: [risk, fit, roles, depth, phases].flatMap(group => group.cons.slice(0, 1)).slice(0, 3),
    },
    "Role fit": fit, Roles: roles, Depth: depth, Phases: phases, Risk: risk,
  };
}

export function suggestLineupBattingCoverage(context: FitContext): Record<string, BattingCoverage> {
  const playersById = new Map(context.lineup.map(player => [player.id, player]));
  const batters = context.order.flatMap((id, index) => {
    const player = playersById.get(id);
    return player ? [{ player, position: index + 1 }] : [];
  });
  const coverage = { ...context.coverage };
  for (const { player } of batters) {
    coverage[player.id] = { ...coverage[player.id] };
    for (const phase of battingFitPhases) delete coverage[player.id][phase];
  }
  const workingContext = { ...context, coverage };
  const initial = batters.map(({ player, position }) =>
    prepareBattingRoleFit(player, position, workingContext).suggest(coverage[player.id]));
  batters.forEach(({ player }, index) => { coverage[player.id] = initial[index]; });
  const lineupScore = () => batters.reduce((sum, { player, position }) =>
    sum + prepareBattingRoleFit(player, position, workingContext).evaluate(coverage[player.id]).total, 0);
  let bestScore = lineupScore();

  // Each accepted change must improve the whole XI, including the effect on
  // partners. Starting from team defaults makes the result independent of
  // the current grid, and a fixed traversal resolves ties consistently.
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (const phase of battingFitPhases) {
      for (const { player } of batters) {
        const instructions = coverage[player.id];
        const current = instructions[phase];
        let best = current;
        for (const candidate of explicitChoices) {
          if (candidate === current) continue;
          instructions[phase] = candidate;
          const score = lineupScore();
          if (score > bestScore + 1e-9) {
            bestScore = score;
            best = candidate;
            improved = true;
          }
        }
        if (best) instructions[phase] = best;
        else delete instructions[phase];
      }
    }
    if (!improved) break;
  }
  return coverage;
}
