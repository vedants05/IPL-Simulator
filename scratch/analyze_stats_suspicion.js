const fs = require('fs');

const content = fs.readFileSync('careerstats.csv', 'utf-8');
const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

console.log("Analyzing careerstats.csv stats...");
let suspiciousCount = 0;

for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const name = parts[0];
    const t20_games = parseInt(parts[2]);
    const t20_inns = parseInt(parts[3]);
    const t20_avg = parseFloat(parts[4]);
    const t20_runs = parseInt(parts[5]);
    const t20_sr = parseFloat(parts[6]);
    const t20_bowl_inns = parseInt(parts[7]);
    const t20_bowl_avg = parseFloat(parts[8]);
    const t20_wkts = parseInt(parts[9]);

    // Check if stats look generated/calculated
    // For example, if strike rate is exactly a whole number ending in .00, or average is exactly Runs/Innings
    const expectedAvg = t20_inns > 0 ? (t20_runs / t20_inns) : 0;
    const isExactAvg = Math.abs(expectedAvg - t20_avg) < 0.01;

    // Check for round values or default values
    const isDefault = t20_games === 0 && t20_runs === 0 && t20_wkts === 0;

    if (t20_avg > 0 && !isExactAvg && (t20_runs % 50 === 0 || t20_sr % 1 === 0)) {
        suspiciousCount++;
        if (suspiciousCount <= 10) {
            console.log(`Suspicious player: ${name} | Games: ${t20_games} | Avg: ${t20_avg} | Runs: ${t20_runs} | SR: ${t20_sr}`);
        }
    }
}
console.log(`Total suspicious pattern players: ${suspiciousCount}`);
