import type {
  CuratorPitch,
  HomeStadium,
  IplTeamId,
  PitchPreference,
} from "@/lib/data/pitchCurator";

export const MAX_PITCHES_PER_STADIUM = 5;
export const PITCH_DESTRUCTION_DAYS = 7;
export const PITCH_SELECTION_EMAIL_DAYS = 3;

export type PitchSoil = "red" | "black";
export type PitchUpkeepDifficulty = "standard" | "high" | "extreme";

export interface PitchSliderSettings {
  compaction: number;
  grassCover: number;
  moisture: number;
  surfaceWear: number;
  consistency: number;
}

export interface DerivedPitchMetrics {
  battingEase: number;
  paceCarry: number;
  seamMovement: number;
  spinGrip: number;
  bounce: number;
  deterioration: number;
  consistency: number;
}

export interface CustomCuratorPitch extends CuratorPitch {
  source: "custom";
  teamId: IplTeamId;
  soil: PitchSoil;
  sliders: PitchSliderSettings;
  metrics: DerivedPitchMetrics;
  upkeepDifficulty: PitchUpkeepDifficulty;
  recoveryDays: number;
  creationDays: number;
  createdOn: string;
}

export type PitchProject =
  | {
      id: string;
      kind: "create";
      teamId: IplTeamId;
      startedOn: string;
      completesOn: string;
      pitch: CustomCuratorPitch;
    }
  | {
      id: string;
      kind: "destroy";
      teamId: IplTeamId;
      startedOn: string;
      completesOn: string;
      pitchId: string;
      pitchName: string;
    };

export const DEFAULT_PITCH_SLIDERS: PitchSliderSettings = {
  compaction: 6,
  grassCover: 5,
  moisture: 5,
  surfaceWear: 4,
  consistency: 7,
};

const clamp = (value: number, min = 1, max = 10) => Math.min(max, Math.max(min, value));
const roundedMetric = (value: number) => Math.round(clamp(value) * 10) / 10;

export function normalizePitchSliders(value: Partial<PitchSliderSettings>): PitchSliderSettings {
  return {
    compaction: Math.round(clamp(Number(value.compaction) || DEFAULT_PITCH_SLIDERS.compaction)),
    grassCover: Math.round(clamp(Number(value.grassCover) || DEFAULT_PITCH_SLIDERS.grassCover)),
    moisture: Math.round(clamp(Number(value.moisture) || DEFAULT_PITCH_SLIDERS.moisture)),
    surfaceWear: Math.round(clamp(Number(value.surfaceWear) || DEFAULT_PITCH_SLIDERS.surfaceWear)),
    consistency: Math.round(clamp(Number(value.consistency) || DEFAULT_PITCH_SLIDERS.consistency)),
  };
}

export function derivePitchMetrics(
  soil: PitchSoil,
  rawSliders: Partial<PitchSliderSettings>,
): DerivedPitchMetrics {
  const sliders = normalizePitchSliders(rawSliders);
  const dryness = 11 - sliders.moisture;
  const bareSurface = 11 - sliders.grassCover;
  const red = soil === "red";

  const paceCarry = roundedMetric(
    sliders.compaction * 0.46
      + sliders.consistency * 0.24
      + sliders.grassCover * 0.18
      - sliders.moisture * 0.14
      + (red ? 1.3 : -0.7),
  );
  const seamMovement = roundedMetric(
    sliders.grassCover * 0.4
      + sliders.moisture * 0.32
      + sliders.consistency * 0.12
      - sliders.surfaceWear * 0.08
      + (red ? 0.2 : 0),
  );
  const spinGrip = roundedMetric(
    sliders.surfaceWear * 0.38
      + dryness * 0.28
      + bareSurface * 0.18
      - sliders.compaction * 0.08
      + (red ? -0.3 : 1.3),
  );
  const bounce = roundedMetric(
    sliders.compaction * 0.55
      + sliders.consistency * 0.2
      + sliders.grassCover * 0.1
      - sliders.moisture * 0.1
      + (red ? 1.5 : -0.6),
  );
  const deterioration = roundedMetric(
    sliders.surfaceWear * 0.4
      + dryness * 0.3
      + (11 - sliders.consistency) * 0.15
      + (red ? 0 : 0.8),
  );
  const battingEase = roundedMetric(
    5
      + sliders.compaction * 0.3
      + sliders.consistency * 0.3
      - seamMovement * 0.32
      - spinGrip * 0.42
      - deterioration * 0.2,
  );

  return {
    battingEase,
    paceCarry,
    seamMovement,
    spinGrip,
    bounce,
    deterioration,
    consistency: sliders.consistency,
  };
}

