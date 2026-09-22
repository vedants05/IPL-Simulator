import type { AuctionType } from "@/lib/types";
import { worldRules } from "./worldRules";

/**
 * Career auction calendar. By default the opening 2027 auction is a mini
 * auction, 2028 is a mega auction, and every mega auction after that follows
 * two mini auctions. The next mega season and the gap are world rules.
 */
export function getAuctionTypeForSeason(season: number): AuctionType {
  const { nextMegaAuctionSeason, megaAuctionEveryYears } = worldRules();
  const gap = Math.max(1, megaAuctionEveryYears);
  if (season < nextMegaAuctionSeason) return "mini";
  return (season - nextMegaAuctionSeason) % gap === 0 ? "mega" : "mini";
}
