import type { Team, TradeRecord } from "@/lib/types";
import type { InjuryReplacementRecord } from "./injuryReplacements";

export function getAuctionEndSquadIds(input: {
  team: Team;
  auctionSeason?: number;
  tradeRecords: readonly TradeRecord[];
  replacementRecords: readonly InjuryReplacementRecord[];
}): string[] {
  if (!input.auctionSeason) return [...input.team.squad];
  const ids = new Set(input.team.squad);
  // Undo later trades first, then remove replacement signings. A replacement
  // may itself have been traded, so reversing in this order restores the true
  // post-auction squad rather than accidentally adding that replacement back.
  [...input.tradeRecords]
    .filter((record) => record.season === input.auctionSeason)
    .reverse()
    .forEach((record) => {
      if (record.fromTeamId === input.team.id) {
        record.incomingPlayerIds.forEach((id) => ids.delete(id));
        record.outgoingPlayerIds.forEach((id) => ids.add(id));
      } else if (record.toTeamId === input.team.id) {
        record.outgoingPlayerIds.forEach((id) => ids.delete(id));
        record.incomingPlayerIds.forEach((id) => ids.add(id));
      }
    });
  input.replacementRecords
    .filter((record) => record.season === input.auctionSeason && record.teamId === input.team.id)
    .forEach((record) => ids.delete(record.replacementPlayerId));
  return Array.from(ids);
}
