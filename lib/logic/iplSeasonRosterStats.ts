/** IPL figures for one season, reconstructed from played fixtures rather than saved totals. */
export function deriveIplSeasonRosterStats(
  fixtures: readonly {
    id: string; played: boolean; date?: string; teamA: string; teamB: string;
    scorecard?: { inningsA: RosterInnings; inningsB: RosterInnings };
    simulation?: {
      lineups?: Record<string, { teamId: string; startingXI?: readonly string[]; finalXI?: readonly string[] }>;
      innings?: readonly (RosterInnings & { battingTeamId: string; bowlingTeamId: string })[];
    };
  }[],
  season: number,
  teamIds: ReadonlySet<string>,
): Record<string, RosterSeasonStats> {
  const result: Record<string, RosterSeasonStats> = {};
  const bowlingBalls: Record<string, number> = {};
  const seen = new Set<string>();
  const entry = (id: string, name: string, teamId: string) => (
    result[id] ??= { id, name, teamId, matches: 0, runs: 0, balls: 0, dismissals: 0,
      highestScore: 0, wickets: 0, runsConceded: 0, oversBowled: 0, bestBowling: "0/0" }
  );
  for (const fixture of fixtures) {
    if (!fixture.played || seen.has(fixture.id) || !teamIds.has(fixture.teamA) || !teamIds.has(fixture.teamB)) continue;
    if (fixture.date && Number(fixture.date.slice(0, 4)) !== season) continue;
    seen.add(fixture.id);
    const participants = new Set<string>();
    const addInnings = (innings: RosterInnings, battingTeamId: string, bowlingTeamId: string) => {
      for (const batter of innings.batting) {
        const stat = entry(batter.id, batter.name, battingTeamId);
        participants.add(batter.id);
        stat.runs += batter.runs;
        stat.balls += batter.balls;
        stat.highestScore = Math.max(stat.highestScore, batter.runs);
        if (batter.dismissal && batter.dismissal !== "not out" && batter.dismissal !== "did not bat") stat.dismissals++;
      }
      for (const bowler of innings.bowling) {
        const stat = entry(bowler.id, bowler.name, bowlingTeamId);
        participants.add(bowler.id);
        stat.wickets += bowler.wickets;
        stat.runsConceded += bowler.runsConceded;
        bowlingBalls[bowler.id] = (bowlingBalls[bowler.id] ?? 0)
          + Math.floor(bowler.overs) * 6 + Math.round((bowler.overs % 1) * 10);
        const [bestWickets, bestRuns] = stat.bestBowling.split("/").map(Number);
        if (bowler.wickets > bestWickets || (bowler.wickets === bestWickets && bowler.runsConceded < bestRuns)) {
          stat.bestBowling = `${bowler.wickets}/${bowler.runsConceded}`;
        }
      }
    };
    if (fixture.simulation?.innings?.length) {
      for (const innings of fixture.simulation.innings) {
        addInnings(innings, innings.battingTeamId, innings.bowlingTeamId);
      }
    } else if (fixture.scorecard) {
      addInnings(fixture.scorecard.inningsA, fixture.teamA, fixture.teamB);
      addInnings(fixture.scorecard.inningsB, fixture.teamB, fixture.teamA);
    }
    for (const lineup of Object.values(fixture.simulation?.lineups ?? {})) {
      for (const id of [...(lineup.startingXI ?? []), ...(lineup.finalXI ?? [])]) {
        entry(id, id, lineup.teamId);
        participants.add(id);
      }
    }
    participants.forEach((id) => { result[id].matches++; });
  }
  for (const [id, balls] of Object.entries(bowlingBalls)) {
    result[id].oversBowled = Math.floor(balls / 6) + (balls % 6) / 10;
  }
  return result;
}

interface RosterInnings {
  batting: readonly { id: string; name: string; runs: number; balls: number; dismissal: string }[];
  bowling: readonly { id: string; name: string; overs: number; runsConceded: number; wickets: number }[];
}

export interface RosterSeasonStats {
  id: string; name: string; teamId: string; matches: number; runs: number; balls: number;
  dismissals: number; highestScore: number; wickets: number; runsConceded: number;
  oversBowled: number; bestBowling: string;
}
