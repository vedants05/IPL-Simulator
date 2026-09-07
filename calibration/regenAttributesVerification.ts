import assert from "node:assert/strict";
import { createScoutingGeneratedPlayer } from "../lib/logic/careerLifecycle";
import type { Player } from "../lib/types";

const secondaryRatings: Array<keyof Player> = [
  "battingAggression", "aggression",
  "powerplayBatting", "middleOversBatting", "deathBatting",
  "powerplayBowling", "middleOversBowling", "deathBowling",
  "stamina", "battingConsistency", "consistency", "bowlingConsistency",
  "bigMatchRating", "pressureRating", "fieldingRating", "wicketkeepingRating",
  "injuryProneness", "paceRating", "spinRating", "captaincy", "reputation",
];

const generationRanges: Partial<Record<keyof Player, readonly [number, number]>> = {
  paceRating: [15, 85],
  spinRating: [15, 85],
  stamina: [10, 90],
  battingConsistency: [10, 90],
  consistency: [10, 90],
  bowlingConsistency: [10, 90],
  injuryProneness: [10, 90],
  pressureRating: [15, 90],
  bigMatchRating: [15, 90],
  fieldingRating: [20, 95],
  powerplayBatting: [20, 90],
  middleOversBatting: [20, 90],
  deathBatting: [20, 90],
  powerplayBowling: [20, 90],
  middleOversBowling: [20, 90],
  deathBowling: [20, 90],
};

const roles = ["BAT", "WK", "AR", "PACE", "SPIN"] as const;
type RoleGroup = typeof roles[number];
type GeneratedEntry = { roleGroup: RoleGroup; player: Player };

const sampleSizePerRole = 2_000;
const generated: GeneratedEntry[] = roles.flatMap((preferredRole, roleIndex) => (
  Array.from({ length: sampleSizePerRole }, (_, sampleIndex) => {
    const index = roleIndex * sampleSizePerRole + sampleIndex;
    return {
      roleGroup: preferredRole,
      player: createScoutingGeneratedPlayer({
        index,
        season: 2032,
        seed: "regen-attributes-population-verification",
        players: {},
        nationality: index % 2 === 0 ? "Indian" : "Overseas",
        country: index % 2 === 0 ? "India" : "Australia",
        preferredRole,
      }),
    };
  })
));

const value = (player: Player, rating: keyof Player): number => player[rating] as number;
const values = (players: Player[], rating: keyof Player): number[] => players.map((player) => value(player, rating));
const mean = (samples: number[]): number => samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
const standardDeviation = (samples: number[]): number => {
  const average = mean(samples);
  return Math.sqrt(mean(samples.map((sample) => (sample - average) ** 2)));
};
const correlation = (left: number[], right: number[]): number => {
  assert.equal(left.length, right.length);
  const leftMean = mean(left);
  const rightMean = mean(right);
  const covariance = mean(left.map((sample, index) => (sample - leftMean) * (right[index] - rightMean)));
  const denominator = standardDeviation(left) * standardDeviation(right);
  return denominator === 0 ? 0 : covariance / denominator;
};
const proportion = <T>(samples: T[], predicate: (sample: T) => boolean): number => (
  samples.filter(predicate).length / samples.length
);

for (const { roleGroup, player } of generated) {
  for (const rating of secondaryRatings) {
    const ratingValue = player[rating];
    assert.equal(typeof ratingValue, "number", `${player.role} is missing ${String(rating)}`);
    assert.ok(Number.isFinite(ratingValue as number), `${player.role} has invalid ${String(rating)}`);
    assert.ok((ratingValue as number) >= 0 && (ratingValue as number) <= 100, `${String(rating)} is out of range`);

    const expectedRange = generationRanges[rating];
    if (expectedRange) {
      assert.ok(
        (ratingValue as number) >= expectedRange[0] && (ratingValue as number) <= expectedRange[1],
        `${String(rating)} is outside its regen range`,
      );
    }
  }

  assert.equal(player.stamina, player.battingConsistency, "stamina must remain batting consistency");
  assert.equal(player.consistency, player.bowlingConsistency, "consistency must remain bowling consistency");
  assert.equal(player.aggression, player.battingAggression);

  const keeping = player.wicketkeepingRating!;
  if (roleGroup === "WK") {
    assert.equal(player.isWicketkeeper, true);
    assert.ok(keeping >= 50 && keeping <= 96, "full-time keeper outside keeping background ranges");
  } else if (player.isPartTimeWk) {
    assert.ok(keeping >= 25 && keeping <= 81, "part-time keeper outside keeping background ranges");
  } else {
    assert.ok(keeping >= 5 && keeping <= 38, "untrained player received trained keeping skill");
  }

  for (const flag of [
    "isWicketkeeper", "isPartTimeWk", "isOpener", "isFinisher", "isCoreBatter",
    "onlyOpensOrBenched", "hasBattedAt3", "hasBattedAt4", "hasBattedAt5",
    "hasBattedAt6", "hasBattedAt7",
  ] as const) {
    assert.equal(typeof player[flag], "boolean", `${player.role} is missing ${flag}`);
  }
}

