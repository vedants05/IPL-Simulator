import * as fs from "fs";
import * as path from "path";

const reportPath = path.join(process.cwd(), "simulation_1000_seasons_report.json");
if (!fs.existsSync(reportPath)) {
  console.log("Report file not found.");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
console.log("Total Seasons:", data.totalSeasons);
console.log("Total Matches:", data.totalMatches);
console.log("Total Innings:", data.totalInnings);
console.log("Dismissals:", data.dismissals);
