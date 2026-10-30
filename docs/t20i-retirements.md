# T20I retirements

T20I retirement is separate from complete playing retirement. It removes international selection eligibility while preserving IPL contracts, auction availability, development, caps and statistics. It never triggers staff conversion.

## Annual decision

The evaluator runs at the June international reporting boundary. It is seeded by the career seed, player identity and reporting year, and records the last evaluated year. Reopening a page or reloading does not provide another roll. Both full player records and lightweight international-only players use the policy.

Base discretionary odds (before selection/ability adjustments):

| Effective age | Annual probability |
|---|---:|
| Below 33 | 0% |
| 33 | 4% |
| 34 | 7% |
| 35 | 12% |
| 36 | 18% |
| 37 | 28% |
| 38 | 40% |
| 39 | 65% |
| 40+ | Mandatory retirement |

Effective age is actual age minus the configured retirement-age shift.

Selection multipliers are mutually exclusive: preferred XI ×0.15, otherwise national squad ×0.40, otherwise international appearances in either of the last two reporting years ×0.65, otherwise ×1.30. This reduces the odds for active national-team players substantially. Strong ability relative to the nation multiplies odds by 0.70; clearly declining ability by 1.25. Captains receive an additional ×0.80. Discretionary probability is capped at 95%. These protections do not override the age endpoint.

Example: a 37-year-old regular with ordinary ability has 28% × 0.15 = 4.2% annual odds, versus 28% × 1.30 = 36.4% for a player outside the squad with no appearance in two reporting years.

## State, chronology and selection

Retirement records contain an effective date, reporting season, reason and source. Historical facts are dated; legacy flags without dates remain undated. Simulated retirement is authoritative within its save and survives source refresh.

Multi-year catch-up advances each reporting window in order. Fixtures before the retirement date remain eligible; later fixtures do not. Existing played fixtures and scorecards are never resimulated. Future cached squads, pending debuts, captaincy, vice-captaincy and final XIs all undergo eligibility checks. Role-specific reserves refill gaps, including keeper and bowling coverage.

The game-wide `InternationalLifecycle` owns progression across career pages. The overview subscribes to persisted international state instead of running a second independent simulation. Announcement identities come from unique retirement events; uncapped players and migrated historical flags do not produce synthetic career-farewell stories.

Retired profiles remain available for career history and stats. Appearance counts from seasons evicted from the 12-season archive are carried separately so pruning cannot reduce career match totals.

## Historical data and optional Supabase metadata

`lib/data/t20iRetirements.json` contains 11 verified historical entries with primary-source links. The player loader and old-save reconciliation both apply these facts, so the app works with the existing boolean-only database. Russell's effective date is the day after his final international, preserving eligibility for that farewell match.

The optional migrations add `t20i_retirement_date` and `t20i_retirement_source_url`, then seed matching database rows. They have not been applied remotely. Live verification found the existing `is_t20i_retired` flag but PostgreSQL error 42703 for the two metadata fields. No SQL connection credentials were available. This is not a prerequisite for using the implemented feature.

The tooling command supports `--check`, `--dry-run`, `--apply` and `--sql`. SQL mode prints the prepared migrations without network access. Check mode tests columns explicitly, including empty tables, and exits nonzero on schema/network failure. Dry-run and apply resolve exact unique names to actual database IDs; they skip ambiguous rows or conflicting dates. Repeated population is harmless. Credentials are never logged.

## Verification

- `npm run test:t20i-retirements`: active-team protection, date-sensitive eligibility, saved/legacy state, captain and cache repairs, no duplicate announcements, IPL isolation, reserve coverage, reload and chronological catch-up.
- Set `T20I_RETIREMENT_YEARS=20` for the long run. The final run processed 20 years, 848 retirements and 1,470 profiles in about 3.76 MB, with legal XIs throughout and preserved cumulative appearance counts. Year-by-year progression is compared with a multi-period jump over three years.
- `npm run test:t20i-retirement-tool`: mocked schema success/failure, empty tables, network failures, dry-run, repeated population and environment values containing equals signs.
- Existing international lifecycle, retention-boundary and season-restraint regressions pass.
- Browser check: Klaasen's profile displays the historical retirement date and retired international status while retaining his SRH contract and IPL match history.
