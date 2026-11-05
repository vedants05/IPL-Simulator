# League simulation realism audit

Date: 2 November 2026. Seed: `league-realism-20261102`.

## Method

Five independent 2027 seasons, each with 70 league matches and four playoffs (370 matches).
Current database squads, fixed AI-selected batting-first / bowling-first XIs, Balanced tactics,
default home pitches, boundary sizes and outfields. No save writes, aging, transfers, injuries,
staff progression or interactive tactics. Six additional control seasons (two per variant)
keep those same plans and change only aggression or bowling ratings on in-memory player copies.
Playoff qualification ties use wins and run differential in this harness, rather than the
career screen's exact net-run-rate calculation; knockout venues use the listed home team.
This is an engine calibration audit, not an end-to-end career progression test or a prediction
that 2027 must reproduce 2024/25 exactly. Five seeds establish repeated large discrepancies;
they do not establish precise probabilities of rare records.

## Repeated findings

| Measure | Five baseline seasons | Interpretation |
| --- | --- | --- |
| Best economy, minimum 180 legal balls / 30 overs | 9.81–10.38 | Missing elite economical spells over sustained workloads |
| Bumrah economy | 10.22–12.07 | Elite control is not expressed strongly enough |
| League run rate | 11.69–11.98 | Substantially above the roughly 9.6 scoring environment of IPL 2024/25 |
| Mean first innings | 216.91–222.07 | Very high even with Balanced tactics |
| Median batter SR, minimum 200 balls | 186.67–193.60 | High tempo is widespread rather than restricted to attacking specialists |
| Batters with SR >=200, minimum 200 balls | 11–14 per season | Too many sustained high-tempo seasons |
| Fours | 3,206–3,295 | Roughly 43–47% above the cited 2025 total of 2,245 |
| Sixes | 1,613–1,733 | Roughly 25–34% above 2025's 1,294 |
| Centuries | 25–43 | Far above even 2024's record 14 |
| First innings >=250 | 13–20 | Extreme totals are much too routine; IPL 2024 had eight 250+ totals across all innings |
| Powerplay run rate | 11.70–12.45 | Phases are too similar; death overs do not consistently stand above powerplay/middle |
| Middle overs 7–16 run rate | 11.60–11.78 | Middle-over suppression is weak |
| Death overs 17–20 run rate | 11.41–11.90 | Often slower than powerplay; survivorship and tail exposure also influence these averages |

The cap winners alone are less alarming: Orange Cap totals were 840–926, Purple Cap totals
25–32. Such totals can happen individually. The clearer errors are the league-wide scoring
level, frequency of hundreds/extreme totals, and lack of low-economy specialists.

Other observations needing more focused benchmarks: only 1–3 maidens per baseline season;
3.26–3.95 extras per innings; 35–44 all-outs. These are observations, not confirmed errors.
Run-outs/dismissal mixes were recorded in JSON but were not validated against a matched
real-world dismissal dataset in this pass.

## Arithmetic checks

All 370 baseline matches passed:

- Sum of batter runs + innings extras = innings total.
- Sum of bowler legal balls = innings legal balls.
- Sum of bowler conceded runs = innings total minus byes and leg-byes.

Economies in this audit use `6 * conceded / legalBalls`. The new season rankings also use
legal balls. This establishes an engine-level problem independent of display rounding.
It does not prove every saved summary, historical record, MVP formula or UI is correct.

Two separate staff-review mappings in `app/game/overview/page.tsx` use
`stats.runsConceded / stats.oversBowled`, although `oversBowled` is cricket notation.
Example: 32 runs in 3.2 overs means 20 balls and economy 9.60; decimal division gives 10.00.
These inputs should convert to legal balls. The main new Player Stats leaderboard does not
have that conversion error. No production calculation was changed during this audit.

## Root cause and controls

`calibrateBattingTempo` calculates:

`targetRunsPerBall = aggressionTarget / 100 * clamp(contextMultiplier, 0.85, 1.15)`

