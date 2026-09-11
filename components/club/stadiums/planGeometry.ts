import type { StadiumDefinition } from './definitions';
import type { ViewerModule } from './types';
import { createEdenPlan } from './edenPlan';
import { STAND_DESIGNS } from '../stadiumVisualDesigns';
import { footprintPoint, moduleAngle, sectionDefinitions, stadiumExtent, templateRear, venueVisualModule, TAU } from './siteGeometry';

/** Same immutable slots as the 3D renderer; south-up matches the legacy plan. */
export function createStadiumPlan(def:StadiumDefinition, modules:readonly ViewerModule[]) {
  if(def.teamId==='KKR') return createEdenPlan(modules);
  const scale=176/stadiumExtent(def,modules),count=Math.max(1,modules.length),step=TAU/count;
  const frames=sectionDefinitions(def,modules.map(entry=>venueVisualModule(def,entry)));
  const tiers=(i:number)=>(STAND_DESIGNS[venueVisualModule(def,modules[i]).templateId]??STAND_DESIGNS['standard-two']).tiers;
  const rear=(i:number)=>templateRear(frames[i],modules[i].empty?1:tiers(i))+3;
  const point=(frame:StadiumDefinition,r:number,a:number):[number,number]=>{
    const [x,,z]=footprintPoint(frame,r,a);return [200-x*scale,200-z*scale];
  };
  const path=(points:readonly (readonly number[])[],close=false)=>points.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')+(close?' Z':'');
  const arc=(frame:StadiumDefinition,r:number,start:number,sweep:number,cuts=12)=>Array.from({length:cuts+1},(_,i)=>point(frame,r,start+sweep*i/cuts));
  const section=(index:number)=>{
    const frame=frames[index],angle=moduleAngle(index,count),gap=.009,start=angle-step/2+gap,sweep=step-2*gap;
    return path([...arc(frame,rear(index),start,sweep),...arc(frame,47,start+sweep,-sweep)],true);
  };
  const detail=(index:number,radius:number)=>{
    // Compatibility with existing SVG tier/roof decoration inputs.
    const fraction=radius>=170?1:Math.max(0,Math.min(1,(radius-116)/56));
    return path(arc(frames[index],47+(rear(index)-47)*fraction,moduleAngle(index,count)-step/2+.012,step-.024));
  };
  const connector=(index:number)=>{
    const next=(index+1)%count,angle=-(index+1)*step;
    return path([point(frames[index],47,angle+.012),point(frames[index],rear(index),angle+.012),point(frames[next],rear(next),angle-.012),point(frames[next],47,angle-.012)],true);
  };
  return {
    scale,section,detail,connector,
    field:path(arc(def,44,0,TAU,180),true),boundary:path(arc(def,40.2,0,TAU,180),true),
    label:(indices:readonly number[])=>{
      const middle=indices[Math.floor(indices.length/2)]??0,angle=moduleAngle((indices[0]+indices[indices.length-1])/2,count);
      const [x,y]=point(frames[middle],47+(rear(middle)-47)*.64,angle);return {x,y};
    },
  };
}
