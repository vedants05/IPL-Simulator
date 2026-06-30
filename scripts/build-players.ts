#!/usr/bin/env tsx
/**
 * Reads database.csv → writes lib/data/players.ts → seeds Supabase
 * Run: npx tsx scripts/build-players.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "database.csv");
const OUT_PATH = path.join(ROOT, "lib", "data", "players.ts");

// ---- Supabase ----
const supabase = createClient(
  "https://qnmmplezmitcllovbyur.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFubW1wbGV6bWl0Y2xsb3ZieXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzIxMDQsImV4cCI6MjA5ODQwODEwNH0.w6OHOuz8O92tYXmvTuOmO1SnBuuqx_VzixN_jW5KTsA"
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

function genBatStats(bat: number, age: number, isCapped: boolean) {
  if (bat <= 0) return { matches: 0, innings: 0, runs: 0, average: 0, strikeRate: 0, fifties: 0, hundreds: 0 };
  const m   = isCapped ? Math.max(25, (age - 18) * 6) : Math.max(8, (age - 18) * 2);
  const avg = 12 + (bat / 100) * 32;
  const sr  = 108 + (bat / 100) * 57;
  const inn = Math.round(m * 0.87);
  const runs = Math.round(inn * avg);
  return {
    matches: m, innings: inn, runs,
    average: Math.round(avg * 10) / 10,
    strikeRate: Math.round(sr * 10) / 10,
    fifties: Math.floor(runs / 360),
    hundreds: Math.floor(runs / 1300),
  };
}

function genBowlStats(bowl: number, age: number, isCapped: boolean) {
  if (bowl <= 0) return { matches: 0, wickets: 0, economy: 0, average: 0, bestFigures: "0/0" };
  const m      = isCapped ? Math.max(20, (age - 18) * 5) : Math.max(5, (age - 18) * 2);
  const wpm    = 0.6 + (bowl / 100) * 1.8;
  const wickets = Math.round(m * wpm);
  const econ   = 8.8 - (bowl / 100) * 2.5;
  const avg    = 36  - (bowl / 100) * 17;
  const bw     = Math.min(6, Math.floor(2 + (bowl / 100) * 4));
  const br     = 15 + Math.floor((100 - bowl) / 10) * 2;
  return {
    matches: m, wickets,
    economy: Math.round(econ * 100) / 100,
    average: Math.round(avg * 100) / 100,
    bestFigures: `${bw}/${br}`,
  };
}

// ---- CSV Parsing ----
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

const rawLines = fs.readFileSync(CSV_PATH, "utf-8")
  .replace(/\r/g, "")
  .split("\n")
  .filter(l => l.trim());

const dataLines = rawLines.slice(1); // skip header

// ---- Build players ----
const seenIds = new Set<string>();

const players = dataLines
  .map(line => parseCSVLine(line))
  .filter(cols => cols[0] && cols[1] && TEAM_MAP[cols[0]])
  .map(cols => {
    const teamId  = TEAM_MAP[cols[0]];
    const name    = cols[1];
    const age     = parseInt(cols[3]) || 0;
    const salary  = parseFloat(cols[4]) || 0;
    const nat     = cols[5] === "Indian" ? "Indian" : "Overseas";
    const isCapped = cols[6] === "Capped";
    const role    = ROLE_MAP[cols[7]] ?? "Batsman";
    const bowlType = cols[8] || "NA";
    const bowlHand = cols[9] || "";
    const batHand  = cols[10] === "LHB" ? "Left-hand" : "Right-hand";
    const curBat   = parseInt(cols[11]) || 0;
    const potBat   = parseInt(cols[12]) || 0;
    const curBowl  = parseInt(cols[13]) || 0;
    const potBowl  = parseInt(cols[14]) || 0;

    const star = salaryToStar(salary);
    const base = starToBase(star);

    // unique ID — if clash, suffix with team
    let id = toSlug(name);
    if (seenIds.has(id)) id = `${id}-${teamId.toLowerCase()}`;
    seenIds.add(id);

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
        batting: genBatStats(curBat, age, isCapped),
        bowling: genBowlStats(curBowl, age, isCapped),
      },
      iplHistory: [{ teamId, season: "2025", price: Math.round(salary * 100) }],
      currentBatting: curBat,
      potentialBatting: potBat,
      currentBowling: curBowl,
      potentialBowling: potBowl,
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

const lines: string[] = [
  `import type { Player } from "@/lib/types";`,
  ``,
  `export const PLAYERS_SEED: Player[] = [`,
];

for (const p of players) {
  const a = p.attributes;
  const bs = p.careerStats.batting;
  const bw = p.careerStats.bowling;
  const h  = p.iplHistory[0];
  lines.push(
    `  { id: ${q(p.id)}, name: ${q(p.name)}, age: ${p.age}, nationality: ${q(p.nationality)}, role: ${q(p.role)}, battingStyle: ${q(p.battingStyle)}, bowlingStyle: ${q(p.bowlingStyle)}, starRating: ${p.starRating}, basePrice: ${p.basePrice}, isCapped: ${p.isCapped}, isRetained: false, retainedByTeamId: null, currentTeamId: ${q(p.currentTeamId)}, potential: ${q(p.potential)}, currentBatting: ${p.currentBatting}, potentialBatting: ${p.potentialBatting}, currentBowling: ${p.currentBowling}, potentialBowling: ${p.potentialBowling}, attributes: { technique: ${a.technique}, power: ${a.power}, timing: ${a.timing}, placement: ${a.placement}, running: ${a.running}, pace: ${a.pace}, swing: ${a.swing}, seam: ${a.seam}, spin: ${a.spin}, flight: ${a.flight}, accuracy: ${a.accuracy}, variation: ${a.variation}, catching: ${a.catching}, throwing: ${a.throwing}, agility: ${a.agility}, composure: ${a.composure}, leadership: ${a.leadership}, determination: ${a.determination} }, careerStats: { batting: { matches: ${bs.matches}, innings: ${bs.innings}, runs: ${bs.runs}, average: ${bs.average}, strikeRate: ${bs.strikeRate}, fifties: ${bs.fifties}, hundreds: ${bs.hundreds} }, bowling: { matches: ${bw.matches}, wickets: ${bw.wickets}, economy: ${bw.economy}, average: ${bw.average}, bestFigures: ${q(bw.bestFigures)} } }, iplHistory: [{ teamId: ${q(h.teamId)}, season: ${q(h.season)}, price: ${h.price} }] },`
  );
}

lines.push(`];`);
lines.push(``);
lines.push(`export const PLAYERS_MAP: Record<string, Player> = Object.fromEntries(PLAYERS_SEED.map(p => [p.id, p]));`);

fs.writeFileSync(OUT_PATH, lines.join("\n"), "utf-8");
console.log(`✓ Written lib/data/players.ts`);

// ---- Seed Supabase ----
async function seedSupabase() {
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
      console.error(`Error at batch ${i}:`, error.message);
      process.exit(1);
    }
    console.log(`  Players ${i + 1}–${i + batch.length} inserted`);
  }

  const histRows = players.map(p => ({
    player_id: p.id,
    team_id: p.iplHistory[0].teamId,
    season: p.iplHistory[0].season,
    price: p.iplHistory[0].price,
  }));

  for (let i = 0; i < histRows.length; i += 100) {
    const batch = histRows.slice(i, i + 100);
    const { error } = await supabase.from("ipl_history").insert(batch);
    if (error) {
      console.error(`Error inserting history at ${i}:`, error.message);
      process.exit(1);
    }
  }

  console.log(`✓ Supabase seeded: ${players.length} players, ${histRows.length} history rows`);
}

seedSupabase().catch(console.error);
