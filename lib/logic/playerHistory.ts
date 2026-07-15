import type { IPLHistoryEntry } from "@/lib/types";

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

export function getPlayerSeasonHistory(
  history: IPLHistoryEntry[] = [],
  season: string,
): IPLHistoryEntry | undefined {
  return mergePlayerIplHistory([], history).find((entry) => entry.season === season);
}
