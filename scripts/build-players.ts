#!/usr/bin/env tsx
/**
 * Reads IPLMainGameDatabase.csv → writes lib/data/players.ts → seeds Supabase
 * Run: npx tsx scripts/build-players.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "IPLMainGameDatabase.csv");
const OUT_PATH = path.join(ROOT, "lib", "data", "players.ts");

// ---- Supabase ----
const supabase = createClient(
  "https://qnmmplezmitcllovbyur.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFubW1wbGV6bWl0Y2xsb3ZieXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzIxMDQsImV4cCI6MjA5ODQwODEwNH0.w6OHOuz8O92tYXmvTuOmO1SnBuuqx_VzixN_jW5KTsA",
  {
    realtime: {
      transport: WebSocket as any
    }
  }
);

// ---- Maps ----
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

// ---- Helpers ----
function toSlug(name: string): string {
  return name.toLowerCase().replace(/[.\s]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
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

function starToBase(star: number): number {
  if (star >= 5.0) return 200;
  if (star >= 4.5) return 150;
  if (star >= 4.0) return 100;
  if (star >= 3.5) return 75;
  if (star >= 3.0) return 50;
  if (star >= 2.5) return 30;
  return 20;
}

function bowlStyle(bowlType: string, bowlHand: string): string | null {
  if (!bowlType || bowlType === "NA") return null;
  const hand = bowlHand.toLowerCase();
  const isLeft = hand.includes("left");
  if (bowlType === "Spinner") return isLeft ? "Left-arm Orthodox" : "Right-arm Off-spin";
  if (bowlType === "Pacer")   return isLeft ? "Left-arm Fast" : "Right-arm Fast";
  return null;
}

function toAttr(score: number, fallback = 7): number {
  if (score <= 0) return fallback;
  return Math.max(1, Math.min(20, Math.round(score / 5)));
}

function genAttrs(bat: number, bowl: number, bowlType: string) {
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

function genPotential(curBat: number, potBat: number, curBowl: number, potBowl: number, age: number): string {
  const maxCur = Math.max(curBat, curBowl);
  const maxPot = Math.max(potBat, potBowl);
  const gap    = maxPot - maxCur;
  if (maxCur >= 88)           return "World Class";
  if (gap >= 15 && age <= 22) return "Wonderkid";
  if (gap >= 8)               return "Promising";
  return "Established";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      result.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseHistoryValue(season: string, val: string): { teamId: string; season: string; price: number } | null {
  val = val.trim();
  if (!val || val === "--" || val === "" || val.toLowerCase().startsWith("unsold")) return null;
  
  const teamMatch = val.match(/^([A-Z]+)/i);
  if (!teamMatch) return null;
  const teamId = teamMatch[1].toUpperCase();
  
  const priceMatch = val.match(/\(([\d.]+)\s*(Cr|L)\)/i);
  let price = 20; 
  if (priceMatch) {
    const num = parseFloat(priceMatch[1]);
    const unit = priceMatch[2].toLowerCase();
    price = unit === "cr" ? Math.round(num * 100) : Math.round(num);
  }
  return { teamId, season, price };
}

// ---- Main Seeding Execution ----
async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: Could not find CSV file at ${CSV_PATH}`);
    process.exit(1);
  }

  const rawLines = fs.readFileSync(CSV_PATH, "utf-8")
    .replace(/\r/g, "")
    .split("\n")
    .filter(l => l.trim());

  const headers = parseCSVLine(rawLines[0]);

  // Dynamically map headers to column indices
  const idxTeam = headers.indexOf("Team");
  const idxName = headers.indexOf("Player Name");
  const idxAge = headers.indexOf("Age");
  const idxNationality = headers.indexOf("Nationality");
  const idxRole = headers.indexOf("Primary Role");
  const idxSalary = headers.indexOf("IPL 2026 Salary (Cr)");
  const idxOverseas = headers.indexOf("Overseas Status");
  const idxStatus = headers.indexOf("Status");
  const idxBowlType = headers.indexOf("Bowling Type (Spinner/Pacer/NA)");
  const idxBowlHand = headers.indexOf("Bowling Hand");
  const idxBatHand = headers.findIndex(h => h.includes("Batting Hand"));
  const idxCurBat = headers.indexOf("Current Batting");
  const idxPotBat = headers.indexOf("Potential Batting");
  const idxCurBowl = headers.indexOf("Current Bowling");
  const idxPotBowl = headers.indexOf("Potential Bowling");
  const idxReputation = headers.indexOf("Reputation");
  const idxAggression = headers.indexOf("Batting Aggression (1-99)");
  const idxKeep = headers.indexOf("Can they keep wickets?");
  const idxPartKeep = headers.indexOf("Are they a part time wicketkeeper?");
  const idxOpener = headers.indexOf("Opener?");
  const idxFinisher = headers.indexOf("Finisher?");
  const idxCore = headers.indexOf("Core Batter");
  const idxOnlyOpener = headers.indexOf("Only Opener");
  const idxCaptaincy = headers.indexOf("Captaincy");
  const idxBatted3 = headers.indexOf("hasBattedAt3");
  const idxBatted4 = headers.indexOf("hasBattedAt4");
  const idxBatted5 = headers.indexOf("hasBattedAt5");
  const idxBatted6 = headers.indexOf("hasBattedAt6");
  const idxBatted7 = headers.indexOf("hasBattedAt7");

  // T20 Stats
  const idxT20Games = headers.indexOf("T20 Games");
  const idxT20BatInns = headers.indexOf("T20 Batting Innings");
  const idxT20BatAvg = headers.indexOf("T20 batting average");
  const idxT20Runs = headers.indexOf("T20 runs");
  const idxT20SR = headers.indexOf("T20 strike rate");
  const idxT20BowlInns = headers.indexOf("T20 bowling innings");
  const idxT20BowlAvg = headers.indexOf("T20 bowling average");
  const idxT20Wickets = headers.indexOf("T20 wickets");
  const idxT20WKCatches = headers.indexOf("T20 WK Catches");
  const idxT20WKStumpings = headers.indexOf("T20 WK Stumpings");

  // IPL Stats
  const idxIPLGames = headers.indexOf("IPL games");
  const idxIPLRuns = headers.indexOf("IPL runs");
  const idxIPLAvg = headers.indexOf("IPL average");
  const idxIPLSR = headers.indexOf("IPL strike rate");
  const idxIPLBowlInns = headers.indexOf("IPL bowling innings");
  const idxIPLBowlAvg = headers.indexOf("IPL bowling average");
  const idxIPLWickets = headers.indexOf("IPL wickets");

  const dataLines = rawLines.slice(1);
  const seenIds = new Set<string>();

  const players = dataLines.map(line => {
    const cols = parseCSVLine(line);
    const rawTeam = cols[idxTeam] || "";
    const teamId = TEAM_MAP[rawTeam] || null;
    const name = cols[idxName];
    const age = parseInt(cols[idxAge]) || 0;
    const salary = parseFloat(cols[idxSalary]) || 0;
    const nat = cols[idxOverseas] === "Overseas" ? "Overseas" : "Indian";
    const isCapped = cols[idxStatus] === "Capped";
    const role = ROLE_MAP[cols[idxRole]] ?? "Batsman";
    const bowlType = cols[idxBowlType] || "NA";
    const bowlHand = cols[idxBowlHand] || "";
    const batHand = (cols[idxBatHand] || "").includes("LHB") || (cols[idxBatHand] || "").toLowerCase().includes("left") ? "Left-hand" : "Right-hand";
    const curBat = parseInt(cols[idxCurBat]) || 0;
    const potBat = parseInt(cols[idxPotBat]) || 0;
    const curBowl = parseInt(cols[idxCurBowl]) || 0;
    const potBowl = parseInt(cols[idxPotBowl]) || 0;
    const reputation = parseInt(cols[idxReputation]) || 5;
    const isWicketkeeper = cols[idxKeep]?.toLowerCase() === "yes";
    const isPartTimeWk = cols[idxPartKeep]?.toLowerCase() === "yes";
    const isOpener = cols[idxOpener]?.toLowerCase() === "yes";
    const isFinisher = cols[idxFinisher]?.toLowerCase() === "yes";
    const isCoreBatter = cols[idxCore]?.toLowerCase() === "yes";
    const onlyOpensOrBenched = cols[idxOnlyOpener]?.toLowerCase() === "yes";
    const captaincy = parseInt(cols[idxCaptaincy]) || 50;
    const battingAggression = parseInt(cols[idxAggression]) || 50;
    const hasBattedAt3 = cols[idxBatted3]?.toUpperCase() === "TRUE";
    const hasBattedAt4 = cols[idxBatted4]?.toUpperCase() === "TRUE";
    const hasBattedAt5 = cols[idxBatted5]?.toUpperCase() === "TRUE";
    const hasBattedAt6 = cols[idxBatted6]?.toUpperCase() === "TRUE";
    const hasBattedAt7 = cols[idxBatted7]?.toUpperCase() === "TRUE";

    const star = salaryToStar(salary);
    const base = starToBase(star);

    let id = toSlug(name);
    if (seenIds.has(id)) {
      id = `${id}-${(teamId || "unsold").toLowerCase()}`;
    }
    seenIds.add(id);

    // Parse History from columns
    const baseHistory: { teamId: string; season: string; price: number }[] = [];
    const seasons = [
      "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008"
    ];
    for (const season of seasons) {
      const colIdx = headers.indexOf(`${season} Team (Salary)`);
      if (colIdx !== -1 && cols[colIdx]) {
        const hist = parseHistoryValue(season, cols[colIdx]);
        if (hist) baseHistory.push(hist);
      }
    }

    // Fill missing history entries from 2019 to 2026
    const iplHistory: { teamId: string; season: string; price: number }[] = [];
    const startYear = 2019;
    const fallbackTeam = teamId || "UNSOLD";
    const fallbackPrice = Math.round(salary * 100) || 20;

    for (let y = startYear; y <= 2026; y++) {
      const yearStr = String(y);
      const existing = baseHistory.find(h => h.season === yearStr);
      if (existing) {
        iplHistory.push(existing);
      } else {
        if (baseHistory.length > 0) {
          let closest = baseHistory[0];
          let minDiff = Math.abs(parseInt(closest.season) - y);
          for (const h of baseHistory) {
            const diff = Math.abs(parseInt(h.season) - y);
            if (diff < minDiff) {
              minDiff = diff;
              closest = h;
            }
          }
          iplHistory.push({ teamId: closest.teamId, season: yearStr, price: closest.price });
        } else {
          iplHistory.push({ teamId: fallbackTeam, season: yearStr, price: fallbackPrice });
        }
      }
    }

    // Parse Career Stats directly from spreadsheet row
    const t20Games = parseInt(cols[idxT20Games]) || 0;
    const t20BatInns = parseInt(cols[idxT20BatInns]) || 0;
    const t20Runs = parseInt(cols[idxT20Runs]) || 0;
    const t20Wickets = parseInt(cols[idxT20Wickets]) || 0;
    const t20BowlInns = parseInt(cols[idxT20BowlInns]) || 0;

    const batting = {
      matches: t20Games,
      innings: t20BatInns,
      runs: t20Runs,
      average: parseFloat(cols[idxT20BatAvg]) || 0.0,
      strikeRate: parseFloat(cols[idxT20SR]) || 0.0,
      fifties: Math.floor(t20Runs / 360),
      hundreds: Math.floor(t20Runs / 1300),
    };

    const bowling = {
      matches: t20BowlInns > 0 ? t20BowlInns : t20Games,
      wickets: t20Wickets,
      economy: Math.round((8.8 - (curBowl / 100) * 2.5) * 100) / 100,
      average: parseFloat(cols[idxT20BowlAvg]) || 0.0,
      bestFigures: `${Math.min(6, Math.floor(2 + (curBowl / 100) * 4))}/${15 + Math.floor((100 - curBowl) / 10) * 2}`,
    };

    return {
      id, name, age,
      nationality: nat,
      role,
      battingStyle: batHand,
      bowlingStyle: bowlStyle(bowlType, bowlHand),
      starRating: star,
      basePrice: base,
      isCapped,
      isRetained: false,
      retainedByTeamId: null,
      currentTeamId: teamId,
      potential: genPotential(curBat, potBat, curBowl, potBowl, age),
      attributes: genAttrs(curBat, curBowl, bowlType),
      careerStats: {
        batting,
        bowling,
      },
      iplHistory,
      currentBatting: curBat,
      potentialBatting: potBat,
      currentBowling: curBowl,
      potentialBowling: potBowl,
      reputation,
      isWicketkeeper,
      isPartTimeWk,
      isOpener,
      isFinisher,
      isCoreBatter,
      onlyOpensOrBenched,
      captaincy,
      battingAggression,
      hasBattedAt3,
      hasBattedAt4,
      hasBattedAt5,
      hasBattedAt6,
      hasBattedAt7
    };
  });

  console.log(`Parsed ${players.length} players`);

  // ---- Write players.ts ----
  function q(v: unknown): string {
    if (v === null) return "null";
    if (typeof v === "string") return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    return String(v);
  }

  const outputLines: string[] = [
    `import type { Player } from "@/lib/types";`,
    ``,
    `export const PLAYERS: Player[] = [`,
  ];

  for (const p of players) {
    const a = p.attributes;
    const bs = p.careerStats.batting;
    const bw = p.careerStats.bowling;
    const histStr = p.iplHistory.map(h => `{ teamId: ${q(h.teamId)}, season: ${q(h.season)}, price: ${h.price} }`).join(", ");
    outputLines.push(
      `  { id: ${q(p.id)}, name: ${q(p.name)}, age: ${p.age}, nationality: ${q(p.nationality)}, role: ${q(p.role)}, battingStyle: ${q(p.battingStyle)}, bowlingStyle: ${q(p.bowlingStyle)}, starRating: ${p.starRating}, basePrice: ${p.basePrice}, isCapped: ${p.isCapped}, isRetained: false, retainedByTeamId: null, currentTeamId: ${q(p.currentTeamId)}, potential: ${q(p.potential)}, currentBatting: ${p.currentBatting}, potentialBatting: ${p.potentialBatting}, currentBowling: ${p.currentBowling}, potentialBowling: ${p.potentialBowling}, reputation: ${p.name === "Sunil Narine" ? 10 : p.reputation}, captaincy: ${p.captaincy}, battingAggression: ${p.battingAggression}, isWicketkeeper: ${p.isWicketkeeper}, isPartTimeWk: ${p.isPartTimeWk}, isOpener: ${p.isOpener}, isFinisher: ${p.isFinisher}, isCoreBatter: ${(p as any).isCoreBatter}, onlyOpensOrBenched: ${(p as any).onlyOpensOrBenched}, hasBattedAt3: ${p.hasBattedAt3}, hasBattedAt4: ${p.hasBattedAt4}, hasBattedAt5: ${p.hasBattedAt5}, hasBattedAt6: ${p.hasBattedAt6}, hasBattedAt7: ${p.hasBattedAt7}, attributes: { technique: ${a.technique}, power: ${a.power}, timing: ${a.timing}, placement: ${a.placement}, running: ${a.running}, pace: ${a.pace}, swing: ${a.swing}, seam: ${a.seam}, spin: ${a.spin}, flight: ${a.flight}, accuracy: ${a.accuracy}, variation: ${a.variation}, catching: ${a.catching}, throwing: ${a.throwing}, agility: ${a.agility}, composure: ${a.composure}, leadership: ${a.leadership}, determination: ${a.determination} }, careerStats: { batting: { matches: ${bs.matches}, innings: ${bs.innings}, runs: ${bs.runs}, average: ${bs.average}, strikeRate: ${bs.strikeRate}, fifties: ${bs.fifties}, hundreds: ${bs.hundreds} }, bowling: { matches: ${bw.matches}, wickets: ${bw.wickets}, economy: ${bw.economy}, average: ${bw.average}, bestFigures: ${q(bw.bestFigures)} } }, iplHistory: [${histStr}] },`
    );
  }

  outputLines.push(`];`);
  outputLines.push(``);
  outputLines.push(`export const PLAYERS_SEED: Player[] = PLAYERS;`);
  outputLines.push(`export const PLAYERS_MAP: Record<string, Player> = Object.fromEntries(PLAYERS.map(p => [p.id, p]));`);

  fs.writeFileSync(OUT_PATH, outputLines.join("\n"), "utf-8");
  console.log(`✓ Written lib/data/players.ts`);

  // ---- Seed Supabase ----
  try {
    console.log("Clearing existing Supabase data...");
    await supabase.from("ipl_history").delete().neq("id", 0);
    await supabase.from("players").delete().neq("id", "");

    const playerRows = players.map(p => ({
      id: p.id,
      name: p.name,
      age: p.age,
      nationality: p.nationality,
      role: p.role,
      batting_style: p.battingStyle,
      bowling_style: p.bowlingStyle,
      star_rating: p.starRating,
      base_price: p.basePrice,
      is_capped: p.isCapped,
      current_team_id: p.currentTeamId,
      potential: p.potential,
      has_batted_at_3: p.hasBattedAt3 === true,
      has_batted_at_4: p.hasBattedAt4 === true,
      has_batted_at_5: p.hasBattedAt5 === true,
      has_batted_at_6: p.hasBattedAt6 === true,
      has_batted_at_7: p.hasBattedAt7 === true,
      is_opener: p.isOpener === true,
      attr_technique:    p.attributes.technique,
      attr_power:        p.attributes.power,
      attr_timing:       p.attributes.timing,
      attr_placement:    p.attributes.placement,
      attr_running:      p.attributes.running,
      attr_pace:         p.attributes.pace,
      attr_swing:        p.attributes.swing,
      attr_seam:         p.attributes.seam,
      attr_spin:         p.attributes.spin,
      attr_flight:       p.attributes.flight,
      attr_accuracy:     p.attributes.accuracy,
      attr_variation:    p.attributes.variation,
      attr_catching:     p.attributes.catching,
      attr_throwing:     p.attributes.throwing,
      attr_agility:      p.attributes.agility,
      attr_composure:    p.attributes.composure,
      attr_leadership:   p.attributes.leadership,
      attr_determination: p.attributes.determination,
      bat_matches:     p.careerStats.batting.matches,
      bat_innings:     p.careerStats.batting.innings,
      bat_runs:        p.careerStats.batting.runs,
      bat_average:     p.careerStats.batting.average,
      bat_strike_rate: p.careerStats.batting.strikeRate,
      bat_fifties:     p.careerStats.batting.fifties,
      bat_hundreds:    p.careerStats.batting.hundreds,
      bowl_matches:    p.careerStats.bowling.matches,
      bowl_wickets:    p.careerStats.bowling.wickets,
      bowl_economy:    p.careerStats.bowling.economy,
      bowl_average:    p.careerStats.bowling.average,
      bowl_best_figures: p.careerStats.bowling.bestFigures,
    }));

    for (let i = 0; i < playerRows.length; i += 50) {
      const batch = playerRows.slice(i, i + 50);
      const { error } = await supabase.from("players").insert(batch);
      if (error) {
        console.warn(`Warning seeding players at batch ${i}: ${error.message} (Will continue locally regardless)`);
      } else {
        console.log(`  Players ${i + 1}–${i + batch.length} inserted`);
      }
    }

    const histRows = players.flatMap(p =>
      p.iplHistory.map(h => ({
        player_id: p.id,
        team_id: h.teamId,
        season: h.season,
        price: h.price,
      }))
    );

    for (let i = 0; i < histRows.length; i += 100) {
      const batch = histRows.slice(i, i + 100);
      const { error } = await supabase.from("ipl_history").insert(batch);
      if (error) {
        console.warn(`Warning inserting history at ${i}: ${error.message}`);
      }
    }

    console.log(`✓ Supabase sync attempt completed`);
  } catch (supabaseError: any) {
    console.warn("Supabase database sync failed, but local data generation succeeded:", supabaseError.message);
  }
}

main().catch(console.error);
