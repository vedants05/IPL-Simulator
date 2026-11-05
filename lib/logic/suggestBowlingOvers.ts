import type { Player } from "@/lib/types";
import { getBowlingFamily, getPlayerPhaseRating } from "./matchSimulation";
import type { OverAssignment } from "./tacticalMatchPlan";
import type { BowlingMiddlePlan } from "./teamTactics";

export function suggestBowlingOvers(
  bowlers: Player[],
  existing: (OverAssignment | null)[],
  middle: BowlingMiddlePlan,
): (OverAssignment | null)[] {
  const fixed = existing.map(slot => slot?.mode === "fixed" && !slot.suggested ? slot : null);
  const phaseAt = (index: number) => index < 6 ? "powerplay" : index < 15 ? "middle" : "death";
  const spin = bowlers.map(player => getBowlingFamily(player) === "spin");
  const openingRank = bowlers.map((player, index) => ({
    index,
    phaseRating: getPlayerPhaseRating(player, "bowling", "powerplay") ?? 50,
    ability: player.currentBowling,
    control: player.bowlingEconomyControl ?? 60,
  })).sort((a, b) => b.phaseRating - a.phaseRating || b.ability - a.ability || b.control - a.control);
  const openingPriority = bowlers.map((_, index) => openingRank.findIndex(entry => entry.index === index));
  const spinTarget = middle === "pace" ? 2 : middle === "spin-choke" ? 7 : 6;
  const fixedIndices = fixed.map(slot => slot ? bowlers.findIndex(p => p.id === slot.playerId) : -1);
  const reserved = bowlers.map((_, i) => fixedIndices.filter(index => index === i).length);
  const options = [...bowlers.map((_, i) => i), -1];
  const initial = { picks: [...fixedIndices], used: reserved, spinOvers: 0, score: 0 };
  let states = [initial];

  for (let over = 19; over >= 0; over--) {
    const phase = phaseAt(over);
    const quality = bowlers.map(player => {
      const rating = getPlayerPhaseRating(player, "bowling", phase) ?? 50;
      return player.currentBowling * 0.65 + rating * 1.2
        + (player.bowlingEconomyControl ?? 60) * (phase === "death" ? 0.28 : 0.16);
    });
    const next: typeof states = [];
    for (const state of states) {
      const candidates = fixed[over] ? [fixedIndices[over]] : options;
      for (const i of candidates) {
        if (!fixed[over] && i >= 0 && (state.used[i] >= 4 || state.picks[over + 1] === i || fixedIndices[over - 1] === i)) continue;
        const picks = [...state.picks];
        const used = [...state.used];
        picks[over] = i;
        let score = state.score;
        let spinOvers = state.spinOvers;
        if (i >= 0) {
          if (!fixed[over]) used[i]++;
          score += 1000 + quality[i];
          // Score over 3 too, so the reverse search retains strong opening
          // candidates before it reaches over 1.
          if (over === 2) score += Math.max(0, 100 - openingPriority[i] * 50);
          // Reward the first three overs from stronger bowlers, with a smaller
          // incentive to use their fourth when the phase matchup calls for it.
          const laterOvers = picks.slice(over + 1).filter(pick => pick === i).length;
          if (laterOvers < 3) score += Math.max(0, bowlers[i].currentBowling - 65) * 0.65;
          const phaseOvers = picks.slice(over + 1).filter((pick, j) => pick === i && phaseAt(over + 1 + j) === phase).length;
          if (phase !== "middle") score += phaseOvers === 1 ? 8 : phaseOvers >= 2 ? -25 : 0;
          // Prioritise a paired opening spell over small gains in phase fit.
          if (over === 0 && picks[2] === i) score += 200 + Math.max(0, 250 - openingPriority[i] * 125);
          if (over === 1 && picks[3] === i) score += 40;
          // A new bowler often starts the middle overs and returns for over 9.
          if (over === 6 && picks[8] === i) score += 12;
          if (over < 6 && picks[6] === i && !picks.slice(over + 1, 6).includes(i)) score -= 10;
          // Bring an opener back at the death when their phase fit supports it.
          if (over < 4 && picks.slice(15).includes(i) && !picks.slice(over + 1, 4).includes(i)) score += 14;
          // Give the finishers a chance to alternate late, with a light
          // preference so the best matchup can still change from over to over.
          if ((over === 16 || over === 17) && picks[over + 2] === i) score += 7;
          if (over === 5) {
            const middleRating = getPlayerPhaseRating(bowlers[i], "bowling", "middle") ?? 50;
            const powerplayRating = getPlayerPhaseRating(bowlers[i], "bowling", "powerplay") ?? 50;
            score += Math.max(0, middleRating - powerplayRating) * 0.8;
            if (picks[7] === i) score += 10;
          }
          if (state.picks[over + 2] === i && state.picks[over + 4] === i) {
            score -= state.picks[over + 6] === i ? 110 : 35;
          }
          if (phase === "middle" && spin[i]) {
            score += spinOvers < spinTarget ? (middle === "pace" ? 3 : 14) : -12;
            spinOvers++;
          } else if (phase === "middle" && middle === "pace") {
            score += 9;
          }
        }
        next.push({ picks, used, spinOvers, score });
      }
    }
    states = next.sort((a, b) => b.score - a.score).slice(0, 240);
  }

  const picks = states[0].picks;
  return picks.map((pick, over) => {
    if (fixed[over]) return fixed[over];
    if (pick < 0) return null;
    const phase = phaseAt(over);
    const phaseCount = picks.filter((other, index) => other === pick && phaseAt(index) === phase).length;
    const mode = phase !== "middle" && phaseCount >= 2 ? "fixed" : "preferred";
    return { playerId: bowlers[pick].id, mode, suggested: true };
  });
}
