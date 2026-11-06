# Mega auction scoring investigation

Controlled repository snapshot investigation; not the active browser save.

|Scenario|Seasons|First innings mean|Run rate|Wickets/innings|Arithmetic errors|
|---|---:|---:|---:|---:|---:|
|baseline|5|187.05|9.89|5.7|0|
|progressed|5|184.41|9.88|5.49|0|
|auction-2028|5|191.43|10.08|5.44|0|
|auction-playable|3|192.72|10.04|5.66|0|

Method: fixed database snapshot, automatic XIs, Balanced tactics, default home pitches. Each simulated season contains 74 matches. Progression uses one recorded calibration season as performance input; no injuries or staff supplied. Full mega auction uses the real store rollover/retention/auction code in isolated Node memory, with MI auto-retention and no user bids. Auction allocation is one stochastic sample, replayed across match seeds. Post-auction tests use 2028 seasonal randomness. The active save and its pitch, tactics, injuries, historical ratings and auction allocation were not available to this harness.

Findings: no systemic scoring collapse reproduced. Development preserves phase/matchup attributes and changes roster-average batting by +0.10 and bowling by +0.08. Rollover clears live season statistics. Production simulation has no direct mega-auction scoring modifier. These checks do not exclude save-specific lineup/auction imbalance, tactics or conditions. No production scoring change justified.
