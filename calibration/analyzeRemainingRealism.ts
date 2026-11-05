import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=(name:string)=>JSON.parse(readFileSync(`calibration/results/${name}.json`,'utf8'));
const before=read('league-realism-before-20');
const after=read('league-realism-revised-instant');
const detailed=read('league-realism-diagnostics');
assert.equal(after.inputHash,detailed.inputHash);
assert.equal(after.seed,detailed.seed);
assert.equal(after.seasons.length,detailed.seasons.length);
for(let i=0;i<after.seasons.length;i++) assert.deepEqual(after.seasons[i].summary,detailed.seasons[i].summary);
const sum=(rows:any[],key:string)=>rows.reduce((s,r)=>s+(r[key]??0),0);
const bands=[{label:'<70',min:0,max:70},{label:'70–79',min:70,max:80},{label:'80–89',min:80,max:90},{label:'90+',min:90,max:200}];
const pooled=(rows:any[],key:string)=>Object.values(rows.reduce((out:any,row:any)=>{
 const id=row[key];const r=out[id]??={id,name:row.name,team:row.team,ability:row.ability,aggression:row.aggression};
 for(const k of ['balls','runs','wickets','innings','sixes','fours','hundreds','fifties','outs'])r[k]=(r[k]??0)+(row[k]??0);
 return out;
},{})) as any[];
function totals(data:any){
 const bat=data.seasons.flatMap((s:any)=>s.batting), inn=data.seasons.flatMap((s:any)=>s.innings);
 const n=data.seasons.length, summaries=data.seasons.map((s:any)=>s.summary);
 return {seasons:n,balls:sum(inn,'balls'),ballsPerSix:sum(inn,'balls')/sum(bat,'sixes'),sixPct:100*sum(bat,'sixes')/sum(inn,'balls'),fourPct:100*sum(bat,'fours')/sum(inn,'balls'),boundaryRunShare:100*(sum(bat,'sixes')*6+sum(bat,'fours')*4)/sum(bat,'runs'),sixesPerSeason:sum(bat,'sixes')/n,hundredsPerSeason:sum(bat,'hundreds')/n,fiftyToHundred:sum(bat,'hundreds')/(sum(bat,'hundreds')+sum(bat,'fifties')),bothInnings250:inn.filter((i:any)=>i.runs>=250).length/n,bothInnings300:inn.filter((i:any)=>i.runs>=300).length/n,firstUnder150:summaries.reduce((s:number,r:any)=>s+r.firstUnder150,0)/n,allOuts:sum(summaries,'allOuts')/n,maidens:sum(summaries,'maidens')/n};
}
const bowling=after.seasons.flatMap((s:any)=>s.bowling);
const batting=after.seasons.flatMap((s:any)=>s.batting);
const phases=detailed.seasons.flatMap((s:any)=>Object.values(s.diagnostics.bowlingPhase));
const bi=detailed.seasons.flatMap((s:any)=>s.diagnostics.battingInnings);
assert.equal(sum(phases,'balls'),sum(bowling,'balls'));
assert.equal(sum(phases,'runs'),sum(bowling,'runs'));
assert.equal(sum(phases,'sixes'),sum(batting,'sixes'));
assert.equal(sum(phases,'fours'),sum(batting,'fours'));
assert.equal(bi.filter((r:any)=>r.runs>=100).length,sum(batting,'hundreds'));
const bowlingBands=bands.map(b=>{
 const rows=bowling.filter((r:any)=>r.ability>=b.min&&r.ability<b.max);
 return {band:b.label,players:new Set(rows.map((r:any)=>r.id)).size,ballShare:100*sum(rows,'balls')/sum(bowling,'balls'),balls:sum(rows,'balls'),economy:6*sum(rows,'runs')/sum(rows,'balls'),ballsPerWicket:sum(rows,'balls')/sum(rows,'wickets'),phase:['powerplay','middle','death'].map(p=>{
 const rs=phases.filter((r:any)=>r.ability>=b.min&&r.ability<b.max&&r.phase===p);
 return {phase:p,ballShare:100*sum(rs,'balls')/sum(rows,'balls'),economy:6*sum(rs,'runs')/sum(rs,'balls'),sixPct:100*sum(rs,'sixes')/sum(rs,'balls')};
 })};
});
const topHundreds=pooled(batting,'id').sort((a,b)=>b.hundreds-a.hundreds).slice(0,12).map(r=>({...r,meanHundreds:r.hundreds/20,sr:100*r.runs/r.balls,avg:r.runs/r.outs}));
const weakBowlers=pooled(bowling,'id').filter(r=>r.ability<80).sort((a,b)=>b.balls-a.balls).map(r=>({...r,econ:6*r.runs/r.balls,oversPerSeason:r.balls/120}));
const hundredBreakdown={total:bi.filter((r:any)=>r.runs>=100).length,first:bi.filter((r:any)=>r.runs>=100&&r.first).length,topThree:bi.filter((r:any)=>r.runs>=100&&r.position<=3).length,abilityBelow80:bi.filter((r:any)=>r.runs>=100&&r.ability<80).length,aggression99:bi.filter((r:any)=>r.runs>=100&&r.aggression===99).length,byOpposition:pooled(bi.filter((r:any)=>r.runs>=100).map((r:any)=>({...r,innings:1})),'opposition').map(r=>({team:r.id,hundreds:r.innings}))};
const venues=Object.entries(detailed.seasons.reduce((out:any,s:any)=>{for(const [k,v] of Object.entries(s.diagnostics.venue)){const r=out[k]??={balls:0,runs:0,fours:0,sixes:0};for(const field of Object.keys(r))r[field]+=(v as any)[field];}return out;},{})).map(([venue,row]:any)=>({venue,...row,rr:6*row.runs/row.balls,sixPct:100*row.sixes/row.balls}));
const battingAbility=bands.map(b=>{const rs=batting.filter((r:any)=>r.ability>=b.min&&r.ability<b.max);return {band:b.label,balls:sum(rs,'balls'),hundreds:sum(rs,'hundreds'),sr:100*sum(rs,'runs')/sum(rs,'balls'),average:sum(rs,'runs')/sum(rs,'outs')};});
const eliteWorkloads=pooled(bowling,'id').filter(r=>r.ability>=90).map(r=>{
 const rows=phases.filter((p:any)=>p.id===r.id);
 return {name:r.name,ability:r.ability,economy:6*r.runs/r.balls,balls:r.balls,death17Plus:sum(rows.filter((p:any)=>p.over>=17),'balls'),death16Plus:sum(rows.filter((p:any)=>p.over>=16),'balls'),firstInningsBalls:sum(rows.filter((p:any)=>p.first),'balls'),firstInningsDeath16Plus:sum(rows.filter((p:any)=>p.first&&p.over>=16),'balls')};
});
const qualifiedBowling=bowling.filter((r:any)=>r.balls>=180);
const result={replayMatchesOriginal:true,before:totals(before),after:totals(after),bowlingBands,weakBowlers,topHundreds,hundredBreakdown,battingAbility,venues,eliteWorkloads,qualifiedBowling:{seasons:qualifiedBowling.length,over12:qualifiedBowling.filter((r:any)=>r.econ>=12).length,over14:qualifiedBowling.filter((r:any)=>r.econ>=14).length}};
writeFileSync('calibration/results/league-realism-remaining-analysis.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,weakBowlers:weakBowlers.slice(0,7),topHundreds:topHundreds.slice(0,5)},null,2));
