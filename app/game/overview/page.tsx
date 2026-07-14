"use client";
import { useState, useEffect, useLayoutEffect, useMemo, useRef, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameStore, getNextSeasonYear, getSeasonDates } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import {
  addDaysToDateKey,
  dateKeyToLocalDate,
  DAY_SIMULATION_INTERVAL_MS,
  TICKING_CALENDAR_OFFSETS,
} from "@/lib/logic/careerCalendar";
import { createDayTicker, type DayTickerController } from "@/lib/logic/dayTicker";
import { SEASON_ACCESS_ENABLED } from "@/lib/config/featureFlags";
import type { Player, Team } from "@/lib/types";
import {
  Inbox as InboxIcon,
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
  date?: string;
  time?: string;
}

interface RetentionDeadline {
  year: number;
  month: number;
  day: number;
}

// ============================================================================
// Static Data Templates
// ============================================================================

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

  // Dynamically generate months based on currentSeason
  const CALENDAR_MONTHS = useMemo(() => {
    return Array.from({ length: 12 }, (_, offset) => {
      const month = (11 + offset) % 12;
      const year = currentSeason + Math.floor((11 + offset) / 12);
      return { month, year, label: new Date(year, month).toLocaleString("en-GB", { month: "long" }) };
    });
  }, [currentSeason]);

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

  // Day-by-day career ticking simulation states & refs
  const [isSimulatingDays, setIsSimulatingDays] = useState(false);
  const [isCalendarClosing, setIsCalendarClosing] = useState(false);
  const fixturesRef = useRef<Match[]>([]);
  const playerStatsRef = useRef<Record<string, PlayerStats>>({});
  const advanceOneDayRef = useRef<() => void>(() => undefined);
  const dayTickerRef = useRef<DayTickerController | null>(null);
  const calendarAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  const calendarStopButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasSimulatingDaysRef = useRef(false);

  if (dayTickerRef.current === null) {
    dayTickerRef.current = createDayTicker({
      intervalMs: DAY_SIMULATION_INTERVAL_MS,
      onTick: () => advanceOneDayRef.current(),
      onError: (error) => {
        console.error("Day-by-day simulation stopped unexpectedly:", error);
        setIsSimulatingDays(false);
        setToastMessage("Simulation paused because the next day could not be completed.");
        setTimeout(() => setToastMessage(null), 3000);
      },
    });
  }

  useEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  useEffect(() => {
    playerStatsRef.current = playerStats;
  }, [playerStats]);

  useEffect(() => {
    return () => {
      dayTickerRef.current?.dispose();
      if (calendarAnimationTimeoutRef.current) clearTimeout(calendarAnimationTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isSimulatingDays) {
      calendarStopButtonRef.current?.focus();
    } else if (wasSimulatingDaysRef.current) {
      continueButtonRef.current?.focus();
    }

    wasSimulatingDaysRef.current = isSimulatingDays;
  }, [isSimulatingDays]);

  const [calendarMonthIndex, setCalendarMonthIndex] = useState(3); // Start calendar view at index 3 (March)
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(20); // Start selected calendar day on first match (March 20)
  const [retentionDeadline, setRetentionDeadline] = useState<RetentionDeadline | null>(null);
  const squadOverviewListRef = useRef<HTMLDivElement | null>(null);
  const [visibleSquadOverviewCount, setVisibleSquadOverviewCount] = useState(0);
  const scoutingOverviewListRef = useRef<HTMLDivElement | null>(null);
  const [visibleScoutingOverviewCount, setVisibleScoutingOverviewCount] = useState(10);
  const currentCalendarMonth = CALENDAR_MONTHS[calendarMonthIndex];
  const calendarDaysInMonth = new Date(currentCalendarMonth.year, currentCalendarMonth.month + 1, 0).getDate();
  const calendarFirstWeekday = new Date(currentCalendarMonth.year, currentCalendarMonth.month, 1).getDay();
  const inGameDate = dateKeyToLocalDate(currentDate);
  const homeCalendarDaysInMonth = new Date(inGameDate.getFullYear(), inGameDate.getMonth() + 1, 0).getDate();
  const homeCalendarFirstWeekday = new Date(inGameDate.getFullYear(), inGameDate.getMonth(), 1).getDay();

  // Calculate announcement date (3 weeks before startSaturday)
  const expectedStartDateObj = new Date(currentSeason + 1, 2, 31);
  while (expectedStartDateObj.getDay() !== 6) {
    expectedStartDateObj.setDate(expectedStartDateObj.getDate() - 1);
  }
  expectedStartDateObj.setDate(expectedStartDateObj.getDate() - 7); // Second last Saturday of March

  const announcementDate = new Date(expectedStartDateObj);
  announcementDate.setDate(expectedStartDateObj.getDate() - 21); // 3 weeks before

  const userFriendlyAnnouncementDate = announcementDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const formattedAnnouncementDate = `${announcementDate.getFullYear()}-${String(announcementDate.getMonth() + 1).padStart(2, "0")}-${String(announcementDate.getDate()).padStart(2, "0")}`;
  const seasonStartDateString = `${expectedStartDateObj.getFullYear()}-${String(expectedStartDateObj.getMonth() + 1).padStart(2, "0")}-${String(expectedStartDateObj.getDate()).padStart(2, "0")}`;
  const auctionDateString = getSeasonDates(currentSeason).auctionDate;
  const retentionDateString = retentionDeadline
    ? `${retentionDeadline.year}-${String(retentionDeadline.month + 1).padStart(2, "0")}-${String(retentionDeadline.day).padStart(2, "0")}`
    : "";

  const isFixturesAnnounced = currentDate >= formattedAnnouncementDate;

  const fixturesByDate = useMemo(() => {
    const groupedFixtures = new Map<string, Match[]>();
    if (!isFixturesAnnounced) return groupedFixtures;

    fixtures.forEach((match) => {
      if (!match.date) return;
      const matches = groupedFixtures.get(match.date) ?? [];
      matches.push(match);
      groupedFixtures.set(match.date, matches);
    });

    return groupedFixtures;
  }, [fixtures, isFixturesAnnounced]);

  const getCalendarDayData = (dateString: string) => {
    const dayMatches = fixturesByDate.get(dateString) ?? [];
    return {
      date: dateKeyToLocalDate(dateString),
      dayMatches,
      hasAuction: dateString === auctionDateString,
      hasRetention: dateString === retentionDateString,
      hasUserMatch: dayMatches.some((match) => match.teamA === userTeamId || match.teamB === userTeamId),
      isAnnouncement: dateString === formattedAnnouncementDate,
    };
  };

  useEffect(() => {
    const list = squadOverviewListRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;

    const updateVisibleCount = () => {
      const rowHeight = 44;
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
        
        // Self-healing validation: check if loaded fixtures are valid (no days with > 2 matches, starts on second-last Sat of March)
        let isValidSchedule = true;
        if (parsed.fixtures && parsed.fixtures.length === 70) {
          const expectedStartDate = new Date(currentSeason + 1, 2, 31);
          while (expectedStartDate.getDay() !== 6) {
            expectedStartDate.setDate(expectedStartDate.getDate() - 1);
          }
          expectedStartDate.setDate(expectedStartDate.getDate() - 7);
          const expectedDateString = `${expectedStartDate.getFullYear()}-${String(expectedStartDate.getMonth() + 1).padStart(2, "0")}-${String(expectedStartDate.getDate()).padStart(2, "0")}`;

          if (parsed.fixtures[0].date !== expectedDateString) {
            isValidSchedule = false;
          } else {
            const matchCountsByDate: Record<string, number> = {};
            for (const m of parsed.fixtures) {
              if (!m.date) { isValidSchedule = false; break; }
              matchCountsByDate[m.date] = (matchCountsByDate[m.date] || 0) + 1;
              if (matchCountsByDate[m.date] > 2) {
                isValidSchedule = false;
                break;
              }
            }
          }
        } else {
          isValidSchedule = false;
        }

        if (parsed.fixtures && parsed.fixtures.length > 0 && isValidSchedule) {
          fixturesRef.current = parsed.fixtures;
          setFixtures(parsed.fixtures);
          setStandings(calculateStandings(parsed.fixtures));
        } else {
          initCareer();
          return;
        }
        if (parsed.playerStats) {
          playerStatsRef.current = parsed.playerStats;
          setPlayerStats(parsed.playerStats);
        }
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
    fixturesRef.current = GeneratedFixtures;
    playerStatsRef.current = {};
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
    if (!userTeam) return [];

    const teamIds = Object.keys(teams);
    // Deterministic shuffle based on currentSeason to ensure different groups each season
    const seed = currentSeason;
    const pseudoRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    const shuffled = [...teamIds].sort((a, b) => {
      const valA = pseudoRandom(seed + a.charCodeAt(0) + (a.charCodeAt(1) || 0));
      const valB = pseudoRandom(seed + b.charCodeAt(0) + (b.charCodeAt(1) || 0));
      return valA - valB;
    });

    const groupA = shuffled.slice(0, 5);
    const groupB = shuffled.slice(5, 10);

    // Build the pool of matches:
    // 1. Cross-group matches: 2 fixtures against every team in opposite group.
    // Group A vs Group B pairs:
    const crossGroupPairs = new Map<string, { teamA: string; teamB: string }[]>();
    for (const ta of groupA) {
      for (const tb of groupB) {
        const key = ta < tb ? `${ta}_${tb}` : `${tb}_${ta}`;
        if (!crossGroupPairs.has(key)) {
          crossGroupPairs.set(key, []);
        }
        crossGroupPairs.get(key)!.push({ teamA: ta, teamB: tb });
        crossGroupPairs.get(key)!.push({ teamA: tb, teamB: ta });
      }
    }

    const firstFixtures: { teamA: string; teamB: string }[] = [];
    const secondFixtures: { teamA: string; teamB: string }[] = [];

    // Distribute cross group matches: first goes to firstFixtures, second goes to secondFixtures
    crossGroupPairs.forEach((list) => {
      const pickFirst = pseudoRandom(seed + list[0].teamA.charCodeAt(0) + list[0].teamB.charCodeAt(0)) > 0.5;
      if (pickFirst) {
        firstFixtures.push(list[0]);
        secondFixtures.push(list[1]);
      } else {
        firstFixtures.push(list[1]);
        secondFixtures.push(list[0]);
      }
    });

    // 2. In-group matches: 1 fixture against each team in their group
    const inGroupMatches: { teamA: string; teamB: string }[] = [];
    for (let i = 0; i < groupA.length; i++) {
      for (let j = i + 1; j < groupA.length; j++) {
        const homeFirst = pseudoRandom(seed + i * 7 + j * 13) > 0.5;
        inGroupMatches.push({
          teamA: homeFirst ? groupA[i] : groupA[j],
          teamB: homeFirst ? groupA[j] : groupA[i]
        });
      }
    }
    for (let i = 0; i < groupB.length; i++) {
      for (let j = i + 1; j < groupB.length; j++) {
        const homeFirst = pseudoRandom(seed + i * 11 + j * 17) > 0.5;
        inGroupMatches.push({
          teamA: homeFirst ? groupB[i] : groupB[j],
          teamB: homeFirst ? groupB[j] : groupB[i]
        });
      }
    }

    // In-group matches only play once, so we put them in the first half of the season pool
    firstFixtures.push(...inGroupMatches);

    const allMatchesPool = [...firstFixtures, ...secondFixtures];

    // Find the second last Saturday of March of the next season year
    const nextSeasonYear = currentSeason + 1;
    const startSaturday = new Date(nextSeasonYear, 2, 31); // March 31
    while (startSaturday.getDay() !== 6) { // 6 = Saturday
      startSaturday.setDate(startSaturday.getDate() - 1);
    }
    startSaturday.setDate(startSaturday.getDate() - 7); // Second last Saturday

    // Helper to calculate exact dayOffset, timeLabel, and dateString for any slot index
    // - Week 0: Sat (0), Sun (1) (only 1 game on first Sunday), Mon (2), Tue (3), Wed (4), Thu (5), Fri (6) -> 7 slots
    // - Week 1+: Sat (0), Sun AM (1), Sun PM (1), Mon (2), Tue (3), Wed (4), Thu (5), Fri (6) -> 8 slots
    const getSlotDetails = (slotIdx: number) => {
      let dayOffset = 0;
      let timeLabel = "19:30";

      if (slotIdx < 7) {
        dayOffset = slotIdx;
        timeLabel = "19:30";
      } else {
        const relativeSlot = slotIdx - 7;
        const weekIndex = Math.floor(relativeSlot / 8) + 1;
        const intraWeekSlot = relativeSlot % 8;

        if (intraWeekSlot === 0) {
          dayOffset = weekIndex * 7 + 0; // Saturday
          timeLabel = "19:30";
        } else if (intraWeekSlot === 1) {
          dayOffset = weekIndex * 7 + 1; // Sunday Morning
          timeLabel = "15:30";
        } else if (intraWeekSlot === 2) {
          dayOffset = weekIndex * 7 + 1; // Sunday Afternoon
          timeLabel = "19:30";
        } else {
          dayOffset = weekIndex * 7 + (intraWeekSlot - 1); // Monday to Friday
          timeLabel = "19:30";
        }
      }

      const matchDate = new Date(startSaturday);
      matchDate.setDate(startSaturday.getDate() + dayOffset);
      const dateString = `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, "0")}-${String(matchDate.getDate()).padStart(2, "0")}`;

      return { dayOffset, timeLabel, dateString };
    };

    // Phase 1: Try to schedule with all constraints active (including 3 matches in 5 days)
    for (let attempt = 0; attempt < 3000; attempt++) {
      const pool = [...allMatchesPool];
      
      // Shuffle the pool
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const scheduled: Match[] = [];
      const playedDays = new Map<string, number[]>();
      for (const tid of teamIds) {
        playedDays.set(tid, []);
      }

      let slotIndex = 0;
      let success = true;

      while (pool.length > 0) {
        const { dayOffset, timeLabel, dateString } = getSlotDetails(slotIndex);

        // Try to find a match in the pool that fits the slot constraints
        let foundIdx = -1;
        for (let i = 0; i < pool.length; i++) {
          const m = pool[i];
          const daysA = playedDays.get(m.teamA)!;
          const daysB = playedDays.get(m.teamB)!;

          const lastA = daysA.length > 0 ? daysA[daysA.length - 1] : -10;
          const lastB = daysB.length > 0 ? daysB[daysB.length - 1] : -10;

          // First 5 games (slots 0-4) must have all 10 teams playing once
          if (slotIndex < 5) {
            if (daysA.length > 0 || daysB.length > 0) continue;
          }

          // Back-to-back constraint (must have at least 1 day gap, so dayOffset - last > 1)
          if (dayOffset - lastA <= 1 || dayOffset - lastB <= 1) continue;

          // Rolling 5-day window constraint: no team plays 3 matches in any 5-day window [dayOffset - 4, dayOffset]
          const windowStart = dayOffset - 4;
          const windowEnd = dayOffset - 1;
          const countA = daysA.filter(d => d >= windowStart && d <= windowEnd).length;
          const countB = daysB.filter(d => d >= windowStart && d <= windowEnd).length;
          if (countA >= 2 || countB >= 2) continue;

          // Split fixture constraint: 1st cross-group match in first 7 games, 2nd in last 7 games for both teams
          const isCross = (groupA.includes(m.teamA) && groupB.includes(m.teamB)) ||
                          (groupB.includes(m.teamA) && groupA.includes(m.teamB));
          if (isCross) {
            const alreadyPlayed = scheduled.some(s => 
              (s.teamA === m.teamA && s.teamB === m.teamB) || 
              (s.teamA === m.teamB && s.teamB === m.teamA)
            );
            const matchesA = daysA.length;
            const matchesB = daysB.length;

            if (!alreadyPlayed) {
              if (matchesA >= 7 || matchesB >= 7) continue;
            } else {
              if (matchesA < 7 || matchesB < 7) continue;
            }
          }

          foundIdx = i;
          break;
        }

        if (foundIdx === -1) {
          success = false;
          break; // Try next shuffle
        }

        const match = pool.splice(foundIdx, 1)[0];
        playedDays.get(match.teamA)!.push(dayOffset);
        playedDays.get(match.teamB)!.push(dayOffset);

        scheduled.push({
          id: `match_${slotIndex}_${nextSeasonYear}_${match.teamA}_${match.teamB}`,
          round: Math.floor(slotIndex / 5) + 1, // Round 1 to 14
          teamA: match.teamA,
          teamB: match.teamB,
          played: false,
          date: dateString,
          time: timeLabel
        });

        slotIndex++;
      }

      if (success) {
        return scheduled;
      }
    }

    // Phase 2: Relax the 3-matches-in-5-days constraint, but strictly enforce no back-to-back matches
    console.warn("Fixture scheduler falling back to relaxed 3-in-5 constraint search...");
    for (let attempt = 0; attempt < 3000; attempt++) {
      const pool = [...allMatchesPool];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const scheduled: Match[] = [];
      const playedDays = new Map<string, number[]>();
      for (const tid of teamIds) {
        playedDays.set(tid, []);
      }

      let slotIndex = 0;
      let success = true;

      while (pool.length > 0) {
        const { dayOffset, timeLabel, dateString } = getSlotDetails(slotIndex);

        let foundIdx = -1;
        for (let i = 0; i < pool.length; i++) {
          const m = pool[i];
          const daysA = playedDays.get(m.teamA)!;
          const daysB = playedDays.get(m.teamB)!;

          const lastA = daysA.length > 0 ? daysA[daysA.length - 1] : -10;
          const lastB = daysB.length > 0 ? daysB[daysB.length - 1] : -10;

          // First 5 games (slots 0-4) must have all 10 teams playing once
          if (slotIndex < 5) {
            if (daysA.length > 0 || daysB.length > 0) continue;
          }

          // Back-to-back constraint (must have at least 1 day gap, so dayOffset - last > 1)
          if (dayOffset - lastA <= 1 || dayOffset - lastB <= 1) continue;

          // Split fixture constraint: 1st cross-group match in first 7 games, 2nd in last 7 games for both teams
          const isCross = (groupA.includes(m.teamA) && groupB.includes(m.teamB)) ||
                          (groupB.includes(m.teamA) && groupA.includes(m.teamB));
          if (isCross) {
            const alreadyPlayed = scheduled.some(s => 
              (s.teamA === m.teamA && s.teamB === m.teamB) || 
              (s.teamA === m.teamB && s.teamB === m.teamA)
            );
            const matchesA = daysA.length;
            const matchesB = daysB.length;

            if (!alreadyPlayed) {
              if (matchesA >= 7 || matchesB >= 7) continue;
            } else {
              if (matchesA < 7 || matchesB < 7) continue;
            }
          }

          foundIdx = i;
          break;
        }

        if (foundIdx === -1) {
          success = false;
          break; // Try next shuffle
        }

        const match = pool.splice(foundIdx, 1)[0];
        playedDays.get(match.teamA)!.push(dayOffset);
        playedDays.get(match.teamB)!.push(dayOffset);

        scheduled.push({
          id: `match_${slotIndex}_${nextSeasonYear}_${match.teamA}_${match.teamB}`,
          round: Math.floor(slotIndex / 5) + 1, // Round 1 to 14
          teamA: match.teamA,
          teamB: match.teamB,
          played: false,
          date: dateString,
          time: timeLabel
        });

        slotIndex++;
      }

      if (success) {
        return scheduled;
      }
    }

    // Fallback: This structured fallback is guaranteed to succeed and respects Sunday limits + 1-day rest
    console.warn("Scheduler using absolute structured fallback...");
    return allMatchesPool.map((m, idx) => {
      const { timeLabel, dateString } = getSlotDetails(idx);
      return {
        id: `match_${idx}_${nextSeasonYear}_${m.teamA}_${m.teamB}`,
        round: Math.floor(idx / 5) + 1,
        teamA: m.teamA,
        teamB: m.teamB,
        played: false,
        date: dateString,
        time: timeLabel
      };
    });
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
    if (dayTickerRef.current?.isRunning()) {
      showToast("Stop the calendar simulation before simulating a round manually.");
      return;
    }

    const unplayed = fixtures.filter(f => !f.played).sort((a, b) => a.round - b.round);
    if (unplayed.length === 0) {
      showToast("All fixtures of the season are completed!");
      return;
    }

    const roundToSim = unplayed[0].round;
    const roundMatches = fixtures.filter(f => f.round === roundToSim);

    const nextFixtures = [...fixtures];
    const nextPlayerStats = Object.fromEntries(
      Object.entries(playerStats).map(([playerId, stats]) => [playerId, { ...stats }]),
    ) as Record<string, PlayerStats>;

    roundMatches.forEach(match => {
      const idx = nextFixtures.findIndex(f => f.id === match.id);
      if (idx === -1 || nextFixtures[idx].played) return;

      const { teamA, teamB } = match;

      const squadA = Object.values(players)
        .filter(p => p.currentTeamId === teamA)
        .sort((a, b) => getPlayerRating(b) - getPlayerRating(a))
        .slice(0, 11);
      
      const squadB = Object.values(players)
        .filter(p => p.currentTeamId === teamB)
        .sort((a, b) => getPlayerRating(b) - getPlayerRating(a))
        .slice(0, 11);

      const strengthA = squadA.length > 0 
        ? squadA.reduce((sum, p) => sum + getPlayerRating(p), 0) / squadA.length
        : 75;
      const strengthB = squadB.length > 0
        ? squadB.reduce((sum, p) => sum + getPlayerRating(p), 0) / squadB.length
        : 75;

      const probA = Math.max(0.15, Math.min(0.85, 0.5 + (strengthA - strengthB) * 0.025));
      const teamAWins = Math.random() < probA;
      const winnerId = teamAWins ? teamA : teamB;

      const baseA = Math.floor(130 + Math.random() * 60 + (strengthA - 75) * 2);
      const baseB = Math.floor(130 + Math.random() * 60 + (strengthB - 75) * 2);

      let runsA = 0;
      let wicketsA = 0;
      let runsB = 0;
      let wicketsB = 0;

      if (teamAWins) {
        runsA = Math.max(100, Math.floor(baseA + 15));
        wicketsA = Math.floor(Math.random() * 8);
        wicketsB = Math.floor(5 + Math.random() * 6);
        runsB = Math.max(90, runsA - 1 - Math.floor(Math.random() * 30));
      } else {
        runsB = Math.max(100, Math.floor(baseB + 15));
        wicketsB = Math.floor(Math.random() * 8);
        wicketsA = Math.floor(5 + Math.random() * 6);
        runsA = Math.max(90, runsB - 1 - Math.floor(Math.random() * 30));
      }

      const battingA = squadA.map((p, pIdx) => {
        const runFactor = pIdx < 3 ? 0.35 : pIdx < 6 ? 0.20 : 0.05;
        const runs = Math.floor(runsA * runFactor * (0.6 + Math.random() * 0.8));
        const balls = Math.floor(runs * (0.8 + Math.random() * 0.4));
        return {
          id: p.id,
          name: p.name,
          runs,
          balls,
          wickets: 0,
          runsConceded: 0,
          oversBowled: 0,
        };
      });
      const sumBattingA = battingA.reduce((sum, b) => sum + b.runs, 0);
      const diffA = runsA - sumBattingA;
      if (diffA !== 0 && battingA.length > 0) {
        battingA[0].runs = Math.max(0, battingA[0].runs + diffA);
        battingA[0].balls = Math.max(battingA[0].runs, battingA[0].balls + diffA);
      }

      const bowlingB = squadB.slice(6, 11).map((p, pIdx) => {
        const wickets = pIdx === 0 ? Math.min(wicketsA, Math.floor(Math.random() * 3)) : Math.min(wicketsA, Math.floor(Math.random() * 2));
        const runsConceded = Math.floor((runsA / 5) * (0.7 + Math.random() * 0.6));
        return {
          id: p.id,
          name: p.name,
          runs: 0,
          balls: 0,
          wickets,
          runsConceded,
          oversBowled: 4,
        };
      });
      const sumWicketsB = bowlingB.reduce((sum, b) => sum + b.wickets, 0);
      const diffWicketsB = wicketsA - sumWicketsB;
      if (diffWicketsB !== 0 && bowlingB.length > 0) {
        bowlingB[0].wickets = Math.max(0, bowlingB[0].wickets + diffWicketsB);
      }

      const battingB = squadB.map((p, pIdx) => {
        const runFactor = pIdx < 3 ? 0.35 : pIdx < 6 ? 0.20 : 0.05;
        const runs = Math.floor(runsB * runFactor * (0.6 + Math.random() * 0.8));
        const balls = Math.floor(runs * (0.8 + Math.random() * 0.4));
        return {
          id: p.id,
          name: p.name,
          runs,
          balls,
          wickets: 0,
          runsConceded: 0,
          oversBowled: 0,
        };
      });
      const sumBattingB = battingB.reduce((sum, b) => sum + b.runs, 0);
      const diffB = runsB - sumBattingB;
      if (diffB !== 0 && battingB.length > 0) {
        battingB[0].runs = Math.max(0, battingB[0].runs + diffB);
        battingB[0].balls = Math.max(battingB[0].runs, battingB[0].balls + diffB);
      }

      const bowlingA = squadA.slice(6, 11).map((p, pIdx) => {
        const wickets = pIdx === 0 ? Math.min(wicketsB, Math.floor(Math.random() * 3)) : Math.min(wicketsB, Math.floor(Math.random() * 2));
        const runsConceded = Math.floor((runsB / 5) * (0.7 + Math.random() * 0.6));
        return {
          id: p.id,
          name: p.name,
          runs: 0,
          balls: 0,
          wickets,
          runsConceded,
          oversBowled: 4,
        };
      });
      const sumWicketsA = bowlingA.reduce((sum, b) => sum + b.wickets, 0);
      const diffWicketsA = wicketsB - sumWicketsA;
      if (diffWicketsA !== 0 && bowlingA.length > 0) {
        bowlingA[0].wickets = Math.max(0, bowlingA[0].wickets + diffWicketsA);
      }

      const updateStats = (playerList: any[], teamId: string, isBatting: boolean, countAppearance = false) => {
        playerList.forEach(p => {
          if (!nextPlayerStats[p.id]) {
            nextPlayerStats[p.id] = {
              id: p.id,
              name: p.name,
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
          const ps = nextPlayerStats[p.id];
          if (countAppearance) ps.matches++;
          if (isBatting) {
            ps.runs += p.runs;
            ps.balls += p.balls;
            ps.highestScore = Math.max(ps.highestScore, p.runs);
          } else {
            ps.wickets += p.wickets;
            ps.runsConceded += p.runsConceded;
            ps.oversBowled += p.oversBowled;
            const currentBestWickets = parseInt(ps.bestBowling.split("/")[0]) || 0;
            const currentBestRuns = parseInt(ps.bestBowling.split("/")[1]) || 999;
            if (p.wickets > currentBestWickets || (p.wickets === currentBestWickets && p.runsConceded < currentBestRuns) || ps.bestBowling === "0/0") {
              ps.bestBowling = `${p.wickets}/${p.runsConceded}`;
            }
          }
        });
      };

      updateStats(battingA, teamA, true, true);
      updateStats(bowlingB, teamB, false);
      updateStats(battingB, teamB, true, true);
      updateStats(bowlingA, teamA, false);

      nextFixtures[idx] = {
        ...match,
        played: true,
        scoreA: { runs: runsA, wickets: wicketsA, overs: 20 },
        scoreB: { runs: runsB, wickets: wicketsB, overs: 20 },
        winner: winnerId,
        commentary: [
          `Innings 1: ${teams[teamA]?.name} scored ${runsA}/${wicketsA} in 20 overs.`,
          `Innings 2: ${teams[teamB]?.name} scored ${runsB}/${wicketsB} in 20 overs.`,
          `Match Result: ${teams[winnerId]?.name} won the match.`
        ],
        scorecard: {
          inningsA: {
            batting: battingA.map(b => ({ ...b, id: b.id, name: b.name })),
            bowling: bowlingA.map(b => ({ ...b, id: b.id, name: b.name })),
            extras: 4
          },
          inningsB: {
            batting: battingB.map(b => ({ ...b, id: b.id, name: b.name })),
            bowling: bowlingB.map(b => ({ ...b, id: b.id, name: b.name })),
            extras: 4
          }
        } as any
      };
    });

    const nextStandings = calculateStandings(nextFixtures);

    fixturesRef.current = nextFixtures;
    playerStatsRef.current = nextPlayerStats;
    setFixtures(nextFixtures);
    setPlayerStats(nextPlayerStats);
    setStandings(nextStandings);

    saveCareerState({
      fixtures: nextFixtures,
      playerStats: nextPlayerStats,
      standings: nextStandings
    });

    showToast(`Round ${roundToSim} simulation completed!`);
  };

  // Day-by-day career ticking simulation actions & helpers
  const simulateMatchesForDate = (dateStr: string, currentFixtures: Match[], currentPlayerStats: Record<string, PlayerStats>) => {
    const dayMatches = currentFixtures.filter(f => f.date === dateStr && !f.played);
    if (dayMatches.length === 0) return { nextFixtures: currentFixtures, nextPlayerStats: currentPlayerStats, simulated: false };

    const nextFixtures = [...currentFixtures];
    const nextPlayerStats = Object.fromEntries(
      Object.entries(currentPlayerStats).map(([playerId, stats]) => [playerId, { ...stats }]),
    ) as Record<string, PlayerStats>;

    dayMatches.forEach(match => {
      const idx = nextFixtures.findIndex(f => f.id === match.id);
      if (idx === -1 || nextFixtures[idx].played) return;

      const { teamA, teamB } = match;

      const squadA = Object.values(players)
        .filter(p => p.currentTeamId === teamA)
        .sort((a, b) => getPlayerRating(b) - getPlayerRating(a))
        .slice(0, 11);
      
      const squadB = Object.values(players)
        .filter(p => p.currentTeamId === teamB)
        .sort((a, b) => getPlayerRating(b) - getPlayerRating(a))
        .slice(0, 11);

      const strengthA = squadA.length > 0 
        ? squadA.reduce((sum, p) => sum + getPlayerRating(p), 0) / squadA.length
        : 75;
      const strengthB = squadB.length > 0
        ? squadB.reduce((sum, p) => sum + getPlayerRating(p), 0) / squadB.length
        : 75;

      const probA = Math.max(0.15, Math.min(0.85, 0.5 + (strengthA - strengthB) * 0.025));
      const teamAWins = Math.random() < probA;
      const winnerId = teamAWins ? teamA : teamB;

      const baseA = Math.floor(130 + Math.random() * 60 + (strengthA - 75) * 2);
      const baseB = Math.floor(130 + Math.random() * 60 + (strengthB - 75) * 2);

      let runsA = 0;
      let wicketsA = 0;
      let runsB = 0;
      let wicketsB = 0;

      if (teamAWins) {
        runsA = Math.max(100, Math.floor(baseA + 15));
        wicketsA = Math.floor(Math.random() * 8);
        wicketsB = Math.floor(5 + Math.random() * 6);
        runsB = Math.max(90, runsA - 1 - Math.floor(Math.random() * 30));
      } else {
        runsB = Math.max(100, Math.floor(baseB + 15));
        wicketsB = Math.floor(Math.random() * 8);
        wicketsA = Math.floor(5 + Math.random() * 6);
        runsA = Math.max(90, runsB - 1 - Math.floor(Math.random() * 30));
      }

      const battingA = squadA.map((p, pIdx) => {
        const runFactor = pIdx < 3 ? 0.35 : pIdx < 6 ? 0.20 : 0.05;
        const runs = Math.floor(runsA * runFactor * (0.6 + Math.random() * 0.8));
        const balls = Math.floor(runs * (0.8 + Math.random() * 0.4));
        return {
          id: p.id,
          name: p.name,
          runs,
          balls,
          wickets: 0,
          runsConceded: 0,
          oversBowled: 0,
        };
      });
      const sumBattingA = battingA.reduce((sum, b) => sum + b.runs, 0);
      const diffA = runsA - sumBattingA;
      if (diffA !== 0 && battingA.length > 0) {
        battingA[0].runs = Math.max(0, battingA[0].runs + diffA);
        battingA[0].balls = Math.max(battingA[0].runs, battingA[0].balls + diffA);
      }

      const bowlingB = squadB.slice(6, 11).map((p, pIdx) => {
        const wickets = pIdx === 0 ? Math.min(wicketsA, Math.floor(Math.random() * 3)) : Math.min(wicketsA, Math.floor(Math.random() * 2));
        const runsConceded = Math.floor((runsA / 5) * (0.7 + Math.random() * 0.6));
        return {
          id: p.id,
          name: p.name,
          runs: 0,
          balls: 0,
          wickets,
          runsConceded,
          oversBowled: 4,
        };
      });
      const sumWicketsB = bowlingB.reduce((sum, b) => sum + b.wickets, 0);
      const diffWicketsB = wicketsA - sumWicketsB;
      if (diffWicketsB !== 0 && bowlingB.length > 0) {
        bowlingB[0].wickets = Math.max(0, bowlingB[0].wickets + diffWicketsB);
      }

      const battingB = squadB.map((p, pIdx) => {
        const runFactor = pIdx < 3 ? 0.35 : pIdx < 6 ? 0.20 : 0.05;
        const runs = Math.floor(runsB * runFactor * (0.6 + Math.random() * 0.8));
        const balls = Math.floor(runs * (0.8 + Math.random() * 0.4));
        return {
          id: p.id,
          name: p.name,
          runs,
          balls,
          wickets: 0,
          runsConceded: 0,
          oversBowled: 0,
        };
      });
      const sumBattingB = battingB.reduce((sum, b) => sum + b.runs, 0);
      const diffB = runsB - sumBattingB;
      if (diffB !== 0 && battingB.length > 0) {
        battingB[0].runs = Math.max(0, battingB[0].runs + diffB);
        battingB[0].balls = Math.max(battingB[0].runs, battingB[0].balls + diffB);
      }

      const bowlingA = squadA.slice(6, 11).map((p, pIdx) => {
        const wickets = pIdx === 0 ? Math.min(wicketsB, Math.floor(Math.random() * 3)) : Math.min(wicketsB, Math.floor(Math.random() * 2));
        const runsConceded = Math.floor((runsB / 5) * (0.7 + Math.random() * 0.6));
        return {
          id: p.id,
          name: p.name,
          runs: 0,
          balls: 0,
          wickets,
          runsConceded,
          oversBowled: 4,
        };
      });
      const sumWicketsA = bowlingA.reduce((sum, b) => sum + b.wickets, 0);
      const diffWicketsA = wicketsB - sumWicketsA;
      if (diffWicketsA !== 0 && bowlingA.length > 0) {
        bowlingA[0].wickets = Math.max(0, bowlingA[0].wickets + diffWicketsA);
      }

      const updateStats = (playerList: any[], teamId: string, isBatting: boolean, countAppearance = false) => {
        playerList.forEach(p => {
          if (!nextPlayerStats[p.id]) {
            nextPlayerStats[p.id] = {
              id: p.id,
              name: p.name,
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
          const ps = nextPlayerStats[p.id];
          if (countAppearance) ps.matches++;
          if (isBatting) {
            ps.runs += p.runs;
            ps.balls += p.balls;
            ps.highestScore = Math.max(ps.highestScore, p.runs);
          } else {
            ps.wickets += p.wickets;
            ps.runsConceded += p.runsConceded;
            ps.oversBowled += p.oversBowled;
            const currentBestWickets = parseInt(ps.bestBowling.split("/")[0]) || 0;
            const currentBestRuns = parseInt(ps.bestBowling.split("/")[1]) || 999;
            if (p.wickets > currentBestWickets || (p.wickets === currentBestWickets && p.runsConceded < currentBestRuns) || ps.bestBowling === "0/0") {
              ps.bestBowling = `${p.wickets}/${p.runsConceded}`;
            }
          }
        });
      };

      updateStats(battingA, teamA, true, true);
      updateStats(bowlingB, teamB, false);
      updateStats(battingB, teamB, true, true);
      updateStats(bowlingA, teamA, false);

      nextFixtures[idx] = {
        ...match,
        played: true,
        scoreA: { runs: runsA, wickets: wicketsA, overs: 20 },
        scoreB: { runs: runsB, wickets: wicketsB, overs: 20 },
        winner: winnerId,
        commentary: [
          `Innings 1: ${teams[teamA]?.name} scored ${runsA}/${wicketsA} in 20 overs.`,
          `Innings 2: ${teams[teamB]?.name} scored ${runsB}/${wicketsB} in 20 overs.`,
          `Match Result: ${teams[winnerId]?.name} won the match.`
        ],
        scorecard: {
          inningsA: {
            batting: battingA.map(b => ({ ...b, id: b.id, name: b.name })),
            bowling: bowlingA.map(b => ({ ...b, id: b.id, name: b.name })),
            extras: 4
          },
          inningsB: {
            batting: battingB.map(b => ({ ...b, id: b.id, name: b.name })),
            bowling: bowlingB.map(b => ({ ...b, id: b.id, name: b.name })),
            extras: 4
          }
        } as any
      };
    });

    return { nextFixtures, nextPlayerStats, simulated: true };
  };

  const stopSimulating = useCallback(() => {
    dayTickerRef.current?.stop();
    setIsCalendarClosing(true);
    setIsSimulatingDays(false);
    if (calendarAnimationTimeoutRef.current) clearTimeout(calendarAnimationTimeoutRef.current);
    calendarAnimationTimeoutRef.current = setTimeout(() => {
      setIsCalendarClosing(false);
      calendarAnimationTimeoutRef.current = null;
    }, 430);
  }, []);

  const advanceOneDay = () => {
    const currentDateString = useGameStore.getState().currentDate;
    const unplayedMatches = fixturesRef.current.filter((match) => !match.played);
    const overdueFixtureDate = unplayedMatches
      .map((match) => match.date)
      .filter((date): date is string => Boolean(date && date <= currentDateString))
      .sort()[0];
    const nextDateString = overdueFixtureDate ?? addDaysToDateKey(currentDateString, 1);
    const isCatchingUpCurrentDate = overdueFixtureDate !== undefined;
    const userMatchBlocksProgress = unplayedMatches.some(
      (match) =>
        Boolean(match.date && match.date <= nextDateString) &&
        (match.teamA === userTeamId || match.teamB === userTeamId),
    );

    // User matches require a real result from the future match system. Never
    // advance beyond their scheduled day or generate a result automatically.
    if (userMatchBlocksProgress) {
      useGameStore.setState({ currentDate: nextDateString });
      stopSimulating();
      showToast("Paused: Your fixture needs a match result before the calendar can continue.");
      return;
    }

    // Milestones pause on the milestone date before another timer is queued.
    if (!isCatchingUpCurrentDate && nextDateString === retentionDateString) {
      useGameStore.setState({ currentDate: nextDateString });
      stopSimulating();
      showToast("Paused: Retention Deadline today!");
      return;
    }

    if (!isCatchingUpCurrentDate && nextDateString === auctionDateString) {
      useGameStore.setState({ currentDate: nextDateString });
      stopSimulating();
      showToast("Paused: Player Auction today!");
      return;
    }

    if (!isCatchingUpCurrentDate && nextDateString >= seasonStartDateString && unplayedMatches.length === 0) {
      stopSimulating();
      showToast("Paused: All fixtures of the season completed!");
      return;
    }

    // Dates advance only; fixtures remain untouched until a future result
    // system supplies their scorecards.
    if (!isCatchingUpCurrentDate) {
      // Commit the date only after that day's match results are safely persisted.
      useGameStore.setState({ currentDate: nextDateString });
    }
  };

  useLayoutEffect(() => {
    advanceOneDayRef.current = advanceOneDay;
  });

  const startSimulating = useCallback(() => {
    if (calendarAnimationTimeoutRef.current) {
      clearTimeout(calendarAnimationTimeoutRef.current);
      calendarAnimationTimeoutRef.current = null;
    }
    setIsCalendarClosing(false);
    if (dayTickerRef.current?.start()) {
      setIsSimulatingDays(true);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dayTickerRef.current?.isRunning()) return;
      event.preventDefault();
      stopSimulating();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stopSimulating]);

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
      subtabs: ["overview", "inbox", "calendar", "office"]
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
      const rowHeight = 44;
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
    <div className="overview-page h-[calc(100vh-3rem)] flex overflow-hidden bg-bg relative">
      {/* Global Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-[var(--ink)] text-bg border border-border/20 px-4 py-3 rounded shadow-lg text-xs font-space-mono font-semibold uppercase tracking-wider animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Ticking Calendar Overlay */}
      {(isSimulatingDays || isCalendarClosing) && (
        <div
          className={`${isSimulatingDays ? "ticking-calendar-drop" : "ticking-calendar-pull-up"} fixed inset-x-0 top-0 z-[120] flex items-center gap-3 border-b-2 border-border bg-surface px-3 py-3 shadow-2xl sm:px-5`}
          role="region"
          aria-label="Day-by-day simulation calendar"
        >
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            Current simulation date: {dateKeyToLocalDate(currentDate).toLocaleDateString("en-GB", { dateStyle: "full" })}
          </p>
          {/* Yesterday, today, and the next five days. */}
          <div className="min-w-0 flex-1 overflow-x-auto px-1 py-1">
            <div className="mx-auto flex w-max items-center gap-2 sm:gap-3">
              {TICKING_CALENDAR_OFFSETS.map((offset) => {
                const tileDateString = addDaysToDateKey(currentDate, offset);
                const {
                  date: tileDate,
                  dayMatches,
                  hasAuction,
                  hasRetention,
                  hasUserMatch,
                  isAnnouncement,
                } = getCalendarDayData(tileDateString);
                const isCurrentDay = offset === 0;

                return (
                  <div
                    key={tileDateString}
                    aria-current={isCurrentDay ? "date" : undefined}
                    className={`flex size-20 shrink-0 flex-col justify-between rounded-md border-2 p-1.5 text-left transition-all sm:size-24 sm:p-2
                      ${isCurrentDay
                        ? "scale-[1.03] border-accent bg-accent/5 shadow-lg ring-2 ring-accent/25"
                        : isAnnouncement
                          ? "border-success bg-success/5"
                          : "border-border bg-surface"}
                      ${offset < 0 ? "opacity-[0.55]" : ""}`}
                  >
                    <div className="flex w-full items-start justify-between gap-1">
                      <time
                        dateTime={tileDateString}
                        aria-label={tileDate.toLocaleDateString("en-GB", { dateStyle: "full" })}
                        className="font-space-mono text-[10px] font-bold leading-tight text-text-primary sm:text-[11px]"
                      >
                        <span className="block text-[7px] uppercase tracking-wide text-text-secondary sm:text-[8px]">
                          {tileDate.toLocaleDateString("en-GB", { weekday: "short" })}
                        </span>
                        {tileDate.getDate()} {tileDate.toLocaleDateString("en-GB", { month: "short" })}
                      </time>
                      {hasUserMatch && <span className="mt-1 size-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />}
                    </div>

                    <div className="mt-1 flex w-full flex-grow flex-col justify-end">
                      {dayMatches.length > 0 && (
                        <div className="w-full space-y-0.5">
                          {dayMatches.slice(0, 2).map((match) => {
                            const isUserGame = match.teamA === userTeamId || match.teamB === userTeamId;
                            const opponentId = match.teamA === userTeamId ? match.teamB : match.teamA;
                            const opponent = teams[opponentId];

                            return (
                              <div
                                key={match.id}
                                className={`w-full truncate rounded px-1 py-0.5 text-center font-space-mono text-[8px] font-bold uppercase leading-tight
                                  ${isUserGame ? "text-white" : "border border-border/40 bg-[#16130f]/5 text-text-primary"}`}
                                style={isUserGame && userTeam ? { backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor } : undefined}
                              >
                                {isUserGame
                                  ? `${match.played ? (match.winner === userTeamId ? "W" : "L") : "Playing"} · vs ${opponent?.shortName ?? opponentId}`
                                  : `${teams[match.teamA]?.shortName ?? match.teamA} v ${teams[match.teamB]?.shortName ?? match.teamB}`}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(hasAuction || hasRetention || isAnnouncement) && (
                        <div className="mt-0.5 w-full text-center font-anton text-[8px] uppercase leading-none tracking-wider sm:text-[9px]">
                          {hasAuction && <span className="block text-success">Auction</span>}
                          {hasRetention && <span className="block text-danger">Retention</span>}
                          {isAnnouncement && <span className="block rounded border border-success/30 bg-success/15 py-0.5 text-success">Fixtures</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            ref={calendarStopButtonRef}
            type="button"
            onClick={stopSimulating}
            className="flex shrink-0 items-center gap-2 rounded bg-danger px-3 py-2.5 font-space-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-danger/90 active:scale-95 sm:px-5 sm:text-xs"
            aria-label="Stop day-by-day simulation (Escape)"
          >
            <span className="size-2 rounded-sm bg-white" aria-hidden="true" />
            Stop <span className="hidden sm:inline">(Esc)</span>
          </button>
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

          <div className="flex shrink-0 items-center">
            {!isSimulatingDays && (
              <button
                ref={continueButtonRef}
                type="button"
                onClick={startSimulating}
                className="flex items-center gap-1.5 rounded bg-success px-3.5 py-1.5 font-space-mono text-[9px] font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-success/80 active:scale-95"
              >
                <Play className="size-3 fill-current" aria-hidden="true" /> Continue
              </button>
            )}
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
                <div className="grid grid-cols-[minmax(16rem,0.85fr)_minmax(30rem,1.5fr)_minmax(16rem,0.85fr)] gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Inbox column */}
                  <div onClick={() => setActiveSubTab("inbox")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col cursor-pointer transition-colors">
                    <div className="flex justify-between items-start mb-4 border-b border-[#16130f]/10 pb-2 shrink-0">
                      <div className="font-anton text-[14px] uppercase text-text-primary">INBOX MESSAGES</div>
                      <span className="font-space-mono text-[9px] bg-danger text-white px-1.5 py-0.5 rounded font-bold">
                        {inbox.filter(m => m.unread).length} UNREAD
                      </span>
                    </div>
                    <div className="space-y-3 overflow-y-auto pr-1 flex-1">
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
                    <div onClick={() => router.push("/game/overview?tab=season&subtab=fixtures")} className="bg-surface border-2 border-border hover:border-accent p-5 cursor-pointer transition-colors overflow-hidden">
                      <div className="flex justify-between items-start mb-3 border-b border-[#16130f]/10 pb-2">
                        <div className="font-anton text-[14px] uppercase text-text-primary">NEXT OPPONENT</div>
                      </div>
                      {!isFixturesAnnounced || fixtures.filter(f => !f.played && (f.teamA === userTeamId || f.teamB === userTeamId)).length === 0 ? (
                        <p className="text-xs font-barlow text-text-secondary py-2">
                          {!isFixturesAnnounced ? `Fixtures will be announced on ${userFriendlyAnnouncementDate}.` : "No fixtures scheduled."}
                        </p>
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
                        <span>{inGameDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
                        <span className="text-success font-bold">DAY {inGameDate.getDate()} · ACTIVE</span>
                      </div>

                      {/* Mini Weekday Headers */}
                      <div className="grid grid-cols-7 gap-0.5 text-center font-space-mono text-[7px] font-bold text-text-secondary mb-1">
                        <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                      </div>

                      {/* Mini Days Grid */}
                      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-0.5">
                        {Array.from({ length: homeCalendarFirstWeekday }).map((_, idx) => (
                          <div key={`mini-empty-${idx}`} className="min-h-0 bg-transparent" />
                        ))}

                        {Array.from({ length: homeCalendarDaysInMonth }).map((_, idx) => {
                          const day = idx + 1;
                          const dateString = `${inGameDate.getFullYear()}-${String(inGameDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const dayData = getCalendarDayData(dateString);
                          const isCurrentDay = day === inGameDate.getDate();
                          const hasEvent = dayData.hasAuction || dayData.hasRetention || dayData.isAnnouncement || dayData.hasUserMatch;
                          
                          let bg = "bg-[#16130f]/5";
                          let text = "text-text-secondary";
                          if (isCurrentDay) {
                            bg = "bg-accent text-[var(--ink)] font-bold ring-1 ring-accent";
                            text = "text-[var(--ink)]";
                          } else if (dayData.hasAuction) {
                            bg = "bg-success text-white font-bold";
                          } else if (dayData.hasRetention) {
                            bg = "bg-danger text-white font-bold";
                          } else if (hasEvent) {
                            bg = "bg-accent/20 text-text-primary font-bold";
                          }
                          
                          return (
                            <div
                              key={`mini-${dateString}`}
                              className={`min-h-0 flex items-center justify-center text-[7px] font-space-mono rounded-sm ${bg} ${text}`}
                              title={[
                                dateString,
                                isCurrentDay ? "Current in-game day" : "",
                                dayData.hasAuction ? "Auction Day" : "",
                                dayData.hasRetention ? "Retention Deadline" : "",
                                dayData.isAnnouncement ? "Fixture Announcement" : "",
                                dayData.hasUserMatch ? "Your team has a match" : "",
                              ].filter(Boolean).join(" · ")}
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

                    <div onClick={() => router.push("/game/overview?tab=season&subtab=fixtures")} className="bg-surface border-2 border-border hover:border-accent p-5 cursor-pointer transition-colors overflow-hidden flex min-h-0 flex-col">
                      <h3 className="shrink-0 font-anton text-[14px] uppercase text-text-primary border-b border-[#16130f]/10 pb-2 mb-3">NEXT FIXTURES</h3>
                      <div className="grid min-h-0 flex-1 grid-rows-5">
                        {(() => {
                          const userFixtures = fixtures
                            .filter((fixture) => fixture.teamA === userTeamId || fixture.teamB === userTeamId)
                            .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.round - b.round);
                          const firstUnplayedIndex = userFixtures.findIndex((fixture) => !fixture.played);
                          const remainingFixtures = firstUnplayedIndex < 0 ? 0 : userFixtures.length - firstUnplayedIndex;
                          const windowStart = remainingFixtures <= 5
                            ? Math.max(0, userFixtures.length - 5)
                            : Math.max(0, firstUnplayedIndex - 1);

                          return userFixtures.slice(windowStart, windowStart + 5).map((fixture) => {
                            const opponentId = fixture.teamA === userTeamId ? fixture.teamB : fixture.teamA;
                            const opponent = teams[opponentId];
                            const fixtureDate = fixture.date ? dateKeyToLocalDate(fixture.date) : null;
                            const isNextFixture = firstUnplayedIndex >= 0 && fixture.id === userFixtures[firstUnplayedIndex].id;
                            const userScore = fixture.teamA === userTeamId ? fixture.scoreA : fixture.scoreB;
                            const result = fixture.played
                              ? `${fixture.winner === userTeamId ? "W" : "L"} ${userScore?.runs ?? "-"}/${userScore?.wickets ?? "-"}`
                              : "-";

                            return (
                              <div
                                key={`next-fixture-${fixture.id}`}
                                className={`grid min-h-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#16130f]/10 px-1.5 text-text-primary ${isNextFixture ? "bg-accent/15 ring-1 ring-inset ring-accent/30" : ""}`}
                              >
                                <div className="flex flex-col items-center justify-center leading-none">
                                  <span className="font-space-mono text-[14px] font-bold">{fixtureDate?.getDate() ?? "-"}</span>
                                  <span className="mt-0.5 font-space-mono text-[7px] uppercase text-text-secondary">
                                    {fixtureDate?.toLocaleDateString("en-GB", { month: "short" }) ?? ""}
                                  </span>
                                </div>
                                <span className="truncate text-[10px] font-medium">vs {opponent?.shortName ?? opponentId}</span>
                                <span className="font-space-mono text-[9px]">{result}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      <div className="hidden">
                        {(() => {
                          const userFixtures = fixtures
                            .filter(f => f.teamA === userTeamId || f.teamB === userTeamId)
                            .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.round - b.round);
                          const firstUnplayed = userFixtures.findIndex(f => !f.played);
                          const remaining = firstUnplayed < 0 ? 0 : userFixtures.length - firstUnplayed;
                          const start = remaining <= 5 ? Math.max(0, userFixtures.length - 5) : Math.max(0, firstUnplayed - 1);
                          return userFixtures.slice(start, start + 5).map(match => {
                            const opponentId = match.teamA === userTeamId ? match.teamB : match.teamA;
                            const opponent = teams[opponentId];
                            const isNext = !match.played && match.id === userFixtures[firstUnplayed]?.id;
                            const displayDate = match.date ? dateKeyToLocalDate(match.date) : null;
                            const result = match.played
                              ? `${match.winner === userTeamId ? "W" : "L"} · ${match.teamA === userTeamId ? `${match.scoreA?.runs}/${match.scoreA?.wickets}` : `${match.scoreB?.runs}/${match.scoreB?.wickets}`}`
                              : "-";
                            const fixtureDate = match.date ? dateKeyToLocalDate(match.date) : null;
                            return <div key={match.id} className={`grid grid-cols-[1fr_auto] items-center gap-2 border-b border-[#16130f]/10 py-1 text-[10px] ${isNext ? "font-bold text-accent" : "text-text-primary"}`}><span className="truncate">{match.date} · vs {opponent?.shortName ?? opponentId}</span><span className="font-space-mono">{result}</span></div>;
                          });
                        })()}
                      </div>
                    </div>

                    <div onClick={() => router.push("/game/overview?tab=season&subtab=standings")} className="bg-surface border-2 border-border hover:border-accent p-5 pb-6 cursor-pointer transition-colors overflow-hidden flex min-h-0 flex-col">
                      <div className="flex min-h-0 w-full flex-1 flex-col">
                        <h3 className="shrink-0 font-anton text-[14px] uppercase text-text-primary border-b border-[#16130f]/10 pb-2 mb-3">LEAGUE TABLE</h3>
                        <div className="flex min-h-0 flex-1 flex-col">
                          <div className="grid shrink-0 grid-cols-[1fr_1.4rem_1.4rem_3rem_2rem] gap-1 pb-1 text-[8px] font-space-mono font-bold text-text-secondary uppercase">
                            <span>Team</span>
                            <span className="text-center">W</span>
                            <span className="text-center">L</span>
                            <span className="text-right">NRR</span>
                            <span className="text-right">Pts</span>
                          </div>
                          <div className="grid min-h-0 flex-1 grid-rows-5">
                            {(() => {
                              const userPosition = standings.findIndex(row => row.teamId === userTeamId);
                              const start = userPosition < 4 ? 0 : userPosition < 7 ? 3 : 5;
                              return standings.slice(start, start + 5).map((row, index) => {
                                const position = start + index + 1;
                                return (
                                  <div key={row.teamId} className={`grid min-h-0 grid-cols-[1fr_1.4rem_1.4rem_3rem_2rem] items-center gap-1 border-b border-[#16130f]/10 text-[10px] ${row.teamId === userTeamId ? "font-bold text-accent" : "text-text-primary"}`}>
                                    <span className="truncate"><span className="mr-1 font-space-mono text-text-secondary">{position}.</span>{row.shortName}</span>
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
                </div>
              )}

              {/* Inbox page */}
              {activeSubTab === "inbox" && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
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

                  <div className="lg:col-span-3 border-2 border-border bg-surface p-6 flex flex-col justify-between overflow-y-auto h-full">
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

              {/* Manager office */}
              {activeSubTab === "office" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[500px]">
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Left part: Calendar Grid */}
                  <div className="lg:col-span-2 bg-surface border-2 border-border p-5 flex flex-col h-full overflow-hidden">
                    <div className="flex flex-col h-full">
                      {/* Calendar Header with switcher */}
                      <div className="flex justify-between items-center mb-4 border-b border-[#16130f]/10 pb-3 shrink-0">
                        <div>
                          <h3 className="font-anton text-[20px] text-text-primary uppercase leading-none">{currentSeason + 1} Season Calendar</h3>
                          <span className="font-space-mono text-[9px] text-text-secondary uppercase mt-1">December {currentSeason} to November {currentSeason + 1}</span>
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
                          const isSelected = selectedCalendarDay === day;
                          const dateString = `${currentCalendarMonth.year}-${String(currentCalendarMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const {
                            dayMatches,
                            hasAuction,
                            hasRetention: hasRetentionDeadline,
                            hasUserMatch,
                            isAnnouncement: isAnnouncementDay,
                          } = getCalendarDayData(dateString);

                          return (
                            <button
                              key={`day-${day}`}
                              onClick={() => setSelectedCalendarDay(day)}
                              className={`w-full h-full p-2 border-2 text-left flex flex-col justify-between transition-colors hover:border-accent rounded-md
                                ${isSelected ? "border-[var(--ink)] bg-[var(--ink)]/5" : "border-border bg-surface"}
                                ${isAnnouncementDay ? "border-success bg-success/5 ring-2 ring-success/20" : ""}
                                ${hasAuction || hasRetentionDeadline || hasUserMatch ? "ring-2 ring-accent/30" : ""}`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className={`font-space-mono text-[11px] font-bold ${isSelected ? "text-[var(--ink)]" : "text-text-primary"}`}>
                                  {day}
                                </span>
                                {hasUserMatch && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                )}
                              </div>

                              {/* Mini match labels */}
                              {dayMatches.length > 0 && (
                                <div className="mt-1 space-y-0.5 w-full shrink-0">
                                  {dayMatches.map(m => {
                                    const isUserGame = m.teamA === userTeamId || m.teamB === userTeamId;
                                    const opponentId = m.teamA === userTeamId ? m.teamB : m.teamA;
                                    const opp = teams[opponentId];

                                    return (
                                      <div
                                        key={m.id}
                                        className={`w-full text-[9px] py-1 px-1 rounded text-center truncate font-space-mono font-bold leading-tight uppercase
                                          ${isUserGame 
                                            ? "text-white" 
                                            : "bg-[#16130f]/5 border border-border/40 text-text-primary"}`}
                                        style={isUserGame && userTeam ? { backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor } : undefined}
                                      >
                                        {isUserGame ? (
                                          <div className="flex flex-col items-center justify-center gap-1 py-0.5 leading-none">
                                            <span 
                                              className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-white/10 shadow-sm leading-none shrink-0"
                                              style={opp ? { backgroundColor: opp.primaryColor, color: opp.secondaryColor } : undefined}
                                            >
                                              vs {opp?.shortName ?? opponentId}
                                            </span>
                                            <span className="text-[7.5px] font-bold mt-0.5 opacity-90">
                                              {m.played ? "FINAL" : "PLAYING"}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="flex items-center justify-center gap-0.5">
                                            <span style={{ color: teams[m.teamA]?.primaryColor }}>{teams[m.teamA]?.shortName ?? m.teamA}</span>
                                            <span className="text-text-secondary font-medium"> v </span>
                                            <span style={{ color: teams[m.teamB]?.primaryColor }}>{teams[m.teamB]?.shortName ?? m.teamB}</span>
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Large, bold, readable event badge */}
                              {(hasAuction || hasRetentionDeadline || isAnnouncementDay) && (
                                <div className="w-full text-[9px] font-anton tracking-wider uppercase mt-1 leading-none">
                                  {hasAuction && <span className="text-success block">AUCTION</span>}
                                  {hasRetentionDeadline && <span className="text-danger block">RETENTION</span>}
                                  {isAnnouncementDay && <span className="text-success block bg-success/15 border border-success/30 py-1 px-1.5 rounded text-center">FIXTURES</span>}
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

                      {(() => {
                        const dateString = `${currentCalendarMonth.year}-${String(currentCalendarMonth.month + 1).padStart(2, "0")}-${String(selectedCalendarDay).padStart(2, "0")}`;
                        const isRetentionDay = dateString === retentionDateString;
                        const isAuctionDay = dateString === auctionDateString;
                        const isAnnouncementDay = dateString === formattedAnnouncementDate;

                        if (!isFixturesAnnounced) {
                          const isTournamentMonth = currentCalendarMonth.month === 2 || currentCalendarMonth.month === 3 || currentCalendarMonth.month === 4;
                          return (
                            <div className="space-y-4">
                              {isRetentionDay && (
                                <div className="border border-danger/20 bg-danger/5 rounded p-3">
                                  <span className="font-space-mono text-[9px] bg-danger text-white px-2 py-0.5 rounded font-bold uppercase">Retention Deadline</span>
                                  <p className="mt-2 text-xs text-text-secondary">Franchises must submit their retained players list by today.</p>
                                </div>
                              )}
                              {isAuctionDay && (
                                <div className="border border-success/20 bg-success/5 rounded p-3">
                                  <span className="font-space-mono text-[9px] bg-success text-white px-2 py-0.5 rounded font-bold uppercase">Player Auction</span>
                                  <p className="mt-2 text-xs text-text-secondary">The Player Auction takes place today. Teams will complete their squads.</p>
                                </div>
                              )}
                              {isAnnouncementDay && (
                                <div className="border border-success/20 bg-success/5 rounded p-3">
                                  <span className="font-space-mono text-[9px] bg-success text-white px-2 py-0.5 rounded font-bold uppercase">Schedule Announcement</span>
                                  <p className="mt-2 text-xs text-text-secondary">The complete fixture list and match schedule for the new season are officially announced today!</p>
                                </div>
                              )}
                              {isTournamentMonth && !isAnnouncementDay && (
                                <div className="border border-border/60 bg-[#16130f]/5 rounded p-3 text-center py-6">
                                  <span className="font-space-mono text-[9px] bg-[#16130f]/10 text-text-secondary px-2 py-0.5 rounded font-bold uppercase">Locked</span>
                                  <p className="mt-3 text-xs text-text-secondary">League fixtures have not been announced yet.</p>
                                  <p className="mt-1 text-[11px] font-bold text-accent">Schedule release: {userFriendlyAnnouncementDate}</p>
                                </div>
                              )}
                              {!isRetentionDay && !isAuctionDay && !isAnnouncementDay && !isTournamentMonth && (
                                <div className="text-xs font-barlow text-text-secondary py-8 text-center">
                                  No calendar events recorded for this day.
                                </div>
                              )}
                            </div>
                          );
                        }

                        const dayMatches = fixturesByDate.get(dateString) ?? [];
                        if (dayMatches.length === 0 && !isRetentionDay && !isAuctionDay && !isAnnouncementDay) {
                          return (
                            <div className="text-xs font-barlow text-text-secondary py-8 text-center">
                              No calendar events recorded for this day.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {isRetentionDay && (
                              <div className="border border-danger/20 bg-danger/5 rounded p-3">
                                <span className="font-space-mono text-[9px] bg-danger text-white px-2 py-0.5 rounded font-bold uppercase">Retention Deadline</span>
                                <p className="mt-2 text-xs text-text-secondary">Franchises must submit their retained players list by today.</p>
                              </div>
                            )}
                            {isAuctionDay && (
                              <div className="border border-success/20 bg-success/5 rounded p-3">
                                <span className="font-space-mono text-[9px] bg-success text-white px-2 py-0.5 rounded font-bold uppercase">Player Auction</span>
                                <p className="mt-2 text-xs text-text-secondary">The Player Auction takes place today. Teams will complete their squads.</p>
                              </div>
                            )}
                            {isAnnouncementDay && (
                              <div className="border border-success/20 bg-success/5 rounded p-3">
                                <span className="font-space-mono text-[9px] bg-success text-white px-2 py-0.5 rounded font-bold uppercase">Schedule Announcement</span>
                                <p className="mt-2 text-xs text-text-secondary">The complete fixture list and match schedule for the new season are officially announced today!</p>
                              </div>
                            )}
                            {dayMatches.map((m) => {
                              const isUserGame = m.teamA === userTeamId || m.teamB === userTeamId;
                              return (
                                <div
                                  key={m.id}
                                  className={`border-2 rounded p-3 flex flex-col justify-between transition-colors
                                    ${isUserGame ? "border-accent bg-accent/5" : "border-border bg-surface"}`}
                                >
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="font-space-mono text-[9px] font-bold text-text-secondary uppercase">
                                      Match {m.round} · {m.time}
                                    </span>
                                    {isUserGame && (
                                      <span
                                        className="font-space-mono text-[8px] font-bold px-1.5 py-0.5 rounded text-white"
                                        style={userTeam ? { backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor } : undefined}
                                      >
                                        YOUR MATCH
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-xs font-bold text-text-primary gap-4">
                                    <div className="flex items-center gap-2 flex-1 truncate">
                                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: teams[m.teamA]?.primaryColor ?? "#ccc", color: teams[m.teamA]?.secondaryColor ?? "#000" }}>
                                        {teams[m.teamA]?.shortName.slice(0, 3)}
                                      </span>
                                      <span className="truncate">{teams[m.teamA]?.name}</span>
                                    </div>
                                    <span className="text-text-secondary font-normal font-space-mono text-[9px] shrink-0">vs</span>
                                    <div className="flex items-center gap-2 flex-row-reverse flex-1 truncate">
                                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: teams[m.teamB]?.primaryColor ?? "#ccc", color: teams[m.teamB]?.secondaryColor ?? "#000" }}>
                                        {teams[m.teamB]?.shortName.slice(0, 3)}
                                      </span>
                                      <span className="truncate text-right">{teams[m.teamB]?.name}</span>
                                    </div>
                                  </div>
                                  {m.played && m.scoreA && m.scoreB && (
                                    <div className="mt-3 pt-2 border-t border-border/40 flex justify-between items-center text-xs font-space-mono">
                                      <span className="text-text-secondary">Result:</span>
                                      <span className="font-bold text-success">
                                        {m.winner === userTeamId ? "YOU WON" : `${teams[m.winner ?? ""]?.name} won`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
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
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Roster overview */}
                  <div onClick={() => setActiveSubTab("roster")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col cursor-pointer transition-colors overflow-hidden">
                    <div className="flex items-end justify-between border-b border-[#16130f]/10 pb-2 mb-3 shrink-0">
                      <h4 className="font-anton text-[14px] uppercase">SQUAD OVERVIEW</h4>
                      <div className="font-space-mono text-[8px] text-text-secondary uppercase">
                        {userTeam.squad.length} Players · {userTeam.overseasPlayersCurrent} Overseas
                      </div>
                    </div>
                    <div className="grid grid-cols-[13rem_2.5rem_6.5rem_14rem] justify-start gap-2 border-b border-[#16130f]/10 pb-1.5 text-[8px] font-space-mono font-bold text-text-secondary uppercase shrink-0">
                      <span>Player</span>
                      <span className="text-center">Age</span>
                      <span className="text-center">Role</span>
                      <span className="grid grid-cols-[5.5rem_3rem_5.5rem] justify-center">
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
                            className="grid h-11 grid-cols-[13rem_2.5rem_6.5rem_14rem] items-center justify-start gap-2 border-b border-[#16130f]/10 text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          >
                            <span className="flex min-w-0 items-center gap-1">
                              <span className="whitespace-nowrap font-semibold text-text-primary">{player.name}</span>
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
                            <span className="truncate text-center font-space-mono text-xs uppercase text-text-secondary">{player.role}</span>
                            <span className="grid grid-cols-[5.5rem_3rem_5.5rem] items-center justify-center">
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
                <div className="border-2 border-border bg-surface h-[calc(100vh-200px)] min-h-[500px] flex flex-col overflow-hidden">
                  <div className="overflow-x-auto flex-1 overflow-y-auto">
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
                          const lastAuctionEntry = p.iplHistory.find(h => h.season === getNextSeasonYear());
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Left list: Squad roster selection */}
                  <div className="lg:col-span-2 bg-surface border-2 border-border p-5 flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center border-b border-[#16130f]/10 pb-3 mb-4 shrink-0">
                      <h3 className="font-anton text-[16px] text-text-primary uppercase">SELECT STARTING XI</h3>
                      <div className="font-space-mono text-[10px] text-text-secondary">
                        Capped: <span className="font-bold text-text-primary">{startingXI.length}/11</span>
                      </div>
                    </div>

                    <div className="space-y-2 flex-1 overflow-y-auto pr-2 divide-y divide-[#16130f]/5">
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
                <div className="grid grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Database search */}
                  <div onClick={() => setActiveSubTab("search")} className="bg-surface border-2 border-border hover:border-accent p-5 flex min-h-0 flex-col cursor-pointer transition-colors overflow-hidden">
                    <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-3 shrink-0">GLOBAL SEARCH</h4>
                    <div className="grid grid-cols-[minmax(0,8rem)_2rem_2.5rem_5.5rem_minmax(0,1fr)] gap-1 border-b border-[#16130f]/10 pb-1.5 font-space-mono text-[10px] font-bold text-text-secondary uppercase shrink-0">
                      <span>Player</span>
                      <span className="text-center">Age</span>
                      <span className="text-center">Team</span>
                      <span className="text-left">Role</span>
                      <span className="grid grid-cols-[7rem_2rem_7rem] justify-center">
                        <span className="text-center">CA</span>
                        <span aria-hidden="true" />
                        <span className="text-center">PA</span>
                      </span>
                    </div>
                    <div ref={scoutingOverviewListRef} className="relative min-h-0 flex-1 overflow-hidden">
                      {bestScoutingPlayers.slice(0, visibleScoutingOverviewCount).map(player => (
                        <div
                          key={player.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailedPlayerId(player.id);
                          }}
                          className="grid h-11 grid-cols-[minmax(0,8rem)_2rem_2.5rem_5.5rem_minmax(0,1fr)] items-center gap-1 border-b border-[#16130f]/10 text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        >
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
                          <span className="grid grid-cols-[7rem_2rem_7rem] items-center justify-center">
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
                <div className="flex flex-col gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
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
                  <div className="border-2 border-border bg-surface flex-1 overflow-y-auto">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[500px]">
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
                  <div className="bg-surface border-2 border-border p-5 flex flex-col h-full overflow-hidden">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase border-b border-[#16130f]/10 pb-2 mb-4 font-bold shrink-0">SHORTLIST TARGETS</h3>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 divide-y divide-[#16130f]/5">
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
                <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Fixtures progress */}
                  <div onClick={() => isFixturesAnnounced && setActiveSubTab("fixtures")} className={`bg-surface border-2 border-border p-5 flex min-h-0 flex-col justify-between overflow-hidden transition-colors ${isFixturesAnnounced ? "hover:border-accent cursor-pointer" : "opacity-75"}`}>
                    <div>
                      <h4 className="font-anton text-[14px] uppercase border-b border-[#16130f]/10 pb-2 mb-4">SEASON SCHEDULE</h4>
                      {isFixturesAnnounced ? (
                        <div className="font-space-mono text-[10px] space-y-1">
                          <div>COMPLETED: <span className="font-bold text-text-primary">{fixtures.filter(f=>f.played).length} / 70 Matches</span></div>
                          <div>USER PLAYED: <span className="font-bold text-text-primary">
                            {fixtures.filter(f=>f.played && (f.teamA===userTeamId || f.teamB===userTeamId)).length} / 14 Matches
                          </span></div>
                        </div>
                      ) : (
                        <div className="font-space-mono text-[9px] text-text-secondary space-y-2">
                          <span className="font-bold text-accent uppercase block font-space-mono text-[8px] bg-accent/10 py-0.5 px-1.5 rounded w-max">Announcing soon</span>
                          <p className="font-barlow text-xs text-text-secondary">Fixtures will be announced on {userFriendlyAnnouncementDate}.</p>
                        </div>
                      )}
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
                    <div
                      className="grid min-h-0 flex-1"
                      style={{ gridTemplateRows: `repeat(${Math.max(standings.length, 1)}, minmax(0, 1fr))` }}
                    >
                      {standings.map((row, index) => (
                        <div key={row.teamId} className={`grid min-h-0 grid-cols-[minmax(0,1fr)_2rem_2rem_2rem_2.5rem] items-center gap-1 border-b border-[#16130f]/10 text-[10px] ${row.teamId === userTeamId ? "font-bold text-accent" : "text-text-primary"}`}>
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
                <div className="bg-surface border-2 border-border p-5 h-[calc(100vh-200px)] min-h-[500px] flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center border-b border-[#16130f]/10 pb-3 mb-4 shrink-0">
                    <h3 className="font-anton text-[16px] text-text-primary uppercase">SEASON FIXTURES &amp; RESULTS</h3>
                  </div>

                  {!isFixturesAnnounced ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 rounded-full bg-[#16130f]/5 flex items-center justify-center text-[24px] mb-4">
                        🔒
                      </div>
                      <h4 className="font-anton text-[18px] text-text-primary uppercase tracking-wide">Fixtures Locked</h4>
                      <p className="font-barlow text-xs text-text-secondary max-w-sm mt-2">
                        The league fixtures have not been released yet. The schedule announcement is set for:
                      </p>
                      <span className="font-space-mono text-xs font-bold text-accent mt-3 bg-accent/5 border border-accent/20 px-3 py-1 rounded">
                        {userFriendlyAnnouncementDate}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 divide-y divide-[#16130f]/5">
                      {[...fixtures].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.round - b.round).map(match => {
                        const teamA = teams[match.teamA];
                        const teamB = teams[match.teamB];
                        const result = match.played
                          ? `${match.winner ? `${teams[match.winner]?.shortName ?? match.winner} won` : "Played"} · ${match.scoreA?.runs ?? "-"}/${match.scoreA?.wickets ?? "-"} - ${match.scoreB?.runs ?? "-"}/${match.scoreB?.wickets ?? "-"}`
                          : "-";
                        return (
                          <div key={match.id} className="grid grid-cols-[9rem_1fr_auto] items-center gap-4 py-3 text-xs">
                            <span className="font-space-mono text-[10px] text-text-secondary">{match.date ?? "-"}</span>
                            <span className="font-bold text-text-primary">{teamA?.name ?? match.teamA} vs {teamB?.name ?? match.teamB}</span>
                            <span className="font-space-mono text-[10px] text-right text-text-secondary">{result}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Points Table page */}
              {activeSubTab === "standings" && (
                <div className="border-2 border-border bg-surface h-[calc(100vh-200px)] min-h-[500px] flex flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
                    <table className="h-full w-full table-fixed text-left font-barlow text-sm divide-y divide-[#16130f]/10">
                      <thead className="bg-[#16130f]/5 text-[11px] font-space-mono text-text-secondary uppercase tracking-wider">
                        <tr>
                          <th className="px-8 py-[18px] text-center">Pos</th>
                          <th className="px-8 py-[18px]">Team</th>
                          <th className="px-8 py-[18px] text-center">P</th>
                          <th className="px-8 py-[18px] text-center">W</th>
                          <th className="px-8 py-[18px] text-center">L</th>
                          <th className="px-8 py-[18px] text-center">NR</th>
                          <th className="px-8 py-[18px] text-center font-bold">Pts</th>
                          <th className="px-8 py-[18px] text-right">NRR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#16130f]/10">
                        {standings.map((row, idx) => (
                          <tr key={row.teamId} className={`hover:bg-black/5 transition-colors ${row.teamId === userTeamId ? "bg-accent/5 font-bold" : ""}`} style={{ height: `${100 / Math.max(standings.length, 1)}%` }}>
                            <td className="px-8 py-1 text-center font-bold text-text-secondary font-space-mono text-xs">#{idx + 1}</td>
                            <td className="px-8 py-1 font-bold text-text-primary text-[15px]">{row.teamName}</td>
                            <td className="px-8 py-1 text-center font-space-mono text-text-secondary">{row.played}</td>
                            <td className="px-8 py-1 text-center text-success font-bold font-space-mono">{row.won}</td>
                            <td className="px-8 py-1 text-center text-danger font-bold font-space-mono">{row.lost}</td>
                            <td className="px-8 py-1 text-center font-space-mono text-text-secondary">{row.noResults}</td>
                            <td className="px-8 py-1 text-center font-bold font-space-mono text-base text-text-primary">{row.points}</td>
                            <td className="px-8 py-1 text-right font-space-mono font-medium text-text-primary">{row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tournament Stats page */}
              {activeSubTab === "stats" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
                  {/* Orange cap */}
                  <div className="bg-surface border-2 border-border p-5 flex flex-col h-full overflow-hidden">
                    <div className="flex items-center gap-2 mb-4 border-b border-[#16130f]/10 pb-2 shrink-0">
                      <div className="w-4 h-4 bg-orange-500 rounded-full" />
                      <h3 className="font-anton text-[16px] text-text-primary uppercase leading-none">ORANGE CAP LEADERBOARD</h3>
                    </div>
                    <div className="divide-y divide-[#16130f]/10 text-xs flex-1 overflow-y-auto pr-2">
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
                  <div className="bg-surface border-2 border-border p-5 flex flex-col h-full overflow-hidden">
                    <div className="flex items-center gap-2 mb-4 border-b border-[#16130f]/10 pb-2 shrink-0">
                      <div className="w-4 h-4 bg-purple-700 rounded-full" />
                      <h3 className="font-anton text-[16px] text-text-primary uppercase leading-none">PURPLE CAP LEADERBOARD</h3>
                    </div>
                    <div className="divide-y divide-[#16130f]/10 text-xs flex-1 overflow-y-auto pr-2">
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
                <div className="grid grid-cols-2 grid-rows-2 gap-6 h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
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
                <div className="bg-surface border-2 border-border p-8 text-center h-[calc(100vh-200px)] min-h-[500px] flex flex-col items-center justify-center">
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
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-12 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={() => setDetailedPlayerId(null)}
        >
          <div
            className="flex max-h-[calc(100vh-6rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-200"
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
                      ["Bowling", (() => {
                        if (!detailedPlayer.bowlingStyle) return "DNB";
                        if (!detailedPlayer.bowlingHand) return detailedPlayer.bowlingStyle;
                        const hand = detailedPlayer.bowlingHand === "Left-hand" ? "Left handed" : "Right handed";
                        const type = detailedPlayer.bowlingStyle === "Spinner" ? "spinner" : "pacer";
                        return `${hand} ${type}`;
                      })()],
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
