# Commercial experience: detailed design and implementation roadmap

Status: implementation delivered, 2 October 2026; live visual review and player playtesting remain outstanding. This document expands the accepted [commercial audit and foundation plan](commercial-review-plan.md). The specifications below remain the acceptance reference; the delivery record describes what is implemented and verified.

## Delivery record

- Six connected desks now live under `components/commercial/pages/`, with shared comparisons, labelled forms, retained drafts, commitment previews, feedback and record links. Office includes decisions due, a payment calendar, measured objectives, outcome reports, full decision history and prior-season statements.
- `lib/logic/commercial/engine.ts` owns integer-INR accounting, validated commands, revision checks, idempotent events, payments, migration backups and rollover. `commercialSystem.ts` is the compatibility adapter for existing match/season callers. Opening cash is reconciled to posted movements; retail production purchases and recognised cost of goods sold are separate.
- Matchday supports fixture/global policies, advanced tier prices, preseason allocations and memberships, lounge/package prices, aggregate corporate lease groups, service levels, catering models and extra event production budgets. Forecasts and immutable reports use the effective venue capacity. Cancelled fixtures have no match receipts; neutral playoff venues have no club gate settlement; abandoned fixtures append a 50% public-ticket refund. Postponements retain their saved plans.
- Partnerships includes fixed offers, two negotiation rounds with response dates, future renewals, exclusive slots, cancellation fees, payment schedules and executed finish-based bonuses. Offers cannot be accepted twice.
- Retail includes demand-sensitive persistent prices, targeted dated orders, transit/delivery records, stock conservation, daily fulfilment, lost demand and campaign scheduling/review. Audience choices affect delivery efficiency; attribution compares fulfilled sales with a campaign-free baseline. Campaigns start on a future game date, accrue spend over active dates and reserve their remaining budgets.
- Operations has dated service contracts, eligibility checks, setup/termination fees and real medical/scouting benefits. Preparation reduces early-season injury occurrence by 2%/4%; charter travel reduces recovery duration by 2%. These replace unsupported fitness/synergy promises. Extra event production spending is explicitly a cost and grants no hidden sporting bonus.
- Finance includes actual income/expense/cash, forecasts, read-only finish scenarios, committed cash timelines, full filtered ledger/CSV, payment-source links and rights milestones. Payroll uses live player contracts and staff salaries. Commercial changes participate in the existing local/cloud side-storage pipeline.
- Manual/Recommend/Auto rules include caps, cash reserves, permitted policies, maximum sponsorship terms and manually reviewed categories. Automatic orders, match plans and renewals use the same commands as manual actions. Calendar processing is independent of the open desk, and daily/fast-forward actions have matching stable event IDs.
- Delivered pricing/service experience and brand outreach feed the authoritative supporter calculation; reserve pressure affects board approval. Commercial cash remains separate from the auction purse. Existing stadium project charging rules remain as established by the stadium builder.
- The final presentation follows the game's Anton headings, Space Mono labels, themed surfaces, panel outlines and compact tables. Original uses the established stronger frames; Modern and Sidebar use thin frames and adapt to available width. All desks now use fixed, non-scrolling workspaces with focused views and measured pagination for long collections. Overview has five distinct navigation tiles, business priorities and a compact decision/payment/outcome diary. Delegation, save history, hospitality inclusions and decision details open compact game-styled dialogs. The design refinement preserves the commercial commands and simulation.

Validation completed: TypeScript checking, production build, commercial regression suite, player salary separation and career-storage checks. The commercial suite includes preview purity, acceptance limits, stock/cash conservation, campaign timing, gameplay benefits, daily/batch automation parity, concurrent updates, legacy preservation, local/cloud restore isolation, storage failures, modified/zero/small capacities, cancelled/abandoned/postponed events and three-season sweeps for MI/PBKS/KKR.

The default rights distribution for new careers is now ₹160 Cr instead of the previous ₹440 Cr game-economy preset; existing saved rights values and cash are retained, including on rollover. The sweep remains a development calibration, not a claim of final competitive balance. Long-session playtesting must assess spending incentives and alert volume.

No browser surface was available in this session. Theme contrast, keyboard focus journeys and the complete scaled viewport matrix therefore still require live visual/accessibility review; they are not recorded as passing C8 checks. Individual hospitality-client negotiations, loans/dividends/ownership changes and the sponsorship auction market remain the explicitly deferred expansions described below.

## 1. Product goal

