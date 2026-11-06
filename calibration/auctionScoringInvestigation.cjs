const fs = require('fs');
const {processPostSeasonCareer} = require('../lib/logic/careerLifecycle');
const snapshot = JSON.parse(fs.readFileSync('calibration/results/league-realism-input.json','utf8'));
const previous = JSON.parse(fs.readFileSync('calibration/results/league-realism-revised-instant.json','utf8')).seasons[0];
const performance = {};
for (const b of previous.batting) performance[b.id] = {matches:b.innings,runs:b.runs,balls:b.balls,wickets:0,runsConceded:0,oversBowled:0};
for (const b of previous.bowling) performance[b.id] = {...(performance[b.id] || {matches:b.innings,runs:0,balls:0}),wickets:b.wickets,runsConceded:b.runs,oversBowled:b.balls/6};
const players = Object.fromEntries(snapshot.players.map(p=>[p.id,p]));
const result = processPostSeasonCareer({players,teams:Object.fromEntries(snapshot.teams.map(t=>[t.id,t])),performance,completedSeason:2027,seed:'auction-scoring-investigation'});
const roster = snapshot.players.filter(p=>p.currentTeamId);
console.log(JSON.stringify({players:roster.length,battingDelta:roster.reduce((s,p)=>s+result.players[p.id].currentBatting-p.currentBatting,0)/roster.length,bowlingDelta:roster.reduce((s,p)=>s+result.players[p.id].currentBowling-p.currentBowling,0)/roster.length}));
fs.writeFileSync('calibration/results/auction-scoring-progressed-input.json',JSON.stringify({...snapshot,players:Object.values(result.players)}));
async function auctionAudit() {
 const Module = require('module');
 const originalLoad = Module._load;
 const uuid = {v4: require('crypto').randomUUID};
 Module._load = function(request, ...args) { return request === 'uuid' ? uuid : request.includes('storage/gameStateStorage') ? {gameStatePersistStorage:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}}} : originalLoad.call(this,request,...args); };
 globalThis.window = {setTimeout};
 const {useGameStore} = require('../lib/store/gameStore');
 useGameStore.setState({players:result.players,teams:Object.fromEntries(snapshot.teams.map(t=>[t.id,{...t,squad:roster.filter(p=>p.currentTeamId===t.id).map(p=>p.id)}])),currentSeason:2027,currentDate:'2027-06-01',userTeamId:snapshot.teams[0].id,saveId:'auction-scoring-investigation',fixtureSeed:'auction-scoring-investigation',lastCareerPostseasonSeason:2027,auction:null});
 await useGameStore.getState().beginNextSeasonRetention(undefined,undefined,'mega');
 const completed = await useGameStore.getState().completeOffseasonAutomatically();
 const s=useGameStore.getState();
 console.log(JSON.stringify({completed,phase:s.auction?.phase,squads:Object.values(s.teams).map(t=>({id:t.id,size:t.squad.length}))}));
 fs.writeFileSync('calibration/results/auction-scoring-auction-input.json',JSON.stringify({version:1,players:Object.values(s.players),teams:Object.values(s.teams)}));
}
auctionAudit().catch(console.error);

