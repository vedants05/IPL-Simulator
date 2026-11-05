import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='calibration/data/economy-control/';
const ratings=JSON.parse(fs.readFileSync(root+'ratings.json','utf8')).players;
const previousFile=root+'ratings-first-applied.json';
const previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')).players:[];
const mode=process.argv[2]??'--check';
assert.ok(['--check','--apply'].includes(mode));
assert.equal(ratings.length,347);
assert.equal(new Set(ratings.map(r=>r.id)).size,ratings.length);
assert.ok(ratings.every(r=>Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=99));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url&&key,'Missing database configuration');
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'};
async function request(query,options={}) {
 const response=await fetch(`${url}/rest/v1/players?${query}`,{headers,signal:AbortSignal.timeout(30000),...options});
 if(!response.ok)throw new Error(`Player request failed: HTTP ${response.status}`);
 return response.json();
}
let current=await request('select=id,name,professionalism&order=id&limit=1000');
assert.equal(current.length,ratings.length,'Player count changed; regenerate ratings');
for(const r of ratings){const p=current.find(p=>p.id===r.id);assert.equal(p?.name,r.name,'Identity mismatch');assert.ok(p.professionalism==null||p.professionalism===r.rating||p.professionalism===previous.find(v=>v.id===r.id)?.rating,`Unexpected existing professionalism value for ${r.name}`);}
if(mode==='--apply'){
 const backup=root+'database-backup-before-apply.json';
 if(!fs.existsSync(backup))fs.writeFileSync(backup,JSON.stringify({createdAt:new Date().toISOString(),players:current},null,2));
 for(const r of ratings){
  const old=current.find(p=>p.id===r.id).professionalism;
  if(old===r.rating)continue;
  const ids=[r.id],rating=r.rating;
  if(!ids.length)continue;
  const updated=await request(`id=in.(${ids.join(',')})&professionalism=${old==null?'is.null':`eq.${old}`}&select=id,name,professionalism`,{method:'PATCH',body:JSON.stringify({professionalism:rating})});
  assert.equal(updated.length,ids.length,'Update did not affect the expected rows; check database write permissions');
 }
 current=await request('select=id,name,professionalism&order=id&limit=1000');
}
const mismatches=ratings.filter(r=>current.find(p=>p.id===r.id)?.professionalism!==r.rating);
const result={mode,checkedAt:new Date().toISOString(),players:current.length,matching:ratings.length-mismatches.length,mismatches:mismatches.length};
fs.writeFileSync(root+'database-verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if(mode==='--apply')assert.equal(mismatches.length,0,'Database read-back failed');
