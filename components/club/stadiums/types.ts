export interface ViewerModule {
  id: number;
  standName: string;
  templateId: string;
  roof: string;
  capacity: number;
  condition: number;
  quality?: string;
  constructionYear?: number;
  hospitalityBoxes?: number;
  empty?: boolean;
}
export interface ViewerProject {
  phase: string;
  action: string;
  templateId: string;
  roof: string;
  quality: string;
}
export interface StadiumViewerProps {
  teamId?: string;
  modules: ViewerModule[];
  selected: number[];
  activeModuleIds?: number[];
  project?: ViewerProject | null;
  onToggleModule: (id: number) => void;
}
export type DetailLevel = 'low' | 'medium';
export function resolveVisualModule(entry: ViewerModule, activeIds: readonly number[], project?: ViewerProject | null): { entry: ViewerModule; active: boolean } {
  const active = activeIds.includes(entry.id) && Boolean(project && !['completed', 'cancelled'].includes(project.phase));
  if (!active || !project) return { entry, active: false };
  if (project.phase === 'cleared') return { entry: { ...entry, empty: true }, active };
  if (project.phase === 'construction' && project.action !== 'demolish') {
    return { entry: { ...entry, empty: false, templateId: project.action === 'refurbish' ? entry.templateId : project.templateId, roof: project.roof, quality: project.quality }, active };
  }
  return { entry, active };
}
