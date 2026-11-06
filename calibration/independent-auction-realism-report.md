# Independently auctioned season realism audit — 2026 comparison

Five separate mega auctions were simulated using the production store retention and automatic-auction flow, seeded independently (1357911 + run * 99991). Each resulting squad played a 74-match season with a different match seed, AI lineups, balanced tactics and default venues. All auctions completed; squad sizes were 20–25. These are five independent one-season experiments, not a continuous five-year career: player progression, injuries, trades and sequential mini-auctions are not modelled. The user team uses automatic retention and makes no user bids. Matches use instant mode. Inputs are the existing November 2 player snapshot and working-tree code.

The comparison uses only the repository's 2026 IPL match JSON. Of 74 files, 73 have at least two innings and are included. No-result matches lacking two innings are excluded. Fifties exclude hundreds. Bowling hauls are credited wickets, not team wickets.

| Measure | Simulated per 74-match season, range | 2026: 73 included matches |
|---|---:|---:|
| First-innings average | 181.6–196.3 | 195.3 |
| Overall runs per over | 9.89–10.20 | 9.89 |
| Fours per match | 31.0–34.2 | 31.9 |
| Sixes per match | 17.9–20.3 | 19.5 |
| Fifties per match | 1.86–2.23 | 2.11 |
| Hundreds per season | 16–21 | 15 |
| Exactly four-wicket hauls | 16–28 | 17 |
| Five-wicket or better hauls | 5–10 | 1 |
| Six-wicket or better hauls | 5 in 370 matches | 0 |
| Innings with 10 wickets | 31–44 | 20 |

Across simulations there were five six-plus hauls (including two seven-wicket hauls), 33 five-plus hauls, and 90 hundreds. Five-wicket-or-better totals include six-plus hauls. The historical comparison has only one season, so rare-event rates are highly uncertain. The innings-with-10-wickets comparison counts scorecards at 10 wickets, not necessarily definitive all-outs under impact-substitution rules. Season leaders ranged 798–894 runs and 23–32 wickets. Simulated extras were 3.6–4.0 per innings; the 2026 extras rate has not been calculated.

All five runs passed existing checks for innings totals, bowling balls and bowler runs conceded; these are not exhaustive cricket-law checks. The detailed player summaries and innings are in independent-season-valid-1.json through independent-season-valid-5.json; auction snapshots are independent-auction-1.json through independent-auction-5.json. Reproduce auctions with `node scripts/runCalibration.cjs calibration/independentAuctionAudit.cjs`; match audit controls are `AUDIT_INPUT`, `AUDIT_OUTPUT`, `AUDIT_SEASONS`, `AUDIT_SEED` and `AUDIT_YEAR`. Run `node calibration/independentRealismSummary.cjs` to calculate the 2026 comparison.

An earlier diagnostic pass supplied batting-only season stats and no bowling stats; the current engine falls back to the batting object when applying bowling regression. Once a player has four matches, absent wickets can produce NaN, leading to run rates of 13.85–16.09 and first-innings averages of 271–312 in those runs. They are invalid as realism samples and saved separately as independent-season-1.json through independent-season-5.json. The main overview path currently derives PlayerStats with wickets, so that path is not established to hit this issue. The public input type explicitly permits batting-only statistics, making this a reproducible engine edge case. No production tuning was applied.