Make running the business a useful part of managing the club: understandable decisions, visible consequences, persistent progress and opportunities tied to the cricket season. A player should quickly understand what needs attention, what they can afford and what happened because of their choices.

Preserve the six commercial destinations and the game's existing typography, palette and navigation. Original, Modern and Sidebar remain independently selectable UI designs. Commercial behaviour should be identical across designs; geometry adapts to available space. In Sidebar, the existing section entry opens Overview without restoring the removed Overview top-bar button. Continue remains at the top right.

### Experience principles

- Overview answers “What needs my attention?” before offering detailed accounts.
- Every headline figure has a time period and a clear meaning: Actual, Committed or Forecast.
- A decision exposes cost, benefit, uncertainty, duration and the next opportunity to change it.
- Routine policies persist. Players should not have to repeat the same selections every match.
- Advanced controls are available within each desk without crowding the default view.
- Changes affect future activity. Completed receipts, orders and match results remain historical facts.
- Outcomes use explainable simulation rules. Opening a page or previewing an option must never reroll an offer or generate money.
- Important events draw attention; ordinary sales and settled bills go into a digest.

## 2. Main player journeys

| Journey | Interaction | Expected result |
|---|---|---|
| Start a season | Review opening finances, existing contracts and a proposed operating plan; keep defaults or adjust selected areas. | A viable baseline without mandatory setup across six pages. |
| Prepare a home fixture | Open the fixture card, inspect expected crowd, compare gate/hospitality policies and apply to the next fixture or future home fixtures. | Clearly dated changes and a forecast showing the trade-off. |
| Respond to an expiring sponsor | Open a due-decision card, compare existing terms and offers, negotiate within limits or accept. | One contract, one acceptance, a payment schedule and a renewal reminder. |
| React to strong merchandise demand | Open a stock warning, choose products and quantities, preview delivery and cash requirements, place the order. | Inventory in transit followed by delivery and actual sales over time. |
| Invest in the club | Compare programmes against current needs and future cash, select a term and sign. | A contract with an effective date and measurable gameplay effects. |
| Check financial health | Inspect cash over time; select a future low point to see contributing payments and possible actions. | A understandable explanation of the cash risk, not just a red number. |
| Finish a season | Review targets, actual versus forecast, successful decisions and obligations carrying forward. | Closing accounts and next-season continuity without resetting the business. |

## 3. Shared page and interaction design

### Page composition

Use a compact heading, three or four genuinely useful metrics, and a primary workspace. Avoid repeating a large decorative header beneath the game's navigation. Metrics should link to a matching detail view, date range or ledger filter.

At wide widths, use a list/workspace plus an adjacent detail panel. In narrower Sidebar space, selecting an item opens a full-width detail view with a Back to list action, preserving selection, filters and scroll position. Use container width rather than browser width for this decision. Long catalogues, contracts and ledger history scroll within an explicitly bounded area; action bars remain reachable. Do not squeeze text to fit fixed-height cards.

Use theme tokens for surfaces, borders and semantic status colours. Aim for 13–14px logical body/control text and at least 11–12px secondary labels, then verify legibility under the existing viewport scaling. Use thin frames, clear alignment and a restrained amount of decoration. Never hide a financial amount behind ellipsis without an accessible full-value view.

### Decision workflow

1. **Inspect:** show the current setting, relevant demand/service context and existing commitments.
2. **Compare:** show two or three presets, plus an Advanced option where detail is useful.
3. **Preview:** changing a control updates a draft only. Show current versus proposed values, immediate cash cost, future payments, effective date and expected outcome range.
4. **Commit:** a named action such as “Apply to next home match”, “Sign three-season deal” or “Order 2,000 shirts”. Validate against current state immediately before committing.
5. **Follow up:** show a saved result, next milestone and a link to the decision record. Relevant later events attach to that record.

Preview and Cancel require no extra confirmation. A clearly labelled commitment button is normally sufficient; use an additional review step only for exceptional irreversible or unusually large commitments. Navigation with an unsaved draft offers Discard or Keep editing. Drafts survive rerenders and tab changes within the same career/session, but cannot leak into another save. Existing proposals remain frozen; revalidate stale drafts after the game advances.

Undo is available only before an action has produced payments, deliveries or other external game consequences. Later changes use explicit cancellation/amendment rules with costs shown first.

### Reusable components