function generatedPitchIdentity(metrics: DerivedPitchMetrics): { name: string; type: string } {
  if (metrics.consistency <= 3) return { name: "Two-Paced Surface", type: "Variable and Uneven" };
  if (metrics.spinGrip >= 8.5) return { name: "Rank Turner", type: "Extreme Spin and Grip" };
  if (metrics.seamMovement >= 8) return { name: "Green Seamer", type: "Grass and Seam Friendly" };
  if (metrics.battingEase <= 3.5 && metrics.deterioration >= 7) return { name: "The Dustbowl", type: "Dry, Worn and Low Scoring" };
  if (metrics.battingEase >= 8.8) return { name: "Highway Belter", type: "Ultra-Flat Batting Track" };
  if (metrics.paceCarry >= 8 && metrics.bounce >= 8) return { name: "Hard Pace Deck", type: "High Pace and Bounce" };
  if (metrics.battingEase >= 7.5) return { name: "Batting Paradise", type: "Flat Batting Track" };
  if (metrics.spinGrip >= 7) return { name: "Dry Turner", type: "Dry and Spin Friendly" };
  if (metrics.paceCarry >= 7) return { name: "Pace Track", type: "Hard and Bouncy" };
  if (metrics.battingEase <= 4.5) return { name: "Low-and-Slow", type: "Slow and Difficult to Time" };
  return { name: "Sporting Track", type: "Balanced Contest" };
}

function generatedPreferences(metrics: DerivedPitchMetrics): {
  favours: PitchPreference[];
  doesNotFavour: PitchPreference[];
} {
  const favours = new Set<PitchPreference>();
  const doesNotFavour = new Set<PitchPreference>();

  if (metrics.battingEase >= 7.5) {
    favours.add("aggressive-batters");
    favours.add("openers");
    favours.add("high-rated-batters");
  } else if (metrics.battingEase <= 5.5) {
    favours.add("controlled-batters");
  }
  if (metrics.battingEase >= 6.5) favours.add("top-order-batters");
  if (metrics.spinGrip >= 7 || metrics.deterioration >= 7) favours.add("middle-order-batters");
  if (metrics.paceCarry >= 7 || metrics.seamMovement >= 7) favours.add("pace-bowlers");
  else if (metrics.paceCarry >= 5.5 || metrics.seamMovement >= 5.5) favours.add("high-rated-pace-bowlers");
  if (metrics.spinGrip >= 6.5) favours.add("spin-bowlers");

  if (metrics.consistency <= 4 || metrics.battingEase <= 4.5) doesNotFavour.add("aggressive-batters");
  if (metrics.seamMovement >= 8) doesNotFavour.add("openers");
  if (metrics.spinGrip >= 8 && metrics.paceCarry <= 5) doesNotFavour.add("pace-bowlers");
  if (metrics.spinGrip <= 3.5) doesNotFavour.add("spin-bowlers");

  favours.forEach((preference) => doesNotFavour.delete(preference));
  return {
    favours: Array.from(favours),
    doesNotFavour: Array.from(doesNotFavour),
  };
}

