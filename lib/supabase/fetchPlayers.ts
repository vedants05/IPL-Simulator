import { supabase } from "./client";
import { Player, Nationality, Role, Potential, BowlingType, IPLStats } from "../types";
import { calculateBasePrice } from "../logic/playerBasePrice";
import { enforceBattingPositionEligibility } from "../logic/playerBattingPositions";

export { calculateBasePrice } from "../logic/playerBasePrice";

export const TEAM_MAP: Record<string, string> = {
  "Kolkata Knight Riders": "KKR",
  "Mumbai Indians": "MI",
  "Royal Challengers Bengaluru": "RCB",
  "Gujarat Titans": "GT",
  "Rajasthan Royals": "RR",
  "Lucknow Super Giants": "LSG",
  "Sunrisers Hyderabad": "SRH",
  "Punjab Kings": "PBKS",
  "Chennai Super Kings": "CSK",
  "Delhi Capitals": "DC",
};

export const ROLE_MAP: Record<string, string> = {
  "Batter": "Batsman",
  "Bowler (Pace)": "Pace Bowler",
  "Bowler (Spinner)": "Spin Bowler",
  "All-Rounder": "All-Rounder",
  "Wicketkeeper-Batter": "WK-Batsman",
};

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function bowlStyle(bowlType: string | null): BowlingType | null {
  if (!bowlType || bowlType === "NA") return null;
  if (bowlType === "Spinner") return "Spinner";
  if (bowlType === "Pacer") return "Pacer";
  return null;
}

export function genPotential(curBat: number, potBat: number, curBowl: number, potBowl: number, age: number): Potential {
  const maxCur = Math.max(curBat, curBowl);
  const maxPot = Math.max(potBat, potBowl);
  const gap    = maxPot - maxCur;
  if (maxCur >= 88)           return "World Class";
  if (gap >= 15 && age <= 22) return "Wonderkid";
  if (gap >= 8)               return "Promising";
  return "Established";
}

function readOptionalRating(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const rating = Number(value);
  return Number.isFinite(rating) ? Math.max(0, Math.min(100, rating)) : undefined;
}

