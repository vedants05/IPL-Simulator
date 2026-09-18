# Theme drift fixes

## Root cause
`lib/theme/teams.ts` defines a per-team accent/bidBg/bidTinge, applied via CSS
vars in `TeamThemeProvider`. But many components hardcode `#1d55c4` (MI blue)
as a hover/highlight color instead of `var(--team-accent)` — so every team's
buttons flash MI-blue on hover no matter which franchise you picked. That's
the main "drift" bug. Separately, per-team accent saturation/lightness was
wildly inconsistent (RR/SRH neon-bright, GT/LSG near-black), which is why some
teams look flashy and others flat. `lib/theme/teams.ts` in this project has
been rebalanced (same OKLCH chroma, hue-tuned lightness) — copy it back into
the repo as-is.

## Files with hardcoded `#1d55c4` to replace with `var(--team-accent)`
Swap literal hex → CSS var; drop the Tailwind arbitrary-value hex classes in
favor of inline `style` where the var is needed (Tailwind can't read CSS vars
in arbitrary color positions reliably for hover states).

- `components/shared/NavBar.tsx` — lines ~257, 331, 502, 520 (`hover:bg-[#1d55c4]` on Skip Set / Skip Accel / Skip All / Pause / Settings buttons), line 291 (`decoration-[#1d55c4]`), line 585 (toggle thumb `#1d55c4`), line 659 (`text-[#1d55c4]` guide heading).
- `components/auction/TeamPurseList.tsx` line 209 (`bg-[#1d55c4]/15 text-[#1d55c4]` RTM chip).
- `components/auction/UserSquad.tsx` line 161 (same RTM chip pattern).
- `components/squad/CaptaincyPage.tsx` line 218 (`bg-[#1d55c4]` overseas badge).
- `components/squad/TacticsLineupBuilder.tsx` line 114 (`bg-[#1d55c4]` overseas badge).

Suggested fix for the two RTM/overseas badge patterns: these are *informational*
badges (not team-branded), so give them a fixed neutral chip color instead of
either the old MI-blue or `--team-accent` — a badge whose color changes with
your team pick reads as a bug, not a feature. Use a shared muted slate, e.g.
`bg-[#5a6b8c]/15 text-[#5a6b8c]`.

For NavBar's hover states (Skip Set/Accel/All, Pause, Settings) and the guide
heading/decoration, switch to `var(--team-accent)` so the hover state matches
whichever team is active.

## Tonal drift: History tab
`LeagueHallOfFame.tsx` and `LeagueRecords.tsx` hardcode their own soft
gold/museum palette (`#f6edd9`, `#8d6218`, `#b68a32`, blurred glow orbs) that
doesn't match the bold Anton/space-mono sports-broadcast look used everywhere
else (Auction, Squad, Overview). Recommend re-skinning both to the shared
`--surface`/`--border`/`--ink`/`--accent` tokens plus `--team-accent` for
highlights, dropping the glow-orb decoration — so History doesn't feel like a
different app bolted on.

## GT correction
Gujarat Titans is navy + gold, not orange — fixed: `accent` now `#c2a132` (muted
gold, distinct from CSK's brighter `#e3b831`), `bidBg`/`navActive` now navy-black
instead of brown-black.

---

# Whole-UI smoothening (beyond auction)

## 1. `accent` Tailwind color is hardcoded, unrelated to team theme
`tailwind.config.ts` defines `accent: "#ffc400"` (fixed bright yellow) as a
**global** Tailwind color, separate from the `--team-accent` CSS var the
auction/nav components use. `CaptaincyPage.tsx`, `TacticsLineupBuilder.tsx`,
and much of `overview/page.tsx` (`text-accent`, `bg-accent`, `border-accent`,
`border-l-4 border-accent`) all key off this fixed yellow — so captaincy
badges, playing-XI highlights, and section rules in Squad/Season/Overview
never change with your team, while Auction's buttons do. Pick one: either
point Tailwind's `accent` at `var(--team-accent)` so the whole app tracks the
team color, or keep `accent` as a deliberate fixed "house yellow" for
captaincy/rating badges and rename it (e.g. `house-gold`) so it reads as an
intentional choice, not a missed variable.

## 2. No shared radius or shadow scale — every component invents its own
Corner radii in use: `rounded-[2px]`, `[3px]`, `[5px]`, `[6px]`, `[8px]`, plus
Tailwind's `rounded`/`rounded-full`, with no pattern to which value goes where
(e.g. `overview/page.tsx` alone mixes `rounded-[2px]` chips with `rounded-[8px]`
cards a few hundred lines apart from similar cards elsewhere at `rounded-[6px]`).
Shadows are similarly ad hoc: hand-rolled `shadow-[0_7px_22px_rgba(64,52,35,0.08)]`
values sit next to Tailwind's `shadow-sm`/`shadow-xl` for the same "card"
role. Recommend adding two radius tokens (`--radius-sm: 4px` for
chips/buttons, `--radius-md: 8px` for cards/modals) and two shadow tokens
(`--shadow-card`, `--shadow-modal`) to `globals.css`, then sweep components
onto them — this alone will make Squad/Season/History cards feel like one
system instead of each screen's own invention.

## 3. Same badge, four different implementations
The "overseas player" tag alone appears as: custom hex `bg-[#1d55c4]/15
text-[#1d55c4]` (`CaptaincyPage.tsx`, `TacticsLineupBuilder.tsx`,
`overview/page.tsx:3880`), and unrelated Tailwind ambers/slates
(`bg-amber-400`/`bg-slate-300`, `app/game/teams/[teamId]/page.tsx:310,318`).
Same for the RTM chip (`bg-[#1d55c4]/15` in `TeamPurseList.tsx`/`UserSquad.tsx`
vs `auction/page.tsx:1769`). Worth extracting one `<Badge variant="overseas" | "rtm">`
shared component so every tab renders the same tag the same way.

## 4. History tab's tonal drift reaches into Overview too
Beyond the standalone `LeagueHallOfFame`/`LeagueRecords` components, Overview's
own History sub-tab (`overview/page.tsx:4566` `history-archive-tile`) reuses
the same disconnected cream/gold parchment palette (`#d8d1c4` border,
`#fbfaf6` fill, soft brown shadows) instead of `--surface`/`--border`. It's a
third place carrying this one-off look — re-skinning it alongside the two
components in #4 below removes the "different app" feeling in one pass.

## Next steps
1. Copy `lib/theme/teams.ts` from this project back into the repo.
2. Apply the hex→var swaps above (drift bug #1, MI-blue hovers).
3. Decide `accent` vs `--team-accent` (#1 above) and apply consistently.
4. Add radius/shadow tokens and sweep components onto them (#2).
5. Extract shared `Badge` component for overseas/RTM tags (#3).
6. Re-skin `LeagueHallOfFame`, `LeagueRecords`, and Overview's History tile
   (#4) onto shared surface/border tokens.
