# Remaining simulation realism issues — 2 November 2026

Follow-up: [economy-control implementation and results](bowling-economy-control.md), 3 November 2026. The findings below describe the earlier engine.

## Evidence and scope

Replayed the revised 20-season audit (1,480 matches) with delivery-level workload,
venue and batting-innings diagnostics. Every season summary exactly matches the
previous revised result. Diagnostic bowling balls/runs and boundary counts reconcile
with scorecards. No production simulation parameters were changed for this analysis.

These are repeated fixed 2027 squads, Balanced tactics and default home venues,
not twenty consecutive career years. Comparisons with 2024/25 are reference checks,
not a claim that different squads should reproduce those seasons exactly.

## 1. Bowling allocation is the first problem to fix

| Bowling ability | Share of legal deliveries | Economy | Share of own deliveries in overs 17–20 |
| --- | ---: | ---: | ---: |
| Below 70 | 0.11% | 17.01 | 95.43% |
| 70–79 | 13.11% | 12.05 | 36.07% |
| 80–89 | 77.76% | 9.71 | 11.54% |
| 90+ | 9.02% | 7.83 | 0.57% |

Jasprit Bumrah delivered **zero balls in overs 16–20**, from 7,292 balls across
twenty seasons. This also holds when defending a first innings, so short chases
cannot explain it. Archer bowled 581/7,007 balls in overs 16–20; Rabada 894/6,890.
The elite group includes spinner Varun Chakravarthy, but Bumrah's individual result
establishes that this is not just a spin/pace mix issue.

`chooseBowler` reserves death bowling through a score penalty, rather than keeping
the planned capacity available. `requiredReserve` is capped by remaining capacity.
Selecting a reserve bowler therefore receives at most a 12-point reservation
penalty; once capacity is spent the requirement shrinks. Quality, phase fit,
performance and chase bonuses can outweigh it. This is a mechanism consistent
with the observed early exhaustion, not a measured attribution of every selection.

Fix direction: protect a feasible per-bowler death allocation in normal first
innings; explicitly release it when a chase is likely to finish early. Test both
cases and ensure weaker options cannot inherit all the late overs by default.
Judge elite economy again after correcting workload; the current 6–7 best-economy
results alone are insufficient validation.

## 2. The weak-bowler scoring penalty compounds the workload issue

The new control multiplier is `clamp(exp((82-rating)*.024), .62, 1.32)`.
An effective rating of 78 allows about 10% more scoring than the reference,
76 about 15.5%, and 70 about 32%. Effective ratings also include match luck,
pitch, momentum, fatigue and weather. In addition, skill differences already
affect the neutral run budget and wicket threat. The new control is necessary to
stop the tempo solver undoing bowling quality, but its lower end needs calibration.

This is not only a death-over effect: the 70–79 group concedes 11.31 in overs 7–16,
versus 9.35 for the 80–89 group. Regular workloads include Sakib Hussain at 11.91
(55.1 overs/season), Praful Hinge at 12.78 (35.5), Rasikh Salam at 12.41 (33.9)
and Jaydev Unadkat at 12.67 (29.4). These are simulated results, not assessments
of those players' real-world skill.

The below-70 headline of 17.01 needs restraint: it represents only 350 balls in
twenty seasons, almost entirely at the death. Among all player-seasons with at
least 30 overs, 59/915 have economy >=12 and 3/915 >=14.

Fix direction: after allocation, test a gentler asymmetric penalty below the
reference while preserving elite control. Compare the same batters, venues and
phases before assigning a target economy to any ability band. Do not impose an
economy ceiling or make all bowlers similar.

## 3. Sixes remain elevated; the outcome distribution explains why

Mean sixes fell from 1,692.6 to **1,413.7** per season. They occur every **11.13
legal balls**, versus 9.26 previously. Fours are 14.94% and sixes 8.98% of legal
balls; boundaries contribute 69.89% of bat runs.

