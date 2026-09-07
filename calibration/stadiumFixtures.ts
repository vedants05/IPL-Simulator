import { getStadiumDefinition } from '../components/club/stadiums/definitions';
import type { ViewerModule } from '../components/club/stadiums/types';
export function previewModules(teamId: string): ViewerModule[] {
  const def = getStadiumDefinition(teamId);
  if (teamId === 'KKR') {
    const groups: [string,number,string,string,number][] = [
      ['B.C. Roy Club House',2,'pavilion','Full roof',1970],['B Stand',2,'compact-two','Partial canopy',1987],
      ['C Stand',2,'standard-two','Partial canopy',1987],['D Stand',3,'large-three','Full roof',1993],
      ['E Stand',3,'large-three','Full roof',1993],['F Stand',3,'standard-two','Partial canopy',1987],
      ['G Stand',2,'standard-two','Partial canopy',1987],['H Stand',2,'compact-two','Partial canopy',1987],
      ['J Stand',1,'covered-tier','Partial canopy',1987],['K Stand',1,'covered-tier','Partial canopy',1987],
      ['L Stand',1,'heritage','Full roof',1967],['High Court Pavilion',2,'pavilion','Full roof',1970],
    ];
    let id = 0;
    return groups.flatMap(([standName,count,templateId,roof,constructionYear])=>Array.from({length:count},()=>({id:id++,standName,templateId,roof,constructionYear,capacity:2500,condition:78,quality:'Modern'})));
  }
  return Array.from({length:24},(_,id)=>({id,standName:`Group ${Math.floor(id/3)+1}`,templateId:def.templates[Math.floor(id/3)],roof:def.roofs[Math.floor(id/3)],capacity:2000,condition:85,constructionYear:2022,quality:'Modern'}));
}
