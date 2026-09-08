// Offline asset import only. No requests to OSM are made by the game.
// OSM data is ODbL: retain attribution and publish the derived data with it.
import { mkdir, writeFile } from 'node:fs/promises';
const venues = {
  KKR:[22.56461,88.34234], RCB:[12.97883,77.59953], MI:[18.93855,72.82573],
  CSK:[13.06276,80.27942], DC:[28.63785,77.24312], LSG:[26.81111,81.01694],
  SRH:[17.40594,78.55053], GT:[23.09139,72.59722], RR:[26.89401,75.80323], PBKS:[30.7788,76.72378],
};
const output = new URL('../public/stadiums/maps/', import.meta.url);
await mkdir(output,{recursive:true});
for (const [team, [lat,lon]] of Object.entries(venues)) {
  if(process.argv[2] && process.argv[2]!==team) continue;
  const dy=420/111320, dx=dy/Math.cos(lat*Math.PI/180);
  const bbox=[lon-dx,lat-dy,lon+dx,lat+dy];
  const url=`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox.join(',')}`;
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(90000),headers:{'User-Agent':'IPL-Simulator-Stadium-Map-Import/1.0','Accept':'application/json'}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
    const features=[];
    for(const e of data.elements) {
      const t=e.tags??{};
      if(e.type!=='way' || !(t.building || t.highway || t.railway || t.natural==='water' || t.landuse || t.leisure==='park' || t.leisure==='garden' || t.leisure==='stadium' || t.leisure==='pitch' || t.amenity==='parking')) continue;
      if(!e.nodes.every(id=>nodes.has(id))) continue;
      const points=e.nodes.map(id=>{const p=nodes.get(id);return [Math.round((p.lon-lon)*111320*Math.cos(lat*Math.PI/180)*100)/100,Math.round((lat-p.lat)*111320*100)/100];});
      features.push({id:e.id,tags:t,points,closed:e.nodes[0]===e.nodes.at(-1)});
    }
    // Published POI coordinates can mark an entrance. Align the local origin
    // with the nearest mapped cricket playing area, not that entrance.
    const candidates=features.filter(f=>f.closed && f.tags.leisure==='pitch' && f.tags.sport==='cricket').map(f=>{
      const xs=f.points.map(p=>p[0]),zs=f.points.map(p=>p[1]);
      return {id:f.id,x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,area:(Math.max(...xs)-Math.min(...xs))*(Math.max(...zs)-Math.min(...zs))};
    }).filter(p=>p.area>5000 && Math.hypot(p.x,p.z)<160).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
    const origin=candidates[0]??{x:0,z:0,id:null};
    for(const f of features) f.points=f.points.map(([x,z])=>[Math.round((x-origin.x)*100)/100,Math.round((z-origin.z)*100)/100]);
    // Retain the source response, including multipolygon relations, for audit
    // and a future hole-aware importer. The renderer currently uses ways only.
    await writeFile(new URL(`${team}.source.json`,output),JSON.stringify(data));
    await writeFile(new URL(`${team}.json`,output),JSON.stringify({team,center:[lat-origin.z/111320,lon+origin.x/(111320*Math.cos(lat*Math.PI/180))],originPitchWay:origin.id,bbox,source:url,fetchedAt:new Date().toISOString(),license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',units:'metres; X east, Z south',limitations:['Way geometry only; multipolygon interiors are not reconstructed.','Missing heights and road widths are visual estimates.','Not a survey or a concourse floor plan.'],features}));
    console.log(`${team}: ${features.length} mapped features imported`);
  } catch(error) {console.error(`${team}: ${error.message}`);process.exitCode=1;}
}
