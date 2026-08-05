import type { Player } from "../types";

type BattingPositionPlayer = Pick<Player,
  | "role"
  | "currentBatting"
  | "isOpener"
  | "onlyOpensOrBenched"
  | "hasBattedAt3"
  | "hasBattedAt4"
  | "hasBattedAt5"
  | "hasBattedAt6"
  | "hasBattedAt7"
  | "isFinisher"
>;

export const MIN_NON_BATTER_POSITION_RATING = 65;

export function canReceiveBattingPositions(
  player: Pick<Player, "role" | "currentBatting">,
): boolean {
  return player.role === "Batsman"
    || player.role === "WK-Batsman"
    || player.currentBatting >= MIN_NON_BATTER_POSITION_RATING;
}

export function enforceBattingPositionEligibility<T extends Player>(player: T): T {
  if (canReceiveBattingPositions(player)) return player;
  return {
    ...player,
    isOpener: false,
    onlyOpensOrBenched: false,
    isFinisher: false,
    isCoreBatter: false,
    hasBattedAt3: false,
    hasBattedAt4: false,
    hasBattedAt5: false,
    hasBattedAt6: false,
    hasBattedAt7: false,
  };
}

export function getTopSevenBattingPositions(player: BattingPositionPlayer): number[] {
  if (!canReceiveBattingPositions(player)) return [];
  const positions = new Set<number>();
  if (player.isOpener || player.onlyOpensOrBenched) {
    positions.add(1);
    positions.add(2);
  }
  if (player.hasBattedAt3) positions.add(3);
  if (player.hasBattedAt4) positions.add(4);
  if (player.hasBattedAt5) positions.add(5);
  if (player.hasBattedAt6 || player.isFinisher) positions.add(6);
  if (player.hasBattedAt7 || player.isFinisher) positions.add(7);
  return Array.from(positions).sort((left, right) => left - right);
}

export function formatTopSevenBattingPositions(player: BattingPositionPlayer): string {
  const positions = getTopSevenBattingPositions(player);
  if (positions.length === 0) return "Not specified";

  const labels: string[] = [];
  if (positions.includes(1) || positions.includes(2)) labels.push("Opener");
  labels.push(
    ...positions
      .filter((position) => position >= 3)
      .map((position) => `#${position}`),
  );
  return labels.join(", ");
}
