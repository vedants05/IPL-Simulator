# Handoff: Live Auction Room — "Matchday" redesign (2a)

## Overview
This is a full visual redesign of the **live auction screen** in the IPL Simulator
(`app/game/auction/page.tsx`). It replaces the current dark navy / purple UI with a
bright, high-contrast **editorial-broadcast** look ("Matchday"), and adds two new
live panels the current app doesn't have:

1. **Live Bids** — the real-time bid ladder for the player currently on the block.
2. **Sold Log** — a scrollable history of every player already sold (team + price),
   scrollable all the way back to the first lot.

The layout goes from 3 columns to **4 zones**: `Team Purse | Center Lot | Live Bids | Sold Log`.

## About the design files
`Auction Room.dc.html` in this folder is a **design reference created in HTML** — a
prototype showing the intended look, layout, spacing, and colors. It is **not
production code to paste in**. Your task is to **recreate this design inside the
existing Next.js + Tailwind app**, reusing your current components and store
(`lib/store/gameStore.ts`) and your established patterns. Only the *styling and
layout* change; the game logic and data flow stay as they are.

Open the HTML file in a browser to see the target. The design is presented as a
"design canvas" with several options stacked — **the one to build is option `2a`**
(top turn, labelled *"Matchday, expanded"*). Ignore 1a / 1b / 1c (earlier explorations).

## Fidelity
**High-fidelity.** Colors, typography, spacing, and borders are final. Recreate it
pixel-faithfully using Tailwind + your existing components. Exact hex values and
type specs are in **Design Tokens** below.

---

## Screens / Views

### Live Auction Room (`app/game/auction/page.tsx`)
**Purpose:** User watches the current lot, places bids, and tracks budgets, the live
bid war, and everything sold so far.

**Layout (desktop, fills viewport minus the 3rem NavBar):**
- Top **header bar** — full width, `border-bottom: 2px solid #16130f`.
- Below it, a **flex row** filling the remaining height, four columns left→right:
  1. **Team Purse** — fixed `~212px`, `border-right: 2px solid #16130f`.
  2. **Center Lot** — `flex: 1` (min-width 0), the main stage.
  3. **Live Bids** — fixed `~256px`, `border-left: 2px solid #16130f`.
  4. **Sold Log** — fixed `~264px`, `border-left: 2px solid #16130f`, bg `#efece3`.

Everything sits on a paper background `#f4f1ea` with ink `#16130f`. The signature
move is **hard 2px black rules between every zone** and **bold color blocks** (yellow
bid block, red high-bidder chip) — an editorial/broadcast feel, not soft cards.

---

### Header bar
- Left group (flex, gap 14px):
  - **LIVE pill** — `bg #16130f`, radius 3px, padding `5px 9px`; a 7px dot `#ffc400`
    that blinks (keyframes `liveblink`, 1.4s infinite), then mono text `LIVE`
    (Space Mono 700, 11px, letter-spacing .12em, `#fff`).
  - **Title** — `MEGA AUCTION '25`, Anton 22px, `#16130f`.
  - **Sub** — `SET 3/9 · MARQUEE SET`, Space Mono 400 11px `#8a8378`.
    Bind to `auction.currentSetIndex + 1`, `auction.sets.length`, set name.
- Right: a bordered segmented counter (1.5px `#16130f`, radius 5px, overflow hidden):
  - `SOLD 61` on `#1f9d57` white text · `UNSOLD 14` on `#d6492f` white ·
    `LEFT 329` on paper. Bind to `soldPlayerIds.length`, `unsoldPlayerIds.length`,
    and remaining pool count. All Space Mono 700 10px, padding `7px 11px`.

---

### Zone 1 — Team Purse  (replaces `components/auction/TeamPurseList.tsx`)
- Header label `PURSE / ₹Cr` (Space Mono 700 10px, letter-spacing .14em, `#8a8378`).
- One row per team (all 10), each: a **10px color dot** (`team.primaryColor`),
  team **shortName** in Anton 13px, and remaining purse in **Barlow Condensed 700 16px**.
  Rows separated by `1px solid rgba(22,19,15,.14)`.
- **User's team row is highlighted**: `bg #ffc400`, full-bleed (negative margin),
  bottom border `1px solid #16130f`, and a small mono `·YOU` after the name.
- Pinned to the bottom of this column: a compact **Your Squad summary** —
  MI badge + `YOUR SQUAD 14/25`, then two pills: `OS 5/8` (yellow) and `RTM ×3`
  (outlined). Bind to `userTeam.squad.length`, `overseasPlayersCurrent`, RTM cards.
- Values shown as `₹Cr` (e.g. `52.0`). Use `formatPrice` but strip to the Cr number,
  or format `remainingPurse / 100` to one decimal (purse is stored in lakhs).