- Metric with period, status label and drill-down.
- Current/proposed comparison with positive and negative deltas.
- Draft decision footer with affordability and effective date.
- Filterable record table with sorting, full-detail access and empty states.
- Contract summary with term, obligations, milestones and status.
- Outcome breakdown explaining the largest contributing factors.
- Payment/expiry timeline with accessible tabular equivalent.
- Decision history linking policy changes to later results.
- Persistent success/error feedback; disabled actions explain exactly what is missing.

Use labelled controls, keyboard-accessible tables and dialogs, selected-state semantics, visible focus and focus restoration after closing details. Convey changes through text/icons as well as colour. Honour reduced motion.

## 4. Detailed page specifications

### A. Overview: the commercial office

**Primary metrics:** cash now, uncommitted cash after near-term obligations, season actual profit/loss and forecast closing cash. Explain that uncommitted cash is a planning measure, not the auction purse.

**Main workspace:** a priority-ordered Decisions due list and a business calendar for the next few weeks. Each item shows why it matters, deadline, approximate cost/value and Review/Delegate actions. Suggested examples: sponsor renewal, a forthcoming home game with weak demand, stock predicted to sell out, or a contract approaching expiry. Do not create arbitrary tasks simply to fill the list.

**Secondary workspace:** recent results, commercial objectives and shortcuts to the other five desks. Replace large navigation-only cards with useful summaries: next home fixture forecast, contracts due, top stock risk, active programmes and next major payment.

**Interactions:** dismiss informational items, snooze non-critical reminders, filter by urgency/desk, open the exact affected record, and compare the latest outcome against the forecast saved when the decision was made.

**Acceptance:** a player can identify the next important action without opening another page. Every warning explains its cause and has a relevant destination. No duplicate alerts for the same issue.

### B. Matchday Revenue: plan the next home event

Start with a fixture selector and status: Planning, On sale, Locked, Completed, or Cancelled. Display venue, usable capacity, opponent, date, projected attendance and net matchday contribution. Completed fixtures open read-only reports.

**Pricing:** retain Access/Balanced/Premium policies. Advanced controls expose ticket tiers, allocation and season memberships. Show an interactive price-versus-attendance preview with an accessible comparison table. Allow application to one fixture or remaining eligible fixtures, listing exclusions such as already committed sales.

**Hospitality:** boxes, lounges and premium experiences share the venue's capacity model. Compare occupancy and margin, offer packages with explicit inclusions, and expose renewal opportunities for recurring clients. Initial release can use aggregate client groups; individual client negotiations are a later enhancement.

**Experience:** add security/service standards, catering model and event budget in the same workspace. Show costs and only effects that exist in simulation. Establish minimum service requirements rather than making unsafe underspending an optimal policy.

**Demand explanation:** identify effects from price, opponent interest, supporter sentiment, player attraction and schedule context. Forecast uncertainty is a modelled range, not a guaranteed crowd. Use the same assumptions in the match settlement engine.

**After the match:** compare forecast/actual attendance, tickets, concessions, hospitality and costs; explain deviations. New policies cannot rewrite this report. Apply explicit postponed, abandoned, neutral-venue and refund rules.

**Acceptance:** fixture pricing, stadium-builder capacity, committed seats and forecast settlement agree; changes cannot affect completed fixtures; every seat belongs to one allocation.

### C. Partnerships: manage a portfolio and negotiate offers

Use Contracts, Offers and Renewals as local views, without adding permanent top-level navigation. Filters cover category, status and expiry. Selecting a partner shows current terms, satisfaction drivers, obligations, payment progress and bonus conditions.

**Offer comparison:** annual fee, guaranteed total, term, payment timing, performance bonuses and exclusivity. Show guaranteed versus possible value separately. Highlight slot/category conflicts before acceptance.

**Negotiation:** use defined levers such as longer term, higher guaranteed fee or increased performance weighting. Counteroffers use a bounded number of rounds and response dates. The player sees the reason for a weak offer or rejection. Offer valuations are seeded and fixed for their lifetime; reopening the screen does not improve them.

**Commitment:** accepting a deal closes incompatible offers, reserves its commercial slot and schedules payments. A fixed offer ID can only be accepted once. Renewals cannot repeatedly compound the current value. Cancellation displays any fee and lost future income.

**Progression:** club performance, brand and fulfilment affect later offers. Each bonus is an executable rule, with Pending/Earned/Paid status. Text-only promises must not count as projected cash.

**Acceptance:** each contract can be traced from offer to payments and expiry; negotiation creates meaningful term/risk choices; no repeat-click exploit exists.

### D. Retail & Marketing: manage demand and stock

