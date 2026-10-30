# T20I retirement implementation plan

Scope: resolve the four retirement findings from the review: missing career-generated retirements, stale saved eligibility, cached squads selecting retirees, and misleading database-check success. Complete historical data setup, persistence and regression coverage around those fixes.

Implemented in the application, including reduced odds for active national-team players. See `docs/t20i-retirements.md` for the final policy and checks. The live database has the boolean flag but lacks the two optional metadata columns; migration files are prepared. The application includes historical dates and does not require that database update.

## 1. Establish authoritative retirement state

Relevant files: `lib/types/index.ts`, `lib/logic/international.ts`, `lib/store/gameStore.ts`, `lib/supabase/fetchPlayers.ts`.

- Keep T20I retirement separate from complete playing retirement. A T20I retirement must not remove an IPL contract, prevent an auction bid, trigger staff conversion, or enter the general player-retirement removal list.
- Add effective date, retirement season, reason and source (historical or simulated) alongside the existing boolean. Keep historical baseline facts separate from decisions made inside each save.
- Give lightweight international-only players equivalent retirement metadata. They must follow the same eligibility and retirement rules as full player records.
- Define merge precedence explicitly: a saved simulated retirement survives a database refresh; historical facts only become effective on their date; missing database values cannot silently restore eligibility.
- Treat the boolean as a compatibility field. Migrate legacy true values without inventing a historical retirement date or awarding a retirement event retroactively.
- Centralise eligibility in a helper accepting the player/profile and fixture date. Separate permanent retirement from temporary selection decisions.

Acceptance: save/load and database refresh cannot unretire a player; IPL eligibility and accumulated career statistics are preserved.

## 2. Repair stale selection and squad caches first

Relevant files: `lib/logic/international.ts`, `lib/logic/internationalCareerStatus.ts`, `app/game/overview/page.tsx`.

- Make `internationalCareerNeedsReconcile` detect a mismatch between saved international profiles and authoritative retirement status, including for capped players and existing captains.
- On an eligibility change, update the profile and remove the retiree from pending debuts, current squad, preferred XI and cached future-series squads. Invalidate/rebuild affected caches only.
- Replace captain/vice-captain if ineligible; ensure replacements satisfy the same eligibility rule.
- In `squadForFixture`, validate a cached squad before returning it. At final XI construction, filter eligibility again so a missed cache invalidation cannot produce an illegal appearance.
- Refill vacancies using the usual role-balanced selection and reserve-generation rules. Handle an empty eligible pool without dereferencing an undefined captain.
- Consolidate the existing age cutoffs (38/39/40) with the retirement policy instead of leaving different rules in initial roster creation, captain selection and fixture selection.
- Bump the international selection revision once to repair older saves. Do not rerun already played fixtures or erase archived squads, scorecards or stats.
- Ensure reconciliation settles: a repaired state should return false from the needs-reconcile check until something relevant changes.

Acceptance: mark a cached squad member or captain retired, advance to the next fixture, and prove that they cannot appear while the team still fields a legal XI.

## 3. Add automatic T20I retirement decisions

Suggested new module: `lib/logic/internationalRetirements.ts`.

- Implement a pure, deterministic evaluator. Inputs: save seed, player identity, evaluation period, age, role, ability, international appearances and recent selection history. Output: no decision or a dated retirement event.
- Evaluate once per player per international reporting period, recording the last evaluated period. Reloading the save or repeatedly visiting a page must not roll another retirement chance.
- Proposed initial policy: start discretionary checks around age 33, raise likelihood through the later thirties, and use age 40 as the initial mandatory endpoint to align with the existing under-40 selection pool. These are game-design starting values, to be calibrated rather than treated as real cricket rules.
- Factor in sustained non-selection and declining ability; protect young players and allow established older players to continue. Distinguish an uncapped player's age-based ineligibility from a newsworthy international retirement.
- Respect the existing world-rule retirement-age shift if its setting applies to all playing retirement thresholds. Document its effect and remove conflicting hardcoded selection ages.
- Run the same policy for full and lightweight profiles. Avoid retiring a national pool en masse; replenish role gaps through existing reserves.
- Process fast-forwarded periods chronologically. Fixtures before the effective retirement date remain eligible; fixtures after it do not. Do not apply today's retirement status indiscriminately to unplayed catch-up fixtures from an earlier period.
- Integrate this with the central calendar/lifecycle path so retirement does not depend on opening the International page. Avoid running it separately from multiple pages.

