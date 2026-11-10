import type { CuratorPitch } from "@/lib/data/pitchCurator";
import { derivePitchMetrics, type PitchSliderSettings, type PitchSoil } from "./pitchCreator";

export type PreparationLevel = "none" | "light" | "standard" | "heavy";
export type GrassSetting = "short" | "medium" | "long";
export type PreparationPreset = "balanced" | "batting" | "seam" | "spin" | "manual" | "delegate";
export interface PitchPreparationPlan { rolling: PreparationLevel; watering: PreparationLevel; grass: GrassSetting; preset: PreparationPreset; }
export interface PitchPreparation { rolling?: number; watering?: number; cutting?: number; lastActionDate?: string; plan?: PitchPreparationPlan; startedOn?: string; matchDate?: string; }
export type PitchPreparations = Record<string, PitchPreparation>;

export const PREPARATION_PRESETS: Record<Exclude<PreparationPreset, "manual">, PitchPreparationPlan> = {
  balanced: { preset: "balanced", rolling: "standard", watering: "light", grass: "medium" },
  batting: { preset: "batting", rolling: "heavy", watering: "light", grass: "short" },
  seam: { preset: "seam", rolling: "light", watering: "standard", grass: "long" },
  spin: { preset: "spin", rolling: "light", watering: "none", grass: "short" },
  delegate: { preset: "delegate", rolling: "standard", watering: "light", grass: "medium" },
};
const clamp = (n: number, low = 1, high = 10) => Math.max(low, Math.min(high, n));
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000));

function baseCondition(pitch: CuratorPitch): { soil: PitchSoil; sliders: PitchSliderSettings } {
  const custom = pitch as CuratorPitch & { soil?: PitchSoil; sliders?: PitchSliderSettings };
  if (custom.sliders && custom.soil) return { soil: custom.soil, sliders: { ...custom.sliders } };
  const label = `${pitch.name} ${pitch.type} ${pitch.characteristics.join(" ")}`.toLowerCase();
  const spin = pitch.favours.includes("spin-bowlers");
  const seam = pitch.favours.includes("pace-bowlers") || /green|seam/.test(label);
  const flat = /flat|belter|highway|batting/.test(label);
  return { soil: /black/.test(label) || spin ? "black" : "red", sliders: { compaction: flat ? 8 : 6, grassCover: seam ? 7 : spin ? 3 : 5, moisture: seam ? 7 : spin ? 3 : 5, surfaceWear: spin ? 6 : 3, consistency: flat ? 8 : 7 } };
}

export function pitchCondition(pitch: CuratorPitch, prep?: PitchPreparation, date?: string): { soil: PitchSoil; sliders: PitchSliderSettings } {
  const base = baseCondition(pitch);
  const s = { ...base.sliders };
  s.compaction = clamp(s.compaction + (prep?.rolling ?? 0));
  s.moisture = clamp(s.moisture + (prep?.watering ?? 0));
  s.grassCover = clamp(s.grassCover - (prep?.cutting ?? 0));
  if (!prep?.plan) {
    // Convert old saved counters into an equivalent starting condition.
    return { soil: base.soil, sliders: s };
  }
  const plan = prep.plan;
  const elapsed = prep.startedOn && date ? Math.min(7, daysBetween(prep.startedOn, date)) : 0;
  const roll = { none: 0, light: 0.6, standard: 1.2, heavy: 2 }[plan.rolling];
  const water = { none: 0, light: 1, standard: 2, heavy: 3 }[plan.watering];
  const effectiveness = Math.min(1, (elapsed + 1) / 3);
  s.moisture = clamp(s.moisture + water * effectiveness - elapsed * 0.25);
  const rollSuitability = clamp(1 - Math.abs(s.moisture - 5.5) * 0.12, 0.35, 1);
  s.compaction = clamp(s.compaction + roll * effectiveness * rollSuitability);
  if (plan.rolling === "heavy" && s.moisture >= 8) s.consistency = clamp(s.consistency - 0.8 * effectiveness);
  const grassTarget = { short: 2, medium: 5, long: 8 }[plan.grass];
  s.grassCover = grassTarget < s.grassCover ? grassTarget : Math.min(grassTarget, s.grassCover + elapsed * 0.3);
  s.surfaceWear = clamp(s.surfaceWear - elapsed * 0.08);
  return { soil: base.soil, sliders: s };
}

export function applyPitchPreparation(pitch: CuratorPitch, prep?: PitchPreparation, date?: string): CuratorPitch {
  if (!prep) return pitch;
  const baseline = baseCondition(pitch);
  const condition = pitchCondition(pitch, prep, date);
  const before = derivePitchMetrics(baseline.soil, baseline.sliders);
  const after = derivePitchMetrics(condition.soil, condition.sliders);
  // Reward an even, firm surface, but retain the bowling difficulty created by
  // seam, grip and an exposed dry surface. Compare against the pitch's own
  // baseline so stadium identity is never replaced by a generic preset.
  const s = condition.sliders, original = baseline.sliders;
  const seamPressure = (s.grassCover * s.moisture - original.grassCover * original.moisture) / 15;
  const dryGrip = (grass: number, moisture: number) => (10 - grass) * (10 - moisture) / 18;
  const spinPressure = dryGrip(s.grassCover, s.moisture) - dryGrip(original.grassCover, original.moisture);
  const shift = Math.round(clamp((after.battingEase - before.battingEase) * 3 - seamPressure * 3 - spinPressure * (baseline.soil === 'black' ? 9 : 7), -18, 18));
  const favours = new Set(pitch.favours), disadvantages = new Set(pitch.doesNotFavour);
  if (after.seamMovement - before.seamMovement >= 0.5 || seamPressure >= 0.6) { favours.add("pace-bowlers"); disadvantages.delete("pace-bowlers"); }
  if (after.spinGrip - before.spinGrip >= 0.5 || spinPressure >= 0.5) { favours.add("spin-bowlers"); disadvantages.delete("spin-bowlers"); }
  if (after.battingEase - before.battingEase >= 0.7) { favours.add("controlled-batters"); disadvantages.delete("controlled-batters"); }
  return { ...pitch, favours: Array.from(favours), doesNotFavour: Array.from(disadvantages), expectedFirstInningsScore: { min: pitch.expectedFirstInningsScore.min + shift, max: pitch.expectedFirstInningsScore.max + shift } };
}
