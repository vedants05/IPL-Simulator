/** TEMP: validate bowler pricing (role budget) + retention variety. npx tsx sim-auction.ts [runs] */
import { PLAYERS_SEED } from "./lib/data/players";
import { TEAMS_SEED } from "./lib/data/teams";
import { Player, Team } from "./lib/types";
import {
  buildAuctionSets, getNextBidAmount, calculateTotalRetentionCost,
  findRTMEligibleTeam, TOTAL_PURSE_LAKHS, MAX_TOTAL_RETENTIONS,
} from "./lib/logic/auctionRules";
import {
  canAIBidAtAmount, pickBiddingTeam, resetLotCache, resetAuctionQuirks,
  getCachedValuation, decideAIRetentions, AuctionContext,
} from "./lib/logic/auctionEngine";

const runs = parseInt(process.argv[2] ?? "10");
const rate = (p: Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
const roleGroup = (p: Player) =>
  p.role === "WK-Batsman" ? "WK" : p.role === "All-Rounder" ? "AR"
  : p.role === "Pace Bowler" ? "PACE" : p.role === "Spin Bowler" ? "SPIN" : "BAT";

function runAuction() {
  resetAuctionQuirks();
  const players: Record<string, Player> = {};
  PLAYERS_SEED.forEach(p => { players[p.id] = { ...p, currentTeamId: null, isRetained: false, retainedByTeamId: null }; });
  const teams: Record<string, Team> = {};
  TEAMS_SEED.forEach(t => {
    const squad = PLAYERS_SEED.filter(p => p.iplHistory?.some(h => h.season === "2026" && h.teamId === t.id)).map(p => p.id);
    teams[t.id] = { ...t, squad, retainedPlayers: [], remainingPurse: TOTAL_PURSE_LAKHS, spentAmount: 0, overseasPlayersCurrent: 0 };
  });

  const retInfo: Record<string, number> = {};
  let poolIds = Object.keys(players);
  Object.values(teams).forEach(team => {
    const retained = decideAIRetentions(team, players);
    retained.forEach(pid => { players[pid] = { ...players[pid], isRetained: true, retainedByTeamId: team.id, currentTeamId: team.id }; poolIds = poolIds.filter(id => id !== pid); });
    const cost = calculateTotalRetentionCost(retained, players);
    teams[team.id] = { ...team, retainedPlayers: retained, squad: retained, remainingPurse: TOTAL_PURSE_LAKHS - cost, spentAmount: cost, rtmCardsTotal: Math.max(0, MAX_TOTAL_RETENTIONS - retained.length), overseasPlayersCurrent: retained.filter(id => players[id].nationality === "Overseas").length };
    retInfo[team.id] = retained.length;
  });

  const sets = buildAuctionSets(poolIds.map(id => players[id]));
  const allPlayerIds = poolIds.slice();
  const soldIds: string[] = [];
  let unsoldIds: string[] = [];
  const sales: { player: Player; teamId: string; price: number; lot: number }[] = [];
  let lotIndex = 0;
  const totalLots = sets.reduce((s, x) => s + x.playerIds.length, 0);

  const auctionLot = (player: Player) => {
    lotIndex++; resetLotCache();
    const ctx: AuctionContext = { remainingPlayerIds: allPlayerIds.filter(id => !soldIds.includes(id) && id !== player.id), soldPlayerIds: soldIds, currentLotIndex: lotIndex, totalLots };
    let currentBid = player.basePrice, high: string | null = null, iter = 0;
    while (iter++ < 300) {
      const nextBid = getNextBidAmount(currentBid);
      const interested = Object.values(teams).filter(t => t.id !== high && canAIBidAtAmount(t, player, nextBid, player.id, players, ctx));
      if (!interested.length) break;
      const bidder = pickBiddingTeam(interested, player, player.id, players, ctx);
      if (!bidder) break;
      currentBid = nextBid; high = bidder.id;
    }
    if (!high) { unsoldIds.push(player.id); return; }
    let winner = high, price = currentBid;
    const rtmTeamId = findRTMEligibleTeam(player, teams, high, currentBid);
    if (rtmTeamId) {
      const origVal = getCachedValuation(rtmTeamId);
      if (origVal > currentBid && teams[rtmTeamId].remainingPurse >= currentBid) {
        const winVal = getCachedValuation(high);
        if (winVal > currentBid * 1.05 && teams[high].remainingPurse >= currentBid * 1.05) {
          let counter = currentBid; const target = Math.min(winVal, Math.round(currentBid * 1.25));
          while (counter < target) counter = getNextBidAmount(counter);
          if (counter <= currentBid) counter = getNextBidAmount(currentBid);
          if (origVal >= counter && teams[rtmTeamId].remainingPurse >= counter) { winner = rtmTeamId; price = counter; }
          else { winner = high; price = counter; }
        } else { winner = rtmTeamId; price = currentBid; }
      }
    }
    const w = teams[winner];
    teams[winner] = { ...w, squad: [...w.squad, player.id], remainingPurse: w.remainingPurse - price, spentAmount: w.spentAmount + price, overseasPlayersCurrent: player.nationality === "Overseas" ? w.overseasPlayersCurrent + 1 : w.overseasPlayersCurrent };
    players[player.id] = { ...player, currentTeamId: winner };
    soldIds.push(player.id);
    sales.push({ player, teamId: winner, price, lot: lotIndex });
  };
  sets.forEach(s => s.playerIds.forEach(pid => auctionLot(players[pid])));
  const accel = unsoldIds.map(id => ({ ...players[id], basePrice: Math.max(20, Math.floor(players[id].basePrice / 2)) }));
  accel.forEach(p => { players[p.id] = p; }); unsoldIds = [];
  accel.forEach(p => auctionLot(players[p.id]));
  return { sales, retInfo, players, teams };
}

const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const watch = ["harshit-rana", "mayank-yadav", "arshdeep-singh", "mohammed-siraj", "prasidh-krishna", "bhuvneshwar-kumar", "avesh-khan", "t-natarajan"];
const watchPrices: Record<string, number[]> = {};
const priceByGroupHalf: Record<string, number[]> = {}; // GROUP_firsthalf / secondhalf
const retCounts: number[] = [];
const retDist: Record<number, number> = {};
const squadSizes: number[] = [];
const leftoverPct: number[] = [];
const paceCounts: number[] = [];

for (let r = 0; r < runs; r++) {
  const { sales, retInfo, players, teams } = runAuction();
  Object.values(teams).forEach(t => {
    const sq = t.squad.map(id => players[id]).filter(Boolean);
    squadSizes.push(sq.length);
    leftoverPct.push(t.remainingPurse / t.totalPurse);
    paceCounts.push(sq.filter(p => p.role === "Pace Bowler").length);
  });
  const total = sales.length;
  sales.forEach(({ player, price, lot }) => {
    if (watch.includes(player.id)) (watchPrices[player.name] ??= []).push(price);
    // Bowler quality tracking by lot half
    const g = roleGroup(player);
    if ((g === "PACE" || g === "SPIN") && rate(player) >= 80) {
      (priceByGroupHalf[`${g}_quality`] ??= []).push(price);
    }
  });
  Object.values(retInfo).forEach(n => { retCounts.push(n); retDist[n] = (retDist[n] ?? 0) + 1; });
}

console.log(`=== ${runs} runs ===\n`);
console.log("Watched bowlers (mean ₹Cr across runs sold):");
Object.entries(watchPrices).forEach(([n, ps]) => console.log(`  ${n.padEnd(22)} n=${ps.length} mean=${(mean(ps)/100).toFixed(2)} min=${(Math.min(...ps)/100).toFixed(2)} max=${(Math.max(...ps)/100).toFixed(2)}`));

console.log("\nQuality bowlers (80+ rated) avg sale price:");
Object.entries(priceByGroupHalf).forEach(([k, ps]) => console.log(`  ${k.padEnd(16)} n=${ps.length} mean=${(mean(ps)/100).toFixed(2)}Cr`));

console.log(`\nRetentions/team: mean=${mean(retCounts).toFixed(2)} min=${Math.min(...retCounts)} max=${Math.max(...retCounts)}`);
console.log("Retention count distribution:", Object.keys(retDist).sort().map(k => `${k}:${retDist[+k]}`).join("  "));
console.log(`\nSquad size: mean=${mean(squadSizes).toFixed(1)} min=${Math.min(...squadSizes)} max=${Math.max(...squadSizes)}  | under18: ${squadSizes.filter(s=>s<18).length}/${squadSizes.length}`);
console.log(`Leftover purse: mean=${(mean(leftoverPct)*100).toFixed(1)}%  | pacers/squad mean=${mean(paceCounts).toFixed(1)}`);

// price-by-star sanity
const byStar: Record<string, number[]> = {};
for (let r = 0; r < runs; r++) {
  const { sales } = runAuction();
  sales.forEach(({ player, price }) => (byStar[player.starRating.toFixed(1)] ??= []).push(price));
}
console.log("\nPrice by star (₹Cr):");
Object.keys(byStar).sort().forEach(s => console.log(`  ${s}★ n=${String(byStar[s].length).padStart(4)} mean=${(mean(byStar[s])/100).toFixed(2)} max=${(Math.max(...byStar[s])/100).toFixed(2)}`));

// Role parity: 4.0★ price by role group (batters vs bowlers should be similar)
const parity: Record<string, number[]> = {};
for (let r = 0; r < runs; r++) {
  const { sales } = runAuction();
  sales.forEach(({ player, price }) => {
    if (player.starRating === 4.0) (parity[roleGroup(player)] ??= []).push(price);
  });
}
console.log("\n4.0★ ROLE PARITY (mean ₹Cr — batters vs bowlers should be comparable):");
["BAT","WK","AR","PACE","SPIN"].forEach(g => { const a = parity[g] ?? []; if (a.length) console.log(`  ${g.padEnd(5)} n=${String(a.length).padStart(3)} mean=${(mean(a)/100).toFixed(2)}`); });
