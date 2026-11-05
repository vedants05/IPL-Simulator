# Economy control ratings — 3 November 2026

All 347 database players have a 1–99 value in `professionalism`, mapped to `bowlingEconomyControl` by the app. The database verification file records a complete read-back.

## Evidence and confidence

208 values use recent bowling evidence; 139 are explicit provisional gameplay priors. Confidence: {'low': 101, 'medium': 72, 'provisional': 139, 'high': 35}. These labels describe data coverage, not formal statistical confidence intervals.

The final model uses 114,550 over/spell segments from 2024–2026, cutoff 2026-11-02. Source archives cover older matches for validation. Contiguous spells are separated when a bowler changes during an over.

Sources: [Cricsheet downloads](https://cricsheet.org/downloads/), [JSON format](https://cricsheet.org/format/json/), [player register](https://cricsheet.org/register/). Download manifest and hashes are stored alongside the local archives. Cricsheet coverage is incomplete, including withheld Afghanistan matches.

## Model

Weighted ridge regression estimates conceded runs per over. Exposure is legal balls/6; wides and no-ball runs count against the bowler while byes and leg-byes do not. Super Overs are excluded. Features: competition-season, venue, over, phase, innings, wickets before the spell, required rate before the spell, opening batter identity and bowler identity. Phase boundaries scale for shortened innings. Batter identity is a partial opposition-strength adjustment, not a complete lineup model. No pitch/dew or unobserved tactical adjustment is claimed.

Recent observations have a two-year half-life. Regularisation is chosen on 2025 data after training on 2022–2024. A separate 2026 chronological test trains on 2023–2025 with the already selected regularisation. Each baseline is independently refitted without bowler identity.

Selected alpha: 40. 2026 test: 35,290 segments; weighted MSE 22.2287 versus 22.3672 without bowler identity, a 0.62% reduction. This is a modest predictive improvement, not proof that each individual estimate is exact.

Rating = round(70 − 18 × penalised bowler runs-per-over effect), bounded 1–99. This fixed display scale is a gameplay choice; it is not a published cricket rating. A negative estimated bowler effect means fewer runs conceded. Small samples shrink towards average control. Missing evidence uses round(clamp(70 + (currentBowling − 82) × .65, 15, 80)), explicitly marked provisional. Boundary, dot and extras counts are used in the input summaries rather than added as duplicate bonuses to the same economy signal.

Identity matching uses the register, explicit disambiguation and a saved reviewed mapping. Duplicate player identities are rejected. Unresolved players retain provisional values; similar names are never substituted on later runs. Values are not adjusted to force named players into a preferred order.

Confidence rules: high requires at least 600 recency-weighted balls and 180 IPL balls; medium requires 240 weighted balls; other measured estimates are low; no recent bowling data is provisional. Retirement, injury and future career development are not inferred from these estimates.

## Integration and verification

The engine replaces most of the old overall-ability scoring multiplier with economy control: exp((82 − effective bowling ability) × .006 + (70 − economy control) × .012), bounded .62–1.22. Overall bowling ability still affects wicket threat and productivity. Players without the new field retain the previous calculation for compatibility. Existing database-player refresh also imports the new field. New generated players receive a 1–99 economy-control rating using a bowling-ability prior (70 + .65 × (ability − 82)) and a nine-point normal spread. Every role receives a latent value so future part-time bowlers are covered. Auction and scouting generation use an independent deterministic random stream. Existing generated players with missing ratings are backfilled once on career initialization; saved values are preserved. A 10,000-player generation check and legacy-save round-trip checks pass.

AI death bowling now protects each nominated bowler’s planned capacity when feasible. Reservations are released for chases projected to finish before the death; completing legal overs takes priority if no protected rotation is feasible.

Twenty fixed-squad instant seasons use the same match seeds and public player snapshot as the previous revised audit, with the new field added. Differences below combine the ratings and death-over allocation changes; they do not isolate either contribution.

| Mean per season | Previous | Current |
| --- | ---: | ---: |
| Run rate | 9.97 | 9.50 |
| First innings runs | 187.19 | 180.71 |
| Sixes | 1413.70 | 1293.50 |
| Hundreds | 17.95 | 12.50 |
| First innings 250+ | 7.60 | 3.45 |

Bumrah bowls 2,635/6,709 deliveries (39.3%) from over 16 onward, versus zero previously. All audit scorecard arithmetic checks pass.

## Files and reproduction

`ratings.csv`: full player list with rating, confidence, evidence and identity. `ratings.json`: machine-readable estimates and validation. `ratings-by-team.md`: readable list. `players-before.json` and `database-backup-before-apply.json`: original values. `database-verification.json`: read-back result. Raw archives and intermediate pickle caches remain local.

Run `python calibration/generateEconomyControl.py`, then `python calibration/reportEconomyControl.py`. To apply or verify the database, use Node with `.env.local`: `calibration/applyEconomyControl.mjs --apply` or `--check`. The apply tool checks identities and expected current values, updates only professionalism and verifies all rows. A later refresh requires a newly reviewed input snapshot and cutoff.

Remaining limitations: mostly additive contextual effects, incomplete competition coverage, proxy opposition strength, a fixed rating scale and provisional values for unavailable evidence. The league tests repeat fixed squads, not full career progression. No claim is made that centuries, sixes or individual economy rates are fully calibrated in every scenario.

## Completed checks

Five playable seasons: run-rate range 9.35–9.49; all scorecard arithmetic checks pass.

Economy-control mapping and monotonicity checks, phase-specialisation and bowling-consistency regressions passed. Aggression full-match checks passed in instant and playable modes (3,000 matches combined). Bowling-quality full-match checks passed in both modes (4,800 matches combined). TypeScript no-emit check, Python compilation and git diff whitespace check passed. These synthetic checks also cover the compatibility path for players without the new attribute.
