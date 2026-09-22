# Handoff prompt for Claude Code

Paste the block below into Claude Code, run from the repo root
(`vedants05/IPL-Simulator`). Attach/point it at `PATCH_NOTES.md` and
`Redesign Concepts.dc.html` (or screenshots of it) from this project.

---

> This is a visual-only polish pass on an existing Next.js/Tailwind app
> (IPL auction/season simulator). Do NOT change any game logic, data,
> types, routes, or content — only styling and markup structure of
> existing components. Every screen must keep its current information,
> fields, and behavior; only spacing, color, radius, shadow, typography
> scale, and component consistency should change.
>
> Reference material (read both before touching code):
> 1. `PATCH_NOTES.md` — the specific drift bugs found (hardcoded
>    `#1d55c4` MI-blue hovers/badges across NavBar, TeamPurseList,
>    UserSquad, CaptaincyPage, TacticsLineupBuilder; Tailwind's `accent`
>    color being a fixed yellow disconnected from `--team-accent`; no
>    shared radius/shadow scale; the overseas/RTM badge implemented 4
>    different ways; History's parchment palette leaking into Overview's
>    History sub-tab).
> 2. `Redesign Concepts.dc.html` — high-fidelity target look for every
>    tab and subtab (Home: Overview/Inbox/Calendar/Office · Squad:
>    Overview/Roster/Playing XI/Captaincy/Tactics · Scouting:
>    Overview/Search/Planner · Season: Overview/Fixtures/Standings/Stats
>    · History: Overview/Records/Club History/Club Figures/League
>    History/Hall of Fame · Auction Room · Setup · Retentions). Open it
>    in a browser to see the target styling — card shape, badge shape,
>    spacing rhythm, nav/subtab chrome, typography scale. Match this
>    direction, not any specific pixel values from it.
>
> Do this in order:
>
> 1. Replace `lib/theme/teams.ts` with the version in this project
>    (already rebalanced: every team's accent shares the same OKLCH
>    chroma with hue-tuned lightness, so no team reads neon or
>    near-black next to another; Gujarat Titans corrected to navy+gold).
> 2. Fix every hardcoded `#1d55c4` reference listed in `PATCH_NOTES.md`
>    — hover states go to `var(--team-accent)`; the two badge instances
>    (overseas tag, RTM tag) become one shared neutral badge style (do
>    NOT tie them to team accent — they're informational, not
>    team-branded).
> 3. Decide and apply one rule for Tailwind's `accent` color: either
>    point it at `var(--team-accent)` so Squad/Season/Overview track
>    the team like Auction already does, OR rename it to a deliberate
>    fixed `house-gold` if you want captaincy/rating badges to stay a
>    constant color on purpose. Apply that choice everywhere `accent` is
>    currently used.
> 4. Add two radius tokens and two shadow tokens to `globals.css`
>    (`--radius-sm` ~4px for chips/buttons/badges, `--radius-md` ~8px
>    for cards/modals; `--shadow-card`, `--shadow-modal`), then sweep
>    every arbitrary `rounded-[Npx]` / hand-rolled `shadow-[...]` in
>    `components/` and `app/` onto these two scales.
> 5. Extract one shared `Badge` component (`components/shared/Badge.tsx`)
>    with variants for at least `overseas`, `rtm`, `retain`, and use it
>    everywhere those tags currently render inline with copy-pasted
>    Tailwind/hex.
> 6. Re-skin `components/history/LeagueHallOfFame.tsx`,
>    `components/history/LeagueRecords.tsx`, and the `history-archive-tile`
>    block in `app/game/overview/page.tsx` off their one-off cream/gold
>    parchment palette onto the shared `--surface`/`--border`/`--ink`
>    tokens, keeping their current content and structure.
> 7. Do a normal pass over every screen (all subtabs listed above) to
>    apply the same spacing rhythm, card style, and type scale shown in
>    `Redesign Concepts.dc.html`, WITHOUT deleting or renaming any data
>    fields, hooks, or logic. If a screen's current layout genuinely
>    can't fit the new card rhythm without changing information density,
>    flag it instead of guessing.
>
> After each numbered step, run the existing tests/build and confirm
> nothing broke before moving to the next step.
