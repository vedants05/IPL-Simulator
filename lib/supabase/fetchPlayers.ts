import { supabase } from "./client";
import { Player, Nationality, Role, Potential } from "../types";

const TEAM_MAP: Record<string, string> = {
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

const ROLE_MAP: Record<string, string> = {
  "Batter": "Batsman",
  "Bowler (Pace)": "Pace Bowler",
  "Bowler (Spinner)": "Spin Bowler",
  "All-Rounder": "All-Rounder",
  "Wicketkeeper-Batter": "WK-Batsman",
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function salaryToStar(salary: number): number {
  if (salary >= 16) return 5.0;
  if (salary >= 11) return 4.5;
  if (salary >= 7)  return 4.0;
  if (salary >= 4)  return 3.5;
  if (salary >= 2)  return 3.0;
  if (salary >= 1)  return 2.5;
  if (salary >= 0.5) return 2.0;
  return 1.5;
}

function calculateBasePrice(isCapped: boolean, star: number): number {
  if (isCapped) {
    if (star >= 5.0) return 200;
    if (star >= 4.5) return 150;
    if (star >= 4.0) return 100;
    if (star >= 3.5) return 75;
    return 50;
  } else {
    if (star >= 3.5) return 50;
    if (star >= 2.5) return 40;
    return 30;
  }
}

function bowlStyle(bowlType: string | null, bowlHand: string | null): string | null {
  if (!bowlType || bowlType === "NA") return null;
  const hand = (bowlHand || "").toLowerCase();
  const isLeft = hand.includes("left");
  if (bowlType === "Spinner") return isLeft ? "Left-arm Orthodox" : "Right-arm Off-spin";
  if (bowlType === "Pacer")   return isLeft ? "Left-arm Fast" : "Right-arm Fast";
  return null;
}

function toAttr(score: number, fallback = 7): number {
  if (score <= 0) return fallback;
  return Math.max(1, Math.min(20, Math.round(score / 5)));
}

function genAttrs(bat: number, bowl: number, bowlType: string | null) {
  const bv = toAttr(bat);
  const wv = toAttr(bowl);
  const isPacer   = bowlType === "Pacer";
  const isSpinner = bowlType === "Spinner";
  const hasBat  = bat > 0;
  const hasBowl = bowl > 0;
  return {
    technique:   hasBat ? bv : 7,
    power:       hasBat ? Math.min(20, bv + 1) : 7,
    timing:      hasBat ? bv : 7,
    placement:   hasBat ? Math.max(1, bv - 1) : 7,
    running:     11,
    pace:        isPacer && hasBowl ? wv : 7,
    swing:       isPacer && hasBowl ? Math.max(1, wv - 2) : 7,
    seam:        isPacer && hasBowl ? Math.max(1, wv - 1) : 7,
    spin:        isSpinner && hasBowl ? wv : 7,
    flight:      isSpinner && hasBowl ? Math.max(1, wv - 1) : 7,
    accuracy:    hasBowl ? Math.max(1, wv - 1) : 8,
    variation:   hasBowl ? Math.max(1, wv - 2) : 7,
    catching:    13,
    throwing:    12,
    agility:     13,
    composure:   12,
    leadership:  10,
    determination: 13,
  };
}

function genPotential(curBat: number, potBat: number, curBowl: number, potBowl: number, age: number): Potential {
  const maxCur = Math.max(curBat, curBowl);
  const maxPot = Math.max(potBat, potBowl);
  const gap    = maxPot - maxCur;
  if (maxCur >= 88)           return "World Class";
  if (gap >= 15 && age <= 22) return "Wonderkid";
  if (gap >= 8)               return "Promising";
  return "Established";
}

export async function fetchPlayersFromSupabase(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch players from Supabase: ${error.message}`);
  }

  const seenIds = new Set<string>();

  return data.map((row: any) => {
    const rawTeam = row.team || "";
    const teamId = TEAM_MAP[rawTeam] || null;
    const name = row.name;
    const age = parseInt(row.age) || 0;
    const salary = parseFloat(row.ipl_2026_salary) || 0;
    const nat = row.overseas_status === "Overseas" ? "Overseas" : "Indian";
    const isCapped = row.status === "Capped";
    const role = (ROLE_MAP[row.primary_role] ?? "Batsman") as Role;
    const bowlType = row.bowling_type || "NA";
    const bowlHand = row.bowling_hand || "";
    const batHand = (row.batting_hand || "").includes("LHB") || (row.batting_hand || "").toLowerCase().includes("left") ? "Left-hand" : "Right-hand";
    
    const curBat = parseInt(row.current_batting) || 0;
    const potBat = parseInt(row.potential_batting) || 0;
    const curBowl = parseInt(row.current_bowling) || 0;
    const potBowl = parseInt(row.potential_bowling) || 0;
    
    const reputation = parseInt(row.reputation) || 5;
    const isWicketkeeper = row.can_keep_wickets === true;
    const isPartTimeWk = row.part_time_wicketkeeper === true;
    const isOpener = row.opener === true;
    const isFinisher = row.finisher === true;
    const isCoreBatter = row.core_batter === true;
    const onlyOpensOrBenched = row.only_opener === true;
    const captaincy = parseInt(row.captaincy) || 50;
    const battingAggression = parseInt(row.batting_aggression) || 50;
    
    const hasBattedAt3 = row.has_batted_at_3 === true;
    const hasBattedAt4 = row.has_batted_at_4 === true;
    const hasBattedAt5 = row.has_batted_at_5 === true;
    const hasBattedAt6 = row.has_batted_at_6 === true;
    const hasBattedAt7 = row.has_batted_at_7 === true;

    const star = salaryToStar(salary);
    const base = calculateBasePrice(isCapped, star);

    let id = toSlug(name);
    if (seenIds.has(id)) {
      id = `${id}-${(teamId || "unsold").toLowerCase()}`;
    }
    seenIds.add(id);

    // Parse History from columns team_YYYY and salary_YYYY
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
      matches: t20BowlInns > 0 ? t20BowlInns : t20Games,
      wickets: t20Wickets,
      economy: t20BowlInns > 0 && parseFloat(row.t20_bowling_average) > 0 
        ? Math.round((8.8 - (curBowl / 100) * 2.5) * 100) / 100 
        : 0.0,
      average: parseFloat(row.t20_bowling_average) || 0.0,
      bestFigures: `${Math.min(6, Math.floor(2 + (curBowl / 100) * 4))}/${15 + Math.floor((100 - curBowl) / 10) * 2}`,
    };

    return {
      id,
      name,
      age,
      nationality: nat as Nationality,
      role,
      battingStyle: batHand as any,
      bowlingStyle: bowlStyle(bowlType, bowlHand),
      starRating: star,
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
      attributes: genAttrs(curBat, curBowl, bowlType),
      careerStats: {
        batting,
        bowling,
      },
      iplHistory,
      reputation,
      captaincy,
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
    };
  });
}
