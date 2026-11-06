import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Player, Team } from "../lib/types";
import { buildAiMatchLineups } from "../lib/logic/aiLineupSelector";
import { getDefaultCuratorPitch, getHomeStadium } from "../lib/data/pitchCurator";
import { generateBalancedLeagueFixtures, generateKnockoutFixtures } from "../lib/logic/leagueSchedule";
import { simulateInstantMatch, simulatePlayableMatch, type MatchSimulationInput, type MatchTeamPlans } from "../lib/logic/matchSimulation";
import { calculateGroundScoringImpact, calculateOutfieldSpeedRating, getDefaultOutfieldSettings } from "../lib/logic/stadiumManagement";
import { createTeamTactics } from "../lib/logic/teamTactics";
import { fetchPlayersFromSupabase } from "../lib/supabase/fetchPlayers";
import { fetchTeamsFromSupabase } from "../lib/supabase/fetchTeams";

async function main() {
  const runSeed = process.env.AUDIT_SEED || "league-realism-20261102";
  const snapshotPath = process.env.AUDIT_INPUT ?? "calibration/results/league-realism-input.json";
  let players: Player[], teams: Team[];
  if (existsSync(snapshotPath)) {
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
    if (snapshot.version !== 1 || !Array.isArray(snapshot.players) || !Array.isArray(snapshot.teams)) {
      throw new Error(`Invalid audit snapshot: ${snapshotPath}`);
    }
    ({ players, teams } = snapshot);
  } else {
    [players, teams] = await Promise.all([fetchPlayersFromSupabase(), fetchTeamsFromSupabase()]);
    if (!players.length || teams.length !== 10) throw new Error("Expected player data and 10 IPL teams");
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), players, teams }, null, 2));
  }
  if (!players.length || teams.length !== 10) throw new Error("Expected player data and 10 IPL teams");
  const inputHash = createHash("sha256").update(JSON.stringify({ players, teams })).digest("hex");
  if (process.env.AUDIT_FETCH_ONLY === "1") {
    console.log(JSON.stringify({ snapshotPath, inputHash, players: players.length, teams: teams.length }));
    return;
  }

  const variant = process.env.AUDIT_VARIANT ?? "baseline";
  const mode = process.env.AUDIT_MODE ?? "instant";
  const detailed = process.env.AUDIT_DETAILS === "1";
  if (!["baseline", "aggression50", "bowling100", "bowling60"].includes(variant)) throw new Error(`Unknown audit variant: ${variant}`);
  if (!["instant", "playable"].includes(mode)) throw new Error(`Unknown audit mode: ${mode}`);
  const outputPath = process.env.AUDIT_OUTPUT ?? `calibration/results/league-realism-${variant}-${mode}.json`;

  const playerById = Object.fromEntries(players.map((player) => [player.id, player]));
  const teamById = Object.fromEntries(teams.map((team) => [
    team.id,
    { ...team, squad: players.filter((player) => player.currentTeamId === team.id).map((player) => player.id) },
  ]));
  const plansByTeam = Object.fromEntries(teams.map((team) => {
    const squad = teamById[team.id].squad.map((id) => playerById[id]);
    const selection = buildAiMatchLineups(squad);
    const plan = (mode: "battingFirst" | "bowlingFirst") => {
      const lineup = selection[mode];
      return {
        startingXI: lineup.startingXI,
        impactSubs: lineup.impactPlayerId ? [lineup.impactPlayerId] : [],
        plannedImpactPlayerId: lineup.impactPlayerId,
        plannedOutgoingPlayerId: lineup.likelyOutgoingPlayerId,
        plannedImpactBattingPosition: lineup.impactBattingPosition,
        captainId: lineup.captainId,
        viceCaptainId: lineup.viceCaptainId,
      };
    };
    return [team.id, {
      teamId: team.id,
      battingFirst: plan("battingFirst"),
      bowlingFirst: plan("bowlingFirst"),
      tactics: createTeamTactics("Balanced"),
      isUserControlled: false,
    } satisfies MatchTeamPlans];
  }));

  for (const p of players) { if (variant === "aggression50") p.battingAggression = 50; if (variant === "bowling100") p.currentBowling = 100; if (variant === "bowling60") p.currentBowling = 60; }
  const seasons: any[] = [];
  const count = Number(process.env.AUDIT_SEASONS ?? 5);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("AUDIT_SEASONS must be a positive integer");
  for (let run = 1; run <= count; run++) {
    const year = Number(process.env.AUDIT_YEAR ?? 2027), iterationSeed = `${runSeed}:audit:${run}`;
    const seasonStats: Record<string, {runs: number; matches: number}> = {};
    const batting: Record<string, any> = {}, bowling: Record<string, any> = {};
    const inningsRows: any[] = [], errors: string[] = [], dismissals: Record<string, number> = {};
    const diagnostics = { bowlingPhase: {} as Record<string, any>, battingInnings: [] as any[], venue: {} as Record<string, any> };
    const standings = Object.fromEntries(teams.map(t => [t.id, {points:0,wins:0,diff:0}]));
    let balls=0,runs=0,fours=0,sixes=0,dots=0,legal=0,extras=0,wickets=0,fifties=0,hundreds=0,maidens=0;
    const phase: Record<string, any> = {powerplay:{runs:0,balls:0,wickets:0},middle:{runs:0,balls:0,wickets:0},death:{runs:0,balls:0,wickets:0}};
    const play = (fixture: any, stage?: string) => {
      const stadium = getHomeStadium(fixture.teamA)!;
      const pitch = getDefaultCuratorPitch(fixture.teamA)!;
      const outfield = getDefaultOutfieldSettings(fixture.teamA)!;
      const input: MatchSimulationInput = {
        fixtureId: fixture.id,
        matchNumber: fixture.matchNumber,
        date: fixture.date,
        time: fixture.time,
        seed: `${year}:${iterationSeed}:${fixture.id}`,
        teamA: teamById[fixture.teamA],
        teamB: teamById[fixture.teamB],
        players: playerById,
        teamAPlans: plansByTeam[fixture.teamA],
        teamBPlans: plansByTeam[fixture.teamB],
        stage,
        isKnockout: Boolean(stage),
        conditions: {
          homeTeamId: fixture.teamA,
          stadiumId: stadium.id,
          stadiumName: stadium.name,
          pitch,
          boundaries: stadium.defaultBoundaryDimensions,
          outfield,
          outfieldSpeedRating: calculateOutfieldSpeedRating(fixture.teamA, outfield),
          adjustedExpectedScore: pitch.expectedFirstInningsScore,
          groundScoringModifier: calculateGroundScoringImpact(fixture.teamA, stadium.defaultBoundaryDimensions, outfield).modifier,
          chasingScoringBonus: 0,
        },
        seasonBattingStats: seasonStats,
      };
      const instant = simulateInstantMatch(input);
      const result = mode === "playable"
        ? (() => {
            const playable = simulatePlayableMatch(input, fixture.teamA, {
              tossDecision: instant.tossDecision,
              tossResultAcknowledged: true,
              deliveryControls: {}, bowlerByOver: {}, batterByWicket: {},
            }, 10000);
            if (!playable.complete || !playable.simulation) throw new Error(`Playable match did not complete: ${fixture.id}`);
            return playable.simulation;
          })()
        : instant;

      for (const inn of result.innings) {
        inningsRows.push({runs:inn.runs,wickets:inn.wickets,balls:inn.legalBalls,first:inn.inningsNumber===1});
        runs+=inn.runs; wickets+=inn.wickets; extras+=inn.extras.total;
        const batRuns=inn.batting.reduce((s,b)=>s+b.runs,0);
        if(batRuns+inn.extras.total!==inn.runs)errors.push("innings total");
        if(inn.bowling.reduce((s,b)=>s+b.balls,0)!==inn.legalBalls)errors.push("bowling balls");
        if(inn.bowling.reduce((s,b)=>s+b.runsConceded,0)!==inn.runs-inn.extras.byes-inn.extras.legByes)errors.push("conceded runs");
        for(const b of inn.batting){
          if(b.didNotBat)continue;
          const a=batting[b.id]??={id:b.id,name:b.name,team:inn.battingTeamId,aggression:playerById[b.id]?.battingAggression,ability:playerById[b.id]?.currentBatting,runs:0,balls:0,outs:0,innings:0,fours:0,sixes:0,fifties:0,hundreds:0};
          a.runs+=b.runs;a.balls+=b.balls;a.outs+=b.notOut?0:1;a.innings++;a.fours+=b.fours;a.sixes+=b.sixes;
          if (detailed) diagnostics.battingInnings.push({ id:b.id, name:b.name, ability:a.ability, aggression:a.aggression, runs:b.runs, balls:b.balls, notOut:b.notOut, position:inn.batting.indexOf(b)+1, first:inn.inningsNumber===1, opposition:inn.bowlingTeamId });
          if(b.runs>=100){a.hundreds++;hundreds++;}else if(b.runs>=50){a.fifties++;fifties++;}
          balls+=b.balls;fours+=b.fours;sixes+=b.sixes;
          const p=seasonStats[b.id]??={runs:0,matches:0};p.runs+=b.runs;p.matches++;
          if(b.dismissalKind)dismissals[b.dismissalKind]=(dismissals[b.dismissalKind]??0)+1;
        }
        for(const b of inn.bowling){
          const a=bowling[b.id]??={id:b.id,name:b.name,team:inn.bowlingTeamId,ability:playerById[b.id]?.currentBowling,balls:0,runs:0,wickets:0,innings:0,maidens:0,dots:0};
          a.balls+=b.balls;a.runs+=b.runsConceded;a.wickets+=b.wickets;a.innings++;a.maidens+=b.maidens;maidens+=b.maidens;
        }
        for(const over of inn.oversDetail)for(const d of over.deliveries){
          const p=phase[d.overNumber<=6?"powerplay":d.overNumber<=16?"middle":"death"];
          p.runs+=d.totalRuns;if(d.wicket)p.wickets++;if(d.isLegal){legal++;p.balls++;if(d.totalRuns===0){dots++;bowling[d.bowlerId].dots++;}}
          if (detailed) {
            const phaseName=d.overNumber<=6?"powerplay":d.overNumber<=16?"middle":"death";
            const key=`${d.bowlerId}:${d.overNumber}:${inn.inningsNumber}`;
            const row=diagnostics.bowlingPhase[key]??={id:d.bowlerId,name:d.bowlerName,ability:playerById[d.bowlerId]?.currentBowling,phase:phaseName,over:d.overNumber,first:inn.inningsNumber===1,balls:0,runs:0,fours:0,sixes:0};
            row.balls+=Number(d.isLegal);row.runs+=d.totalRuns-d.extras.byes-d.extras.legByes;row.fours+=Number(d.runsOffBat===4);row.sixes+=Number(d.runsOffBat===6);
            const venue=diagnostics.venue[fixture.teamA]??={balls:0,runs:0,fours:0,sixes:0};
            venue.balls+=Number(d.isLegal);venue.runs+=d.totalRuns;venue.fours+=Number(d.runsOffBat===4);venue.sixes+=Number(d.runsOffBat===6);
          }
        }
      }
      if(!stage){if(result.winnerId){standings[result.winnerId].points+=2;standings[result.winnerId].wins++;}
      for(const inn of result.innings){standings[inn.battingTeamId].diff+=inn.runs;standings[inn.bowlingTeamId].diff-=inn.runs;}}
      return result.winnerId??fixture.teamA;
    };
    const fixtures=generateBalancedLeagueFixtures(teams.map(t=>t.id),year,"RCB",iterationSeed);
    for(const f of fixtures)play(f);
    const top=Object.keys(standings).sort((a,b)=>standings[b].points-standings[a].points||standings[b].diff-standings[a].diff).slice(0,4);
    const ko=generateKnockoutFixtures(fixtures.at(-1)!.date,year,top);
    const q1=play(ko[0],"qualifier1"),elim=play(ko[1],"eliminator");
    const q2=play({...ko[2],teamA:top[0]===q1?top[1]:top[0],teamB:elim},"qualifier2");
    play({...ko[3],teamA:q1,teamB:q2},"final");
    const b=Object.values(batting).map((a:any)=>({...a,sr:a.balls?a.runs*100/a.balls:null,avg:a.outs?a.runs/a.outs:null}));
    const w=Object.values(bowling).map((a:any)=>({...a,econ:a.balls?a.runs*6/a.balls:null,avg:a.wickets?a.runs/a.wickets:null,sr:a.wickets?a.balls/a.wickets:null,dotRate:a.balls?a.dots*100/a.balls:null}));
    const first=inningsRows.filter(i=>i.first);
    const battingByAggression = aggregateBands(b, [
      { label: "1–49", min: 1, max: 49 }, { label: "50–64", min: 50, max: 64 },
      { label: "65–79", min: 65, max: 79 }, { label: "80–94", min: 80, max: 94 },
      { label: "95–98", min: 95, max: 98 }, { label: "99", min: 99, max: 99 },
    ], "aggression");
    const bowlingByAbility = aggregateBands(w, [
      { label: "Below 70", min: 0, max: 69.999 }, { label: "70–79", min: 70, max: 79.999 },
      { label: "80–89", min: 80, max: 89.999 }, { label: "90+", min: 90, max: 1000 },
    ], "ability");
    const summary={run,matches:74,firstInningsAverage:first.reduce((s,i)=>s+i.runs,0)/first.length,overallRR:runs*6/legal,batSR:(runs-extras)*100/balls,dotPct:dots*100/legal,fours,sixes,fifties,hundreds,maidens,extrasPerInnings:extras/148,wicketsPerInnings:wickets/148,first200:first.filter(i=>i.runs>=200).length,first250:first.filter(i=>i.runs>=250).length,firstUnder150:first.filter(i=>i.runs<150).length,allOuts:inningsRows.filter(i=>i.wickets===10).length,bestEconomy:w.filter(a=>a.balls>=180).sort((a,b)=>a.econ-b.econ).slice(0,5),topRuns:[...b].sort((a,b)=>b.runs-a.runs).slice(0,5),topWickets:[...w].sort((a,b)=>b.wickets-a.wickets).slice(0,5),qualifiedSR:b.filter(a=>a.balls>=200).map(a=>a.sr).sort((a,b)=>a-b),phase,dismissals,errors:errors.length,battingByAggression,bowlingByAbility};
    seasons.push({summary,batting:b,bowling:w,innings:inningsRows,errors,...(detailed ? {diagnostics} : {})});
    console.log(JSON.stringify({variant,mode,run,rr:summary.overallRR,bestEcon:summary.bestEconomy[0]?.econ,first:summary.firstInningsAverage,wickets:summary.wicketsPerInnings,maidens:summary.maidens}));
    mkdirSync(dirname(outputPath),{recursive:true});
    writeFileSync(outputPath,JSON.stringify({seed:runSeed,count,completedSeasons:seasons.length,variant,mode,inputHash,snapshotPath,method:"Fixed input snapshot and AI XIs; Balanced tactics; default home venues; 70 league + 4 playoffs; no career progression. Playable mode uses automatic choices with the same toss decision as instant mode.",seasons},null,2));
    if (errors.length) throw new Error(`Season ${run} failed ${errors.length} scorecard arithmetic checks; see ${outputPath}`);
  }
}

