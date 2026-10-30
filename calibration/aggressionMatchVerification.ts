import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import type { Player, Team } from '../lib/types';
import { HOME_STADIUMS, getDefaultCuratorPitch } from '../lib/data/pitchCurator';
import { getDefaultOutfieldSettings } from '../lib/logic/stadiumManagement';
import { simulateInstantMatch, simulatePlayableMatch, battingAggressionScoringProfile, type MatchSimulationInput } from '../lib/logic/matchSimulation';
import { createTeamTactics } from '../lib/logic/teamTactics';

// Synthetic fixtures: these are controlled ability bands, not live player data.
const samples = Number(process.env.AGGRESSION_SAMPLES ?? 100);
const playable = process.env.AGGRESSION_MODE === 'playable';
const stadium = HOME_STADIUMS[0];
const pitch = getDefaultCuratorPitch(stadium.teamId)!;
const outfield = getDefaultOutfieldSettings(stadium.teamId)!;
const results: Record<string, number>[] = [];
for (const ability of [75, 82, 90]) {
  for (const aggression of [40, 65, 85, 95, 99]) {
    const players: Record<string, Player> = {};
    for (const side of ['A', 'B']) for (let i = 0; i < 11; i++) {
      const id = `${side}-${i}`;
      players[id] = {
        id, name: id, country: 'India', age: 25, nationality: 'Indian',
        role: i < 6 ? 'Batsman' : i === 10 ? 'Spin Bowler' : 'Pace Bowler',
        currentBatting: i < 6 ? side === 'A' ? ability : 82 : 40,
        currentBowling: i < 6 ? 15 : 82, potentialBatting: 90, potentialBowling: 90,
        battingAggression: side === 'A' && i < 6 ? aggression : 65,
        battingConsistency: 50, pressureRating: 50, bigMatchRating: 50,
        paceRating: 50, spinRating: 50, fieldingRating: 75, wicketkeepingRating: 75,
        powerplayBatting: 50, middleOversBatting: 50, deathBatting: 50,
        powerplayBowling: 50, middleOversBowling: 50, deathBowling: 50,
        isOpener: i < 2, isWicketkeeper: i === 2, battingStyle: 'Right-hand',
        bowlingStyle: i === 10 ? 'Leg Spin' : 'Right-arm Fast', reputation: 5,
      } as unknown as Player;
    }
    const team = (id: string) => ({ id, name: id, squad: Object.keys(players).filter(key => key.startsWith(id)) } as Team);
    const plan = (id: string) => {
      const lineup = { startingXI: team(id).squad, impactSubs: [] };
      return { teamId: id, isUserControlled: true, tactics: createTeamTactics('Balanced'), battingFirst: lineup, bowlingFirst: lineup };
    };
    let runs = 0, balls = 0, dismissals = 0, boundaryRuns = 0, dots = 0, teamRuns = 0, teamWickets = 0;
    for (let i = 0; i < samples; i++) {
      const input: MatchSimulationInput = {
        fixtureId: `tempo-${i}`, matchNumber: i + 1, seed: `2027:tempo-paired:${i}`,
        teamA: team('A'), teamB: team('B'), players, teamAPlans: plan('A'), teamBPlans: plan('B'),
        conditions: { homeTeamId: 'A', stadiumId: stadium.id, stadiumName: stadium.name,
          pitch, boundaries: { straightMetres: 69, wideMetres: 69 }, outfield,
          outfieldSpeedRating: 7.5, adjustedExpectedScore: { min: 159, max: 159 }, groundScoringModifier: 0, chasingScoringBonus: 0 },
        weatherScenario: { kind: 'clear', rainDelayMinutes: 0, firstInningsOvers: 20, secondInningsOvers: 20, summary: 'Clear' },
      };
      const instant = simulateInstantMatch(input);
      const decisions = { tossDecision: instant.tossDecision, tossResultAcknowledged: true,
        deliveryControls: {}, bowlerByOver: {}, batterByWicket: {} };
      const match = playable ? simulatePlayableMatch(input, 'A', decisions, 10000).simulation! : instant;
      if (i === 0 && playable) {
        const replay = simulatePlayableMatch(input, 'A', decisions, 10000);
        assert.ok(replay.complete);
        // Playable mode has explicit field positions, so its outcomes can differ
        // from instant mode. Identical decisions must replay identically.
        assert.equal(JSON.stringify(replay.simulation!.innings), JSON.stringify(match.innings), 'playable tempo must replay deterministically');
      }
      const innings = match.innings.find(entry => entry.battingTeamId === 'A')!;
      teamRuns += innings.runs; teamWickets += innings.wickets;
      for (const row of innings.batting.filter(row => Number(row.id.split('-')[1]) < 6)) {
        runs += row.runs; balls += row.balls; dismissals += Number(!row.notOut);
        boundaryRuns += row.fours * 4 + row.sixes * 6;
      }
      for (const over of innings.oversDetail) for (const ball of over.deliveries) {
        if (Number(ball.strikerId.split('-')[1]) < 6 && ball.isLegal && ball.runsOffBat === 0) dots++;
      }
    }
    results.push({ ability, aggression, samples, targetSR: battingAggressionScoringProfile(aggression).indicativeStrikeRate,
      strikeRate: 100 * runs / balls, runsPerDismissal: runs / dismissals, ballsPerDismissal: balls / dismissals,
      boundaryRunShare: boundaryRuns / runs, dotShare: dots / balls, meanTeamRuns: teamRuns / samples, meanTeamWickets: teamWickets / samples });
    console.log(JSON.stringify(results.at(-1)));
  }
}
if (process.env.AGGRESSION_OUTPUT) writeFileSync(process.env.AGGRESSION_OUTPUT, JSON.stringify(results, null, 2));
if (process.env.AGGRESSION_ASSERT !== '0') for (const ability of [75, 82, 90]) {
  const band = results.filter(row => row.ability === ability);
  band.slice(1).forEach((row, i) => assert.ok(row.strikeRate > band[i].strikeRate, `SR must rise with aggression at ability ${ability}`));
  assert.ok(band.at(-1)!.strikeRate > 200, `99 aggression must express a 200+ style at ability ${ability}`);
  assert.ok(band.every(row => Math.abs(row.strikeRate - row.targetSR) < 8), 'neutral match SR must remain close to the target curve');
  assert.ok(band.every(row => row.meanTeamRuns > 90 && row.meanTeamRuns < 240 && row.meanTeamWickets >= 2 && row.meanTeamWickets <= 10), 'team outcomes must stay plausible');
  assert.ok(band.at(-1)!.ballsPerDismissal < band[0].ballsPerDismissal, 'aggressive batters must use fewer balls');
  assert.ok(band.at(-1)!.boundaryRunShare > band[0].boundaryRunShare, 'high aggression must retain a boundary-heavy style');
}
if (process.env.AGGRESSION_ASSERT !== '0') for (const aggression of [40, 65, 85, 95, 99]) {
  const band = results.filter(row => row.aggression === aggression);
  assert.ok(band[0].runsPerDismissal < band[1].runsPerDismissal && band[1].runsPerDismissal < band[2].runsPerDismissal,
    'batting ability must still determine productivity at every aggression level');
}
