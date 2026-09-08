// Reproducible geometry derivation from the archived OSM extracts. No network.
import { readFile, writeFile } from 'node:fs/promises';
const ids={KKR:['relation',3501020],RCB:['relation',447617],MI:['relation',7432173],CSK:['relation',60961],DC:null,LSG:['relation',7418678],SRH:['relation',8441637],GT:['relation',10756555],RR:['relation',9099580],PBKS:['relation',13157699]};
const contains=(ring,x=0,z=0)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [a,b]=ring[i],[c,d]=ring[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)yes=!yes;}return yes;};
function hull(points) {
  const p=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower=[],upper=[];
  for(const v of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),v)<=0)lower.pop();lower.push(v);}
  for(const v of p.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),v)<=0)upper.pop();upper.push(v);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function radial(ring,a){const dx=Math.sin(a),dz=Math.cos(a),hits=[];for(let i=0;i<ring.length;i++){const [x,z]=ring[i],[u,v]=ring[(i+1)%ring.length],ex=u-x,ez=v-z,den=dx*ez-dz*ex;if(Math.abs(den)<1e-9)continue;const t=(x*ez-z*ex)/den,s=(x*dz-z*dx)/den;if(t>0&&s>=0&&s<=1)hits.push(t);}return Math.min(...hits);}
const layouts={};
for(const [team,ref] of Object.entries(ids)) {
  const map=JSON.parse(await readFile(new URL(`../public/stadiums/maps/${team}.json`,import.meta.url)));
  const source=JSON.parse(await readFile(new URL(`../public/stadiums/maps/${team}.source.json`,import.meta.url)));
  const nodes=new Map(source.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
  const ways=new Map(source.elements.filter(e=>e.type==='way').map(e=>[e.id,e]));
  const project=id=>{const n=nodes.get(id);if(!n)throw new Error(`${team}: missing node ${id}`);return [(n.lon-map.center[1])*111320*Math.cos(map.center[0]*Math.PI/180),(map.center[0]-n.lat)*111320];};
  const ground=map.features.find(f=>f.id===map.originPitchWay)?.points;
  if(!ground||!contains(ground)) throw new Error(`${team}: missing centred playing area`);
  let outer,method='mapped-building-ring',refs=[];
  if(ref) {
    const relation=source.elements.find(e=>e.type===ref[0]&&e.id===ref[1]);
    const parts=(relation?.members??[]).filter(m=>m.type==='way'&&m.role==='outer').map(m=>ways.get(m.ref)?.nodes?.slice()).filter(Boolean);
    const loops=[];
    while(parts.length) {
      const loop=parts.shift();let progress=true;
      while(loop[0]!==loop.at(-1)&&progress){progress=false;for(let i=0;i<parts.length;i++){let p=parts[i];if(p.at(-1)===loop.at(-1))p=p.slice().reverse();if(p[0]===loop.at(-1)){loop.push(...p.slice(1));parts.splice(i,1);progress=true;break;}}}
      if(loop[0]===loop.at(-1)) loops.push(loop.map(project));
    }
    outer=loops.filter(r=>contains(r)).sort((a,b)=>Math.abs(radial(a,0))-Math.abs(radial(b,0)))[0];
    if(outer) refs=[`${ref[0]}/${ref[1]}`];
  }
  if(!outer) {
    // Delhi's neighbouring rectangular sports buildings carry the same tag.
    // Only these three ways describe the cricket bowl around the origin.
    const stands=map.features.filter(f=>f.tags.building==='stadium'&&(team==='DC'?[464253922,464253923,464253924].includes(f.id):f.points.every(p=>Math.hypot(...p)<180)));
    if(!stands.length) throw new Error(`${team}: no usable outer envelope`);
    outer=hull(stands.flatMap(f=>f.points));method='inferred-hull-of-mapped-stands';refs=stands.map(f=>`way/${f.id}`);
  }
  const groundR=[],outerR=[];
  for(let i=0;i<180;i++) {
    const g=radial(ground,i/180*Math.PI*2),o=radial(outer,i/180*Math.PI*2);
    if(!Number.isFinite(g+o)||g<35||g>115||o<g+4||o>250)throw new Error(`${team}: invalid ray ${i}: ${g}/${o}`);
    groundR.push(Math.round(g*100)/100);outerR.push(Math.round(o*100)/100);
  }
  const bounds=ring=>[Math.min(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[1]))].map(n=>Math.round(n*100)/100);
  layouts[team]={groundR,outerR,groundBounds:bounds(ground),outerBounds:bounds(outer),center:map.center,groundSource:`way/${map.originPitchWay}`,outerSources:refs,outerMethod:method,sourceDate:map.fetchedAt,units:'metres; X east, Z south',license:'ODbL-1.0'};
  console.log(team,method,'field bounds',bounds(ground),'outer bounds',bounds(outer));
}
await writeFile(new URL('../public/stadiums/maps/layouts.json',import.meta.url),JSON.stringify(layouts));
