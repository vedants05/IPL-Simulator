import { writeFileSync } from "node:fs";
import { STAFF_ADDITION_TRAITS, STAFF_DIRECTORY_ADDITIONS } from "../lib/data/staffDirectoryAdditions";

const columns = [
  "id", "slug", "full_name", "known_as", "date_of_birth", "country", "biography",
  "primary_role", "secondary_roles", "current_real_team_id", "real_contract_end_year",
  "reputation", "current_ability", "potential_ability", "experience_years",
  "salary_expectation", "compensation_cost", "ambition", "loyalty", "adaptability",
  "learning_rate", "development_phase", "retirement_age", "personality",
  "coaching_philosophy", "preferred_team_strategy", "is_available", "is_generated",
  "is_active", "batting_coaching", "pace_bowling_coaching", "spin_bowling_coaching",
  "fielding_coaching", "wicketkeeping_coaching", "technical_coaching", "tactical_knowledge",
  "player_development", "youth_development", "judging_ability", "judging_potential",
  "man_management", "motivation", "profile_confidence", "rating_basis",
] as const;

const sqlValue = (value: unknown): string => {
  if (value == null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `ARRAY[${value.map(sqlValue).join(", ")}]::text[]`;
  return `'${String(value).replaceAll("'", "''")}'`;
};

const statements = STAFF_DIRECTORY_ADDITIONS.map((profile) => {
  const row: Record<string, unknown> = {
    ...profile,
    current_real_team_id: null,
    real_contract_end_year: null,
    is_available: true,
    is_generated: false,
    is_active: true,
    profile_confidence: "medium",
  };
  const traits = STAFF_ADDITION_TRAITS[profile.slug];
  const traitColumns = ["staff_id", ...Object.keys(traits)];
  const traitRow = { staff_id: profile.id, ...traits };
  return `INSERT INTO public.staff_members (${columns.join(", ")})\nVALUES (${columns.map((column) => sqlValue(row[column])).join(", ")})\nON CONFLICT DO NOTHING;\n\nINSERT INTO public.staff_traits (${traitColumns.join(", ")})\nVALUES (${traitColumns.map((column) => sqlValue(traitRow[column as keyof typeof traitRow])).join(", ")})\nON CONFLICT DO NOTHING;`;
});

const destination = "supabase/migrations/20260921120000_add_reputable_staff_profiles.sql";
writeFileSync(destination, `-- Additional real-world coaches for 2026 starts. Ratings are game estimates.\n-- Source URLs and detailed rating rationale live in lib/data/staffDirectoryAdditions.ts.\n\n${statements.join("\n\n")}\n`);
console.log(`Wrote ${destination} with ${statements.length} profiles`);
