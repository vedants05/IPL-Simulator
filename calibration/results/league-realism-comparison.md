# League realism before/after comparison

Seed: `league-realism-20261102`. Before: 20 seasons (instant); after: 20 seasons (instant).

Values are means followed by season ranges. Both runs use fixed squads and AI lineups; these are independent seasons without career progression.

| Measure | Before: mean (range) | After: mean (range) |
| --- | --- | --- |
| League run rate | 11.71 (11.53–11.98) | 9.97 (9.70–10.32) |
| First innings average | 219.95 (213.86–227.82) | 187.19 (180.20–194.46) |
| Best economy (minimum 180 legal balls) | 10.02 (9.40–10.51) | 6.83 (5.96–7.47) |
| Bumrah economy | 11.66 (10.22–12.54) | 7.92 (6.27–9.36) |
| Qualified batter median SR (minimum 200 balls) | 191.30 (186.67–196.38) | 159.54 (151.13–166.56) |
| Qualified batters with SR >=200 | 12.4 (7.0–16.0) | 2.5 (0.0–5.0) |
| Fours per season | 3265.4 (3130.0–3466.0) | 2352.2 (2262.0–2549.0) |
| Sixes per season | 1692.5 (1605.0–1765.0) | 1413.7 (1309.0–1493.0) |
| Hundreds per season | 31.9 (24.0–43.0) | 17.9 (13.0–26.0) |
| Fifties per season | 188.8 (172.0–207.0) | 156.7 (137.0–174.0) |
| First innings >=250 per season | 16.8 (11.0–25.0) | 7.6 (4.0–13.0) |
| Wickets per innings | 5.83 (5.61–6.18) | 5.70 (5.21–6.11) |
| All-outs per season | 40.1 (32.0–49.0) | 40.8 (26.0–51.0) |
| Powerplay RR | 11.93 (11.67–12.45) | 9.72 (9.47–10.04) |
| Middle overs RR | 11.62 (11.39–11.81) | 9.66 (9.25–9.98) |
| Death overs RR | 11.54 (10.94–12.03) | 11.70 (10.92–12.40) |
| Arithmetic errors per season | 0 (0–0) | 0 (0–0) |

## Batting by aggression

Pooled batter runs / balls across all seasons; every recorded batting innings is included. Missing aggression uses the engine default of 65.

| Aggression | Before SR | After SR | Before runs/dismissal | After runs/dismissal |
| --- | --- | --- | --- | --- |
| 1–49 | 135.43 | 103.68 | 4.02 | 3.85 |
| 50–64 | 170.86 | 136.42 | 17.85 | 15.13 |
| 65–79 | 181.19 | 149.46 | 41.62 | 36.92 |
| 80–94 | 196.04 | 169.14 | 39.71 | 34.37 |
| 95–98 | 208.31 | 186.00 | 42.55 | 35.97 |
| 99 | 229.77 | 198.92 | 47.17 | 40.32 |

## Bowling by ability

Pooled conceded runs / legal balls. Ratings group the actual selected bowlers; opposition, phases and workloads are not held equal in this table.

| Bowling ability | Before economy | After economy | Before balls/wicket | After balls/wicket |
| --- | --- | --- | --- | --- |
| Below 70 | 13.76 | 17.01 | 25.73 | 25.00 |
| 70–79 | 11.60 | 12.05 | 20.17 | 19.43 |
| 80–89 | 11.61 | 9.71 | 19.63 | 20.28 |
| 90+ | 11.57 | 7.83 | 17.15 | 17.98 |

## Seeds 6 onward

The first five seeds were used during tuning. The remaining seeds were evaluated after selecting the revised engine.

| Measure | Before: mean (range) | After: mean (range) |
| --- | --- | --- |
| League run rate | 11.70 (11.53–11.81) | 9.95 (9.70–10.17) |
| First innings average | 219.85 (213.86–227.82) | 186.79 (180.20–193.62) |
| Best economy (minimum 180 legal balls) | 9.98 (9.40–10.51) | 6.90 (6.09–7.47) |
| Sixes per season | 1692.5 (1605.0–1765.0) | 1407.7 (1309.0–1482.0) |
| Hundreds per season | 32.1 (24.0–42.0) | 17.4 (13.0–26.0) |
| First innings >=250 per season | 16.5 (11.0–25.0) | 7.5 (4.0–13.0) |
| Arithmetic errors per season | 0 (0–0) | 0 (0–0) |

## Suryavanshi

These are observed season outcomes against varied opponents, rather than the neutral aggression target.

| Run | Pooled SR | Runs/dismissal | Mean season runs |
| --- | --- | --- | --- |
| Before | 229.77 | 47.17 | 695.75 |
| After | 198.92 | 40.32 | 554.40 |

Before data: `calibration/results/league-realism-before-20.json`. After data: `calibration/results/league-realism-revised-instant.json`.
