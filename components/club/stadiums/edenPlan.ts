import { EDEN_REGIONS } from './edenModules';
import type { ViewerModule } from './types';

// Matches the imported model's coordinates, not the old procedural bowl.
const slots = Object.entries(EDEN_REGIONS).flatMap(([name,r]) => r.ids.map((id,i) => ({
  id, name, axis:r.axis,
  start:r.start+(r.end-r.start)*i/r.ids.length,
  end:r.start+(r.end-r.start)*(i+1)/r.ids.length,
})));
export const edenSlot = (id:number) => slots.find(slot => slot.id === id);
const rear: Record<string,number> = {Stand_B:130,Stand_C:130,Stand_D:118,Stand_E:114,Stand_F:119,Stand_G:121,Stand_H:119,Stand_J:113,Stand_K:128,Stand_L:128};

export function createEdenPlan(modules:readonly ViewerModule[]) {
  const scale=176/134;
  const point=(x:number,z:number):[number,number] => [200-x*scale,200-z*scale];
  const path=(points:readonly (readonly number[])[],closed=false) => points.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')+(closed?' Z':'');
  const edge=(index:number,fraction:number) => {
    const slot=edenSlot(modules[index]?.id);
    if(!slot) return [];
    if(slot.axis==='x') {
      const z=slot.name==='ClubHouse'?80+38*fraction:-92-7*fraction;
      return [point(slot.start,z),point(slot.end,z)];
    }
    return Array.from({length:13},(_,i)=>{
      const a=slot.start+(slot.end-slot.start)*i/12;
      const front=1/Math.sqrt((Math.sin(a)/76)**2+(Math.cos(a)/82)**2);
      const r=front+((rear[slot.name]??119)-front)*fraction;
      return point(r*Math.sin(a),-r*Math.cos(a));
    });
  };
  const ellipse=(x:number,z:number) => path(Array.from({length:129},(_,i)=>{const a=i/128*Math.PI*2;return point(x*Math.sin(a),z*Math.cos(a));}),true);
  return {
    scale,
    section:(index:number) => path([...edge(index,0),...edge(index,1).reverse()],true),
    detail:(index:number,radius:number) => path(edge(index,Math.max(0,Math.min(1,(radius-116)/56)))),
    connector:(_index:number) => '',
    field:ellipse(74,80), boundary:ellipse(68,74),
    label:(indices:readonly number[]) => {
      const points=indices.flatMap(index=>edge(index,.6));
      return {x:points.reduce((sum,p)=>sum+p[0],0)/Math.max(1,points.length),y:points.reduce((sum,p)=>sum+p[1],0)/Math.max(1,points.length)};
    },
  };
}

// The two legacy north-recess slots are not adjacent to L/ClubHouse in the GLB.
export function edenSelectionContiguous(ids:readonly number[]):boolean {
  if(ids.length<2) return true;
  if(ids.some(id=>id>=22)) return ids.every(id=>id===22||id===23);
  const sorted=[...ids].sort((a,b)=>a-b);
  return sorted.filter((id,i)=>(sorted[(i+1)%sorted.length]-id+22)%22>1).length<=1;
}
