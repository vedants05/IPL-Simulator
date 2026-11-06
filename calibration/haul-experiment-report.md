# Five-wicket haul experiments

Five paired 74-match simulations use the independent auction snapshots and match seeds from independent-auction-realism-report.md. Only a temporary copy of the engine was changed; the production match engine was not modified. Same seeds do not guarantee identical subsequent balls once an outcome changes. Counts below cover all 370 matches.

| Metric | Current | Moderate | Strong | 2026 (73 matches) |
|---|---:|---:|---:|---:|
| Five or more wickets | 33 | 22 | 11 | 1 |
| Six or more wickets | 5 | 3 | 0 | 0 |
| Exactly four wickets | 108 | 111 | 126 | 17 |
| Exactly three wickets | 281 | 292 | 293 | 54 |
| Wickets per innings | 5.81 | 5.79 | 5.83 | 6.01 |
| Runs per over | 10.04 | 10.03 | 10.03 | 9.89 |
| First-innings average | 188.4 | 188.6 | 188.9 | 195.3 |
| Hundreds | 90 | 92 | 92 | 15 |
| Sixes | 7128 | 7121 | 7100 | 1426 |

Five-plus hauls by season: current 6,10,5,9,3; moderate 6,6,3,5,2; strong 5,2,2,1,1. All runs passed the existing innings-total, bowler-balls and runs-conceded checks. Rates are averages across equal-size seasons; the historical wickets per innings counts all dismissals, and ten wickets on a scorecard is not necessarily all out under impact-substitute rules.

The existing multiplier remains 1 until four credited wickets; it interpolates by bowling rating from 72 to 88. Moderate multiplier range: 0.38–0.55 at four wickets and 0.20–0.30 at five or more. Strong range: 0.12–0.25 at four and 0.05–0.10 at five or more. These modify the input to batting-tempo calibration; they are not direct measured percentage changes to final dismissal probability. Both candidates preserve the existing rating interpolation. The strong variant increases exact four-fors from 108 to 126 (25.2 per season versus 17 in the single 2026 sample), a tradeoff to investigate. One historical season cannot define a precise rare-event target.

Raw moderate results: haul-experiment-1.json through haul-experiment-5.json. Raw strong results: haul-experiment-strong-1.json through haul-experiment-strong-5.json. The test did not cover playable mode, long-term progression or new auction draws beyond the five existing snapshots.