### Zone 2 — Center Lot  (replaces `PlayerCard` + `BidPanel`, stacked)
Vertical flex, top→bottom:
1. **Identity band** (padding `18px 24px`, bottom border 2px `#16130f`):
   - Kicker `■ ON THE BLOCK · LOT 76` (Space Mono 700 10px, letter-spacing .16em, `#d6492f`).
   - Row: **player name** Anton 52px (`player.name`, uppercase) + right-aligned
     `BASE` label + base price Barlow Condensed 700 22px.
   - Chip row (gap 7px), Space Mono 700 10px, radius 3px:
     - role chip — white on `#16130f`;
     - nationality chip — ink on `#ffc400` with 1px ink border (`OVERSEAS · ENG`);
     - status chip — outlined `1px solid #16130f` (`CAPPED · 35`).
2. **Stats strip** (flex, bottom border 2px `#16130f`): 5 equal cells divided by
   `1px solid rgba(22,19,15,.18)`. Each: mono label 9px `#8a8378` + value
   Barlow Condensed 700 24px. Cells: `MATCHES 420 · RUNS 12,108 · AVG 36.1 ·
   SR 149.2 (colored #d6492f) · RATING 89`. Bind to `player.careerStats` + rating.
3. **Bid block** (flex, fills remaining height):
   - Left (`flex:1`) **yellow block** `#ffc400`, padding `22px 24px`, centered:
     - `CURRENT BID` mono 700 11px, letter-spacing .16em.
     - Amount **Anton 72px** (`₹14.50` + `Cr` at 32px). Bind `auction.currentBid`.
     - High-bidder row: 20px rounded team square (initial), team short name +
       `HIGH BIDDER` chip (white on `#16130f`). Bind `currentHighBidderTeamId`.
   - Right **timer panel** fixed `160px`, `bg #16130f` white: `TIME LEFT` mono,
     big number **Anton 60px `#ffc400`** (`auction.timerSeconds`), and 4 segment
     ticks (filled = seconds remaining bucket).
4. **Action bar** (flex, top border 2px `#16130f`):
   - **BID** button `flex:1`, `bg #16130f`, text `#ffc400` Anton 21px, padding 17px,
     hover `#000`. Label `BID ₹14.75 Cr ↑` (next increment). Wire to `placeBid`.
   - **PASS** button, paper bg, left border 2px ink, Space Mono 700 13px, padding
     `0 28px`, hover `#e8e3d8`. Wire to `passBid`. Keep the existing disabled logic
     from `BidPanel` (`canTeamBidOnPlayer`, `canTeamAffordBid`, isUserHighBidder).

### Zone 3 — Live Bids  (NEW panel; upgrade of `components/auction/BidHistory.tsx`)
- Header (bottom border 2px ink): blinking red dot + `LIVE BIDS` (Space Mono 700 11px)
  on the left, `12 bids` count (mono 9px `#8a8378`) on the right.
- **Scrollable ladder** (`overflow-y:auto`, padding `8px 12px`), newest bid on top:
  - **Top / current bid row**: `bg #ffc400`, `1px solid #16130f`, radius 5px —
    team dot + team short (Barlow 700 12px) + amount Barlow Condensed 700 16px.
  - **Older rows**: team dot + short (Barlow 600 12px) + amount Barlow Condensed 700
    15px in muted `#5a5348`, separated by `1px solid rgba(22,19,15,.1)`.
  - Last (opening) row tagged `OPEN` in mono.
  - Data source: `auction.biddingHistory` (map each `BidEntry` → team + amount),
    reversed so newest is first.
- Footer (top border 2px ink, `bg #efece3`): `YOUR NEXT BID` label +
  `₹14.75 Cr` (Barlow Condensed 700 20px) + `+0.25` increment (mono 600 10px `#1f9d57`).
  Bind to `getNextBidAmount(auction.currentBid)`.

### Zone 4 — Sold Log  (NEW panel/component, e.g. `components/auction/SoldLog.tsx`)
- Column `bg #efece3`. Header (bottom border 2px ink): `SOLD LOG` (Space Mono 700 11px)
  + `61 · scroll ↑ from start` (mono 9px `#8a8378`).
- **Scrollable list** (`overflow-y:auto`), newest sale on top, scroll down/up to reach
  the very first lot. One row per sold player (padding `8px 14px`, bottom border
  `1px solid rgba(22,19,15,.1)`):
  - Lot number `L75` — Barlow Condensed 700 11px `#b3ac9e`, fixed 24px.
  - Middle (min-width 0): **player name** Barlow 600 11.5px (ellipsis on overflow) +
    below it a 7px team dot + team short (mono 600 9px `#8a8378`).
  - Right: **price** Barlow Condensed 700 14px. Marquee buys (≥₹10 Cr) shown in
    `#d6492f` and the whole row tinted `#fff6d6`.
  - Data source: derive from `auction.soldPlayerIds` + each player's final price and
    buying team (see State below). Sort by lot/sale order descending.

