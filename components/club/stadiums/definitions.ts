// Art-direction presets, NOT surveyed architectural models or gameplay data.
export type TeamId = 'KKR' | 'RCB' | 'MI' | 'CSK' | 'DC' | 'LSG' | 'SRH' | 'GT' | 'RR' | 'PBKS';
export type StadiumRoof = 'None' | 'Partial canopy' | 'Full roof' | 'Cantilever' | 'Landmark roof';
export interface StadiumDefinition {
  teamId: TeamId;
  name: string;
  footprint: { x: number; z: number; exponent: number };
  seats: readonly string[];
  fascia: string;
  roofColor: string;
  concrete: string;
  roofProfile: 'flat' | 'wave' | 'petal';
  lights: 'mast' | 'ring';
  mastCount: number;
  mastHeight: number;
  // Eight groups of three sections, matching the existing non-KKR builder.
  templates: readonly string[];
  roofs: readonly StadiumRoof[];
  rows: number;
  tierGap: number;
  screenAngles: readonly number[];
}
const standard = ['pavilion', 'standard-two', 'standard-two', 'standard-two', 'standard-two', 'standard-two', 'corporate', 'media'];
const covered: StadiumRoof[] = ['Full roof', 'Partial canopy', 'Partial canopy', 'Full roof', 'Partial canopy', 'Partial canopy', 'Full roof', 'Full roof'];
function venue(teamId: TeamId, name: string, overrides: Partial<Omit<StadiumDefinition, 'teamId' | 'name'>>): StadiumDefinition {
  return { teamId, name, footprint: { x: 1, z: 1, exponent: 2 }, seats: ['#4386b0', '#e5b864'], fascia: '#234964', roofColor: '#e7e6de', concrete: '#c3bfb3', roofProfile: 'flat', lights: 'mast', mastCount: 4, mastHeight: 34, templates: standard, roofs: covered, rows: 12, tierGap: 2.3, screenAngles: [0, Math.PI], ...overrides };
}
export const STADIUMS: Record<TeamId, StadiumDefinition> = {
  KKR: venue('KKR', 'Eden Gardens', { footprint: { x: 1.04, z: 1.08, exponent: 2.05 }, seats: ['#6398b4', '#d6b56a', '#87a5bb', '#b77859'], fascia: '#51276b', roofProfile: 'flat', mastHeight: 39 }),
  RCB: venue('RCB', 'M. Chinnaswamy Stadium', { footprint: { x: .96, z: 1.04, exponent: 2.4 }, seats: ['#bd343d', '#e5c169', '#6997b9'], fascia: '#a32d3c', roofColor: '#e4e7e7', templates: ['pavilion', 'compact-two', 'standard-two', 'compact-two', 'standard-two', 'compact-two', 'corporate', 'media'], mastHeight: 32 }),
  MI: venue('MI', 'Wankhede Stadium', { footprint: { x: .99, z: 1.09, exponent: 2.1 }, seats: ['#328bcb', '#79bae0'], fascia: '#176bb1', roofProfile: 'wave', roofs: ['Full roof', 'Cantilever', 'Cantilever', 'Cantilever', 'Cantilever', 'Cantilever', 'Full roof', 'Full roof'], mastHeight: 35 }),
  CSK: venue('CSK', 'M. A. Chidambaram Stadium', { footprint: { x: 1.07, z: 1.02, exponent: 2.15 }, seats: ['#e9bf38', '#f1d777'], fascia: '#d9aa26', roofProfile: 'petal', roofs: ['Full roof', 'Landmark roof', 'Landmark roof', 'Landmark roof', 'Landmark roof', 'Landmark roof', 'Full roof', 'Full roof'] }),
  DC: venue('DC', 'Arun Jaitley Stadium', { footprint: { x: .97, z: 1.08, exponent: 2.65 }, seats: ['#317cb2', '#d06c47', '#e5bb64'], fascia: '#204d95', templates: ['pavilion', 'large-three', 'compact-two', 'standard-two', 'covered-tier', 'standard-two', 'corporate', 'media'], concrete: '#bcb8aa' }),
  LSG: venue('LSG', 'BRSABV Ekana Cricket Stadium', { footprint: { x: 1.07, z: 1.13, exponent: 2.05 }, seats: ['#be4d41', '#5485b7', '#e4c084'], fascia: '#204e85', roofProfile: 'wave', rows: 15, roofs: ['Full roof', 'Cantilever', 'Cantilever', 'Cantilever', 'Cantilever', 'Cantilever', 'Full roof', 'Full roof'], mastHeight: 40 }),
  SRH: venue('SRH', 'Rajiv Gandhi International Cricket Stadium', { footprint: { x: 1.09, z: 1.1, exponent: 2.05 }, seats: ['#58a4c5', '#e39b51', '#8eb6c6'], fascia: '#d36b29', templates: ['pavilion', 'standard-two', 'covered-tier', 'standard-two', 'covered-tier', 'standard-two', 'corporate', 'media'], mastCount: 6, mastHeight: 37 }),
  GT: venue('GT', 'Narendra Modi Stadium', { footprint: { x: 1.16, z: 1.22, exponent: 2 }, seats: ['#e0924f', '#e8ac66', '#668eae'], fascia: '#254859', lights: 'ring', mastCount: 0, rows: 22, tierGap: 4.4, roofProfile: 'wave', templates: ['pavilion', 'standard-two', 'standard-two', 'standard-two', 'standard-two', 'standard-two', 'corporate', 'media'], roofs: Array<StadiumRoof>(8).fill('Cantilever') }),
  RR: venue('RR', 'Sawai Mansingh Stadium', { footprint: { x: 1.12, z: 1.1, exponent: 2 }, seats: ['#dfa4b4', '#7198b8', '#e3bb74'], fascia: '#c65a8b', concrete: '#c5b395', templates: ['heritage', 'open-tier', 'open-tier', 'open-tier', 'open-tier', 'covered-tier', 'corporate', 'media'], roofs: ['Full roof', 'None', 'None', 'None', 'None', 'Partial canopy', 'Full roof', 'Full roof'], mastHeight: 30 }),
  PBKS: venue('PBKS', 'Maharaja Yadavindra Singh Stadium', { footprint: { x: 1.11, z: 1.08, exponent: 2.2 }, seats: ['#bc4b45', '#8caabf', '#e0b57f'], fascia: '#af3038', roofProfile: 'petal', templates: ['pavilion', 'standard-two', 'covered-tier', 'standard-two', 'covered-tier', 'standard-two', 'corporate', 'media'], roofs: ['Full roof', 'Landmark roof', 'Partial canopy', 'Landmark roof', 'Partial canopy', 'Landmark roof', 'Full roof', 'Full roof'], mastHeight: 36 }),
};
export function getStadiumDefinition(teamId = 'KKR'): StadiumDefinition {
  return STADIUMS[teamId.toUpperCase() as TeamId] ?? STADIUMS.KKR;
}
export function getInitialStandAppearance(teamId: string, groupIndex: number) {
  const definition = getStadiumDefinition(teamId);
  const index = Math.max(0, Math.min(7, groupIndex));
  return { templateId: definition.templates[index], roof: definition.roofs[index] };
}
