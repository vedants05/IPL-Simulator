export interface QualificationStanding {
  teamId: string;
  points: number;
  nrr: number;
}

export interface QualificationFixture {
  id: string;
  teamA: string;
  teamB: string;
  played: boolean;
  stage?: string;
}

/**
 * Returns match importance per participating team. This deliberately uses
 * only mathematically certain point states: a loss must make a top-four finish
 * impossible, while a win must leave it possible. Last-match NRR contests are
 * promoted to the stronger 0.9 tier.
 */
export function qualificationImportanceForFixture(
  fixture: QualificationFixture,
  fixtures: readonly QualificationFixture[],
  standings: readonly QualificationStanding[],
): Record<string, number> {
  if (fixture.stage || fixture.played) return {};
  const standingByTeam = new Map(standings.map((standing) => [standing.teamId, standing]));
  const result: Record<string, number> = {};

  for (const teamId of [fixture.teamA, fixture.teamB]) {
    const standing = standingByTeam.get(teamId);
    if (!standing) continue;
    const matchesAfterThis = fixtures.filter((candidate) => (
      !candidate.played
      && !candidate.stage
      && candidate.id !== fixture.id
      && (candidate.teamA === teamId || candidate.teamB === teamId)
    )).length;
    const maximumAfterLoss = standing.points + matchesAfterThis * 2;
    const maximumAfterWin = maximumAfterLoss + 2;
    const opponentsBeyondLoss = standings.filter((candidate) => (
      candidate.teamId !== teamId && candidate.points > maximumAfterLoss
    )).length;
    const opponentsBeyondWin = standings.filter((candidate) => (
      candidate.teamId !== teamId && candidate.points > maximumAfterWin
    )).length;
    const lossEliminatesButWinKeepsAlive = opponentsBeyondLoss >= 4 && opponentsBeyondWin < 4;
    if (!lossEliminatesButWinKeepsAlive) continue;

    const currentFourth = [...standings]
      .sort((left, right) => right.points - left.points || right.nrr - left.nrr)[3];
    const lastLeagueMatch = matchesAfterThis === 0;
    const nrrRequired = Boolean(
      lastLeagueMatch
      && currentFourth
      && maximumAfterWin === currentFourth.points
      && standing.nrr < currentFourth.nrr,
    );
    result[teamId] = lastLeagueMatch || nrrRequired ? 0.9 : 0.8;
  }
  return result;
}