Use Stock & Sales and Campaigns as local views. A shared summary shows actual gross margin, unsold inventory value, stock risk and remaining campaign commitment.

**Stock table:** product, selling price, unit margin, available units, reserved units, units in transit, recent sales and estimated cover. Include sorting and stock-risk filters. Policies set a starting point; Advanced pricing can adjust individual products.

**Order builder:** select products, quantities and delivery option. Preview production cost, expected arrival, cash after payment and projected excess/shortage. Provide reorder suggestions with reasons and allow editing. Never silently buy the same quantity of everything.

**Sales:** daily/fixture events generate demand, fulfil sales and update cash/costs/inventory. Lost demand and stockouts are visible. Historical sales stay fixed when prices change. Player-linked products should respond to transfers/retirements through explicit demand rules, not deletion of stock.

**Campaign builder:** choose objective, audience, budget, start and end date. Preview reach, likely conversion and capacity to fulfil demand. Prevent promising incremental sales when stock is unavailable without explaining the limitation.

**Campaign review:** spend to date, remaining commitment, measured incremental demand and modelled attribution. Distinguish observed sales from estimated campaign contribution. Campaign pause/cancel affects remaining activity, with any committed costs shown.

**Acceptance:** retail policy persists, inventory reconciles, spending accrues over elapsed game time and no policy wins across all plausible demand/stock scenarios.

### E. Club Operations: invest with visible consequences

Present medical/recovery, scouting coverage, preparation and travel as services with current contracts. Each panel shows current capability, actual annual commitment, next renewal and evidence of recent use.

**Compare programmes:** current versus candidate service level, setup fee, payment schedule, term, activation delay and bounded gameplay effect. Show the reason a recommendation is relevant, such as fixture congestion or a gap in scouting coverage.

**Connect existing systems:** medical effects use the injury engine; scouting expands report coverage/quality; preparation affects supported readiness/cohesion metrics; travel affects supported fatigue/recovery mechanics. Add no decorative benefit claims. Where a mechanic is not implemented, defer the paid feature until its effect exists.

**Budget ownership:** staff salaries come from staff contracts. Travel retainers and overheads must have non-overlapping definitions. Stadium works stay in the stadium system; this desk links to them and reflects their approved financial commitments rather than creating a second stadium-upgrade model.

**Acceptance:** each programme has an auditable cost and demonstrable effect, activation/expiry works, and switching tiers cannot avoid charges or stack benefits unexpectedly.

### F. Finance & Rights: understand the business

Provide Summary, Cash Flow, Ledger and Rights local views, with period/season filters retained while inspecting details.

**Summary:** actual income, recognised expenses, operating result and outstanding obligations. Separate profit from cash. All summary figures use the canonical financial calculation.

**Cash flow:** an interactive timeline of actual and expected cash, with committed flows distinguished from uncertain forecasts. Selecting a low point reveals the payments creating it. Scenario controls cover tournament finish and supported demand assumptions; a reset restores the baseline. Scenarios never change game state or accounting records.

**Ledger:** full history with category/date/status search and sorting. Every entry links to its originating match, contract, order or campaign. Show refunds/reversals as linked entries; do not erase posted history. Offer CSV export after the underlying data is reconciled.

**Rights:** broadcast distribution schedule, expected eligibility, paid amounts and pending milestones. Prize-money estimates link to the finish scenario; earned prizes link to actual tournament outcomes.

**Acceptance:** cash reconciles to transactions; every forecast explains its assumptions; the player can trace any headline amount to its source.

## 5. Delegation and notification rules

Introduce controls per desk: **Manual**, **Recommend**, or **Auto within limits**. Default to Recommend; do not silently change existing choices during migration.

Auto mode uses explicit spending caps, a minimum cash reserve, permitted policy ranges, maximum contract term and contract categories requiring manual decisions. Reuse the same validation/settlement rules as manual decisions. Do not add artificial commercial staff ratings until a meaningful staffing integration is designed.

Always show what was automated, why, its cost and whether it can still be amended. Automatic actions cannot bypass reputational eligibility, available cash, existing commitments or renewal limits. Stable decisions should not oscillate between policies every game day.

Notifications have three levels: informational digest, action due, and blocking decision. Only genuinely blocking state should interrupt Continue. Routine income, sales and within-limit automatic choices never open unsolicited dialogs. Expired offers and unattended decisions have published default outcomes; fast-forward follows the same rules and respects configured stops.

