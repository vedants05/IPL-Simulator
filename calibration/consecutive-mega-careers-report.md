# Consecutive 2027 / mega auction / 2028 investigation

10 isolated careers; 1,480 completed matches; 10 separate completed mega auctions. Existing user saves untouched. No production gameplay changes.

## Method

Each career begins with the repository database snapshot. Its own 2027 season is simulated and archived through archiveCareerSeason. beginNextSeasonRetention and completeOffseasonAutomatically then perform progression, offseason generation, retention, player-pool generation and the full 2028 mega auction. Its resulting squads and player state feed its 2028 season. Every season has 70 league matches and four playoffs.

Match preparation uses automatic XI selection per fixture, pitch tuning, bowling-first impact reconciliation, intelligent AI tactics, recent form and staff effects. Stats, pitch tuning, standings and recent-form functions are extracted from the current overview page at runtime to avoid stale diagnostic copies. Background injuries on fixture dates and match injuries use store actions. Exact page stats aggregation feeds the next match and archive. All 20 seasons passed match-count and arithmetic assertions; completed auction states were checked, with no duplicate squad ownership.

Scope limits: these are fresh isolated diagnostic careers, not the active browser save. Default venues are used. There is no interactive user strategy, full daily/international calendar, international availability, midseason trade/replacement-signing orchestration or weather-calendar reproduction. User-side auction is automatically retained and passes bidding; its team rotates across the ten careers. The auction is stochastic and UUIDs are not deterministic, so result files are the authoritative captured runs. Ten auction samples do not exhaust all possible allocations.

## Full-season distribution averages

|Metric|2027|2028|Change|
|---|---:|---:|---:|
|Leading runs|740.80|738.60|-2.20|
|500+ batters|10.50|9.10|-1.40|
|600+ batters|3.70|2.90|-0.80|
|700+ batters|1.30|1.00|-0.30|
|800+ batters|0.20|0.10|-0.10|
|Leading wickets|33.70|33.00|-0.70|
|20+ bowlers|13.90|16.30|+2.40|
|25+ bowlers|5.70|6.00|+0.30|
|30+ bowlers|1.70|1.30|-0.40|
|35+ bowlers|0.40|0.30|-0.10|
|Top-five batter balls|373.94|363.78|-10.16|
|Top-five bowler balls|326.72|333.28|+6.56|
|First innings average|184.22|180.38|-3.84|
|Total credited wickets|868.80|894.40|+25.60|

## Individual career pairs

|Save|2027 leading runs|2028 leading runs|2027 leading wickets|2028 leading wickets|2027 600+|2028 600+|2027 25+|2028 25+|Auction sold|
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|1|777|693|36|29|6|3|8|4|158|
|2|737|740|32|34|3|3|7|8|157|
|3|807|798|34|31|3|3|5|2|154|
|4|839|835|37|28|6|3|6|4|158|
|5|575|671|33|36|0|3|7|9|151|
|6|734|659|40|28|5|3|4|4|146|
|7|707|767|30|41|5|2|5|6|152|
|8|743|740|35|34|1|4|5|7|157|
|9|712|740|29|36|3|4|4|10|155|
|10|777|743|31|33|5|1|6|6|152|

## League-only check

|Metric|2027 league|2028 league|
|---|---:|---:|
|Leading runs|688.90|700.50|
|500+ batters|8.30|6.90|
|600+ batters|2.10|2.00|
|700+ batters|0.70|0.50|
|800+ batters|0.00|0.00|
|Leading wickets|29.20|29.40|
|20+ bowlers|11.50|12.70|
|25+ bowlers|3.40|3.60|
|30+ bowlers|0.40|0.40|
|35+ bowlers|0.00|0.10|

## Interpretation

The exact joint leader pattern (leading batting total falls while leading wicket total rises) occurred in 1/10 careers. Interpret threshold counts independently of leader totals; a higher maximum need not mean more high-volume players. This is a materially stronger test than reusing one auction squad across match seeds. It is still not an exact reproduction of the active save.

## Proposed next investigation; no implementation

Use the captured per-player totals and position distributions to isolate which top-order players lost balls faced, which bowlers gained workload, and whether changes are explained by playoffs or selection. Match active-save archives to this dataset before claiming a save-specific root cause. Repeat with full calendar/availability and user tactics if the save exhibits a substantially stronger effect. Keep the previously proposed removal/rework of accumulated-run suppression provisional: this experiment does not by itself isolate that cause.
