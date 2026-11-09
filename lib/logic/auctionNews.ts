import type { AuctionState, Player } from "@/lib/types";

/** Auction stories must describe recorded sales, not current squad membership. */
export function getRecordedAuctionBuys(auction: AuctionState | null | undefined, season: number, players: Record<string, Player>) {
  if (!auction || auction.season !== season || auction.phase !== "completed") return [];
  const finalSales = new Map(auction.saleHistory.map(sale => [sale.playerId, sale]));
  return Array.from(finalSales.values())
    .filter(sale => players[sale.playerId] && sale.teamId && Number.isFinite(sale.price) && sale.price > 0)
    .sort((a, b) => b.price - a.price || a.playerId.localeCompare(b.playerId))
    .map(sale => ({ player: players[sale.playerId], sale }));
}
