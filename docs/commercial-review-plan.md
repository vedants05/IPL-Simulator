# Commercial system review and improvement plan

Reviewed 2 October 2026. This preserves the initial source-code review and targeted calculation audit, which did not change gameplay. Implementation has since followed; see the [delivery record](commercial-experience-roadmap.md#delivery-record) for current behaviour and verification. This initial audit is not a browser visual audit.

The expanded [commercial experience roadmap](commercial-experience-roadmap.md) builds on this audit with detailed player journeys, page interactions, delegation rules, technical design and a phased implementation backlog.

## Assessment

Keep the current six-page structure: Overview, Matchday Revenue, Partnerships, Retail & Marketing, Club Operations, and Finance & Rights. It is a sensible way to organise decisions. The immediate priority is making money, contracts and consequences trustworthy; adding more controls before that would amplify existing inconsistencies.

The implementation already has useful foundations: save-specific commercial keys, cloud snapshot inclusion, separate actual gate receipts, protection against duplicate home-match settlements, transactions with stable IDs, supporter-sensitive demand, and medical contracts that affect injuries. These should be retained and consolidated.

## Scope and architecture

- [CommercialMainPage](../components/commercial/CommercialMainPage.tsx) owns local React state, loading/saving, the overview, and routing to five desks.
- [CommercialDecisionHub](../components/commercial/CommercialDecisionHub.tsx) contains those desks, reusable UI pieces, and most decision handlers.
- [commercialSystem](../lib/logic/commercialSystem.ts) defines state, initial data, projections, local persistence, cash posting, match/season settlements and injury modifiers.
- [Season overview](../app/game/overview/page.tsx) supplies supporter/squad/stadium context and invokes settlements during individual and batch simulations.
- [Cloud saves](../lib/supabase/cloudSaves.ts) include commercial side storage using the save ID; commercial data is not excluded from cloud snapshots.
- Ten older components in [subpages](../components/commercial/subpages) remain in the repository. The current entry point renders the decision hub, not these components. Old subtab names are redirected to the new desks. Their functionality must be considered when deciding what to restore, but their old behaviours are not current user-facing bugs.

## Findings, in priority order

### 1. Cash and forecasts do not consistently reconcile — critical

Default cash is hard-coded as starting cash plus 185.2 Cr, rather than derived from the initial transactions. A calculation probe for MI, 2026, 45,000 capacity produced **263.70 Cr displayed cash versus 312.31 Cr implied by the ledger**. Initial transactions are also seeded on fixed dates regardless of the current career date.

`syncCommercialFinance` projects end cash from starting cash plus estimated profit. It does not explicitly reconcile actual cash, remaining collections, remaining obligations and one-off setup/inventory payments. Annual totals combine forecast and realised concepts, and the overview independently duplicates the calculation.

The Finance desk subtracts `currentProjectedPrizeCr` from a base forecast which initially excludes that prize. In the same probe, the P4 scenario showed 565.94 Cr where the existing model's baseline plus a 6.5 Cr prize gives 578.44 Cr.

**Improve:** use one financial summary function, separate actuals/commitments/forecasts, derive cash from posted transactions, and calculate future cash from current cash plus remaining scheduled movements. Keep scenario calculations read-only.

### 2. Recurring income and costs are incomplete — critical

Implemented cash events include initial seeded entries, home-match receipts/costs, broadcast tranches, season prizes, inventory orders and operation setup fees. There is no general due-date settlement mechanism for the remainder of payroll, sponsorship instalments, marketing, operation retainers, merchandise receipts or sponsor bonuses.

Squad payroll is initially based on player auction base prices with an 85 Cr floor, rather than actual contracts. Coaching and other overheads are presets, disconnected from real staff agreements. Travel costs also need a clear separation between base overhead and travel-programme charges.

**Improve:** define payment schedules and ownership of each expense; source player/staff payroll from their contracts; prevent double counting. Make insufficient cash and future commitments visible before a decision is accepted. Keep franchise cash separate from auction purse unless a deliberate game rule links them.

### 3. Season rollover loses business continuity — critical

Commercial state is keyed by save, club and season. Loading a season without stored commercial data creates defaults; the loader does not derive it from the previous season. Although season settlement ages sponsor contracts and changes followers/brand, those changes have no explicit rollover into the next season.

**Improve:** carry closing cash, active contracts, inventory, selected policies and brand/fan progress forward; reset only seasonal counters; retain a read-only prior-season statement. Use versioned migrations so existing saves are preserved.

### 4. Sponsor renewal is repeatable and compounds value — high

The active Partnerships desk calculates an offer from the current contract value and always allows accepting it. Acceptance changes that base value, immediately producing another offer. Applying the handler's formula five times increased MI's example shirt-front contract from **38 Cr to 94.86 Cr annually** without time advancing.

Contract expiry, renewal windows, offer identity, payment schedules and executable bonus conditions are missing from this flow. The displayed bonus upside does not have a corresponding bonus settlement implementation.

**Improve:** create dated, identified offers with a fixed valuation basis, eligibility windows, expiry and one-time acceptance. Model bonus conditions as data rather than display strings. Expired contracts must stop earning unless renewed.

### 5. Retail policies alter historical sales and lack meaningful trade-offs — high

Choosing a policy overwrites `unitsSoldSeason` immediately. No matching sales receipt is posted and inventory is not depleted through sales events. A reorder buys 1,500 units of every product without showing the cost first; insufficient cash silently does nothing. Selected retail policy lives in component state and resets to Balanced when the desk remounts.

At default stock and supporter values, all three policies hit the same stock caps for all seven products. The calculation probe confirmed identical units sold across Volume, Balanced and Premium; higher prices therefore win without the advertised volume trade-off.

**Improve:** persist the policy; distinguish forecast demand, stock on hand, orders in transit and units actually sold. Settle sales over game time with stock/cash changes. Preview cost and choose product/quantity for orders. Calibrate elasticity so policies have different outcomes across demand conditions.

### 6. Matchday forecasts and settlements use different assumptions — high

Projection and settlement separately implement demand using different constants. Forecasts assume seven home matches and weighted categories rather than the actual fixture schedule. Category definitions disagree with settlement's hard-coded opponent bands. The commercial page receives stadium-builder capacity, while settlement calls use the base home-stadium capacity.

The overview's “Gate Demand Pull” is a separate happiness-only formula; actual ticket demand also uses squad approval, player popularity and atmosphere. Hospitality policy changes recalculate totals with a different inclusion set from default hospitality revenue. Season-ticket allocated versus sold seats and VIP/public seat allocation need explicit rules.

**Improve:** share a fixture-level calculator and venue context between forecasts and settlements. Aggregate actual receipts plus remaining fixtures; use the same demand breakdown everywhere. Account explicitly for season tickets, public seats, boxes, lounges, packages and concessions. Apply new pricing only to uncommitted future sales.

### 7. Some operation benefits are descriptive rather than connected — high

Sports-science tiers feed injury modifiers. Searches found no gameplay consumers for the commercial scouting-network, preparation-camp or logistics tier selections outside commercial UI/data. The medical descriptions also quote recovery percentages that differ from their actual modifiers.

Overhead policies adjust costs without a corresponding demonstrated service consequence. Operation setup transaction IDs contain season/category/tier, which prevents a later re-sign of the same tier from charging again; cancellation/re-entry rules are undefined.

**Improve:** define a measurable effect, effective date and lifecycle for every programme. Connect scouting to report coverage/accuracy, camps to bounded preparation effects and travel to schedule-related fatigue where those systems support it. Avoid automatic performance wins. Derive explanatory text from the same parameters used by simulation. Model genuine contract instances and cancellation terms.

### 8. Marketing outcomes are too delayed and weakly exposed — medium

Campaign toggles change forecast annual spend immediately, while follower growth is applied at season end. There is no persisted duration or accrued campaign cost in the active flow. A last-minute activation can therefore receive the season-end effect without tracking how long it ran. Followers and brand improvements also need a clear connection to existing supporter/scouting/sponsorship systems.

**Improve:** schedule campaigns with start/end dates, accrued cost, target audience, progress and diminishing incremental reach. Report attributable outcomes and assumptions. Tie accumulated results into existing supporter/brand state rather than maintaining competing fan counts.

### 9. Persistence works, but needs a stronger update boundary — high

Cloud snapshots include this data, but commercial decisions directly write localStorage rather than explicitly scheduling the main persistence flow. A commercial-only edit should be tested for prompt cloud/save-slot capture. Save failures are logged without user feedback; loading can replace data with defaults after a storage error. Default merging checks structure incompletely and does not validate numeric ranges or contract consistency.

The parent recreates `squadPlayers` on renders and the commercial effect depends on that array, causing unnecessary reloads and storage writes. Match settlements are wired in page handlers rather than a single shared career event boundary.

**Improve:** use a canonical commercial store/service with typed actions, validation, subscriptions and explicit save notifications. Keep reads side-effect-free except deliberate migrations. Preserve the last valid state on storage failure. Move settlement into shared date/match/season events so individual play, batch simulation and fast-forward behave consistently.

### 10. UI hides useful detail and lacks decision feedback — medium

The active desks are compact and consistent, but many labels are only 7–10px. Fixed header/KPI rows, several narrow columns, truncation and overflow-hidden cards create layout risks, especially in Sidebar and at reduced viewport height. This is a source-based assessment; visual verification is still needed.

The ledger only displays six entries with no full-history control; partners and campaigns are also sliced to fixed counts. Choice buttons lack explicit selected-state semantics. Several decisions apply instantly without a cost/commitment preview or success feedback. Colour accents frequently use fixed palette colours instead of selected-theme status tokens.

Older pages contain detailed ticket tiers, memberships, catering/security/event controls, hospitality packages, product inventory, campaign detail and finance breakdowns that the active desks no longer expose.

**Improve:** retain simple policy choices as the entry point, then offer useful detail through expandable panels or focused dialogs. Use actual container width, readable type, thin frames and deliberate scrolling for long lists. Preserve Original/Modern/Sidebar geometry and all colour themes. Use selected-state accessibility attributes, visible focus, clear disabled reasons and save/error feedback.

## Page-by-page target

| Page | Proposed contents |
|---|---|
| Overview | Cash, actual profit/loss, forecast end cash, upcoming obligations, decisions due, recent outcomes. Each figure drills into its source. Replace oversized navigation cards with useful current information and compact links. |
| Matchday Revenue | Next home fixture; editable policy preview; demand drivers; committed versus available seats; ticket tiers/season memberships; hospitality and concessions; service/safety budget; actual versus forecast history. |
| Partnerships | Full portfolio; expiry timeline; offers inbox; compare annual value, term, bonuses and obligations; clear negotiation limits and one-time acceptance. |
| Retail & Marketing | Product stock/sell-through table, forecast demand by policy, targeted restocking with cost/arrival preview, campaign calendar and outcomes. Keep detailed catalogue controls behind the summary. |
| Club Operations | Current contracts and renewal dates; programme comparison with cost and verified effects; staff/travel cost reconciliation; explicit cancellation and activation rules. |
| Finance & Rights | Actual P&L and cash flow, projected remaining cash flow, payment calendar, broadcast distribution breakdown, read-only finish scenarios, complete searchable/filterable ledger and prior seasons. |

Every decision should show: current choice, proposed change, immediate cost, future commitment, expected effect, effective date and whether it can be reversed.

## Implementation order and acceptance criteria

1. **Financial foundation and migrations.** Define actual/forecast/commitment semantics; introduce canonical calculations and transaction validation; reconcile opening balances, salaries, prize scenarios and recurring payments. Existing saves migrate without silent resets. Acceptance: opening cash plus signed ledger entries equals current cash; one-off charges appear in end-cash forecasts; scenario controls never post money.

2. **Lifecycle and persistence.** Implement date/match/season settlement, carry-forward and contract expiry through one event boundary. Explicitly capture commercial-only changes in saves/cloud snapshots. Acceptance: duplicate events do not pay twice; individual and batch simulation agree; reload, cloud restore and next-season progression retain business state; separate careers remain isolated.

3. **Decision integrity and balance.** Fix one-time sponsor offers, time-based retail/campaign outcomes, future-only pricing and operation contract rules. Share fixture/venue demand inputs. Acceptance: repeated clicks cannot inflate income; policy changes cannot rewrite completed sales; stock never goes negative; three pricing policies produce meaningful trade-offs; advertised operation effects match gameplay.

4. **Page redesign.** Build reusable metric, decision, comparison and ledger components; improve the six pages using the target table. Restore valuable detail from legacy pages selectively. Acceptance: all controls and explanations remain accessible across the three UI designs and colour themes, including narrow Sidebar width; lists expose all records; money is clearly labelled Actual, Committed or Forecast.

5. **Full-season calibration and cleanup.** Simulate small/large venues, weak/strong fanbases, varied contracts, cash shortages and multiple seasons. Check that commercial decisions matter without dominating cricket. Remove unused legacy implementations only after useful capabilities are accounted for. Acceptance: reconciled season statements, believable trade-offs, no repeatable-money exploits, and a clean reload/rollover path.

## Verification plan

- Unit checks for ledger arithmetic, transaction validity, duplicate events, price/demand calculations, stock transitions, offer acceptance and expiry, remaining-obligation forecasts, and migrations.
- Integration checks for home/away/neutral fixtures, modified stadium capacity, actual salaries, campaign duration, season rollover, fast-forward and save/restore isolation.
- Balance sweeps across clubs, supporter values, capacities and stock levels; detect policies that dominate every tested scenario.
- Browser checks at supported scaled viewport sizes for Original, Modern and Sidebar; keyboard navigation, selected-state announcements, contrast, dialogs, long partner/product names and full ledger scrolling.

No dedicated commercial verification suite was found in the searched calibration/test entry points. The calculation probe used for this review is intentionally outside the repository and is evidence for the findings, not a replacement for these tests.

## Recommended first slice

Start with **Finance + sponsor renewal integrity**: reconcile cash, correct the prize forecast, introduce identified one-time offers, and establish tests/migration rules. Then implement rollover before investing in broader UI work. This gives the rest of the commercial pages a dependable foundation.
