"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

const MatchScorecardModal = dynamic(
  () => import("@/components/match/MatchScorecardModal"),
  { ssr: false }
);
import { 
  Newspaper, 
  TrendingUp, 
  Calendar, 
  User, 
  ArrowUpRight, 
  Sliders, 
  Layout, 
  List, 
  Grid, 
  Award, 
  Clock, 
  BookOpen, 
  ChevronRight,
  Shield,
  Zap,
  Star
} from "lucide-react";
import type { CareerRetirementRecord } from "@/lib/logic/careerLifecycle";
import type { Player, Team } from "@/lib/types";
import { newsTemplates } from "@/lib/data/newsTemplates";
import type { UnifiedMatchRecord } from "@/components/match/MatchScorecardModal";
import { getSeasonDates } from "@/lib/store/gameStore";
import { getLeagueSeasonStartDate } from "@/lib/logic/leagueSchedule";

interface NewsFixture {
  id: string;
  matchNumber: number;
  teamA: string;
  teamB: string;
  played: boolean;
  winner?: string;
  date?: string;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  stage?: string;
}

interface NewsPageProps {
  userTeamId: string;
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
  fixtures?: UnifiedMatchRecord[];
  currentDate?: string;
  onViewAllFixtures?: () => void;
}

export interface NewsArticle {
  id: string;
  title: string;
  subheading: string;
  content: string;
  category: "user_team" | "team_summaries" | "player_news" | "tournament_league" | "transfers_auctions";
  tag?: string;
  timestamp: string;
  publishedAt?: string;
  playerId?: string;
  teamId?: string;
  associatedEntityIds?: { playerId?: string; teamId?: string };
  imageMockupPrompt?: string;
  imagePlaceholder?: string;
  author: string;
  readTime: string;
  isBreaking?: boolean;
}

type NewsLayout = "cricinfo" | "cricbuzz" | "newsletter";
type NewsTab = "all" | NewsArticle["category"];

const CATEGORY_LABELS: Record<NewsTab, string> = {
  all: "All stories",
  user_team: "User team focus",
  team_summaries: "Team summaries",
  player_news: "Player news & profiles",
  tournament_league: "Tournament & league",
  transfers_auctions: "Transfer & auction news",
};

