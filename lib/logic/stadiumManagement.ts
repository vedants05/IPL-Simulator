import {
  HOME_STADIUMS,
  getHomeStadium,
  getStadiumBoundaryLimits,
  type BoundaryDimensions,
  type ExpectedScoreRange,
  type IplTeamId,
} from "@/lib/data/pitchCurator";

export interface BoundaryPreset {
  id: string;
  teamId: IplTeamId;
  name: string;
  dimensions: BoundaryDimensions;
  createdOn: string;
}

export interface BoundaryScoringImpact {
  modifier: number;
  percentageChange: number;
  weightedDifferenceMetres: number;
  label: "Higher scoring" | "League-average scoring" | "Lower scoring";
}

export const LEAGUE_REFERENCE_BOUNDARIES: BoundaryDimensions = {
  straightMetres: 70,
  wideMetres: 67,
};

export const MIN_OUTFIELD_GRASS_HEIGHT_MM = 10;
export const MAX_OUTFIELD_GRASS_HEIGHT_MM = 20;
export const MIN_OUTFIELD_MOISTURE_PERCENT = 18;
export const MAX_OUTFIELD_MOISTURE_PERCENT = 34;
export const MIN_OUTFIELD_FIRMNESS_GMAX = 55;
export const MAX_OUTFIELD_FIRMNESS_GMAX = 90;

export interface OutfieldSettings {
  grassHeightMm: number;
  moisturePercent: number;
  firmnessGmax: number;
}

export type HomeOutfieldSettings = Record<IplTeamId, OutfieldSettings>;

export interface OutfieldPreparationProject {
  id: string;
  teamId: IplTeamId;
  startedOn: string;
  completesOn: string;
  preparationDays: number;
  target: OutfieldSettings;
}

export interface OutfieldPreparationTiming {
  mowingOrGrowthDays: number;
  moistureConditioningDays: number;
  firmnessTreatmentDays: number;
  totalDays: number;
}

export interface OutfieldScoringImpact {
  modifier: number;
  percentageChange: number;
  speedRating: number;
  label: "Rapid" | "Fast" | "Balanced" | "Measured" | "Slow";
}

export interface GroundScoringImpact {
  modifier: number;
  percentageChange: number;
  label: "Higher scoring" | "League-average scoring" | "Lower scoring";
  boundary: BoundaryScoringImpact;
  outfield: OutfieldScoringImpact;
}

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

/**
 * Boundary-only scoring adjustment. Wide boundaries receive a little more
 * weight because more scoring arcs run square of the wicket. Every stadium is
 * measured against the same league reference, so compact default grounds
 * score higher and larger default grounds score lower without user changes.
 */
export function calculateBoundaryScoringImpact(
  teamId: string,
  dimensions: BoundaryDimensions,
): BoundaryScoringImpact {
  const stadium = getHomeStadium(teamId);
  if (!stadium) {
    return {
      modifier: 1,
      percentageChange: 0,
      weightedDifferenceMetres: 0,
      label: "League-average scoring",
    };
  }
  const weightedDifferenceMetres = (
    (LEAGUE_REFERENCE_BOUNDARIES.straightMetres - dimensions.straightMetres) * 0.45
    + (LEAGUE_REFERENCE_BOUNDARIES.wideMetres - dimensions.wideMetres) * 0.55
  );
  const modifier = clamp(1 + weightedDifferenceMetres * 0.0075, 0.94, 1.18);
  const percentageChange = Math.round((modifier - 1) * 1_000) / 10;

  return {
    modifier,
    percentageChange,
    weightedDifferenceMetres: Math.round(weightedDifferenceMetres * 10) / 10,
    label: percentageChange > 0.2
      ? "Higher scoring"
      : percentageChange < -0.2
        ? "Lower scoring"
        : "League-average scoring",
  };
}

export function applyBoundaryScoringImpact(
  scoreRange: ExpectedScoreRange,
  impact: BoundaryScoringImpact,
): ExpectedScoreRange {
  return {
    min: Math.round(scoreRange.min * impact.modifier),
    max: Math.round(scoreRange.max * impact.modifier),
  };
}

export function getDefaultOutfieldSettings(teamId: string): OutfieldSettings | null {
  const stadium = getHomeStadium(teamId);
  if (!stadium) return null;
  return {
    grassHeightMm: clamp(21 - stadium.outfield.speedRating, 10, 20),
    moisturePercent: 24,
    firmnessGmax: clamp(40 + stadium.outfield.speedRating * 5, 55, 90),
  };
}

