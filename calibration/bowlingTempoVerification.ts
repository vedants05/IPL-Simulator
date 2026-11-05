import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import type { Player, Team } from "../lib/types";
import { HOME_STADIUMS, type CuratorPitch } from "../lib/data/pitchCurator";
import { getDefaultOutfieldSettings } from "../lib/logic/stadiumManagement";
import {
  simulateInstantMatch,
  simulatePlayableMatch,
  type MatchInnings,
  type MatchSimulationInput,
  type MatchTeamPlans,
  type PlayableMatchDecisions,
} from "../lib/logic/matchSimulation";
import { createTeamTactics } from "../lib/logic/teamTactics";

// Fixed XIs and paired seeds isolate opponent bowling ability from lineup selection.
// Both complete innings are simulated; measured batting is A's same six specialists.
// Run BOWLING_TEMPO_MODE=playable (or both) to verify the interactive engine too.
const samples = Number(process.env.BOWLING_TEMPO_SAMPLES ?? 200);
assert.ok(Number.isInteger(samples) && samples > 0, "BOWLING_TEMPO_SAMPLES must be a positive integer");
const requestedMode = process.env.BOWLING_TEMPO_MODE ?? "instant";
assert.ok(["instant", "playable", "both"].includes(requestedMode), "Unknown bowling tempo mode");
const modes = requestedMode === "both" ? ["instant", "playable"] as const : [requestedMode];
const bowlingAbilities = [60, 82, 94];
const aggressions = [40, 65, 85, 99];
const stadium = HOME_STADIUMS[0];
const outfield = getDefaultOutfieldSettings(stadium.teamId)!;
const pitch: CuratorPitch = {
  id: "bowling-tempo-neutral",
  name: "Neutral calibration surface",
  type: "Balanced",
  characteristics: [],
  expectedFirstInningsScore: { min: 185, max: 185 },
  favours: [],
  doesNotFavour: [],
};

function fixturePlayers(bowlingAbility: number, aggression: number): Record<string, Player> {
  return Object.fromEntries(["A", "B"].flatMap(side => Array.from({ length: 11 }, (_, index) => {
    const id = `${side}-${index}`;
    const isBatter = index < 6;
    const isSpinner = index >= 9;
    const player = {
      id, name: id, currentTeamId: side, age: 25, country: "India", nationality: "Indian",
      role: isBatter ? (index === 2 ? "WK-Batsman" : "Batsman") : isSpinner ? "Spin Bowler" : "Pace Bowler",
      battingStyle: "Right-hand", bowlingStyle: isSpinner ? "Spinner" : "Pacer", bowlingHand: "Right-hand",
      bowlingUsage: isBatter ? "does_not_bowl" : "frontline",
      currentBatting: isBatter ? 82 : 40,
      currentBowling: isBatter ? 15 : side === "B" ? bowlingAbility : 82,
      potentialBatting: 95, potentialBowling: 95,
      battingAggression: side === "A" && isBatter ? aggression : 65,
      battingConsistency: 50, bowlingConsistency: 50, pressureRating: 50, bigMatchRating: 50,
      paceRating: 50, spinRating: 50, stamina: 50, captaincy: 50,
      fieldingRating: 75, wicketkeepingRating: 75,
      powerplayBatting: 50, middleOversBatting: 50, deathBatting: 50,
      powerplayBowling: 50, middleOversBowling: 50, deathBowling: 50,
      isOpener: index < 2, isWicketkeeper: index === 2, reputation: 5,
    } as Player;
    return [id, player];
  })));
}

function assertScorecardArithmetic(innings: MatchInnings): void {
  const total = (rows: number[]) => rows.reduce((sum, value) => sum + value, 0);
  assert.equal(total(innings.batting.map(row => row.runs)) + innings.extras.total, innings.runs,
    "Batter runs plus extras must equal the innings total");
  assert.equal(total(innings.bowling.map(row => row.balls)), innings.legalBalls,
    "Bowler workloads must add up to legal innings balls");
  assert.equal(total(innings.bowling.map(row => row.runsConceded)),
    innings.runs - innings.extras.byes - innings.extras.legByes,
    "Bowling economy must exclude byes and leg-byes but include wides/no-balls");
  assert.equal(innings.batting.filter(row => !row.didNotBat && !row.notOut).length, innings.wickets,
    "Dismissed batters must match the innings wicket count");
}

