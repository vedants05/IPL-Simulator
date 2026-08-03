"use client";

import type { CareerRetirementRecord } from "@/lib/logic/careerLifecycle";
import type { Player, Team } from "@/lib/types";

interface NewsPageProps {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  playerStats: Record<string, {
    teamId: string;
    runs: number;
    balls: number;
    wickets: number;
    runsConceded: number;
    oversBowled: number;
    fours?: number;
    sixes?: number;
  }>;
  standings: Array<{
    teamId: string;
    teamName: string;
    shortName: string;
    played: number;
    won: number;
    lost: number;
    noResults: number;
    points: number;
    nrr: number;
  }>;
  retirements: CareerRetirementRecord[];
  retirementHistory: CareerRetirementRecord[];
  currentSeason: number;
}

const panelClass = "flex min-h-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-surface";

function ratingLabel(player: Player) {
  return Math.max(player.currentBatting, player.currentBowling);
}

function teamReport(
  position: number,
  team: NewsPageProps["standings"][number],
  stats: NewsPageProps["playerStats"],
  teamId: string,
  leagueAverages: { scoringRate: number; boundaryRate: number; wicketsPerMatch: number; economy: number },
) {
  const teamStats = Object.values(stats).filter((entry) => entry.teamId === teamId);
  const runs = teamStats.reduce((sum, entry) => sum + (entry.runs || 0), 0);
  const balls = teamStats.reduce((sum, entry) => sum + (entry.balls || 0), 0);
  const fours = teamStats.reduce((sum, entry) => sum + (entry.fours || 0), 0);
  const sixes = teamStats.reduce((sum, entry) => sum + (entry.sixes || 0), 0);
  const wickets = teamStats.reduce((sum, entry) => sum + (entry.wickets || 0), 0);
  const runsConceded = teamStats.reduce((sum, entry) => sum + (entry.runsConceded || 0), 0);
  const overs = teamStats.reduce((sum, entry) => sum + (entry.oversBowled || 0), 0);
  const scoringRate = balls > 0 ? (runs / balls) * 6 : null;
  const boundaryRate = runs > 0 ? ((fours * 4 + sixes * 6) / runs) * 100 : null;
  const wicketsPerMatch = team.played > 0 ? wickets / team.played : null;
  const economy = overs > 0 ? runsConceded / overs : null;
  const winRate = team.played > 0 ? Math.round((team.won / team.played) * 100) : 0;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (scoringRate !== null && scoringRate >= leagueAverages.scoringRate + 0.35) strengths.push(`scored quickly at ${scoringRate.toFixed(2)} runs per over`);
  if (boundaryRate !== null && boundaryRate >= leagueAverages.boundaryRate + 4) strengths.push(`found boundaries regularly (${boundaryRate.toFixed(0)}% of runs from fours and sixes)`);
  if (wicketsPerMatch !== null && wicketsPerMatch >= leagueAverages.wicketsPerMatch + 0.35) strengths.push(`took ${wicketsPerMatch.toFixed(1)} wickets per match`);
  if (economy !== null && economy <= leagueAverages.economy - 0.3) strengths.push(`controlled scoring at ${economy.toFixed(2)} runs per over`);
  if (scoringRate !== null && scoringRate <= leagueAverages.scoringRate - 0.35) weaknesses.push(`the batting scored slowly at ${scoringRate.toFixed(2)} runs per over`);
  if (boundaryRate !== null && boundaryRate <= leagueAverages.boundaryRate - 4) weaknesses.push("the batting lacked boundary pressure");
  if (wicketsPerMatch !== null && wicketsPerMatch <= leagueAverages.wicketsPerMatch - 0.35) weaknesses.push(`only took ${wicketsPerMatch.toFixed(1)} wickets per match`);
  if (economy !== null && economy >= leagueAverages.economy + 0.3) weaknesses.push(`conceded too freely at ${economy.toFixed(2)} runs per over`);

  const result = position <= 4
    ? `They converted this into a ${winRate}% win rate and a playoff finish.`
    : position >= 9
      ? `That translated into only ${winRate}% wins and left them outside the playoff places.`
      : `The mixed output produced a ${winRate}% win rate and a mid-table finish.`;
  const strengthText = strengths.length > 0 ? `Their main success came from ${strengths.slice(0, 2).join(" and ")}.` : "No single statistical area clearly separated them from the league average.";
  const weaknessText = weaknesses.length > 0 ? `The biggest concern was that ${weaknesses.slice(0, 2).join(" while ")}.` : "Their underlying numbers were balanced, so results were decided by execution in close matches.";
  return `${strengthText} ${weaknessText} ${result}`;
}

