const fs = require('fs');
const {buildAiMatchLineups}=require('../lib/logic/aiLineupSelector');
for(const variant of ['league-realism-input','auction-scoring-auction-input']) {
 const d=JSON.parse(fs.readFileSync('calibration/results/'+variant+'.json','utf8'));
 const p=Object.fromEntries(d.players.map(p=>[p.id,p]));
 const teams=d.teams.map(t=>{const squad=d.players.filter(p=>p.currentTeamId===t.id);const xi=buildAiMatchLineups(squad).battingFirst.startingXI.map(id=>p[id]);return {team:t.id,top3:xi.slice(0,3).reduce((s,p)=>s+p.currentBatting,0)/3,top7:xi.slice(0,7).reduce((s,p)=>s+p.currentBatting,0)/7,bowlTop5:[...squad].sort((a,b)=>b.currentBowling-a.currentBowling).slice(0,5).reduce((s,p)=>s+p.currentBowling,0)/5,eliteBat:squad.filter(p=>p.currentBatting>=85).length,eliteBowl:squad.filter(p=>p.currentBowling>=85).length,order:xi.map(p=>p.name+' '+p.currentBatting).join(', ')};});
 fs.writeFileSync('calibration/results/individual-totals-roster-'+variant+'.json',JSON.stringify(teams,null,2));
 console.log(variant,JSON.stringify(teams.map(({order,...rest})=>rest)));
}
