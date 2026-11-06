const assert=require('node:assert/strict');
const fs=require('node:fs');
const {playerHonours}=require('../lib/logic/playerHonours');
const {createHistoricalPlayerSnapshot}=require('../lib/logic/careerLifecycle');
const {HISTORICAL_LEAGUE_HISTORY}=require('../lib/data/leagueHistory');
const input=JSON.parse(fs.readFileSync('calibration/results/league-realism-input.json','utf8'));
const rohit=input.players.find(p=>p.name==='Rohit Sharma');assert(rohit);
const honours={iplTitleSeasons:[2013,2015,2017,2019,2020],iplRunnerUpSeasons:[2010],iplOrangeCapSeasons:[2027],iplPurpleCapSeasons:[2028],iplMvpSeasons:[2029],iplEmergingPlayerSeasons:[2009]};
const snapshot=createHistoricalPlayerSnapshot({...rohit,...honours},{age:41,season:2028,rating:80});
for(const [field,seasons] of Object.entries(honours)){assert.deepEqual(snapshot[field],seasons);assert.notEqual(snapshot[field],seasons);}
const legacy={...rohit};for(const field of Object.keys(honours))delete legacy[field];
const recovered=playerHonours(legacy,HISTORICAL_LEAGUE_HISTORY,true);
for(const season of [2013,2015,2017,2019,2020])assert(recovered.iplTitleSeasons.includes(season),'Missing championship '+season);
assert(recovered.iplEmergingPlayerSeasons.includes(2009));
const merged=playerHonours({...legacy,...recovered},HISTORICAL_LEAGUE_HISTORY,true);
assert.deepEqual(merged,recovered,'Honours must not be duplicated');
console.log('Retirement preserves all six honours fields; legacy Rohit titles and emerging award recovered; merge is idempotent.');
