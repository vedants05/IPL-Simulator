const fs = require('fs');
const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, ...args) { return request === 'uuid' ? {v4: require('crypto').randomUUID} : request.includes('storage/gameStateStorage') ? {gameStatePersistStorage:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}}} : originalLoad.call(this,request,...args); };
globalThis.window = {setTimeout};
const {useGameStore} = require('../lib/store/gameStore');
const base = JSON.parse(fs.readFileSync('calibration/results/league-realism-input.json','utf8'));
async function main() {
 const offset = Number(process.env.AUCTION_SEED_OFFSET || 0);
 const outputPrefix = process.env.AUCTION_OUTPUT_PREFIX || 'independent-auction';
 for (let i=1;i<=5;i++) {
  let x = 1357911+offset+i*99991; Math.random = () => ((x = (Math.imul(x,1664525)+1013904223) >>> 0) / 4294967296);
  const players=structuredClone(base.players), teams=structuredClone(base.teams);
  useGameStore.getState().resetGame();
  useGameStore.setState({players:Object.fromEntries(players.map(p=>[p.id,p])),teams:Object.fromEntries(teams.map(t=>[t.id,{...t,squad:players.filter(p=>p.currentTeamId===t.id).map(p=>p.id)}])),currentSeason:2027,currentDate:'2027-06-01',userTeamId:teams[0].id,saveId:'audit-'+i,fixtureSeed:'audit-'+i,lastCareerPostseasonSeason:2027,auction:null});
  await useGameStore.getState().beginNextSeasonRetention(undefined,undefined,'mega');
  const completed=await useGameStore.getState().completeOffseasonAutomatically();
  const state=useGameStore.getState(); if (!completed || state.auction?.phase !== 'completed') throw Error('Auction failed '+i);
  const squads=Object.values(state.teams).map(t=>({id:t.id,size:t.squad.length}));
  fs.writeFileSync(`calibration/results/${outputPrefix}-${i}.json`,JSON.stringify({version:1,players:Object.values(state.players),teams:Object.values(state.teams),squads}));
  console.log(JSON.stringify({auction:i,completed,squads}));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
