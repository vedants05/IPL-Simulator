# Seasonal economy form

Each player has a deterministic seasonal run-prevention modifier shared across fixtures and both simulation modes. Seeds use the same season/save prefix as existing seasonal form. Reloads preserve the modifier; a new season changes it.

Annual draws: 80% ordinary (-6% to +6%), 10% exceptional (-24% to -12%), 10% poor (+8% to +24%). These modify expected scoring pace, not final scorecard economy. The final modifier blends 75% current draw with 25% previous year's draw. Exceptional previous form can therefore carry into an otherwise ordinary year. High consistency narrows the spread by up to 25%; low consistency never expands the ordinary draw beyond 6%.

This replaces the old small seasonal bowling-ability adjustment. Recent bowling form, match luck and delivery variation remain active. Base Economy Control is preserved.

Verification: 10,000 player-season samples averaged a 0.99818 scoring multiplier. Across 2,000 synthetic seasons, a 60-control bowler reversed the expected scoring advantage of an otherwise identical 80-control bowler 24 times. This is a probability-level check, not an observed league leaderboard frequency. Full-match bowling regressions passed across 1,200 instant/playable matches.

Run `node scripts/runCalibration.cjs calibration/seasonalEconomyVerification.ts` to verify distribution, deterministic reloads, fixture stability and ranking reversals.
