import type { MatchInnings, MatchSimulationRecord } from "./matchSimulation";

type Batter = { id?: string; name: string; balls?: number; dismissal?: string; didNotBat?: boolean };

/** Use the recorded innings, never the team's present-day squad. */
export function splitScorecardBatters<T extends Batter>(
  batting: readonly T[],
  innings?: MatchInnings,
  simulation?: MatchSimulationRecord,
): { batted: T[]; yetToBat: T[] } {
  const appeared = new Set(innings?.partnerships?.flatMap(partnership => partnership.batterIds) ?? []);
  const lineup = innings && simulation?.lineups?.[innings.battingTeamId];
  const eligible = innings?.inningsNumber === 2 && lineup?.finalXI?.length
    ? new Set(lineup.finalXI)
    : null;
  const batted: T[] = [];
  const yetToBat: T[] = [];
  for (const batter of batting) {
    const hasBatted = (batter.id && appeared.has(batter.id))
      || (batter.balls ?? 0) > 0
      || (batter.didNotBat === false)
      || Boolean(batter.dismissal && batter.dismissal.toLowerCase() !== "did not bat");
    if (hasBatted) batted.push(batter);
    else if (!eligible || !batter.id || eligible.has(batter.id)) yetToBat.push(batter);
  }
  return { batted, yetToBat };
}
