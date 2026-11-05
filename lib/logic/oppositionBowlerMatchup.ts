import type { Player } from "@/lib/types";

export type MatchupGrade = "!!" | "!" | "-" | "+" | "++";
export interface BowlerMatchup {
  bowler: Player;
  score: number;
  grade: MatchupGrade;
  reasons: string[];
}
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const rating = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;

/** Advisory estimates, not head-to-head records or a predicted dismissal probability.
 * Missing/default attributes are neutral. Type/phase signals follow the engine's
 * player-relative baselines. Quality is supporting evidence, not the main ranking.
 */
export function assessBowlerMatchup(bowler: Player, batter: Player, battingPosition: number): BowlerMatchup {
  const reasons: { impact: number; text: string }[] = [];
  let score = 50;
  const add = (impact: number, positive: string, negative: string) => {
    score += impact;
    if (Math.abs(impact) >= 1) reasons.push({ impact, text: impact > 0 ? positive : negative });
  };
  const spin = bowler.bowlingStyle === "Spinner" || bowler.role === "Spin Bowler";
  const family = spin ? "spin" : "pace";
  add(clamp((bowler.currentBowling - batter.currentBatting) * .15, 6), "Bowling quality compares well", "Batter has the quality advantage");
  const pace = rating(batter.paceRating);
  const spinRating = rating(batter.spinRating);
  // Same 60/40 type baseline as getRelativeBattingTypeSignal in the engine.
  const typeBaseline = pace * .60 + spinRating * .40;
  const typeRating = spin ? spinRating : pace;
  add(clamp((typeBaseline - typeRating) * .65, 15), `Exploits a weakness against ${family}`, `Batter is strong against ${family}`);

  const leftBatter = batter.battingStyle === "Left-hand";
  const knownHand = leftBatter || batter.battingStyle === "Right-hand";
  if (spin && knownHand && bowler.spinStyle && bowler.spinStyle !== "mystery_spin") {
    const turnsAwayFromRight = ["leg_spin", "left_arm_orthodox"].includes(bowler.spinStyle);
    const away = leftBatter ? !turnsAwayFromRight : turnsAwayFromRight;
    add(away ? 3 : -2, "Stock spin turns away from this batting hand", "Stock spin turns into this batting hand");
  }
  // Entry timing is estimated from batting position; it is not a guaranteed phase.
  const weights = battingPosition <= 2 ? [.5, .35, .15] : battingPosition <= 5 ? [.15, .55, .3] : battingPosition <= 8 ? [.02, .33, .65] : [0, .15, .85];
  const bowlingPhases = [bowler.powerplayBowling, bowler.middleOversBowling, bowler.deathBowling];
  const battingPhases = [batter.powerplayBatting, batter.middleOversBatting, batter.deathBatting];
  const phaseNames = ["powerplay", "middle overs", "death overs"];
  const likelyPhase = weights.indexOf(Math.max(...weights));
  // Same 30/45/25 phase baseline as getRelativePhaseSignal in the engine.
  // A flat profile (including all default 50s) supplies no specialisation edge.
  const baseline = (phases: (number | undefined)[]) => rating(phases[0]) * .30 + rating(phases[1]) * .45 + rating(phases[2]) * .25;
  const bowlingBaseline = baseline(bowlingPhases);
  const battingBaseline = baseline(battingPhases);
  const phaseFit = weights.reduce((sum, weight, i) => sum + weight * ((rating(bowlingPhases[i]) - bowlingBaseline) - (rating(battingPhases[i]) - battingBaseline)) * .30, 0);
  add(clamp(phaseFit, 12), `Good fit for likely ${phaseNames[likelyPhase]} exposure`, `Less suited to likely ${phaseNames[likelyPhase]} exposure`);
  add(clamp((rating(bowler.bowlingEconomyControl) - 50) * .1, 5), "Reliable run control", "Loose run control adds risk");
  add(clamp((rating(bowler.bowlingConsistency ?? bowler.consistency) - 50) * .06, 3), "Consistent execution", "Execution can be inconsistent");
  add(clamp((rating(bowler.pressureRating) - 50) * .04 * weights[2], 2), "Handles late-innings pressure well", "Pressure handling is a concern");
  if (!spin && bowler.bowlingHand === "Left-hand" && knownHand && battingPosition <= 2) {
    add(1, "Left-arm pace offers a different new-ball angle", "");
  }
  if (bowler.bowlingUsage === "part_time" || bowler.bowlingUsage === "emergency") {
    add(-4, "", "Part-time option: use selectively");
  }
  score = Math.max(0, Math.min(100, score));
  const grade: MatchupGrade = score >= 65 ? "++" : score >= 55 ? "+" : score > 45 ? "-" : score > 35 ? "!" : "!!";
  return { bowler, score, grade, reasons: reasons.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 4).map(reason => reason.text) };
}
