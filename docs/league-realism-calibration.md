# League realism calibration — 2 November 2026

Follow-up: [economy-control ratings and revised validation](bowling-economy-control.md), 3 November 2026, supersedes the remaining-work assessment below.

## Changes

`lib/logic/matchSimulation.ts` now carries opponent bowling control into the final
tempo calculation. Previously the final tilt restored the same strike rate even
after strong bowling reduced the neutral scoring distribution.

The neutral aggression curve is now:

- Aggression <=65: `135 + aggression - 65`.
- Aggression >65: `135 + (aggression - 65) * 40/30 + 85/3 * max(0, (aggression - 95)/4)^2`.
- Anchors: 40 ->110, 65 ->135, 85 ->161.67, 95 ->175, 99 ->208.67 SR.

These are calibrated gameplay references, not an empirical claim that an aggression
rating has a universally correct real-world strike rate. The middle of the old
curve made ordinary batting styles too quick across the current league squads;
the extreme attacking identity at 99 is retained.

Opponent control is `clamp(exp((82 - effectiveBowlingRating) * .024), .62, 1.32)`.
The reference opponent is 82 CA. Pitch, form, momentum and fatigue already enter
the effective bowling rating. The control factor multiplies both the target pace
and the neutral runs-per-wicket-chance budget. This preserves the bowler's local
wicket threat while reducing scoring; multiplying only the target would also
reduce wicket probability.

For fixed opposition and conditions, changing only aggression preserves expected
runs per wicket chance and changes how quickly the batter uses that budget.
Changing bowling quality is allowed to change productivity. Completed matches
also have finite overs, chases and fielding, so equal season averages are not
guaranteed across aggression settings.

The neutral venue reference is 185, applied consistently to the run budget and pace.
Venue factors are bounded at .82–1.18. The final context safety range is .45–1.8,
replacing the old .85–1.15 cap that flattened otherwise different conditions.
Middle-over pace is reduced by 6%; death-over pace increases by 10% before existing
specialist and tactical modifiers. Neutral outcome weights favour more singles
and twos and a smaller boundary budget, reducing excessive run production and
centuries while preserving the high-aggression boundary preference.

Both economy inputs to the supporter/staff review in `app/game/overview/page.tsx`
now convert cricket-notation overs using the shared `oversToBalls` helper. Thus
32 runs from 3.2 overs is 9.60 rather than 10.00.

## Paired league audit

20 seasons before and 20 after, 74 matches each: 2,960 instant matches. Same input
snapshot, seed sequence, fixed AI XIs and Balanced tactics. The cached snapshot
reproduced the original five baseline seeds exactly. All current database players
and ten teams are included. No database or career save writes occur.

Seeds 1–5 were used while tuning. Seeds 6–20 were held out until the parameters
were stable; their results remain close to the full-sample result. Five additional
playable seasons and two seasons each with all bowling abilities set to 60 or 100
check the other simulation mode and quality sensitivity.

| Measure, mean per season | Before | Revised |
| --- | ---: | ---: |
| League RR | 11.71 | 9.97 |
| First innings average | 219.95 | 187.19 |
| Best economy, minimum 180 legal balls | 10.02 | 6.83 |
| Bumrah economy | 11.66 | 7.92 |
| Median SR, batters facing >=200 balls | 191.30 | 159.54 |
| Qualified batters at SR >=200 | 12.4 | 2.5 |
| Fours | 3265.4 | 2352.2 |
| Sixes | 1692.5 | 1413.7 |
| Hundreds | 31.9 | 17.9 |
| First innings >=250 | 16.8 | 7.6 |
| Powerplay / middle / death RR | 11.93 / 11.62 / 11.54 | 9.72 / 9.66 / 11.70 |

The revised best-economy range is 5.96–7.47, with a 6.83 mean. An occasional
exceptional season is possible; no minimum-economy quota or hard floor is imposed.
Suryavanshi's pooled SR is 198.92 in the 20 instant seasons and 204.78 in the five
playable seasons. The neutral 208.67 reference is not an annual guarantee.

Held-out seeds 6–20: RR 11.70 ->9.95, mean first innings 219.85 ->186.79, best
economy 9.98 ->6.90, hundreds 32.1 ->17.4 and first-innings 250+ totals 16.5 ->7.5.
All league scorecard arithmetic checks passed. The full comparison, workloads,
aggression bands, ability groups and season ranges are in
`calibration/results/league-realism-comparison.md`.

