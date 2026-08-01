import * as fs from "fs";
import * as path from "path";

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "simulation_1000_seasons_report.json"), "utf-8"));
const totalWins = Object.values(data.teamStats).reduce((sum: number, t: any) => sum + t.totalWins, 0);
console.log("Total Matches across 1000 seasons:", data.totalMatches);
console.log("Total Team Wins recorded:", totalWins);
