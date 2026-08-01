import fs from "node:fs";
import path from "node:path";
import { mapRowsToPlayers } from "../lib/supabase/fetchPlayers";
import { fetchTeamsFromSupabase } from "../lib/supabase/fetchTeams";
import { useGameStore } from "../lib/store/gameStore";
import type { Player, Team } from "../lib/types";

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const describe = (teams: Record<string, Team>, players: Record<string, Player>) =>
  Object.values(teams).map((team) => {
    const squad = team.squad.map((id) => players[id]).filter((player): player is Player => Boolean(player));
    return {
      team: team.id,
      size: squad.length,
      indian: squad.filter((player) => player.nationality === "Indian").length,
      overseas: squad.filter((player) => player.nationality === "Overseas").length,
      batters: squad.filter((player) => player.role === "Batsman" || player.role === "WK-Batsman").length,
      bowlers: squad.filter((player) => player.role === "Pace Bowler" || player.role === "Spin Bowler").length,
      allRounders: squad.filter((player) => player.role === "All-Rounder").length,
      trackedOverseas: team.overseasPlayersCurrent,
      purse: team.remainingPurse,
    };
  });

async function main() {
  const rows = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts", ".player_cache.json"), "utf8"));
  const sourcePlayers = mapRowsToPlayers(rows);
  const sourceTeams = await fetchTeamsFromSupabase();
  const originalRandom = Math.random;
  const reports = [];

  try {
    for (let run = 0; run < 5; run += 1) {
      Math.random = seededRandom(0x202800 + run * 7919);
      const players = Object.fromEntries(sourcePlayers.map((player) => [player.id, {
        ...player,
        isRetained: false,
        retainedByTeamId: null,
      }]));
      const teams = Object.fromEntries(sourceTeams.map((team) => {
        const squad = sourcePlayers.filter((player) => player.currentTeamId === team.id).map((player) => player.id);
        return [team.id, {
          ...team,
          squad,
          retainedPlayers: [],
          remainingPurse: 12_000,
          spentAmount: 0,
          minSquadSize: 18,
          softSquadTarget: 24,
          overseasPlayersCurrent: squad.filter((id) => players[id]?.nationality === "Overseas").length,
        }];
      }));
      useGameStore.setState({
        currentSeason: 2027,
        auctionCycle: 1,
        lastRolledOverSeason: null,
        userTeamId: sourceTeams[run % sourceTeams.length].id,
        players,
        teams,
        auction: { type: "mega", season: 2027, phase: "retention" } as never,
      });
      if (!useGameStore.getState().completeOffseasonAutomatically()) throw new Error(`run ${run + 1}: first auction failed`);
      const first = describe(useGameStore.getState().teams, useGameStore.getState().players);
      if (!useGameStore.getState().beginNextSeasonRetention()) throw new Error(`run ${run + 1}: rollover failed`);
      if (!useGameStore.getState().completeOffseasonAutomatically()) throw new Error(`run ${run + 1}: second auction failed`);
      const second = describe(useGameStore.getState().teams, useGameStore.getState().players);
      reports.push({ run: run + 1, first, second });
    }
  } finally {
    Math.random = originalRandom;
  }
  const summarise = (key: "first" | "second") => {
    const squads = reports.flatMap((report) => report[key]);
    const average = (field: "size" | "indian" | "overseas" | "batters" | "bowlers" | "allRounders" | "purse") =>
      Number((squads.reduce((total, squad) => total + squad[field], 0) / squads.length).toFixed(2));
    return {
      averageSize: average("size"),
      sizeRange: [Math.min(...squads.map((squad) => squad.size)), Math.max(...squads.map((squad) => squad.size))],
      averageIndian: average("indian"),
      averageOverseas: average("overseas"),
      overseasRange: [Math.min(...squads.map((squad) => squad.overseas)), Math.max(...squads.map((squad) => squad.overseas))],
      squadsWithSixToEightOverseas: squads.filter((squad) => squad.overseas >= 6 && squad.overseas <= 8).length,
      averageBatters: average("batters"),
      averageBowlers: average("bowlers"),
      averageAllRounders: average("allRounders"),
      averagePurse: average("purse"),
      staleOverseasCounters: squads.filter((squad) => squad.overseas !== squad.trackedOverseas).length,
    };
  };
  process.stdout.write(`${JSON.stringify({ runs: reports.map((report) => ({
    run: report.run,
    firstAverageOverseas: Number((report.first.reduce((sum, squad) => sum + squad.overseas, 0) / 10).toFixed(1)),
    secondAverageOverseas: Number((report.second.reduce((sum, squad) => sum + squad.overseas, 0) / 10).toFixed(1)),
    secondAverageSize: Number((report.second.reduce((sum, squad) => sum + squad.size, 0) / 10).toFixed(1)),
  })), firstAuction: summarise("first"), secondAuction: summarise("second") }, null, 2)}\n`);
}

void main();