export function createDefaultHomeOutfieldSettings(): HomeOutfieldSettings {
  return Object.fromEntries(HOME_STADIUMS.map((stadium) => [
    stadium.teamId,
    getDefaultOutfieldSettings(stadium.teamId)!,
  ])) as HomeOutfieldSettings;
}

export function normalizeOutfieldSettings(
  value: unknown,
  teamId: string,
): OutfieldSettings {
  const defaults = getDefaultOutfieldSettings(teamId) ?? {
    grassHeightMm: 14,
    moisturePercent: 24,
    firmnessGmax: 75,
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const candidate = value as Partial<OutfieldSettings>;
  const grassHeightMm = Number(candidate.grassHeightMm);
  const moisturePercent = Number(candidate.moisturePercent);
  const firmnessGmax = Number(candidate.firmnessGmax);
  return {
    grassHeightMm: Number.isFinite(grassHeightMm)
      ? Math.round(clamp(grassHeightMm, MIN_OUTFIELD_GRASS_HEIGHT_MM, MAX_OUTFIELD_GRASS_HEIGHT_MM))
      : defaults.grassHeightMm,
    moisturePercent: Number.isFinite(moisturePercent)
      ? Math.round(clamp(moisturePercent, MIN_OUTFIELD_MOISTURE_PERCENT, MAX_OUTFIELD_MOISTURE_PERCENT) / 2) * 2
      : defaults.moisturePercent,
    firmnessGmax: Number.isFinite(firmnessGmax)
      ? Math.round(clamp(firmnessGmax, MIN_OUTFIELD_FIRMNESS_GMAX, MAX_OUTFIELD_FIRMNESS_GMAX) / 5) * 5
      : defaults.firmnessGmax,
  };
}

export function normalizeHomeOutfieldSettings(value: unknown): HomeOutfieldSettings {
  const supplied = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(HOME_STADIUMS.map((stadium) => [
    stadium.teamId,
    normalizeOutfieldSettings(supplied[stadium.teamId], stadium.teamId),
  ])) as HomeOutfieldSettings;
}

export function calculateOutfieldSpeedRating(
  teamId: string,
  settings: OutfieldSettings,
): number {
  const stadium = getHomeStadium(teamId);
  const defaults = getDefaultOutfieldSettings(teamId);
  if (!stadium || !defaults) return 7.5;
  const normalized = normalizeOutfieldSettings(settings, teamId);
  const speedRating = (
    stadium.outfield.speedRating
    + (defaults.grassHeightMm - normalized.grassHeightMm) * 0.25
    + (normalized.firmnessGmax - defaults.firmnessGmax) * 0.08
    + (defaults.moisturePercent - normalized.moisturePercent) * 0.1
  );
  return Math.round(clamp(speedRating, 3, 10) * 10) / 10;
}

export function calculateOutfieldScoringImpact(
  teamId: string,
  settings: OutfieldSettings,
): OutfieldScoringImpact {
  const speedRating = calculateOutfieldSpeedRating(teamId, settings);
  const modifier = clamp(1 + (speedRating - 7.5) * 0.006, 0.97, 1.02);
  const percentageChange = Math.round((modifier - 1) * 1_000) / 10;
  return {
    modifier,
    percentageChange,
    speedRating,
    label: speedRating >= 9
      ? "Rapid"
      : speedRating >= 8
        ? "Fast"
        : speedRating >= 6.5
          ? "Balanced"
          : speedRating >= 5
            ? "Measured"
            : "Slow",
  };
}

export function calculateGroundScoringImpact(
  teamId: string,
  dimensions: BoundaryDimensions,
  outfieldSettings: OutfieldSettings,
): GroundScoringImpact {
  const boundary = calculateBoundaryScoringImpact(teamId, dimensions);
  const outfield = calculateOutfieldScoringImpact(teamId, outfieldSettings);
  const modifier = boundary.modifier * outfield.modifier;
  const percentageChange = Math.round((modifier - 1) * 1_000) / 10;
  return {
    modifier,
    percentageChange,
    label: percentageChange > 0.2
      ? "Higher scoring"
      : percentageChange < -0.2
        ? "Lower scoring"
        : "League-average scoring",
    boundary,
    outfield,
  };
}

export function applyGroundScoringImpact(
  scoreRange: ExpectedScoreRange,
  impact: GroundScoringImpact,
): ExpectedScoreRange {
  return {
    min: Math.round(scoreRange.min * impact.modifier),
    max: Math.round(scoreRange.max * impact.modifier),
  };
}

function calculateGrassPreparationDays(currentMm: number, targetMm: number): number {
  if (targetMm === currentMm) return 0;
  if (targetMm > currentMm) return (targetMm - currentMm) * 2;

  // Each mowing removes at most one third of the leaf height.
  let workingHeight = currentMm;
  let mowingDays = 0;
  while (workingHeight > targetMm && mowingDays < 10) {
    workingHeight = Math.max(targetMm, Math.ceil(workingHeight * (2 / 3)));
    mowingDays += 1;
  }
  return mowingDays;
}

export function calculateOutfieldPreparationTiming(
  teamId: string,
  current: OutfieldSettings,
  target: OutfieldSettings,
): OutfieldPreparationTiming {
  const stadium = getHomeStadium(teamId);
  const normalizedCurrent = normalizeOutfieldSettings(current, teamId);
  const normalizedTarget = normalizeOutfieldSettings(target, teamId);
  const mowingOrGrowthDays = calculateGrassPreparationDays(
    normalizedCurrent.grassHeightMm,
    normalizedTarget.grassHeightMm,
  );
  const moistureDifference = normalizedTarget.moisturePercent - normalizedCurrent.moisturePercent;
  const drainageRate = (stadium?.outfield.speedRating ?? 7) >= 8 ? 4 : 3;
  const moistureConditioningDays = moistureDifference === 0
    ? 0
    : Math.ceil(Math.abs(moistureDifference) / (moistureDifference > 0 ? 4 : drainageRate));
  const firmnessDifference = normalizedTarget.firmnessGmax - normalizedCurrent.firmnessGmax;
  const firmnessTreatmentDays = firmnessDifference === 0
    ? 0
    : firmnessDifference > 0
      ? Math.ceil(firmnessDifference / 10)
      : 2 + Math.ceil(Math.abs(firmnessDifference) / 5) * 2;
  const totalDays = Math.min(
    24,
    Math.max(mowingOrGrowthDays, moistureConditioningDays, firmnessTreatmentDays),
  );

  return {
    mowingOrGrowthDays,
    moistureConditioningDays,
    firmnessTreatmentDays,
    totalDays,
  };
}

export function normalizeOutfieldPreparationProject(
  value: unknown,
  expectedTeamId?: IplTeamId,
): OutfieldPreparationProject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<OutfieldPreparationProject>;
  if (
    typeof candidate.id !== "string"
    || !candidate.id
    || typeof candidate.teamId !== "string"
    || !getHomeStadium(candidate.teamId)
    || (expectedTeamId && candidate.teamId !== expectedTeamId)
    || typeof candidate.startedOn !== "string"
    || typeof candidate.completesOn !== "string"
    || !Number.isInteger(candidate.preparationDays)
    || (candidate.preparationDays ?? 0) < 1
    || !candidate.target
  ) return null;
  return {
    id: candidate.id,
    teamId: candidate.teamId as IplTeamId,
    startedOn: candidate.startedOn,
    completesOn: candidate.completesOn,
    preparationDays: candidate.preparationDays!,
    target: normalizeOutfieldSettings(candidate.target, candidate.teamId),
  };
}

export function normalizeBoundaryPreset(
  value: unknown,
  expectedTeamId?: IplTeamId,
): BoundaryPreset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<BoundaryPreset>;
  if (
    typeof candidate.id !== "string"
    || !candidate.id
    || typeof candidate.teamId !== "string"
    || !getHomeStadium(candidate.teamId)
    || (expectedTeamId && candidate.teamId !== expectedTeamId)
    || typeof candidate.name !== "string"
    || !candidate.name.trim()
    || typeof candidate.createdOn !== "string"
    || !candidate.dimensions
  ) return null;

  const limits = getStadiumBoundaryLimits(candidate.teamId);
  if (!limits) return null;
  const straight = Number(candidate.dimensions.straightMetres);
  const wide = Number(candidate.dimensions.wideMetres);
  if (!Number.isFinite(straight) || !Number.isFinite(wide)) return null;

  return {
    id: candidate.id,
    teamId: candidate.teamId as IplTeamId,
    name: candidate.name.trim().slice(0, 32),
    dimensions: {
      straightMetres: Math.round(clamp(straight, limits.minimum, limits.straightMaximum)),
      wideMetres: Math.round(clamp(wide, limits.minimum, limits.wideMaximum)),
    },
    createdOn: candidate.createdOn,
  };
}