/** Rates use pooled balls, rather than averaging short and long player spells. */
function aggregateBands(
  rows: Array<{ runs: number; balls: number; outs?: number; wickets?: number; aggression?: number; ability?: number }>,
  bands: Array<{ label: string; min: number; max: number }>,
  field: "aggression" | "ability",
) {
  return bands.map(({ label, min, max }) => {
    const group = rows.filter(row => {
      const value = row[field] ?? (field === "aggression" ? 65 : 0);
      return value >= min && value <= max;
    });
    const totals = group.reduce<{ runs: number; balls: number; outs: number; wickets: number }>((acc, row) => ({
      runs: acc.runs + row.runs, balls: acc.balls + row.balls,
      outs: acc.outs + (row.outs ?? 0), wickets: acc.wickets + (row.wickets ?? 0),
    }), { runs: 0, balls: 0, outs: 0, wickets: 0 });
    return {
      band: label, players: group.length, ...totals,
      strikeRate: field === "aggression" && totals.balls ? 100 * totals.runs / totals.balls : null,
      economy: field === "ability" && totals.balls ? 6 * totals.runs / totals.balls : null,
      runsPerDismissal: totals.outs ? totals.runs / totals.outs : null,
      ballsPerWicket: totals.wickets ? totals.balls / totals.wickets : null,
    };
  });
}
main().catch(e=>{console.error(e);process.exitCode=1;});