const allPlayers = generated.map(({ player }) => player);
const byRole = Object.fromEntries(roles.map((role) => [
  role,
  generated.filter((entry) => entry.roleGroup === role).map((entry) => entry.player),
])) as Record<RoleGroup, Player[]>;

const correlations = {
  paceSpin: correlation(values(allPlayers, "paceRating"), values(allPlayers, "spinRating")),
  consistency: correlation(values(allPlayers, "battingConsistency"), values(allPlayers, "bowlingConsistency")),
  mental: correlation(values(allPlayers, "pressureRating"), values(allPlayers, "bigMatchRating")),
  aggressionConsistency: correlation(values(allPlayers, "battingAggression"), values(allPlayers, "battingConsistency")),
  abilityPressure: correlation(
    allPlayers.map((player) => Math.max(player.currentBatting, player.currentBowling)),
    values(allPlayers, "pressureRating"),
  ),
  abilityBigMatch: correlation(
    allPlayers.map((player) => Math.max(player.currentBatting, player.currentBowling)),
    values(allPlayers, "bigMatchRating"),
  ),
  abilityFielding: correlation(
    allPlayers.map((player) => Math.max(player.currentBatting, player.currentBowling)),
    values(allPlayers, "fieldingRating"),
  ),
};
assert.ok(correlations.paceSpin >= 0.10 && correlations.paceSpin <= 0.40, `pace/spin correlation ${correlations.paceSpin}`);
assert.ok(correlations.consistency >= 0.12 && correlations.consistency <= 0.32, `consistency correlation ${correlations.consistency}`);
assert.ok(correlations.mental >= 0.32 && correlations.mental <= 0.55, `mental correlation ${correlations.mental}`);
assert.ok(Math.abs(correlations.aggressionConsistency) < 0.08, `aggression still drives consistency ${correlations.aggressionConsistency}`);
assert.ok(Math.abs(correlations.abilityPressure) < 0.08, `ability still drives pressure ${correlations.abilityPressure}`);
assert.ok(Math.abs(correlations.abilityBigMatch) < 0.08, `ability still drives big-match rating ${correlations.abilityBigMatch}`);
assert.ok(Math.abs(correlations.abilityFielding) < 0.10, `ability still drives fielding ${correlations.abilityFielding}`);

const matchupGapRates = {
  twenty: proportion(allPlayers, (player) => Math.abs(player.paceRating! - player.spinRating!) >= 20),
  twentyFive: proportion(allPlayers, (player) => Math.abs(player.paceRating! - player.spinRating!) >= 25),
  ordinary: proportion(allPlayers, (player) => (
    player.paceRating! >= 40 && player.paceRating! <= 60
    && player.spinRating! >= 40 && player.spinRating! <= 60
  )),
};
assert.ok(matchupGapRates.twenty >= 0.02 && matchupGapRates.twenty <= 0.08, `pace/spin 20-point gaps ${matchupGapRates.twenty}`);
assert.ok(matchupGapRates.twentyFive >= 0.003 && matchupGapRates.twentyFive <= 0.025, `pace/spin 25-point gaps ${matchupGapRates.twentyFive}`);
assert.ok(matchupGapRates.ordinary >= 0.35, `too few ordinary matchup profiles ${matchupGapRates.ordinary}`);

