"use client";

import React, { useMemo, useState } from "react";
import { Player, Team } from "@/lib/types";
import { formatPrice } from "@/lib/logic/auctionRules";
import {
  Award,
  Clock,
  Coins,
  Crown,
  Info,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";

interface SquadAnalysisPageProps {
  userTeam: Team;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  onOpenPlayer?: (playerId: string) => void;
}

type MetricKey =
  | "top3BattersAvg"
  | "top3BowlersAvg"
  | "cappedCount"
  | "squadCA"
  | "squadPA"
  | "squadAge"
  | "iplMatches";

interface BenchmarkHoverInfo {
  title: string;
  metricKey: MetricKey;
  unit: string;
  higherIsBetter?: boolean;
}

interface ActiveBenchmarkState {
  info: BenchmarkHoverInfo;
  x: number;
  y: number;
}

export default function SquadAnalysisPage({
  userTeam,
  teams,
  players,
  onOpenPlayer,
}: SquadAnalysisPageProps) {
  const [activeBenchmark, setActiveBenchmark] = useState<ActiveBenchmarkState | null>(null);

  const handleTriggerHover = (
    e: React.MouseEvent,
    info: BenchmarkHoverInfo
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveBenchmark({
      info,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 4,
    });
  };

  const handleTriggerLeave = () => {
    setActiveBenchmark(null);
  };

  const analysis = useMemo(() => {
    const allTeamsList = Object.values(teams);

    const getRating = (p: Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
    const getPotential = (p: Player) => Math.max(p.potentialBatting ?? 0, p.potentialBowling ?? 0);
    const getBatRating = (p: Player) => p.currentBatting ?? 0;
    const getBowlRating = (p: Player) => p.currentBowling ?? 0;

    const getPlayerSalary = (p: Player) => {
      if (p.iplHistory && p.iplHistory.length > 0) {
        return p.iplHistory[p.iplHistory.length - 1].price ?? p.basePrice ?? 200;
      }
      return p.basePrice ?? 200;
    };

    const isCapped = (p: Player) => p.nationality === "Overseas" || (p.reputation ?? 5) >= 6;

    const userSquadPlayers = (userTeam.squad ?? [])
      .map((id) => players[id])
      .filter((p): p is Player => Boolean(p));

    // Top Batters & Bowlers (Top 5)
    const userTop5Batters = [...userSquadPlayers]
      .sort((a, b) => getBatRating(b) - getBatRating(a))
      .slice(0, 5);

    const userTop3BattersAvg = userTop5Batters.length > 0
      ? userTop5Batters.slice(0, 3).reduce((acc, p) => acc + getBatRating(p), 0) / Math.min(3, userTop5Batters.length)
      : 0;

    const userTop6BattersAvg = [...userSquadPlayers]
      .sort((a, b) => getBatRating(b) - getBatRating(a))
      .slice(0, 6)
      .reduce((acc, p, _, arr) => acc + getBatRating(p) / Math.max(1, arr.length), 0);

    const userTop5Bowlers = [...userSquadPlayers]
      .sort((a, b) => getBowlRating(b) - getBowlRating(a))
      .slice(0, 5);

    const userTop3BowlersAvg = userTop5Bowlers.length > 0
      ? userTop5Bowlers.slice(0, 3).reduce((acc, p) => acc + getBowlRating(p), 0) / Math.min(3, userTop5Bowlers.length)
      : 0;

    const userTop5BowlersAvg = userTop5Bowlers.length > 0
      ? userTop5Bowlers.reduce((acc, p) => acc + getBowlRating(p), 0) / userTop5Bowlers.length
      : 0;

    // League Averages & Individual Team Stats for Rankings Table
    let leagueTop3BattersSum = 0;
    let leagueTop3BowlersSum = 0;
    let leagueCappedCountSum = 0;
    let leagueTotalAgeSum = 0;
    let leagueOverallRatingSum = 0;
    let leaguePotentialRatingSum = 0;
    let leagueTotalIplMatchesSum = 0;

    const validTeams = allTeamsList.filter((t) => t.squad && t.squad.length > 0);

    const leagueTeamStatsMap: Record<
      string,
      {
        teamId: string;
        shortName: string;
        name: string;
        primaryColor: string;
        secondaryColor: string;
        top3BattersAvg: number;
        top3BowlersAvg: number;
        cappedCount: number;
        squadCA: number;
        squadPA: number;
        squadAge: number;
        iplMatches: number;
      }
    > = {};

    validTeams.forEach((teamItem) => {
      const teamPlayers = teamItem.squad.map((id) => players[id]).filter((p): p is Player => Boolean(p));
      if (teamPlayers.length === 0) return;

      const top3Bat = [...teamPlayers].sort((a, b) => getBatRating(b) - getBatRating(a)).slice(0, 3);
      const top3Bowl = [...teamPlayers].sort((a, b) => getBowlRating(b) - getBowlRating(a)).slice(0, 3);

      const top3BattersAvg = top3Bat.reduce((acc, p) => acc + getBatRating(p), 0) / Math.max(1, top3Bat.length);
      const top3BowlersAvg = top3Bowl.reduce((acc, p) => acc + getBowlRating(p), 0) / Math.max(1, top3Bowl.length);
      const cappedCount = teamPlayers.filter(isCapped).length;

      const teamAvgAge = teamPlayers.reduce((acc, p) => acc + p.age, 0) / teamPlayers.length;
      const teamAvgRating = teamPlayers.reduce((acc, p) => acc + getRating(p), 0) / teamPlayers.length;
      const teamAvgPotential = teamPlayers.reduce((acc, p) => acc + getPotential(p), 0) / teamPlayers.length;

      const teamIplMatchesTotal = teamPlayers.reduce((acc, p) => acc + (p.iplStats?.matches ?? 0), 0);
      const teamIplMatchesAvg = teamIplMatchesTotal / teamPlayers.length;

      leagueTop3BattersSum += top3BattersAvg;
      leagueTop3BowlersSum += top3BowlersAvg;
      leagueCappedCountSum += cappedCount;
      leagueTotalAgeSum += teamAvgAge;
      leagueOverallRatingSum += teamAvgRating;
      leaguePotentialRatingSum += teamAvgPotential;
      leagueTotalIplMatchesSum += teamIplMatchesAvg;

      leagueTeamStatsMap[teamItem.id] = {
        teamId: teamItem.id,
        shortName: teamItem.shortName,
        name: teamItem.name,
        primaryColor: teamItem.primaryColor ?? "#555",
        secondaryColor: teamItem.secondaryColor ?? "#FFF",
        top3BattersAvg,
        top3BowlersAvg,
        cappedCount,
        squadCA: teamAvgRating,
        squadPA: teamAvgPotential,
        squadAge: teamAvgAge,
        iplMatches: teamIplMatchesAvg,
      };
    });

    const teamCount = Math.max(1, validTeams.length);
    const leagueTop3BattersAvg = leagueTop3BattersSum / teamCount;
    const leagueTop3BowlersAvg = leagueTop3BowlersSum / teamCount;
    const leagueAvgCappedCount = leagueCappedCountSum / teamCount;
    const leagueAvgSquadAge = leagueTotalAgeSum / teamCount;
    const leagueAvgSquadRating = leagueOverallRatingSum / teamCount;
    const leagueAvgSquadPotential = leaguePotentialRatingSum / teamCount;
    const leagueAvgIplMatchesPerPlayer = leagueTotalIplMatchesSum / teamCount;

    // Capped & Demographics
    const userCappedPlayers = userSquadPlayers.filter(isCapped);
    const userUncappedPlayers = userSquadPlayers.filter((p) => !isCapped(p));
    const userOverseasPlayers = userSquadPlayers.filter((p) => p.nationality === "Overseas");

    const youthPlayers = userSquadPlayers.filter((p) => p.age < 23);
    const primePlayers = userSquadPlayers.filter((p) => p.age >= 23 && p.age <= 29);
    const veteranPlayers = userSquadPlayers.filter((p) => p.age >= 30);

    const eliteAndStartersTier = userSquadPlayers.filter((p) => getRating(p) >= 80);
    const remainingSquadPlayers = userSquadPlayers.filter((p) => getRating(p) < 80);
    const youngsterTier = remainingSquadPlayers.filter((p) => p.age <= 25);
    const squadPlayerTier = remainingSquadPlayers.filter((p) => p.age >= 26 && p.age <= 33);
    const veteranTier = remainingSquadPlayers.filter((p) => p.age >= 34);

    // Roles & Specialists
    const genuineBatters = userSquadPlayers.filter((p) => getBatRating(p) >= 70);
    const genuineBowlers = userSquadPlayers.filter((p) => getBowlRating(p) >= 70);
    const wicketkeepers = userSquadPlayers.filter((p) => p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
    const impactAllRounders = userSquadPlayers.filter((p) => p.role === "All-Rounder" && getRating(p) >= 70);

    const paceBowlers = userSquadPlayers.filter(
      (p) =>
        p.role === "Pace Bowler" ||
        (p.role === "All-Rounder" &&
          getBowlRating(p) >= 68 &&
          (!p.bowlingStyle || p.bowlingStyle.toLowerCase().includes("fast") || p.bowlingStyle.toLowerCase().includes("medium")))
    );
    const spinBowlers = userSquadPlayers.filter(
      (p) =>
        p.role === "Spin Bowler" ||
        (p.role === "All-Rounder" &&
          getBowlRating(p) >= 68 &&
          (p.bowlingStyle?.toLowerCase().includes("spin") ||
            p.bowlingStyle?.toLowerCase().includes("ortho") ||
            p.bowlingStyle?.toLowerCase().includes("off") ||
            p.bowlingStyle?.toLowerCase().includes("leg")))
    );

    const topOrderBatters = userSquadPlayers.filter((p) => Boolean(p.isOpener || p.hasBattedAt3));
    const finishers = userSquadPlayers.filter((p) => Boolean(p.isFinisher));

    const sortedByAge = [...userSquadPlayers].sort((a, b) => a.age - b.age);
    const youngestPlayer = sortedByAge[0];
    const oldestPlayer = sortedByAge[sortedByAge.length - 1];

    const totalSquadSalary = userSquadPlayers.reduce((acc, p) => acc + getPlayerSalary(p), 0);
    const playersBySalary = [...userSquadPlayers].sort((a, b) => getPlayerSalary(b) - getPlayerSalary(a));
    const largestContractPlayer = playersBySalary[0];
    const largestContractSalary = largestContractPlayer ? getPlayerSalary(largestContractPlayer) : 0;
    const topThreeContractSpend = playersBySalary
      .slice(0, 3)
      .reduce((sum, player) => sum + getPlayerSalary(player), 0);
    const topThreeContractShare = totalSquadSalary > 0
      ? (topThreeContractSpend / totalSquadSalary) * 100
      : 0;
    const investmentByRole = userSquadPlayers.reduce(
      (totals, player) => {
        const salary = getPlayerSalary(player);
        if (player.role === "All-Rounder") totals.allRounders += salary;
        else if (player.role === "Pace Bowler" || player.role === "Spin Bowler") totals.bowling += salary;
        else totals.batting += salary;
        return totals;
      },
      { batting: 0, allRounders: 0, bowling: 0 },
    );
    const squadInvestmentMix = [
      { key: "batting", label: "Bat", amount: investmentByRole.batting, color: "bg-sky-500", textColor: "text-sky-500" },
      { key: "all-rounders", label: "AR", amount: investmentByRole.allRounders, color: "bg-accent", textColor: "text-accent" },
      { key: "bowling", label: "Bowl", amount: investmentByRole.bowling, color: "bg-emerald-500", textColor: "text-emerald-500" },
    ].map((group) => ({
      ...group,
      share: totalSquadSalary > 0 ? (group.amount / totalSquadSalary) * 100 : 0,
    }));

    const userAvgRating = userSquadPlayers.length > 0
      ? userSquadPlayers.reduce((acc, p) => acc + getRating(p), 0) / userSquadPlayers.length
      : 0;

    const userAvgPotential = userSquadPlayers.length > 0
      ? userSquadPlayers.reduce((acc, p) => acc + getPotential(p), 0) / userSquadPlayers.length
      : 0;

    const userAvgAge = userSquadPlayers.length > 0
      ? userSquadPlayers.reduce((acc, p) => acc + p.age, 0) / userSquadPlayers.length
      : 0;

    // --- YOUTH & POTENTIAL ---
    const youngProdigies = [...userSquadPlayers]
      .filter((p) => p.age <= 23)
      .sort((a, b) => getPotential(b) - getPotential(a));
    const mainYouthProduct = youngProdigies[0] ?? youngestPlayer;
    const topGrowthPlayers = userSquadPlayers
      .map((player) => ({
        player,
        growth: Math.max(0, getPotential(player) - getRating(player)),
      }))
      .filter(({ growth }) => growth > 0)
      .sort((left, right) => (
        right.growth - left.growth
        || getPotential(right.player) - getPotential(left.player)
      ));

    // --- TIME AT CLUB & LOYALTY ---
    const getSeasonsAtClub = (p: Player) => {
      const historyAtTeam = (p.iplHistory ?? []).filter((h) => h.teamId === userTeam.id);
      return Math.max(1, historyAtTeam.length);
    };

    const clubStalwarts = userSquadPlayers
      .map((p) => ({ player: p, seasons: getSeasonsAtClub(p) }))
      .sort((a, b) => b.seasons - a.seasons)
      .slice(0, 4);

    const avgTenure = userSquadPlayers.length > 0
      ? userSquadPlayers.reduce((acc, p) => acc + getSeasonsAtClub(p), 0) / userSquadPlayers.length
      : 1;

    const newRecruits = userSquadPlayers.filter((p) => getSeasonsAtClub(p) === 1);
    const coreTenurePlayers = userSquadPlayers.filter((p) => getSeasonsAtClub(p) >= 2);

    // --- CAREER & IPL MILESTONES ---
    const totalIplMatches = userSquadPlayers.reduce((acc, p) => acc + (p.iplStats?.matches ?? 0), 0);
    const totalIplRuns = userSquadPlayers.reduce((acc, p) => acc + (p.iplStats?.runs ?? 0), 0);
    const totalIplWickets = userSquadPlayers.reduce((acc, p) => acc + (p.iplStats?.wickets ?? 0), 0);
    const avgIplMatchesPerPlayer = userSquadPlayers.length > 0 ? totalIplMatches / userSquadPlayers.length : 0;

    const topVeterans = [...userSquadPlayers]
      .sort((a, b) => (b.iplStats?.matches ?? 0) - (a.iplStats?.matches ?? 0))
      .slice(0, 2);

    // --- TACTICAL BALANCE & HANDEDNESS ---
    const lhbBatters = userSquadPlayers.filter((p) => p.battingStyle === "Left-hand");
    const rhbBatters = userSquadPlayers.filter((p) => p.battingStyle === "Right-hand" || !p.battingStyle);

    // --- LEADERSHIP QUOTIENT ---
    const primaryCaptain = [...userSquadPlayers].sort((a, b) => (b.captaincy ?? 0) - (a.captaincy ?? 0))[0];
    const leadershipGroup = userSquadPlayers.filter((p) => (p.captaincy ?? 0) >= 75);

    return {
      userSquadPlayers,
      userTop5Batters,
      userTop3BattersAvg,
      userTop6BattersAvg,
      leagueTop3BattersAvg,
      battersDiff: userTop3BattersAvg - leagueTop3BattersAvg,

      userTop5Bowlers,
      userTop3BowlersAvg,
      userTop5BowlersAvg,
      leagueTop3BowlersAvg,
      bowlersDiff: userTop3BowlersAvg - leagueTop3BowlersAvg,

      userCappedCount: userCappedPlayers.length,
      userUncappedCount: userUncappedPlayers.length,
      userCappedPlayers,
      userUncappedPlayers,
      leagueAvgCappedCount,
      cappedDiff: userCappedPlayers.length - leagueAvgCappedCount,

      userOverseasCount: userOverseasPlayers.length,
      userOverseasPlayers,

      userAvgRating,
      leagueAvgSquadRating,
      ratingDiff: userAvgRating - leagueAvgSquadRating,

      userAvgPotential,
      leagueAvgSquadPotential,
      potentialDiff: userAvgPotential - leagueAvgSquadPotential,

      userAvgAge,
      leagueAvgSquadAge,
      ageDiff: userAvgAge - leagueAvgSquadAge,

      youthCount: youthPlayers.length,
      primeCount: primePlayers.length,
      veteranCount: veteranPlayers.length,
      youngestPlayer,
      oldestPlayer,

      eliteAndStartersTier,
      youngsterTier,
      squadPlayerTier,
      veteranTier,

      genuineBatters,
      genuineBowlers,
      wicketkeepers,
      impactAllRounders,
      paceBowlers,
      spinBowlers,
      topOrderBatters,
      finishers,

      totalSquadSalary,
      largestContractPlayer,
      largestContractSalary,
      topThreeContractShare,
      squadInvestmentMix,

      // Analytical Additions
      mainYouthProduct,
      topGrowthPlayers,
      clubStalwarts,
      avgTenure,
      newRecruitsCount: newRecruits.length,
      coreTenureCount: coreTenurePlayers.length,
      totalIplMatches,
      totalIplRuns,
      totalIplWickets,
      avgIplMatchesPerPlayer,
      leagueAvgIplMatchesPerPlayer,
      topVeterans,

      lhbCount: lhbBatters.length,
      rhbCount: rhbBatters.length,

      primaryCaptain,
      leadershipGroup,

      leagueTeamStatsMap,

      // Custom Age Split Bar Chart (<21, 22-27, 28-31, 32-35, 36+)
      ageDistributionBars: [
        { label: "<21", count: userSquadPlayers.filter((p) => p.age <= 21).length, color: "bg-emerald-500" },
        { label: "22-27", count: userSquadPlayers.filter((p) => p.age >= 22 && p.age <= 27).length, color: "bg-sky-500" },
        { label: "28-31", count: userSquadPlayers.filter((p) => p.age >= 28 && p.age <= 31).length, color: "bg-accent" },
        { label: "32-35", count: userSquadPlayers.filter((p) => p.age >= 32 && p.age <= 35).length, color: "bg-amber-500" },
        { label: "36+", count: userSquadPlayers.filter((p) => p.age >= 36).length, color: "bg-rose-500" },
      ],
    };
  }, [players, teams, userTeam]);

  // Helper to compute 1-10 team rankings for hovered metric
  const rankedTeams = useMemo(() => {
    if (!activeBenchmark) return [];

    const key = activeBenchmark.info.metricKey;
    const teamList = Object.values(analysis.leagueTeamStatsMap);

    return [...teamList]
      .sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        return valB - valA;
      })
      .map((item, idx) => ({
        rank: idx + 1,
        ...item,
        value: item[key],
        isUserTeam: item.teamId === userTeam.id,
      }));
  }, [activeBenchmark, analysis.leagueTeamStatsMap, userTeam.id]);

  const renderDiffBadge = (
    diff: number,
    suffix = "",
    invertColor = false,
    hoverInfo?: BenchmarkHoverInfo
  ) => {
    const isPositive = diff >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const isGood = invertColor ? !isPositive : isPositive;
    const colorClass = isGood
      ? "bg-success/15 text-success border-success/30 hover:bg-success/25"
      : "bg-danger/15 text-danger border-danger/30 hover:bg-danger/25";

    return (
      <span
        onMouseEnter={(e) => hoverInfo && handleTriggerHover(e, hoverInfo)}
        onMouseLeave={handleTriggerLeave}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-space-mono text-[8px] font-bold cursor-help transition-all ${colorClass}`}
      >
        <Icon className="size-2.5 shrink-0" />
        {isPositive ? "+" : ""}
        {diff.toFixed(1)}
        {suffix} vs League
      </span>
    );
  };

  // Compute dynamic popover position adjacent to trigger cursor / element (strictly bounded within viewport)
  const popoverStyle = useMemo(() => {
    if (!activeBenchmark) return {};

    const popoverWidth = 300;
    const popoverHeight = 310;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

    let left = activeBenchmark.x - popoverWidth / 2;
    if (left + popoverWidth > viewportWidth - 12) {
      left = viewportWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    let top = activeBenchmark.y + 6;
    if (top + popoverHeight > viewportHeight - 12) {
      top = activeBenchmark.y - popoverHeight - 6;
    }
    if (top + popoverHeight > viewportHeight - 12) {
      top = viewportHeight - popoverHeight - 12;
    }
    if (top < 12) {
      top = 12;
    }

    return {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
    };
  }, [activeBenchmark]);

  return (
    <div className="relative flex h-full flex-1 min-h-0 flex-col overflow-hidden border-2 border-border bg-surface p-2.5 gap-2">
      {/* Header Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 pb-1.5">
        <div className="flex items-center gap-2">
          <h3 className="font-anton text-[18px] uppercase text-text-primary">Squad Analysis &amp; Comprehensive Benchmarks</h3>
          <span className="rounded bg-accent/15 px-1.5 py-0.5 font-space-mono text-[9px] font-bold uppercase text-accent flex items-center gap-1">
            <Info className="size-3" /> Hover Stats For League Rankings
          </span>
        </div>

        <div className="flex items-center gap-3.5 font-space-mono text-[9.5px]">
          <span>Squad: <strong className="text-text-primary">{analysis.userSquadPlayers.length} Players</strong></span>
          <span>Overseas: <strong className="text-accent">{analysis.userOverseasCount}/8</strong></span>
          <span>Payroll: <strong className="text-success">{formatPrice(analysis.totalSquadSalary)}</strong></span>
          <span>IPL Caps: <strong className="text-text-primary">{analysis.totalIplMatches}</strong></span>
          <span>LHB/RHB: <strong className="text-emerald-500">{analysis.lhbCount}L</strong> / <strong className="text-sky-500">{analysis.rhbCount}R</strong></span>
        </div>
      </div>

      {/* Main Single Page Grid */}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-2 overflow-hidden">
        {/* ROW 1: 4 Key Benchmark & Strength Cards */}
        <div className="grid grid-cols-4 gap-2 min-h-0 overflow-hidden">
          {/* Top Batters Strength */}
          <div className="flex h-full min-h-0 flex-col justify-between rounded border border-border bg-black/[0.02] dark:bg-white/[0.02] p-2 shadow-sm overflow-hidden">
            <div>
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <span className="font-space-mono text-[8.5px] font-bold uppercase tracking-wider text-text-secondary">Top Batters Rating</span>
                {renderDiffBadge(analysis.battersDiff, "", false, {
                  title: "League Top 3 Batters Rating Benchmark",
                  metricKey: "top3BattersAvg",
                  unit: "BAT",
                })}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-anton text-[20px] leading-none text-text-primary">{analysis.userTop3BattersAvg.toFixed(1)}</span>
                <span
                  onMouseEnter={(e) =>
                    handleTriggerHover(e, {
                      title: "League Top 3 Batters Rating Benchmark",
                      metricKey: "top3BattersAvg",
                      unit: "BAT",
                    })
                  }
                  onMouseLeave={handleTriggerLeave}
                  className="font-space-mono text-[9px] text-text-secondary hover:underline cursor-help"
                >
                  League Avg: <strong className="text-text-primary">{analysis.leagueTop3BattersAvg.toFixed(1)}</strong>
                </span>
              </div>
            </div>

            <div className="mt-1 flex-1 min-h-0 flex flex-col justify-between border-t border-border/30 pt-1">
              <span className="text-[8px] font-space-mono font-bold uppercase text-text-secondary">Batting Core (Top 5):</span>
              {analysis.userTop5Batters.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => onOpenPlayer?.(p.id)}
                  className="flex items-center justify-between font-barlow text-[10px] hover:underline cursor-pointer py-0.5"
                >
                  <span className="truncate font-semibold text-text-primary">
                    {idx + 1}. {p.name} {p.nationality === "Overseas" ? "(OS)" : ""}
                  </span>
                  <span className="font-space-mono text-[8.5px] font-bold text-accent">{p.currentBatting} BAT</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Bowlers Strength */}
          <div className="flex h-full min-h-0 flex-col justify-between rounded border border-border bg-black/[0.02] dark:bg-white/[0.02] p-2 shadow-sm overflow-hidden">
            <div>
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <span className="font-space-mono text-[8.5px] font-bold uppercase tracking-wider text-text-secondary">Top Bowlers Rating</span>
                {renderDiffBadge(analysis.bowlersDiff, "", false, {
                  title: "League Top 3 Bowlers Rating Benchmark",
                  metricKey: "top3BowlersAvg",
                  unit: "BWL",
                })}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-anton text-[20px] leading-none text-text-primary">{analysis.userTop3BowlersAvg.toFixed(1)}</span>
                <span
                  onMouseEnter={(e) =>
                    handleTriggerHover(e, {
                      title: "League Top 3 Bowlers Rating Benchmark",
                      metricKey: "top3BowlersAvg",
                      unit: "BWL",
                    })
                  }
                  onMouseLeave={handleTriggerLeave}
                  className="font-space-mono text-[9px] text-text-secondary hover:underline cursor-help"
                >
                  League Avg: <strong className="text-text-primary">{analysis.leagueTop3BowlersAvg.toFixed(1)}</strong>
                </span>
              </div>
            </div>

            <div className="mt-1 flex-1 min-h-0 flex flex-col justify-between border-t border-border/30 pt-1">
              <span className="text-[8px] font-space-mono font-bold uppercase text-text-secondary">Bowling Core (Top 5):</span>
              {analysis.userTop5Bowlers.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => onOpenPlayer?.(p.id)}
                  className="flex items-center justify-between font-barlow text-[10px] hover:underline cursor-pointer py-0.5"
                >
                  <span className="truncate font-semibold text-text-primary">
                    {idx + 1}. {p.name} {p.nationality === "Overseas" ? "(OS)" : ""}
                  </span>
                  <span className="font-space-mono text-[8.5px] font-bold text-accent">{p.currentBowling} BWL</span>
                </div>
              ))}
            </div>
          </div>

          {/* Capped & International Quota */}
          <div className="flex h-full min-h-0 flex-col justify-between rounded border border-border bg-black/[0.02] dark:bg-white/[0.02] p-2 shadow-sm overflow-hidden">
            <div>
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <span className="font-space-mono text-[8.5px] font-bold uppercase tracking-wider text-text-secondary">Capped &amp; Overseas</span>
                {renderDiffBadge(analysis.cappedDiff, "", false, {
                  title: "League Capped Stars Count Benchmark",
                  metricKey: "cappedCount",
                  unit: "Stars",
                })}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-anton text-[20px] leading-none text-text-primary">{analysis.userCappedCount}</span>
                <span
                  onMouseEnter={(e) =>
                    handleTriggerHover(e, {
                      title: "League Capped Stars Count Benchmark",
                      metricKey: "cappedCount",
                      unit: "Stars",
                    })
                  }
                  onMouseLeave={handleTriggerLeave}
                  className="font-space-mono text-[9px] text-text-secondary hover:underline cursor-help"
                >
                  League Avg: <strong className="text-text-primary">{analysis.leagueAvgCappedCount.toFixed(1)}</strong>
                </span>
              </div>
            </div>

            <div className="mt-1 flex-1 min-h-0 flex flex-col justify-between border-t border-border/30 pt-1 font-space-mono text-[9px]">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Capped Stars:</span>
                <span className="font-bold text-text-primary">{analysis.userCappedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Uncapped Domestic:</span>
                <span className="font-bold text-accent">{analysis.userUncappedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Overseas Quota:</span>
                <span className="font-bold text-emerald-500">{analysis.userOverseasCount} / 8</span>
              </div>
              <div className="border-t border-border/20 pt-1 text-[8.5px]">
                <span className="text-text-secondary block font-bold uppercase text-[7.5px]">Top Overseas Core:</span>
                <div className="truncate font-barlow text-[10px] font-semibold text-text-primary mt-0.5">
                  {analysis.userOverseasPlayers.slice(0, 3).map(p => p.name).join(", ") || "None"}
                </div>
              </div>
            </div>
          </div>

          {/* Squad Ability and Potential share the original combined-card footprint */}
          <div className="grid h-full min-h-0 grid-cols-2 gap-2 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-border bg-black/[0.02] p-2 shadow-sm dark:bg-white/[0.02]">
              <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-1">
                <span className="truncate font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">Squad CA</span>
                {renderDiffBadge(analysis.ratingDiff, "", false, {
                  title: "League Overall Squad CA Benchmark",
                  metricKey: "squadCA",
                  unit: "CA",
                })}
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-center py-1 text-center">
                <span className="font-anton text-[23px] leading-none text-text-primary">{analysis.userAvgRating.toFixed(1)}</span>
                <span className="mt-0.5 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Current ability</span>
              </div>
              <div
                onMouseEnter={(e) =>
                  handleTriggerHover(e, {
                    title: "League Overall Squad CA Benchmark",
                    metricKey: "squadCA",
                    unit: "CA",
                  })
                }
                onMouseLeave={handleTriggerLeave}
                className="flex cursor-help items-center justify-between border-t border-border/30 pt-1 font-space-mono text-[8px] hover:underline"
              >
                <span className="text-text-secondary">League Avg:</span>
                <span className="font-bold text-text-primary">{analysis.leagueAvgSquadRating.toFixed(1)}</span>
              </div>
            </div>

            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-border bg-black/[0.02] p-2 shadow-sm dark:bg-white/[0.02]">
              <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-1">
                <span className="truncate font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">Potential</span>
                {renderDiffBadge(analysis.potentialDiff, "", false, {
                  title: "League Overall Squad PA Potential Benchmark",
                  metricKey: "squadPA",
                  unit: "PA",
                })}
              </div>
              <div className="flex items-baseline justify-between py-1">
                <span className="font-anton text-[20px] leading-none text-accent">{analysis.userAvgPotential.toFixed(1)}</span>
                <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">PA Avg</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1 border-t border-border/30 pt-1 font-space-mono text-[8px]">
                <div
                  onMouseEnter={(e) =>
                    handleTriggerHover(e, {
                      title: "League Overall Squad PA Potential Benchmark",
                      metricKey: "squadPA",
                      unit: "PA",
                    })
                  }
                  onMouseLeave={handleTriggerLeave}
                  className="flex cursor-help items-center justify-between hover:underline"
                >
                  <span className="text-text-secondary">League Avg:</span>
                  <span className="font-bold text-text-primary">{analysis.leagueAvgSquadPotential.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Upside:</span>
                  <span className="font-bold text-success">+{(analysis.userAvgPotential - analysis.userAvgRating).toFixed(1)}</span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col border-t border-border/20 pt-1">
                  <span className="shrink-0 truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">Top Growth Players</span>
                  <div className="mt-0.5 min-h-0 flex-1 overflow-y-auto pr-0.5">
                    {analysis.topGrowthPlayers.length > 0 ? analysis.topGrowthPlayers.map(({ player, growth }, index) => (
                      <button
                        key={player.id}
                        type="button"
                        className="grid h-4 w-full grid-cols-[0.8rem_minmax(0,1fr)_auto] items-center gap-1 border-t border-border/15 text-left first:border-t-0 hover:underline"
                        onClick={() => onOpenPlayer?.(player.id)}
                      >
                        <span className="font-space-mono text-[7px] font-bold text-text-secondary">{index + 1}</span>
                        <span className="truncate font-barlow text-[8.5px] font-semibold text-text-primary">{player.name}</span>
                        <span className="shrink-0 font-space-mono text-[7px] font-bold text-success">+{growth}</span>
                      </button>
                    )) : (
                      <span className="flex items-center text-[8px] text-text-secondary">No remaining growth</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: 4 Analytics, Youth, Tenure & Milestones Cards */}
        <div className="grid grid-cols-4 gap-2 min-h-0 overflow-hidden">
          {/* Demographics & Youth Crown Jewel */}
          <div className="flex h-full min-h-0 flex-col justify-between rounded border border-border bg-surface p-2 shadow-sm overflow-hidden">
            <div>
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <h4 className="font-anton text-[12px] uppercase text-text-primary">Youth &amp; Demographics</h4>
                <span
                  onMouseEnter={(e) =>
                    handleTriggerHover(e, {
                      title: "League Average Squad Age Benchmark",
                      metricKey: "squadAge",
                      unit: "yrs",
                    })
                  }
                  onMouseLeave={handleTriggerLeave}
                  className="font-space-mono text-[8.5px] text-text-secondary hover:underline cursor-help"
                >
                  Avg {analysis.userAvgAge.toFixed(1)}y
                </span>
              </div>
              <div className="mt-1 space-y-1 font-space-mono text-[9px]">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-500 font-bold">Youth (&lt;23y): {analysis.youthCount}</span>
                  <span className="text-accent font-bold">Prime: {analysis.primeCount}</span>
                  <span className="text-sky-500 font-bold">Vet: {analysis.veteranCount}</span>
                </div>
                <div className="h-1.5 rounded bg-border/40 overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${(analysis.youthCount / Math.max(1, analysis.userSquadPlayers.length)) * 100}%` }} />
                  <div className="h-full bg-accent" style={{ width: `${(analysis.primeCount / Math.max(1, analysis.userSquadPlayers.length)) * 100}%` }} />
                  <div className="h-full bg-sky-500" style={{ width: `${(analysis.veteranCount / Math.max(1, analysis.userSquadPlayers.length)) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-1 flex-1 min-h-0 flex flex-col justify-between border-t border-border/30 pt-1">
              <div className="font-space-mono text-[8.5px] space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Youngest:</span>
                  <span className="font-semibold text-text-primary truncate">{analysis.youngestPlayer?.name} ({analysis.youngestPlayer?.age}y)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Oldest Vet:</span>
                  <span className="font-semibold text-text-primary truncate">{analysis.oldestPlayer?.name} ({analysis.oldestPlayer?.age}y)</span>
                </div>
              </div>
              {analysis.mainYouthProduct && (
                <div className="border-t border-border/20 pt-1" onClick={() => onOpenPlayer?.(analysis.mainYouthProduct.id)}>
                  <span className="text-[7.5px] uppercase font-bold text-accent flex items-center gap-1">
                    <Crown className="size-2.5" /> Youth Crown Jewel:
                  </span>
                  <div className="flex items-center justify-between font-barlow text-[10px] font-bold text-text-primary hover:underline cursor-pointer mt-0.5">
                    <span className="truncate">{analysis.mainYouthProduct.name} ({analysis.mainYouthProduct.age}y)</span>
                    <span className="font-space-mono text-[8.5px] text-success shrink-0">{Math.max(analysis.mainYouthProduct.potentialBatting, analysis.mainYouthProduct.potentialBowling)} PA</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Franchise Loyalty & Tenure */}
          <div className="flex h-full min-h-0 flex-col justify-between rounded border border-border bg-surface p-2 shadow-sm overflow-hidden">
            <div>
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <h4 className="font-anton text-[12px] uppercase text-text-primary flex items-center gap-1">
                  <Clock className="size-3 text-accent" /> Time at Club &amp; Loyalty
                </h4>
                <span className="font-space-mono text-[8.5px] text-text-secondary">{analysis.avgTenure.toFixed(1)}y avg tenure</span>
              </div>
              <div className="mt-1 space-y-0.5 font-space-mono text-[9px]">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">1st Season Recruits:</span>
                  <span className="font-bold text-accent">{analysis.newRecruitsCount} players</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Retained Core (2+ yrs):</span>
                  <span className="font-bold text-text-primary">{analysis.coreTenureCount} players</span>
                </div>
              </div>
            </div>

            <div className="mt-1 flex-1 min-h-0 flex flex-col justify-between border-t border-border/30 pt-1">
              <span className="text-[8px] font-space-mono font-bold uppercase text-text-secondary">Club Stalwarts Core:</span>
              <div className="space-y-0.5">
                {analysis.clubStalwarts.map((s) => (
                  <div key={s.player.id} className="flex items-center justify-between font-barlow text-[9.5px] hover:underline cursor-pointer" onClick={() => onOpenPlayer?.(s.player.id)}>
                    <span className="truncate text-text-primary font-semibold">{s.player.name}</span>
                    <span className="font-space-mono text-[8px] font-bold text-accent shrink-0">{s.seasons} yrs</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* IPL Career Milestones */}
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded border border-border bg-surface p-2 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-1 shrink-0">
              <h4 className="font-anton text-[12px] uppercase text-text-primary flex items-center gap-1">
                <UserCheck className="size-3 text-accent" /> IPL Experience
              </h4>
              <span
                onMouseEnter={(e) =>
                  handleTriggerHover(e, {
                    title: "League Average IPL Matches Benchmark",
                    metricKey: "iplMatches",
                    unit: "Caps",
                  })
                }
                onMouseLeave={handleTriggerLeave}
                className="font-space-mono text-[8.5px] text-text-secondary hover:underline cursor-help"
              >
                {analysis.totalIplMatches} Caps
              </span>
            </div>

            <div className="my-1 grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <div className="flex items-center justify-between font-space-mono text-[8px] font-bold text-text-secondary uppercase shrink-0 mb-0.5">
                <span>Age Breakdown:</span>
                <span className="text-accent">{analysis.userSquadPlayers.length} Players</span>
              </div>
              <div className="grid h-full min-h-0 grid-cols-5 items-stretch gap-1 rounded border border-border/30 bg-black/[0.03] p-1 dark:bg-white/[0.03]">
                {analysis.ageDistributionBars.map((bar) => {
                  const maxCount = Math.max(1, ...analysis.ageDistributionBars.map((b) => b.count));
                  const heightPercent = bar.count > 0 ? Math.max(18, (bar.count / maxCount) * 100) : 6;
                  return (
                    <div key={bar.label} className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] items-stretch text-center">
                      <span className="font-space-mono text-[8px] font-bold text-text-primary leading-none mb-0.5">{bar.count}</span>
                      <div className="flex h-full min-h-0 w-full items-end overflow-hidden rounded-t bg-border/30">
                        <div
                          className={`w-full rounded-t ${bar.color} transition-all duration-300`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="font-space-mono text-[7px] text-text-secondary mt-0.5 font-semibold truncate leading-none">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border/30 pt-1 space-y-0.5 font-space-mono text-[9px] shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Squad Runs / Wickets:</span>
                <span className="font-bold text-text-primary">{analysis.totalIplRuns}r / {analysis.totalIplWickets}w</span>
              </div>
              <div
                onMouseEnter={(e) =>
                  handleTriggerHover(e, {
                    title: "League Average IPL Matches Benchmark",
                    metricKey: "iplMatches",
                    unit: "Caps",
                  })
                }
                onMouseLeave={handleTriggerLeave}
                className="flex items-center justify-between hover:underline cursor-help"
              >
                <span className="text-text-secondary">Avg Caps per Player:</span>
                <span className="font-bold text-text-primary">{analysis.avgIplMatchesPerPlayer.toFixed(0)} (League {analysis.leagueAvgIplMatchesPerPlayer.toFixed(0)})</span>
              </div>
            </div>
          </div>

          {/* Squad Investment Mix */}
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded border border-border bg-surface p-2 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-1">
              <h4 className="flex items-center gap-1 font-anton text-[12px] uppercase text-text-primary">
                <Coins className="size-3 text-success" /> Squad Investment Mix
              </h4>
              <span className="font-space-mono text-[7.5px] font-bold uppercase text-text-secondary">Role allocation</span>
            </div>

            <div className="flex min-h-0 flex-col justify-center py-1.5">
              <div className="flex h-2.5 w-full overflow-hidden rounded-sm bg-border/30">
                {analysis.squadInvestmentMix.map((group) => (
                  <span
                    key={group.key}
                    className={`h-full ${group.color}`}
                    style={{ width: `${group.share}%` }}
                    title={`${group.label}: ${group.share.toFixed(1)}% (${formatPrice(group.amount)})`}
                  />
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                {analysis.squadInvestmentMix.map((group) => (
                  <div key={group.key} className="min-w-0 text-center">
                    <div className={`font-space-mono text-[8px] font-bold uppercase ${group.textColor}`}>{group.label}</div>
                    <div className="font-anton text-[14px] leading-none text-text-primary">{group.share.toFixed(0)}%</div>
                    <div className="mt-0.5 truncate font-space-mono text-[7px] text-text-secondary">{formatPrice(group.amount)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 border-t border-border/30 pt-1 font-space-mono text-[8.5px]">
              {analysis.largestContractPlayer && (
                <button
                  type="button"
                  onClick={() => onOpenPlayer?.(analysis.largestContractPlayer.id)}
                  className="flex w-full items-center justify-between gap-2 text-left hover:underline"
                >
                  <span className="truncate text-text-secondary">Largest: <strong className="text-text-primary">{analysis.largestContractPlayer.name}</strong></span>
                  <span className="shrink-0 font-bold text-success">{formatPrice(analysis.largestContractSalary)}</span>
                </button>
              )}
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Top 3 contract concentration:</span>
                <span className="font-bold text-text-primary">{analysis.topThreeContractShare.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: 2 Column Combined Grid */}
        <div className="grid grid-cols-2 gap-2 min-h-0 flex-1 overflow-hidden">
          {/* Squad Ability Pyramid (All 4 Tiers Fully Populated) */}
          <div className="flex h-full min-h-0 flex-col justify-between rounded border border-border bg-surface p-2 shadow-sm overflow-hidden">
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <h4 className="font-anton text-[13px] uppercase text-text-primary">Squad Rating Tiers</h4>
                <span className="font-space-mono text-[8.5px] text-text-secondary">Ability Pyramid</span>
              </div>
              <div className="grid flex-1 min-h-0 grid-cols-2 grid-rows-2 gap-1.5 mt-1.5">
                {/* Elite and established starters (80+) */}
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-accent/40 bg-accent/[0.04] p-1.5">
                  <div className="flex items-center justify-between font-space-mono text-[8.5px] font-bold">
                    <span className="text-accent flex items-center gap-1"><Sparkles className="size-2.5" /> Elite &amp; Starters (80+)</span>
                    <span className="text-text-primary font-anton text-[13px]">{analysis.eliteAndStartersTier.length}</span>
                  </div>
                  <div className="mt-1 flex min-h-0 flex-1 content-start flex-wrap gap-1 overflow-y-auto">
                    {analysis.eliteAndStartersTier.length > 0 ? (
                      analysis.eliteAndStartersTier.map((p) => (
                        <span key={p.id} onClick={() => onOpenPlayer?.(p.id)} className="max-w-full cursor-pointer truncate rounded bg-accent/20 px-1 py-0.5 font-barlow text-[9px] font-semibold leading-none text-text-primary hover:underline">
                          {p.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[8.5px] text-text-secondary italic">None</span>
                    )}
                  </div>
                </div>

                {/* Remaining youngsters, split by age */}
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-border/60 bg-black/[0.02] p-1.5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between font-space-mono text-[8.5px] font-bold">
                    <span className="text-emerald-500">Youngsters (≤25)</span>
                    <span className="text-text-primary font-anton text-[13px]">{analysis.youngsterTier.length}</span>
                  </div>
                  <div className="mt-1 flex min-h-0 flex-1 content-start flex-wrap gap-1 overflow-y-auto">
                    {analysis.youngsterTier.length > 0 ? (
                      analysis.youngsterTier.map((p) => (
                        <span key={p.id} onClick={() => onOpenPlayer?.(p.id)} className="max-w-full cursor-pointer truncate rounded bg-black/5 px-1 py-0.5 font-barlow text-[9px] font-semibold leading-none text-text-primary hover:underline dark:bg-white/10">
                          {p.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[8.5px] text-text-secondary italic">None</span>
                    )}
                  </div>
                </div>

                {/* Remaining prime-age squad players */}
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-border/60 bg-black/[0.02] p-1.5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between font-space-mono text-[8.5px] font-bold">
                    <span className="text-text-secondary">Squad Players (26–33)</span>
                    <span className="text-text-primary font-anton text-[13px]">{analysis.squadPlayerTier.length}</span>
                  </div>
                  <div className="mt-1 flex min-h-0 flex-1 content-start flex-wrap gap-1 overflow-y-auto">
                    {analysis.squadPlayerTier.length > 0 ? (
                      analysis.squadPlayerTier.map((p) => (
                        <span key={p.id} onClick={() => onOpenPlayer?.(p.id)} className="max-w-full cursor-pointer truncate rounded bg-black/5 px-1 py-0.5 font-barlow text-[9px] leading-none text-text-primary hover:underline dark:bg-white/10">
                          {p.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[8.5px] text-text-secondary italic">None</span>
                    )}
                  </div>
                </div>

                {/* Remaining veterans */}
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-border/60 bg-black/[0.02] p-1.5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between font-space-mono text-[8.5px] font-bold">
                    <span className="text-amber-500">Veterans (34+)</span>
                    <span className="text-text-primary font-anton text-[13px]">{analysis.veteranTier.length}</span>
                  </div>
                  <div className="mt-1 flex min-h-0 flex-1 content-start flex-wrap gap-1 overflow-y-auto">
                    {analysis.veteranTier.length > 0 ? (
                      analysis.veteranTier.map((p) => (
                        <span key={p.id} onClick={() => onOpenPlayer?.(p.id)} className="max-w-full cursor-pointer truncate rounded bg-black/5 px-1 py-0.5 font-barlow text-[9px] leading-none text-text-primary hover:underline dark:bg-white/10">
                          {p.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[8.5px] text-text-secondary italic">None</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Specialist Roles & Tactical Coverage Grid */}
          <div className="flex h-full min-h-0 flex-col justify-between rounded border border-border bg-surface p-2 shadow-sm overflow-hidden">
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between border-b border-border/40 pb-1">
                <h4 className="font-anton text-[13px] uppercase text-text-primary">Specialist Roles &amp; Tactical Depth</h4>
                <span className="font-space-mono text-[8.5px] text-text-secondary">Positional Coverage</span>
              </div>

              <div className="grid flex-1 min-h-0 grid-cols-4 grid-rows-2 gap-1.5 mt-1.5">
                <div className="rounded border border-border/60 p-1.5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col justify-between h-full">
                  <div className="font-space-mono text-[8.5px] font-bold uppercase text-text-secondary truncate">Pace Battery</div>
                  <div className="font-anton text-[18px] text-text-primary leading-none">{analysis.paceBowlers.length}</div>
                  <div className="truncate font-barlow text-[9.5px] text-text-secondary">
                    {analysis.paceBowlers.slice(0, 3).map(p => p.name).join(", ") || "None"}
                  </div>
                </div>

                <div className="rounded border border-border/60 p-1.5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col justify-between h-full">
                  <div className="font-space-mono text-[8.5px] font-bold uppercase text-text-secondary truncate">Spin Attack</div>
                  <div className="font-anton text-[18px] text-text-primary leading-none">{analysis.spinBowlers.length}</div>
                  <div className="truncate font-barlow text-[9.5px] text-text-secondary">
                    {analysis.spinBowlers.slice(0, 3).map(p => p.name).join(", ") || "None"}
                  </div>
                </div>

                <div className="rounded border border-border/60 p-1.5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col justify-between h-full">
                  <div className="font-space-mono text-[8.5px] font-bold uppercase text-text-secondary truncate">Wicketkeepers</div>
                  <div className="font-anton text-[18px] text-text-primary leading-none">{analysis.wicketkeepers.length}</div>
                  <div className="truncate font-barlow text-[9.5px] text-text-secondary">
                    {analysis.wicketkeepers.slice(0, 3).map(p => p.name).join(", ") || "None"}
                  </div>
                </div>

                <div className="rounded border border-border/60 p-1.5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col justify-between h-full">
                  <div className="font-space-mono text-[8.5px] font-bold uppercase text-text-secondary truncate">All-Rounders</div>
                  <div className="font-anton text-[18px] text-text-primary leading-none">{analysis.impactAllRounders.length}</div>
                  <div className="truncate font-barlow text-[9.5px] text-text-secondary">
                    {analysis.impactAllRounders.slice(0, 3).map(p => p.name).join(", ") || "None"}
                  </div>
                </div>

                <div className="rounded border border-border/60 p-1.5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col justify-between h-full">
                  <div className="font-space-mono text-[8.5px] font-bold uppercase text-text-secondary truncate">Openers / #3</div>
                  <div className="font-anton text-[18px] text-text-primary leading-none">{analysis.topOrderBatters.length}</div>
                  <div className="truncate font-barlow text-[9.5px] text-text-secondary">
                    {analysis.topOrderBatters.slice(0, 3).map(p => p.name).join(", ") || "None"}
                  </div>
                </div>

                <div className="rounded border border-border/60 p-1.5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col justify-between h-full">
                  <div className="font-space-mono text-[8.5px] font-bold uppercase text-text-secondary truncate">Finishers</div>
                  <div className="font-anton text-[18px] text-text-primary leading-none">{analysis.finishers.length}</div>
                  <div className="truncate font-barlow text-[9.5px] text-text-secondary">
                    {analysis.finishers.slice(0, 3).map(p => p.name).join(", ") || "None"}
                  </div>
                </div>

                <div className="rounded border border-border/60 p-1.5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col justify-between h-full">
                  <div className="font-space-mono text-[8.5px] font-bold uppercase text-text-secondary truncate">LHB/RHB Ratio</div>
                  <div className="font-anton text-[18px] text-text-primary leading-none">{analysis.lhbCount}/{analysis.rhbCount}</div>
                  <div className="truncate font-barlow text-[9.5px] text-text-secondary">
                    {((analysis.lhbCount / Math.max(1, analysis.userSquadPlayers.length)) * 100).toFixed(0)}% LHB
                  </div>
                </div>

                <div className="rounded border border-border/60 p-1.5 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col justify-between h-full">
                  <div className="font-space-mono text-[8.5px] font-bold uppercase text-text-secondary truncate">Leadership</div>
                  <div className="font-anton text-[18px] text-text-primary leading-none">{analysis.leadershipGroup.length}</div>
                  <div className="truncate font-barlow text-[9.5px] text-text-secondary" onClick={() => analysis.primaryCaptain && onOpenPlayer?.(analysis.primaryCaptain.id)}>
                    Capt: {analysis.primaryCaptain?.name ?? "None"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= LEAGUE RANKINGS FLOATING POPOVER (Positioned adjacent to trigger, strictly non-scrolling) ================= */}
      {activeBenchmark && rankedTeams.length > 0 && (
        <div
          style={popoverStyle}
          className="fixed z-[100] w-[300px] max-h-[calc(100vh-24px)] overflow-hidden rounded-lg border-2 border-accent bg-[var(--surface-dark,rgba(18,18,18,0.96))] p-2.5 text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
        >
          <div className="flex items-center justify-between border-b border-white/15 pb-1.5 mb-1.5">
            <div>
              <h4 className="font-anton text-[13px] uppercase tracking-wider text-accent flex items-center gap-1">
                <Award className="size-3.5 text-accent" /> {activeBenchmark.info.title}
              </h4>
              <span className="font-space-mono text-[8px] text-white/70">
                Official 1-10 League Ranking ({activeBenchmark.info.unit})
              </span>
            </div>
            <span className="rounded bg-accent/20 px-1 py-0.5 font-space-mono text-[8px] font-bold text-accent">
              League Table
            </span>
          </div>

          <div className="space-y-0.5 font-space-mono text-[9.5px]">
            <div className="grid grid-cols-[22px_1fr_56px] text-[8px] font-bold text-white/50 uppercase border-b border-white/10 pb-0.5 mb-0.5">
              <span>#</span>
              <span>Franchise</span>
              <span className="text-right">Avg</span>
            </div>

            {rankedTeams.map((teamItem) => (
              <div
                key={teamItem.teamId}
                className={`grid grid-cols-[22px_1fr_56px] items-center py-0.5 px-1 rounded transition-colors ${
                  teamItem.isUserTeam
                    ? "border-2 border-accent bg-accent/15 text-white font-bold shadow-sm"
                    : "border border-transparent hover:bg-white/5 text-white/90"
                }`}
              >
                <span className="font-anton text-[10px] text-accent-light">
                  {teamItem.rank === 1 ? "1" : teamItem.rank === 2 ? "2" : teamItem.rank === 3 ? "3" : `${teamItem.rank}`}
                </span>
                <div className="flex items-center gap-1 truncate">
                  <span
                    className="size-2 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: teamItem.primaryColor }}
                  />
                  <span className="truncate font-semibold text-[10px]">
                    {teamItem.name} {teamItem.isUserTeam && <span className="ml-0.5 text-accent text-[8px] font-bold uppercase tracking-wider">(YOU)</span>}
                  </span>
                </div>
                <span className="text-right font-bold text-[9.5px]">
                  {typeof teamItem.value === "number"
                    ? activeBenchmark.info.metricKey === "cappedCount"
                      ? Math.round(teamItem.value)
                      : teamItem.value.toFixed(1)
                    : teamItem.value} {activeBenchmark.info.unit}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-1.5 border-t border-white/10 pt-1 text-center font-space-mono text-[7.5px] text-white/50">
            Hover off element to close table • Live season snapshot
          </div>
        </div>
      )}
    </div>
  );
}
