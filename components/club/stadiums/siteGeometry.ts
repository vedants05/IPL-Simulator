import layouts from '../../../public/stadiums/maps/layouts.json';
import type { StadiumDefinition, TeamId } from './definitions';
import type { ViewerModule } from './types';
import { STAND_DESIGNS } from '../stadiumVisualDesigns';

export const TAU = Math.PI * 2;
export const ROW_RUN = .8;
export const ROW_RISE = .43;
export const STAND_FRONT = 47; // Template-domain coordinate, not metres from centre.
export const PITCH_LENGTH = 20.12;
export const PITCH_WIDTH = 3.05;

// Saved builder topology, not a claim that these are surveyed architectural tiers.
// Fixed reference slots must never be inferred from the upgraded modules.
const baselineGroups: Record<TeamId, readonly (readonly [number, number])[]> = {
  KKR:[[2,2],[2,2],[2,2],[3,3],[3,3],[3,2],[2,2],[2,2],[1,1],[1,1],[1,2],[2,2]],
  CSK:[[2,2],[3,2],[3,2],[3,2],[5,1],[5,2],[3,1]],
  DC:[[24,2]], GT:[[24,2]],
  MI:[[18,2],[6,1]], PBKS:[[18,2],[6,1]], RCB:[[18,2],[6,1]],
  RR:[[15,2],[6,1],[3,2]], SRH:[[24,2]], LSG:[[6,2],[9,3],[3,2],[6,1]],
};
export function siteLayout(teamId: TeamId) { return layouts[teamId]; }
export function venueVisualModule(def:StadiumDefinition, entry:ViewerModule):ViewerModule {
  if(entry.visualTemplateId&&STAND_DESIGNS[entry.visualTemplateId]) return {...entry,templateId:entry.visualTemplateId};
  // The legacy GT seed used the four-tier capacity template for its enormous
  // original bowl. Populous documents two architectural tiers. Correct only
  // identifiable, untouched 2020 baseline sections; later builds retain their
  // chosen template. Never rewrite the save or reduce its capacity.
  if(def.teamId==='GT'&&entry.constructionYear===2020&&entry.templateId==='four-grandstand'&&/^(East|North|West|South) Bowl$/.test(entry.standName)) return {...entry,templateId:'standard-two'};
  return entry;
}
export function radialSample(values: readonly number[], angle: number): number {
  const position = ((angle % TAU + TAU) % TAU) / TAU * values.length;
  const index = Math.floor(position), fraction = position - index;
  return values[index % values.length] * (1 - fraction) + values[(index + 1) % values.length] * fraction;
}
export function siteRadii(def: StadiumDefinition, angle: number) {
  const site = siteLayout(def.teamId);
  return { ground: radialSample(site.groundR, angle), outer: radialSample(site.outerR, angle) };
}
// Clockwise slots in the old SVG start at the top. Geographic +Z is south,
// so the plan is explicitly south-up; geometry and section IDs share one frame.
export function moduleAngle(index: number, count: number): number { return -(index + .5) / Math.max(1, count) * TAU; }
export function moduleIndexAt(angle: number, count: number): number {
  return Math.min(Math.max(0,count-1), Math.floor(((-angle % TAU + TAU) % TAU) / TAU * count));
}
export function baseTiersAt(def: StadiumDefinition, index: number, count: number): number {
  const slot = Math.floor(index / Math.max(1,count) * 24);
  let end=0;
  for (const [size,tiers] of baselineGroups[def.teamId]) { end+=size; if(slot<end) return tiers; }
  return 2;
}
export function templateRear(def: StadiumDefinition, tiers: number): number {
  return STAND_FRONT + tiers * def.rows * ROW_RUN + (tiers - 1) * 1.1;
}
export function sectionDefinition(def: StadiumDefinition, index: number, count: number): StadiumDefinition {
  const tiers=baseTiersAt(def,index,count), slot=Math.floor(index/Math.max(1,count)*24);
  let first=0,size=1;
  for(const [groupSize] of baselineGroups[def.teamId]) {size=groupSize;if(slot<first+size) break;first+=size;}
  // Linked original sections share row elevations. A neighbouring upgrade
  // cannot alter this permanent reference frame.
  let depth=0;
  for(let i=first;i<first+size;i++) {const r=siteRadii(def,moduleAngle(i,24));depth+=r.outer-r.ground;}
  depth/=size;
  // Fit standard row spacing to mapped depth. Heights remain estimates where
  // no architectural section exists. Save capacity is never derived from seats.
  const rows=Math.max(10,Math.min(48,Math.round((depth-3-3-(tiers-1)*1.1)/(tiers*ROW_RUN))));
  const referenceDepth=tiers*rows*ROW_RUN+(tiers-1)*1.1+3; // includes rear concourse
  return {...def,rows,sectionReferenceDepth:referenceDepth};
}
export function metricRadius(def: StadiumDefinition, radius: number, angle: number): number {
  const {ground,outer}=siteRadii(def,angle);
  if(radius<=44) return ground*radius/44;
  if(radius<=STAND_FRONT) return ground+radius-44;
  const reference=def.sectionReferenceDepth ?? (2*def.rows*ROW_RUN+1.1+3);
  const depth=outer-ground-3;
  // Above-baseline additions extend only their own sections, not the field,
  // neighbouring stands or map. Extra metres beyond the envelope stay metres.
  const distance=radius-STAND_FRONT;
  return ground+3+(distance<=reference?distance/reference*depth:depth+distance-reference);
}
export function sectionDefinitions(def:StadiumDefinition, modules:readonly ViewerModule[]):StadiumDefinition[] {
  const frames=modules.map((_,i)=>sectionDefinition(def,i,modules.length));
  const groups=new Map<string,number[]>();
  modules.forEach((entry,i)=>{
    if(entry.empty) return;
    const key=JSON.stringify([entry.standName,entry.templateId]);
    const indices=groups.get(key)??[];indices.push(i);groups.set(key,indices);
  });
  for(const indices of Array.from(groups.values())) {
    // A replacement spanning original stand boundaries gets continuous tier
    // levels and a shared radial mapping. Other stands keep their own frames.
    const rows=Math.round(indices.reduce((sum,i)=>sum+frames[i].rows,0)/indices.length);
    const referenceDepth=indices.reduce((sum,i)=>sum+frames[i].sectionReferenceDepth!,0)/indices.length;
    indices.forEach(i=>{frames[i]={...frames[i],rows,sectionReferenceDepth:referenceDepth};});
  }
  return frames;
}
export function templateRadiusForMetres(def:StadiumDefinition, metres:number, angle:number):number {
  const {ground,outer}=siteRadii(def,angle);
  if(metres<=ground) return metres/ground*44;
  if(metres<=ground+3) return 44+metres-ground;
  const reference=def.sectionReferenceDepth??(2*def.rows*ROW_RUN+1.1+3);
  return 47+(metres<=outer?(metres-ground-3)/(outer-ground-3)*reference:reference+metres-outer);
}
export function footprintPoint(def: StadiumDefinition, radius: number, angle: number, y=0): [number,number,number] {
  const r=metricRadius(def,radius,angle);
  return [Math.sin(angle)*r,y,Math.cos(angle)*r];
}
export function surfaceYaw(def: StadiumDefinition, radius: number, angle: number): number {
  const a=footprintPoint(def,radius,angle-.002),b=footprintPoint(def,radius,angle+.002);
  return Math.atan2(-(b[2]-a[2]),b[0]-a[0]);
}
export function stadiumExtent(def: StadiumDefinition, modules: readonly ViewerModule[]): number {
  let extent=Math.max(...siteLayout(def.teamId).outerR)+15;
  const frames=sectionDefinitions(def,modules);
  modules.forEach((entry,index)=>{
    if(entry.empty) return;
    const section=frames[index], tiers=(STAND_DESIGNS[venueVisualModule(def,entry).templateId]??STAND_DESIGNS['standard-two']).tiers;
    for(const offset of [-.48,0,.48]) extent=Math.max(extent,metricRadius(section,templateRear(section,tiers)+12,moduleAngle(index,modules.length)+offset*TAU/modules.length));
  });
  return extent;
}