interface Result {
  mode: string;
  bowlingAbility: number;
  aggression: number;
  samples: number;
  strikeRate: number;
  economy: number;
  runsPerDismissal: number;
  ballsPerDismissal: number;
  boundaryRunShare: number;
  bowlerWicketsPer100Balls: number;
  meanTeamRuns: number;
  meanTeamWickets: number;
}
const results: Result[] = [];
for (const mode of modes) for (const bowlingAbility of bowlingAbilities) for (const aggression of aggressions) {
  const players = fixturePlayers(bowlingAbility, aggression);
  const team = (id: string) => ({ id, name: id, squad: Object.keys(players).filter(key => key.startsWith(`${id}-`)) } as Team);
  const plan = (id: string): MatchTeamPlans => {
    const lineup = { startingXI: team(id).squad, impactSubs: [] };
    return { teamId: id, isUserControlled: true, tactics: createTeamTactics("Balanced"), battingFirst: lineup, bowlingFirst: lineup };
  };
  let runs = 0, balls = 0, dismissals = 0, boundaryRuns = 0;
  let conceded = 0, bowlingBalls = 0, bowlerWickets = 0, teamRuns = 0, teamWickets = 0;
  for (let sample = 0; sample < samples; sample++) {
    const input: MatchSimulationInput = {
      fixtureId: `bowling-tempo-${sample}`, matchNumber: sample + 1,
      seed: `2027:bowling-tempo-paired:${sample}`,
      teamA: team("A"), teamB: team("B"), players, teamAPlans: plan("A"), teamBPlans: plan("B"),
      conditions: {
        homeTeamId: "A", stadiumId: stadium.id, stadiumName: stadium.name,
        pitch, boundaries: { straightMetres: 69, wideMetres: 69 }, outfield,
        outfieldSpeedRating: 7.5, adjustedExpectedScore: { min: 185, max: 185 },
        groundScoringModifier: 0, chasingScoringBonus: 0,
      },
      weatherScenario: { kind: "clear", rainDelayMinutes: 0, firstInningsOvers: 20, secondInningsOvers: 20, summary: "Clear" },
    };
    const instant = simulateInstantMatch(input);
    const decisions: PlayableMatchDecisions = {
      tossDecision: instant.tossDecision, tossResultAcknowledged: true,
      deliveryControls: {}, bowlerByOver: {}, batterByWicket: {},
    };
    const played = mode === "playable" ? simulatePlayableMatch(input, "A", decisions, 10000) : undefined;
    if (played) assert.ok(played.complete && played.simulation, "Automatic playable decisions must finish the match");
    const match = played?.simulation ?? instant;
    if (sample === 0 && mode === "playable") {
      const replay = simulatePlayableMatch(input, "A", decisions, 10000);
      assert.deepEqual(replay.simulation?.innings, match.innings, "Playable results must replay deterministically");
    }
    match.innings.forEach(assertScorecardArithmetic);
    const innings = match.innings.find(entry => entry.battingTeamId === "A")!;
    teamRuns += innings.runs;
    teamWickets += innings.wickets;
    for (const row of innings.batting.filter(row => Number(row.id.split("-")[1]) < 6)) {
      runs += row.runs;
      balls += row.balls;
      dismissals += Number(!row.didNotBat && !row.notOut);
      boundaryRuns += row.fours * 4 + row.sixes * 6;
    }
    for (const row of innings.bowling) {
      conceded += row.runsConceded;
      bowlingBalls += row.balls;
      bowlerWickets += row.wickets;
    }
  }
  assert.ok(balls > 0 && dismissals > 0 && bowlingBalls > 0);
  const result: Result = {
    mode, bowlingAbility, aggression, samples,
    strikeRate: 100 * runs / balls,
    economy: 6 * conceded / bowlingBalls,
    runsPerDismissal: runs / dismissals,
    ballsPerDismissal: balls / dismissals,
    boundaryRunShare: boundaryRuns / runs,
    bowlerWicketsPer100Balls: 100 * bowlerWickets / bowlingBalls,
    meanTeamRuns: teamRuns / samples,
    meanTeamWickets: teamWickets / samples,
  };
  results.push(result);
  console.log(JSON.stringify(result));
}
if (process.env.BOWLING_TEMPO_OUTPUT) writeFileSync(process.env.BOWLING_TEMPO_OUTPUT, JSON.stringify(results, null, 2));

for (const mode of modes) {
  for (const aggression of aggressions) {
    const band = results.filter(row => row.mode === mode && row.aggression === aggression);
    for (let index = 1; index < band.length; index++) {
      const weaker = band[index - 1], stronger = band[index];
      const context = `${mode}, aggression ${aggression}, bowling ${weaker.bowlingAbility} -> ${stronger.bowlingAbility}`;
      assert.ok(stronger.strikeRate < weaker.strikeRate, `Better bowling must reduce opposition SR (${context})`);
      assert.ok(stronger.economy < weaker.economy, `Better bowling must reduce conceded runs per legal ball (${context})`);
      assert.ok(stronger.runsPerDismissal < weaker.runsPerDismissal, `Better bowling must reduce runs per dismissal (${context})`);
    }
    assert.ok(band[2].strikeRate < band[0].strikeRate * 0.9,
      `Elite bowling must provide meaningful scoring suppression (${mode}, aggression ${aggression})`);
    assert.ok(band[2].bowlerWicketsPer100Balls > band[0].bowlerWicketsPer100Balls,
      `Elite control must retain a wicket-taking advantage (${mode}, aggression ${aggression})`);
  }
  for (const bowlingAbility of bowlingAbilities) {
    const band = results.filter(row => row.mode === mode && row.bowlingAbility === bowlingAbility);
    for (let index = 1; index < band.length; index++) {
      assert.ok(band[index].strikeRate > band[index - 1].strikeRate,
        `Aggression must retain its tempo ordering (${mode}, bowling ${bowlingAbility})`);
    }
    assert.ok(band[3].ballsPerDismissal < band[0].ballsPerDismissal,
      `Higher aggression must spend the batting run budget faster (${mode}, bowling ${bowlingAbility})`);
    assert.ok(band[3].boundaryRunShare > band[0].boundaryRunShare,
      `Higher aggression must retain a boundary-heavy identity (${mode}, bowling ${bowlingAbility})`);
  }
}
console.log(`Bowling control, aggression identity, and scorecard arithmetic passed across ${results.length * samples} full matches.`);
