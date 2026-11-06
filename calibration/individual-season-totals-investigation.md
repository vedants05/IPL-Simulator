# Individual season totals: investigation and proposed solution

Status: investigation only. No gameplay or balancing changes implemented.

## Evidence

80 simulated seasons / 5,920 matches. Twenty match-seed repeats per scenario, one completed mega-auction allocation. Fixed AI XIs, Balanced tactics, default home conditions, no active injuries. Before uses 2027; after uses 2028. Diagnostic ablation disables both season-run penalties in memory only. Same scenario seeds are paired; divergent deliveries change subsequent RNG consumption. This is not the user's active save, and one auction allocation cannot rule out an auction-distribution problem.

All values below are averages per simulated season.

|Scenario|Seasons|Leading runs|600+ batters|800+ batters|Leading wickets|25+ bowlers|30+ bowlers|
|---|---:|---:|---:|---:|---:|---:|---:|
|before|20|780.15|7.55|0.55|30.6|2.75|0.9|
|after|20|805.15|7.5|0.7|29.45|2.95|0.8|
|before-unrestrained|20|791.15|7.4|0.6|30.55|3.1|0.8|
|after-unrestrained|20|831.6|7.8|0.8|29.45|2.95|0.65|

## Findings and confidence

1. Confirmed asymmetric season-total suppression: `seasonBattingRegressionAdjustment` reduces batting ability based on runs/match, accumulated runs and rating qualification, capped at -10. `extremeSeasonConversionAdjustment` separately reduces scoring and increases dismissals from 725 runs, saturating at 900. These compound. There is no corresponding accumulated-season-wickets adjustment; the bowling-haul restriction applies within an innings only. This makes sustained batting success more restricted than sustained bowling success.
2. Measured contribution: removing both penalties raised average leading totals by 11 runs before auction and 26.45 after auction. It did not reduce average leading wicket totals materially. Therefore the penalties are a real design concern, but are not proven to cause the reported post-auction distribution shift.
3. Controlled auction comparison does not reproduce the reported direction: leading runs increased, leading wickets decreased. Counts of 25+ bowlers rose slightly (2.75 to 2.95), while 30+ fell. Do not describe this as disproving the user's observation.
4. Opportunities in this allocation stayed similar: the five leading batters averaged 411.55 balls before versus 413.28 after; the five leading wicket-takers averaged 340.59 legal bowling balls before versus 340.53 after. The user-save hypothesis remains: elite batters can lose opening/top-three opportunities after redistribution while elite bowlers retain near-full quotas.
5. Rating/lineup screening: this auction did not create a league-wide top-order batting collapse. Team-level recruitment and order differences still exist. No evidence supports a blanket batting boost or blanket wicket reduction.
6. Rollover explicitly clears live batting statistics; progression preserves phase and pace/spin attributes. An active-save reload/migration error is not excluded by a code-path inspection.
7. The simulator also applies rating-based innings conversion limits, a strong below-75 batting adjustment, season form, matchup effects and bowling selection that reserves death overs. These can change distribution without an equivalent change in team totals; their individual causal contributions remain unmeasured.

## Proposed solution plan — approval required before implementation

### 1. Reproduce the user's seasons

Read the affected save and adjacent season archives. Identify first post-mega year, compare full seasons and league-only fixtures, and keep playoff totals separate. For each player capture matches, actual innings, not-outs, runs, balls, batting position distribution, wickets, legal balls, runs conceded and selected-XI frequency. Check ranking UI totals against scorecards; check that prior-season form/aggregates are not used as live season counters. Quantify 500/600/700/800/900-run and 20/25/30/35-wicket counts, leader/top-five totals, and concentration shares. Avoid treating batting innings as matches or decimal cricket overs as fractional overs in development diagnostics.

### 2. Separate opportunity from performance

For affected high-rated batters compare balls per innings, dismissal rate, strike rate, opening/top-three access, impact entry position, injuries and selection frequency. For bowlers compare balls per match, wicket rate per ball, death-over share and team wicket share. If wickets rise mainly because workload rises, fix allocation/selection rather than wicket probability. If runs fall mainly because balls faced fall, fix batting order/impact selection rather than scoring rates.

### 3. Isolate auction, year and progression

Run multiple independent mega auctions. Cross identical players and XIs with old/new year seeds; hold ratings constant while changing squads; hold squads constant while changing progression; compare default and saved tactics/venues. Use matched fixtures/seeds and report distributions across auction allocations. Current 20-repeat experiment covers only one auction allocation and changes both year and squads.

### 4. Repair confirmed mechanisms

Proposed direction: replace the two accumulated-run brakes with a single modest, continuous, evidence-based form/fatigue model. An exceptional run total alone should not make a batter score worse or become easier to dismiss. Preserve realistic rare seasons through underlying ability, consistency, conditions and opportunities. Do not add a mirrored hard wicket cap to conceal the asymmetry.

If reproduced: protect sensible opener/top-order access for elite batters in recruitment/XI/impact logic; avoid overstocking interchangeable openers; keep strongest batting XI and logical order. Correct excessive wicket concentration using phase suitability, rest and legal quota planning only where diagnosed. Repair any stale season-state/stat aggregation defect directly. Keep team tactics effective.

### 5. Acceptance checks

Use at least 20 independent auction allocations and enough season repeats to estimate variation. Compare adjacent years, mini-auction years and several mega cycles. Require no systematic post-mega downward shift in elite batting opportunities or upward shift in wicket rate after controlling for ratings and conditions. Agree realistic target distributions for leader totals and threshold counts before tuning. Retain rare exceptional batting and bowling seasons. Check team totals, all-outs, boundary/dot rates, 4-over quota, 20-over innings, impact legality, chase behavior, instant/playable agreement, scorecard arithmetic and archive totals. Do not force every season or every player to meet a prescribed total.

## Next decision

Approve the direction after the active-save reproduction identifies the dominant cause. Implement only supported fixes, then repeat the comparisons. This report is a plan, not a claim that the user's specific save has been diagnosed.
