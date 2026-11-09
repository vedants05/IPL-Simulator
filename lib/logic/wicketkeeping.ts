import type { Player } from "@/lib/types";

export function effectiveWicketkeepingRating(player: Player | undefined): number {
  if (!player) return 48;
  const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
  if (Number.isFinite(player.wicketkeepingRating)) return clamp(player.wicketkeepingRating!, 0, 100);
  const name = player.name;
  if (name.includes("Dhoni")) return 94;
  if (name.includes("Pant")) return 88;
  if (name.includes("Samson")) return 86;
  if (name.includes("Klaasen")) return 85;
  if (name.includes("Pooran")) return 85;
  if (name.includes("Ishan Kishan")) return 82;
  if (name.includes("KL Rahul")) return 82;
  if (name.includes("Jurel")) return 80;
  if (name.includes("Porel")) return 78;
  if (name.includes("Prabhsimran")) return 76;
  const primary = player.role === "WK-Batsman" || Boolean(player.isWicketkeeper);
  const base = primary ? 78 : player.isPartTimeWk ? 68 : 50;
  return clamp(Math.round(base + (player.reputation ?? 5) * 1.2 + Math.min(6, Math.max(0, (player.age - 20) * 0.4))), 50, 95);
}

export function selectPreferredKeeper(players: readonly Player[]): Player | undefined {
  const primary = players.filter(player => player.role === "WK-Batsman" || player.isWicketkeeper);
  const candidates = primary.length ? primary : players.filter(player => player.isPartTimeWk);
  return [...candidates].sort((a, b) => effectiveWicketkeepingRating(b) - effectiveWicketkeepingRating(a) || a.id.localeCompare(b.id))[0];
}
