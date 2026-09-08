import { footprintPoint, moduleAngle, sectionDefinition, sectionDefinitions, surfaceYaw, venueVisualModule } from './siteGeometry';
import { STAND_DESIGNS } from '../stadiumVisualDesigns';
import type { StadiumDefinition } from './definitions';
import type { ViewerModule } from './types';

export type CameraMode='overview'|'ground'|'seat'|'concourse'|'balcony'|'entrance';
export function inspectionPosition(venue:StadiumDefinition,modules:readonly ViewerModule[],selected:readonly number[],mode:CameraMode) {
  const index=Math.max(0,modules.findIndex(module=>module.id===selected[selected.length-1]));
  const def=sectionDefinitions(venue,modules.map(entry=>venueVisualModule(venue,entry)))[index]??sectionDefinition(venue,index,modules.length);
  const module=modules[index]?venueVisualModule(venue,modules[index]):undefined;
  const tiers=(STAND_DESIGNS[module?.templateId??'']??STAND_DESIGNS['standard-two']).tiers;
  const angle=moduleAngle(index,modules.length);
  const tier=Math.min(1,tiers-1), base=1+tier*(def.rows*.43+def.tierGap);
  const rear=47+(tiers-1)*(def.rows*.8+1.1)+def.rows*.8;
  const upper=1+(tiers-1)*(def.rows*.43+def.tierGap);
  const radius=mode==='entrance'?rear+9:mode==='concourse'?rear+2.5:mode==='balcony'?47+tier*(def.rows*.8+1.1)-2:47+tier*(def.rows*.8+1.1)+1.6;
  const y=mode==='entrance'?2:mode==='concourse'?upper+1.6:mode==='balcony'?base+1.8:base+2.5;
  // Offset from the centre aisle so the seated inspection does not enter a portal.
  const a=angle+(mode==='seat'?.065:0);
  return {position:footprintPoint(def,radius,a,y), angle:a, facingAngle:mode==='concourse'?surfaceYaw(def,radius,a)+Math.PI/2:a+Math.PI};
}
