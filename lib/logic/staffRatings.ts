export const STAFF_RATING_ROLES = [
  "head_coach",
  "assistant_coach",
  "mentor",
  "batting_coach",
  "pace_bowling_coach",
  "spin_bowling_coach",
  "fielding_coach",
  "wicketkeeping_coach",
  "coach",
] as const;

export type StaffRatingRole = typeof STAFF_RATING_ROLES[number];

export interface StaffRatingAttributes {
  reputation?: number | null;
  batting_coaching: number | null;
  pace_bowling_coaching: number | null;
  spin_bowling_coaching: number | null;
  fielding_coaching: number | null;
  wicketkeeping_coaching: number | null;
  technical_coaching: number | null;
  tactical_knowledge: number | null;
  player_development: number | null;
  youth_development: number | null;
  judging_ability: number | null;
  judging_potential: number | null;
  man_management: number | null;
  motivation: number | null;
}

export interface StaffPotentialInputs {
  currentAbility: number;
  dateOfBirth: string | null;
  experienceYears: number | null;
  learningRate: number | null;
  adaptability: number | null;
  ambition: number | null;
  developmentPhase: string | null;
  retirementAge: number | null;
  profileConfidence: "low" | "medium" | "high" | null;
  asOfDate?: string;
}

type RatingKey = keyof StaffRatingAttributes;

const ROLE_WEIGHTS: Record<StaffRatingRole, Partial<Record<RatingKey, number>>> = {
  head_coach: {
    tactical_knowledge: 0.25,
    technical_coaching: 0.10,
    player_development: 0.15,
    youth_development: 0.05,
    judging_ability: 0.05,
    judging_potential: 0.05,
    man_management: 0.20,
    motivation: 0.15,
  },
  assistant_coach: {
    tactical_knowledge: 0.20,
    technical_coaching: 0.15,
    player_development: 0.15,
    youth_development: 0.10,
    judging_ability: 0.05,
    judging_potential: 0.05,
    man_management: 0.15,
    motivation: 0.15,
  },
  mentor: {
    reputation: 0.35,
    tactical_knowledge: 0.20,
    player_development: 0.05,
    man_management: 0.20,
    motivation: 0.20,
  },
  batting_coach: {
    batting_coaching: 0.50,
    technical_coaching: 0.25,
    player_development: 0.05,
    youth_development: 0.05,
    judging_ability: 0.05,
    judging_potential: 0.05,
    man_management: 0.05,
  },
  pace_bowling_coach: {
    pace_bowling_coaching: 0.50,
    technical_coaching: 0.25,
    player_development: 0.05,
    youth_development: 0.05,
    judging_ability: 0.05,
    judging_potential: 0.05,
    man_management: 0.05,
  },
  spin_bowling_coach: {
    spin_bowling_coaching: 0.50,
    technical_coaching: 0.25,
    player_development: 0.05,
    youth_development: 0.05,
    judging_ability: 0.05,
    judging_potential: 0.05,
    man_management: 0.05,
  },
  fielding_coach: {
    fielding_coaching: 0.50,
    technical_coaching: 0.25,
    player_development: 0.05,
    youth_development: 0.05,
    judging_ability: 0.05,
    judging_potential: 0.05,
    man_management: 0.05,
  },
  wicketkeeping_coach: {
    wicketkeeping_coaching: 0.50,
    technical_coaching: 0.25,
    player_development: 0.05,
    youth_development: 0.05,
    judging_ability: 0.05,
    judging_potential: 0.05,
    man_management: 0.05,
  },
  coach: {
    tactical_knowledge: 0.10,
    technical_coaching: 0.25,
    player_development: 0.25,
    youth_development: 0.15,
    judging_ability: 0.05,
    judging_potential: 0.05,
    man_management: 0.10,
    motivation: 0.05,
  },
};