export default function NewsPage({ players, teams, playerStats, standings, retirements, retirementHistory, currentSeason }: NewsPageProps) {
  const seasonRetirements = retirementHistory.filter((retirement) => retirement.season === currentSeason);
  const displayedRetirements = seasonRetirements.length > 0 ? seasonRetirements : retirements.filter((retirement) => retirement.season === currentSeason);
  const biggestImprovements = Object.values(players)
    .map((player) => {
      const history = [...(player.careerState?.ratingHistory ?? [])].sort((a, b) => a.season - b.season);
      const previous = history.length > 1 ? history[history.length - 2] : null;
      const current = ratingLabel(player);
      const previousRating = previous ? Math.max(previous.batting, previous.bowling) : current;
      return { player, change: current - previousRating, current, previousRating };
    })
    .filter((entry) => entry.change > 0)
    .sort((a, b) => b.change - a.change || b.current - a.current)
    .slice(0, 10);

  const rankedTeams = standings.slice(0, 10);
  const leagueTeamMetrics = rankedTeams.map((team) => {
    const entries = Object.values(playerStats).filter((entry) => entry.teamId === team.teamId);
    const runs = entries.reduce((sum, entry) => sum + (entry.runs || 0), 0);
    const balls = entries.reduce((sum, entry) => sum + (entry.balls || 0), 0);
    const fours = entries.reduce((sum, entry) => sum + (entry.fours || 0), 0);
    const sixes = entries.reduce((sum, entry) => sum + (entry.sixes || 0), 0);
    const wickets = entries.reduce((sum, entry) => sum + (entry.wickets || 0), 0);
    const runsConceded = entries.reduce((sum, entry) => sum + (entry.runsConceded || 0), 0);
    const overs = entries.reduce((sum, entry) => sum + (entry.oversBowled || 0), 0);
    return {
      scoringRate: balls > 0 ? runs / balls * 6 : 0,
      boundaryRate: runs > 0 ? (fours * 4 + sixes * 6) / runs * 100 : 0,
      wicketsPerMatch: team.played > 0 ? wickets / team.played : 0,
      economy: overs > 0 ? runsConceded / overs : 0,
    };
  });
  const leagueAverages = {
    scoringRate: leagueTeamMetrics.reduce((sum, metric) => sum + metric.scoringRate, 0) / Math.max(leagueTeamMetrics.length, 1),
    boundaryRate: leagueTeamMetrics.reduce((sum, metric) => sum + metric.boundaryRate, 0) / Math.max(leagueTeamMetrics.length, 1),
    wicketsPerMatch: leagueTeamMetrics.reduce((sum, metric) => sum + metric.wicketsPerMatch, 0) / Math.max(leagueTeamMetrics.length, 1),
    economy: leagueTeamMetrics.filter((metric) => metric.economy > 0).reduce((sum, metric) => sum + metric.economy, 0) / Math.max(leagueTeamMetrics.filter((metric) => metric.economy > 0).length, 1),
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto pr-1">
      <div className="flex shrink-0 items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">League newsroom</div>
          <h1 className="mt-1 font-anton text-[30px] uppercase leading-none text-text-primary">Season {currentSeason} News</h1>
        </div>
        <div className="font-space-mono text-[8px] font-bold uppercase tracking-[0.12em] text-text-secondary">Latest career updates</div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <section className={panelClass}>
          <div className="shrink-0 border-b border-border px-5 py-4">
            <h2 className="font-anton text-[19px] uppercase text-text-primary">Retirements</h2>
            <p className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-[0.1em] text-text-secondary">Players leaving the league</p>
          </div>
          <div className="min-h-[18rem] space-y-2 overflow-y-auto p-3">
            {displayedRetirements.length === 0 ? (
              <div className="flex h-full min-h-[15rem] items-center justify-center px-5 text-center font-barlow text-sm text-text-secondary">No retirements have been recorded in Season {currentSeason}.</div>
            ) : displayedRetirements.map((retirement) => (
              <div key={`${retirement.playerId}-${retirement.season}`} className="rounded-lg border border-border bg-bg/45 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate font-barlow text-[15px] font-bold text-text-primary">{retirement.name}</span>
                  <span className="shrink-0 font-space-mono text-[9px] font-bold text-text-secondary">{retirement.age} yrs</span>
                </div>
                <div className="mt-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">{retirement.role} · final rating {retirement.rating}</div>
                <div className="mt-1 font-barlow text-xs text-text-secondary">{retirement.reason === "three-unsold-auctions" ? "Retired after three unsold auctions." : retirement.reason === "below-auction-standard" ? "Retired after falling below the auction standard." : "Retired at the end of the season."}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <div className="shrink-0 border-b border-border px-5 py-4">
            <h2 className="font-anton text-[19px] uppercase text-text-primary">Biggest Improvements</h2>
            <p className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-[0.1em] text-text-secondary">Rating movement since the last career update</p>
          </div>
          <div className="min-h-[18rem] space-y-1 overflow-y-auto p-3">
            {biggestImprovements.length === 0 ? (
              <div className="flex h-full min-h-[15rem] items-center justify-center px-5 text-center font-barlow text-sm text-text-secondary">No positive rating changes have been recorded yet.</div>
            ) : biggestImprovements.map(({ player, change, current, previousRating }) => (
              <div key={player.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg/45 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-barlow text-[15px] font-bold text-text-primary">{player.name}</div>
                  <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{player.role} · {previousRating} → {current}</div>
                </div>
                <span className="shrink-0 rounded bg-success/15 px-2 py-1 font-space-mono text-[10px] font-bold text-success">+{change}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <div className="shrink-0 border-b border-border px-5 py-4">
            <h2 className="font-anton text-[19px] uppercase text-text-primary">Team Report</h2>
            <p className="mt-1 font-space-mono text-[8px] font-bold uppercase tracking-[0.1em] text-text-secondary">Why each team finished where it did</p>
          </div>
          <div className="min-h-[18rem] space-y-2 overflow-y-auto p-3">
            {rankedTeams.map((team, index) => (
              <div key={team.teamId} className="rounded-lg border border-border bg-bg/45 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><span className="mr-2 font-space-mono text-[10px] font-bold text-text-secondary">{index + 1}.</span><span className="font-barlow text-[15px] font-bold text-text-primary">{team.teamName || teams[team.teamId]?.name || team.shortName}</span></div>
                  <span className="shrink-0 font-space-mono text-[9px] font-bold text-text-secondary">{team.points} pts</span>
                </div>
                <p className="mt-1 pl-5 font-barlow text-xs leading-snug text-text-secondary">{teamReport(index + 1, team, playerStats, team.teamId, leagueAverages)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
