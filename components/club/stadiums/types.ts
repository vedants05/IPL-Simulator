export interface ViewerModule {
  id: number;
  standName: string;
  templateId: string;
  visualTemplateId?: string;
  roof: string;
  capacity: number;
  condition: number;
  quality?: string;
  constructionYear?: number;
  hospitalityBoxes?: number;
  empty?: boolean;
}
export interface ViewerProject {
  startedOn?: string;
  constructionStartsOn?: string;
  constructionCompletesOn?: string;
  demolitionCompletesOn?: string;
  phase: string;
  action: string;
  templateId: string;
  roof: string;
  quality: string;
}
export interface StadiumViewerProps {
  currentDate?: string;
  teamId?: string;
  modules: ViewerModule[];
  selected: number[];
  activeModuleIds?: number[];
  project?: ViewerProject | null;
  onToggleModule: (id: number) => void;
}
export type DetailLevel = 'low' | 'medium' | 'high';
export function constructionProgress(project?: ViewerProject | null, currentDate?: string): number {
  if (!project || !currentDate) return .5;
  const demolition=project.phase==='demolition';
  const start=Date.parse((demolition?project.startedOn:project.constructionStartsOn??project.startedOn)??'');
  const end=Date.parse((demolition?project.demolitionCompletesOn:project.constructionCompletesOn)??'');
  const now=Date.parse(currentDate);
  return Number.isFinite(start+end+now)&&end>start?Math.max(0,Math.min(1,(now-start)/(end-start))):.5;
}
export function resolveVisualModule(entry: ViewerModule, activeIds: readonly number[], project?: ViewerProject | null): { entry: ViewerModule; active: boolean } {
  const active = activeIds.includes(entry.id) && Boolean(project && !['completed', 'cancelled'].includes(project.phase));
  if (!active || !project) return { entry, active: false };
  if (project.phase === 'cleared') return { entry: { ...entry, empty: true }, active };
  if (project.phase === 'construction' && project.action !== 'demolish') {
    return { entry: { ...entry, empty: false, templateId: project.action === 'refurbish' ? entry.templateId : project.templateId, roof: project.roof, quality: project.quality }, active };
  }
  return { entry, active };
}