function generatedCharacteristics(
  soil: PitchSoil,
  metrics: DerivedPitchMetrics,
): string[] {
  const characteristics = [
    `${soil === "red" ? "Red" : "Black"}-soil base`,
  ];
  const ranked = [
    { value: metrics.spinGrip, high: "Heavy grip and turn", low: "Minimal assistance for spin" },
    { value: metrics.paceCarry, high: "Strong pace and carry", low: "Slow pace from the surface" },
    { value: metrics.seamMovement, high: "Pronounced seam movement", low: "Very little seam movement" },
    { value: metrics.bounce, high: "High bounce", low: "Low bounce" },
    { value: metrics.deterioration, high: "Deteriorates quickly", low: "Holds together through the match" },
    { value: metrics.consistency, high: "Consistent surface response", low: "Variable and two-paced response" },
  ].sort((left, right) => Math.abs(right.value - 5.5) - Math.abs(left.value - 5.5));

  ranked.slice(0, 2).forEach((trait) => characteristics.push(trait.value >= 5.5 ? trait.high : trait.low));
  return characteristics;
}

export function calculatePitchCreationDays(
  soil: PitchSoil,
  rawSliders: Partial<PitchSliderSettings>,
): number {
  const sliders = normalizePitchSliders(rawSliders);
  const values = Object.values(sliders);
  const extremeCount = values.filter((value) => value <= 2 || value >= 9).length;
  const conflictingExtremes = (
    (sliders.grassCover >= 8 && sliders.surfaceWear >= 8)
    || (sliders.moisture >= 8 && sliders.surfaceWear >= 8)
    || (sliders.compaction >= 9 && sliders.consistency <= 3)
  );
  return Math.min(70, 42 + (soil === "black" ? 7 : 0) + Math.floor(extremeCount / 2) * 7 + (conflictingExtremes ? 7 : 0));
}

function upkeepFromCreationDays(creationDays: number): {
  upkeepDifficulty: PitchUpkeepDifficulty;
  recoveryDays: number;
} {
  if (creationDays >= 63) return { upkeepDifficulty: "extreme", recoveryDays: 18 };
  if (creationDays >= 49) return { upkeepDifficulty: "high", recoveryDays: 14 };
  return { upkeepDifficulty: "standard", recoveryDays: 10 };
}

function stadiumScoreBaseline(stadium: HomeStadium): number {
  const total = stadium.pitches.reduce((sum, pitch) => (
    sum + (pitch.expectedFirstInningsScore.min + pitch.expectedFirstInningsScore.max) / 2
  ), 0);
  return total / Math.max(1, stadium.pitches.length);
}

export function deriveCustomPitch(input: {
  id: string;
  teamId: IplTeamId;
  stadium: HomeStadium;
  soil: PitchSoil;
  sliders: Partial<PitchSliderSettings>;
  createdOn: string;
}): CustomCuratorPitch {
  const sliders = normalizePitchSliders(input.sliders);
  const metrics = derivePitchMetrics(input.soil, sliders);
  const identity = generatedPitchIdentity(metrics);
  const preferences = generatedPreferences(metrics);
  const creationDays = calculatePitchCreationDays(input.soil, sliders);
  const upkeep = upkeepFromCreationDays(creationDays);
  const centre = stadiumScoreBaseline(input.stadium) + (metrics.battingEase - 5.5) * 7;
  const spread = 12 + (10 - metrics.consistency) * 1.5 + Math.max(0, metrics.deterioration - 6);
  const min = Math.round(Math.max(120, Math.min(238, centre - spread / 2)));
  const max = Math.round(Math.max(min + 10, Math.min(250, centre + spread / 2)));

  return {
    id: input.id,
    source: "custom",
    teamId: input.teamId,
    name: identity.name,
    type: identity.type,
    soil: input.soil,
    sliders,
    metrics,
    characteristics: generatedCharacteristics(input.soil, metrics),
    expectedFirstInningsScore: { min, max },
    favours: preferences.favours,
    doesNotFavour: preferences.doesNotFavour,
    creationDays,
    upkeepDifficulty: upkeep.upkeepDifficulty,
    recoveryDays: upkeep.recoveryDays,
    createdOn: input.createdOn,
  };
}

export function isCustomCuratorPitch(pitch: CuratorPitch): pitch is CustomCuratorPitch {
  return (pitch as Partial<CustomCuratorPitch>).source === "custom";
}