The five playable seasons produced RR 9.85–10.14 and best qualified economy
6.82–6.99. The artificial all-100 and all-60 attacks produce very different scoring
environments; they establish sensitivity rather than real-world target levels.

## Regression checks

- 4,800 controlled full matches across instant/playable modes, aggression
  40/65/85/99 and opponent bowling ability 60/82/94: passed. Stronger bowling
  lowers SR, economy and runs per dismissal while retaining a wicket advantage.
- 3,000 aggression smoke matches across batting abilities 75/82/90, five aggression
  values and both modes: passed. Higher aggression retains higher tempo and
  boundary preference; batting ability retains its productivity advantage.
- A larger 15,000-match instant diagnostic explains the first-innings/chase
  difference: aggression-99 first-innings SR is 204.89/207.05/208.12 across those
  abilities, while chase SR is 195.46/195.25/194.53. Low chases against the fixed
  aggression-65 opposition often finish before the death phase. The regression
  therefore checks the 200+ reference in first innings and permits chase context
  in the pooled rate; the analytical neutral target stays exact.
- Analytical aggression targets, run-budget neutrality, bowling control, feasible
  outcome weights and context differentiation: passed.
- Phase specialisation, pace/spin matchups, pressure/big-match effects, fielding,
  wicketkeeping, batting order/Impact, batting/bowling consistency, venue ability
  and season-ranking arithmetic regressions: passed.
- TypeScript `tsc --noEmit --incremental false` and `git diff --check`: passed.

## Remaining limitations

Compared with the historical cross-checks in the original audit, league RR remains
around 4% above the roughly 9.6 environment of 2024/25. Sixes and centuries remain
somewhat elevated. The 250+ comparison is conservative: the simulated count here
includes first innings only, whereas the historical eight totals in 2024 includes
both innings. Maidens, extras, all-outs and dismissal proportions still need a
matched ball-by-ball reference dataset before drawing conclusions.
The selected 70–79 bowling-ability group now concedes about 12 per over, so the
strength of the lower-end penalty also needs a matched workload/phase benchmark.
Phase tables use fixed overs 1–6, 7–16 and 17–20 even when a match is rain-shortened;
they establish an overall improvement, not validation of shortened-innings phases.

The league runs repeat fixed 2027 squads. Aging, transfers, injuries, staff changes
and career progression are not covered. Playoff ties use points and run differential
in the harness rather than exact career NRR, and knockout venues use the listed
home team. Existing scorecards are stored results and are not recalculated.

## Reproduce

With Node >=22.12, the audit uses the cached public game-data snapshot at
`calibration/results/league-realism-input.json`. If missing, it reads Supabase using
the configured `.env.local`. Snapshot contents are fingerprinted so comparisons
reject different player/team inputs.

```powershell
$env:AUDIT_SEASONS='20'
$env:AUDIT_OUTPUT='calibration/results/league-realism-revised-instant.json'
node --env-file=.env.local scripts/runCalibration.cjs calibration/leagueRealismAudit.ts

$env:AUDIT_MODE='playable'
$env:AUDIT_SEASONS='5'
$env:AUDIT_OUTPUT='calibration/results/league-realism-revised-playable.json'
node scripts/runCalibration.cjs calibration/leagueRealismAudit.ts

$env:AUDIT_BEFORE='calibration/results/league-realism-before-20.json'
$env:AUDIT_AFTER='calibration/results/league-realism-revised-instant.json'
$env:AUDIT_REPORT='calibration/results/league-realism-comparison.md'
node scripts/runCalibration.cjs calibration/summarizeLeagueRealism.ts

$env:BOWLING_TEMPO_MODE='both'
node scripts/runCalibration.cjs calibration/bowlingTempoVerification.ts calibration/leagueRealismProbe.ts
node scripts/runCalibration.cjs calibration/aggressionTargetVerification.ts calibration/aggressionMatchVerification.ts
```

`AUDIT_VARIANT=bowling60|bowling100|aggression50` sets fixed-lineup controls.
`AUDIT_INPUT` overrides the snapshot path. `AUDIT_FETCH_ONLY=1` creates a snapshot
without simulating. The pre-change 20-season JSON is preserved; rerunning the
revised engine cannot regenerate old-model results.
