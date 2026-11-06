// Isolated consecutive 2027 -> mega auction -> 2028 career investigation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript'),Module=require('node:module');
const load=Module._load;
Module._load=function(request,...args){
 if(request==='uuid')return {v4:crypto.randomUUID};
 if(request.includes('storage/gameStateStorage'))return {gameStatePersistStorage:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}}};
 return load.call(this,request,...args);
};
globalThis.window={setTimeout};
const {useGameStore:store}=require('../lib/store/gameStore');
const sim=require('../lib/logic/matchSimulation');
const ai=require('../lib/logic/aiLineupSelector');
const automatic=require('../lib/logic/automaticLineupBuilder');
const {validateLineup}=require('../lib/logic/lineupPlanner');
const awards=require('../lib/logic/seasonAwards');
const pitchData=require('../lib/data/pitchCurator');
const ground=require('../lib/logic/stadiumManagement');
const schedule=require('../lib/logic/leagueSchedule');
const snapshot=JSON.parse(fs.readFileSync('calibration/results/league-realism-input.json','utf8'));
const source=fs.readFileSync('app/game/overview/page.tsx','utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function pageFunction(name,context){
 let expression;
 function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name&&node.initializer)expression=node.initializer.getText(ast);
  if(ts.isFunctionDeclaration(node)&&node.name?.text===name)expression=node.getText(ast);
  ts.forEachChild(node,visit);
 }
 visit(ast);if(!expression)throw Error('Missing page function '+name);
 const js=ts.transpileModule('const extracted = '+expression+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 return new Function(...Object.keys(context),js+'; return extracted;')(...Object.values(context));
}
const statsFromFixtures=pageFunction('deriveIplSeasonStatsRecord',{...awards,oversFromBalls:sim.oversFromBalls});
const toPlan=pageFunction('toMatchLineupPlan',{});
const legacy=pageFunction('simulationToLegacyScorecard',{});
function seeded(seed){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function summary(stats,fixtures){
 const rows=Object.values(stats), descending=(key)=>[...rows].sort((a,b)=>b[key]-a[key]);
 const bats=descending('runs'),bowls=descending('wickets');
 return {matches:fixtures.length,league:fixtures.filter(f=>!f.stage).length,playoffs:fixtures.filter(f=>f.stage).length,
 leadingRuns:bats[0].runs,leadingWickets:bowls[0].wickets,
 runThresholds:Object.fromEntries([500,600,700,800,900].map(n=>[n,rows.filter(p=>p.runs>=n).length])),
 wicketThresholds:Object.fromEntries([20,25,30,35].map(n=>[n,rows.filter(p=>p.wickets>=n).length])),
 top5Runs:bats.slice(0,5).reduce((s,p)=>s+p.runs,0),top5Wickets:bowls.slice(0,5).reduce((s,p)=>s+p.wickets,0),
 top5BatterBalls:bats.slice(0,5).reduce((s,p)=>s+p.balls,0),
 top5BowlerBalls:bowls.slice(0,5).reduce((s,p)=>s+Math.floor(p.oversBowled)*6+Math.round(p.oversBowled%1*10),0),
 firstAverage:fixtures.reduce((s,f)=>s+f.simulation.innings[0].runs,0)/fixtures.length,
 totalRuns:rows.reduce((s,p)=>s+p.runs,0),totalWickets:rows.reduce((s,p)=>s+p.wickets,0),
 leaders:{batting:bats.slice(0,10),bowling:bowls.slice(0,10)}};
}
function runSeason(year,seed){
 const fixtures=[],players=store.getState().players,teams=store.getState().teams;
 const standings=pageFunction('calculateStandings',{teams,currentSeason:year,fixtureSeed:seed});
 const form=pageFunction('getRecentFormAdjustments',{fixtures});
 let stats={};
 const squad=(id)=>teams[id].squad.map(id=>players[id]).filter(p=>p&&!store.getState().activeInjuries[p.id]);
 const tune=pageFunction('tuneAiPlanForPitch',{players,getSelectableTeamSquad:squad,...automatic,validateLineup,getPlayerRating:p=>Math.max(p.currentBatting,p.currentBowling)});
 const positions={};
 function plans(id,pitch){
  const full=teams[id].squad.map(id=>players[id]).filter(Boolean);
  const injuries=store.getState().activeInjuries;
  const healthy=squad(id);
  const available=healthy.length>=16?healthy:full.filter(p=>!injuries[p.id]||injuries[p.id].severity==='minor');
  if(available.length<12)throw Error('Too few available '+id);
  const recommended=ai.buildAiMatchLineups(available),selection=automatic.buildAutomaticLineupSelection(available);
  const protectedIds=new Set([recommended.battingFirst.captainId,recommended.battingFirst.viceCaptainId,recommended.bowlingFirst.captainId,recommended.bowlingFirst.viceCaptainId].filter(Boolean));
  const bat=tune(selection.battingFirstXI,selection.battingFirstImpactSubs,'battingFirst',pitch,protectedIds);
  const bowl=tune(selection.bowlingFirstXI,selection.bowlingFirstImpactSubs,'bowlingFirst',pitch,protectedIds);
  const rec=ai.reconcileBowlingFirstImpactPlan(available,bowl.startingXI,bowl.impactSubs,protectedIds,{impactPlayerId:recommended.bowlingFirst.impactPlayerId,outgoingPlayerId:recommended.bowlingFirst.likelyOutgoingPlayerId,battingPosition:recommended.bowlingFirst.impactBattingPosition});
  const p=(v,r,impact,out,pos)=>toPlan(v.startingXI,v.impactSubs,impact,out,pos,r.captainId,r.viceCaptainId);
  return {teamId:id,isUserControlled:false,tactics:sim.createIntelligentAiTactics(teams[id],pitch,store.getState().careerStaff),
   battingFirst:p(bat,recommended.battingFirst,bat.impactSubs.includes(recommended.battingFirst.impactPlayerId)?recommended.battingFirst.impactPlayerId:null,bat.startingXI.includes(recommended.battingFirst.likelyOutgoingPlayerId)?recommended.battingFirst.likelyOutgoingPlayerId:null,recommended.battingFirst.impactBattingPosition),
   bowlingFirst:p(bowl,recommended.bowlingFirst,rec.impactPlayerId,rec.outgoingPlayerId,rec.battingPosition)};
 }
 function play(f){
  store.getState().reconcileInjuries(f.date);
  store.getState().processBackgroundInjuries({date:f.date,season:year,seed,generationEnabled:true});
  const stadium=pitchData.getHomeStadium(f.teamA),pitch=pitchData.getDefaultCuratorPitch(f.teamA),outfield=ground.getDefaultOutfieldSettings(f.teamA);
  const recent=form(f);
  const result=sim.simulateInstantMatch({fixtureId:f.id,matchNumber:f.matchNumber,date:f.date,time:f.time,seed:`${year}:${seed}:${f.id}`,teamA:teams[f.teamA],teamB:teams[f.teamB],players,
   teamAPlans:plans(f.teamA,pitch),teamBPlans:plans(f.teamB,pitch),seasonBattingStats:stats,battingFormAdjustments:recent.batting,bowlingFormAdjustments:recent.bowling,staffState:store.getState().careerStaff,stage:f.stage,isKnockout:!!f.stage,
   conditions:{homeTeamId:f.teamA,stadiumId:stadium.id,stadiumName:stadium.name,pitch,boundaries:stadium.defaultBoundaryDimensions,outfield,outfieldSpeedRating:ground.calculateOutfieldSpeedRating(f.teamA,outfield),adjustedExpectedScore:pitch.expectedFirstInningsScore,groundScoringModifier:ground.calculateGroundScoringImpact(f.teamA,stadium.defaultBoundaryDimensions,outfield).modifier,chasingScoringBonus:0}});
  for(const inn of result.innings){
   if(inn.batting.reduce((s,p)=>s+p.runs,0)+inn.extras.total!==inn.runs)throw Error('Run arithmetic');
   if(inn.bowling.reduce((s,p)=>s+p.balls,0)!==inn.legalBalls)throw Error('Ball arithmetic');
   if(inn.bowling.some(p=>p.balls>24))throw Error('Bowling quota');
   inn.batting.forEach((p,i)=>{if(!p.didNotBat){positions[p.id]??={};positions[p.id][i+1]=(positions[p.id][i+1]??0)+1;}});
  }
  const a=result.innings.find(i=>i.battingTeamId===f.teamA),b=result.innings.find(i=>i.battingTeamId===f.teamB);
  const played={...f,played:true,winner:result.winnerId,scoreA:{runs:a.runs,wickets:a.wickets,overs:a.overs},scoreB:{runs:b.runs,wickets:b.wickets,overs:b.overs},simulation:result,scorecard:legacy(result,f.teamA,f.teamB)};
  fixtures.push(played);stats=statsFromFixtures(fixtures,players);
  const participants=Object.values(result.lineups).flatMap(l=>[...new Set([...l.startingXI,...l.finalXI])].map(id=>({player:players[id],teamId:l.teamId})));
  store.getState().processMatchInjuries({matchId:f.id,date:f.date,season:year,seed,teamIds:[f.teamA,f.teamB],participants});
  return result.winnerId;
 }
 const league=schedule.generateBalancedLeagueFixtures(Object.keys(teams),year,'RCB',seed);
 for(const f of league)play(f);
 const table=standings(fixtures),top=table.slice(0,4).map(t=>t.teamId),ko=schedule.generateKnockoutFixtures(league.at(-1).date,year,top);
 const q1=play(ko[0]),elim=play(ko[1]);
 const q2=play({...ko[2],teamA:top[0]===q1?top[1]:top[0],teamB:elim});
 play({...ko[3],teamA:q1,teamB:q2});
 if(fixtures.length!==74||table.some(t=>t.played!==14))throw Error('Incomplete season');
 return {stats,fixtures,standings:standings(fixtures),positions,summary:summary(stats,fixtures),leagueSummary:summary(statsFromFixtures(fixtures.filter(f=>!f.stage),players),fixtures.filter(f=>!f.stage))};
}
async function main(){
 const count=Number(process.env.CAREER_AUDIT_SAVES??10),out=process.env.CAREER_AUDIT_OUT??'calibration/results/consecutive-careers';fs.mkdirSync(out,{recursive:true});
 const initial=store.getState();const reports=[];
 for(let n=1;n<=count;n++){
  const seed='consecutive-mega-investigation-'+n;Math.random=seeded(seed);
  store.setState({...initial,players:Object.fromEntries(snapshot.players.map(p=>[p.id,structuredClone(p)])),teams:Object.fromEntries(snapshot.teams.map(t=>[t.id,{...structuredClone(t),squad:snapshot.players.filter(p=>p.currentTeamId===t.id).map(p=>p.id)}])),userTeamId:snapshot.teams[(n-1)%10].id,currentSeason:2027,currentDate:'2027-03-01',saveId:seed,fixtureSeed:seed,auction:null});
  const before=runSeason(2027,seed);
  console.log(JSON.stringify({save:n,stage:'2027 complete',runs:before.summary.leadingRuns,wickets:before.summary.leadingWickets}));
  await store.getState().archiveCareerSeason({season:2027,fixtures:before.fixtures,standings:before.standings,playerStats:before.stats});
  store.setState({currentDate:before.fixtures.at(-1).date});
  await store.getState().beginNextSeasonRetention(undefined,undefined,'mega');
  if(!await store.getState().completeOffseasonAutomatically())throw Error('Auction incomplete');
  const s=store.getState();if(s.auction.type!=='mega'||s.auction.season!==2028||s.auction.phase!=='completed')throw Error('Invalid auction');
  const auction={type:s.auction.type,season:s.auction.season,phase:s.auction.phase,sold:s.auction.soldPlayerIds.length,unsold:s.auction.unsoldPlayerIds.length,squads:Object.values(s.teams).map(t=>({team:t.id,size:t.squad.length,ids:t.squad}))};
  const after=runSeason(2028,seed);
  const pack=r=>({summary:r.summary,leagueSummary:r.leagueSummary,stats:r.stats,positions:r.positions,fixtures:r.fixtures.map(({simulation,scorecard,...f})=>f)});
  const report={save:n,seed,userTeam:s.userTeamId,before:pack(before),auction,after:pack(after),method:'Consecutive archive/postseason/retention/mega-auction paths. Page functions extracted at runtime for stats, pitch tuning, form and standings. Per-fixture AI selection/tactics, staff and injury processing. Default venues, no interactive user decisions or international calendar/trades.'};
  reports.push(report);fs.writeFileSync(path.join(out,`save-${n}.json`),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(reports.map(({before,after,auction,...r})=>({...r,before:before.summary,after:after.summary,leagueBefore:before.leagueSummary,leagueAfter:after.leagueSummary,auction})),null,2));
  console.log(JSON.stringify({save:n,stage:'2028 complete',runs:after.summary.leadingRuns,wickets:after.summary.leadingWickets,auctionSold:auction.sold}));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