Target: an established club should run several fixtures without required commercial input when its policies and delegation rules remain suitable. A hands-on player can inspect and optimise at fixture level without gaining money simply from extra clicking.

## 6. Season progression and consequences

- Preseason: carry-forward statement, renewals, merchandise planning, campaign scheduling and operating contracts.
- In season: fixture-driven demand, inventory movement, payment milestones, supporter response and limited relevant opportunities.
- Midseason: compare actuals to plan and suggest changes only where material differences exist.
- Postseason: settle outcomes and bonuses, report performance, age/expire contracts and prepare next-season obligations.

Define relationships with existing supporter, board, staff, scouting and stadium systems once. Pricing affects the applicable supporter groups over time; campaign effects merge into the authoritative supporter model; board commercial objectives use measured results. Improvements must be bounded and explainable, with no direct purchase of match wins.

Cash should have useful spending decisions and a reserve purpose. Avoid an endlessly growing balance with nothing consequential to fund. Calibrate existing services and approved investments first; loans, dividends, ownership changes and a full sponsorship auction market are deferred expansions, not prerequisites.

## 7. Technical implementation design

### State and accounting

Split long-lived commercial career state from season statements. Persist contract/policy IDs, inventory/orders, campaigns, delegation rules, financial records, processed-event IDs and state version. Cache only derived views that can be rebuilt safely.

Use integer INR for stored monetary amounts, converting to lakh/Cr only at display boundaries. Quantity and capacity are integers; deterministic rounding is shared by forecasts and settlement. Migrate current decimal-Cr fields explicitly.

Keep separate records for agreements, due payments, posted cash movements and recognised revenue/expense. A stock order is a cash movement and inventory acquisition; its entire purchase cost must not also be treated as cost of goods sold before those units sell. Accrual profit and cash therefore have separate summaries, linked through their source records.

Opening balances need a deterministic migration policy. Preserve an existing player's displayed cash and history where possible, recording any required reconciliation as a clearly identified migration adjustment rather than silently deleting transactions or granting a windfall. Archive the original input, and test representative old saves before release.

### Commands and events

Replace whole-state replacement from components with validated commands such as `SetTicketPolicy`, `AcceptSponsorOffer`, `PlaceInventoryOrder`, `StartCampaign`, `SignOperationsContract` and `SetDelegationPolicy`.

Each command carries career identity and an expected state revision. Validate stale cash/stock/offer state, then commit the full related state change once. Commands return success or a structured explanation that the UI can display. Prevent concurrent tabs or rapid repeated clicks from overwriting newer decisions.

Process `GameDateAdvanced`, `FixtureCompleted`, `SeasonEnded` and `SeasonStarted` in a shared commercial service. Idempotency keys identify the real event/contract/payment occurrence, not the length of a ledger array. Single play, simulation and fast-forward must all reach the same service. Clock time is the career date, never the browser's current date.

Persist the resulting commercial state and notify the existing save pipeline after each committed change. A UI preview is pure computation. Failed saves retain the last valid state and surface a recoverable error. Reopening a page does not post scheduled payments or regenerate state.

### Suggested code organisation

| Area | Responsibility |
|---|---|
| `lib/logic/commercial/` | Types, commands, validation, finance, demand, contracts, retail, campaigns, operations and event processing. |
| `lib/store/commercialStore.ts` | Canonical client subscription/update boundary, career isolation and persistence notifications. |
| `components/commercial/shared/` | Metrics, draft preview/footer, comparisons, tables, timelines and feedback. |
| `components/commercial/pages/` | Six page-level views with minimal business logic. |
| Commercial migrations/storage adapter | Versioned old-save conversion and participation in existing local/cloud persistence. |
| `calibration/commercial*` | Invariant checks, event integration tests and multi-season balance sweeps. |

These paths are a proposed separation, not a requirement to rebuild working infrastructure. Keep the existing entry points as adapters during migration. Split the large decision hub incrementally. Extract valuable legacy detail only after its calculations use the new commands/selectors, then remove obsolete implementations.

## 8. Delivery backlog

Deliver complete working slices. Do not wait for every backend feature before improving any player flow, but do not expose controls whose outcomes are still fictional.

