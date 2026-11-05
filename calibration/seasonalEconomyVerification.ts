import assert from "node:assert/strict";
import { seasonalEconomyMultiplier, bowlingTempoMultiplier } from "../lib/logic/matchSimulation";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const values = Array.from({ length: 10000 }, (_, i) => seasonalEconomyMultiplier(`bowler-${i}`, "2030:career:fixture-1"));
assert.ok(Math.min(...values) < .82 && Math.max(...values) > 1.18);
assert.ok(mean(values) > .99 && mean(values) < 1.01, "seasonal variation should preserve overall scoring");
let reversals = 0;
const years: number[] = [];
for (let season = 2000; season < 4000; season++) {
  const seed = `${season}:career:fixture-1`;
  const weak = seasonalEconomyMultiplier("weak", seed);
  const strong = seasonalEconomyMultiplier("strong", seed);
  years.push(weak);
  if (bowlingTempoMultiplier(82, 60) * weak < bowlingTempoMultiplier(82, 80) * strong) reversals++;
  assert.equal(weak, seasonalEconomyMultiplier("weak", `${season}:career:fixture-99`));
  assert.equal(weak, seasonalEconomyMultiplier("weak", seed), "reload must preserve form");
  assert.ok(Math.abs(seasonalEconomyMultiplier("weak", seed, 99) - 1) < Math.abs(weak - 1));
}
assert.ok(reversals > 10, "20-point control gap should occasionally reverse across seasons");
assert.ok(Math.min(...years) < .85 && Math.max(...years) > 1.15);
assert.equal(seasonalEconomyMultiplier("weak"), 1);
console.log({ players: values.length, averageMultiplier: mean(values), range: [Math.min(...values), Math.max(...values)], reversals, seasons: years.length });