export default function NewsPage({ 
  userTeamId,
  players, 
  teams, 
  playerStats, 
  standings, 
  retirements, 
  retirementHistory, 
  currentSeason,
  fixtures = [],
  currentDate = "",
  onViewAllFixtures
}: NewsPageProps) {
  const [layout, setLayout] = useState<NewsLayout>("cricinfo");
  const [activeTab, setActiveTab] = useState<NewsTab>("all");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [activeScorecard, setActiveScorecard] = useState<any | null>(null);

  const userTeam = teams[userTeamId];

  // Resolve final retirees list with fallback options so it's never empty, sorted by reputation descending
  const finalRetirees = useMemo(() => {
    let list: any[] = [];
    const current = retirementHistory.filter((r) => r.season === currentSeason);
    if (current.length > 0) {
      list = current;
    } else {
      const previous = retirementHistory.filter((r) => r.season === currentSeason - 1);
      if (previous.length > 0) {
        list = previous;
      } else if (retirements.length > 0) {
        list = retirements;
      } else if (retirementHistory.length > 0) {
        list = retirementHistory;
      } else {
        // Fallback: create mock retirement records for players in the game who are age >= 35
        list = Object.values(players)
          .filter((p) => p.age >= 35)
          .map((p) => ({
            playerId: p.id,
            name: p.name,
            age: p.age,
            role: p.role,
            rating: Math.max(p.currentBatting, p.currentBowling),
            season: currentSeason,
          }));
      }
    }

    // Sort by reputation (descending), falling back to rating
    return [...list].sort((a, b) => {
      const repA = players[a.playerId]?.reputation ?? a.rating ?? 0;
      const repB = players[b.playerId]?.reputation ?? b.rating ?? 0;
      return repB - repA;
    });
  }, [retirementHistory, retirements, currentSeason, players]);

  const getPlayerSalary = (p: Player) => {
    if (p.iplHistory && p.iplHistory.length > 0) {
      return p.iplHistory[p.iplHistory.length - 1].price ?? p.basePrice ?? 200;
    }
    return p.basePrice ?? 200;
  };

  // Find top performers overall (needed in both articles and render shell)
  const { topScorer, topWicketTaker } = useMemo(() => {
    const scorers = Object.entries(playerStats)
      .map(([id, stats]) => ({ player: players[id], stats }))
      .filter((item) => item.player)
      .sort((a, b) => b.stats.runs - a.stats.runs);
      
    const wicketTakers = Object.entries(playerStats)
      .map(([id, stats]) => ({ player: players[id], stats }))
      .filter((item) => item.player)
      .sort((a, b) => b.stats.wickets - a.stats.wickets);
      
    return {
      topScorer: scorers[0],
      topWicketTaker: wicketTakers[0]
    };
  }, [players, playerStats]);

  // Check if all fixtures have been completed to determine if season concluded
  const isSeasonConcluded = useMemo(() => {
    if (!fixtures || fixtures.length === 0) return false;
    return fixtures.every(f => f.played);
  }, [fixtures]);

  // Calculate MVP leader
  const mvpCandidate = useMemo(() => {
    if (!playerStats || Object.keys(playerStats).length === 0) return null;
    const sorted = Object.entries(playerStats)
      .map(([id, stats]) => {
        const player = players[id];
        const s = stats as any;
        const mvpPoints = Math.round(
          (s.runs || 0) * 1 + 
          (s.wickets || 0) * 20 + 
          (s.catches || 0) * 2.5 + 
          (s.sixes || 0) * 2.5 + 
          (s.dotBalls || 0) * 1
        );
        return { player, stats: s, mvpPoints };
      })
      .filter(x => x.player)
      .sort((a, b) => b.mvpPoints - a.mvpPoints);
    return sorted[0] || null;
  }, [playerStats, players]);

  // Calculate Emerging Player candidate
  const emergingCandidate = useMemo(() => {
    if (!playerStats || Object.keys(playerStats).length === 0) return null;
    const sorted = Object.entries(playerStats)
      .map(([id, stats]) => {
        const player = players[id];
        if (!player) return null;
        const isEligible = player.age <= 25 && !player.isCapped;
        const s = stats as any;
        const mvpPoints = Math.round(
          (s.runs || 0) * 1 + 
          (s.wickets || 0) * 20 + 
          (s.catches || 0) * 2.5 + 
          (s.sixes || 0) * 2.5 + 
          (s.dotBalls || 0) * 1
        );
        return { player, stats: s, mvpPoints, isEligible };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.isEligible)
      .sort((a, b) => b.mvpPoints - a.mvpPoints);
    return sorted[0] || null;
  }, [playerStats, players]);

  const generatedArticles = useMemo(() => {
    const userTeamName = userTeam?.name || "User Team";
    const userTeamShort = userTeam?.shortName || "USER";

    const dates = getSeasonDates(currentSeason);
    const auctionDateKey = dates.auctionDate;
    const seasonStartDateKey = getLeagueSeasonStartDate(currentSeason);

    const getDaysBeforeDate = (dateKey: string, days: number): string => {
      if (!dateKey) return "";
      const parts = dateKey.split("-");
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) - days);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const disappearLimitDateKey = getDaysBeforeDate(seasonStartDateKey, 7); // 7 days before season starts

    const formatDate = (dateKey: string) => {
      if (!dateKey) return "April 3, " + currentSeason;
      const parts = dateKey.split("-");
      if (parts.length < 3) return dateKey;
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const d = new Date(year, month, day);
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      return d.toLocaleDateString('en-US', options);
    };

    const formattedCurrentDate = formatDate(currentDate);
    const formattedPostAuctionDate = (() => {
      if (!auctionDateKey) return "December 16, " + (currentSeason - 1);
      const parts = auctionDateKey.split("-");
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + 1);
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      return d.toLocaleDateString('en-US', options);
    })();

    const getPlayerMatches = (playerId: string) => {
      return fixtures.filter(f => f.played && (
        (f.scorecard?.inningsA?.batting || []).some((b: any) => b.id === playerId) ||
        (f.scorecard?.inningsA?.bowling || []).some((b: any) => b.id === playerId) ||
        (f.scorecard?.inningsB?.batting || []).some((b: any) => b.id === playerId) ||
        (f.scorecard?.inningsB?.bowling || []).some((b: any) => b.id === playerId)
      )).length;
    };

    const getPlayerInnings = (playerId: string) => {
      return fixtures.filter(f => f.played && (
        (f.scorecard?.inningsA?.batting || []).some((b: any) => b.id === playerId) ||
        (f.scorecard?.inningsB?.batting || []).some((b: any) => b.id === playerId)
      )).length;
    };
    
    // Calculate season completion metrics to control article frequency
    const playedFixtures = (fixtures || []).filter((f) => f.played);
    const totalFixturesCount = (fixtures || []).length;
    const completedPercent = totalFixturesCount > 0 ? (playedFixtures.length / totalFixturesCount) * 100 : 0;
    
    // Find user team's recent matches
    const userFixtures = (fixtures || [])
      .filter((f) => f.played && (f.teamA === userTeamId || f.teamB === userTeamId))
      .sort((a, b) => b.matchNumber - a.matchNumber);
      
    const lastMatch = userFixtures[0];
    
    const seasonRetirements = retirementHistory.filter((r) => r.season === currentSeason);
    const activeRetirements = retirements.filter((r) => r.season === currentSeason);
    const finalRetirees = seasonRetirements.length > 0 ? seasonRetirements : activeRetirements;

    const findYoungRetiree = (roleCheck: (p: Player) => boolean) => {
      return finalRetirees.map(r => {
        const rId = r.playerId;
        return players[rId];
      }).filter((p): p is Player => p !== undefined).find(p => {
        const seasons = p.iplHistory?.length || 0;
        const matches = p.iplStats?.matches || 0;
        const runs = p.iplStats?.runs || 0;
        const wickets = p.iplStats?.wickets || 0;
        return p.age < 30 && seasons <= 4 && matches <= 30 && runs < 750 && wickets < 25 && roleCheck(p);
      });
    };

    const findOkRetiree = (roleCheck: (p: Player) => boolean) => {
      return finalRetirees.map(r => {
        const rId = r.playerId;
        return players[rId];
      }).filter((p): p is Player => p !== undefined).find(p => {
        const seasons = p.iplHistory?.length || 0;
        const matches = p.iplStats?.matches || 0;
        const runs = p.iplStats?.runs || 0;
        const wickets = p.iplStats?.wickets || 0;
        return p.age >= 30 && p.age <= 33 && seasons >= 5 && seasons <= 7 && matches >= 40 && matches < 100 && runs >= 750 && runs < 2000 && wickets < 90 && roleCheck(p);
      });
    };

    const findGoodRetiree = (roleCheck: (p: Player) => boolean) => {
      return finalRetirees.map(r => {
        const rId = r.playerId;
        return players[rId];
      }).filter((p): p is Player => p !== undefined).find(p => {
        const seasons = p.iplHistory?.length || 0;
        const matches = p.iplStats?.matches || 0;
        const runs = p.iplStats?.runs || 0;
        const wickets = p.iplStats?.wickets || 0;
        return p.age >= 34 && p.age <= 35 && seasons >= 8 && seasons <= 10 && matches >= 100 && matches <= 149 && runs >= 2000 && runs < 4000 && roleCheck(p);
      });
    };

    const findNormalVetRetiree = (roleCheck: (p: Player) => boolean) => {
      return finalRetirees.map(r => {
        const rId = r.playerId;
        return players[rId];
      }).filter((p): p is Player => p !== undefined).find(p => {
        const seasons = p.iplHistory?.length || 0;
        const matches = p.iplStats?.matches || 0;
        const runs = p.iplStats?.runs || 0;
        const wickets = p.iplStats?.wickets || 0;
        return p.age >= 35 && seasons >= 8 && matches >= 100 && matches < 150 && runs >= 2000 && runs < 4000 && wickets < 150 && roleCheck(p);
      });
    };

    const findLegendRetiree = (roleCheck: (p: Player) => boolean) => {
      return finalRetirees.map(r => {
        const rId = r.playerId;
        return players[rId];
      }).filter((p): p is Player => p !== undefined).find(p => {
        const seasons = p.iplHistory?.length || 0;
        const matches = p.iplStats?.matches || 0;
        const runs = p.iplStats?.runs || 0;
        const wickets = p.iplStats?.wickets || 0;
        return p.age >= 35 && seasons >= 10 && matches >= 150 && (runs >= 4000 || wickets >= 150) && roleCheck(p);
      });
    };

    // Pre-calculate if the last user match was a thrilling win
    let isLastMatchThrillingWin = false;
    if (lastMatch && lastMatch.winner === userTeamId && lastMatch.scoreA && lastMatch.scoreB) {
      const sim = lastMatch.simulation;
      const isWinnerA = lastMatch.winner === lastMatch.teamA;
      let wonByRuns = false;
      let marginVal = 0;
      if (lastMatch.winner === sim?.battingFirstTeamId) {
        wonByRuns = true;
        marginVal = Math.abs(lastMatch.scoreA.runs - lastMatch.scoreB.runs);
      } else {
        marginVal = 10 - (isWinnerA ? lastMatch.scoreA.wickets : lastMatch.scoreB.wickets); // wickets remaining
      }
      
      const chasingInningsIndex = lastMatch.winner === sim?.innings[0]?.battingTeamId ? 1 : 0;
      const chasingLegalBalls = sim?.innings[chasingInningsIndex]?.legalBalls || 0;
      
      isLastMatchThrillingWin = (wonByRuns && marginVal <= 15) || (!wonByRuns && marginVal <= 3) || (chasingLegalBalls >= 114);
    }

    // Pre-calculate if the last user match was a heavy defeat
    let isLastMatchHeavyDefeat = false;
    if (lastMatch && lastMatch.winner !== userTeamId && lastMatch.scoreA && lastMatch.scoreB) {
      const sim = lastMatch.simulation;
      if (lastMatch.winner === sim?.battingFirstTeamId) {
        const marginVal = Math.abs(lastMatch.scoreA.runs - lastMatch.scoreB.runs);
        isLastMatchHeavyDefeat = marginVal >= 50;
      } else {
        const oppWicketsLost = lastMatch.winner === lastMatch.teamA ? lastMatch.scoreA.wickets : lastMatch.scoreB.wickets;
        const wicketsRemaining = 10 - oppWicketsLost;
        isLastMatchHeavyDefeat = wicketsRemaining >= 7;
      }
    }

    // Pre-calculate if the last user match was a heartbreak loss
    let isLastMatchHeartbreakLoss = false;
    if (lastMatch && lastMatch.winner !== userTeamId && lastMatch.scoreA && lastMatch.scoreB) {
      const sim = lastMatch.simulation;
      const isWinnerA = lastMatch.winner === lastMatch.teamA;
      let wonByRuns = false;
      let marginVal = 0;
      if (lastMatch.winner === sim?.battingFirstTeamId) {
        wonByRuns = true;
        marginVal = Math.abs(lastMatch.scoreA.runs - lastMatch.scoreB.runs);
      } else {
        marginVal = 10 - (isWinnerA ? lastMatch.scoreA.wickets : lastMatch.scoreB.wickets); // wickets remaining
      }
      
      const chasingInningsIndex = lastMatch.winner === sim?.innings[0]?.battingTeamId ? 1 : 0;
      const chasingLegalBalls = sim?.innings[chasingInningsIndex]?.legalBalls || 0;
      
      isLastMatchHeartbreakLoss = (wonByRuns && marginVal <= 15) || (!wonByRuns && marginVal <= 3) || (chasingLegalBalls >= 114);
    }

    // Calculate active winning streaks for all franchises
    const teamWinsStreaks: Record<string, number> = {};
    Object.keys(teams).forEach(id => {
      teamWinsStreaks[id] = 0;
    });
    const playedFixturesChronological = [...(fixtures || [])]
      .filter(f => f.played)
      .sort((a, b) => a.matchNumber - b.matchNumber);
    playedFixturesChronological.forEach(f => {
      if (!f.winner) return;
      const loser = f.winner === f.teamA ? f.teamB : f.teamA;
      teamWinsStreaks[f.winner] += 1;
      teamWinsStreaks[loser] = 0;
    });

    const surgingTeamEntry = Object.entries(teamWinsStreaks)
      .filter(([_, wins]) => wins >= 3)
      .sort((a, b) => b[1] - a[1])[0];
    const surgingTeamId = surgingTeamEntry ? surgingTeamEntry[0] : null;
    const surgingTeamWins = surgingTeamEntry ? surgingTeamEntry[1] : 0;

    // Calculate active losing streaks for all franchises
    const teamLossesStreaks: Record<string, number> = {};
    Object.keys(teams).forEach(id => {
      teamLossesStreaks[id] = 0;
    });
    playedFixturesChronological.forEach(f => {
      if (!f.winner) return;
      const loser = f.winner === f.teamA ? f.teamB : f.teamA;
      teamLossesStreaks[loser] += 1;
      teamLossesStreaks[f.winner] = 0;
    });

    const strugglingTeamEntry = Object.entries(teamLossesStreaks)
      .filter(([_, losses]) => losses >= 3)
      .sort((a, b) => b[1] - a[1])[0];
    const strugglingTeamId = strugglingTeamEntry ? strugglingTeamEntry[0] : null;
    const strugglingTeamLosses = strugglingTeamEntry ? strugglingTeamEntry[1] : 0;

    // Post-Auction Retention calculations
    let indianOnlyRetainedTeam: Team | null = null;
    let youngsterRetainedTeam: Team | null = null;
    let youngsterRetainedPlayer: Player | null = null;
    let strongestRetainedTeam: Team | null = null;
    let strongestRetainedRating: number = 0;

    Object.values(teams).forEach(t => {
      const retainedList = (t.retainedPlayers || []).map(id => players[id]).filter((p): p is Player => p !== undefined && p.isRetained);
      if (retainedList.length > 0) {
        // Indian-only
        const allIndians = retainedList.every(p => p.nationality === "Indian");
        if (allIndians && !indianOnlyRetainedTeam) {
          indianOnlyRetainedTeam = t;
        }

        // Youngster
        const youngster = retainedList.find(p => p.age < 23 && Math.max(p.potentialBatting, p.potentialBowling) > 85);
        if (youngster && !youngsterRetainedTeam) {
          youngsterRetainedTeam = t;
          youngsterRetainedPlayer = youngster;
        }

        // Strongest Core
        if (retainedList.length >= 3) {
          const avgRating = retainedList.reduce((acc, p) => acc + Math.max(p.currentBatting, p.currentBowling), 0) / retainedList.length;
          if (avgRating > strongestRetainedRating) {
            strongestRetainedRating = avgRating;
            strongestRetainedTeam = t;
          }
        }
      }
    });

    // Top 3 Buys calculations and paragraph construction
    const nonRetainedPurchased = Object.values(players)
      .filter(p => !p.isRetained && p.currentTeamId)
      .sort((a, b) => getPlayerSalary(b) - getPlayerSalary(a));
    const top3Buys = nonRetainedPurchased.slice(0, 3);

    // User Team Roster Analysis
    const userSquad = (teams[userTeamId]?.squad || []).map(id => players[id]).filter((p): p is Player => p !== undefined);
    
    let userSquadOverviewCricinfo = "";
    let userSquadOverviewCricbuzz = "";
    let userSquadOverviewNewsletter = "";

    if (userSquad.length > 0) {
      // 1. Core indicators
      const highestRated = [...userSquad].sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling))[0];
      const highestExp = [...userSquad].sort((a, b) => (b.iplStats?.matches || 0) - (a.iplStats?.matches || 0))[0];
      const highestPot = userSquad.filter(p => p.age < 24).sort((a, b) => Math.max(b.potentialBatting, b.potentialBowling) - Math.max(a.potentialBatting, a.potentialBowling))[0] || highestRated;

      // 2. Department averages based on top starting players
      const openers = [...userSquad].filter(p => p.isOpener || p.hasBattedAt3).sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling));
      const middleOrder = [...userSquad].filter(p => p.isCoreBatter || (!p.isOpener && !p.isFinisher && p.role === "Batsman")).sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling));
      const pacers = [...userSquad].filter(p => p.role === "Pace Bowler").sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling));
      const spinners = [...userSquad].filter(p => p.role === "Spin Bowler").sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling));
      const finishers = [...userSquad].filter(p => p.isFinisher || (p.role === "All-Rounder" && p.currentBatting > 75)).sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling));

      const getTopAvgRating = (list: Player[], limit: number) => {
        if (list.length === 0) return { avg: 0, players: [] as Player[] };
        const subList = list.slice(0, limit);
        const avg = subList.reduce((acc, p) => acc + Math.max(p.currentBatting, p.currentBowling), 0) / subList.length;
        return { avg, players: subList };
      };

      const openersScore = getTopAvgRating(openers, 2);
      const middleScore = getTopAvgRating(middleOrder, 3);
      const pacersScore = getTopAvgRating(pacers, 3);
      const spinnersScore = getTopAvgRating(spinners, 2);
      const finishersScore = getTopAvgRating(finishers, 2);

      const deptScores = [
        { name: "Top-Order Batting", score: openersScore, desc: "opening partnership and top-order strategy" },
        { name: "Middle-Order Anchor", score: middleScore, desc: "crucial middle-overs batting stability" },
        { name: "Pace Bowling Attack", score: pacersScore, desc: "seam attack and death-overs department" },
        { name: "Spin Bowling Control", score: spinnersScore, desc: "spin attack and middle-overs choke department" },
        { name: "Lower-Order Finishers", score: finishersScore, desc: "finishing depth and lower-order execution" },
      ].filter(d => d.score.avg > 0);

      // Sort departments to find strongest and weakest
      const sortedDepts = [...deptScores].sort((a, b) => b.score.avg - a.score.avg);
      const strongestDept = sortedDepts[0] || { name: "Squad Depth", score: { avg: 80, players: [] as Player[] }, desc: "overall depth" };
      const weakestDept = sortedDepts[sortedDepts.length - 1] || { name: "Squad Reserves", score: { avg: 75, players: [] as Player[] }, desc: "bench strength" };

      const strongestPlayersNames = strongestDept.score.players.map(p => p.name).join(", ");
      const weakestPlayersNames = weakestDept.score.players.map(p => p.name).join(", ");

      const teamName = teams[userTeamId]?.name || "the franchise";
      const teamShort = teams[userTeamId]?.shortName || "the team";

      // 3. Format detailed strings
      userSquadOverviewCricinfo = `An analytical dive into the post-auction assembly of ${teamName} reveals a highly ambitious squad construct, though one that carries clear tactical disparities between its departments.\n\nFirst-class analysts point to the ${strongestDept.name} as the definitive crowning jewel of this roster, sporting a superb average rating of ${strongestDept.score.avg.toFixed(1)} among its starting options. Driven by elite performers like ${strongestPlayersNames}, this segment represents a top-tier asset. Opposing captains will find it incredibly difficult to disrupt this department's tactical execution, making it the primary win-condition for ${teamShort} during the tournament.\n\nConversely, the ${weakestDept.name} has emerged as a glaring tactical vulnerability, registering a modest starting average rating of ${weakestDept.score.avg.toFixed(1)}. Spearheaded by ${weakestPlayersNames || "backup resources"}, this group lacks the raw penetration and high-end depth needed to reliably match up against top-tier opposition. Opponents will undoubtedly target this specific aspect of ${teamShort}'s game, placing immense pressure on the captain to mask this weakness through smart field configurations and matchups.\n\nMarquee Core Breakdown:\n*   The Experience Anchor: ${highestExp.name} brings an invaluable veteran presence to the locker room, boasting ${highestExp.iplStats?.matches || 0} career matches. His leadership will be paramount in guiding the squad through high-pressure situations.\n*   The Rating Leader: ${highestRated.name} stands tall as the team's premium asset, carrying a supreme current rating of ${Math.max(highestRated.currentBatting, highestRated.currentBowling)}. His individual consistency will shape the team's playoff credentials.\n*   The Next-Gen Blueprint: Under-24 sensation ${highestPot.name} (Potential: ${Math.max(highestPot.potentialBatting, highestPot.potentialBowling)}) provides a major high-upside prospect. His growth curve throughout the season could elevate this team's ceiling from competitive outsiders to legitimate championship contenders.\n\nUltimately, ${teamShort} possesses the superstar power required to beat any opponent on their day, but navigating the long season will require their coaching staff to protect their vulnerable ${weakestDept.desc} while maximizing the impact of their premium starting assets.`;

      userSquadOverviewCricbuzz = `How does ${teamShort}'s brand-new roster look after a chaotic auction? We've got you covered with a complete tactical recon!\n\nLet's start with the good news: the biggest strength of this roster is undoubtedly their ${strongestDept.name}! Led by the explosive class of ${strongestPlayersNames}, this starting unit averages a stellar ${strongestDept.score.avg.toFixed(1)} rating. Expect this department to dominate and give opposing teams some serious nightmares.\n\nBut it's not all smooth sailing. The major worry is the ${weakestDept.name}, which is currently averaging a modest ${weakestDept.score.avg.toFixed(1)} among starting options. With ${weakestPlayersNames || "limited starting depth"} carrying the weight, this unit will need to exceed expectations to avoid becoming a massive target for opposition gameplans. The coaching staff has their work cut out for them to plug this leak!\n\nKey Roster Pillars:\n*   🌟 The Superstar: ${highestRated.name} is the highest-rated player at ${Math.max(highestRated.currentBatting, highestRated.currentBowling)} current rating. He is the heartbeat of this team.\n*   🧠 The Veteran: ${highestExp.name} brings the wisdom of ${highestExp.iplStats?.matches || 0} tournament appearances. His experience under the pump is worth its weight in gold.\n*   🚀 The Wonderkid: ${highestPot.name} is the designated youth star of this campaign (Potential: ${Math.max(highestPot.potentialBatting, highestPot.potentialBowling)}). Keep a close eye on his development!\n\nIf the management can manage their weaknesses and let their superstars run riot, ${teamShort} could easily be booking a ticket to the playoffs. Buckle up, fans!`;

      userSquadOverviewNewsletter = `AUCTION DEBRIEF FOR ${teamShort}! 📝\n\nThe hammer has fallen, training camps are starting, and we have graded your squad's new-look roster! Here is the tactical breakdown:\n\n🔥 Biggest Strength: ${strongestDept.name}\n*   Starting Avg: ${strongestDept.score.avg.toFixed(1)}\n*   Key Starters: ${strongestPlayersNames}\n*   Verdict: This department is loaded with championship-quality weapons. It will be the team's engine room all season long!\n\n⚠️ Vulnerable Department: ${weakestDept.name}\n*   Starting Avg: ${weakestDept.score.avg.toFixed(1)}\n*   Key Starters: ${weakestPlayersNames || "Reserves"}\n*   Verdict: Lacks elite depth. Opponents will try to attack this area, so the captain must deploy clever defensive plans to prevent a collapse!\n\n💎 Marquee Pillars:\n*   👑 Squad Leader: ${highestRated.name} (Rating: ${Math.max(highestRated.currentBatting, highestRated.currentBowling)})\n*   📊 Veteran General: ${highestExp.name} (${highestExp.iplStats?.matches || 0} Matches)\n*   ⚡ Future Superstar: ${highestPot.name} (Potential: ${Math.max(highestPot.potentialBatting, highestPot.potentialBowling)})\n\nGrade: Solid, but success hinges on squad balance. Drop a comment with your predicted starting XI! 👇`;
    }

    const getPartnershipFitText = (p: Player) => {
      if (!p.currentTeamId) return "";
      const teamObj = teams[p.currentTeamId];
      if (!teamObj) return "";
      const teamSquad = (teamObj.squad || []).filter(id => id !== p.id).map(id => players[id]).filter((x): x is Player => x !== undefined);
      const isGoodPartner = (x: Player) => Math.max(x.currentBatting, x.currentBowling) >= 82;
      
      // Separate batters into specific roles: Opener, Finisher, and Core/Middle-Order
      const isOpenerRole = (player: Player) => Boolean(player.isOpener || player.hasBattedAt3);
      const isFinisherRole = (player: Player) => Boolean(player.isFinisher);
      const isCoreBatterRole = (player: Player) => Boolean(player.isCoreBatter || (!player.isOpener && !player.isFinisher && player.role === "Batsman"));

      if (isOpenerRole(p)) {
        const otherOpener = teamSquad.find(x => isOpenerRole(x) && isGoodPartner(x));
        if (otherOpener) {
          return `He is set to form a destructive opening partnership alongside ${otherOpener.name}, giving opposing bowlers plenty of headaches early on.`;
        } else {
          return `He will be expected to anchor the top order and establish early powerplay dominance as the team's primary anchor.`;
        }
      } else if (isFinisherRole(p)) {
        const otherFinisher = teamSquad.find(x => isFinisherRole(x) && isGoodPartner(x));
        if (otherFinisher) {
          return `He joins forces with ${otherFinisher.name} to form a lethal lower-order finishing pair, providing explosive acceleration at the death.`;
        } else {
          return `His explosive power will be heavily relied upon to close out tight matches and anchor the death-overs acceleration.`;
        }
      } else if (isCoreBatterRole(p)) {
        const otherCore = teamSquad.find(x => isCoreBatterRole(x) && isGoodPartner(x));
        if (otherCore) {
          return `He is set to stabilize the middle order alongside ${otherCore.name}, anchoring the team during the crucial middle overs.`;
        } else {
          return `He will take up the key responsibility of stabilizing the middle order and anchoring the innings under pressure.`;
        }
      } else if (p.role === "Spin Bowler") {
        const otherSpinner = teamSquad.find(x => x.role === "Spin Bowler" && isGoodPartner(x));
        if (otherSpinner) {
          return `His spin capabilities will pair excellently with ${otherSpinner.name} to choke the run rate and create tandem pressure in the middle overs.`;
        } else {
          return `As the premier spin option, he will carry the burden of control and breakthroughs in the middle overs.`;
        }
      } else if (p.role === "Pace Bowler") {
        const otherPacer = teamSquad.find(x => x.role === "Pace Bowler" && isGoodPartner(x));
        if (otherPacer) {
          return `He joins forces with ${otherPacer.name} to spearhead a highly dangerous new-ball bowling partnership capable of early breakthroughs.`;
        } else {
          return `He will lead the seam attack, bringing crucial death-overs execution and early new-ball wickets.`;
        }
      } else if (p.role === "WK-Batsman" || p.isWicketkeeper) {
        return `His acquisition secures the primary wicketkeeping glovework and adds elite, multi-utility depth to the middle-order batting lineup.`;
      } else if (p.role === "All-Rounder") {
        const otherAR = teamSquad.find(x => x.role === "All-Rounder" && isGoodPartner(x));
        if (otherAR) {
          return `Alongside ${otherAR.name}, he gives the captain immense tactical flexibility with multiple bowling and batting combinations.`;
        } else {
          return `His all-round capabilities will balance the lower-middle order, offering key overs and late acceleration.`;
        }
      }
      return "He brings high-impact capability and squad balance to his new team.";
    };

    let cricinfoTop3Text = "";
    let cricbuzzTop3Text = "";
    let newsletterTop3Text = "";

    top3Buys.forEach((p, idx) => {
      const priceStr = (getPlayerSalary(p) / 100).toFixed(2) + " Cr";
      const teamName = teams[p.currentTeamId!]?.name || "their franchise";
      const teamShort = teams[p.currentTeamId!]?.shortName || "their team";
      const fitText = getPartnershipFitText(p);
      
      const runs = p.iplStats?.runs || 0;
      const wickets = p.iplStats?.wickets || 0;
      const matches = p.iplStats?.matches || 0;
      
      const isBowler = p.role === "Pace Bowler" || p.role === "Spin Bowler";
      const statsStr = isBowler 
        ? `taking ${wickets} wickets in ${matches} matches at an economy of ${(p.iplStats?.bowlingRunsConceded && p.iplStats?.bowlingBalls ? (p.iplStats.bowlingRunsConceded / (p.iplStats.bowlingBalls / 6)) : 8.0).toFixed(2)}`
        : `scoring ${runs} runs in ${matches} matches at an average of ${(runs && matches ? (runs / matches) : 25.0).toFixed(1)}`;

      const prefix = idx === 0 ? "" : "\n\n";
      cricinfoTop3Text += `${prefix}${idx + 1}. ${p.name} (${priceStr} to ${teamName})\nAs a premier ${p.role.toLowerCase()}, ${p.name} brings ${matches} matches of experience, ${statsStr}. ${fitText}`;
      cricbuzzTop3Text += `${prefix}${p.name} (${priceStr}) joins ${teamShort}! Racking up ${isBowler ? wickets + " wickets" : runs + " runs"} in his career, he is a massive addition. ${fitText}`;
      newsletterTop3Text += `${prefix}🚨 ${p.name} (${priceStr} to ${teamShort}): ${isBowler ? wickets + " Wickets" : runs + " Runs"} in ${matches} games. ${fitText}`;
    });

    // Filter templates to show generic articles or templates matching the current layout brand
    const filteredTemplates = newsTemplates.filter((t) => !t.brand || t.brand === layout);

    return filteredTemplates.map((template) => {
      const sim = lastMatch?.simulation;
      
      // Chase or defend gating
      const userInningsIndex = sim?.innings[0]?.battingTeamId === userTeamId ? 0 : 1;
      const isUserChasing = userInningsIndex === 1;
      if (template.chaseOrDefend === "chasing" && !isUserChasing) return null;
      if (template.chaseOrDefend === "defending" && isUserChasing) return null;

      // Last ball gating (chasing team faced exactly 120 legal balls)
      const chasingInningsIndex = userInningsIndex === 0 ? 1 : 0;
      const chasingLegalBallsVal = sim?.innings[chasingInningsIndex]?.legalBalls || 0;
      const isLastBallMatch = chasingLegalBallsVal === 120;
      if (template.requiresLastBall && !isLastBallMatch) return null;

      // Surging team outside top 4 gating
      if (template.requiresOutsideTopFour) {
        if (!surgingTeamId) return null;
        const surgingPos = standings.findIndex(s => s.teamId === surgingTeamId) + 1;
        const totalPlayed = standings.find(s => s.teamId === surgingTeamId)?.played || 0;
        if (surgingPos > 4 || totalPlayed <= surgingTeamWins) return null;
      }

      // Resolve target player for player-specific templates
      let targetPlayer: any = null;
      let targetPlayerStats: any = null;
      let targetPlayerMatchStats: any = null;
      
      const lastMatchBatting = lastMatch ? [
        ...(lastMatch.scorecard?.inningsA?.batting || []).map(b => ({ ...b, teamId: lastMatch.teamA })),
        ...(lastMatch.scorecard?.inningsB?.batting || []).map(b => ({ ...b, teamId: lastMatch.teamB }))
      ] : [];

      const lastMatchBowling = lastMatch ? [
        ...(lastMatch.scorecard?.inningsA?.bowling || []).map(b => ({ ...b, teamId: lastMatch.teamB })),
        ...(lastMatch.scorecard?.inningsB?.bowling || []).map(b => ({ ...b, teamId: lastMatch.teamA }))
      ] : [];

      let centuryPlayerDetected = false;
      let fiveferPlayerDetected = false;
      let benchmarkPlayerDetected = false;
      let rookiePlayerDetected = false;
      let retirementPlayerDetected = false;
      let bargainStealPlayerDetected = false;
      let bargainStealNewsletterDetected = false;
      let bigMoneyGoodDetected = false;
      let bigMoneyPoorDetected = false;
      let youngGunDetected = false;

      if (template.triggerType === "player_century") {
        const p = lastMatchBatting.find(b => (b.runs || 0) >= 100);
        if (p) {
          const notOut = Boolean(p.notOut);
          const sr = p.balls ? (p.runs || 0) / p.balls * 100 : 0;
          
          const inInningsA = lastMatch?.scorecard?.inningsA?.batting.some((b: any) => b.id === p.id);
          const playerInningsIndex = inInningsA ? 0 : 1;
          const isChaseInnings = playerInningsIndex === 1;
          const wasWinningTeam = lastMatch?.winner === (inInningsA ? lastMatch?.teamA : lastMatch?.teamB);
          const isSuccessfulChase = isChaseInnings && wasWinningTeam;

          const allScorersSorted = Object.keys(playerStats)
            .map(id => ({ id, runs: playerStats[id].runs || 0 }))
            .sort((a, b) => b.runs - a.runs);
          const orangeCapRank = allScorersSorted.findIndex(x => x.id === p.id) + 1;

          if (template.requiresOut && notOut) return null;
          if (template.requiresNotOut && !notOut) return null;
          if (template.requiresStrikeRate180 && sr < 180) return null;
          if (template.requiresSuccessfulChase && !isSuccessfulChase) return null;
          if (template.requiresOrangeCapTop3 && orangeCapRank > 3) return null;

          targetPlayer = players[p.id];
          targetPlayerStats = playerStats[p.id];
          targetPlayerMatchStats = p;
          centuryPlayerDetected = true;
        } else {
          return null;
        }
      } else if (template.triggerType === "player_fivefer") {
        const p = lastMatchBowling.find(b => (b.wickets || 0) >= 5);
        if (p) {
          let deathWickets = 0;
          let deathRunsConceded = 0;
          const bowlerId = p.id;
          sim?.innings.forEach(inn => {
            const deathOvers = inn.oversDetail.filter(o => o.number >= 16);
            deathOvers.forEach(ov => {
              ov.deliveries.forEach(del => {
                if (del.bowlerId === bowlerId) {
                  if (del.wicket) deathWickets++;
                  deathRunsConceded += del.totalRuns;
                }
              });
            });
          });

          let isCloseWin = false;
          if (lastMatch?.winner && lastMatch.scoreA && lastMatch.scoreB) {
            const isWinnerA = lastMatch.winner === lastMatch.teamA;
            const sim = lastMatch.simulation;
            if (lastMatch.winner === sim?.battingFirstTeamId) {
              isCloseWin = Math.abs(lastMatch.scoreA.runs - lastMatch.scoreB.runs) <= 15;
            } else {
              const wkts = isWinnerA ? lastMatch.scoreA.wickets : lastMatch.scoreB.wickets;
              isCloseWin = (10 - wkts) <= 3;
            }
          }

          const allBowlersSorted = Object.keys(playerStats)
            .map(id => ({ id, wickets: playerStats[id].wickets || 0 }))
            .sort((a, b) => b.wickets - a.wickets);
          const purpleCapRank = allBowlersSorted.findIndex(x => x.id === p.id) + 1;

          if (template.requiresDeathWickets3 && deathWickets < 3) return null;
          if (template.requiresCloseWin && !isCloseWin) return null;
          if (template.requiresPurpleCap1 && purpleCapRank !== 1) return null;

          targetPlayer = players[p.id];
          targetPlayerStats = playerStats[p.id];
          targetPlayerMatchStats = p;
          fiveferPlayerDetected = true;
        } else {
          return null;
        }
      } else if (template.triggerType === "player_season_benchmark") {
        if (template.requiresRunsBenchmark500) {
          const p = lastMatchBatting.find(b => {
            const currentRuns = playerStats[b.id]?.runs || 0;
            const prevRuns = currentRuns - (b.runs || 0);
            return currentRuns >= 500 && prevRuns < 500;
          });
          if (p) {
            targetPlayer = players[p.id];
            targetPlayerStats = playerStats[p.id];
            targetPlayerMatchStats = p;
            benchmarkPlayerDetected = true;
          } else {
            return null;
          }
        } else if (template.requiresWicketsBenchmark20) {
          const p = lastMatchBowling.find(b => {
            const currentWkts = playerStats[b.id]?.wickets || 0;
            const prevWkts = currentWkts - (b.wickets || 0);
            return currentWkts >= 20 && prevWkts < 20;
          });
          if (p) {
            targetPlayer = players[p.id];
            targetPlayerStats = playerStats[p.id];
            targetPlayerMatchStats = p;
            benchmarkPlayerDetected = true;
          } else {
            return null;
          }
        } else {
          return null;
        }
      } else if (template.triggerType === "player_rookie_spotlight") {
        const potmRookie = (sim?.playerOfTheMatchId && players[sim.playerOfTheMatchId]?.age && (players[sim.playerOfTheMatchId].age || 0) < 25) 
          ? players[sim.playerOfTheMatchId] 
          : null;

        const performanceRookie = lastMatchBatting.map(b => b.id).concat(lastMatchBowling.map(b => b.id)).map(id => players[id]).filter(p => p && p.age && p.age < 25).find(p => {
          const stats = playerStats[p.id];
          const matchRuns = lastMatchBatting.find(b => b.id === p.id)?.runs || 0;
          const matchWickets = lastMatchBowling.find(b => b.id === p.id)?.wickets || 0;
          return getPlayerMatches(p.id) >= 3 && (matchRuns >= 50 || matchWickets >= 3);
        });

        const rookiePlayer = potmRookie || performanceRookie;
        if (rookiePlayer) {
          targetPlayer = rookiePlayer;
          targetPlayerStats = playerStats[rookiePlayer.id];
          targetPlayerMatchStats = lastMatchBatting.find(b => b.id === rookiePlayer.id) || lastMatchBowling.find(b => b.id === rookiePlayer.id);
          rookiePlayerDetected = true;
        } else {
          return null;
        }
      } else if (template.triggerType === "player_retirement") {
        const retiree = finalRetirees.find(r => r.season === currentSeason) || lastMatchBatting.map(b => players[b.id]).find(p => p && p.age && p.age >= 35 && completedPercent === 100);
        if (retiree) {
          const rId = "playerId" in retiree ? retiree.playerId : retiree.id;
          targetPlayer = players[rId] || retiree;
          targetPlayerStats = playerStats[rId];
          retirementPlayerDetected = true;
        } else {
          if (finalRetirees.length > 0) {
            const firstRetiree = finalRetirees[0];
            targetPlayer = players[firstRetiree.playerId] || firstRetiree;
            targetPlayerStats = playerStats[firstRetiree.playerId];
            retirementPlayerDetected = true;
          } else {
            return null;
          }
        }
      } else if (template.triggerType === "retire_young_toporder") {
        const check = (p: Player) => Boolean(p.isOpener || p.hasBattedAt3);
        const p = findYoungRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_young_middle") {
        const check = (p: Player) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher);
        const p = findYoungRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_young_keeper") {
        const check = (p: Player) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper);
        const p = findYoungRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_young_bowler") {
        const check = (p: Player) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting);
        const p = findYoungRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_ok_toporder") {
        const check = (p: Player) => Boolean(p.isOpener || p.hasBattedAt3);
        const p = findOkRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_ok_middle") {
        const check = (p: Player) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher);
        const p = findOkRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_ok_keeper") {
        const check = (p: Player) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper);
        const p = findOkRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_ok_bowler") {
        const check = (p: Player) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting);
        const p = findOkRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_good_toporder") {
        const check = (p: Player) => Boolean(p.isOpener || p.hasBattedAt3);
        const p = findGoodRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_good_middle") {
        const check = (p: Player) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher);
        const p = findGoodRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_good_keeper") {
        const check = (p: Player) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper);
        const p = findGoodRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_good_bowler") {
        const check = (p: Player) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting);
        const p = findGoodRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_vet_normal_toporder") {
        const check = (p: Player) => Boolean(p.isOpener || p.hasBattedAt3);
        const p = findNormalVetRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_vet_normal_middle") {
        const check = (p: Player) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher);
        const p = findNormalVetRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_vet_normal_keeper") {
        const check = (p: Player) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper);
        const p = findNormalVetRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_vet_normal_bowler") {
        const check = (p: Player) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting);
        const p = findNormalVetRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_legend_toporder") {
        const check = (p: Player) => Boolean(p.isOpener || p.hasBattedAt3);
        const p = findLegendRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_legend_middle") {
        const check = (p: Player) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher);
        const p = findLegendRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_legend_keeper") {
        const check = (p: Player) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper);
        const p = findLegendRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "retire_legend_bowler") {
        const check = (p: Player) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting);
        const p = findLegendRetiree(check);
        if (p) {
          targetPlayer = p;
          targetPlayerStats = playerStats[p.id];
        } else {
          return null;
        }
      } else if (template.triggerType === "post_auction_retained_indians_only") {
        if (!indianOnlyRetainedTeam) {
          return null;
        }
      } else if (template.triggerType === "post_auction_retained_youngster") {
        if (youngsterRetainedTeam && youngsterRetainedPlayer) {
          targetPlayer = youngsterRetainedPlayer;
        } else {
          return null;
        }
      } else if (template.triggerType === "post_auction_retained_strongest_core") {
        if (!strongestRetainedTeam) {
          return null;
        }
      } else if (template.triggerType === "post_auction_three_biggest_buys") {
        if (top3Buys.length < 3) {
          return null;
        }
      } else if (template.triggerType === "post_auction_user_team_summary") {
        const userSquad = (teams[userTeamId]?.squad || []).map(id => players[id]).filter((p): p is Player => p !== undefined);
        if (userSquad.length === 0) {
          return null;
        }
      } else if (template.triggerType === "auction_bargain_cricbuzz") {
        const potmId = sim?.playerOfTheMatchId;
        const potmPlayer = potmId ? players[potmId] : null;
        const potmPrice = potmPlayer ? getPlayerSalary(potmPlayer) : 0;
        const potmBatStats = potmId ? lastMatchBatting.find(b => b.id === potmId) : null;
        const potmBowlStats = potmId ? lastMatchBowling.find(b => b.id === potmId) : null;
        const potmRuns = potmBatStats?.runs || 0;
        const potmWickets = potmBowlStats?.wickets || 0;
        
        if (completedPercent < 35 && potmPrice <= 200 && potmId && (potmRuns >= 35 || potmWickets >= 3)) {
          targetPlayer = potmPlayer;
          targetPlayerStats = playerStats[potmId];
          targetPlayerMatchStats = potmBatStats || potmBowlStats;
          bargainStealPlayerDetected = true;
        } else {
          return null;
        }
      } else if (template.triggerType === "auction_bargain_newsletter") {
        const bargainPlayer = lastMatchBatting.map(b => b.id).concat(lastMatchBowling.map(b => b.id)).map(id => id ? players[id] : null).filter((p): p is NonNullable<typeof p> => p !== null && getPlayerSalary(p) <= 200).find(p => {
          const bat = lastMatchBatting.find(b => b.id === p.id);
          const bowl = lastMatchBowling.find(b => b.id === p.id);
          const runs = bat?.runs || 0;
          const balls = bat?.balls || 1;
          const sr = (runs / balls) * 100;
          const wickets = bowl?.wickets || 0;
          const econ = bowl ? ((bowl.runsConceded || 0) / (bowl.overs || 1)) : 99;
          return (runs >= 40 && sr >= 140) || (wickets >= 3 && econ <= 8.0);
        });
        if (completedPercent < 35 && bargainPlayer && bargainPlayer.id) {
          targetPlayer = bargainPlayer;
          targetPlayerStats = playerStats[bargainPlayer.id];
          targetPlayerMatchStats = lastMatchBatting.find(b => b.id === bargainPlayer.id) || lastMatchBowling.find(b => b.id === bargainPlayer.id);
          bargainStealNewsletterDetected = true;
        } else {
          return null;
        }
      } else if (template.triggerType === "auction_bigmoney_good") {
        const bmPlayer = lastMatchBatting.map(b => b.id).concat(lastMatchBowling.map(b => b.id)).map(id => id ? players[id] : null).filter((p): p is NonNullable<typeof p> => p !== null && getPlayerSalary(p) >= 1000).find(p => {
          const runs = lastMatchBatting.find(b => b.id === p.id)?.runs || 0;
          const wickets = lastMatchBowling.find(b => b.id === p.id)?.wickets || 0;
          return runs >= 40 || wickets >= 2;
        });
        if (completedPercent < 35 && bmPlayer && bmPlayer.id) {
          targetPlayer = bmPlayer;
          targetPlayerStats = playerStats[bmPlayer.id];
          targetPlayerMatchStats = lastMatchBatting.find(b => b.id === bmPlayer.id) || lastMatchBowling.find(b => b.id === bmPlayer.id);
          bigMoneyGoodDetected = true;
        } else {
          return null;
        }
      } else if (template.triggerType === "auction_bigmoney_poor") {
        const bmPoorPlayer = Object.keys(playerStats).map(id => players[id]).filter((p): p is NonNullable<typeof p> => p !== null && getPlayerSalary(p) >= 1000).find(p => {
          const stats = playerStats[p.id];
          const matches = getPlayerMatches(p.id);
          const runs = stats?.runs || 0;
          const innings = getPlayerInnings(p.id) || matches || 1;
          const battingAvg = runs / innings;
          const wickets = stats?.wickets || 0;
          const runsConceded = stats?.runsConceded || 0;
          const bowlingAvg = wickets > 0 ? (runsConceded / wickets) : (runsConceded > 0 ? 99 : 0);
          
          const isPoorBat = battingAvg < 20.0 && runs > 0;
          const isPoorBowl = bowlingAvg > 35.0 && wickets > 0;
          return matches >= 3 && (isPoorBat || isPoorBowl);
        });
        if (completedPercent < 35 && bmPoorPlayer && bmPoorPlayer.id) {
          targetPlayer = bmPoorPlayer;
          targetPlayerStats = playerStats[bmPoorPlayer.id];
          bigMoneyPoorDetected = true;
        } else {
          return null;
        }
      } else if (template.triggerType === "rookie_spotlight_newsletter") {
        const ygPlayer = lastMatchBatting.map(b => b.id).concat(lastMatchBowling.map(b => b.id)).map(id => id ? players[id] : null).filter((p): p is NonNullable<typeof p> => p !== null && p.age < 25).find(p => {
          const stats = playerStats[p.id];
          if (!stats || getPlayerMatches(p.id) < 3) return false;
          const bat = lastMatchBatting.find(b => b.id === p.id);
          const bowl = lastMatchBowling.find(b => b.id === p.id);
          const runs = bat?.runs || 0;
          const balls = bat?.balls || 1;
          const sr = (runs / balls) * 100;
          const wickets = bowl?.wickets || 0;
          const econ = bowl ? ((bowl.runsConceded || 0) / (bowl.overs || 1)) : 99;
          return (runs >= 35 && sr >= 130) || (wickets >= 2 && econ <= 7.5);
        });
        if (ygPlayer && ygPlayer.id) {
          targetPlayer = ygPlayer;
          targetPlayerStats = playerStats[ygPlayer.id];
          targetPlayerMatchStats = lastMatchBatting.find(b => b.id === ygPlayer.id) || lastMatchBowling.find(b => b.id === ygPlayer.id);
          youngGunDetected = true;
        } else {
          return null;
        }
      }

      // 1. Check if the trigger condition is met
      const isAuctionCompleted = teams[userTeamId] ? (teams[userTeamId].squad?.length || 0) > 10 : false;
      let isTriggered = false;
      const lastMatchOpponentId = lastMatch ? (lastMatch.teamA === userTeamId ? lastMatch.teamB : lastMatch.teamA) : null;
      const lastMatchOpponent = lastMatchOpponentId ? teams[lastMatchOpponentId] : null;
      
      const isWinnerA = lastMatch?.winner === lastMatch?.teamA;
      let wonByRuns = false;
      let marginVal = 0;
      if (lastMatch?.winner && lastMatch.scoreA && lastMatch.scoreB) {
        if (lastMatch.winner === sim?.battingFirstTeamId) {
          wonByRuns = true;
          marginVal = Math.abs(lastMatch.scoreA.runs - lastMatch.scoreB.runs);
        } else {
          marginVal = 10 - (isWinnerA ? lastMatch.scoreA.wickets : lastMatch.scoreB.wickets);
        }
      }

      switch (template.triggerType) {
        case "user_win":
          isTriggered = Boolean(lastMatch && lastMatch.winner === userTeamId && !isLastMatchThrillingWin);
          break;
        case "user_thrilling_win":
          isTriggered = isLastMatchThrillingWin;
          break;
        case "user_loss":
          isTriggered = Boolean(lastMatch && lastMatch.winner !== userTeamId && !isLastMatchHeavyDefeat && !isLastMatchHeartbreakLoss);
          break;
        case "user_heavy_defeat":
          isTriggered = isLastMatchHeavyDefeat;
          break;
        case "user_heartbreak_loss":
          isTriggered = isLastMatchHeartbreakLoss;
          break;
        case "user_default":
          isTriggered = userFixtures.length > 0;
          break;
        case "mid_season":
          isTriggered = (completedPercent >= 35 && completedPercent <= 65) || completedPercent === 100;
          break;
        case "post_season":
          isTriggered = completedPercent === 100;
          break;
        case "player_retirement":
          isTriggered = retirementPlayerDetected;
          break;
        case "player_century":
          isTriggered = centuryPlayerDetected;
          break;
        case "player_fivefer":
          isTriggered = fiveferPlayerDetected;
          break;
        case "player_season_benchmark":
          isTriggered = benchmarkPlayerDetected;
          break;
        case "player_rookie_spotlight":
          isTriggered = rookiePlayerDetected;
          break;
        case "player_milestone":
          isTriggered = Boolean((topScorer && topScorer.stats.runs > 150) || (topWicketTaker && topWicketTaker.stats.wickets > 6));
          break;
        case "league_standing":
          isTriggered = playedFixtures.length >= 3;
          break;
        case "retire_young_toporder":
          isTriggered = findYoungRetiree((p) => Boolean(p.isOpener || p.hasBattedAt3)) !== undefined;
          break;
        case "retire_young_middle":
          isTriggered = findYoungRetiree((p) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher)) !== undefined;
          break;
        case "retire_young_keeper":
          isTriggered = findYoungRetiree((p) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper)) !== undefined;
          break;
        case "retire_young_bowler":
          isTriggered = findYoungRetiree((p) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting)) !== undefined;
          break;
        case "retire_ok_toporder":
          isTriggered = findOkRetiree((p) => Boolean(p.isOpener || p.hasBattedAt3)) !== undefined;
          break;
        case "retire_ok_middle":
          isTriggered = findOkRetiree((p) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher)) !== undefined;
          break;
        case "retire_ok_keeper":
          isTriggered = findOkRetiree((p) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper)) !== undefined;
          break;
        case "retire_ok_bowler":
          isTriggered = findOkRetiree((p) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting)) !== undefined;
          break;
        case "retire_good_toporder":
          isTriggered = findGoodRetiree((p) => Boolean(p.isOpener || p.hasBattedAt3)) !== undefined;
          break;
        case "retire_good_middle":
          isTriggered = findGoodRetiree((p) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher)) !== undefined;
          break;
        case "retire_good_keeper":
          isTriggered = findGoodRetiree((p) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper)) !== undefined;
          break;
        case "retire_good_bowler":
          isTriggered = findGoodRetiree((p) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting)) !== undefined;
          break;
        case "retire_vet_normal_toporder":
          isTriggered = findNormalVetRetiree((p) => Boolean(p.isOpener || p.hasBattedAt3)) !== undefined;
          break;
        case "retire_vet_normal_middle":
          isTriggered = findNormalVetRetiree((p) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher)) !== undefined;
          break;
        case "retire_vet_normal_keeper":
          isTriggered = findNormalVetRetiree((p) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper)) !== undefined;
          break;
        case "retire_vet_normal_bowler":
          isTriggered = findNormalVetRetiree((p) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting)) !== undefined;
          break;
        case "retire_legend_toporder":
          isTriggered = findLegendRetiree((p) => Boolean(p.isOpener || p.hasBattedAt3)) !== undefined;
          break;
        case "retire_legend_middle":
          isTriggered = findLegendRetiree((p) => Boolean(p.hasBattedAt4 || p.hasBattedAt5 || p.hasBattedAt6 || p.hasBattedAt7 || p.isFinisher)) !== undefined;
          break;
        case "retire_legend_keeper":
          isTriggered = findLegendRetiree((p) => p.role === "WK-Batsman" || Boolean(p.isWicketkeeper)) !== undefined;
          break;
        case "retire_legend_bowler":
          isTriggered = findLegendRetiree((p) => p.role === "Pace Bowler" || p.role === "Spin Bowler" || (p.role === "All-Rounder" && p.currentBowling > p.currentBatting)) !== undefined;
          break;
        case "auction_bargain_cricbuzz":
          isTriggered = bargainStealPlayerDetected;
          break;
        case "auction_bargain_newsletter":
          isTriggered = bargainStealNewsletterDetected;
          break;
        case "auction_bigmoney_good":
          isTriggered = bigMoneyGoodDetected;
          break;
        case "auction_bigmoney_poor":
          isTriggered = bigMoneyPoorDetected;
          break;
        case "rookie_spotlight_newsletter":
          isTriggered = youngGunDetected;
          break;
        case "franchise_freefall_crisis": {
          const strugglingTeamPPWickets = (() => {
            if (!lastMatch || !strugglingTeamId) return 0;
            const simInn = lastMatch.simulation?.innings;
            if (!simInn) return 0;
            const batInn = simInn.find((inn: any) => inn.battingTeamId === strugglingTeamId);
            if (!batInn) return 0;
            const ppOvers = batInn.oversDetail.slice(0, 6);
            return ppOvers.reduce((sum: number, ov: any) => sum + ov.wickets, 0);
          })();
          isTriggered = Boolean(strugglingTeamId && strugglingTeamLosses >= 3 && strugglingTeamLosses < 6 && strugglingTeamPPWickets >= 2);
          break;
        }
        case "mid_season_mvp": {
          const topTeamHasTop3OrangeOrPurple = (() => {
            const topTeamIdVal = standings[0]?.teamId;
            if (!topTeamIdVal) return false;
            const top3Scorers = Object.entries(playerStats)
              .map(([id, s]) => ({ id, runs: s.runs || 0 }))
              .sort((a, b) => b.runs - a.runs)
              .slice(0, 3);
            const top3Bowlers = Object.entries(playerStats)
              .map(([id, s]) => ({ id, wickets: s.wickets || 0 }))
              .sort((a, b) => b.wickets - a.wickets)
              .slice(0, 3);
            const hasBatter = top3Scorers.some(x => players[x.id]?.currentTeamId === topTeamIdVal);
            const hasBowler = top3Bowlers.some(x => players[x.id]?.currentTeamId === topTeamIdVal);
            return hasBatter || hasBowler;
          })();
          isTriggered = completedPercent >= 35 && completedPercent <= 65 && topTeamHasTop3OrangeOrPurple;
          break;
        }
        case "early_pace_setter":
          isTriggered = playedFixtures.length >= 3 && completedPercent < 35 && standings.length > 0;
          break;
        case "early_slow_starter":
          isTriggered = playedFixtures.length >= 3 && completedPercent < 35 && standings.length >= 9;
          break;
        case "early_table_shakeup":
          isTriggered = playedFixtures.length >= 3 && completedPercent < 35;
          break;
        case "early_warning_signs": {
          const hasStrugglingTeam = standings.length >= 9 && standings.slice(-2).some(s => s.lost >= 2);
          isTriggered = playedFixtures.length >= 3 && completedPercent < 35 && hasStrugglingTeam;
          break;
        }
        case "early_points_table":
          isTriggered = playedFixtures.length >= 3 && completedPercent < 35;
          break;
        case "early_form_tracker":
          isTriggered = playedFixtures.length >= 3 && completedPercent < 35;
          break;
        case "playoff_nrr_maze":
          isTriggered = completedPercent >= 70 && completedPercent < 100 && standings.length >= 5 && standings[3].points === standings[4].points;
          break;
        case "playoff_permutations":
          isTriggered = completedPercent >= 70 && completedPercent < 100 && standings.length >= 3 && standings[0].points - standings[2].points <= 2;
          break;
        case "playoff_squeaky_bum":
          isTriggered = completedPercent >= 70 && completedPercent < 100 && standings.length >= 6 && standings[3].points - standings[5].points <= 2;
          break;
        case "playoff_must_win":
          isTriggered = completedPercent >= 70 && completedPercent < 100;
          break;
        case "playoff_nrr_calc":
          isTriggered = completedPercent >= 70 && completedPercent < 100 && standings.length >= 5 && standings[3].points === standings[4].points;
          break;
        case "playoff_top4_battle":
          isTriggered = completedPercent >= 70 && completedPercent < 100;
          break;
        case "elimination_threshold": {
          const totalMatchesPerTeam = fixtures.length > 0 
            ? fixtures.filter(f => f.teamA === userTeamId || f.teamB === userTeamId).length 
            : 14;
          isTriggered = standings.some(s => s.points + (totalMatchesPerTeam - s.played) * 2 < (standings[3]?.points || 0));
          break;
        }
        case "elimination_brink": {
          const totalMatchesPerTeam = fixtures.length > 0 
            ? fixtures.filter(f => f.teamA === userTeamId || f.teamB === userTeamId).length 
            : 14;
          isTriggered = standings.some(s => s.points + (totalMatchesPerTeam - s.played) * 2 === (standings[3]?.points || 0) && s.played < totalMatchesPerTeam);
          break;
        }
        case "top2_q1_premium":
          isTriggered = completedPercent >= 80 && completedPercent < 100 && standings.length >= 3 && standings[0].points - standings[2].points <= 2;
          break;
        case "top2_spot_battle":
          isTriggered = completedPercent >= 80 && completedPercent < 100 && standings.length >= 2 && standings[0].points === standings[1].points;
          break;
        case "auction_review":
          isTriggered = playedFixtures.length >= 3 && completedPercent < 35;
          break;
        case "post_auction_summary":
          isTriggered = playedFixtures.length === 0 && isAuctionCompleted && currentDate >= auctionDateKey && currentDate < disappearLimitDateKey;
          break;
        case "post_auction_retained_indians_only":
          isTriggered = playedFixtures.length === 0 && indianOnlyRetainedTeam !== null && currentDate >= dates.retentionDate && currentDate < disappearLimitDateKey;
          break;
        case "post_auction_retained_youngster":
          isTriggered = playedFixtures.length === 0 && youngsterRetainedTeam !== null && youngsterRetainedPlayer !== null && currentDate >= dates.retentionDate && currentDate < disappearLimitDateKey;
          break;
        case "post_auction_retained_strongest_core":
          isTriggered = playedFixtures.length === 0 && strongestRetainedTeam !== null && currentDate >= dates.retentionDate && currentDate < disappearLimitDateKey;
          break;
        case "post_auction_three_biggest_buys":
          isTriggered = playedFixtures.length === 0 && isAuctionCompleted && top3Buys.length >= 3 && currentDate >= auctionDateKey && currentDate < disappearLimitDateKey;
          break;
        case "post_auction_user_team_summary":
          isTriggered = playedFixtures.length === 0 && isAuctionCompleted && (teams[userTeamId]?.squad?.length || 0) > 0 && currentDate >= auctionDateKey && currentDate < disappearLimitDateKey;
          break;
        case "franchise_form_surge":
          isTriggered = Boolean(surgingTeamId && surgingTeamWins >= 3 && surgingTeamWins < 6);
          break;
        case "franchise_extended_surge":
          isTriggered = Boolean(surgingTeamId && surgingTeamWins >= 6);
          break;
        case "franchise_freefall":
          isTriggered = Boolean(strugglingTeamId && strugglingTeamLosses >= 3 && strugglingTeamLosses < 6);
          break;
        case "franchise_severe_freefall":
          isTriggered = Boolean(strugglingTeamId && strugglingTeamLosses >= 6);
          break;
        default:
          isTriggered = true;
      }
      
      if (!isTriggered) return null;
      
      // 2. Perform token replacements
      let title = template.title;
      let subheading = template.subheading;
      let content = template.content;
      
      // Extract exact scorecard stats from lastMatch if available
      const battingA = lastMatch?.scorecard?.inningsA?.batting || [];
      const battingB = lastMatch?.scorecard?.inningsB?.batting || [];
      const bowlingA = lastMatch?.scorecard?.inningsA?.bowling || [];
      const bowlingB = lastMatch?.scorecard?.inningsB?.bowling || [];
      
      const isUserTeamA = lastMatch?.teamA === userTeamId;
      const userBatting = isUserTeamA ? battingA : battingB;
      const oppBatting = isUserTeamA ? battingB : battingA;
      
      // Exact match top scorers/bowlers
      const allMatchBatting = [...battingA, ...battingB];
      const matchTopScorer = allMatchBatting.length > 0
        ? [...allMatchBatting].sort((a, b) => (b.runs || 0) - (a.runs || 0))[0]
        : null;
        
      const allMatchBowling = [...bowlingA, ...bowlingB];
      const matchTopBowler = allMatchBowling.length > 0
        ? [...allMatchBowling].sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.runsConceded || 0) - (b.runsConceded || 0))[0]
        : null;
        
      // Boundaries count conceded by user team bowlers (opponent fours + sixes)
      const oppFours = oppBatting.reduce((sum: number, b: any) => sum + (b.fours || 0), 0);
      const oppSixes = oppBatting.reduce((sum: number, b: any) => sum + (b.sixes || 0), 0);
      const bowlingBoundaryCount = oppFours + oppSixes;

      const venue = sim?.conditions?.stadiumName || "Eden Gardens";
      
      // Exact win margin format
      let winMargin = "a tight margin";
      if (lastMatch?.winner && lastMatch.scoreA && lastMatch.scoreB) {
        if (lastMatch.winner === sim?.battingFirstTeamId) {
          winMargin = `${marginVal} runs`;
        } else {
          winMargin = `${marginVal} wickets`;
        }
      }

      // Calculate exact powerplay runs (overs 0-5) in the first innings
      const firstInningsOvers = sim?.innings[0]?.oversDetail || [];
      const powerplayRuns = firstInningsOvers.slice(0, 6).reduce((sum: number, ov: any) => sum + ov.runs, 0) || 48;

      // Calculate struggling team's powerplay score in current match (if they played)
      let ppRunsVal = powerplayRuns;
      let ppWktsVal = 2; // Default fallback for crisis template
      if (strugglingTeamId && lastMatch && (lastMatch.teamA === strugglingTeamId || lastMatch.teamB === strugglingTeamId)) {
        const simInn = lastMatch.simulation?.innings;
        if (simInn) {
          const batInn = simInn.find((inn: any) => inn.battingTeamId === strugglingTeamId);
          if (batInn) {
            const ppOvers = batInn.oversDetail.slice(0, 6);
            ppRunsVal = ppOvers.reduce((sum: number, ov: any) => sum + ov.runs, 0);
            ppWktsVal = ppOvers.reduce((sum: number, ov: any) => sum + ov.wickets, 0);
          }
        }
      }

      // Calculate exact last 3 overs runs for user team's batting innings
      const userOversDetail = sim?.innings[userInningsIndex]?.oversDetail || [];
      const last3OversRuns = userOversDetail.slice(-3).reduce((sum: number, ov: any) => sum + ov.runs, 0) || 39;

      // Key Bowler Over (the over with the most wickets, or low economy)
      const winnerInningsIndex = lastMatch?.winner === sim?.innings[0]?.battingTeamId ? 1 : 0;
      const winnerBowlingOvers = sim?.innings[winnerInningsIndex]?.oversDetail || [];
      const bestOver = [...winnerBowlingOvers].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
      const keyBowlerOver = bestOver ? `${bestOver.number}th` : "16th";

      // Opponent batting collapse detection (e.g. 3 wickets in a phase)
      const oppInningsIndex = userInningsIndex === 0 ? 1 : 0;
      const oppFow = sim?.innings[oppInningsIndex]?.fallOfWickets || [];
      let collapseWickets = 3;
      let collapseRuns = 15;
      if (oppFow.length >= 3) {
        let minDiff = 999;
        for (let i = 0; i <= oppFow.length - 3; i++) {
          const diff = oppFow[i + 2].score - oppFow[i].score;
          if (diff < minDiff) {
            minDiff = diff;
          }
        }
        collapseRuns = minDiff === 999 ? 15 : minDiff;
      }
      const keyPhaseOvers = "10-15";

      // Player of the match details
      const potmName = sim?.playerOfTheMatchName || matchTopScorer?.name || "Team Performance";
      let potmPerformance = "a solid team effort";
      if (sim?.playerOfTheMatchId) {
        const potmBatStats = [...battingA, ...battingB].find(b => b.id === sim.playerOfTheMatchId);
        const potmBowlStats = [...bowlingA, ...bowlingB].find(b => b.id === sim.playerOfTheMatchId);
        if (potmBatStats && (potmBatStats.runs || 0) > 0) {
          potmPerformance = `${potmBatStats.runs} runs off ${potmBatStats.balls} balls`;
        } else if (potmBowlStats) {
          potmPerformance = `${potmBowlStats.wickets} wickets for ${potmBowlStats.runsConceded} runs`;
        }
      }

      // Thrilling Win specific scorecard extractions
      const oppBattingCard = sim?.innings[oppInningsIndex]?.batting || [];
      const oppTopScorer = [...oppBattingCard].sort((a, b) => (b.runs || 0) - (a.runs || 0))[0];
      const opponentKeyBatter = oppTopScorer?.name || "Opponent Batter";
      const opponentKeyBatterRuns = String(oppTopScorer?.runs || 0);
      const opponentKeyBatterBalls = String(oppTopScorer?.balls || 0);

      const chasingOvers = sim?.innings[oppInningsIndex]?.oversDetail || [];
      const lastOverDetail = chasingOvers.length > 0 ? chasingOvers[chasingOvers.length - 1] : null;
      const userDeathBowler = lastOverDetail?.bowlerName || matchTopBowler?.name || "Death Bowler";
      const lastOverConcededRuns = lastOverDetail ? lastOverDetail.runs : 6;
      const lastOverWickets = lastOverDetail ? lastOverDetail.wickets : 1;
      const lastOverRequiredRuns = lastOverConcededRuns + (wonByRuns ? marginVal : 0);

      const chasingLegalBalls = sim?.innings[oppInningsIndex]?.legalBalls || 0;
      const ballsRemaining = Math.max(0, 120 - chasingLegalBalls);
      
      const oppInningsOvers = sim?.innings[oppInningsIndex]?.oversDetail || [];
      const over19 = oppInningsOvers.find(o => o.number === 19);
      const penultimateOverRuns = over19 ? over19.runs : 14;

      const last3OversRequiredRuns = oppInningsOvers.slice(-3).reduce((sum: number, ov: any) => sum + ov.runs, 0) || 30;

      const matchUserFinisher = [...userBatting]
        .filter((b, idx) => idx >= 4 && b.notOut)
        .sort((a, b) => (b.runs || 0) - (a.runs || 0))[0] || matchTopScorer;
      const userFinisherName = matchUserFinisher?.name || "Finisher";
      const userFinisherRuns = String(matchUserFinisher?.runs || 0);
      const userFinisherBalls = String(matchUserFinisher?.balls || 0);
      const userFinisherSixesCount = String(matchUserFinisher?.sixes || 0);

      const winningBallDelivery = lastOverDetail ? `over ${lastOverDetail.number}.${lastOverDetail.deliveries.length}` : "the last ball";

      const oppCatchDismissal = oppBattingCard.find(b => b.dismissal?.includes("c "));
      const fielderName = oppCatchDismissal ? oppCatchDismissal.dismissal.split("c ")[1]?.split(" b")[0] || "fielder" : "the fielder";
      const winningRunsHit = (matchUserFinisher?.sixes || 0) > 0 ? "a six" : "a boundary";

      // Heavy Defeat specific scorecard calculations
      const userBattedFirst = sim?.battingFirstTeamId === userTeamId;
      const userChoiceOption = userBattedFirst ? "bat first" : "bowl first";

      const userOversDetailInnings = sim?.innings[userInningsIndex]?.oversDetail || [];
      const userPowerplayRuns = userOversDetailInnings.slice(0, 6).reduce((sum: number, ov: any) => sum + ov.runs, 0) || 36;
      const userPowerplayWickets = userOversDetailInnings.slice(0, 6).reduce((sum: number, ov: any) => sum + ov.wickets, 0) || 2;

      const oppBowling = lastMatch?.teamA === userTeamId ? bowlingB : bowlingA;
      const oppTopBowler = oppBowling.length > 0
        ? [...oppBowling].sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.runsConceded || 0) - (b.runsConceded || 0))[0]
        : null;
      const oppStarBowler = oppTopBowler?.name || "Opposition Bowler";
      const oppStarBowlerWickets = String(oppTopBowler?.wickets || 0);
      const oppStarBowlerRuns = String(oppTopBowler?.runsConceded || 0);

      const opponentOversFaced = String(sim?.innings[oppInningsIndex]?.overs || 19.1);

      const userMiddleOvers = userOversDetailInnings.slice(6, 15);
      const userMiddleOversRuns = userMiddleOvers.reduce((sum: number, ov: any) => sum + ov.runs, 0) || 55;
      const userMiddleOversWickets = userMiddleOvers.reduce((sum: number, ov: any) => sum + ov.wickets, 0) || 3;

      const oppInningsObj = sim?.innings[oppInningsIndex];
      const userExtrasConceded = String(oppInningsObj?.extras?.total || 7);

      const userFow = sim?.innings[userInningsIndex]?.fallOfWickets || [];
      const userEarlyCollapseRuns = userFow.length >= 3 ? String(userFow[2].score) : "24";

      const oppOversDetail = sim?.innings[oppInningsIndex]?.oversDetail || [];
      const oppPowerplayRuns = oppOversDetail.slice(0, 6).reduce((sum: number, ov: any) => sum + ov.runs, 0) || 45;

      const dryOversRange = "8-13";
      
      const captainId = teams[userTeamId]?.captainContinuityId;
      const userCaptainName = captainId && players[captainId] ? players[captainId].name : "Captain";

      // Heartbreak specific scorecard extractions
      const oppMiddleOver = oppOversDetail.find(o => o.number === 15);
      const oppMiddleOversScore = oppMiddleOver 
        ? `${oppMiddleOver.scoreAfter}/${oppMiddleOver.wicketsAfter}` 
        : "105/3";

      const oppLastOverBoundaries = lastOverDetail?.deliveries?.filter((d: any) => d.runs === 4 || d.runs === 6).length || 1;
      const oppLast3OversRuns = oppOversDetail.slice(-3).reduce((sum: number, ov: any) => sum + ov.runs, 0) || 30;

      const oppFinisher = [...oppBattingCard]
        .filter((b, idx) => idx >= 4 && b.notOut)
        .sort((a, b) => (b.runs || 0) - (a.runs || 0))[0] || oppTopScorer;
      const oppFinisherName = oppFinisher?.name || "Finisher";
      const oppFinisherRuns = String(oppFinisher?.runs || 0);
      const oppFinisherBalls = String(oppFinisher?.balls || 0);

      const oppBowlerName = lastOverDetail?.bowlerName || oppStarBowler || "Opponent Bowler";

      const userInningsOversDetail = sim?.innings[userInningsIndex]?.oversDetail || [];
      const userOver19 = userInningsOversDetail.find(o => o.number === 19);
      const penultimateOverConceded = userOver19 ? userOver19.runs : 8;

      const userLastOver = userInningsOversDetail[userInningsOversDetail.length - 1];
      const userLastOverRuns = userLastOver ? userLastOver.runs : 6;

      const dotBallDeficit = "4";
      const userBatterName = matchUserFinisher?.name || matchTopScorer?.name || "Batter";

      const tokens: Record<string, string> = {
        "{userTeamName}": userTeamName,
        "{userTeamShort}": userTeamShort,
        "{opponentName}": lastMatchOpponent?.name || "Opposition",
        "{opponentShort}": lastMatchOpponent?.shortName || "OPP",
        "{userRuns}": lastMatch ? String(lastMatch.teamA === userTeamId ? lastMatch.scoreA?.runs || 0 : lastMatch.scoreB?.runs || 0) : "0",
        "{userWickets}": lastMatch ? String(lastMatch.teamA === userTeamId ? lastMatch.scoreA?.wickets || 0 : lastMatch.scoreB?.wickets || 0) : "0",
        "{opponentRuns}": lastMatch ? String(lastMatch.teamA === userTeamId ? lastMatch.scoreB?.runs || 0 : lastMatch.scoreA?.runs || 0) : "0",
        "{opponentWickets}": lastMatch ? String(lastMatch.teamA === userTeamId ? lastMatch.scoreB?.wickets || 0 : lastMatch.scoreA?.wickets || 0) : "0",
        
        "{leaderName}": standings[0]?.teamName || "Leader",
        "{leaderShort}": standings[0]?.shortName || "LDR",
        "{leaderPoints}": standings[0] ? String(standings[0].points) : "0",
        "{leaderNrr}": standings[0] ? `${standings[0].nrr >= 0 ? "+" : ""}${standings[0].nrr.toFixed(3)}` : "0.000",
        
        "{footerName}": standings[standings.length - 1]?.teamName || "Bottom Team",
        "{footerShort}": standings[standings.length - 1]?.shortName || "BTM",
        "{footerPoints}": standings[standings.length - 1] ? String(standings[standings.length - 1].points) : "0",
        "{footerNrr}": standings[standings.length - 1] ? `${standings[standings.length - 1].nrr >= 0 ? "+" : ""}${standings[standings.length - 1].nrr.toFixed(3)}` : "0.000",

        "{venue}": venue,
        "{winMargin}": winMargin,
        "{powerplayRuns}": String(ppRunsVal),
        "{powerplayWickets}": String(ppWktsVal),
        "{last3OversRuns}": String(last3OversRuns),
        "{keyBowlerOver}": keyBowlerOver,
        "{keyPhaseOvers}": keyPhaseOvers,
        "{collapseWickets}": String(collapseWickets),
        "{collapseRuns}": String(collapseRuns),
        "{bowlingBoundaryCount}": String(bowlingBoundaryCount),
        "{potmName}": potmName,
        "{potmPerformance}": potmPerformance,
        "{starPlayerName}": potmName,

        "{opponentKeyBatter}": opponentKeyBatter,
        "{opponentKeyBatterRuns}": opponentKeyBatterRuns,
        "{opponentKeyBatterBalls}": opponentKeyBatterBalls,
        "{userDeathBowler}": userDeathBowler,
        "{lastOverConcededRuns}": String(lastOverConcededRuns),
        "{lastOverWickets}": String(lastOverWickets),
        "{lastOverRequiredRuns}": String(lastOverRequiredRuns),
        "{ballsRemaining}": String(ballsRemaining),
        "{wicketsRemaining}": String(marginVal),
        "{penultimateOverRuns}": String(penultimateOverRuns),
        "{last3OversRequiredRuns}": String(last3OversRequiredRuns),
        "{userFinisherName}": userFinisherName,
        "{userFinisherRuns}": userFinisherRuns,
        "{userFinisherBalls}": userFinisherBalls,
        "{userFinisherSixesCount}": userFinisherSixesCount,
        "{winningBallDelivery}": winningBallDelivery,
        "{fielderName}": fielderName,
        "{winningRunsHit}": winningRunsHit,
        "{userHeroName}": potmName,

        "{userChoiceOption}": userChoiceOption,
        "{userPowerplayRuns}": String(userPowerplayRuns),
        "{userPowerplayWickets}": String(userPowerplayWickets),
        "{oppStarBowler}": oppStarBowler,
        "{oppStarBowlerWickets}": oppStarBowlerWickets,
        "{oppStarBowlerRuns}": oppStarBowlerRuns,
        "{opponentOversFaced}": opponentOversFaced,
        "{userMiddleOversRuns}": String(userMiddleOversRuns),
        "{userMiddleOversWickets}": String(userMiddleOversWickets),
        "{userExtrasConceded}": userExtrasConceded,
        "{oppTopScorerName}": opponentKeyBatter,
        "{oppTopScorerRuns}": opponentKeyBatterRuns,
        "{oppTopScorerBalls}": opponentKeyBatterBalls,
        "{userEarlyCollapseRuns}": userEarlyCollapseRuns,
        "{oppPowerplayRuns}": String(oppPowerplayRuns),
        "{dryOversRange}": dryOversRange,
        "{userCaptainName}": userCaptainName,

        "{opponent.middleOversScore}": oppMiddleOversScore,
        "{opponent.lastOverBoundaries}": String(oppLastOverBoundaries),
        "{opponent.last3OversRuns}": String(oppLast3OversRuns),
        "{opponent.bowlerName}": oppBowlerName,
        "{opponent.finisherName}": oppFinisherName,
        "{opponent.finisherRuns}": oppFinisherRuns,
        "{opponent.finisherBalls}": oppFinisherBalls,
        "{penultimateOverConceded}": String(penultimateOverConceded),
        "{userLastOverRuns}": String(userLastOverRuns),
        "{user.lastOverRuns}": String(userLastOverRuns),
        "{dotBallDeficit}": dotBallDeficit,
        "{userBatterName}": userBatterName,
      };

      // Section 2: team_summaries: Mid-Season Report Card variables
      const topStandingsEntry = standings[0];
      const topTeamName = topStandingsEntry?.teamName || "Leaders";
      const topTeamShort = topStandingsEntry?.shortName || "LDR";
      const topTeamPoints = String(topStandingsEntry?.points || 0);
      const topTeamNrr = topStandingsEntry ? `${topStandingsEntry.nrr >= 0 ? "+" : ""}${topStandingsEntry.nrr.toFixed(3)}` : "0.000";
      const topTeamWins = String(topStandingsEntry?.won || 0);
      const topTeamMatchesPlayed = String(topStandingsEntry?.played || 0);

      const bottomStandingsEntry = standings[standings.length - 1];
      const bottomTeamName = bottomStandingsEntry?.teamName || "Laggards";
      const bottomTeamShort = bottomStandingsEntry?.shortName || "LAG";
      const bottomTeamPoints = String(bottomStandingsEntry?.points || 0);
      const bottomTeamWins = String(bottomStandingsEntry?.won || 0);
      const bottomTeamMatchesPlayed = String(bottomStandingsEntry?.played || 0);

      const secondStandingsEntry = standings[1] || topStandingsEntry;
      const secondTeamShort = secondStandingsEntry?.shortName || "SEC";

      const surpriseStandingsEntry = standings[2] || topStandingsEntry;
      const surpriseTeamName = surpriseStandingsEntry?.teamName || "Surprise Team";
      const surpriseTeamShort = surpriseStandingsEntry?.shortName || "SUR";
      const surpriseTeamPoints = String(surpriseStandingsEntry?.points || 0);
      const surpriseTeamTablePosition = "3rd";

      const goliathStandingsEntry = standings[standings.length - 2] || bottomStandingsEntry;
      const strugglingGoliathName = goliathStandingsEntry?.teamName || "Goliath";
      const strugglingGoliathShort = goliathStandingsEntry?.shortName || "GOL";
      const strugglingGoliathWins = String(goliathStandingsEntry?.won || 0);
      const goliathCaptainId = teams[goliathStandingsEntry?.teamId || ""]?.captainContinuityId;
      const strugglingGoliathCaptainName = goliathCaptainId && players[goliathCaptainId] ? players[goliathCaptainId].name : "Captain";

      const p3 = standings[2]?.points || 0;
      const p7 = standings[6]?.points || 0;
      const middleTablePointsDifference = String(Math.abs(p3 - p7));

      const orangeCapPlayerName = topScorer?.player?.name || "Orange Cap Leader";
      const orangeCapRuns = String(topScorer?.stats?.runs || 0);
      const purpleCapPlayerName = topWicketTaker?.player?.name || "Purple Cap Leader";
      const purpleCapWickets = String(topWicketTaker?.stats?.wickets || 0);

      const seasonRemainingMatches = String(totalFixturesCount - playedFixtures.length);

      // Section 2: team_summaries: Franchise Form Surge variables
      const surgingTeam = surgingTeamId ? teams[surgingTeamId] : null;
      const surgingTeamName = surgingTeam?.name || "Surging Team";
      const surgingTeamShort = surgingTeam?.shortName || "SRG";
      const teamConsecutiveWins = String(surgingTeamWins);
      const surgingPos = surgingTeamId ? standings.findIndex(s => s.teamId === surgingTeamId) + 1 : 4;
      const teamCurrentPosition = String(surgingPos);

      // Find top scorer and top bowler in the surging team's squad
      const surgingSquad = surgingTeam?.squad || [];
      const squadPlayers = surgingSquad
        .map(id => ({ player: players[id], stats: playerStats[id] }))
        .filter(x => x.player && x.stats);

      const hotPlayerVal = squadPlayers.sort((a, b) => (b.stats?.runs || 0) - (a.stats?.runs || 0))[0]?.player;
      const hotPlayerName = hotPlayerVal?.name || "Star Batter";
      const hotPlayerStreakRuns = "165";
      const hotPlayerStreakStrikeRate = "152.4";

      const keyBowlerVal = squadPlayers.sort((a, b) => (b.stats?.wickets || 0) - (a.stats?.wickets || 0))[0]?.player;
      const keyBowlerName = keyBowlerVal?.name || "Star Bowler";
      const bowlerStreakWickets = "7";

      const surgingCaptainId = surgingTeam?.captainContinuityId;
      const surgingTeamCaptainName = surgingCaptainId && players[surgingCaptainId] ? players[surgingCaptainId].name : "Captain";

      const surgingTeamOldRunRate = "-0.35";
      const surgingTeamNewRunRate = "+0.45";

      const keyPlayerStreakStats = "185 runs & 3 wickets";

      // Section 2: team_summaries: Franchise Freefall variables
      const strugglingTeam = strugglingTeamId ? teams[strugglingTeamId] : null;
      const strugglingTeamName = strugglingTeam?.name || "Struggling Team";
      const strugglingTeamShort = strugglingTeam?.shortName || "STRG";
      const teamConsecutiveLosses = String(strugglingTeamLosses);
      const strugglingPos = strugglingTeamId ? standings.findIndex(s => s.teamId === strugglingTeamId) + 1 : 10;
      const strugglingTeamCurrentPosition = String(strugglingPos);

      // Find top scorer in struggling squad
      const strugglingSquad = strugglingTeam?.squad || [];
      const strugglingSquadPlayers = strugglingSquad
        .map(id => ({ player: players[id], stats: playerStats[id] }))
        .filter(x => x.player && x.stats);
      const strugglingHotPlayer = strugglingSquadPlayers.sort((a, b) => (b.stats?.runs || 0) - (a.stats?.runs || 0))[0]?.player;
      
      const strugglingCaptainId = strugglingTeam?.captainContinuityId;
      const strugglingTeamCaptainName = strugglingCaptainId && players[strugglingCaptainId] ? players[strugglingCaptainId].name : "Captain";

      const extraTokens: Record<string, string> = {
        "{seasonMatchesPlayed}": String(playedFixtures.length),
        "{seasonTotalMatches}": String(totalFixturesCount),
        "{seasonCompletionPercentage}": completedPercent.toFixed(0),
        "{seasonRemainingMatches}": seasonRemainingMatches,
        "{cricinfoTop3Buys}": cricinfoTop3Text,
        "{cricbuzzTop3Buys}": cricbuzzTop3Text,
        "{newsletterTop3Buys}": newsletterTop3Text,
        "{userSquadOverviewCricinfo}": userSquadOverviewCricinfo,
        "{userSquadOverviewCricbuzz}": userSquadOverviewCricbuzz,
        "{userSquadOverviewNewsletter}": userSquadOverviewNewsletter,
        "{topTeamName}": topTeamName,
        "{topTeamShort}": topTeamShort,
        "{topTeamPoints}": topTeamPoints,
        "{topTeamNrr}": topTeamNrr,
        "{topTeamWins}": topTeamWins,
        "{topTeamMatchesPlayed}": topTeamMatchesPlayed,
        "{bottomTeamName}": bottomTeamName,
        "{bottomTeamShort}": bottomTeamShort,
        "{bottomTeamPoints}": bottomTeamPoints,
        "{bottomTeamWins}": bottomTeamWins,
        "{bottomTeamMatchesPlayed}": bottomTeamMatchesPlayed,
        "{secondTeamShort}": secondTeamShort,
        "{topTeamMiddleOversRunRate}": "8.7",
        "{bottomTeamPowerplayConcededRuns}": "54.5",
        "{topTeamBallsPerBoundary}": "5.2",
        "{secondTeamDeathEconomy}": "8.4",
        "{bottomTeamDotBallPercentage}": "42.3",
        "{surpriseTeamName}": surpriseTeamName,
        "{surpriseTeamShort}": surpriseTeamShort,
        "{surpriseTeamPoints}": surpriseTeamPoints,
        "{surpriseTeamTablePosition}": surpriseTeamTablePosition,
        "{strugglingGoliathName}": strugglingGoliathName,
        "{strugglingGoliathShort}": strugglingGoliathShort,
        "{strugglingGoliathWins}": strugglingGoliathWins,
        "{strugglingGoliathCaptainName}": strugglingGoliathCaptainName,
        "{middleTablePointsDifference}": middleTablePointsDifference,
        "{orangeCapPlayerName}": orangeCapPlayerName,
        "{orangeCapRuns}": orangeCapRuns,
        "{purpleCapPlayerName}": purpleCapPlayerName,
        "{purpleCapWickets}": purpleCapWickets,

        "{qualifier1Short}": standings[0]?.shortName || "Q1",
        "{qualifier2Short}": standings[1]?.shortName || "Q2",
        "{qualifier3Short}": standings[2]?.shortName || "Q3",
        "{qualifier4Short}": standings[3]?.shortName || "Q4",
        "{qualifier4Name}": standings[3]?.teamName || "Qualifier 4",
        "{qualifiersPowerplayRunRate}": "8.9",
        "{nonQualifiersPowerplayRunRate}": "7.4",
        "{bottomTeamDeathEconomy}": "11.8",
        "{bottomTeam1Short}": standings[standings.length - 2]?.shortName || "B1",
        "{bottomTeam1Name}": standings[standings.length - 2]?.teamName || "Bottom Team 1",
        "{bottomTeam1Position}": String(standings.length - 1),
        "{bottomTeam1MiddleOrderAverage}": "19.4",
        "{bottomTeam2Short}": standings[standings.length - 1]?.shortName || "B2",
        "{bottomTeam2Name}": standings[standings.length - 1]?.teamName || "Bottom Team 2",
        "{bottomTeam2ExtrasCount}": "124",
        "{leagueSpinWicketsPercentage}": "38.5",
        "{strugglingGoliathPosition}": "8",
        "{retainedTeamName}": indianOnlyRetainedTeam?.name || youngsterRetainedTeam?.name || strongestRetainedTeam?.name || "Retaining Team",
        "{retainedTeamShort}": indianOnlyRetainedTeam?.shortName || youngsterRetainedTeam?.shortName || strongestRetainedTeam?.shortName || "RET",
        "{retainedPlayerCount}": String(indianOnlyRetainedTeam?.retainedPlayers?.length || 0),
        "{youngsterName}": youngsterRetainedPlayer?.name || "Young Star",
        "{youngsterAge}": String(youngsterRetainedPlayer?.age || 20),
        "{youngsterPotential}": String(youngsterRetainedPlayer ? Math.max(youngsterRetainedPlayer.potentialBatting, youngsterRetainedPlayer.potentialBowling) : 85),
        "{retainedCoreRating}": strongestRetainedRating > 0 ? strongestRetainedRating.toFixed(1) : "85.0",

        "{surgingTeamName}": surgingTeamName,
        "{surgingTeamShort}": surgingTeamShort,
        "{teamConsecutiveWins}": teamConsecutiveWins,
        "{teamCurrentPosition}": teamCurrentPosition,
        "{surgingTeamStreakPowerplayRuns}": "51.5",
        "{surgingTeamStreakPowerplayWickets}": "1",
        "{hotPlayerName}": hotPlayerName,
        "{hotPlayerStreakRuns}": hotPlayerStreakRuns,
        "{hotPlayerStreakStrikeRate}": hotPlayerStreakStrikeRate,
        "{surgingTeamStreakDotBallPercentage}": "41.5",
        "{keyPlayerName}": hotPlayerName,
        "{keyPlayerBattingPosition}": "3rd",
        "{keyBowlerName}": keyBowlerName,
        "{surgingTeamOldRunRate}": surgingTeamOldRunRate,
        "{surgingTeamNewRunRate}": surgingTeamNewRunRate,
        "{starPlayerName}": hotPlayerName,
        "{starPlayerStreakRuns}": hotPlayerStreakRuns,
        "{bowlerStreakWickets}": bowlerStreakWickets,
        "{surgingTeamCaptainName}": surgingTeamCaptainName,
        "{heroPlayerName}": hotPlayerName,
        "{keyPlayerStreakStats}": keyPlayerStreakStats,

        "{teamPoints}": String(standings.find(s => s.teamId === surgingTeamId)?.points || 0),
        "{surgingTeamStreakDeathEconomy}": "7.8",
        "{surgingTeamStreakRunsPerOver}": "9.2",
        "{starPlayerStreakAverage}": "68.5",
        "{starPlayerStreakFiftyCount}": "4",
        "{surgingTeamStreakSixesCount}": "48",
        "{keyPlayerStreakWickets}": "8",
        "{bowler.streakWickets}": bowlerStreakWickets,
        "{bowler.name}": keyBowlerName,
        "{keyPlayer.streakWickets}": "8",
        "{keyPlayer.streakRuns}": hotPlayerStreakRuns,
        "{keyPlayer.name}": hotPlayerName,

        "{strugglingTeamName}": strugglingTeamName,
        "{strugglingTeamShort}": strugglingTeamShort,
        "{teamConsecutiveLosses}": teamConsecutiveLosses,
        "{strugglingTeamStreakPowerplayWickets}": "2.1",
        "{strugglingTeamStreakPowerplayRunRate}": "6.4",
        "{starPlayer.name}": strugglingHotPlayer?.name || "Star Player",
        "{starPlayer.streakRuns}": "135",
        "{starPlayer.streakAverage}": "22.5",
        "{strugglingTeamStreakCollapseRuns}": "28",
        "{strugglingTeamStreakCollapseWickets}": "3",
        "{coach.name}": "Head Coach",
        "{coachName}": "Head Coach",
        "{strugglingTeamStreakDeathEconomy}": "11.8",
        "{strugglingTeamDotBallPercentage}": "44.5",
        "{strugglingTeamRecentPowerplayRuns}": "38",
        "{captain.name}": strugglingTeamCaptainName,
        "{strugglingTeamCaptainName}": strugglingTeamCaptainName,
        "{strugglingTeamLast3OversConceded}": "42",
        "{strugglingTeamTotalRuns}": "118",
        "{topScorer.name}": strugglingHotPlayer?.name || "Star Player",
        "{topScorer.runs}": String(strugglingHotPlayer ? (playerStats[strugglingHotPlayer.id]?.runs || 35) : 35),
      };

      // Section 4: tournament_league additional tokens
      const topTeamObj = standings[0];
      const secondTeamObj = standings[1] || topTeamObj;
      const thirdTeamObj = standings[2] || topTeamObj;
      const fourthTeamObj = standings[3] || topTeamObj;
      const fifthTeamObj = standings[4] || topTeamObj;
      const sixthTeamObj = standings[5] || topTeamObj;
      const bottomTeamObj = standings[standings.length - 1];

      // Topic 1
      extraTokens["{topTeamBoundaryRate}"] = "18.2";
      extraTokens["{topTeamDotBallPercentage}"] = "36.8";
      extraTokens["{secondTeamName}"] = secondTeamObj?.teamName || "Second Team";
      extraTokens["{secondTeamPoints}"] = String(secondTeamObj?.points || 0);
      extraTokens["{chasingTeamShort}"] = secondTeamObj?.shortName || "SEC";
      
      // Struggling team for early season (bottom 2 teams)
      const earlyStrugglingTeam = standings[standings.length - 1] || topTeamObj;
      extraTokens["{strugglingTeamName}"] = earlyStrugglingTeam?.teamName || "Struggling Team";
      extraTokens["{strugglingTeamShort}"] = earlyStrugglingTeam?.shortName || "STRG";
      extraTokens["{strugglingTeamPosition}"] = String(standings.indexOf(earlyStrugglingTeam) + 1);
      extraTokens["{strugglingTeamPoints}"] = String(earlyStrugglingTeam?.points || 0);
      extraTokens["{strugglingTeamPowerplayRunRate}"] = "6.1";
      extraTokens["{strugglingTeamAvgOpenerStand}"] = "12.8";
      extraTokens["{strugglingTeamLosses}"] = String(earlyStrugglingTeam?.lost || 0);
      extraTokens["{strugglingTeamCaptainName}"] = (() => {
        const capId = teams[earlyStrugglingTeam?.teamId || ""]?.captainContinuityId;
        return capId && players[capId] ? players[capId].name : "Captain";
      })();

      // Top team's home venue
      extraTokens["{topTeamHomeVenue}"] = sim?.conditions?.stadiumName || "Eden Gardens";
      
      // Top team's star batter and bowler
      const topTeamSquad = teams[topTeamObj?.teamId || ""]?.squad || [];
      const topTeamPlayers = topTeamSquad.map(id => ({ player: players[id], stats: playerStats[id] })).filter(x => x.player && x.stats);
      const topTeamStarBatter = topTeamPlayers.sort((a, b) => (b.stats?.runs || 0) - (a.stats?.runs || 0))[0]?.player;
      const topTeamStarBowler = topTeamPlayers.sort((a, b) => (b.stats?.wickets || 0) - (a.stats?.wickets || 0))[0]?.player;
      extraTokens["{starBatterName}"] = topTeamStarBatter?.name || "Star Batter";
      extraTokens["{starBowlerName}"] = topTeamStarBowler?.name || "Star Bowler";

      // Topic 2
      const middleTeam1 = fourthTeamObj;
      const middleTeam2 = fifthTeamObj;
      extraTokens["{middleTeam1Short}"] = middleTeam1?.shortName || "MID1";
      extraTokens["{middleTeam2Short}"] = middleTeam2?.shortName || "MID2";
      extraTokens["{middleTeam1Name}"] = middleTeam1?.teamName || "Middle Team 1";
      extraTokens["{middleTeam2Name}"] = middleTeam2?.teamName || "Middle Team 2";
      extraTokens["{middleTeam1Points}"] = String(middleTeam1?.points || 0);
      extraTokens["{middleTeam2Points}"] = String(middleTeam2?.points || 0);
      extraTokens["{middleTeam1Nrr}"] = middleTeam1 ? `${middleTeam1.nrr >= 0 ? "+" : ""}${middleTeam1.nrr.toFixed(3)}` : "0.000";
      extraTokens["{middleTeam2Nrr}"] = middleTeam2 ? `${middleTeam2.nrr >= 0 ? "+" : ""}${middleTeam2.nrr.toFixed(3)}` : "0.000";

      const nrrOpponent = standings.find(s => s.teamId !== middleTeam2?.teamId && s.teamId !== middleTeam1?.teamId) || topTeamObj;
      extraTokens["{nrrOpponentShort}"] = nrrOpponent?.shortName || "OPP";
      extraTokens["{nrrChaseOvers}"] = "15.4";
      extraTokens["{nrrDefendRuns}"] = "32";
      extraTokens["{nrrSwingDifference}"] = "0.245";

      extraTokens["{topTeam1Short}"] = topTeamObj?.shortName || "T1";
      extraTokens["{topTeam2Short}"] = secondTeamObj?.shortName || "T2";
      extraTokens["{topTeam3Short}"] = thirdTeamObj?.shortName || "T3";
      extraTokens["{topTeam1Name}"] = topTeamObj?.teamName || "Top Team 1";
      extraTokens["{topTeam2Name}"] = secondTeamObj?.teamName || "Top Team 2";
      extraTokens["{topTeam3Name}"] = thirdTeamObj?.teamName || "Top Team 3";
      extraTokens["{topTeam1Points}"] = String(topTeamObj?.points || 0);
      extraTokens["{topTeam2Points}"] = String(secondTeamObj?.points || 0);
      extraTokens["{topTeam3Points}"] = String(thirdTeamObj?.points || 0);
      extraTokens["{topTeam1Nrr}"] = topTeamObj ? `${topTeamObj.nrr >= 0 ? "+" : ""}${topTeamObj.nrr.toFixed(3)}` : "0.000";

      extraTokens["{rank4TeamName}"] = fourthTeamObj?.teamName || "Fourth Team";
      extraTokens["{rank5TeamName}"] = fifthTeamObj?.teamName || "Fifth Team";
      extraTokens["{rank6TeamName}"] = sixthTeamObj?.teamName || "Sixth Team";
      extraTokens["{rank4TeamShort}"] = fourthTeamObj?.shortName || "R4";
      extraTokens["{rank5TeamShort}"] = fifthTeamObj?.shortName || "R5";
      extraTokens["{rank6TeamShort}"] = sixthTeamObj?.shortName || "R6";
      extraTokens["{rank4TeamPoints}"] = String(fourthTeamObj?.points || 0);
      extraTokens["{rank5TeamPoints}"] = String(fifthTeamObj?.points || 0);
      extraTokens["{rank6TeamPoints}"] = String(sixthTeamObj?.points || 0);

      const contenderTeam = fifthTeamObj;
      extraTokens["{contenderTeamShort}"] = contenderTeam?.shortName || "CON";
      extraTokens["{contenderTeamName}"] = contenderTeam?.teamName || "Contender Team";
      extraTokens["{contenderTeamMustWinGames}"] = "2";
      extraTokens["{contenderTeamCaptainName}"] = (() => {
        const capId = teams[contenderTeam?.teamId || ""]?.captainContinuityId;
        return capId && players[capId] ? players[capId].name : "Captain";
      })();
      extraTokens["{rivalTeamShort}"] = fourthTeamObj?.shortName || "RIV";
      
      extraTokens["{teamAShort}"] = fourthTeamObj?.shortName || "TA";
      extraTokens["{teamBShort}"] = fifthTeamObj?.shortName || "TB";
      extraTokens["{teamAName}"] = fourthTeamObj?.teamName || "Team A";
      extraTokens["{teamBName}"] = fifthTeamObj?.teamName || "Team B";
      extraTokens["{teamAPoints}"] = String(fourthTeamObj?.points || 0);

      // Topic 3
      const totalMatchesPerTeam = fixtures.length > 0 
        ? fixtures.filter(f => f.teamA === userTeamId || f.teamB === userTeamId).length 
        : 14;

      const eliminatedTeamObj = standings.find(s => s.points + (totalMatchesPerTeam - s.played) * 2 < (fourthTeamObj?.points || 0)) || bottomTeamObj;
      extraTokens["{eliminatedTeamShort}"] = eliminatedTeamObj?.shortName || "ELIM";
      extraTokens["{eliminatedTeamName}"] = eliminatedTeamObj?.teamName || "Eliminated Team";
      extraTokens["{triggerMatchWinnerTeam}"] = secondTeamObj?.teamName || "Winner Team";
      extraTokens["{eliminatedTeamMaxPossiblePoints}"] = String((eliminatedTeamObj?.points || 0) + (totalMatchesPerTeam - (eliminatedTeamObj?.played || 0)) * 2);
      extraTokens["{eliminatedTeamRemainingGames}"] = String(totalMatchesPerTeam - (eliminatedTeamObj?.played || 0));
      extraTokens["{eliminatedTeamDefendingConcededRuns}"] = "184.2";
      extraTokens["{eliminatedTeamWins}"] = String(eliminatedTeamObj?.won || 0);
      extraTokens["{eliminatedTeamLosses}"] = String(eliminatedTeamObj?.lost || 0);
      extraTokens["{eliminatedTeamCaptainName}"] = (() => {
        const capId = teams[eliminatedTeamObj?.teamId || ""]?.captainContinuityId;
        return capId && players[capId] ? players[capId].name : "Captain";
      })();

      const onTheBrinkTeamObj = standings.find(s => s.points + (totalMatchesPerTeam - s.played) * 2 === (fourthTeamObj?.points || 0) && s.played < totalMatchesPerTeam) || bottomTeamObj;
      extraTokens["{strugglingOpponentShort}"] = fourthTeamObj?.shortName || "OPP";

      // Topic 4
      extraTokens["{pointDiffValue}"] = String(Math.abs((topTeamObj?.points || 0) - (thirdTeamObj?.points || 0)));
      extraTokens["{qualifier1ConversionRate}"] = "72";
      extraTokens["{rank1TeamShort}"] = topTeamObj?.shortName || "R1";
      extraTokens["{rank2TeamShort}"] = secondTeamObj?.shortName || "R2";
      extraTokens["{rank3TeamShort}"] = thirdTeamObj?.shortName || "R3";
      extraTokens["{rank1TeamName}"] = topTeamObj?.teamName || "Rank 1 Team";
      extraTokens["{rank2TeamName}"] = secondTeamObj?.teamName || "Rank 2 Team";
      extraTokens["{rank3TeamName}"] = thirdTeamObj?.teamName || "Rank 3 Team";
      extraTokens["{rank1TeamPoints}"] = String(topTeamObj?.points || 0);
      extraTokens["{rank2TeamPoints}"] = String(secondTeamObj?.points || 0);
      extraTokens["{rank3TeamPoints}"] = String(thirdTeamObj?.points || 0);


      const allScorersSorted = Object.keys(playerStats)
        .map(id => ({ id, runs: playerStats[id].runs || 0 }))
        .sort((a, b) => b.runs - a.runs);
      const orangeCapRank = targetPlayer ? allScorersSorted.findIndex(x => x.id === targetPlayer.id) + 1 : 1;

      const allBowlersSorted = Object.keys(playerStats)
        .map(id => ({ id, wickets: playerStats[id].wickets || 0 }))
        .sort((a, b) => b.wickets - a.wickets);
      const purpleCapRank = targetPlayer ? allBowlersSorted.findIndex(x => x.id === targetPlayer.id) + 1 : 1;

      const playerExtraTokens: Record<string, string> = {
        "{playerName}": targetPlayer?.name || "Player Name",
        "{playerCareerAverage}": String(targetPlayer?.iplStats?.battingAverage || 0),
        "{playerCareerStrikeRate}": String(targetPlayer?.iplStats?.strikeRate || 0),
        "{playerCareerSeasons}": String(targetPlayer?.iplHistory?.length || 0),
        "{playerCareerEconomy}": (() => {
          const stats = targetPlayer?.iplStats;
          if (!stats) return "8.00";
          const balls = stats.bowlingBalls || 0;
          const runs = stats.bowlingRunsConceded || 0;
          return balls > 0 ? ((runs / balls) * 6).toFixed(2) : "8.00";
        })(),
        "{playerCareerBowlingStrikeRate}": (() => {
          const stats = targetPlayer?.iplStats;
          if (!stats) return "24.0";
          const balls = stats.bowlingBalls || 0;
          const wickets = stats.wickets || 0;
          return wickets > 0 ? (balls / wickets).toFixed(1) : "24.0";
        })(),
        "{playerAuctionPrice}": targetPlayer ? (getPlayerSalary(targetPlayer) / 100).toFixed(1) : "0.0",
        "{playerSeasonBattingAverage}": targetPlayerStats ? (targetPlayerStats.runs / (targetPlayerStats.innings || 1)).toFixed(1) : "0.0",
        "{playerRuns}": String(targetPlayerMatchStats?.runs || 100),
        "{playerBalls}": String(targetPlayerMatchStats?.balls || 60),
        "{playerTeamShort}": targetPlayer ? (teams[targetPlayer.teamId]?.shortName || "TEAM") : "TEAM",
        "{playerTeamRuns}": String(lastMatch ? (targetPlayerMatchStats?.teamId === lastMatch.teamA ? lastMatch.scoreA?.runs || 150 : lastMatch.scoreB?.runs || 150) : 150),
        "{playerBoundaryPercentage}": "65",
        "{playerDotBallCount}": "12",
        "{playerBallsToCentury}": "54",
        "{milestoneBowlerName}": lastMatchBowling[0]?.name || "Bowler",
        "{playerMidWicketRuns}": "38",
        "{partnershipRuns}": "125",
        "{partnerName}": lastMatchBatting.find(b => b.id !== targetPlayer?.id)?.name || "Partner",
        "{playerSeasonRuns}": String(targetPlayerStats?.runs || 100),
        "{playerSeasonAverage}": String(targetPlayerStats ? (targetPlayerStats.runs / (targetPlayerStats.innings || 1)).toFixed(1) : "45.2"),
        "{playerTeamCollapseScore}": "42/3",
        "{playerPowerplaySR}": "132.5",
        "{playerDeathSR}": "192.4",
        "{playerFinalOverRuns}": "22",
        "{playerTeamWickets}": String(lastMatch ? (targetPlayerMatchStats?.teamId === lastMatch.teamA ? lastMatch.scoreA?.wickets || 4 : lastMatch.scoreB?.wickets || 4) : 4),
        "{playerOrangeCapRank}": String(orangeCapRank),
        "{playerPurpleCapRank}": String(purpleCapRank),
        "{playerTotalSeasonRuns}": String(targetPlayerStats?.runs || 100),
        "{playerFours}": String(targetPlayerMatchStats?.fours || 8),
        "{playerSixes}": String(targetPlayerMatchStats?.sixes || 4),
        "{matchTargetRuns}": String(lastMatch ? (targetPlayerMatchStats?.teamId === lastMatch.teamA ? (lastMatch.scoreB?.runs || 140) + 1 : (lastMatch.scoreA?.runs || 140) + 1) : 141),
        "{matchLast3OversRequired}": "35",
        "{playerWickets}": String(targetPlayerMatchStats?.wickets || 5),
        "{playerRunsConceded}": String(targetPlayerMatchStats?.runsConceded || 24),
        "{playerDegreesOfSeam}": "1.8",
        "{playerPowerplayWickets}": "3",
        "{playerDotBalls}": "14",
        "{playerEconomyRate}": targetPlayerMatchStats ? (targetPlayerMatchStats.runsConceded / 4).toFixed(2) : "6.00",
        "{playerDeathWickets}": "3",
        "{playerDeathRunsConceded}": "12",
        "{playerYorkerCount}": "8",
        "{matchOpponentRequiredRuns}": "18 runs",
        "{playerTotalSeasonWickets}": String(targetPlayerStats?.wickets || 20),
        "{matchOver}": "14",
        "{playerSeasonInnings}": String(targetPlayerStats?.innings || 12),
        "{playerSeasonStrikeRate}": String(targetPlayerStats ? (targetPlayerStats.runs / (targetPlayerStats.balls || 1) * 100).toFixed(1) : "135.2"),
        "{playerRunContributionPercentage}": "28",
        "{seasonBowlerCountTo20}": "2",
        "{playerSeasonMatches}": String(targetPlayerStats?.matches || 12),
        "{playerBowlingStrikeRate}": String(targetPlayerStats ? (targetPlayerStats.ballsBowled / (targetPlayerStats.wickets || 1)).toFixed(1) : "15.4"),
        "{playerSeasonEconomy}": String(targetPlayerStats ? (targetPlayerStats.runsConceded / (targetPlayerStats.ballsBowled / 6 || 1)).toFixed(2) : "7.85"),
        "{playerMultiWicketGames}": "4",
        "{dismissedBatterName}": lastMatchBatting[0]?.name || "Batter",
        "{playerSeasonFifties}": "3",
        "{playerSeasonCenturies}": "1",
        "{playerAge}": String(targetPlayer?.age || 21),
        "{matchPlayerPerformance}": targetPlayerMatchStats?.runs ? `${targetPlayerMatchStats.runs} (${targetPlayerMatchStats.balls})` : `${targetPlayerMatchStats?.wickets}/${targetPlayerMatchStats?.runsConceded}`,
        "{playerMatchMetric}": targetPlayerMatchStats?.runs ? `${(targetPlayerMatchStats.runs / (targetPlayerMatchStats.balls || 1) * 100).toFixed(1)} SR` : `${(targetPlayerMatchStats?.runsConceded / 4 || 6.00).toFixed(2)} Eco`,
        "{playerCareerRuns}": String(targetPlayer && targetPlayer.age < 30 ? (targetPlayer.iplStats?.runs || 0) : ((targetPlayerStats?.runs || 0) + 1850)),
        "{playerCareerWickets}": String(targetPlayer && targetPlayer.age < 30 ? (targetPlayer.iplStats?.wickets || 0) : ((targetPlayerStats?.wickets || 0) + 94)),
        "{playerCareerMatches}": String(targetPlayer && targetPlayer.age < 30 ? (targetPlayer.iplStats?.matches || 0) : ((targetPlayerStats?.matches || 0) + 120)),
        "{playerChampionshipYears}": "2022 & 2024",
        "{playerCareerTrophies}": "2",
        "{opponentRuns}": String(lastMatch ? (targetPlayerMatchStats?.teamId === lastMatch.teamA ? lastMatch.scoreB?.runs || 140 : lastMatch.scoreA?.runs || 140) : 140),
      };

      Object.assign(extraTokens, playerExtraTokens);

      Object.assign(tokens, extraTokens);
      
      if (finalRetirees.length > 0) {
        const retiree = finalRetirees[0];
        tokens["{retireeName}"] = retiree.name;
        tokens["{retireeAge}"] = String(retiree.age);
        tokens["{retireeRating}"] = String(retiree.rating);
        tokens["{retireeRole}"] = retiree.role;
      }
      
      if (topScorer) {
        tokens["{topScorerName}"] = topScorer.player.name;
        tokens["{topScorerRuns}"] = String(topScorer.stats.runs);
        tokens["{topScorerBalls}"] = String(topScorer.stats.balls);
        tokens["{topScorerSr}"] = (topScorer.stats.runs / (topScorer.stats.balls || 1) * 100).toFixed(1);
      }
      
      if (topWicketTaker) {
        tokens["{topWicketName}"] = topWicketTaker.player.name;
        tokens["{topWickets}"] = String(topWicketTaker.stats.wickets);
      }
      
      if (standings.length >= 4) {
        tokens["{topFour}"] = standings.slice(0, 4).map(s => s.shortName).join(", ");
        tokens["{contenders}"] = standings.slice(4, 7).map(s => s.shortName).join(", ");
      }
      
      const youngProspects = Object.values(players)
        .filter((p) => p.age && p.age <= 25)
        .sort((a, b) => Math.max(b.currentBatting, b.currentBowling) - Math.max(a.currentBatting, a.currentBowling));
      if (youngProspects.length > 0) {
        const rookie = youngProspects[0];
        tokens["{rookieName}"] = rookie.name;
        tokens["{rookieAge}"] = String(rookie.age);
        tokens["{rookieRating}"] = String(Math.max(rookie.currentBatting, rookie.currentBowling));
      }
      
      const expensivePlayers = Object.values(players)
        .filter((p) => getPlayerSalary(p) > 0 && !p.isRetained)
        .sort((a, b) => getPlayerSalary(b) - getPlayerSalary(a));
      if (expensivePlayers.length > 0) {
        const topBuy = expensivePlayers[0];
        const topBuySalary = getPlayerSalary(topBuy);
        const formatPrice = (price: number) => price >= 100 ? `₹${(price / 100).toFixed(2)} Cr` : `₹${price} Lakhs`;
        
        tokens["{topBuyName}"] = topBuy.name;
        tokens["{topBuyPrice}"] = formatPrice(topBuySalary);
        tokens["{topBuyRating}"] = String(Math.max(topBuy.currentBatting, topBuy.currentBowling));
      }

      // Exact match player figures if they are referenced
      if (matchTopScorer) {
        tokens["{topScorerName}"] = matchTopScorer.name;
        tokens["{topScorerRuns}"] = String(matchTopScorer.runs || 0);
        tokens["{topScorerBalls}"] = String(matchTopScorer.balls || 0);
        tokens["{topScorerSr}"] = matchTopScorer.balls ? ((matchTopScorer.runs || 0) / matchTopScorer.balls * 100).toFixed(1) : "0.0";
      }
      if (matchTopBowler) {
        tokens["{bowlerName}"] = matchTopBowler.name;
        tokens["{bowlerWickets}"] = String(matchTopBowler.wickets || 0);
        tokens["{bowlerRuns}"] = String(matchTopBowler.runsConceded || 0);
      }
      
      let customTeamName = "Retaining Team";
      let customTeamShort = "RET";
      if (template.triggerType === "post_auction_retained_indians_only") {
        customTeamName = indianOnlyRetainedTeam?.name || "Retaining Team";
        customTeamShort = indianOnlyRetainedTeam?.shortName || "RET";
      } else if (template.triggerType === "post_auction_retained_youngster") {
        customTeamName = youngsterRetainedTeam?.name || "Retaining Team";
        customTeamShort = youngsterRetainedTeam?.shortName || "RET";
      } else if (template.triggerType === "post_auction_retained_strongest_core") {
        customTeamName = strongestRetainedTeam?.name || "Retaining Team";
        customTeamShort = strongestRetainedTeam?.shortName || "RET";
      }
      tokens["{retainedTeamName}"] = customTeamName;
      tokens["{retainedTeamShort}"] = customTeamShort;

      for (const [key, value] of Object.entries(tokens)) {
        title = title.replaceAll(key, value);
        subheading = subheading.replaceAll(key, value);
        content = content.replaceAll(key, value);
      }
      
      const isPostAuctionTrigger = [
        "post_auction_summary",
        "post_auction_retained_indians_only",
        "post_auction_retained_youngster",
        "post_auction_retained_strongest_core",
        "post_auction_three_biggest_buys",
        "post_auction_user_team_summary"
      ].includes(template.triggerType);

      const resolvedPublishingDate = isPostAuctionTrigger ? formattedPostAuctionDate : formattedCurrentDate;

      return {
        ...template,
        title,
        subheading,
        content,
        timestamp: resolvedPublishingDate
      } as NewsArticle;
    }).filter((art): art is NewsArticle => art !== null);
  }, [userTeamId, players, teams, playerStats, standings, retirements, retirementHistory, currentSeason, fixtures, topScorer, topWicketTaker, layout, currentDate]);

  // Filter articles based on selected tab
  const filteredArticles = useMemo(() => {
    return activeTab === "all" 
      ? generatedArticles 
      : generatedArticles.filter((article) => article.category === activeTab);
  }, [activeTab, generatedArticles]);

  const heroArticle = useMemo(() => {
    return filteredArticles.find((a) => a.isBreaking) || filteredArticles[0];
  }, [filteredArticles]);

  const secondaryArticles = useMemo(() => {
    return filteredArticles.filter((a) => a.id !== heroArticle?.id);
  }, [filteredArticles, heroArticle]);

  const selectedArticle = useMemo(() => {
    return generatedArticles.find((art) => art.id === selectedArticleId);
  }, [selectedArticleId, generatedArticles]);

  // Derive score cards for ticker (completed matches sorted from recent to oldest, or upcoming matches fallback, limited to 10)
  const tickerFixtures = useMemo(() => {
    if (!fixtures || fixtures.length === 0) return [];
    const played = fixtures.filter(f => f.played);
    if (played.length > 0) {
      return [...played].sort((a, b) => b.matchNumber - a.matchNumber).slice(0, 10);
    }
    // Pre-season fallback: show upcoming fixtures sorted chronologically
    return [...fixtures].sort((a, b) => a.matchNumber - b.matchNumber).slice(0, 10);
  }, [fixtures]);

  // Theme matching actual referenced websites
  const pageTheme = layout === "cricinfo"
    ? { 
        shell: "bg-[#f2f4f7] text-[#17202a] font-sans", 
        header: "bg-[#03a9f4] text-white", // ESPNcricinfo blue
        tab: "bg-[#03a9f4] text-white border-transparent", 
        border: "border-[#d8dee6]", 
        surface: "bg-white",
        accentText: "text-[#03a9f4]",
        textPrimary: "text-[#17202a]",
        textSecondary: "text-slate-500"
      }
    : layout === "cricbuzz"
      ? { 
        shell: "bg-[#f5f5f5] text-[#222] font-sans", 
        header: "bg-[#009270] text-white", // Cricbuzz green
        tab: "bg-[#009270] text-white border-transparent", 
        border: "border-[#d9d9d9]", 
        surface: "bg-white",
        accentText: "text-[#009270]",
        textPrimary: "text-[#222222]",
        textSecondary: "text-slate-600"
      }
      : { 
        shell: "bg-[#fffaf3] text-[#252525]", 
        header: "bg-[#242424] text-white", // Newsletter dark charcoal
        tab: "bg-[#e36b2c] text-white border-transparent", 
        border: "border-[#eadfd2]", 
        surface: "bg-white",
        accentText: "text-[#e36b2c]",
        textPrimary: "text-[#252525]",
        textSecondary: "text-slate-600"
      };

  return (
    <div className={`news-page flex h-full min-h-0 flex-col gap-4 overflow-hidden ${pageTheme.shell}`}>
      {/* 1. Condense Header (Cricinfo / Cricbuzz / Newsletter brand specific layout) */}
      {layout === "cricinfo" && (
        <div className="flex shrink-0 items-center justify-between border-b border-[#d8dee6] px-4 py-2 bg-[#03a9f4] text-white">
          <div className="flex items-center gap-6 overflow-hidden">
            <div className="flex items-center shrink-0">
              <span className="font-sans font-black text-sm tracking-tighter lowercase">
                espncricinfo
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 font-sans text-[9px] font-bold uppercase tracking-wider opacity-90">
              {["Live Scores", "Series", "Teams", "News", "Stats"].map((item, index) => (
                <span 
                  key={item} 
                  className={`cursor-pointer hover:opacity-100 transition-colors ${index === 3 ? "border-b-2 border-white pb-0.5" : ""}`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 rounded bg-[#002f6c]/25 p-0.5 border border-white/10 shrink-0">
            {["cricinfo", "cricbuzz", "newsletter"].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => { setLayout(id as NewsLayout); setSelectedArticleId(null); }}
                className={`rounded px-2.5 py-0.5 font-sans text-[8.5px] font-bold uppercase tracking-wider transition-all ${
                  layout === id ? "bg-white text-slate-900 shadow-xs font-extrabold" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {id === "cricinfo" ? "Cricinfo" : id === "cricbuzz" ? "Cricbuzz" : "IPL Daily"}
              </button>
            ))}
          </div>
        </div>
      )}

      {layout === "cricbuzz" && (
        <div className="flex shrink-0 items-center justify-between border-b border-[#007b5e] px-4 py-2 bg-[#009270] text-white">
          <div className="flex items-center gap-6 overflow-hidden">
            <div className="flex items-center shrink-0">
              <span className="font-sans font-black text-sm tracking-tight lowercase">
                cricbuzz<span className="text-[#fbc02d] font-extrabold">.</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 font-sans text-[9px] font-bold uppercase tracking-wider opacity-90">
              {["Matches", "Series", "Videos", "News", "Stats"].map((item, index) => (
                <span 
                  key={item} 
                  className={`cursor-pointer hover:opacity-100 transition-colors ${index === 3 ? "border-b-2 border-[#fbc02d] pb-0.5" : ""}`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 rounded bg-black/20 p-0.5 border border-white/10 shrink-0">
            {["cricinfo", "cricbuzz", "newsletter"].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => { setLayout(id as NewsLayout); setSelectedArticleId(null); }}
                className={`rounded px-2.5 py-0.5 font-sans text-[8.5px] font-bold uppercase tracking-wider transition-all ${
                  layout === id ? "bg-white text-slate-900 shadow-xs font-extrabold" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {id === "cricinfo" ? "Cricinfo" : id === "cricbuzz" ? "Cricbuzz" : "IPL Daily"}
              </button>
            ))}
          </div>
        </div>
      )}

      {layout === "newsletter" && (
        <div className="flex shrink-0 items-center justify-between border-b border-[#eadfd2] px-4 py-2 bg-[#242424] text-white">
          <div className="flex items-center gap-6 overflow-hidden">
            <div className="flex items-center shrink-0">
              <span className="font-serif font-bold text-sm tracking-wide">
                The IPL Daily
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 font-sans text-[9px] font-bold uppercase tracking-wider opacity-85">
              {["Longforms", "Franchise Deep-Dives", "Editorial Archives"].map((item) => (
                <span key={item} className="cursor-pointer hover:opacity-100 transition-colors">{item}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 rounded bg-white/10 p-0.5 border border-white/10 shrink-0">
            {["cricinfo", "cricbuzz", "newsletter"].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => { setLayout(id as NewsLayout); setSelectedArticleId(null); }}
                className={`rounded px-2.5 py-0.5 font-sans text-[8.5px] font-bold uppercase tracking-wider transition-all ${
                  layout === id ? "bg-white text-slate-900 shadow-xs font-extrabold" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {id === "cricinfo" ? "Cricinfo" : id === "cricbuzz" ? "Cricbuzz" : "IPL Daily"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Score ticker at the top - ESPNcricinfo Light Gray Version */}
      {tickerFixtures.length > 0 && layout === "cricinfo" && (
        <div className="shrink-0 border-b border-[#d8dee6] bg-[#f0f3f6]">
          <div className="flex overflow-x-auto divide-x divide-slate-200 py-1.5 px-4">
            {tickerFixtures.map((fixture) => {
              const teamA = teams[fixture.teamA];
              const teamB = teams[fixture.teamB];
              const isTeamALoser = fixture.played && fixture.winner !== fixture.teamA;
              const isTeamBLoser = fixture.played && fixture.winner !== fixture.teamB;
              return (
                <div key={fixture.id} className="px-4 first:pl-0 min-w-[210px] flex-shrink-0">
                  <div className="flex justify-between items-center text-[7.5px] font-sans font-bold text-slate-500 uppercase mb-0.5">
                    <span>Match {fixture.matchNumber}</span>
                    {fixture.played ? (
                      <span className="text-[#03a9f4] font-extrabold">RESULT</span>
                    ) : (
                      <span className="text-slate-400 font-extrabold">UPCOMING</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className={`flex justify-between items-center text-xs ${isTeamALoser ? "opacity-60" : ""}`}>
                      <span className="font-bold flex items-center gap-1.5 text-slate-800">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: teamA?.primaryColor }} />
                        {teamA?.shortName || fixture.teamA}
                      </span>
                      <span className="font-sans font-bold text-slate-800">
                        {fixture.played && fixture.scoreA ? `${fixture.scoreA.runs}/${fixture.scoreA.wickets}` : "-"}
                      </span>
                    </div>
                    <div className={`flex justify-between items-center text-xs ${isTeamBLoser ? "opacity-60" : ""}`}>
                      <span className="font-bold flex items-center gap-1.5 text-slate-800">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: teamB?.primaryColor }} />
                        {teamB?.shortName || fixture.teamB}
                      </span>
                      <span className="font-sans font-bold text-slate-800">
                        {fixture.played && fixture.scoreB ? `${fixture.scoreB.runs}/${fixture.scoreB.wickets}` : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-slate-200/50 flex items-center justify-between">
                    <span className="text-[8px] font-sans font-medium text-slate-500 italic">
                      {fixture.played 
                        ? `${teams[fixture.winner!]?.shortName || fixture.winner} won`
                        : `Scheduled: ${fixture.date || "TBD"}`
                      }
                    </span>
                    {fixture.played && (
                      <button
                        type="button"
                        onClick={() => setActiveScorecard(fixture)}
                        className="text-[8.5px] font-sans font-extrabold text-[#03a9f4] hover:underline"
                      >
                        Scorecard →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* View All Fixtures Card (Cricinfo style) */}
            <div className="px-4 flex items-center justify-center min-w-[130px] flex-shrink-0">
              <button
                type="button"
                onClick={onViewAllFixtures}
                className="text-[9px] font-sans font-bold text-[#03a9f4] hover:underline uppercase flex items-center gap-1"
              >
                All Matches <ChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score ticker at the top - Cricbuzz Dark Charcoal Version */}
      {tickerFixtures.length > 0 && layout === "cricbuzz" && (
        <div className="shrink-0 border-b border-[#1b1b1b] bg-[#222222]">
          <div className="flex overflow-x-auto divide-x divide-[#383838] py-1.5 px-4">
            {tickerFixtures.map((fixture) => {
              const teamA = teams[fixture.teamA];
              const teamB = teams[fixture.teamB];
              const isTeamALoser = fixture.played && fixture.winner !== fixture.teamA;
              const isTeamBLoser = fixture.played && fixture.winner !== fixture.teamB;
              return (
                <div key={fixture.id} className="px-4 first:pl-0 min-w-[210px] flex-shrink-0">
                  <div className="flex justify-between items-center text-[7.5px] font-sans font-bold text-[#b0b0b0] uppercase mb-0.5">
                    <span>Match {fixture.matchNumber}</span>
                    {fixture.played ? (
                      <span className="text-[#00d09c] font-extrabold">COMPLETED</span>
                    ) : (
                      <span className="text-[#fbc02d] font-extrabold">LIVE</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className={`flex justify-between items-center text-xs ${isTeamALoser ? "opacity-60" : ""}`}>
                      <span className="font-bold flex items-center gap-1.5 text-white">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: teamA?.primaryColor }} />
                        {teamA?.shortName || fixture.teamA}
                      </span>
                      <span className="font-sans font-bold text-white">
                        {fixture.played && fixture.scoreA ? `${fixture.scoreA.runs}/${fixture.scoreA.wickets}` : "-"}
                      </span>
                    </div>
                    <div className={`flex justify-between items-center text-xs ${isTeamBLoser ? "opacity-60" : ""}`}>
                      <span className="font-bold flex items-center gap-1.5 text-white">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: teamB?.primaryColor }} />
                        {teamB?.shortName || fixture.teamB}
                      </span>
                      <span className="font-sans font-bold text-white">
                        {fixture.played && fixture.scoreB ? `${fixture.scoreB.runs}/${fixture.scoreB.wickets}` : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-[#383838] flex items-center justify-between">
                    <span className="text-[8px] font-sans font-medium text-[#b0b0b0] italic">
                      {fixture.played 
                        ? `${teams[fixture.winner!]?.shortName || fixture.winner} won`
                        : `Scheduled: ${fixture.date || "TBD"}`
                      }
                    </span>
                    {fixture.played && (
                      <button
                        type="button"
                        onClick={() => setActiveScorecard(fixture)}
                        className="text-[8.5px] font-sans font-extrabold text-[#cbff00] hover:underline"
                      >
                        Scorecard →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* View All Fixtures Card (Cricbuzz style) */}
            <div className="px-4 flex items-center justify-center min-w-[130px] flex-shrink-0">
              <button
                type="button"
                onClick={onViewAllFixtures}
                className="text-[9px] font-sans font-bold text-[#cbff00] hover:underline uppercase flex items-center gap-1"
              >
                All Matches <ChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Article filtering tabs */}
      <div className={`flex shrink-0 gap-1.5 overflow-x-auto border-b ${pageTheme.border} px-4 pb-2`}>
        {[
          { id: "all", label: CATEGORY_LABELS.all },
          { id: "user_team", label: `${userTeam?.shortName || "My Team"} Focus` },
          { id: "team_summaries", label: CATEGORY_LABELS.team_summaries },
          { id: "player_news", label: CATEGORY_LABELS.player_news },
          { id: "tournament_league", label: CATEGORY_LABELS.tournament_league },
          { id: "transfers_auctions", label: CATEGORY_LABELS.transfers_auctions },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as NewsTab)}
            className={`whitespace-nowrap rounded px-3 py-1 font-space-mono text-[9px] font-extrabold uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? `${pageTheme.tab} shadow-sm`
                : "border border-border/40 hover:border-border text-text-secondary hover:text-text-primary bg-surface/50 font-bold"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Main content workspace */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pr-2">
        {filteredArticles.length === 0 ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-6 text-center">
            <Newspaper size={32} className="text-text-secondary/40" />
            <h3 className="mt-2 font-anton text-[16px] uppercase text-text-primary">No stories found</h3>
            <p className="mt-1 font-barlow text-xs text-text-secondary max-w-xs">
              There are no articles listed under &quot;{CATEGORY_LABELS[activeTab]}&quot;. Select another filter tab above.
            </p>
          </div>
        ) : (
          <>
            {/* ==================== ESPNCRICINFO LAYOUT ==================== */}
            {layout === "cricinfo" && (
              <div className="space-y-6 pb-6 text-slate-900 font-sans">
                {/* Top Section: Hero Article + Sidebar Widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-stretch">
                  {/* Left: Hero Lead Story */}
                  {heroArticle && (
                    <div className="flex flex-col rounded bg-white overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.08)] border border-slate-200 h-full justify-between">
                      {/* Big Hero Visual Banner */}
                      <div className="relative flex-1 min-h-[200px] bg-gradient-to-br from-slate-900 to-sky-950 flex flex-col justify-between p-6 overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent z-10" />
                        <div className="self-start rounded bg-black/60 px-2 py-0.5 font-sans text-[8px] font-bold text-white uppercase tracking-widest z-20 border border-white/10">
                          CRICINFO IMAGERY
                        </div>
                        <div className="mt-auto z-20 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-[#03a9f4] px-2 py-0.5 font-sans text-[9px] font-extrabold text-white uppercase tracking-wider">
                              FEATURED ARTICLE
                            </span>
                            <span className="font-sans text-[10px] text-white/70 font-semibold">{heroArticle.timestamp}</span>
                          </div>
                          <h2 
                            onClick={() => setSelectedArticleId(heroArticle.id)}
                            className="font-sans font-black text-[24px] leading-tight text-white cursor-pointer hover:text-sky-200 transition-colors tracking-tight"
                          >
                            {heroArticle.title}
                          </h2>
                          <p className="font-sans text-xs text-white/80 line-clamp-2 max-w-2xl font-medium">
                            {heroArticle.subheading}
                          </p>
                        </div>
                      </div>
                      {/* Article summary details */}
                      <div className="p-5 flex flex-col justify-between shrink-0 bg-white">
                        <p className="font-sans text-[13px] text-slate-600 leading-relaxed font-medium mb-4">
                          {heroArticle.content}
                        </p>
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between font-sans text-[10px] text-slate-500 font-semibold">
                          <div className="flex items-center gap-3">
                            <span>By <strong className="text-slate-800">{heroArticle.author}</strong></span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Clock size={10} /> {heroArticle.readTime}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setSelectedArticleId(heroArticle.id)}
                            className="flex items-center gap-0.5 font-bold uppercase text-[#03a9f4] hover:underline tracking-wide"
                          >
                            Read Story <ArrowUpRight size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Right: Cricinfo Sidebar (Mini Standings & Career Retirees) */}
                  <div className="flex flex-col justify-between gap-5 h-full">
                    {/* Standings widget */}
                    <div className="rounded bg-white border border-slate-200 overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.05)] min-h-[220px] flex-1 flex flex-col justify-between">
                      <div className="px-4 py-2.5 border-b border-slate-100 bg-[#f8fafc] flex justify-between items-center shrink-0">
                        <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-800">IPL points table</h4>
                        <span className="font-sans text-[9px] uppercase text-slate-400 font-bold tracking-widest">SEASON {currentSeason}</span>
                      </div>
                      <div className="p-3 flex-1">
                        <table className="w-full text-left font-sans text-[11px] text-slate-600">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 text-[9px] uppercase font-bold tracking-wider">
                              <th className="pb-2">Team</th>
                              <th className="pb-2 text-center">PL</th>
                              <th className="pb-2 text-center">W</th>
                              <th className="pb-2 text-center">L</th>
                              <th className="pb-2 text-right">NRR</th>
                              <th className="pb-2 text-right pr-3">PTS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {standings.slice(0, 5).map((row, idx) => {
                              const isUserRow = row.teamId === userTeamId;
                              let rowBg = "hover:bg-slate-50";
                              let borderIndicator = "";
                              if (idx === 0 || idx === 1) {
                                rowBg = "bg-sky-55/65 hover:bg-sky-100/60 bg-sky-50/50 dark:bg-sky-950/10 dark:hover:bg-sky-950/20";
                                borderIndicator = "border-l-2 border-sky-500 pl-2";
                              } else if (idx === 2 || idx === 3) {
                                rowBg = "bg-indigo-55/55 hover:bg-indigo-100/50 bg-indigo-50/40 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/20";
                                borderIndicator = "border-l-2 border-indigo-500 pl-2";
                              }
                              return (
                                <tr key={row.teamId} className={`transition-colors ${rowBg} ${isUserRow ? "font-bold text-[#03a9f4]" : "text-slate-800"}`}>
                                  <td className={`py-2 flex items-center gap-1.5 max-w-[120px] truncate font-medium ${borderIndicator || "pl-2.5"}`}>
                                    <span className="text-slate-400">{idx + 1}.</span>
                                    {row.shortName}
                                  </td>
                                  <td className="py-2 text-center font-medium">{row.played}</td>
                                  <td className="py-2 text-center font-medium">{row.won}</td>
                                  <td className="py-2 text-center font-medium">{row.lost}</td>
                                  <td className="py-2 text-right font-medium">{row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}</td>
                                  <td className="py-2 text-right font-bold text-slate-900 pr-3">{row.points}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Retirements & Changing of the Guard */}
                    <div className="rounded bg-white border border-slate-200 overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-4 flex-1 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-sans font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2.5 shrink-0">
                        <TrendingUp size={14} className="text-[#03a9f4]" />
                        <span>CHANGING OF THE GUARD</span>
                      </div>
                      <div className="space-y-2 flex-1 flex flex-col justify-center py-1">
                        {finalRetirees.length > 0 ? (
                          finalRetirees.slice(0, 4).map((retiree) => (
                            <div key={retiree.playerId} className="p-2 rounded bg-[#f8fafc] border border-slate-100 flex justify-between items-center hover:bg-slate-50 transition-colors">
                              <div>
                                <div className="font-sans text-[12px] font-bold text-slate-800">{retiree.name}</div>
                                <div className="font-sans text-[10px] font-semibold text-slate-400 uppercase mt-0.5 tracking-wide">
                                  {retiree.role} · Age {retiree.age}
                                </div>
                              </div>
                              <span className="font-sans text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/50">
                                RETIRED
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="font-sans text-[11px] text-slate-400 py-2">
                            No retirements or veteran alerts currently active.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Secondary Articles spanning full width */}
                <div className="pt-6 border-t border-slate-200 mt-8">
                  <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-800 mb-4">MORE STORIES</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {secondaryArticles.map((art) => (
                      <div 
                        key={art.id}
                        onClick={() => setSelectedArticleId(art.id)}
                        className="group flex flex-col justify-between p-4 rounded bg-white border border-slate-200 hover:border-[#03a9f4] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all cursor-pointer"
                      >
                        <div>
                          <div className="flex justify-between items-center text-[9px] font-sans text-slate-500 font-bold uppercase mb-2 tracking-wide">
                            <span className="text-[#03a9f4]">{art.tag || art.category.replace("_", " ")}</span>
                            <span>{art.timestamp}</span>
                          </div>
                          <h3 className="font-sans font-extrabold text-[14px] text-slate-800 group-hover:text-[#03a9f4] transition-colors leading-snug tracking-tight">
                            {art.title}
                          </h3>
                          <p className="mt-2 font-sans text-[12px] text-slate-500 leading-relaxed font-medium line-clamp-3 font-medium">
                            {art.subheading}
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-sans text-slate-500 font-semibold font-bold">
                          <span>{art.author}</span>
                          <span className="flex items-center gap-0.5 font-bold text-[#03a9f4] group-hover:underline">
                            Read <ChevronRight size={10} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== CRICBUZZ LAYOUT ==================== */}
            {layout === "cricbuzz" && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 pb-6 text-slate-800 font-sans">
                {/* Left: Stream of News Entries (Cricbuzz Uniform List Style) */}
                <div className="space-y-6">
                  {/* Uniform Articles List */}
                  <div className="divide-y divide-slate-200 space-y-4">
                    {filteredArticles.map((art) => (
                      <div 
                        key={art.id}
                        onClick={() => setSelectedArticleId(art.id)}
                        className="group flex gap-4 pt-4 first:pt-0 cursor-pointer"
                      >
                        {/* Media Thumbnail */}
                        <div className="w-28 h-20 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-slate-100 to-emerald-50/30">
                          <Newspaper size={16} className="text-slate-350" />
                        </div>
                        {/* Article Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[9px] text-[#009270] font-bold uppercase tracking-wider mb-1">
                            <span>{art.tag || art.category.replace("_", " ")}</span>
                            <span className="text-slate-400 font-normal">· {art.timestamp}</span>
                          </div>
                          <h3 className="font-sans font-extrabold text-[14px] text-slate-900 group-hover:text-[#009270] transition-colors leading-snug tracking-tight">
                            {art.title}
                          </h3>
                          <p className="mt-1 font-sans text-[12px] text-slate-500 leading-relaxed font-medium line-clamp-2">
                            {art.subheading}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Cricbuzz Sidebar (Specials & Statistics) */}
                <div className="space-y-5">
                  {/* Cricbuzz Awards & Stats Panel */}
                  <div className="rounded bg-white border border-slate-200 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-[#f8fafc] flex items-center gap-2">
                      <Award size={14} className="text-[#009270]" />
                      <h4 className="font-sans font-extrabold text-xs uppercase tracking-wider text-slate-800">IPL AWARDS & LEADERBOARD</h4>
                    </div>
                    <div className="p-4 space-y-4 divide-y divide-slate-100">
                      {/* Orange Cap (Top Run Scorer) */}
                      <div className="space-y-1 pt-3 first:pt-0">
                        <span className="font-sans text-[9px] font-black text-[#009270] uppercase">Orange Cap</span>
                        {topScorer ? (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="font-bold text-slate-800">{topScorer.player.name}</span>
                            <span className="text-[#009270] font-bold">{topScorer.stats.runs} Runs</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-medium">Awaiting stats...</div>
                        )}
                      </div>

                      {/* Purple Cap (Top Wicket Taker) */}
                      <div className="space-y-1 pt-3">
                        <span className="font-sans text-[9px] font-black text-[#009270] uppercase">Purple Cap</span>
                        {topWicketTaker ? (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="font-bold text-slate-800">{topWicketTaker.player.name}</span>
                            <span className="text-[#009270] font-bold">{topWicketTaker.stats.wickets} Wkts</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-medium">Awaiting stats...</div>
                        )}
                      </div>

                      {/* MVP Candidate / Winner */}
                      <div className="space-y-1 pt-3">
                        <span className="font-sans text-[9px] font-black text-[#009270] uppercase">
                          {isSeasonConcluded ? "Most Valuable Player" : "Leading MVP Candidate"}
                        </span>
                        {mvpCandidate ? (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="font-bold text-slate-800">
                              {isSeasonConcluded ? `MVP: ${mvpCandidate.player.name}` : mvpCandidate.player.name}
                            </span>
                            <span className="text-[#009270] font-bold">{mvpCandidate.mvpPoints} Pts</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-medium">Awaiting stats...</div>
                        )}
                      </div>

                      {/* Emerging Player Candidate / Winner */}
                      <div className="space-y-1 pt-3">
                        <span className="font-sans text-[9px] font-black text-[#009270] uppercase">
                          {isSeasonConcluded ? "Emerging Player of the Year" : "Leading Emerging Player Candidate"}
                        </span>
                        {emergingCandidate ? (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="font-bold text-slate-800">
                              {isSeasonConcluded ? `Emerging Player: ${emergingCandidate.player.name}` : emergingCandidate.player.name}
                            </span>
                            <span className="text-[#009270] font-bold">{emergingCandidate.mvpPoints} Pts</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-medium">Awaiting stats...</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Standings widget in Cricbuzz style */}
                  <div className="rounded bg-white border border-slate-200 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-[#f8fafc] flex justify-between items-center">
                      <h4 className="font-sans font-extrabold text-xs uppercase tracking-wider text-slate-800">IPL STANDINGS</h4>
                      <span className="font-sans text-[9px] uppercase text-slate-400 font-black">SEASON {currentSeason}</span>
                    </div>
                    <div className="p-3">
                      <table className="w-full text-left font-sans text-[11px] text-slate-600">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 text-[9px] uppercase font-bold tracking-wider">
                            <th className="pb-1.5">Team</th>
                            <th className="pb-1.5 text-center">PL</th>
                            <th className="pb-1.5 text-center">W</th>
                            <th className="pb-1.5 text-center">L</th>
                            <th className="pb-1.5 text-right pr-2">PTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {standings.slice(0, 5).map((row, idx) => {
                            const isUserRow = row.teamId === userTeamId;
                            return (
                              <tr 
                                key={row.teamId} 
                                className={`hover:bg-slate-50 transition-colors ${isUserRow ? "font-bold text-[#009270]" : "text-slate-800"}`}
                              >
                                <td className="py-2 flex items-center gap-1.5 font-medium">
                                  <span className="text-slate-450">{idx + 1}.</span>
                                  {row.shortName}
                                </td>
                                <td className="py-2 text-center font-medium">{row.played}</td>
                                <td className="py-2 text-center font-medium">{row.won}</td>
                                <td className="py-2 text-center font-medium">{row.lost}</td>
                                <td className="py-2 text-right font-bold text-slate-900 pr-2">{row.points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== NEWSLETTER LAYOUT ==================== */}
            {layout === "newsletter" && (
              <div className="max-w-4xl mx-auto space-y-8 pb-12">
                <div className="text-center py-4 border-y border-[#eadfd2] space-y-1">
                  <span className="font-space-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#e36b2c]">
                    The Editorial Briefing
                  </span>
                  <div className={`font-barlow text-[10px] font-medium uppercase ${pageTheme.textSecondary}`}>
                    Season {currentSeason} · Simulated Cricket Intelligence Digest
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {filteredArticles.map((art, index) => (
                    <div 
                      key={art.id}
                      onClick={() => setSelectedArticleId(art.id)}
                      className={`group flex flex-col justify-between space-y-3 cursor-pointer pb-6 border-b border-[#eadfd2] ${index === 0 ? "md:col-span-2 border-b-2" : ""}`}
                    >
                      <div className="space-y-2">
                        <div className={`flex justify-between items-center font-space-mono text-[8px] uppercase ${pageTheme.textSecondary}`}>
                          <span className="font-extrabold text-[#e36b2c] tracking-wider">{art.tag || art.category.replace("_", " ")}</span>
                          <span>{art.timestamp}</span>
                        </div>
                        
                        <h3 className={`font-anton uppercase leading-tight group-hover:text-[#e36b2c] transition-colors ${pageTheme.textPrimary} ${index === 0 ? "text-[22px]" : "text-[16px]"}`}>
                          {art.title}
                        </h3>
                        
                        <p className={`font-barlow text-xs font-bold italic ${pageTheme.textSecondary}`}>
                          {art.subheading}
                        </p>
                        
                        <p className={`font-barlow text-[13px] leading-relaxed line-clamp-4 ${pageTheme.textPrimary}`}>
                          {art.content}
                        </p>
                      </div>

                      <div className={`pt-2 flex items-center justify-between font-space-mono text-[8.5px] ${pageTheme.textSecondary}`}>
                        <span className="italic">Written by {art.author}</span>
                        <span className="text-[#e36b2c] uppercase font-bold flex items-center gap-0.5 group-hover:underline">
                          Read Full Digest <ChevronRight size={10} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. Realistic Modal Overlay for reading full story */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className={`p-4 border-b ${pageTheme.border} bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className={`rounded px-2.5 py-0.5 font-space-mono text-[8px] font-bold uppercase tracking-wider text-white ${
                  layout === "cricinfo" ? "bg-[#03a9f4]" : layout === "cricbuzz" ? "bg-[#009270]" : "bg-[#e36b2c]"
                }`}>
                  {selectedArticle.tag || CATEGORY_LABELS[selectedArticle.category]}
                </span>
                <span className="font-space-mono text-[9px] text-text-secondary">{selectedArticle.timestamp}</span>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedArticleId(null)}
                className="font-space-mono text-[10px] font-extrabold uppercase text-text-secondary hover:text-text-primary tracking-wider"
              >
                [ CLOSE X ]
              </button>
            </div>

            {/* Scrollable Story Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              <h2 className="font-anton text-[22px] uppercase text-text-primary leading-tight">
                {selectedArticle.title}
              </h2>
              
              <p className={`font-barlow text-sm font-bold text-text-secondary border-l-4 pl-3.5 italic ${
                layout === "cricinfo" ? "border-[#03a9f4]" : layout === "cricbuzz" ? "border-[#009270]" : "border-[#e36b2c]"
              }`}>
                {selectedArticle.subheading}
              </p>

              <div className="font-barlow text-[13.5px] text-text-primary leading-relaxed space-y-3.5">
                <p className="whitespace-pre-line">{selectedArticle.content}</p>
              </div>

              {/* Technical / Illustration prompt box */}
              <div className="mt-6 p-4 rounded-lg border border-border bg-[#16130f]/5 dark:bg-white/5 space-y-2">
                <div className="flex items-center gap-1.5 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                  <Zap size={10} className={pageTheme.accentText} />
                  <span>Media Generator Spec</span>
                </div>
                <div className="font-space-mono text-[9px] text-text-secondary leading-snug">
                  <strong>Suggested Asset Illustration:</strong> &ldquo;{selectedArticle.imageMockupPrompt}&rdquo;
                </div>
                <div className="border-t border-border/60 pt-2 font-space-mono text-[8px] text-text-secondary">
                  <strong>Entity Metadata:</strong>{" "}
                  {selectedArticle.associatedEntityIds?.playerId || selectedArticle.playerId || selectedArticle.associatedEntityIds?.teamId || selectedArticle.teamId
                    ? [
                        selectedArticle.associatedEntityIds?.playerId || selectedArticle.playerId ? "player_id: " + (selectedArticle.associatedEntityIds?.playerId || selectedArticle.playerId) : "",
                        selectedArticle.associatedEntityIds?.teamId || selectedArticle.teamId ? "team_id: " + (selectedArticle.associatedEntityIds?.teamId || selectedArticle.teamId) : ""
                      ].filter(Boolean).join(" | ")
                    : "None (General Editorial)"}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between font-space-mono text-[9px] text-text-secondary">
              <span>Author: <strong>{selectedArticle.author}</strong></span>
              <span className="flex items-center gap-1"><Clock size={10} /> {selectedArticle.readTime}</span>
            </div>
          </div>
        </div>
      )}

      {/* Fixture Scorecard Modal (Loaded only when activeScorecard is set to avoid overhead) */}
      {activeScorecard && (
        <MatchScorecardModal
          match={activeScorecard}
          teams={teams}
          players={players}
          isOpen={Boolean(activeScorecard)}
          onClose={() => setActiveScorecard(null)}
        />
      )}
    </div>
  );
}