| Slice | Dependencies | Scope | Exit criteria |
|---|---|---|---|
| C0: foundation contract | None | Define money/state semantics, event sources, migration fixtures and preserved save behaviours. Capture current exploit/reconciliation failures. | Reproducible tests demonstrate the known problems and migration expectations are explicit. |
| C1: trusted money and first usable flow | C0 | Canonical summary, cash reconciliation, correct prize preview, identified one-time sponsor offers, current/proposed decision UI, save feedback. | Ledger reconciles; prize preview is read-only; repeat acceptance is impossible; one full sponsor journey works. |
| C2: a persistent business | C1 | Due payments, actual payroll sources, expiry, rollover, local/cloud capture, shared individual/batch event processing. | Two seasons progress with retained cash/contracts and identical single/batch settlements; restore reproduces state. |
| C3: overview and matchday | C2 | Action queue, deadlines, shared fixture demand, venue capacity, pricing drafts, hospitality/service detail, post-match comparison. | Next-fixture journey is fully usable in all UI designs; completed matches are immutable. |
| C4: complete partnerships | C2; shared C1 components | Portfolio filters, term comparison, bounded negotiation, bonus rules, cancellation and renewal history. | Offers, contracts, payments and notifications form a complete lifecycle. |
| C5: retail and campaigns | C2; shared components | Inventory events, targeted orders, persistent policies, campaign timing, demand attribution and outcome review. | Stock/cash reconcile; last-day activation cannot earn full-season effects; policies have meaningful trade-offs. |
| C6: operations and full finance | C2 | Connected service effects, cost ownership, full ledger, cash-flow timeline, rights schedule and prior-season statements. | All paid benefits work as described; headline totals trace to records. |
| C7: delegation and seasonal reporting | C3–C6 | Per-desk limits, digests, stop rules, decision history and season review. | Auto decisions obey limits and explain themselves; normal progress avoids excessive interruptions. |
| C8: release hardening | All shipped slices | Balance sweeps, accessibility/layout checks, performance, failure recovery and legacy cleanup. | Release matrix passes and no known money-generation exploit remains. |

C1–C2 form the first usable release. C3–C6 can then ship as individual complete desk upgrades. C7 introduces convenience after the underlying commands are trustworthy. Prioritise C3 first because home fixtures provide frequent, understandable feedback.

## 9. Validation and success criteria

### Financial and state invariants

- Opening cash plus credits minus debits equals current cash.
- Forecast closing cash equals current cash plus remaining forecast cash movements, with one-off commitments included exactly once.
- Product opening stock plus deliveries minus fulfilment/adjustments equals closing stock; stock cannot be sold twice.
- Seat allocations and bookings cannot exceed the effective venue capacity.
- An offer is accepted at most once, and a scheduled payment is posted at most once.
- Cancelled/expired agreements stop future benefits and follow explicit remaining-liability rules.
- Actual history survives pricing changes, reloads, view changes and season rollover.
- Previewing scenarios and switching UI designs never mutate commercial state.

### Scenario coverage

Test small/large and modified stadiums; high/low supporter mood; stockouts and excess stock; short/long seasons; postponed/neutral/abandoned fixtures; cash shortages; simultaneous obligations; cancelled contracts; last-day campaigns; invalid old data; quota/storage failures; concurrent tabs; cloud restoration; individual play, batch simulation and fast-forward; consecutive season transitions.

Run multiple clubs and seeds to find universally dominant policies, runaway sponsorship values, automatic-policy oscillation and unbounded cash accumulation. Report distributions and actual examples, not just one successful simulated career.

### Usability checks

- From Overview, a player can reach and understand any due decision within two navigational actions.
- Before committing, the player can identify immediate cost, future cost, effective date and the main trade-off without opening a tooltip.
- Every disabled financial action gives a concrete reason and, where possible, a route to resolve it.
- No list silently excludes records; filters and pagination/scrolling are explicit.
- The same selected policy remains selected after leaving the page and restoring the save.
- Keyboard operation covers the complete decision journey; status and forecasts remain understandable without colour.
- Supported scaled viewports and all three UI designs show reachable actions and readable detail. Long-form dialogs may scroll deliberately; small decision dialogs remain compact.
- Theme changes retain contrast, and graph data also has text/table access.

Measure task completion, mistaken commitments, repeated corrective clicks and alert volume during playtests. Use those results to tune density and defaults before adding more systems.

## 10. First implementation batch

Begin with C0–C1: capture failing financial/offer cases, introduce validated one-time decisions, build the shared comparison and commitment panel, and use it for sponsor acceptance alongside a reconciled finance summary. This gives an immediately more usable interaction while establishing the architecture needed for the broader redesign.

Leave advanced negotiation, delegation, new financial products and optional expansion mechanics until their supporting state and consequences are complete. The initial audit remains the evidence register; this document is the delivery specification.