For context, IPL 2025 had 1,294 sixes and RR 9.62 ([Outlook season review](https://www.outlookindia.com/sports/cricket/rcb-maiden-win-high-run-rates-sai-sudharsan-run-scoring-numbers-that-defined-ipl-2025)).
The reported 2024 six frequency was roughly once every 13 balls ([Indian Express](https://indianexpress.com/article/sports/ipl/ipl-turns-18-2024-witnessed-an-unprecedented-1260-sixes-one-every-13-balls-whats-in-store-this-year-9891898/)).
Raw season totals differ in exposure; use delivery rates for final calibration.

There are three reinforcing mechanisms:

- Neutral six weight rises with `boundaryFactor^1.35`, faster than four weight.
- High aggression boosts six weight more than four weight and reduces singles/twos.
- The final exponential adjustment restores the requested SR. Positive adjustment
  multiplies six weight by `exp(6*t)` and four weight by `exp(4*t)`, increasing the
  six/four ratio further whenever the requested tempo exceeds the starting mix.

Thus simply reducing base six weight is not a reliable independent fix: the final
adjustment partially compensates to reach the same scoring target. The exact
contribution of each mechanism still requires a controlled ablation.

Fix direction: calibrate the boundary/rotation mix separately from total tempo,
and distinguish boundary frequency from six-versus-four conversion. Preserve
aggression-99's high neutral SR and attacking identity. Validate both SR and sixes
per ball, rather than only average team totals.

## 4. Centuries are still too frequent across the top order

There are **17.95 hundreds per season** (13–26), down from 31.85. IPL 2024 had
14 in 71 matches ([Scroll data review](https://scroll.in/field/1067876/scroll_in));
that is about 14.59 per 74 matches. The current simulation rate is roughly 23% higher.
This single historical reference is not a hard annual quota.

Of 359 simulated hundreds, 302 (84%) come from positions 1–3 and 244 (68%) in
first innings. Only 11 come from ability below 80. Suryavanshi accounts for 20
(5.6%); Head 26, Abhishek 25, Kohli 22 and Rahul 18. This is broader than a single
high-aggression player. RCB and SRH concede 138/359 hundreds combined.

Existing score-dependent restraints reduce the neutral scoring budget and increase
wicket pressure. They are not included directly in `paceContext`, so the solver
still aims at the style/context SR and adjusts wicket probability instead. They
are therefore not absent or wholly bypassed. Strong batting, generous conditions
and weak attacks can nevertheless leave too much scoring opportunity.

Fix direction: correct bowling allocation, weak-bowler control and six conversion
first; then measure 30→50, 50→80 and 80→100 conversion by ability, batting position
and balls remaining. Only then adjust sustained-innings survival. A forced
dismissal near 100 or a lower aggression-99 target would obscure the causes.

## 5. Extreme totals and venue separation remain too wide

| Home venue grouping | Pooled RR | Sixes per 100 legal balls |
| --- | ---: | ---: |
| KKR | 8.29 | 6.24 |
| CSK | 8.61 | 7.22 |
| RCB | 11.93 | 11.92 |
| SRH | 12.92 | 14.33 |

These are both-innings rates at the listed home venue, confounded by home squads,
opponents and the harness's knockout venue assignment. They do not isolate pitch
effects. Venue tempo, bowling quality and phase/matchup modifiers multiply together;
the final context allowance reaches 1.8, so combinations deserve controlled tests.

Both-innings 250+ totals still average **11.65 per season**. More concerning,
300+ totals rose from 0.25 to **0.70 per season** despite the lower mean: 14 across
twenty seasons, maximum 338. Fixing the average has not fixed the extreme tail.
Conversely, first innings below 150 rose from 5.4 to 15.2 per season. All-outs
remain about 40.75/148 innings, and batting ability below 70 averages 3.92. These
last two need position- and workload-matched real data before declaring them bugs.

## Validation gaps and next sequence

1. Fix death-over allocation and add full-innings workload checks.
2. Calibrate weaker bowling in matched conditions without losing elite control.
3. Control six/four/rotation proportions independently of SR.
4. Test identical XIs across venues; then tune century conversion and score tails.
5. Repeat both modes using fresh save seeds, varied tactics and career progression.

The current audit's colon-delimited seed changes match RNG between runs, but
`getSeasonalPlayerForm` uses only the first two seed segments. Those are identical
across these runs, so the background seasonal form draw is held fixed as well as
the squads. This is useful for paired comparisons but does not sample the full
season-to-season distribution. The audit's phase tables use 1–6, 7–16 and 17–20;
the engine starts death at over 16 in a full innings. Rain-shortened phase bins
also differ. Bumrah's explicit zero over-16-plus result avoids that ambiguity.

Reproduce diagnostics with `AUDIT_DETAILS=1`, `AUDIT_SEASONS=20` and
`AUDIT_OUTPUT=calibration/results/league-realism-diagnostics.json`, then run
`scripts/runCalibration.cjs calibration/analyzeRemainingRealism.ts`.
Machine-readable analysis: `calibration/results/league-realism-remaining-analysis.json`.
