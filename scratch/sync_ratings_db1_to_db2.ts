import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();
const DB1_PATH = path.join(ROOT, "database.csv");
const DB2_PATH = path.join(ROOT, "database2.csv");

function parseCSV(content: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentLine.push(currentField.trim());
      currentField = "";
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // handle CRLF
      currentLine.push(currentField.trim());
      lines.push(currentLine);
      currentLine = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    lines.push(currentLine);
  }
  return lines;
}

function writeCSV(rows: string[][]): string {
  return rows.map(row => 
    row.map(field => {
      const needsQuotes = field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r");
      if (needsQuotes) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    }).join(",")
  ).join("\n");
}

// Read and parse
const db1Rows = parseCSV(fs.readFileSync(DB1_PATH, "utf-8")).filter(r => r.length > 1);
const db2Rows = parseCSV(fs.readFileSync(DB2_PATH, "utf-8")).filter(r => r.length > 1);

// Build map of ratings from db1 (database.csv)
const db1Ratings = new Map<string, { curBat: string; potBat: string; curBowl: string; potBowl: string }>();
// Header: Team,Player Name,Country,Age,IPL 2026 Salary (Cr),Overseas Status,Status,Primary Role,Bowling Type,Bowling Hand,Batting Hand,Current Batting,Potential Batting,Current Bowling,Potential Bowling
for (let i = 1; i < db1Rows.length; i++) {
  const row = db1Rows[i];
  const name = row[1];
  if (!name) continue;
  db1Ratings.set(name.toLowerCase().trim(), {
    curBat: row[11] || "0",
    potBat: row[12] || "0",
    curBowl: row[13] || "0",
    potBowl: row[14] || "0",
  });
}

// Update db2 (database2.csv)
let updateCount = 0;
const missedPlayers: string[] = [];

for (let i = 1; i < db2Rows.length; i++) {
  const row = db2Rows[i];
  const name = row[1];
  if (!name) continue;
  
  const ratings = db1Ratings.get(name.toLowerCase().trim());
  if (ratings) {
    row[12] = ratings.curBat;
    row[13] = ratings.potBat;
    row[14] = ratings.curBowl;
    row[15] = ratings.potBowl;
    updateCount++;
  } else {
    missedPlayers.push(name);
  }
}

fs.writeFileSync(DB2_PATH, writeCSV(db2Rows));
console.log(`Successfully updated ${updateCount} players in database2.csv with ratings from database.csv.`);
if (missedPlayers.length > 0) {
  console.log(`Note: ${missedPlayers.length} players in database2.csv were not found in database.csv:`, missedPlayers.join(", "));
}