It retains the neutral distribution's runs-per-wicket-chance budget, then changes wicket
probability and exponentially tilts run outcomes to reach that absolute scoring target.
Consequently, better bowling can reduce runs per dismissal / total innings score chiefly
through more dismissals, while the surviving batter still scores at nearly the same rate.
Bowling ability is not ignored, but its run-suppression effect is substantially neutralised.

The direct probe (`leagueRealismProbe.ts`) confirms two deliberately different neutral
distributions both yield SR 166.67 at aggression 75 and neutral context. Wicket chance changes
from 2.79% to 10.72%. Context values 1.2 and 1.6 both yield SR 191.67 because of the cap.
This is consistent with phase/venue/tactical signals losing differentiation at the cap;
the probe does not measure how often every delivery in the full engine reaches that cap.

| Two-season control | League RR | Wickets / innings | Best economy, >=30 overs |
| --- | --- | --- | --- |
| Every batter aggression 50 | 9.78–9.95 | 4.39–4.51 | 8.50–8.62 |
| Every player's bowling ability 100 | 11.42–11.62 | 7.17–7.57 | 9.12–10.58 |
| Every player's bowling ability 60 | 11.99–12.21 | 3.27–3.28 | 9.84–10.58 |

This separates two issues: high aggression across selected squads raises the overall scoring
environment, and the absolute-target calibration prevents bowling quality from reducing pace
enough. Simply reducing everyone’s aggression brings the overall RR closer but still does
not produce the economical elite tail, and removes intended player identities.

## Suggested fix order

1. Make aggression a neutral-context tempo target that opposing bowling skill, phase,
   pitch and tactics can meaningfully modify. Preserve the intended aggression-99 attacking
   identity; it should not guarantee SR 200+ against every attack and situation.
2. Give elite bowling control a measurable scoring-suppression channel distinct from wicket
   taking. Test equal-batter matchups against weak, average and elite bowlers.
3. Recalibrate the league centre and the spread together: qualified economy tails, batting
   SR by style, boundaries, phase rates, hundreds and extreme innings. Do not fit only the cap winners.
4. Revisit the context clamps so phase/venue effects remain visible without runaway stacking.
5. Correct the two decimal-overs staff-review inputs and test cricket-notation overs explicitly.
6. Validate the revised engine over 20+ seeds, then actual multi-year career saves with AI
   tactics, roster turnover, staff, injuries and form. Compare matched workload thresholds.

## Sources

- [NDTV Profit, completed IPL 2025 recap](https://www.ndtvprofit.com/sports/ipl-2026-from-highest-run-scorers-to-leading-wicket-takers-recap-of-the-big-stats-from-2025-season-11210075/amp/1): Bumrah 6.67 from 47.2 overs; leading batters' SRs; cap totals.
- [Scroll, completed IPL 2024 records](https://scroll.in/field/1067876/data-check-at-ipl-2024-a-look-at-the-new-records-for-most-sixes-centuries-scored-and-more): 1,260 sixes, 14 centuries, eight 250+ scores.
- [IPL T20 Stats, total fours](https://iplt20stats.com/ipl/stats/total-fours): 2024 2,174; 2025 2,245.
- [IPL T20 Stats, total sixes](https://iplt20stats.com/ipl/stats/total-sixes): 2025 1,294.
- [RG, completed IPL 2025 numbers](https://rg.org/news/cricket/numbers-that-defined-18th-indian-premier-league-season): RR 9.62, versus 9.56 in 2024.

These secondary sources are cross-checks, not a fully ingested ball-by-ball reference dataset.
Very short-spell economy leaders are deliberately excluded from the simulation comparison.

## Replay

Using Node >=22.12 with `.env.local` configured:

```powershell
node --env-file=.env.local scripts/runCalibration.cjs calibration/leagueRealismAudit.ts
node scripts/runCalibration.cjs calibration/leagueRealismProbe.ts
```

Optional environment variables: `AUDIT_SEED`, `AUDIT_SEASONS`, `AUDIT_VARIANT`
(`baseline`, `aggression50`, `bowling100`, `bowling60`). The harness reads players and teams
from Supabase; it never writes to Supabase or the user's career save. Reports go to
`calibration/results/league-realism-<variant>.json`. The initial five-season baseline
is saved as `league-realism-audit.json`.
