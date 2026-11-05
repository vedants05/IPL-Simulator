/** Relative advisory likelihood, combining phase suitability with recorded use. */
export function oppositionOverLikelihood(ratings: readonly (number | undefined)[], recordedBalls: readonly number[], innings: number): number[] {
  const values = [0, 1, 2].map(i => Number.isFinite(ratings[i]) ? Math.max(0, Math.min(100, ratings[i]!)) : 50);
  const spread = Math.max(...values) - Math.min(...values);
  const midpoint = (Math.max(...values) + Math.min(...values)) / 2;
  const evidence = Math.min(0.55, Math.max(0, innings) / 20);
  const maxBalls = Math.max(0, ...recordedBalls);
  return Array.from({ length: 20 }, (_, i) => {
    const phase = i < 6 ? 0 : i < 15 ? 1 : 2;
    const prior = 0.5 + (spread ? (values[phase] - midpoint) / Math.max(20, spread) * 0.6 : 0);
    const usage = maxBalls > 0 ? (recordedBalls[i] ?? 0) / maxBalls : prior;
    const share = maxBalls > 0 ? evidence : 0;
    return Math.max(0, Math.min(1, prior * (1 - share) + usage * share));
  });
}
