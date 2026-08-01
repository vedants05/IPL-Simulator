import * as fs from "fs";
import * as path from "path";

const cachedData = fs.readFileSync(path.join(process.cwd(), "scripts", ".player_cache.json"), "utf-8");
const players = JSON.parse(cachedData);

const mar = players.filter((p: any) => p.name?.toLowerCase().includes("marsh") || p.name?.toLowerCase().includes("mitch") || p.name?.toLowerCase().includes("shep") || p.name?.toLowerCase().includes("venk"));
console.log(JSON.stringify(mar, null, 2));
