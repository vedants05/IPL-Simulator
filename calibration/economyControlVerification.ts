import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bowlingTempoMultiplier, calibrateBattingTempo} from '../lib/logic/matchSimulation';
import {mapRowsToPlayers} from '../lib/supabase/fetchPlayers';
const ratings=JSON.parse(readFileSync('calibration/data/economy-control/ratings.json','utf8'));
const before=JSON.parse(readFileSync('calibration/data/economy-control/players-before.json','utf8'));
assert.equal(ratings.players.length,before.length);
assert.equal(new Set(ratings.players.map((r:any)=>r.id)).size,before.length);
const raw=before.map((r:any)=>({...r,professionalism:ratings.players.find((p:any)=>p.id===r.id).rating}));
for(const p of mapRowsToPlayers(raw)) {
  const source=raw.find((r:any)=>r.name===p.name);
  assert.equal(p.bowlingEconomyControl,source.professionalism);
  assert.ok(p.bowlingEconomyControl!>=1&&p.bowlingEconomyControl!<=99);
}
for(const ability of [60,78,82,94]) {
  assert.ok(bowlingTempoMultiplier(ability,90)<bowlingTempoMultiplier(ability,70));
  assert.ok(bowlingTempoMultiplier(ability,70)<bowlingTempoMultiplier(ability,40));
  assert.equal(bowlingTempoMultiplier(ability),bowlingTempoMultiplier(ability,NaN));
  const weights={dot:.38,single:.44,two:.11,three:.0035,four:.11,six:.045};
  const low=calibrateBattingTempo(weights,.04,85,1,1,bowlingTempoMultiplier(ability,40));
  const high=calibrateBattingTempo(weights,.04,85,1,1,bowlingTempoMultiplier(ability,90));
  assert.ok(high.achievedRunsPerBall<low.achievedRunsPerBall);
  // Control should not secretly change the baseline wicket-creation chance.
  assert.ok(Math.abs(high.wicketProbability-low.wicketProbability)<1e-8);
}
console.log(`Economy-control checks passed for ${ratings.players.length} ratings and ${mapRowsToPlayers(raw).length} loaded players.`);
