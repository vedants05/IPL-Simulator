import { getStaffClubCulture } from "../data/staffClubCulture";
import { getClubOwnership } from "../data/clubOwnership";

export type StaffJobSecurityState = "secure" | "stable" | "under_scrutiny" | "under_pressure"
  | "serious_risk" | "expected_dismissal" | "immediate_dismissal";

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export const calculateSeasonUnderperformancePressure = (expectedPosition: number, finalPosition: number) => {
  const expected = clamp(Math.round(expectedPosition), 1, 10);
  const actual = clamp(Math.round(finalPosition), 1, 10);
  const positionGap = Math.max(0, actual - expected);
  return Math.round(clamp((positionGap ** 2) * 2.5 + Math.max(0, actual - 4) * 4, 0, 100) * 10) / 10;
};

export const calculateTwoSeasonPerformancePressure = (
  currentSeasonPressure: number,
  previousSeasonPressure: number | null,
) => previousSeasonPressure == null
  ? clamp(currentSeasonPressure, 0, 100)
  : Math.round(clamp(currentSeasonPressure * 0.7 + previousSeasonPressure * 0.3, 0, 100) * 10) / 10;

export interface EffectiveJobPressureInput {
  rawPressure: number;
  teamId: string;
  contextualProtection?: number;
  ownershipPatienceModifier?: number;
}

export const calculateEffectiveJobPressure = ({
  rawPressure,
  teamId,
  contextualProtection = 0,
  ownershipPatienceModifier,
}: EffectiveJobPressureInput) => {
  const clubPatienceModifier = getStaffClubCulture(teamId).patienceModifier;
  const activeOwnershipPatience = ownershipPatienceModifier ?? getClubOwnership(teamId).patience_modifier;
  const combinedCultureModifier = clamp(clubPatienceModifier + activeOwnershipPatience, -20, 20);
  const protection = clamp(contextualProtection, 0, 30);
  return Math.round(clamp(rawPressure - protection - combinedCultureModifier, 0, 100) * 10) / 10;
};

export const getStaffJobSecurityState = (effectivePressure: number): StaffJobSecurityState => {
  const pressure = clamp(effectivePressure, 0, 100);
  if (pressure >= 90) return "immediate_dismissal";
  if (pressure >= 80) return "expected_dismissal";
  if (pressure >= 65) return "serious_risk";
  if (pressure >= 50) return "under_pressure";
  if (pressure >= 35) return "under_scrutiny";
  if (pressure >= 20) return "stable";
  return "secure";
};

export const trophyProtectionPreventsDismissal = (
  wonPreviousSeason: boolean,
  effectivePressure: number,
) => wonPreviousSeason && effectivePressure < 90;
