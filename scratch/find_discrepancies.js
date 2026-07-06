const fs = require('fs');

const db2Content = fs.readFileSync('database2.csv', 'utf-8');
const db2Lines = db2Content.split('\n').map(l => l.trim()).filter(Boolean);
const db2Players = {};

for (let i = 1; i < db2Lines.length; i++) {
    const parts = db2Lines[i].split(',');
    const name = parts[1].toLowerCase().trim();
    db2Players[name] = {
        role: parts[8].trim(),
        canKeep: parts[17].trim().toLowerCase() === 'yes',
        currBat: parseInt(parts[12]) || 0,
        currBowl: parseInt(parts[14]) || 0,
    };
}

const careerContent = fs.readFileSync('careerstats.csv', 'utf-8');
const careerLines = careerContent.split('\n').map(l => l.trim()).filter(Boolean);

console.log("Analyzing for role and rating discrepancies between database2 and careerstats...");

function cleanName(n) {
    return n.toLowerCase()
        .replace(/\./g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const spellingMap = {
    'aman hakim khan': 'aman khan',
    'zak foulkes': 'zakary foulkes',
    'auqib nabi': 'auqib nabi dar',
    't natarajan': 't. natarajan',
    'gurnoor singh brar': 'gurnoor brar',
    'mohd arshad khan': 'mohd. arshad khan',
    'r sai kishore': 'r. sai kishore',
    'yarra prithvi raj': 'prithvi raj yarra',
    'yarra prithviraj': 'prithvi raj yarra',
    'tejasvi singh dahiya': 'tejasvi dahiya',
    'allah ghazanfar': 'am ghazanfar',
    'lhuan dre pretorius': 'lhuan-dre pretorius',
    'yudhvir singh': 'yudhvir singh charak',
    'praveen dubey': 'pravin dubey',
    'onkar tarmale': 'onkar tukaram tarmale',
    'varun chakravarthy': 'varun chakaravarthy',
    'phil salt': 'philip salt',
    'akash singh': 'akash maharaj singh',
    'raj angad bawa': 'raj bawa',
    'rasikh salam': 'rasikh dar salam',
};

function getDb2Player(name) {
    const cp = cleanName(name);
    if (db2Players[cp]) return db2Players[cp];
    const mapped = spellingMap[cp];
    if (mapped && db2Players[mapped]) return db2Players[mapped];
    for (const key of Object.keys(db2Players)) {
        if (key.includes(cp) || cp.includes(key)) {
            return db2Players[key];
        }
    }
    return null;
}

let count = 0;
for (let i = 1; i < careerLines.length; i++) {
    const parts = careerLines[i].split(',');
    const name = parts[0];
    const t20_games = parseInt(parts[2]) || 0;
    const t20_inns = parseInt(parts[3]) || 0;
    const t20_runs = parseInt(parts[5]) || 0;
    const t20_wkts = parseInt(parts[9]) || 0;
    const t20_catches = parts[10];
    const t20_stumpings = parts[11];
    
    const db2 = getDb2Player(name);
    if (!db2) {
        console.log(`Could not find DB2 profile for: ${name}`);
        continue;
    }

    let issues = [];

    // 1. Wicketkeepers having no catches/stumpings recorded, or non-keepers having them
    if (db2.canKeep && (t20_catches === '--' || t20_catches === '0')) {
        issues.push(`Wicketkeeper has no catches/stumpings recorded: catches=${t20_catches}`);
    }
    if (!db2.canKeep && (t20_catches !== '--' && t20_catches !== '0' && t20_catches !== '')) {
        issues.push(`Non-keeper has catches/stumpings: catches=${t20_catches}`);
    }

    // 2. High batting rating but low runs relative to matches
    if (db2.currBat > 70 && t20_runs < 100 && t20_games > 10) {
        issues.push(`High bat rating (${db2.currBat}) but very low runs (${t20_runs}) in ${t20_games} games`);
    }

    // 3. High bowling rating but low wickets
    if (db2.currBowl > 70 && t20_wkts < 5 && t20_games > 10) {
        issues.push(`High bowl rating (${db2.currBowl}) but very low wickets (${t20_wkts}) in ${t20_games} games`);
    }

    if (issues.length > 0) {
        count++;
        console.log(`\nPlayer: ${name} (Role: ${db2.role}, Keep: ${db2.canKeep ? 'Yes' : 'No'}, Bat: ${db2.currBat}, Bowl: ${db2.currBowl})`);
        issues.forEach(iss => console.log(`  - ${iss}`));
    }
}
console.log(`\nTotal players with potential role/rating mismatch issues: ${count}`);
