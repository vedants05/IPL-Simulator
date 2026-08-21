import type { StaffRatingAttributes } from "./staffRatings";

export const STAFF_RATING_GUIDELINES_VERSION = "2026-08-19-v1";

export const STAFF_COACHING_ATTRIBUTE_KEYS = [
  "batting_coaching", "pace_bowling_coaching", "spin_bowling_coaching", "fielding_coaching",
  "wicketkeeping_coaching", "technical_coaching", "tactical_knowledge", "player_development",
  "youth_development", "judging_ability", "judging_potential", "man_management", "motivation",
] as const satisfies readonly (keyof StaffRatingAttributes)[];

export const STAFF_ATTRIBUTE_DEFINITIONS: Record<typeof STAFF_COACHING_ATTRIBUTE_KEYS[number], string> = {
  batting_coaching: "Demonstrated ability to diagnose and teach batting technique, preparation and role execution.",
  pace_bowling_coaching: "Demonstrated ability to teach pace mechanics, control, variations, plans and workload-aware preparation.",
  spin_bowling_coaching: "Demonstrated ability to teach spin mechanics, control, variations, deception and tactical use.",
  fielding_coaching: "Demonstrated ability to build catching, ground-fielding, throwing, movement and team fielding systems.",
  wicketkeeping_coaching: "Demonstrated ability to teach keeping technique, movement, takes, stumpings and match preparation.",
  technical_coaching: "Quality of diagnosis, communication, drill design and correction; playing skill alone is not evidence.",
  tactical_knowledge: "Evidence of match planning, selection balance, role definition, adaptation and in-game decisions.",
  player_development: "Documented improvement of senior players, including helping players reach or succeed at international level.",
  youth_development: "Documented development of academy, age-group, emerging or inexperienced professional players.",
  judging_ability: "Accuracy in assessing a player's present level, role and readiness.",
  judging_potential: "Accuracy in identifying future ceiling and selecting players who subsequently progress.",
  man_management: "Trust, clarity, conflict handling, accountability and individual relationships; strongly tied to people leadership.",
  motivation: "Demonstrated ability to build confidence, standards, resilience and collective competitive intensity.",
};

export const STAFF_ATTRIBUTE_SCALE = [
  { minimum: 1, maximum: 4, meaning: "No relevant evidence or capability outside the person's coaching domain." },
  { minimum: 5, maximum: 7, meaning: "Limited transferable knowledge; not demonstrated at sustained professional level." },
  { minimum: 8, maximum: 10, meaning: "Some relevant exposure, but below established professional-coach standard." },
  { minimum: 11, maximum: 13, meaning: "Competent professional capability with credible but limited evidence." },
  { minimum: 14, maximum: 16, meaning: "Strong, clearly demonstrated professional capability." },
  { minimum: 17, maximum: 17, meaning: "Excellent specialist or leadership capability proven over meaningful work." },
  { minimum: 18, maximum: 18, meaning: "Elite results or development evidence across multiple seasons or major assignments." },
  { minimum: 19, maximum: 19, meaning: "World-leading, sustained evidence across teams, environments or elite outcomes." },
  { minimum: 20, maximum: 20, meaning: "Generational benchmark for the database; exceptional and rare, never reputation-only." },
] as const;

export const STAFF_RATING_PRINCIPLES = [
  "Rate coaching evidence, not playing greatness. Former legends receive high reputation but only evidence-backed coaching attributes.",
  "Compare every score with existing database benchmarks before applying it; research depth does not justify scale inflation.",
  "A 19 or 20 requires sustained attributable evidence, not an appointment, one season, commentary work or assumed knowledge.",
  "Specialist playing knowledge may support an emerging score, but proven teaching and player outcomes determine elite scores.",
  "Reputation is a separate 0-100 measure and contributes heavily to mentor suitability, not specialist or head-coach inflation.",
  "Confidence describes evidence completeness, not quality. Sparse evidence should produce conservative ratings even for famous people.",
] as const;

export const validateStaffRatingProfile = ({
  profileName,
  ratings,
  reputation,
  basis,
}: {
  profileName: string;
  ratings: Pick<StaffRatingAttributes, typeof STAFF_COACHING_ATTRIBUTE_KEYS[number]>;
  reputation: number | null;
  basis: string;
}) => {
  for (const key of STAFF_COACHING_ATTRIBUTE_KEYS) {
    const value = ratings[key];
    if (!Number.isInteger(value) || value == null || value < 1 || value > 20) {
      throw new Error(`${profileName}.${key} must be an integer from 1 to 20; received ${String(value)}.`);
    }
  }
  if (!Number.isInteger(reputation) || reputation == null || reputation < 0 || reputation > 100) {
    throw new Error(`${profileName}.reputation must be an integer from 0 to 100; received ${String(reputation)}.`);
  }
  if (basis.trim().length < 80) {
    throw new Error(`${profileName}.rating_basis must contain evidence-based justification (minimum 80 characters).`);
  }
};
