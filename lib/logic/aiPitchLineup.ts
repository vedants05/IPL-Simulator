import type { CuratorPitch } from "@/lib/data/pitchCurator";
import type { Player } from "@/lib/types";
import { hasBaseBalance, isAiBowlingOption, isImpactPlayerWithinOverseasLimit, orderStartingXI, selectBattingFirstOutgoingBatter, type AiLineupMode } from "./aiLineupSelector";

/** Apply venue preferences without dropping leaders or invalidating the XI. */
export function tuneAiLineupForPitch(input: {
  startingXI: readonly string[];
  impactSubs: readonly string[];
  mode: AiLineupMode;
  pitch?: Pick<CuratorPitch, "favours"> | null;
  squad: readonly Player[];
  protectedIds: ReadonlySet<string>;
}) {
  const { pitch, squad, protectedIds, mode } = input;
  const style = pitch?.favours.includes("spin-bowlers") ? "Spinner"
    : pitch?.favours.includes("pace-bowlers") || pitch?.favours.includes("high-rated-pace-bowlers") ? "Pacer" : null;
  let startingXI = [...input.startingXI];
  let impactSubs = [...input.impactSubs];
  if (!style) return { startingXI, impactSubs };
  const byId = new Map(squad.map(player => [player.id, player]));
  const isStyle = (p: Player | undefined) => Boolean(p && p.currentBowling >= 68 && (p.bowlingStyle === style || p.role === (style === "Spinner" ? "Spin Bowler" : "Pace Bowler")));
  const target = style === "Spinner" ? 2 : 3;
  while (startingXI.filter(id => isStyle(byId.get(id))).length < target) {
    const incoming = squad.filter(p => !startingXI.includes(p.id) && isStyle(p)).sort((a, b) => b.currentBowling - a.currentBowling);
    let replacement: { xi: string[]; incoming: string; outgoing: string } | undefined;
    for (const candidate of incoming) {
      const outgoing = startingXI.map((id, index) => ({ player: byId.get(id), index }))
        .filter(({ player, index }) => player && index >= 4 && !protectedIds.has(player.id) && (player.reputation ?? 0) < 10 && !isStyle(player) && player.currentBowling <= candidate.currentBowling + 2)
        .sort((a, b) => Number(b.index >= 7) - Number(a.index >= 7) || a.player!.currentBowling - b.player!.currentBowling);
      for (const option of outgoing) {
        const trial = startingXI.map(id => id === option.player!.id ? candidate : byId.get(id)).filter((p): p is Player => Boolean(p));
        if (!hasBaseBalance(trial, mode)) continue;
        const openingPair = trial.slice(0, 2);
        const ordered = orderStartingXI(trial, openingPair, mode, undefined, protectedIds);
        if (!hasBaseBalance(ordered, mode) || Array.from(protectedIds).some(id => startingXI.includes(id) && !ordered.some(p => p.id === id))) continue;
        const trialSubs = [...impactSubs.filter(id => id !== candidate.id && id !== option.player!.id), option.player!.id].slice(0, 5);
        if (mode === "battingFirst" && ordered.filter(isAiBowlingOption).length < 5) {
          const outgoingBatter = selectBattingFirstOutgoingBatter(ordered, protectedIds);
          const bowlingCover = trialSubs.some(id => {
            const sub = byId.get(id);
            return sub && isAiBowlingOption(sub) && isImpactPlayerWithinOverseasLimit(ordered, sub);
          });
          if (!outgoingBatter || !bowlingCover) continue;
        }
        replacement = { xi: ordered.map(p => p.id), incoming: candidate.id, outgoing: option.player!.id };
        break;
      }
      if (replacement) break;
    }
    if (!replacement) break;
    startingXI = replacement.xi;
    impactSubs = [...impactSubs.filter(id => id !== replacement!.incoming && id !== replacement!.outgoing), replacement.outgoing].slice(0, 5);
  }
  return { startingXI, impactSubs };
}
