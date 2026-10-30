# Aggression and batting tempo calibration

Aggression now selects the final batting pace. Current ability, individual-score and season restraints remain in the neutral expected-runs budget; scoring and wicket chances are solved jointly so those restraints affect productivity without silently changing the attacking identity.

## Target mapping audit

Retained the existing game-design curve: `157.5 + (aggression - 65) * 27.5 / 30 + 20 * max(0, (aggression - 95) / 4)^2`. It is monotonic from 1 to 99 and reaches 208.67 at 99. The steep rise above 95 is intentional. These are gameplay targets, not an empirically established mapping from real-world player ratings. Previously, this curve was applied as a relative multiplier and failed to achieve its own targets.

## Comparable before/after matches

100 fixed-seed matches per combination, unchanged synthetic players/opponents and neutral ground settings. SR is total batter runs divided by total balls faced, multiplied by 100. Rows aggregate the six top-order batters of the test side.

| Batting ability | Aggression | Before SR | After SR | Before runs/dismissal | After runs/dismissal | Before balls/dismissal | After balls/dismissal |
|---|---|---|---|---|---|---|---|
| 75 | 40 | 111.5 | 137.0 | 27.87 | 28.19 | 25.01 | 20.57 |
| 75 | 65 | 126.9 | 161.5 | 26.59 | 27.64 | 20.96 | 17.12 |
| 75 | 85 | 141.8 | 173.1 | 26.66 | 25.33 | 18.81 | 14.63 |
| 75 | 95 | 148.9 | 183.0 | 25.83 | 26.12 | 17.35 | 14.27 |
| 75 | 99 | 163.2 | 207.9 | 24.57 | 23.98 | 15.05 | 11.53 |
| 82 | 40 | 119.6 | 139.0 | 39.30 | 37.32 | 32.85 | 26.84 |
| 82 | 65 | 137.0 | 162.8 | 36.87 | 33.76 | 26.91 | 20.74 |
| 82 | 85 | 149.2 | 175.2 | 29.88 | 32.28 | 20.03 | 18.42 |
| 82 | 95 | 155.0 | 185.3 | 31.50 | 33.61 | 20.31 | 18.14 |
| 82 | 99 | 172.7 | 209.8 | 31.54 | 31.96 | 18.26 | 15.23 |
| 90 | 40 | 128.1 | 139.7 | 52.78 | 48.65 | 41.19 | 34.82 |
| 90 | 65 | 146.0 | 161.8 | 51.82 | 43.70 | 35.48 | 27.01 |
| 90 | 85 | 158.9 | 178.1 | 43.53 | 43.69 | 27.39 | 24.52 |
| 90 | 95 | 164.2 | 182.6 | 44.19 | 41.32 | 26.92 | 22.62 |
| 90 | 99 | 180.9 | 210.4 | 42.48 | 42.65 | 23.48 | 20.28 |

## Larger automatic-match validation

1,000 matches per combination: 15,000 matches total. Includes two complete innings, wickets, wides, no-balls, byes, leg-byes, fielding and chases. Match context remains active; therefore aggregate SR can differ slightly from the neutral target.

| Aggression | Target SR | Ability 75 SR | Ability 82 SR | Ability 90 SR |
|---|---|---|---|---|
| 40 | 134.6 | 136.3 | 138.0 | 138.4 |
| 65 | 157.5 | 157.9 | 159.0 | 159.8 |
| 85 | 175.8 | 174.8 | 176.3 | 177.1 |
| 95 | 185.0 | 184.5 | 185.7 | 186.0 |
| 99 | 208.7 | 208.3 | 208.9 | 209.1 |

## Playable-match validation

300 matches per combination: 4,500 matches total, with automatic choices in playable mode. Replays with the same decisions are deterministic. Playable fields differ from instant-match fields, so the two modes are tested against the target separately rather than expected to produce identical scorecards.

| Aggression | Ability 75 SR | Ability 82 SR | Ability 90 SR |
|---|---|---|---|
| 40 | 137.3 | 138.1 | 138.2 |
| 65 | 158.2 | 159.2 | 159.7 |
| 85 | 175.1 | 176.9 | 176.5 |
| 95 | 184.0 | 184.1 | 185.1 |
| 99 | 207.9 | 209.3 | 208.8 |

## Productivity and limitations

Controlled tests sample 30,000 uncapped innings for each of 15 profile/aggression combinations (450,000 innings). Aggregate SR is within 3 points of target and runs per dismissal remain within 5% across aggression settings. The analytical test also preserves the neutral run budget to numerical precision, including wicket balls and incidental zero-run extras.

In complete matches, expected productivity is preserved locally, not guaranteed to produce identical season totals or batting averages: overs limits, chases, set-batter bonuses and changing match state still matter. In the 1,000-match test, runs per dismissal decline by roughly 8–11% between aggression 40 and 99. Higher ability remains more productive at every aggression setting. Automatic test-side mean totals range from about 143 to 197, with roughly 4–9 wickets lost.

Player profiles are synthetic ability bands (75/82/90), all with neutral consistency and mental ratings. The local player API was unavailable; this is not a measurement of Suryavanshi’s live save. Existing scores are not recalculated.

Wicket probabilities here describe chances; the existing fielding model still decides completion. Free hits and no-balls retain their special dismissal rules. Extremely weak batters may hit feasibility limits; the calibration helper returns both requested and achieved expectation.

## Reproduce

Run `npm run test:aggression-targets` for deterministic analytical and sampled checks.

Run `npm run test:aggression-matches` for the 100-match-per-combination smoke test. Set `AGGRESSION_SAMPLES=1000` for the larger run. Set `AGGRESSION_MODE=playable` for playable mode. Set `AGGRESSION_OUTPUT` to a JSON path to save results. All runs use fixed paired seeds.

Related regressions passed: aggression tempo, batting aggression, season restraints, consistency neutrality, phase specialisation, Impact batting order, fielding/wicketkeeping, pace/spin matchups and pressure/big-match behaviour. TypeScript checking passed.

The Impact batting-order regression now validates the planned recommendation and permits the existing not-used outcome when a chase finishes before the incoming number-five batter is required. The previous assertion depended on its fixed seed always losing enough wickets.
