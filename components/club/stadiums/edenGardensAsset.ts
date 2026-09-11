import type { CameraMode } from './inspectionCamera';

export const EDEN_MODEL_URLS = {
  detail: '/stadiums/models/eden-gardens/eden-gardens-lod2.glb',
  overview: '/stadiums/models/eden-gardens/eden-gardens-lod3.glb',
} as const;

export const EDEN_CAMERA_PRESETS: Partial<Record<CameraMode, {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  context: boolean;
}>> = {
  broadcast: { position: [240, 220, 340], target: [0, 8, 12], fov: 48, context: true },
  pavilionRoad: { position: [30, 27, 220], target: [0, 12, 117], fov: 48, context: true },
  maidan: { position: [-360, 180, 420], target: [0, 12, 0], fov: 50, context: true },
  river: { position: [-520, 150, -120], target: [0, 15, 0], fov: 42, context: true },
  construction: { position: [135, 150, 175], target: [0, 10, 0], fov: 46, context: false },
};