const consistencyRates = {
  battingHigh: proportion(allPlayers, (player) => player.battingConsistency! >= 80),
  battingLow: proportion(allPlayers, (player) => player.battingConsistency! <= 20),
  bowlingHigh: proportion(allPlayers, (player) => player.bowlingConsistency! >= 80),
  bowlingLow: proportion(allPlayers, (player) => player.bowlingConsistency! <= 20),
};
for (const [label, rate] of Object.entries(consistencyRates)) {
  assert.ok(rate >= 0.002 && rate <= 0.03, `${label} consistency tail ${rate}`);
}
assert.ok(allPlayers.some((player) => player.battingAggression! >= 75 && player.battingConsistency! >= 70));
assert.ok(allPlayers.some((player) => player.battingAggression! <= 50 && player.battingConsistency! <= 35));

const mentalContradictionRate = proportion(allPlayers, (player) => (
  Math.abs(player.pressureRating! - player.bigMatchRating!) >= 30
));
assert.ok(mentalContradictionRate > 0 && mentalContradictionRate < 0.04, `mental contradiction rate ${mentalContradictionRate}`);

const injuryMeans = Object.fromEntries(roles.map((role) => [role, mean(values(byRole[role], "injuryProneness"))])) as Record<RoleGroup, number>;
assert.ok(Math.max(...Object.values(injuryMeans)) - Math.min(...Object.values(injuryMeans)) < 3, "role still drives generated injury proneness");
assert.ok(byRole.PACE.some((player) => player.injuryProneness! < 30), "no durable pace bowlers generated");
assert.ok(byRole.PACE.some((player) => player.injuryProneness! > 70), "no injury-prone pace bowlers generated");

const fieldingMeans = Object.fromEntries(roles.map((role) => [role, mean(values(byRole[role], "fieldingRating"))])) as Record<RoleGroup, number>;
assert.ok(Math.max(...Object.values(fieldingMeans)) - Math.min(...Object.values(fieldingMeans)) < 4, "role still drives generated fielding");
for (const role of roles) {
  assert.ok(byRole[role].some((player) => player.fieldingRating! >= 80), `${role} generated no excellent fielders`);
}

const partTimeKeepers = allPlayers.filter((player) => player.isPartTimeWk && !player.isWicketkeeper);
const untrainedKeepers = allPlayers.filter((player) => !player.isPartTimeWk && !player.isWicketkeeper);
const keepingPopulation = {
  fullTimeMean: mean(values(byRole.WK, "wicketkeepingRating")),
  fullTimeSpread: standardDeviation(values(byRole.WK, "wicketkeepingRating")),
  fullTimeEliteRate: proportion(byRole.WK, (player) => player.wicketkeepingRating! >= 85),
  partTimeCount: partTimeKeepers.length,
  partTimeMean: mean(values(partTimeKeepers, "wicketkeepingRating")),
  partTimeStrongRate: proportion(partTimeKeepers, (player) => player.wicketkeepingRating! >= 60),
  untrainedMean: mean(values(untrainedKeepers, "wicketkeepingRating")),
};
assert.ok(keepingPopulation.fullTimeMean >= 74 && keepingPopulation.fullTimeMean <= 81, `full-time keeping mean ${keepingPopulation.fullTimeMean}`);
assert.ok(keepingPopulation.fullTimeSpread >= 7 && keepingPopulation.fullTimeSpread <= 12, `full-time keeping spread ${keepingPopulation.fullTimeSpread}`);
assert.ok(keepingPopulation.fullTimeEliteRate >= 0.10 && keepingPopulation.fullTimeEliteRate <= 0.30, `elite keeper rate ${keepingPopulation.fullTimeEliteRate}`);
assert.ok(keepingPopulation.partTimeCount >= 100, `too few part-time keepers ${keepingPopulation.partTimeCount}`);
assert.ok(keepingPopulation.partTimeMean >= 39 && keepingPopulation.partTimeMean <= 49, `part-time keeping mean ${keepingPopulation.partTimeMean}`);
assert.ok(keepingPopulation.partTimeStrongRate >= 0.02 && keepingPopulation.partTimeStrongRate <= 0.18, `strong part-time keeper rate ${keepingPopulation.partTimeStrongRate}`);
assert.ok(keepingPopulation.untrainedMean >= 18 && keepingPopulation.untrainedMean <= 22, `untrained keeping mean ${keepingPopulation.untrainedMean}`);