Acceptance: identical saves produce identical decisions; repeated reconciliation is idempotent; multi-year fast-forward and day-by-day progression give equivalent effective dates and eligibility.

## 4. Complete historical database support and fix the checker

Relevant files: `scripts/populateT20iRetirements.mjs`, `scripts/addT20iRetirementColumn.sql`, `supabase/migrations/`, `lib/supabase/fetchPlayers.ts`.

- Add an idempotent versioned Supabase migration for the canonical retirement flag and effective-date metadata. The current standalone SQL helper is not a tracked migration.
- Replace the misleading population command with clearly separated read-only check and explicit population modes, or rename it to describe its actual schema-check behaviour.
- Check the required column directly rather than inferring schema from the keys of an arbitrary first row. Correctly distinguish an empty table, missing column, unavailable database and successful check.
- Return a nonzero process exit code for connection/query failures and a failed required-schema check. Never print success based only on the existence of a column.
- Report population coverage separately: row count, flagged count and missing date information. Do not claim data is populated merely because the schema exists.
- Use environment credentials safely and robustly. Do not embed privileged keys in browser code or print them in diagnostics.
- Build a reviewed historical seed using stable player IDs and retirement dates verified against primary sources when implementing. Do not guess names/dates or assume a current-day retirement was already effective at career start.
- Prepare and inspect the SQL/data diff before applying any database update. Dry-run the seed and make repeated application harmless.

Acceptance: checker failures exit nonzero; running migrations/seeds twice changes nothing on the second run; flagged historical retirees are excluded only when their retirement is effective in the save's timeline.

## 5. Present retirement clearly

Relevant files: `components/home/InternationalPage.tsx`, `components/player/PlayerProfileModal.tsx`, international status/news/email builders.

- Retain existing badges; add effective date and concise reason where available.
- Show retired players in career/history views while excluding them from active selection views.
- Generate one T20I retirement announcement per event. Explicitly describe continued franchise availability when applicable.
- Preserve caps, debut information, batting/bowling totals, rankings history and completed fixtures.
- Keep these announcements separate from general retirement stories and staff-conversion events.

Acceptance: a T20I retiree remains usable in the IPL and their profile retains all historical international records.

## 6. Regression and long-career validation

Extend `calibration/internationalLifecycleVerification.ts`; add focused retirement/state-merge tests using `scripts/runCalibration.cjs` so they run without installing another test runner.

Required cases:

1. Historical retiree excluded in a new career after their effective date.
2. Pre-retirement fixture remains eligible during chronological catch-up.
3. Existing save updates immediately when authoritative retirement state changes, with no fixture already due.
4. Cached bilateral and World Cup squads cannot reselect a retiree.
5. Retired captain and vice-captain replaced; pending debut removed without granting a cap.
6. Final XI remains legal and role-balanced after multiple simultaneous retirements.
7. Saved retirement survives database refresh, missing source flags and save/load.
8. Repeated evaluation creates no duplicate event, announcement or changed decision.
9. Full and lightweight players age and retire consistently.
10. Day-by-day progression matches multi-period fast-forward.
11. T20I retirement leaves IPL contract, auction eligibility, staff status and accumulated stats intact.
12. Legacy saves migrate without resimulating completed matches.
13. Database checker handles missing column, empty table, populated table and network failure with correct exit status.

Run a 15–20-year synthetic international career and inspect retirements by age, average squad age, reserve intake, keeper/bowling coverage, duplicate announcements and simulation/storage growth. Tune the proposed age probabilities using this evidence.

Finish with TypeScript checking, international lifecycle regressions, career-transition regressions and a visual check of badges and announcements. Record any unavailable live-database verification separately from passed offline tests.

Recommended order: authoritative state → selection/cache repairs → deterministic lifecycle → database tooling/data → UI/news → long-career validation. Complete each stage's acceptance checks before proceeding.
