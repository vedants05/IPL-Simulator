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

export function findSpecialOpenerPair<T extends { id: string }>(
  players: readonly T[],
): [T, T] | null {
  for (const [firstPrefix, secondPrefix] of SPECIAL_OPENER_PAIRS) {
    const first = players.find((player) => idMatches(player.id, firstPrefix));
    const second = players.find((player) => idMatches(player.id, secondPrefix));
    if (first && second) return [first, second];
  }
  return null;
}