export function mapRowsToPlayers(data: any[]): Player[] {
  const seenIds = new Set<string>();

  return data
    .filter((row: any) => String(row.name ?? "").trim().toLocaleLowerCase("en-GB") !== "ajinkya rahane")
    .map((row: any) => {
    const rawTeam = row.team || "";
    const teamId = TEAM_MAP[rawTeam] || null;
    const name = row.name;
    const age = parseInt(row.age) || 0;
    const openingContractPrice = Math.round((parseFloat(row.ipl_2026_salary) || 0) * 100);
    const nat = row.overseas_status === "Overseas" ? "Overseas" : "Indian";
    const isCapped = row.status === "Capped" || name === "Yash Thakur";
    const role = (ROLE_MAP[row.primary_role] ?? "Batsman") as Role;
    const bowlType = row.bowling_type || "NA";
    const batHand = (row.batting_hand || "").includes("LHB") || (row.batting_hand || "").toLowerCase().includes("left") ? "Left-hand" : "Right-hand";
    const bowlHand = (row.bowling_hand || "").toLowerCase().includes("left") ? "Left-hand" : (row.bowling_hand || "").toLowerCase().includes("right") ? "Right-hand" : null;

    const isGurnoorBrar = name === "Gurnoor Singh Brar";
    const curBat = parseInt(row.current_batting) || 0;
    const potBat = parseInt(row.potential_batting) || 0;
    const curBowl = isGurnoorBrar ? 78 : parseInt(row.current_bowling) || 0;
    const potBowl = isGurnoorBrar ? 84 : parseInt(row.potential_bowling) || 0;
    
    const reputation = parseInt(row.reputation) || 5;
    const isWicketkeeper = row.can_keep_wickets === true;
    const isPartTimeWk = name === "Rahul Tripathi" ? false : row.part_time_wicketkeeper === true;
    const isOpener = name === "Finn Allen" || name === "Ayush Mhatre" ? true : row.opener === true;
    const isRiyanParag = name === "Riyan Parag";
    const isRishabhPant = name === "Rishabh Pant";
    const isSuryanshShedge = name === "Suryansh Shedge";
    const isFinisher = isRishabhPant ? false : (isSuryanshShedge ? true : (isRiyanParag ? false : row.finisher === true));
    const isAnukul = name === "Anukul Roy";
    const isCoreBatter = isRishabhPant ? true : (isRiyanParag ? true : (isAnukul ? false : row.core_batter === true));
    const onlyOpensOrBenched = name === "Finn Allen" ? true : row.only_opener === true;
    const captaincy = parseInt(row.captaincy) || 50;
    // The source field is a positive desire flag. A false value means that the
    // player must not be offered IPL captaincy. Dhoni is explicitly unavailable.
    const isIplCaptaincyUnavailable = name === "MS Dhoni" || row.ipl_captain_desire === false;
    const setForRelease = row.set_for_release === true;
    const battingAggression = name === "Vaibhav Suryavanshi"
      ? 99
      : parseInt(row.batting_aggression) || 50;
    
    const isPhillips = name === "Glenn Phillips";
    const isTripathi = name === "Rahul Tripathi";
    const hasBattedAt3 = isPhillips ? true : row.has_batted_at_3 === true;
    const hasBattedAt4 = isRishabhPant ? true : row.has_batted_at_4 === true;
    const hasBattedAt5 = row.has_batted_at_5 === true;
    const hasBattedAt6 = isSuryanshShedge ? true : (isTripathi ? false : row.has_batted_at_6 === true);
    const hasBattedAt7 = isSuryanshShedge ? true : (isTripathi ? false : row.has_batted_at_7 === true);

    const playerRating = Math.max(curBat, curBowl);
    const base = calculateBasePrice(isCapped, nat, playerRating, reputation);

    let id = toSlug(name);
    if (seenIds.has(id)) {
      id = `${id}-${(teamId || "unsold").toLowerCase()}`;
    }
    seenIds.add(id);

    // Historical rows come only from the paired team_YYYY / salary_YYYY
    // columns. The live 2026 contract is intentionally stored separately so
    // it can seed the opening 2027 mini auction without rewriting history.
    const iplHistory: { teamId: string; season: string; price: number }[] = [];
    const seasons = [
      "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008"
    ];
    for (const season of seasons) {
      const teamVal = row[`team_${season}`];
      const salaryVal = row[`salary_${season}`];
      if (teamVal) {
        iplHistory.push({
          teamId: teamVal,
          season,
          price: salaryVal ? Math.round(salaryVal * 100) : 0,
        });
      } else {
        iplHistory.push({
          teamId: "UNSOLD",
          season,
          price: 0,
        });
      }
    }

    const t20Games = parseInt(row.t20_games) || 0;
    const t20BatInns = parseInt(row.t20_batting_innings) || 0;
    const t20Runs = parseInt(row.t20_runs) || 0;
    const t20Wickets = parseInt(row.t20_wickets) || 0;
    const t20BowlInns = parseInt(row.t20_bowling_innings) || 0;
    const iplBowlBalls = parseInt(row.ipl_bowling_balls) || 0;
    const iplRunsConceded = parseInt(row.ipl_runs_conceded) || 0;
    const iplBestWkts = parseInt(row.ipl_best_bowling_wickets) || 0;
    const iplBestRuns = parseInt(row.ipl_best_bowling_runs) || 0;

    const iplStats: IPLStats = {
      matches: parseInt(row.ipl_games) || 0,
      innings: parseInt(row.ipl_batting_innings) || 0,
      notOuts: parseInt(row.ipl_not_outs) || 0,
      runs: parseInt(row.ipl_runs) || 0,
      ballsFaced: parseInt(row.ipl_balls_faced) || 0,
      battingAverage: parseFloat(row.ipl_average) || 0,
      strikeRate: parseFloat(row.ipl_strike_rate) || 0,
      highScore: parseInt(row.ipl_high_score) || 0,
      fifties: parseInt(row.ipl_fifties) || 0,
      hundreds: parseInt(row.ipl_hundreds) || 0,
      fours: parseInt(row.ipl_fours) || 0,
      sixes: parseInt(row.ipl_sixes) || 0,
      bowlingInnings: parseInt(row.ipl_bowling_innings) || 0,
      bowlingBalls: iplBowlBalls,
      runsConceded: iplRunsConceded,
      wickets: parseInt(row.ipl_wickets) || 0,
      bowlingAverage: parseFloat(row.ipl_bowling_average) || 0,
      economy: iplBowlBalls > 0 ? Math.round((iplRunsConceded / (iplBowlBalls / 6)) * 100) / 100 : 0,
      bestBowlingWickets: iplBestWkts,
      bestBowlingRuns: iplBestRuns,
      bestBowlingFigures: iplBestWkts > 0 ? `${iplBestWkts}/${iplBestRuns}` : "-",
      fourWickets: parseInt(row.ipl_four_wicket_hauls) || 0,
      fiveWickets: parseInt(row.ipl_five_wicket_hauls) || 0,
      catches: parseInt(row.ipl_catches) || 0,
      stumpings: parseInt(row.ipl_stumpings) || 0,
      runOuts: parseInt(row.ipl_run_outs) || 0,
      battingBalls: parseInt(row.ipl_balls_faced) || 0,
      battingDismissals: (parseInt(row.ipl_batting_innings) || 0) - (parseInt(row.ipl_not_outs) || 0),
      bowlingRunsConceded: iplRunsConceded,
    };

    const batting = {
      matches: t20Games,
      innings: t20BatInns,
      runs: t20Runs,
      average: parseFloat(row.t20_batting_average) || 0.0,
      strikeRate: parseFloat(row.t20_strike_rate) || 0.0,
      fifties: Math.floor(t20Runs / 360),
      hundreds: Math.floor(t20Runs / 1300),
    };

    const bowling = {
      matches: t20BowlInns,
      wickets: t20Wickets,
      economy: t20BowlInns > 0 && parseFloat(row.t20_bowling_average) > 0 
        ? Math.round((8.8 - (curBowl / 100) * 2.5) * 100) / 100 
        : 0.0,
      average: parseFloat(row.t20_bowling_average) || 0.0,
      bestFigures: `${Math.min(6, Math.floor(2 + (curBowl / 100) * 4))}/${15 + Math.floor((100 - curBowl) / 10) * 2}`,
    };

      return enforceBattingPositionEligibility({
        id,
        name,
        age,
        nationality: nat as Nationality,
        country: row.nationality || (nat === "Indian" ? "India" : "Overseas"),
        role,
        battingStyle: batHand as any,
        bowlingStyle: bowlStyle(bowlType),
        bowlingHand: bowlHand,
        basePrice: base,
        isCapped,
        isRetained: false,
        retainedByTeamId: null,
        currentTeamId: teamId,
        potential: genPotential(curBat, potBat, curBowl, potBowl, age),
        currentBatting: curBat,
        potentialBatting: potBat,
        currentBowling: curBowl,
        potentialBowling: potBowl,
        careerStats: {
          batting,
          bowling,
        },
        iplStats,
        iplHistory,
        openingContractPrice,
        openingContractSeason: 2027,
        reputation,
        captaincy,
        isIplCaptaincyUnavailable,
        setForRelease,
        battingAggression,
        isWicketkeeper,
        isPartTimeWk,
        isOpener,
        isFinisher,
        isCoreBatter,
        onlyOpensOrBenched,
        hasBattedAt3,
        hasBattedAt4,
        hasBattedAt5,
        hasBattedAt6,
        hasBattedAt7,
        powerplayBatting: row.powerplay_batting != null ? parseInt(row.powerplay_batting) : undefined,
        middleOversBatting: row.middle_overs_batting != null ? parseInt(row.middle_overs_batting) : undefined,
        deathBatting: row.death_batting != null ? parseInt(row.death_batting) : undefined,
        powerplayBowling: row.powerplay_bowling != null ? parseInt(row.powerplay_bowling) : undefined,
        middleOversBowling: row.middle_overs_bowling != null ? parseInt(row.middle_overs_bowling) : undefined,
        deathBowling: row.death_bowling != null ? parseInt(row.death_bowling) : undefined,
        stamina: row.stamina != null ? parseInt(row.stamina) : undefined,
        consistency: row.consistency != null ? parseInt(row.consistency) : undefined,
        battingConsistency: row.stamina != null ? parseInt(row.stamina) : undefined,
        bowlingConsistency: row.consistency != null ? parseInt(row.consistency) : undefined,
        bigMatchRating: row.big_match_rating != null ? parseInt(row.big_match_rating) : undefined,
        pressureRating: row.pressure_rating != null ? parseInt(row.pressure_rating) : undefined,
        aggression: battingAggression,
        fieldingRating: readOptionalRating(row.fielding_rating),
        wicketkeepingRating: readOptionalRating(row.wicketkeeping_rating),
        injuryProneness: readOptionalRating(row.injury_proneness),
        paceRating: readOptionalRating(row.pace_rating),
        spinRating: readOptionalRating(row.spin_rating),
      });
    });
}
let serverCachedPlayers: Player[] | null = null;
let clientCachedPlayers: Player[] | null = null;

export async function fetchPlayersFromSupabase(forceRefresh = false): Promise<Player[]> {
  try {
    if (typeof window !== "undefined") {
      if (clientCachedPlayers && !forceRefresh) {
        return clientCachedPlayers;
      }
      try {
        const controller = new AbortController();
        // The player payload is large enough that a cold API route can easily
        // take longer than one second. Aborting here used to create a valid-
        // looking new save with zero players and therefore an empty opening
        // retention screen.
        const timeoutId = setTimeout(() => controller.abort(), 12_000);
        const res = await fetch("/api/players", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            clientCachedPlayers = data;
            return data;
          }
        }
      } catch (e) {
        // Silent fallback
      }
      return clientCachedPlayers ?? [];
    }

    if (serverCachedPlayers && !forceRefresh) {
      return serverCachedPlayers;
    }

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data) throw error || new Error("No data returned from Supabase");
    serverCachedPlayers = mapRowsToPlayers(data);
    return serverCachedPlayers;
  } catch (err) {
    return serverCachedPlayers ?? [];
  }
}
