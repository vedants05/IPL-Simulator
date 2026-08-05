import type { AuctionType } from "@/lib/types";

/**
 * Career auction calendar: the opening 2027 auction is a mini auction, 2028 is
 * a mega auction, and every mega auction after that follows two mini auctions.
 */
export function getAuctionTypeForSeason(season: number): AuctionType {
  if (season === 2027) return "mini";
  if (season >= 2028 && (season - 2028) % 3 === 0) return "mega";
  return "mini";
}
