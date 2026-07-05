import * as fs from "fs";
import * as path from "path";
import { PLAYERS } from "../lib/data/players";

const CSV_PATH = path.join(process.cwd(), "database.csv");
const rawContent = fs.readFileSync(CSV_PATH, "utf-8");
const rawLines = rawContent.replace(/\r/g, "").split("\n").filter(l => l.trim());

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[.\s]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
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

const header = rawLines[0];
const newHeader = header + ",hasBattedAt3,hasBattedAt4,hasBattedAt5,hasBattedAt6,onlyOpensOrBenched";

const newLines: string[] = [newHeader];
const playersMap = new Map(PLAYERS.map(p => [p.id, p]));
const seenIds = new Set<string>();

for (let i = 1; i < rawLines.length; i++) {
  const line = rawLines[i];
  const cols = parseCSVLine(line);
  if (!cols[0] || !cols[1] || !TEAM_MAP[cols[0]]) {
    newLines.push(line);
    continue;
  }
  
  const teamId = TEAM_MAP[cols[0]];
  const name = cols[1];
  let id = toSlug(name);
  if (seenIds.has(id)) id = `${id}-${teamId.toLowerCase()}`;
  seenIds.add(id);

  const player = playersMap.get(id);
  if (player) {
    const has3 = player.hasBattedAt3 === true ? "TRUE" : "FALSE";
    const has4 = player.hasBattedAt4 === true ? "TRUE" : "FALSE";
    const has5 = player.hasBattedAt5 === true ? "TRUE" : "FALSE";
    const has6 = player.hasBattedAt6 === true ? "TRUE" : "FALSE";
    const onlyOpens = player.onlyOpensOrBenched === true ? "TRUE" : "FALSE";
    
    newLines.push(`${line},${has3},${has4},${has5},${has6},${onlyOpens}`);
  } else {
    newLines.push(`${line},FALSE,FALSE,FALSE,FALSE,FALSE`);
  }
}

fs.writeFileSync(CSV_PATH, newLines.join("\n") + "\n", "utf-8");
console.log("Successfully synchronized database.csv with position flags from lib/data/players.ts!");