const openerBatters = allPlayers.filter((player) => player.isOpener && !player.isFinisher);
const finishers = allPlayers.filter((player) => player.isFinisher);
assert.ok(mean(values(openerBatters, "powerplayBatting")) > mean(values(openerBatters, "deathBatting")) + 4);
assert.ok(mean(values(finishers, "deathBatting")) > mean(values(finishers, "powerplayBatting")) + 6);
assert.ok(mean(values(byRole.PACE, "powerplayBowling")) > mean(values(byRole.PACE, "middleOversBowling")) + 3);
assert.ok(mean(values(byRole.SPIN, "middleOversBowling")) > mean(values(byRole.SPIN, "powerplayBowling")) + 3);
assert.ok(mean(values(byRole.SPIN, "middleOversBowling")) > mean(values(byRole.SPIN, "deathBowling")) + 3);

const activeBatters = [...byRole.BAT, ...byRole.WK, ...byRole.AR];
const activeBowlers = [...byRole.PACE, ...byRole.SPIN, ...byRole.AR];
const phaseSpread = (player: Player, discipline: "batting" | "bowling") => {
  const ratings = discipline === "batting"
    ? [player.powerplayBatting!, player.middleOversBatting!, player.deathBatting!]
    : [player.powerplayBowling!, player.middleOversBowling!, player.deathBowling!];
  return Math.max(...ratings) - Math.min(...ratings);
};
const pronouncedBattingSpecialists = proportion(activeBatters, (player) => phaseSpread(player, "batting") >= 25);
const pronouncedBowlingSpecialists = proportion(activeBowlers, (player) => phaseSpread(player, "bowling") >= 25);
assert.ok(pronouncedBattingSpecialists >= 0.02 && pronouncedBattingSpecialists <= 0.15, `batting specialist rate ${pronouncedBattingSpecialists}`);
assert.ok(pronouncedBowlingSpecialists >= 0.02 && pronouncedBowlingSpecialists <= 0.15, `bowling specialist rate ${pronouncedBowlingSpecialists}`);

const extremeProfileRate = proportion(allPlayers, (player) => (
  Math.abs(player.paceRating! - player.spinRating!) >= 20
  || player.battingConsistency! >= 80 || player.battingConsistency! <= 20
  || player.bowlingConsistency! >= 80 || player.bowlingConsistency! <= 20
  || Math.abs(player.pressureRating! - player.bigMatchRating!) >= 30
  || phaseSpread(player, "batting") >= 25
  || phaseSpread(player, "bowling") >= 25
  || player.fieldingRating! >= 90
  || player.injuryProneness! >= 80 || player.injuryProneness! <= 20
));
assert.ok(extremeProfileRate < 0.50, `too many players have an extreme secondary profile ${extremeProfileRate}`);

for (const [rating, expectedRange] of Object.entries(generationRanges) as Array<[keyof Player, readonly [number, number]]>) {
  const ratingValues = values(allPlayers, rating);
  const boundaryRate = proportion(ratingValues, (ratingValue) => (
    ratingValue === expectedRange[0] || ratingValue === expectedRange[1]
  ));
  assert.ok(boundaryRate < 0.005, `${String(rating)} has a boundary pile-up of ${boundaryRate}`);
}

const reproducibilityInput = {
  index: 44_444,
  season: 2032,
  seed: "regen-secondary-reproducibility",
  players: {},
  nationality: "Indian" as const,
  country: "India",
  preferredRole: "AR" as const,
};
const first = createScoutingGeneratedPlayer(reproducibilityInput);
const second = createScoutingGeneratedPlayer(reproducibilityInput);
for (const rating of secondaryRatings) assert.equal(first[rating], second[rating], `${String(rating)} is not seeded`);

console.log("Regen secondary-attribute population verification passed", {
  playersChecked: generated.length,
  roleCounts: Object.fromEntries(roles.map((role) => [role, byRole[role].length])),
  correlations,
  matchupGapRates,
  consistencyRates,
  mentalContradictionRate,
  injuryMeans,
  fieldingMeans,
  keepingPopulation,
  pronouncedBattingSpecialists,
  pronouncedBowlingSpecialists,
  extremeProfileRate,
});