const boundedAttribute = (key: RatingKey, value: number | null | undefined) => {
  const normalized = key === "reputation" ? (value ?? 0) / 5 : (value ?? 1);
  return Math.max(1, Math.min(20, normalized));
};

export const calculateStaffRoleRating = (
  attributes: StaffRatingAttributes,
  role: StaffRatingRole,
) => {
  let weighted = Object.entries(ROLE_WEIGHTS[role]).reduce((total, [key, weight]) => (
    total + boundedAttribute(key as RatingKey, attributes[key as RatingKey]) * (weight ?? 0)
  ), 0);

  // Mirrors the calibrated overall staff scale: only a weighted profile close
  // to 19/20 reaches 90, while useful professional coaches occupy the 70s/80s.
  return Math.max(50, Math.min(94, Math.round(10 + weighted * 4.2)));
};

export const calculateStaffRoleRatings = (attributes: StaffRatingAttributes) => Object.fromEntries(
  STAFF_RATING_ROLES.map((role) => [role, calculateStaffRoleRating(attributes, role)]),
) as Record<StaffRatingRole, number>;

export const isStaffRatingRole = (role: string): role is StaffRatingRole => (
  STAFF_RATING_ROLES.includes(role as StaffRatingRole)
);

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, value))
);

const ageOnDate = (dateOfBirth: string | null, asOfDate: string) => {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const asOf = new Date(`${asOfDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) return null;
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  if (asOf.getUTCMonth() < birth.getUTCMonth()
    || (asOf.getUTCMonth() === birth.getUTCMonth() && asOf.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
};

/**
 * Estimates remaining coaching upside, not playing potential. Current role
 * ability already contains the relevant technical and leadership attributes;
 * this model adds headroom only where the coach has time and evidence-backed
 * capacity to improve. The fixed valuation date keeps database calibration
 * deterministic for the 2026 career start.
 */
export const calculateStaffPotentialAbility = ({
  currentAbility,
  dateOfBirth,
  experienceYears,
  learningRate,
  adaptability,
  ambition,
  developmentPhase,
  retirementAge,
  profileConfidence,
  asOfDate = "2026-04-01",
}: StaffPotentialInputs) => {
  const current = clamp(Math.round(currentAbility), 50, 94);
  const experience = Math.max(0, experienceYears ?? 10);
  const age = ageOnDate(dateOfBirth, asOfDate);
  const runway = age == null ? 8 : (retirementAge ?? 68) - age;

  const phaseScore = developmentPhase === "developing" ? 4
    : developmentPhase === "emerging" ? 3
      : developmentPhase === "peak" ? 1.5
        : developmentPhase === "veteran" ? 0.5
          : 1;
  const experienceScore = experience <= 2 ? 4
    : experience <= 5 ? 3
      : experience <= 10 ? 2
        : experience <= 15 ? 1
          : 0;
  const learningScore = clamp(((learningRate ?? 70) - 60) / 10, 0, 3);
  const adaptabilityScore = clamp(((adaptability ?? 70) - 65) / 15, 0, 2);
  const ambitionScore = clamp(((ambition ?? 70) - 55) / 22.5, 0, 2);
  const runwayScore = runway >= 20 ? 2.5
    : runway >= 12 ? 2
      : runway >= 6 ? 1
        : runway > 0 ? 0.5
          : 0;

  // An already elite coach has less plausible room to rise than a developing
  // coach. Evidence confidence controls uncertainty without granting upside.
  const abilityCompression = clamp((96 - current) / 30, 0.35, 1);
  const confidenceFactor = profileConfidence === "low" ? 0.75
    : profileConfidence === "medium" ? 0.9
      : 1;
  const rawHeadroom = phaseScore + experienceScore + learningScore
    + adaptabilityScore + ambitionScore + runwayScore;
  const headroom = clamp(Math.round(rawHeadroom * abilityCompression * confidenceFactor), 1, 14);

  return Math.min(95, current + headroom);
};
