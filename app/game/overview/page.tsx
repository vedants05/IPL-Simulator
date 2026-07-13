"use client";
import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import { SEASON_ACCESS_ENABLED } from "@/lib/config/featureFlags";
import type { Player, Team } from "@/lib/types";
import {
  Inbox as InboxIcon,
  LayoutDashboard,
  Briefcase,
  Users,
  Sliders,
  HeartHandshake,
  Activity,
  Search,
  FileText,
  Calendar,
  Table,
  Trophy,
  History as HistoryIcon,
  AlertCircle,
  Check,
  X,
  UserCheck,
  ChevronRight,
  TrendingUp,
  User,
  Heart,
  Info,
  DollarSign,
  Play
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================
interface InboxMessage {
  id: string;
  sender: string;
  subject: string;
  body: string;
  type: "trade" | "news" | "injury" | "board" | "sponsor";
  date: string;
  unread: boolean;
  tradeDetails?: {
    offerPlayerId: string;
    requestPlayerId: string;
    offerTeamId: string;
    cashAdjustment: number; // in Lakhs
  };
  completed?: "accepted" | "declined" | null;
}

interface PlayerStats {
  id: string;
  name: string;
  teamId: string;
  runs: number;
  balls: number;
  wickets: number;
  runsConceded: number;
  oversBowled: number;
  matches: number;
  highestScore: number;
  bestBowling: string;
}

interface LeagueStandings {
  teamId: string;
  teamName: string;
  shortName: string;
  played: number;
  won: number;
  lost: number;
  noResults: number;
  points: number;
  nrr: number;
  wicketsTaken: number;
}

interface ScorecardPlayer {
  name: string;
  id: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  overs?: number;
  wickets?: number;
  runsConceded?: number;
  maidens?: number;
}

interface InningsScorecard {
  batting: ScorecardPlayer[];
  bowling: ScorecardPlayer[];
  extras: number;
}

interface MatchScorecard {
  inningsA: InningsScorecard;
  inningsB: InningsScorecard;
}

interface Match {
  id: string;
  round: number;
  teamA: string;
  teamB: string;
  played: boolean;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  winner?: string;
  commentary?: string[];
  scorecard?: MatchScorecard;
}

interface RetentionDeadline {
  year: number;
  month: number;
  day: number;
}

// ============================================================================
// Static Data Templates
// ============================================================================
const CALENDAR_MONTHS = Array.from({ length: 12 }, (_, offset) => {
  const month = (11 + offset) % 12;
  const year = 2026 + Math.floor((11 + offset) / 12);
  return { month, year, label: new Date(year, month).toLocaleString("en-GB", { month: "long" }) };
});

const generateNextRetentionDeadline = (auctionDate: string): RetentionDeadline => ({
  year: Number(auctionDate.slice(0, 4)) + 1,
  month: 10,
  day: 10 + Math.floor(Math.random() * 11),
});

// Helper to calculate rating of player
const getPlayerRating = (p: Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);

// ============================================================================
// Main component
// ============================================================================
function OverviewPageContent() {
  const router = useRouter();
  const { teams, userTeamId, players, currentDate, currentSeason, auction } = useGameStore();
  const userTeam = teams[userTeamId];

  // Redirect back to auction if not completed or not continued to season
  useEffect(() => {
    if (typeof window !== "undefined") {
      const continued = localStorage.getItem(`ipl_continued_to_season_${userTeamId}`) === "true";
      if (!SEASON_ACCESS_ENABLED || !auction || auction.phase !== "completed" || !continued) {
        router.replace("/game/auction");
      }
    }
  }, [auction, router, userTeamId]);

  // --------------------------------------------------------------------------
  // Core UI Tabs State
  // --------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<"home" | "squad" | "scouting" | "season" | "history">("home");
  const [activeSubTab, setActiveSubTab] = useState<string>("overview");

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const subtabParam = searchParams.get("subtab");

  // Read URL params reactively whenever they change
  useEffect(() => {
    if (tabParam === "home" || tabParam === "squad" || tabParam === "scouting" || tabParam === "season" || tabParam === "history") {
      setActiveTab(tabParam as any);
      setActiveSubTab(subtabParam || "overview"); // Set to url subtab or reset to overview
    }
  }, [tabParam, subtabParam]);

  // --------------------------------------------------------------------------
  // Simulation & Career States (Saved in LocalStorage)
  // --------------------------------------------------------------------------
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [standings, setStandings] = useState<LeagueStandings[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [startingXI, setStartingXI] = useState<string[]>([]);
  const [impactPlayer, setImpactPlayer] = useState<string>("");
  const [teamStrategy, setTeamStrategy] = useState<string>("Balanced");
  const [activeCommentary, setActiveCommentary] = useState<string[] | null>(null);
  const [activeScorecard, setActiveScorecard] = useState<Match | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  
  // Local state for interactive tools
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNationality, setFilterNationality] = useState<"all" | "indian_capped" | "indian_uncapped" | "overseas">("all");
  const [filterRole, setFilterRole] = useState<"all" | "Batsman" | "WK-Batsman" | "All-Rounder" | "Pace Bowler" | "Spin Bowler">("all");
  const [minRating, setMinRating] = useState<number>(60);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(0);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(15);
  const [retentionDeadline, setRetentionDeadline] = useState<RetentionDeadline | null>(null);
  const squadOverviewListRef = useRef<HTMLDivElement | null>(null);
  const [visibleSquadOverviewCount, setVisibleSquadOverviewCount] = useState(0);
  const scoutingOverviewListRef = useRef<HTMLDivElement | null>(null);
  const [visibleScoutingOverviewCount, setVisibleScoutingOverviewCount] = useState(10);
  const currentCalendarMonth = CALENDAR_MONTHS[calendarMonthIndex];
  const calendarDaysInMonth = new Date(currentCalendarMonth.year, currentCalendarMonth.month + 1, 0).getDate();
  const calendarFirstWeekday = new Date(currentCalendarMonth.year, currentCalendarMonth.month, 1).getDay();

  useEffect(() => {
    const list = squadOverviewListRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;

    const updateVisibleCount = () => {
      const rowHeight = 32;
      const overflowLineHeight = 28;
      const totalPlayers = userTeam?.squad.length ?? 0;
      const rowsWithoutOverflowLine = Math.max(0, Math.floor(list.clientHeight / rowHeight));
      const nextCount = totalPlayers <= rowsWithoutOverflowLine
        ? totalPlayers
        : Math.max(0, Math.floor((list.clientHeight - overflowLineHeight) / rowHeight));
      setVisibleSquadOverviewCount(nextCount);
    };

    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(list);
    updateVisibleCount();
    return () => observer.disconnect();
  }, [activeTab, activeSubTab, userTeam?.squad.length]);
  


  // Toast notifier helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync default starting XI from store squad on load
  useEffect(() => {
    if (userTeam && startingXI.length === 0) {
      // Pick top 11 by rating
      const sorted = [...userTeam.squad]
        .map(id => players[id])
        .filter(Boolean)
        .sort((a, b) => getPlayerRating(b) - getPlayerRating(a));
      setStartingXI(sorted.slice(0, 11).map(p => p.id));
      if (sorted.length > 11) {
        setImpactPlayer(sorted[11].id);
      }
    }
  }, [userTeam, players]);

  // Load and save state from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(`ipl_career_${userTeamId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.fixtures) setFixtures(parsed.fixtures);
        if (parsed.fixtures) setStandings(calculateStandings(parsed.fixtures));
        if (parsed.playerStats) setPlayerStats(parsed.playerStats);
        if (parsed.inbox) setInbox([]);
        if (parsed.startingXI) setStartingXI(parsed.startingXI);
        if (parsed.impactPlayer) setImpactPlayer(parsed.impactPlayer);
        if (parsed.teamStrategy) setTeamStrategy(parsed.teamStrategy);
        if (parsed.shortlist) setShortlist(parsed.shortlist);
        const savedDeadline = parsed.retentionDeadline as RetentionDeadline | undefined;
        const nextDeadline = savedDeadline ?? generateNextRetentionDeadline(currentDate);
        setRetentionDeadline(nextDeadline);
        if (!savedDeadline) {
          localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify({ ...parsed, retentionDeadline: nextDeadline }));
        }
      } catch (e) {
        console.error("Error loading career save:", e);
      }
    } else {
      // Initialize Career
      initCareer();
    }
  }, [userTeamId]);

  const saveCareerState = (updatedData: any) => {
    const currentState = {
      fixtures: updatedData.fixtures ?? fixtures,
      standings: updatedData.standings ?? standings,
      playerStats: updatedData.playerStats ?? playerStats,
      inbox: [],
      startingXI: updatedData.startingXI ?? startingXI,
      impactPlayer: updatedData.impactPlayer ?? impactPlayer,
      teamStrategy: updatedData.teamStrategy ?? teamStrategy,
      shortlist: updatedData.shortlist ?? shortlist,
      retentionDeadline: updatedData.retentionDeadline ?? retentionDeadline,
    };
    localStorage.setItem(`ipl_career_${userTeamId}`, JSON.stringify(currentState));
  };

  // Initialize all career details
  const initCareer = () => {
    if (!userTeam) return;
    // 1. Generate fixtures
    const GeneratedFixtures = generateLeagueFixtures();
    // 2. Generate standings
    const initialStandings = Object.values(teams).map(t => ({
      teamId: t.id,
      teamName: t.name,
      shortName: t.shortName,
      played: 0,
      won: 0,
      lost: 0,
      noResults: 0,
      points: 0,
      nrr: 0.0,
      wicketsTaken: 0
    }));

    // 3. Generate initial inbox messages
    const initialInbox: InboxMessage[] = [];
    const nextRetentionDeadline = generateNextRetentionDeadline(currentDate);

    // Set and save
    setFixtures(GeneratedFixtures);
    setStandings(initialStandings);
    setInbox(initialInbox);
    setPlayerStats({});
    setRetentionDeadline(nextRetentionDeadline);
    
    saveCareerState({
      fixtures: GeneratedFixtures,
      standings: initialStandings,
      inbox: initialInbox,
      playerStats: {},
      retentionDeadline: nextRetentionDeadline,
    });
  };

  // --------------------------------------------------------------------------
  // Career Methods
  // --------------------------------------------------------------------------
  
  // Generates a high-quality, deterministic 14-round schedule for 10 teams
  const generateLeagueFixtures = (): Match[] => {
    return [];
  };



  // Toggle shortlist helper
  const toggleShortlist = (pid: string) => {
    let next: string[];
    if (shortlist.includes(pid)) {
      next = shortlist.filter(id => id !== pid);
      showToast("Removed from Auction Shortlist");
    } else {
      next = [...shortlist, pid];
      showToast("Added to Auction Shortlist");
    }
    setShortlist(next);
    saveCareerState({ shortlist: next });
  };

  // Play and simulate match logic
  const handleSimulateNextRound = () => {
    showToast("Match simulation is locked.");
  };

  // Calculate league standings from actual group-stage results and scorecards.
  const calculateStandings = (allMatches: Match[]): LeagueStandings[] => {
    const records: Record<string, LeagueStandings> = {};
    const runTotals: Record<string, { scored: number; facedBalls: number; conceded: number; bowledBalls: number }> = {};
    const randomTieBreak = new Map(Object.keys(teams).map(teamId => [teamId, Math.random()]));

    const oversToBalls = (overs: number | undefined) => {
      if (overs === undefined || overs < 0) return 0;
      const completeOvers = Math.floor(overs);
      const balls = Math.round((overs - completeOvers) * 10);
      return completeOvers * 6 + Math.min(Math.max(balls, 0), 5);
    };

    const wicketsFromScorecard = (match: Match, bowlingTeamId: string) => {
      if (!match.scorecard) return undefined;
      const bowling = bowlingTeamId === match.teamA
        ? match.scorecard.inningsB.bowling
        : match.scorecard.inningsA.bowling;
      return bowling.reduce((total, bowler) => total + (bowler.wickets ?? 0), 0);
    };
    
    // Init records
    Object.values(teams).forEach(t => {
      records[t.id] = {
        teamId: t.id,
        teamName: t.name,
        shortName: t.shortName,
        played: 0,
        won: 0,
        lost: 0,
        noResults: 0,
        points: 0,
        nrr: 0.0,
        wicketsTaken: 0
      };
      runTotals[t.id] = { scored: 0, facedBalls: 0, conceded: 0, bowledBalls: 0 };
    });

    allMatches.filter(m => m.played).forEach(m => {
      const recA = records[m.teamA];
      const recB = records[m.teamB];
      if (!recA || !recB) return;

      recA.played++;
      recB.played++;

      if (m.winner === m.teamA) {
        recA.won++;
        recA.points += 2;
        recB.lost++;
      } else if (m.winner === m.teamB) {
        recB.won++;
        recB.points += 2;
        recA.lost++;
      } else {
        recA.noResults++;
        recB.noResults++;
        recA.points++;
        recB.points++;
      }

      if (m.scoreA && m.scoreB) {
        // An all-out innings counts as the full 20 overs for NRR purposes.
        const ballsA = m.scoreA.wickets >= 10 ? 120 : oversToBalls(m.scoreA.overs);
        const ballsB = m.scoreB.wickets >= 10 ? 120 : oversToBalls(m.scoreB.overs);
        runTotals[m.teamA].scored += m.scoreA.runs;
        runTotals[m.teamA].facedBalls += ballsA;
        runTotals[m.teamA].conceded += m.scoreB.runs;
        runTotals[m.teamA].bowledBalls += ballsB;
        runTotals[m.teamB].scored += m.scoreB.runs;
        runTotals[m.teamB].facedBalls += ballsB;
        runTotals[m.teamB].conceded += m.scoreA.runs;
        runTotals[m.teamB].bowledBalls += ballsA;
        recA.wicketsTaken += wicketsFromScorecard(m, m.teamA) ?? m.scoreB.wickets;
        recB.wicketsTaken += wicketsFromScorecard(m, m.teamB) ?? m.scoreA.wickets;
      }
    });

    Object.values(records).forEach(rec => {
      const totals = runTotals[rec.teamId];
      if (totals.facedBalls > 0 && totals.bowledBalls > 0) {
        rec.nrr = parseFloat(((totals.scored / (totals.facedBalls / 6)) - (totals.conceded / (totals.bowledBalls / 6))).toFixed(3));
      }
    });

    const headToHeadPoints = (teamId: string, opponentId: string) => allMatches
      .filter(match => match.played && match.round <= 14 &&
        ((match.teamA === teamId && match.teamB === opponentId) || (match.teamA === opponentId && match.teamB === teamId)))
      .reduce((points, match) => points + (match.winner === teamId ? 2 : 0), 0);

    return Object.values(records).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      const headToHeadDifference = headToHeadPoints(b.teamId, a.teamId) - headToHeadPoints(a.teamId, b.teamId);
      if (headToHeadDifference !== 0) return headToHeadDifference;
      if (b.wicketsTaken !== a.wicketsTaken) return b.wicketsTaken - a.wicketsTaken;
      return (randomTieBreak.get(a.teamId) ?? 0) - (randomTieBreak.get(b.teamId) ?? 0);
    });
  };

  // Accumulate simulated match scorecard stats into players career stats
  const accumulateStats = (scorecard: MatchScorecard, teamA: string, teamB: string, newStats: Record<string, PlayerStats>) => {
    const addBatting = (bat: ScorecardPlayer, teamId: string) => {
      if (!newStats[bat.id]) {
        newStats[bat.id] = {
          id: bat.id,
          name: bat.name,
          teamId,
          runs: 0,
          balls: 0,
          wickets: 0,
          runsConceded: 0,
          oversBowled: 0,
          matches: 0,
          highestScore: 0,
          bestBowling: "0/0"
        };
      }
      const pStat = newStats[bat.id];
      pStat.matches++;
      pStat.runs += bat.runs ?? 0;
      pStat.balls += bat.balls ?? 0;
      if ((bat.runs ?? 0) > pStat.highestScore) {
        pStat.highestScore = bat.runs ?? 0;
      }
    };

    const addBowling = (bowl: ScorecardPlayer, teamId: string) => {
      if (!newStats[bowl.id]) {
        newStats[bowl.id] = {
          id: bowl.id,
          name: bowl.name,
          teamId,
          runs: 0,
          balls: 0,
          wickets: 0,
          runsConceded: 0,
          oversBowled: 0,
          matches: 0,
          highestScore: 0,
          bestBowling: "0/0"
        };
      }
      const pStat = newStats[bowl.id];
      pStat.wickets += bowl.wickets ?? 0;
      pStat.runsConceded += bowl.runsConceded ?? 0;
      pStat.oversBowled += bowl.overs ?? 0;

      const currentBestWkts = parseInt(pStat.bestBowling.split("/")[0]) || 0;
      const currentBestRuns = parseInt(pStat.bestBowling.split("/")[1]) || 999;
      const newWkts = bowl.wickets ?? 0;
      const newRuns = bowl.runsConceded ?? 0;
      
      if (newWkts > currentBestWkts || (newWkts === currentBestWkts && newRuns < currentBestRuns)) {
        pStat.bestBowling = `${newWkts}/${newRuns}`;
      }
    };

    // Innings A is teamA batting, teamB bowling
    scorecard.inningsA.batting.forEach(b => addBatting(b, teamA));
    scorecard.inningsA.bowling.forEach(b => addBowling(b, teamB));

    // Innings B is teamB batting, teamA bowling
    scorecard.inningsB.batting.forEach(b => addBatting(b, teamB));
    scorecard.inningsB.bowling.forEach(b => addBowling(b, teamA));
  };



  // --------------------------------------------------------------------------
  // Roster details selection helper
  // --------------------------------------------------------------------------
  const [detailedPlayerId, setDetailedPlayerId] = useState<string | null>(null);
  const detailedPlayer = detailedPlayerId ? players[detailedPlayerId] : null;

  const handleToggleStartingXI = (pid: string) => {
    if (startingXI.includes(pid)) {
      setStartingXI(startingXI.filter(id => id !== pid));
    } else {
      if (startingXI.length >= 11) {
        showToast("Starting XI is already full (11 players).");
        return;
      }
      setStartingXI([...startingXI, pid]);
    }
    saveCareerState({ startingXI: [...startingXI, pid] });
  };

  // --------------------------------------------------------------------------
  // Navigation mapping
  // --------------------------------------------------------------------------
  const mainTabConfig = {
    home: {
      label: "Home",
      icon: InboxIcon,
      subtabs: ["overview", "inbox", "dashboard", "calendar", "office"]
    },
    squad: {
      label: "Squad",
      icon: Users,
      subtabs: ["overview", "roster", "tactics"]
    },
    scouting: {
      label: "Scouting",
      icon: Search,
      subtabs: ["overview", "search", "planner"]
    },
    season: {
      label: "Season",
      icon: Trophy,
      subtabs: ["overview", "fixtures", "standings", "stats"]
    },
    history: {
      label: "History",
      icon: HistoryIcon,
      subtabs: ["overview", "clubhistory", "clubfigures", "leaguehistory", "leaguehalloffame"]
    }
  };

  // Format tab label for rendering
  const getSubTabLabel = (subtab: string): string => {
    if (subtab === "overview") return "Overview";
    if (subtab === "roster") return "Roster Overview";
    if (subtab === "tactics") return "Tactics & Playing XI";
    if (subtab === "search") return "Player Search";
    if (subtab === "reports") return "Scout Reports";
    if (subtab === "planner") return "Auction Planner";
    if (subtab === "fixtures") return "Fixtures & Results";
    if (subtab === "standings") return "Points Table";
    if (subtab === "stats") return "Tournament Stats";
    if (subtab === "office") return "Manager Office";
    if (subtab === "calendar") return "Season Calendar";
    if (subtab === "clubhistory") return "Club History";
    if (subtab === "clubfigures") return "Club Figures";
    if (subtab === "leaguehistory") return "League History";
    if (subtab === "leaguehalloffame") return "League Hall of Fame";
    return subtab.toUpperCase();
  };

  // Derive subtabs based on active main tab
  const activeSubTabs = mainTabConfig[activeTab].subtabs;

  // Filtered player search calculations
  const filteredSearchList = useMemo(() => {
    return Object.values(players)
      .filter((p): p is Player => !!p && p.currentTeamId !== userTeamId)
      .filter(p => {
        if (searchQuery) {
          return p.name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      })
      .filter(p => {
        if (filterNationality === "overseas") return p.nationality === "Overseas";
        if (filterNationality === "indian_capped") return p.nationality === "Indian" && p.isCapped;
        if (filterNationality === "indian_uncapped") return p.nationality === "Indian" && !p.isCapped;
        return true;
      })
      .filter(p => {
        if (filterRole !== "all") return p.role === filterRole;
        return true;
      })
      .filter(p => getPlayerRating(p) >= minRating)
      .sort((a,b) => getPlayerRating(b) - getPlayerRating(a))
      .slice(0, 15); // Show top 15 results
  }, [players, searchQuery, filterNationality, filterRole, minRating, userTeamId]);

  const bestScoutingPlayers = useMemo(() => Object.values(players)
    .filter((player): player is Player => !!player)
    .sort((a, b) => {
      const abilityDifference = getPlayerRating(b) - getPlayerRating(a);
      if (abilityDifference !== 0) return abilityDifference;
      const potentialDifference = Math.max(b.potentialBatting, b.potentialBowling) - Math.max(a.potentialBatting, a.potentialBowling);
      return potentialDifference || a.name.localeCompare(b.name);
    }), [players]);

  useEffect(() => {
    const list = scoutingOverviewListRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;

    const updateVisibleCount = () => {
      const rowHeight = 32;
      const overflowLineHeight = 28;
      const totalPlayers = bestScoutingPlayers.length;
      if (list.clientHeight <= 0) return;
      const rowsWithoutOverflowLine = Math.max(0, Math.floor(list.clientHeight / rowHeight));
      const nextCount = totalPlayers <= rowsWithoutOverflowLine
        ? totalPlayers
        : Math.max(1, Math.floor((list.clientHeight - overflowLineHeight) / rowHeight));
      setVisibleScoutingOverviewCount(nextCount);
    };

    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(list);
    const animationFrame = requestAnimationFrame(updateVisibleCount);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [activeTab, activeSubTab, bestScoutingPlayers.length]);

  // Derived Orange/Purple Cap lists
  const orangeCapLeaders = useMemo(() => {
    return Object.values(playerStats)
      .sort((a,b) => b.runs - a.runs)
      .slice(0, 5);
  }, [playerStats]);

  const purpleCapLeaders = useMemo(() => {
    return Object.values(playerStats)
      .sort((a,b) => b.wickets - a.wickets)
      .slice(0, 5);
  }, [playerStats]);

  // Guard clause for uninitialized games
  if (!userTeam) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="font-barlow text-text-secondary text-center">
          No active game.{" "}
          <a href="/setup" className="text-text-primary underline font-semibold">Start a new game</a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden bg-bg relative">
      {/* Global Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-[var(--ink)] text-bg border border-border/20 px-4 py-3 rounded shadow-lg text-xs font-space-mono font-semibold uppercase tracking-wider animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}



      {/* ----------------------------------------------------------------------
          Main Content Column
          ---------------------------------------------------------------------- */}
      <section className="flex-grow flex flex-col overflow-hidden bg-bg">
        {/* Top Sub-navigation Bar */}
        <header className="border-b-2 border-hairline bg-surface shrink-0 px-8 py-3 flex items-center justify-between">
          <div className="flex gap-1 overflow-x-auto py-1">
            {activeSubTabs.map((subtab) => {
              const isActive = activeSubTab === subtab;
              return (
                <button
                  key={subtab}
                  onClick={() => setActiveSubTab(subtab)}
                  className={`px-4 py-1.5 text-[10px] font-space-mono font-bold tracking-widest uppercase border-[1.5px] rounded transition-all duration-150 active:scale-95
                    ${isActive 
                      ? "bg-[var(--ink)] text-bg border-[var(--ink)]" 
                      : "bg-surface text-text-secondary border-transparent hover:bg-[#16130f]/5"}`}
                >
                  {getSubTabLabel(subtab)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Quick Stats preview */}
            <div className="font-space-mono text-[10px] text-text-secondary flex gap-4">
              <div>ROUND: <span className="font-bold text-text-primary">--</span></div>
            </div>
          </div>
        </header>

        {/* Dynamic Detail Body Screen */}
        <div className="min-h-0 flex-1 overflow-y-auto p-8">
          
          {/* ==================================================================
              MAIN TAB: HOME
              ================================================================== */}
          {activeTab === "home" && (
            <>
              {/* Home Overview tab */}
              {activeSubTab === "overview" && (
                <div className="grid h-full min-h-0 grid-cols-[minmax(16rem,0.85fr)_minmax(30rem,1.5fr)_minmax(16rem,0.85fr)] gap-6 overflow-hidden">
                  {/* Inbox column */}
                  <div onClick={() => setActiveSubTab("inbox")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col cursor-pointer transition-colors">
                    <div className="flex justify-between items-start mb-4 border-b border-[#16130f]/10 pb-2 shrink-0">
                      <div className="font-anton text-[14px] uppercase text-text-primary">INBOX MESSAGES</div>
                      <span className="font-space-mono text-[9px] bg-danger text-white px-1.5 py-0.5 rounded font-bold">
                        {inbox.filter(m => m.unread).length} UNREAD
                      </span>
                    </div>
                    <div className="space-y-3 overflow-y-auto pr-1">
                      {inbox.length === 0 ? (
                        <p className="text-xs font-barlow text-text-secondary py-3">No messages.</p>
                      ) : inbox.map(m => (
                        <div key={m.id} className="text-xs border-b border-[#16130f]/10 pb-3">
                          <div className="font-bold text-text-primary truncate">{m.subject}</div>
                          <div className="text-[10px] text-text-secondary mt-0.5">{m.sender} · {m.date}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main column */}
                  <div className="grid min-h-0 grid-rows-[1fr_3fr] gap-6">
                    <div onClick={() => setActiveSubTab("dashboard")} className="bg-surface border-2 border-border hover:border-accent p-5 cursor-pointer transition-colors overflow-hidden">
                      <div className="flex justify-between items-start mb-3 border-b border-[#16130f]/10 pb-2">
                        <div className="font-anton text-[14px] uppercase text-text-primary">NEXT OPPONENT</div>
                      </div>
                      {fixtures.filter(f => !f.played && (f.teamA === userTeamId || f.teamB === userTeamId)).length === 0 ? (
                        <p className="text-xs font-barlow text-text-secondary py-2">No fixtures scheduled.</p>
                      ) : fixtures.filter(f => !f.played && (f.teamA === userTeamId || f.teamB === userTeamId)).slice(0, 1).map(match => {
                        const oppId = match.teamA === userTeamId ? match.teamB : match.teamA;
                        const opp = teams[oppId];
                        return <div key={match.id} className="text-xs font-bold text-text-primary">{opp?.name}</div>;
                      })}
                    </div>

                    <div onClick={() => setActiveSubTab("calendar")} className="bg-surface border-2 border-border hover:border-accent p-5 cursor-pointer transition-colors overflow-hidden flex flex-col">
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex justify-between items-start mb-2 border-b border-[#16130f]/10 pb-1.5">
                        <div className="font-anton text-[14px] uppercase text-text-primary">SEASON CALENDAR</div>
                      </div>
                      
                      {/* Mini Month Label */}
                      <div className="font-space-mono text-[8px] text-text-secondary uppercase mb-1.5 flex justify-between">
                        <span>DECEMBER 2026</span>
                        <span className="text-success font-bold">ACTIVE</span>
                      </div>

                      {/* Mini Weekday Headers */}
                      <div className="grid grid-cols-7 gap-0.5 text-center font-space-mono text-[7px] font-bold text-text-secondary mb-1">
                        <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                      </div>

                      {/* Mini Days Grid */}
                      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-5 gap-0.5">
                        {/* Empty leading cells for Tuesday start in Dec */}
                        <div className="min-h-0 bg-transparent" />
                        <div className="min-h-0 bg-transparent" />
                        
                        {/* Days 1 to 31 */}
                        {Array.from({ length: 31 }).map((_, idx) => {
                          const day = idx + 1;
                          const isAuction = day === 15;
                          
                          let bg = "bg-[#16130f]/5";
                          let text = "text-text-secondary";
                          if (isAuction) {
                            bg = "bg-success text-white font-bold";
                          }
                          
                          return (
                            <div
                              key={`mini-dec-${day}`}
                              className={`min-h-0 flex items-center justify-center text-[7px] font-space-mono rounded-sm ${bg} ${text}`}
                              title={isAuction ? "Auction Day" : undefined}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  </div>

                  {/* Right column */}
                  <div className="grid min-h-0 grid-rows-3 gap-6">
                    <div onClick={() => setActiveSubTab("office")} className="bg-surface border-2 border-border hover:border-accent p-5 cursor-pointer transition-colors overflow-hidden">
                      <div className="flex justify-between items-start mb-4 border-b border-[#16130f]/10 pb-2">
                        <div className="font-anton text-[14px] uppercase text-text-primary">OFFICE SUMMARY</div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs font-space-mono text-text-secondary mb-1">
                            <span>BOARD CONFIDENCE</span>
                            <span className="font-bold text-text-primary">--%</span>
                          </div>
                          <div className="w-full bg-[#16130f]/10 h-2 rounded overflow-hidden">
                            <div className="bg-success h-full" style={{ width: `0%` }} />
                          </div>
                        </div>
                        <div className="text-xs font-space-mono text-text-secondary">
                          CONTRACT: <span className="font-bold text-text-primary">--</span>
                        </div>
                      </div>
                    </div>

                    <div onClick={() => router.push("/game/overview?tab=season&subtab=fixtures")} className="bg-surface border-2 border-border hover:border-accent p-5 cursor-pointer transition-colors overflow-hidden">
                      <h3 className="font-anton text-[14px] uppercase text-text-primary border-b border-[#16130f]/10 pb-2 mb-3">NEXT FIXTURES</h3>
                      <p className="text-xs font-barlow text-text-secondary">No fixtures have been added yet.</p>
                    </div>

                    <div onClick={() => router.push("/game/overview?tab=season&subtab=standings")} className="bg-surface border-2 border-border hover:border-accent p-5 pb-6 cursor-pointer transition-colors overflow-hidden">
                      <div className="w-full">
                        <h3 className="font-anton text-[14px] uppercase text-text-primary border-b border-[#16130f]/10 pb-2 mb-3">LEAGUE TABLE</h3>
                        <div className="relative -top-1">
                          <div className="grid grid-cols-[1fr_1.4rem_1.4rem_3rem_2rem] gap-1 pb-1 text-[8px] font-space-mono font-bold text-text-secondary uppercase">
                            <span>Team</span>
                            <span className="text-center">W</span>
                            <span className="text-center">L</span>
                            <span className="text-right">NRR</span>
                            <span className="text-right">Pts</span>
                          </div>
                          {(() => {
                        const userPosition = standings.findIndex(row => row.teamId === userTeamId);
                        const start = userPosition < 4 ? 0 : userPosition < 7 ? 3 : 5;
                        return standings.slice(start, start + 5).map((row, index) => {
                          const position = start + index + 1;
                          return (
                            <div key={row.teamId} className={`grid grid-cols-[1fr_1.4rem_1.4rem_3rem_2rem] gap-1 py-1 text-[11px] border-b border-[#16130f]/10 ${row.teamId === userTeamId ? "font-bold text-accent" : "text-text-primary"}`}>
                              <span className="truncate"><span className="font-space-mono text-text-secondary mr-1">{position}.</span>{row.shortName}</span>
                              <span className="text-center font-space-mono">{row.won}</span>
                              <span className="text-center font-space-mono">{row.lost}</span>
                              <span className="text-right font-space-mono">{row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(2)}</span>
                              <span className="text-right font-space-mono">{row.points}</span>
                            </div>
                          );
                        });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Inbox page */}
              {activeSubTab === "inbox" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px] overflow-hidden">
                  <div className="lg:col-span-1 border-2 border-border bg-surface overflow-y-auto divide-y divide-[#16130f]/10">
                    {inbox.length === 0 ? (
                      <div className="p-8 text-center text-xs font-barlow text-text-secondary">No messages.</div>
                    ) : (
                      inbox.map(msg => (
                        <button
                          key={msg.id}
                          onClick={() => {
                            setSelectedMsgId(msg.id);
                            // Mark read
                            setInbox(inbox.map(m => m.id === msg.id ? { ...m, unread: false } : m));
                          }}
                          className={`w-full p-4 text-left transition-colors flex flex-col gap-1.5 hover:bg-black/5
                            ${selectedMsgId === msg.id ? "bg-[#16130f]/5" : ""}
                            ${msg.unread ? "border-l-4 border-accent" : ""}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-space-mono text-[9px] font-bold text-text-secondary uppercase">{msg.sender}</span>
                            <span className="font-space-mono text-[8px] text-text-secondary">{msg.date}</span>
                          </div>
                          <div className="font-bold text-text-primary text-xs leading-snug truncate w-full">{msg.subject}</div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="lg:col-span-2 border-2 border-border bg-surface p-6 flex flex-col justify-between overflow-y-auto">
                    {selectedMsgId ? (
                      (() => {
                        const msg = inbox.find(m => m.id === selectedMsgId);
                        if (!msg) return null;
                        return (
                          <div className="flex flex-col h-full justify-between">
                            <div>
                              <div className="border-b border-[#16130f]/10 pb-4 mb-4">
                                <div className="flex justify-between items-center text-xs font-space-mono text-text-secondary mb-2">
                                  <span>FROM: {msg.sender}</span>
                                  <span>DATE: {msg.date}</span>
                                </div>
                                <h2 className="font-anton text-[20px] text-text-primary uppercase tracking-wide">{msg.subject}</h2>
                              </div>
                              <p className="font-barlow text-[13px] text-text-secondary whitespace-pre-line leading-relaxed">{msg.body}</p>
                            </div>


                          </div>
                        );
                      })()
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                        <AlertCircle size={32} className="mb-2 text-text-secondary/40" />
                        <span className="font-space-mono text-[10px] uppercase tracking-widest">Select a message to read</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dashboard page */}
              {activeSubTab === "dashboard" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Next Opponent & calendar */}
                  <div className="flex flex-col gap-6">
                    <div className="bg-surface border-2 border-border p-5">
                      <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">UPCOMING CALENDAR</h3>
                      <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: 14 }).map((_, i) => {
                          const round = i + 1;
                          const playedMatch = fixtures.find(f => f.round === round && (f.teamA === userTeamId || f.teamB === userTeamId) && f.played);
                          const futureMatch = fixtures.find(f => f.round === round && (f.teamA === userTeamId || f.teamB === userTeamId) && !f.played);
                          let status = "bg-[#16130f]/5 border-[#16130f]/10";
                          return (
                            <div key={round} className={`border p-2 rounded flex flex-col items-center text-center bg-surface border-border`}>
                              <span className="font-space-mono text-[8px] text-text-secondary">R{round}</span>
                              <span className="font-anton text-[12px] mt-1 text-text-secondary">
                                -
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Quick points table */}
                  <div className="bg-surface border-2 border-border p-5">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">QUICK TABLE VIEW</h3>
                    <div className="divide-y divide-[#16130f]/10">
                      <div className="grid grid-cols-6 py-2 text-[9px] font-space-mono text-text-secondary uppercase">
                        <span className="col-span-3">Team</span>
                        <span className="text-center">P</span>
                        <span className="text-center">W</span>
                        <span className="text-center">Pts</span>
                      </div>
                      {standings.slice(0, 4).map((row, idx) => (
                        <div key={row.teamId} className={`grid grid-cols-6 py-2 text-xs font-barlow ${row.teamId === userTeamId ? "font-bold text-accent" : "text-text-primary"}`}>
                          <span className="col-span-3 truncate flex gap-1.5 items-center">
                            <span className="font-space-mono text-[9px] text-text-secondary">#{idx + 1}</span>
                            {row.teamName}
                          </span>
                          <span className="text-center">{row.played}</span>
                          <span className="text-center">{row.won}</span>
                          <span className="text-center">{row.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Manager office */}
              {activeSubTab === "office" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Board expectations & attributes */}
                  <div className="bg-surface border-2 border-border p-5 flex flex-col gap-6">
                    <div>
                      <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">BOARD EXPECTATIONS</h3>
                      <ul className="text-xs font-barlow text-text-secondary space-y-2 list-disc list-inside">
                        <li>Expectation details: <span className="font-semibold text-text-primary">To be implemented.</span></li>
                      </ul>
                    </div>

                  </div>

                  {/* Board confidence gauge */}
                  <div className="bg-surface border-2 border-border p-5 flex flex-col items-center justify-center">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4 w-full text-center">BOARD TRUST</h3>
                    
                    {/* SVG Gauge */}
                    <div className="relative w-48 h-48 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="rgba(22,19,15,.1)" strokeWidth="8" fill="transparent" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="var(--success)"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={251.2}
                          strokeDashoffset={251.2}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="font-anton text-[36px] leading-none">--%</span>
                        <span className="font-space-mono text-[9px] text-text-secondary uppercase mt-1">CONFIDENCE</span>
                      </div>
                    </div>

                    <button 
                      disabled
                      className="mt-6 font-space-mono text-[9px] font-bold tracking-widest border border-border py-2 px-6 uppercase opacity-50 cursor-not-allowed"
                    >
                      REQUEST BUDGET INCREASE
                    </button>
                  </div>
                </div>
              )}

              {/* Calendar page */}
              {activeSubTab === "calendar" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full h-[calc(100vh-215px)] overflow-hidden">
                  {/* Left part: Calendar Grid */}
                  <div className="lg:col-span-2 bg-surface border-2 border-border p-5 flex flex-col h-full overflow-hidden">
                    <div className="flex flex-col h-full">
                      {/* Calendar Header with switcher */}
                      <div className="flex justify-between items-center mb-4 border-b border-[#16130f]/10 pb-3 shrink-0">
                        <div>
                          <h3 className="font-anton text-[20px] text-text-primary uppercase leading-none">{currentSeason + 1} Season Calendar</h3>
                          <span className="font-space-mono text-[9px] text-text-secondary uppercase mt-1">December 2026 to November 2027</span>
                        </div>
                        <div className="flex items-center gap-3 bg-[#16130f]/5 px-3 py-1.5 border border-border rounded">
                          <button
                            onClick={() => {
                              setCalendarMonthIndex(index => index - 1);
                              setSelectedCalendarDay(1);
                            }}
                            disabled={calendarMonthIndex === 0}
                            className="text-text-primary hover:text-accent disabled:opacity-30 disabled:pointer-events-none font-bold text-xs uppercase transition-all"
                          >
                            ←
                          </button>
                          <span className="font-space-mono text-[10px] font-bold uppercase min-w-[90px] text-center">
                            {currentCalendarMonth.label} {currentCalendarMonth.year}
                          </span>
                          <button
                            onClick={() => {
                              setCalendarMonthIndex(index => index + 1);
                              setSelectedCalendarDay(1);
                            }}
                            disabled={calendarMonthIndex === CALENDAR_MONTHS.length - 1}
                            className="text-text-primary hover:text-accent disabled:opacity-30 disabled:pointer-events-none font-bold text-xs uppercase transition-all"
                          >
                            →
                          </button>
                        </div>
                      </div>

                      {/* Weekday Labels */}
                      <div className="grid grid-cols-7 gap-1 text-center font-space-mono text-[9px] font-bold text-text-secondary uppercase mb-2 shrink-0">
                        <div>Sun</div>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                      </div>

                      {/* Days Grid: Stretch to fill layout without scrollbars */}
                      <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
                        {/* Render empty leading cells */}
                        {Array.from({ length: calendarFirstWeekday }).map((_, idx) => (
                          <div key={`empty-${idx}`} className="w-full h-full bg-[#16130f]/2 border border-dashed border-border/20 rounded-md" />
                        ))}

                        {/* Render days */}
                        {Array.from({ length: calendarDaysInMonth }).map((_, idx) => {
                          const day = idx + 1;
                          const hasAuction = currentCalendarMonth.month === 11 && currentCalendarMonth.year === 2026 && day === 15;
                          const hasRetentionDeadline = retentionDeadline?.year === currentCalendarMonth.year &&
                            retentionDeadline.month === currentCalendarMonth.month && retentionDeadline.day === day;

                          const isSelected = selectedCalendarDay === day;

                          return (
                            <button
                              key={`day-${day}`}
                              onClick={() => setSelectedCalendarDay(day)}
                              className={`w-full h-full p-2.5 border-2 text-left flex flex-col justify-between transition-colors hover:border-accent rounded-md
                                ${isSelected ? "border-[var(--ink)] bg-[var(--ink)]/5" : "border-border bg-surface"}
                                ${hasAuction || hasRetentionDeadline ? "ring-2 ring-accent/30" : ""}`}
                            >
                              <span className={`font-space-mono text-[11px] font-bold ${isSelected ? "text-[var(--ink)]" : "text-text-primary"}`}>
                                {day}
                              </span>

                              {/* Large, bold, readable event badge */}
                              {(hasAuction || hasRetentionDeadline) && (
                                <div className="w-full text-[9px] font-anton tracking-wider uppercase mt-1 leading-none">
                                  {hasAuction && <span className="text-success block">AUCTION</span>}
                                  {hasRetentionDeadline && <span className="text-danger block">RETENTION</span>}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right part: Detail Inspector Panel */}
                  <div className="bg-surface border-2 border-border p-5 flex flex-col h-full overflow-y-auto">
                    <div>
                      <h4 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">
                        Details: {selectedCalendarDay} {currentCalendarMonth.label} {currentCalendarMonth.year}
                      </h4>

                      {retentionDeadline?.year === currentCalendarMonth.year &&
                      retentionDeadline.month === currentCalendarMonth.month &&
                      retentionDeadline.day === selectedCalendarDay ? (
                        <div className="text-xs font-barlow text-text-secondary py-8 text-center">
                          <span className="font-space-mono text-[9px] bg-danger/10 text-danger px-2 py-0.5 rounded font-bold uppercase">Deadline</span>
                          <p className="mt-3">Retention deadline.</p>
                        </div>
                      ) : (
                        <div className="text-xs font-barlow text-text-secondary py-8 text-center">
                          No calendar events recorded for this day.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================================================================
              MAIN TAB: SQUAD
              ================================================================== */}
          {activeTab === "squad" && (
            <>
              {/* Squad Overview tab */}
              {activeSubTab === "overview" && (
                <div className="grid h-full min-h-0 grid-cols-[2fr_3fr] gap-6 overflow-hidden">
                  {/* Roster overview */}
                  <div onClick={() => setActiveSubTab("roster")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col cursor-pointer transition-colors overflow-hidden">
                    <div className="flex items-end justify-between border-b border-[#16130f]/10 pb-2 mb-3 shrink-0">
                      <h4 className="font-anton text-[14px] uppercase">SQUAD OVERVIEW</h4>
                      <div className="font-space-mono text-[8px] text-text-secondary uppercase">
                        {userTeam.squad.length} Players · {userTeam.overseasPlayersCurrent} Overseas
                      </div>
                    </div>

                    <div className="grid grid-cols-[minmax(0,7.5rem)_2rem_5rem_minmax(0,1fr)] gap-1 border-b border-[#16130f]/10 pb-1.5 text-[8px] font-space-mono font-bold text-text-secondary uppercase shrink-0">
                      <span>Player</span>
                      <span className="text-center">Age</span>
                      <span>Role</span>
                      <span className="grid grid-cols-[5.5rem_1rem_5.5rem] justify-center">
                        <span className="text-center">CA</span>
                        <span aria-hidden="true" />
                        <span className="text-center">PA</span>
                      </span>
                    </div>

                    <div ref={squadOverviewListRef} className="min-h-0 flex-1 overflow-hidden">
                      {userTeam.squad
                        .map(id => players[id])
                        .filter(Boolean)
                        .slice(0, visibleSquadOverviewCount)
                        .map(player => (
                          <div
                            key={player.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetailedPlayerId(player.id);
                            }}
                            className="grid h-8 grid-cols-[minmax(0,7.5rem)_2rem_5rem_minmax(0,1fr)] items-center gap-1 border-b border-[#16130f]/10 text-[10px] hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            <span className="flex min-w-0 items-center gap-1">
                              <span className="truncate font-semibold text-text-primary">{player.name}</span>
                              {player.nationality === "Overseas" && (
                                <span
                                  className="shrink-0 rounded-[2px] px-1 py-0.5 font-space-mono text-[7px] font-bold leading-none text-white"
                                  style={{ backgroundColor: userTeam.primaryColor }}
                                >
                                  OS
                                </span>
                              )}
                            </span>
                            <span className="text-center font-space-mono text-text-secondary">{player.age}</span>
                            <span className="truncate font-space-mono text-[8px] uppercase text-text-secondary">{player.role}</span>
                            <span className="grid grid-cols-[5.5rem_1rem_5.5rem] items-center justify-center">
                              {player.role === "All-Rounder" ? (
                                <>
                                  <span
                                    className="text-center font-space-mono text-[10px] font-bold text-text-primary"
                                    title={`Batting ${player.currentBatting}, Bowling ${player.currentBowling}`}
                                  >
                                    Bat {player.currentBatting}/Bowl {player.currentBowling}
                                  </span>
                                  <span aria-hidden="true" />
                                  <span
                                    className="text-center font-space-mono text-[10px] font-bold text-text-primary"
                                    title={`Batting ${player.potentialBatting}, Bowling ${player.potentialBowling}`}
                                  >
                                    Bat {player.potentialBatting}/Bowl {player.potentialBowling}
                                  </span>
                                </>
                              ) : player.role === "Pace Bowler" || player.role === "Spin Bowler" ? (
                                <>
                                  <span className="text-center font-space-mono font-bold text-text-primary">{player.currentBowling}</span>
                                  <span aria-hidden="true" />
                                  <span className="text-center font-space-mono font-bold text-text-primary">{player.potentialBowling}</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-center font-space-mono font-bold text-text-primary">{player.currentBatting}</span>
                                  <span aria-hidden="true" />
                                  <span className="text-center font-space-mono font-bold text-text-primary">{player.potentialBatting}</span>
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      {userTeam.squad.length > visibleSquadOverviewCount && (
                        <div className="flex h-7 items-center justify-center font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                          + {userTeam.squad.length - visibleSquadOverviewCount} players
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tactics preview */}
                  <div onClick={() => setActiveSubTab("tactics")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col justify-between cursor-pointer transition-colors overflow-hidden">
                    <div>
                      <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-4">TACTICS & playing xi</h4>
                      <div className="font-space-mono text-[10px] space-y-1">
                        <div>STRATEGY: <span className="font-bold text-accent">{teamStrategy}</span></div>
                        <div>SELECTED XI: <span className="font-bold text-text-primary">{startingXI.length} / 11</span></div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Roster Overview page */}
              {activeSubTab === "roster" && (
                <div className="border-2 border-border bg-surface overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[9px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-6 py-3.5">Name</th>
                          <th className="px-6 py-3.5">Role</th>
                          <th className="px-6 py-3.5">Nationality</th>
                          <th className="px-6 py-3.5 text-center">Rating</th>
                          <th className="px-6 py-3.5 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#16130f]/10">
                        {userTeam.squad.map(id => players[id]).filter(Boolean).map(p => {
                          const lastAuctionEntry = p.iplHistory.find(h => h.season === "2027");
                          const lastAuctionPrice = lastAuctionEntry?.price ?? p.basePrice;
                          const isRtmOrRetained = p.isRetained || lastAuctionEntry?.isRtm;
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setDetailedPlayerId(p.id)}
                              className="hover:bg-black/5 cursor-pointer transition-colors"
                            >
                              <td className="px-6 py-4 font-semibold text-text-primary flex items-center gap-2">
                                {p.name}
                                {startingXI.includes(p.id) && (
                                  <span className="font-space-mono text-[8px] bg-success/20 text-success px-1.5 py-0.5 rounded font-bold">XI</span>
                                )}
                                {impactPlayer === p.id && (
                                  <span className="font-space-mono text-[8px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-bold">IMP</span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-space-mono text-[10px] uppercase text-text-secondary">{p.role}</td>
                              <td className="px-6 py-4 text-text-secondary">{p.nationality}</td>
                              <td className="px-6 py-4 text-center font-bold text-success font-space-mono text-[11px]">{getPlayerRating(p)}</td>
                              <td className="px-6 py-4 text-right font-space-mono text-[10px] text-text-primary">
                                ₹{(lastAuctionPrice / 100).toFixed(2)} Cr{isRtmOrRetained ? " (RTM)" : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tactics & Playing XI page */}
              {activeSubTab === "tactics" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left list: Squad roster selection */}
                  <div className="lg:col-span-2 bg-surface border-2 border-border p-5">
                    <div className="flex justify-between items-center border-b border-[#16130f]/10 pb-3 mb-4">
                      <h3 className="font-anton text-[16px] text-text-primary uppercase">SELECT STARTING XI</h3>
                      <div className="font-space-mono text-[10px] text-text-secondary">
                        Capped: <span className="font-bold text-text-primary">{startingXI.length}/11</span>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 divide-y divide-[#16130f]/5">
                      {userTeam.squad.map(id => players[id]).filter(Boolean).map(p => {
                        const inXI = startingXI.includes(p.id);
                        return (
                          <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-text-primary">{p.name}</div>
                              <div className="font-space-mono text-[9px] text-text-secondary mt-0.5">
                                RTG: {getPlayerRating(p)} · {p.role.toUpperCase()} · {p.nationality.toUpperCase()}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {/* Impact player selection toggle */}
                              {!inXI && (
                                <button
                                  onClick={() => setImpactPlayer(impactPlayer === p.id ? "" : p.id)}
                                  className={`px-3 py-1 font-space-mono text-[8px] font-bold border rounded uppercase transition-all
                                    ${impactPlayer === p.id ? "bg-accent text-[#16130f] border-accent" : "border-border text-text-secondary hover:bg-black/5"}`}
                                >
                                  Impact
                                </button>
                              )}
                              {/* Starting XI toggle */}
                              <button
                                onClick={() => handleToggleStartingXI(p.id)}
                                className={`px-4 py-1.5 font-space-mono text-[9px] font-bold border rounded uppercase transition-all active:scale-95
                                  ${inXI ? "bg-success text-white border-success" : "border-border text-text-primary hover:bg-black/5"}`}
                              >
                                {inXI ? "Selected ✓" : "Select XI"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: XI validation & strategy selection */}
                  <div className="flex flex-col gap-6">
                    <div className="bg-surface border-2 border-border p-5">
                      <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4 font-bold">TEAM STRATEGY</h3>
                      <div className="flex flex-col gap-2">
                        {["Ultra Aggressive", "Balanced", "Anchor & Explode", "Bowling Dominant"].map(strat => (
                          <button
                            key={strat}
                            onClick={() => {
                              setTeamStrategy(strat);
                              saveCareerState({ teamStrategy: strat });
                            }}
                            className={`w-full py-2.5 font-space-mono text-[10px] font-bold border uppercase tracking-wider text-center transition-all duration-150 active:scale-95
                              ${teamStrategy === strat ? "bg-[var(--ink)] text-bg border-[var(--ink)]" : "border-border text-text-primary hover:bg-black/5"}`}
                          >
                            {strat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-surface border-2 border-border p-5">
                      <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">XI VALIDATIONS</h3>
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center gap-2">
                          {startingXI.length === 11 ? (
                            <Check size={14} className="text-success" />
                          ) : (
                            <X size={14} className="text-danger" />
                          )}
                          <span className={startingXI.length === 11 ? "text-text-secondary" : "text-danger"}>Exactly 11 players selected ({startingXI.length})</span>
                        </div>

                        {(() => {
                          const overseasInXI = startingXI.map(id => players[id]).filter(p => p && p.nationality === "Overseas").length;
                          const ok = overseasInXI <= 4;
                          return (
                            <div className="flex items-center gap-2">
                              {ok ? (
                                <Check size={14} className="text-success" />
                              ) : (
                                <X size={14} className="text-danger" />
                              )}
                              <span className={ok ? "text-text-secondary" : "text-danger"}>Maximum 4 Overseas players ({overseasInXI})</span>
                            </div>
                          );
                        })()}

                        {(() => {
                          const hasWK = startingXI.map(id => players[id]).some(p => p && (p.role === "WK-Batsman" || p.isWicketkeeper));
                          return (
                            <div className="flex items-center gap-2">
                              {hasWK ? (
                                <Check size={14} className="text-success" />
                              ) : (
                                <X size={14} className="text-danger" />
                              )}
                              <span className={hasWK ? "text-text-secondary" : "text-danger"}>At least 1 Wicketkeeper in XI</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </>
          )}

          {/* ==================================================================
              MAIN TAB: SCOUTING
              ================================================================== */}
          {activeTab === "scouting" && (
            <>
              {/* Scouting Overview tab */}
              {activeSubTab === "overview" && (
                <div className="grid h-full min-h-0 grid-cols-2 gap-6 overflow-hidden">
                  {/* Database search */}
                  <div onClick={() => setActiveSubTab("search")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col cursor-pointer transition-colors overflow-hidden">
                    <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-3 shrink-0">GLOBAL SEARCH</h4>
                    <div className="grid grid-cols-[minmax(0,7rem)_2rem_2.5rem_4.5rem_minmax(0,1fr)] gap-1 border-b border-[#16130f]/10 pb-1.5 font-space-mono text-[10px] font-bold text-text-secondary uppercase shrink-0">
                      <span>Player</span>
                      <span className="text-center">Age</span>
                      <span className="text-center">Team</span>
                      <span className="text-left">Role</span>
                      <span className="grid grid-cols-[5.5rem_1rem_5.5rem] justify-center">
                        <span className="text-center">CA</span>
                        <span aria-hidden="true" />
                        <span className="text-center">PA</span>
                      </span>
                    </div>
                    <div ref={scoutingOverviewListRef} className="relative min-h-0 flex-1 overflow-hidden">
                      {bestScoutingPlayers.slice(0, visibleScoutingOverviewCount).map(player => (
                        <div key={player.id} className="grid h-8 grid-cols-[minmax(0,7rem)_2rem_2.5rem_4.5rem_minmax(0,1fr)] items-center gap-1 border-b border-[#16130f]/10 text-[10px]">
                          <span className="flex min-w-0 items-center gap-1">
                            <span className="truncate font-semibold text-text-primary">{player.name}</span>
                            {player.nationality === "Overseas" && (
                              <span
                                className="shrink-0 rounded-[2px] bg-[#1d55c4] px-1 py-0.5 font-space-mono text-[10px] font-bold leading-none text-white"
                              >
                                OS
                              </span>
                            )}
                          </span>
                          <span className="text-center font-space-mono text-text-secondary">{player.age}</span>
                          <span className="truncate text-center font-space-mono font-bold text-text-secondary">{teams[player.currentTeamId ?? ""]?.shortName ?? "—"}</span>
                          <span className="truncate font-space-mono uppercase text-text-secondary">{player.role}</span>
                          <span className="grid grid-cols-[5.5rem_1rem_5.5rem] items-center justify-center">
                            {player.role === "All-Rounder" ? (
                              <>
                                <span className="text-center font-space-mono font-bold text-text-primary">Bat {player.currentBatting}/Bowl {player.currentBowling}</span>
                                <span aria-hidden="true" />
                                <span className="text-center font-space-mono font-bold text-text-primary">Bat {player.potentialBatting}/Bowl {player.potentialBowling}</span>
                              </>
                            ) : player.role === "Pace Bowler" || player.role === "Spin Bowler" ? (
                              <>
                                <span className="text-center font-space-mono font-bold text-text-primary">{player.currentBowling}</span>
                                <span aria-hidden="true" />
                                <span className="text-center font-space-mono font-bold text-text-primary">{player.potentialBowling}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-center font-space-mono font-bold text-text-primary">{player.currentBatting}</span>
                                <span aria-hidden="true" />
                                <span className="text-center font-space-mono font-bold text-text-primary">{player.potentialBatting}</span>
                              </>
                            )}
                          </span>
                        </div>
                      ))}
                      {bestScoutingPlayers.length > visibleScoutingOverviewCount && (
                        <div className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-surface font-space-mono text-[10px] font-bold uppercase text-text-secondary">
                          + {bestScoutingPlayers.length - visibleScoutingOverviewCount} players
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Auction planner */}
                  <div onClick={() => setActiveSubTab("planner")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col justify-between cursor-pointer transition-colors overflow-hidden">
                    <div>
                      <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-4">AUCTION PLANNER</h4>
                      <div className="space-y-2 text-xs font-space-mono text-text-secondary">
                        <div>CAP LIMIT: <span className="font-bold text-text-primary">₹120.00 Cr</span></div>
                        <div>SHORTLISTED: <span className="font-bold text-text-primary">{shortlist.length} Players</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Player Search page */}
              {activeSubTab === "search" && (
                <div className="flex flex-col gap-6">
                  {/* Search filters */}
                  <div className="bg-surface border-2 border-border p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-2">Search Name</label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type player name..."
                        className="w-full bg-[#16130f]/5 border border-border px-3 py-2 text-xs rounded outline-none text-text-primary focus:border-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="block font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-2">Nationality</label>
                      <select
                        value={filterNationality}
                        onChange={(e: any) => setFilterNationality(e.target.value)}
                        className="w-full bg-surface border border-border px-3 py-2 text-xs rounded outline-none text-text-primary"
                      >
                        <option value="all">All Talents</option>
                        <option value="indian_capped">Indian Capped</option>
                        <option value="indian_uncapped">Indian Uncapped</option>
                        <option value="overseas">Overseas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-2">Role</label>
                      <select
                        value={filterRole}
                        onChange={(e: any) => setFilterRole(e.target.value)}
                        className="w-full bg-surface border border-border px-3 py-2 text-xs rounded outline-none text-text-primary"
                      >
                        <option value="all">All Roles</option>
                        <option value="Batsman">Batter</option>
                        <option value="WK-Batsman">Wicketkeeper-Batter</option>
                        <option value="All-Rounder">All-Rounder</option>
                        <option value="Pace Bowler">Pace Bowler</option>
                        <option value="Spin Bowler">Spin Bowler</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-space-mono text-[9px] tracking-widest text-text-secondary uppercase mb-2">Minimum Rating: {minRating}</label>
                      <input
                        type="range"
                        min="50"
                        max="90"
                        value={minRating}
                        onChange={(e) => setMinRating(parseInt(e.target.value))}
                        className="w-full accent-[var(--ink)]"
                      />
                    </div>
                  </div>

                  {/* Results table */}
                  <div className="border-2 border-border bg-surface overflow-hidden">
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[9px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-6 py-3.5">Name</th>
                          <th className="px-6 py-3.5">Role</th>
                          <th className="px-6 py-3.5">Nationality</th>
                          <th className="px-6 py-3.5 text-center">Rating</th>
                          <th className="px-6 py-3.5">Current Team</th>
                          <th className="px-6 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#16130f]/10">
                        {filteredSearchList.map(p => (
                          <tr key={p.id} className="hover:bg-black/5 transition-colors">
                            <td className="px-6 py-4 font-semibold text-text-primary">{p.name}</td>
                            <td className="px-6 py-4 font-space-mono text-[10px] text-text-secondary uppercase">{p.role}</td>
                            <td className="px-6 py-4 text-text-secondary">{p.nationality}</td>
                            <td className="px-6 py-4 text-center font-bold text-success font-space-mono text-[11px]">{getPlayerRating(p)}</td>
                            <td className="px-6 py-4 text-text-secondary">{p.currentTeamId ? teams[p.currentTeamId]?.shortName : "UNSOLD"}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => toggleShortlist(p.id)}
                                className={`px-3 py-1 font-space-mono text-[9px] font-bold border rounded transition-all
                                  ${shortlist.includes(p.id) ? "bg-[var(--ink)] text-bg border-[var(--ink)]" : "border-border text-text-primary hover:bg-black/5"}`}
                              >
                                {shortlist.includes(p.id) ? "Shortlisted ✓" : "Add Shortlist"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Auction Planner page */}
              {activeSubTab === "planner" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cap details */}
                  <div className="bg-surface border-2 border-border p-5">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">CAP LIMIT DETAILS</h3>
                    <div className="space-y-4 font-space-mono text-xs">
                      <div className="flex justify-between border-b border-[#16130f]/5 pb-1">
                        <span className="text-text-secondary">TOTAL SALARY CAP</span>
                        <span className="font-bold text-text-primary">₹120.00 Cr</span>
                      </div>
                      <div className="flex justify-between border-b border-[#16130f]/5 pb-1">
                        <span className="text-text-secondary">SPENT PURSE</span>
                        <span className="font-bold text-text-primary">₹{(userTeam.spentAmount / 100).toFixed(2)} Cr</span>
                      </div>
                      <div className="flex justify-between border-b border-[#16130f]/5 pb-1">
                        <span className="text-text-secondary">CAP SPACE</span>
                        <span className="font-bold text-accent">₹{(userTeam.remainingPurse / 100).toFixed(2)} Cr</span>
                      </div>
                    </div>
                  </div>

                  {/* Shortlist list */}
                  <div className="bg-surface border-2 border-border p-5">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4">SHORTLIST TARGETS</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 divide-y divide-[#16130f]/5">
                      {shortlist.length === 0 ? (
                        <div className="text-xs font-barlow text-text-secondary p-4 text-center">Shortlist is empty. Add players from player search.</div>
                      ) : (
                        shortlist.map(id => players[id]).filter(Boolean).map(p => (
                          <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-text-primary">{p.name}</div>
                              <div className="font-space-mono text-[9px] text-text-secondary mt-0.5">
                                RTG: {getPlayerRating(p)} · {p.role.toUpperCase()}
                              </div>
                            </div>
                            <button onClick={() => toggleShortlist(p.id)} className="text-danger font-space-mono text-[9px] font-bold border border-danger/20 rounded px-2.5 py-1 hover:bg-danger/5">
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}


          {/* ==================================================================
              MAIN TAB: SEASON
              ================================================================== */}
          {activeTab === "season" && (
            <>
              {/* Season Overview tab */}
              {activeSubTab === "overview" && (
                <div className="grid h-full min-h-0 grid-cols-3 gap-6 overflow-hidden">
                  {/* Fixtures progress */}
                  <div onClick={() => setActiveSubTab("fixtures")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col justify-between cursor-pointer transition-colors overflow-hidden">
                    <div>
                      <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-4">SEASON SCHEDULE</h4>
                      <div className="font-space-mono text-[10px] space-y-1">
                        <div>COMPLETED: <span className="font-bold text-text-primary">{fixtures.filter(f=>f.played).length} / 70 Matches</span></div>
                        <div>USER PLAYED: <span className="font-bold text-text-primary">
                          {fixtures.filter(f=>f.played && (f.teamA===userTeamId || f.teamB===userTeamId)).length} / 14 Matches
                        </span></div>
                      </div>
                    </div>
                  </div>

                  {/* Points Table standings */}
                  <div onClick={() => setActiveSubTab("standings")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col cursor-pointer transition-colors overflow-hidden">
                    <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-4 shrink-0">POINTS TABLE</h4>
                    <div className="grid grid-cols-[minmax(0,1fr)_2rem_2rem_2rem_2.5rem] gap-1 border-b border-[#16130f]/10 pb-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary shrink-0">
                      <span>Team</span>
                      <span className="text-center">W</span>
                      <span className="text-center">L</span>
                      <span className="text-center">NR</span>
                      <span className="text-right">Pts</span>
                    </div>
                    <div className="min-h-0 flex-1">
                      {standings.map((row, index) => (
                        <div key={row.teamId} className={`grid h-9 grid-cols-[minmax(0,1fr)_2rem_2rem_2rem_2.5rem] items-center gap-1 border-b border-[#16130f]/10 text-[10px] ${row.teamId === userTeamId ? "font-bold text-accent" : "text-text-primary"}`}>
                          <span className="truncate"><span className="mr-1 font-space-mono text-[8px] text-text-secondary">{index + 1}.</span>{row.teamName}</span>
                          <span className="text-center font-space-mono">{row.won}</span>
                          <span className="text-center font-space-mono">{row.lost}</span>
                          <span className="text-center font-space-mono">{row.noResults}</span>
                          <span className="text-right font-space-mono font-bold">{row.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Caps leaders */}
                  <div onClick={() => setActiveSubTab("stats")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col justify-between cursor-pointer transition-colors overflow-hidden">
                    <div>
                      <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-4">ORANGE & PURPLE CAPS</h4>
                      <div className="font-space-mono text-[10px] space-y-2">
                        <div>ORANGE: <span className="font-bold text-text-primary">{orangeCapLeaders[0]?.name ?? "None"} ({orangeCapLeaders[0]?.runs ?? 0} Runs)</span></div>
                        <div>PURPLE: <span className="font-bold text-text-primary">{purpleCapLeaders[0]?.name ?? "None"} ({purpleCapLeaders[0]?.wickets ?? 0} Wickets)</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fixtures & Results page */}
              {activeSubTab === "fixtures" && (
                <div className="bg-surface border-2 border-border p-5">
                  <div className="flex justify-between items-center border-b border-[#16130f]/10 pb-3 mb-4">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase">USER FIXTURES SCHEDULE</h3>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 divide-y divide-[#16130f]/5">
                    {fixtures.filter(f => f.teamA === userTeamId || f.teamB === userTeamId).map(match => {
                      const opponentId = match.teamA === userTeamId ? match.teamB : match.teamA;
                      const opp = teams[opponentId];
                      return (
                        <div key={match.id} className="py-3 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-space-mono text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded font-bold">ROUND {match.round}</span>
                              <span className="font-bold text-text-primary">{opp?.name}</span>
                              <span className="text-[10px] text-text-secondary">({match.teamA === userTeamId ? "Home" : "Away"})</span>
                            </div>
                            {match.played && (
                              <div className="font-space-mono text-[9px] text-text-secondary mt-1">
                                {userTeam.shortName} {match.teamA === userTeamId ? `${match.scoreA?.runs}/${match.scoreA?.wickets}` : `${match.scoreB?.runs}/${match.scoreB?.wickets}`} vs{" "}
                                {opp?.shortName} {match.teamA === userTeamId ? `${match.scoreB?.runs}/${match.scoreB?.wickets}` : `${match.scoreA?.runs}/${match.scoreA?.wickets}`}
                              </div>
                            )}
                          </div>
                          <div>
                            {match.played ? (
                              <button
                                onClick={() => setActiveScorecard(match)}
                                className="px-3 py-1 font-space-mono text-[9px] font-bold border border-border rounded hover:bg-black/5 uppercase"
                              >
                                Scorecard
                              </button>
                            ) : (
                              roundMatchesReadyToSim(match.round) ? (
                                <button
                                  onClick={handleSimulateNextRound}
                                  className="px-4 py-1.5 font-space-mono text-[9px] font-bold border bg-success text-white border-success rounded uppercase transition-all active:scale-95"
                                >
                                  Simulate Match
                                </button>
                              ) : (
                                <span className="font-space-mono text-[9px] text-text-secondary uppercase">Rounds Locked</span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Points Table page */}
              {activeSubTab === "standings" && (
                <div className="border-2 border-border bg-surface overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[9px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-6 py-3.5 text-center">Pos</th>
                          <th className="px-6 py-3.5">Team</th>
                          <th className="px-6 py-3.5 text-center">P</th>
                          <th className="px-6 py-3.5 text-center">W</th>
                          <th className="px-6 py-3.5 text-center">L</th>
                          <th className="px-6 py-3.5 text-center">Pts</th>
                          <th className="px-6 py-3.5 text-right">NRR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#16130f]/10">
                        {standings.map((row, idx) => (
                          <tr key={row.teamId} className={`hover:bg-black/5 transition-colors ${row.teamId === userTeamId ? "bg-accent/5 font-bold" : ""}`}>
                            <td className="px-6 py-4 text-center font-bold text-text-secondary font-space-mono">#{idx + 1}</td>
                            <td className="px-6 py-4 font-semibold text-text-primary">{row.teamName}</td>
                            <td className="px-6 py-4 text-center font-space-mono">{row.played}</td>
                            <td className="px-6 py-4 text-center text-success font-space-mono">{row.won}</td>
                            <td className="px-6 py-4 text-center text-danger font-space-mono">{row.lost}</td>
                            <td className="px-6 py-4 text-center font-bold font-space-mono text-[13px]">{row.points}</td>
                            <td className="px-6 py-4 text-right font-space-mono">{row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tournament Stats page */}
              {activeSubTab === "stats" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Orange cap */}
                  <div className="bg-surface border-2 border-border p-5">
                    <div className="flex items-center gap-2 mb-4 border-b border-[#16130f]/10 pb-2">
                      <div className="w-4 h-4 bg-orange-500 rounded-full" />
                      <h3 className="font-anton text-[16px] text-text-primary uppercase leading-none">ORANGE CAP LEADERBOARD</h3>
                    </div>
                    <div className="divide-y divide-[#16130f]/10 text-xs">
                      {orangeCapLeaders.length === 0 ? (
                        <div className="text-center font-barlow text-text-secondary p-8">No stats recorded yet. Simulate rounds first.</div>
                      ) : (
                        orangeCapLeaders.map((player, idx) => (
                          <div key={player.id} className="py-2.5 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-text-primary">{player.name}</div>
                              <span className="font-space-mono text-[8px] text-text-secondary uppercase">{teams[player.teamId]?.shortName}</span>
                            </div>
                            <div className="text-right font-space-mono">
                              <span className="font-bold text-accent">{player.runs}</span> Runs
                              <div className="text-[9px] text-text-secondary">SR: {((player.runs / (player.balls || 1)) * 100).toFixed(1)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Purple cap */}
                  <div className="bg-surface border-2 border-border p-5">
                    <div className="flex items-center gap-2 mb-4 border-b border-[#16130f]/10 pb-2">
                      <div className="w-4 h-4 bg-purple-700 rounded-full" />
                      <h3 className="font-anton text-[16px] text-text-primary uppercase leading-none">PURPLE CAP LEADERBOARD</h3>
                    </div>
                    <div className="divide-y divide-[#16130f]/10 text-xs">
                      {purpleCapLeaders.length === 0 ? (
                        <div className="text-center font-barlow text-text-secondary p-8">No stats recorded yet. Simulate rounds first.</div>
                      ) : (
                        purpleCapLeaders.map((player, idx) => (
                          <div key={player.id} className="py-2.5 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-text-primary">{player.name}</div>
                              <span className="font-space-mono text-[8px] text-text-secondary uppercase">{teams[player.teamId]?.shortName}</span>
                            </div>
                            <div className="text-right font-space-mono">
                              <span className="font-bold text-purple-700">{player.wickets}</span> Wkts
                              <div className="text-[9px] text-text-secondary">Econ: {((player.runsConceded / (player.oversBowled || 1))).toFixed(2)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================================================================
              MAIN TAB: HISTORY
              ================================================================== */}
          {activeTab === "history" && (
            <>
              {activeSubTab === "overview" && (
                <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-6 overflow-hidden">
                  {[
                    ["clubhistory", "Club History", "Franchise seasons, honours, and milestones recorded during your career."],
                    ["clubfigures", "Club Figures", "Club records and notable contributors recorded during your career."],
                    ["leaguehistory", "League History", "Completed league seasons, standings, and results recorded in this save."],
                    ["leaguehalloffame", "League Hall of Fame", "League honours and inductees recorded during your career."],
                  ].map(([subtab, title, description]) => (
                    <button
                      key={subtab}
                      onClick={() => setActiveSubTab(subtab)}
                      className={`h-full overflow-hidden bg-surface border-2 border-border p-5 text-left hover:border-accent hover:bg-black/5 transition-colors ${
                        subtab === "clubhistory" ? "col-start-1 row-start-1" :
                        subtab === "leaguehistory" ? "col-start-1 row-start-2" :
                        subtab === "clubfigures" ? "col-start-2 row-start-1" :
                        "col-start-2 row-start-2"
                      }`}
                    >
                      <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-3">{title}</h3>
                      <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
                    </button>
                  ))}
                </div>
              )}

              {activeSubTab !== "overview" && (
                <div className="bg-surface border-2 border-border p-8 text-center">
                  <h3 className="font-anton text-[18px] text-text-primary uppercase">{getSubTabLabel(activeSubTab)}</h3>
                  <p className="mt-3 text-xs text-text-secondary">No history has been recorded yet.</p>
                </div>
              )}
            </>
          )}

        </div>
      </section>

      {/* ==================================================================
          MODAL: PLAYER DETAILED STATS POPUP
          ================================================================== */}
      {detailedPlayer && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={() => setDetailedPlayerId(null)}
        >
          <div
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border-2 border-t-4 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ borderTopColor: teams[detailedPlayer.currentTeamId ?? ""]?.primaryColor ?? "var(--accent)" }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between border-b-2 border-border bg-surface px-6 py-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-space-mono text-[9px] font-bold uppercase tracking-widest text-text-secondary">Player Profile</span>
                  {detailedPlayer.nationality === "Overseas" && (
                    <span
                      className="rounded-[2px] px-1.5 py-0.5 font-space-mono text-[8px] font-bold text-white"
                      style={{ backgroundColor: teams[detailedPlayer.currentTeamId ?? ""]?.primaryColor ?? "var(--accent)" }}
                    >
                      OS
                    </span>
                  )}
                </div>
                <h3 className="truncate font-anton text-[28px] uppercase leading-none text-text-primary">{detailedPlayer.name}</h3>
                <p className="mt-2 font-space-mono text-[10px] uppercase text-text-secondary">
                  {detailedPlayer.role} · Age {detailedPlayer.age} · {teams[detailedPlayer.currentTeamId ?? ""]?.name ?? "No current club"}
                </p>
              </div>
              <button
                onClick={() => setDetailedPlayerId(null)}
                className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface text-text-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close player profile"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto bg-surface p-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <section className="rounded border border-border bg-bg p-4 lg:col-span-1">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Player Details</h4>
                  <div className="space-y-2.5 font-space-mono text-[10px]">
                    {[
                      ["Nationality", detailedPlayer.nationality],
                      ["Batting", detailedPlayer.battingStyle],
                      ["Bowling", detailedPlayer.bowlingStyle ?? "DNB"],
                      ["Status", detailedPlayer.isCapped ? "Capped" : "Uncapped"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                        <span className="uppercase text-text-secondary">{label}</span>
                        <span className="text-right font-bold text-text-primary">{value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded border border-border bg-bg p-4 lg:col-span-2">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Ability</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Batting CA", detailedPlayer.currentBatting],
                      ["Batting PA", detailedPlayer.potentialBatting],
                      ["Bowling CA", detailedPlayer.currentBowling],
                      ["Bowling PA", detailedPlayer.potentialBowling],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-border bg-surface p-3 text-center">
                        <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{label}</div>
                        <div className="mt-1 font-anton text-[24px] text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Career T20 Stats</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                    {[
                      ["Matches", detailedPlayer.careerStats?.batting.matches ?? 0],
                      ["Bat Inns", detailedPlayer.careerStats?.batting.innings ?? 0],
                      ["Runs", detailedPlayer.careerStats?.batting.runs ?? 0],
                      ["Bat Avg", detailedPlayer.careerStats?.batting.average ?? 0],
                      ["Strike Rate", detailedPlayer.careerStats?.batting.strikeRate ?? 0],
                      ["Bowl Inns", detailedPlayer.careerStats?.bowling.matches ?? 0],
                      ["Wickets", detailedPlayer.careerStats?.bowling.wickets ?? 0],
                      ["Bowl Avg", detailedPlayer.careerStats?.bowling.average ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-border bg-surface px-2 py-3 text-center">
                        <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{label}</div>
                        <div className="mt-1 font-anton text-[18px] text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">IPL Stats</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {[
                      ["Matches", detailedPlayer.iplStats?.matches ?? 0],
                      ["Runs", detailedPlayer.iplStats?.runs ?? 0],
                      ["Bat Avg", detailedPlayer.iplStats?.battingAverage ?? 0],
                      ["Strike Rate", detailedPlayer.iplStats?.strikeRate ?? 0],
                      ["Bowl Inns", detailedPlayer.iplStats?.bowlingInnings ?? 0],
                      ["Wickets", detailedPlayer.iplStats?.wickets ?? 0],
                      ["Bowl Avg", detailedPlayer.iplStats?.bowlingAverage ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-border bg-surface px-2 py-3 text-center">
                        <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">{label}</div>
                        <div className="mt-1 font-anton text-[18px] text-text-primary">{value}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded border border-border bg-bg p-4 lg:col-span-3">
                  <h4 className="mb-3 border-b border-border pb-2 font-anton text-[13px] uppercase text-text-primary">Team History</h4>
                  <div className="grid grid-cols-[4rem_minmax(0,1fr)_5rem_4rem] gap-3 border-b border-border pb-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                    <span>Season</span>
                    <span>Team</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Method</span>
                  </div>
                  <div>
                    {[...detailedPlayer.iplHistory]
                      .filter(entry => entry.teamId && entry.teamId !== "UNSOLD")
                      .sort((a, b) => Number(b.season) - Number(a.season))
                      .map(entry => (
                        <div key={`${entry.season}-${entry.teamId}`} className="grid min-h-9 grid-cols-[4rem_minmax(0,1fr)_5rem_4rem] items-center gap-3 border-b border-border/60 text-[10px]">
                          <span className="font-space-mono text-text-secondary">{entry.season}</span>
                          <span className="truncate font-semibold text-text-primary">{teams[entry.teamId]?.name ?? entry.teamId}</span>
                          <span className="text-right font-space-mono text-text-primary">{entry.price > 0 ? formatPrice(entry.price) : "—"}</span>
                          <span className="text-right font-space-mono text-[8px] font-bold uppercase text-text-secondary">{entry.isRtm ? "RTM" : "Signed"}</span>
                        </div>
                      ))}
                    {detailedPlayer.iplHistory.every(entry => !entry.teamId || entry.teamId === "UNSOLD") && (
                      <p className="py-5 text-center text-xs text-text-secondary">No team history recorded.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL: DETAILED SCORECARD AND SIM COMMENTARY POPUP
          ================================================================== */}
      {activeScorecard && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto py-10 animate-in fade-in duration-200">
          <div className="bg-surface border-2 border-border w-full max-w-3xl rounded shadow-xl flex flex-col overflow-hidden text-left font-barlow animate-in zoom-in-95 duration-200">
            <div className="bg-border p-5 flex justify-between items-center">
              <div>
                <span className="font-space-mono text-[9px] font-bold text-accent uppercase">MATCH RESULTS · ROUND {activeScorecard.round}</span>
                <h3 className="font-anton text-[24px] leading-tight text-text-primary uppercase mt-0.5">
                  {teams[activeScorecard.teamA]?.name} vs {teams[activeScorecard.teamB]?.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveScorecard(null);
                  setActiveCommentary(null);
                }}
                className="w-8 h-8 rounded border border-border flex items-center justify-center hover:bg-black/5"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[500px] space-y-6">
              {/* Scores summary */}
              <div className="flex justify-between items-center bg-[#16130f]/5 border border-border p-4 rounded text-center">
                <div className="flex-1">
                  <div className="font-anton text-[18px] text-text-primary">{teams[activeScorecard.teamA]?.shortName}</div>
                  <div className="font-anton text-[28px] text-accent mt-1">
                    {activeScorecard.scoreA?.runs}/{activeScorecard.scoreA?.wickets}
                  </div>
                  <div className="font-space-mono text-[9px] text-text-secondary mt-1">{activeScorecard.scoreA?.overs} Overs</div>
                </div>
                <div className="font-anton text-[20px] text-text-secondary font-bold px-4">VS</div>
                <div className="flex-1">
                  <div className="font-anton text-[18px] text-text-primary">{teams[activeScorecard.teamB]?.shortName}</div>
                  <div className="font-anton text-[28px] text-accent mt-1">
                    {activeScorecard.scoreB?.runs}/{activeScorecard.scoreB?.wickets}
                  </div>
                  <div className="font-space-mono text-[9px] text-text-secondary mt-1">{activeScorecard.scoreB?.overs} Overs</div>
                </div>
              </div>

              {/* Match Result announcement */}
              <div className="text-center font-anton text-[16px] text-success bg-success/5 border border-success/15 py-2.5 uppercase tracking-wide">
                {activeScorecard.winner === activeScorecard.teamA ? teams[activeScorecard.teamA]?.name : teams[activeScorecard.teamB]?.name} Won the match!
              </div>

              {/* Detail Tabs selector */}
              <div className="flex gap-2 border-b border-[#16130f]/10 pb-3">
                <button
                  onClick={() => setActiveCommentary(null)}
                  className={`px-4 py-1.5 font-space-mono text-[10px] font-bold uppercase rounded border transition-all
                    ${activeCommentary === null ? "bg-[var(--ink)] text-bg border-[var(--ink)]" : "border-border text-text-secondary hover:bg-black/5"}`}
                >
                  Scorecard Detail
                </button>
                <button
                  onClick={() => setActiveCommentary(activeScorecard.commentary ?? [])}
                  className={`px-4 py-1.5 font-space-mono text-[10px] font-bold uppercase rounded border transition-all
                    ${activeCommentary !== null ? "bg-[var(--ink)] text-bg border-[var(--ink)]" : "border-border text-text-secondary hover:bg-black/5"}`}
                >
                  Match Summary log
                </button>
              </div>

              {/* Scorecard detail tab */}
              {activeCommentary === null && activeScorecard.scorecard && (
                <div className="space-y-6">
                  {/* Innings 1 scorecard */}
                  <div>
                    <h4 className="font-anton text-[13px] text-text-primary border-l-4 border-accent pl-2 mb-3 uppercase">
                      INNINGS 1: {teams[activeScorecard.teamA]?.name} Batting
                    </h4>
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[8px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-4 py-2">Batsman</th>
                          <th className="px-4 py-2 text-center">Runs</th>
                          <th className="px-4 py-2 text-center">Balls</th>
                          <th className="px-4 py-2 text-center">4s</th>
                          <th className="px-4 py-2 text-center">6s</th>
                          <th className="px-4 py-2 text-right">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScorecard.scorecard.inningsA.batting.filter(b=>(b.balls ?? 0) > 0).map(b => (
                          <tr key={b.id} className="border-b border-[#16130f]/5">
                            <td className="px-4 py-2 font-semibold">{b.name}</td>
                            <td className="px-4 py-2 text-center font-bold text-text-primary">{b.runs}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.balls}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.fours}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.sixes}</td>
                            <td className="px-4 py-2 text-right text-text-secondary font-space-mono">
                              {((b.runs ?? 0) / (b.balls ?? 1) * 100).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Innings 1 Bowling */}
                  <div>
                    <h4 className="font-anton text-[13px] text-text-primary border-l-4 border-accent pl-2 mb-3 uppercase">
                      INNINGS 1: {teams[activeScorecard.teamB]?.name} Bowling
                    </h4>
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[8px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-4 py-2">Bowler</th>
                          <th className="px-4 py-2 text-center">Overs</th>
                          <th className="px-4 py-2 text-center">Wickets</th>
                          <th className="px-4 py-2 text-center">Runs</th>
                          <th className="px-4 py-2 text-right">Econ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScorecard.scorecard.inningsA.bowling.filter(bowl => (bowl.overs ?? 0) > 0).map(bowl => (
                          <tr key={bowl.id} className="border-b border-[#16130f]/5">
                            <td className="px-4 py-2 font-semibold">{bowl.name}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.overs}</td>
                            <td className="px-4 py-2 text-center font-bold text-purple-700 font-space-mono">{bowl.wickets}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.runsConceded}</td>
                            <td className="px-4 py-2 text-right font-space-mono">
                              {((bowl.runsConceded ?? 0) / (bowl.overs ?? 1)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Innings 2 scorecard */}
                  <div>
                    <h4 className="font-anton text-[13px] text-text-primary border-l-4 border-accent pl-2 mb-3 uppercase">
                      INNINGS 2: {teams[activeScorecard.teamB]?.name} Batting
                    </h4>
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[8px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-4 py-2">Batsman</th>
                          <th className="px-4 py-2 text-center">Runs</th>
                          <th className="px-4 py-2 text-center">Balls</th>
                          <th className="px-4 py-2 text-center">4s</th>
                          <th className="px-4 py-2 text-center">6s</th>
                          <th className="px-4 py-2 text-right">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScorecard.scorecard.inningsB.batting.filter(b=>(b.balls ?? 0) > 0).map(b => (
                          <tr key={b.id} className="border-b border-[#16130f]/5">
                            <td className="px-4 py-2 font-semibold">{b.name}</td>
                            <td className="px-4 py-2 text-center font-bold text-text-primary">{b.runs}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.balls}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.fours}</td>
                            <td className="px-4 py-2 text-center text-text-secondary font-space-mono">{b.sixes}</td>
                            <td className="px-4 py-2 text-right text-text-secondary font-space-mono">
                              {((b.runs ?? 0) / (b.balls ?? 1) * 100).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Innings 2 Bowling */}
                  <div>
                    <h4 className="font-anton text-[13px] text-text-primary border-l-4 border-accent pl-2 mb-3 uppercase">
                      INNINGS 2: {teams[activeScorecard.teamA]?.name} Bowling
                    </h4>
                    <table className="w-full text-left font-barlow text-xs divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[8px] font-space-mono text-text-secondary uppercase">
                        <tr>
                          <th className="px-4 py-2">Bowler</th>
                          <th className="px-4 py-2 text-center">Overs</th>
                          <th className="px-4 py-2 text-center">Wickets</th>
                          <th className="px-4 py-2 text-center">Runs</th>
                          <th className="px-4 py-2 text-right">Econ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeScorecard.scorecard.inningsB.bowling.filter(bowl => (bowl.overs ?? 0) > 0).map(bowl => (
                          <tr key={bowl.id} className="border-b border-[#16130f]/5">
                            <td className="px-4 py-2 font-semibold">{bowl.name}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.overs}</td>
                            <td className="px-4 py-2 text-center font-bold text-purple-700 font-space-mono">{bowl.wickets}</td>
                            <td className="px-4 py-2 text-center font-space-mono">{bowl.runsConceded}</td>
                            <td className="px-4 py-2 text-right font-space-mono">
                              {((bowl.runsConceded ?? 0) / (bowl.overs ?? 1)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Match log tab */}
              {activeCommentary !== null && (
                <div className="space-y-4 font-mono text-xs bg-[#16130f]/5 border border-border p-4 rounded max-h-[300px] overflow-y-auto">
                  {activeCommentary.map((line, index) => (
                    <div key={index} className="border-b border-[#16130f]/5 pb-2">
                      <span className="text-text-secondary font-bold mr-2">[OVER VIEW]</span>
                      <span className="text-text-primary">{line}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper utility to check if round matches are ready to be simulated
  function roundMatchesReadyToSim(round: number) {
    const unplayed = fixtures.filter(f => !f.played).sort((a,b)=>a.round - b.round);
    return unplayed.length > 0 && unplayed[0].round === round;
  }
}

export default function OverviewPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="font-space-mono text-[11px] font-bold text-text-secondary animate-pulse uppercase tracking-widest">
          Loading Career Hub...
        </div>
      </div>
    }>
      <OverviewPageContent />
    </Suspense>
  );
}
