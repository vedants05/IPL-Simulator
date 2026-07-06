import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();
const DB2_PATH = path.join(ROOT, "database2.csv");

const keywords = [
  "tarmale",
  "dahiya",
  "bawa",
  "pretorius",
  "brar",
  "rathi",
  "arshad",
  "yarra",
  "foulkes",
  "yudhvir",
  "dayal",
  "aman",
  "khaleel",
  "foulkes",
  "dubey",
  "overton",
  "duckett",
  "salahuddin",
  "nabi",
  "nat",
  "sal"
];

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
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentLine.push(currentField.trim());
      currentField = "";
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
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

function run() {
  const db2 = parseCSV(fs.readFileSync(DB2_PATH, "utf-8")).filter(r => r.length > 1);
  const db2Names = db2.slice(1).map(row => row[1]);
  
  console.log("Checking similarities in database2.csv:");
  for (const kw of keywords) {
    const matches = db2Names.filter(name => name.toLowerCase().includes(kw));
    if (matches.length > 0) {
      console.log(`Keyword "${kw}" matches in DB2:`, matches);
    } else {
      console.log(`Keyword "${kw}" has NO matches in DB2.`);
    }
  }
}

run();