---

## Interactions & Behavior
- **Bid**: click BID → `placeBid(userTeamId, getNextBidAmount(currentBid))`. New entry
  appears at the top of **Live Bids**; current-bid amount + high-bidder update.
- **Pass**: `passBid()`. Disabled when user is the current high bidder.
- **Timer**: existing `tickTimer` loop; on 0 → `hammerFall()`. When a lot sells, the
  player drops into **Sold Log** at the top and the next lot loads into Center.
- **Blink**: LIVE dots use `@keyframes liveblink { 0%,55%{opacity:1} 70%,100%{opacity:.25} }`.
- **Scroll**: Live Bids and Sold Log scroll independently; the rest of the screen is fixed.
- Preserve all existing guard rails from `BidPanel` (insufficient funds, overseas cap,
  squad full, "you're the highest bidder" states) — surface them near the action bar.
- Keep `RTMModal` and `SoldAnimation` overlays working as they do today.

## State Management
Uses the existing Zustand store (`lib/store/gameStore.ts`) — no new global state required,
but the **Sold Log** needs per-sale records. If not already tracked, add a
`saleHistory: { playerId, teamId, price, lot }[]` to `AuctionState`, pushed inside the
sell path (where `soldFlash` / `hammerFall` finalize a lot). Live Bids reads
`auction.biddingHistory`; everything else reads `teams`, `players`, `userTeamId`,
`auction.currentPlayer/currentBid/currentHighBidderTeamId/timerSeconds`.

## Design Tokens

**Colors**
- Paper bg `#f4f1ea` · panel bg (Sold Log / footers) `#efece3`
- Ink / text / rules `#16130f` · muted text `#8a8378` · faint muted `#b3ac9e`
- Signature yellow `#ffc400` · high-bid / accent red `#d6492f` · deep red alt `#ec1c24`
- Sold green `#1f9d57` · marquee row tint `#fff6d6`
- Rule lines: heavy `2px solid #16130f`; hairline `1px solid rgba(22,19,15,.10–.18)`
- Team dots use `team.primaryColor` from `lib/data/teams.ts` (MI `#004BA0`, CSK `#F9CD05`,
  RCB `#EC1C24`, KKR `#3A225D`, SRH `#FF822A`, GT `#1B2133`, DC `#0078BC`, RR `#EA1A85`,
  LSG `#A72B8F`, PBKS uses `#a7a9ac` grey in the mock).

**Typography** (all Google Fonts)
- **Anton** — display: title, player name (52px), big money (72px), timer (60px), buttons (21px).
- **Barlow** — body/UI: 600/700, names & labels (11.5–13px).
- **Barlow Condensed** — 700: all stat & purse numbers (14–24px).
- **Space Mono** — 400/700: kickers, chips, counts, letter-spacing .1–.16em, 9–11px.
- Import: `Anton`, `Barlow:wght@400;500;600;700`, `Barlow+Condensed:wght@500;600;700`,
  `Space+Mono:wght@400;700`. Add these to `next/font` or a `<link>` in `app/layout.tsx`.

**Spacing / radii**
- Column widths: purse 212 · live bids 256 · sold log 264 (center flexes).
- Chip radius 3px · pill/ladder-row radius 5px · dots fully round.
- Header padding `16px 22px`; identity band `18px 24px`; bid block `22px 24px`;
  list rows `7–8px` vertical.

## Tailwind config changes (`tailwind.config.ts`)
Replace the dark palette with the Matchday tokens (keep names your components already use):
```
bg: "#f4f1ea", surface: "#efece3", surface2: "#ffffff",
border: "#16130f", "text-primary": "#16130f", "text-secondary": "#8a8378",
accent: "#ffc400", "accent-hover": "#000000",
success: "#1f9d57", danger: "#d6492f", gold: "#d6492f",
```
Also update `app/globals.css` `--background`/`--foreground` and the scrollbar colors,
and add the font imports.

## Assets
No image assets. Team badges are colored dots / rounded squares with the team initials
(`team.shortName`) — reuse `components/shared/TeamBadge.tsx`. No SVG/icon files needed.

## Files
- **Design reference:** `Auction Room.dc.html` (this folder) — build option **2a**.
- **Code to restyle / extend in your app:**
  - `app/game/auction/page.tsx` — 4-zone layout
  - `components/auction/TeamPurseList.tsx` — Zone 1
  - `components/auction/PlayerCard.tsx` + `BidPanel.tsx` — Zone 2
  - `components/auction/BidHistory.tsx` — becomes Zone 3 (Live Bids ladder)
  - **new** `components/auction/SoldLog.tsx` — Zone 4
  - `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx` — tokens + fonts
