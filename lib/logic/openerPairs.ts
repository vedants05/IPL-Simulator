export const SPECIAL_OPENER_PAIRS = [
  ["virat-kohli", "phil-salt"],
  ["sunil-narine", "finn-allen"],
  ["yashasvi-jaiswal", "vaibhav-suryavanshi"],
  ["travis-head", "abhishek-sharma"],
  ["shubman-gill", "sai-sudharsan"],
  ["prabhsimran-singh", "priyansh-arya"],
] as const;

const idMatches = (playerId: string, prefix: string) => (
  playerId === prefix || playerId.startsWith(`${prefix}-`) || playerId.startsWith(prefix)
);

export function findSpecialOpenerPair<T extends {
  id: string;
  currentBatting?: number;
  batting?: number;
}>(
  players: readonly T[],
): [T, T] | null {
  for (const [firstPrefix, secondPrefix] of SPECIAL_OPENER_PAIRS) {
    const first = players.find((player) => idMatches(player.id, firstPrefix));
    const second = players.find((player) => idMatches(player.id, secondPrefix));
    if (first && second) {
      const battingRating = (player: T) => player.currentBatting ?? player.batting ?? 0;
      if (battingRating(first) >= 75 && battingRating(second) >= 75) {
        return [first, second];
      }
    }
  }
  return null;
}
