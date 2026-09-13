import type { IPLHistoryEntry, TradeRecord } from "@/lib/types";

interface SaleWithBids {
  teamId: string;
  bids: Array<{ teamId: string }>;
}

export function wasPlayerAcquiredViaRtm(sale: SaleWithBids): boolean {
  const finalBidderTeamId = sale.bids[0]?.teamId;
  return Boolean(finalBidderTeamId && finalBidderTeamId !== sale.teamId);
}

function shouldReplaceHistoryEntry(existing: IPLHistoryEntry, candidate: IPLHistoryEntry): boolean {
  const existingHasContract = existing.teamId !== "UNSOLD" && existing.price > 0;
  const candidateHasContract = candidate.teamId !== "UNSOLD" && candidate.price > 0;

  if (candidateHasContract !== existingHasContract) return candidateHasContract;
  return true;
}

export function mergePlayerIplHistory(
  databaseHistory: IPLHistoryEntry[] = [],
  savedHistory: IPLHistoryEntry[] = [],
): IPLHistoryEntry[] {
  const historyBySeason = new Map<string, IPLHistoryEntry>();

  [...databaseHistory, ...savedHistory].forEach((entry) => {
    const existing = historyBySeason.get(entry.season);
    if (!existing || shouldReplaceHistoryEntry(existing, entry)) {
      historyBySeason.set(entry.season, { ...entry });
    }
  });

  return Array.from(historyBySeason.values());
}

export function upsertPlayerIplHistory(
  history: IPLHistoryEntry[] = [],
  entry: IPLHistoryEntry,
): IPLHistoryEntry[] {
  return [
    ...history.filter((existing) => existing.season !== entry.season),
    { ...entry },
  ];
}

export function upsertPlayerContractHistory(
  history: IPLHistoryEntry[] = [],
  contract: IPLHistoryEntry,
): IPLHistoryEntry[] {
  const existing = getPlayerSeasonHistory(history, contract.season);
  return upsertPlayerIplHistory(history, {
    ...existing,
    ...contract,
    // Live auction and roster rows do not carry archived match totals.
    // Retain them when refreshing the contract for the same season.
    seasonStats: contract.seasonStats ?? existing?.seasonStats,
  });
}

export function getPlayerSeasonHistory(
  history: IPLHistoryEntry[] = [],
  season: string,
): IPLHistoryEntry | undefined {
  return mergePlayerIplHistory([], history).find((entry) => entry.season === season);
}

export function protectCompletedSeasonTeamsFromTrades(
  history: IPLHistoryEntry[] = [],
  playerId: string,
  tradeRecords: TradeRecord[] = [],
): IPLHistoryEntry[] {
  return history.map((entry) => {
    const trade = tradeRecords.find((record) => (
      String(record.season) === String(entry.season)
      && (record.outgoingPlayerIds.includes(playerId) || record.incomingPlayerIds.includes(playerId))
    ));
    if (!trade) return entry;

    const previousTeamId = trade.outgoingPlayerIds.includes(playerId)
      ? trade.fromTeamId
      : trade.toTeamId;
    return entry.teamId === previousTeamId ? entry : { ...entry, teamId: previousTeamId };
  });
}
