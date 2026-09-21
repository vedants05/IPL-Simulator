import { NextResponse } from "next/server";

import { calculateStaffRoleRatings } from "@/lib/logic/staffRatings";
import { getStaffContractSeed } from "@/lib/data/staffContractSeeds";
import { STAFF_ADDITION_TRAITS, STAFF_DIRECTORY_ADDITIONS } from "@/lib/data/staffDirectoryAdditions";
import { resolveStaffAffinityProfile } from "@/lib/data/staffAffinities";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [membersResult, assignmentsResult, traitsResult] = await Promise.all([
      supabase
        .from("staff_members")
        // Profiles intentionally expose the complete staff record for now. Once
        // scouting/privacy mechanics exist, this can be replaced by a curated
        // projection without changing the directory response shape.
        .select("*")
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("staff_starting_assignments")
        .select("staff_id, team_id, role, start_season")
        .eq("start_season", 2026)
        .eq("is_active", true),
      supabase.from("staff_traits").select("*"),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (traitsResult.error) throw traitsResult.error;

    const traitsByStaff = new Map((traitsResult.data ?? []).map((traits) => [traits.staff_id, traits]));
    for (const member of STAFF_DIRECTORY_ADDITIONS) {
      if (!traitsByStaff.has(member.id)) traitsByStaff.set(member.id, {
        staff_id: member.id,
        ...STAFF_ADDITION_TRAITS[member.slug],
      });
    }
    // The checked-in additions are visible in local/new saves even before the
    // accompanying Supabase migration has been applied. A migrated row wins.
    const databaseMembers = membersResult.data ?? [];
    const databaseSlugs = new Set(databaseMembers.map((member) => member.slug));
    const members = [
      ...databaseMembers,
      ...STAFF_DIRECTORY_ADDITIONS.filter((member) => !databaseSlugs.has(member.slug)).map((member) => ({
        ...member,
        secondary_roles: [...member.secondary_roles],
        current_real_team_id: null,
        real_contract_end_year: null,
        image_url: null,
        is_available: true,
        is_generated: false,
        is_active: true,
        profile_confidence: "medium",
      })),
    ];
    const zaheerId = members.find((member) => member.slug === "zaheer-khan")?.id;
    const morganId = members.find((member) => member.slug === "eoin-morgan")?.id;
    const assignments = (assignmentsResult.data ?? [])
      .filter((assignment) => (assignment.staff_id !== morganId || assignment.team_id !== "CSK")
        && assignment.staff_id !== zaheerId);
    if (zaheerId) assignments.push({ staff_id: zaheerId, team_id: "CSK", role: "head_coach", start_season: 2026 });
    return NextResponse.json({
      members: members.map((member) => {
        const contract = getStaffContractSeed(member.slug);
        const staffTraits = traitsByStaff.get(member.id) ?? {};
        const traitLabels = Object.entries(staffTraits)
          .filter(([, value]) => value === true)
          .map(([trait]) => trait);
        const traitPreferences = Object.fromEntries(Object.entries(staffTraits).filter(([, value]) => typeof value === "number"));
        return {
          ...member,
          current_real_team_id: member.slug === "eoin-morgan" && member.current_real_team_id === "CSK"
            ? null : member.slug === "zaheer-khan" ? "CSK" : member.current_real_team_id,
          affinity_profile: resolveStaffAffinityProfile({
            slug: member.slug,
            country: member.country,
            currentTeamId: member.current_real_team_id,
          }),
          contract_start_year: contract?.appointmentYear ?? null,
          contract_end_year: contract?.contractEndYear ?? null,
          contract_status: contract ? (contract.contractEndYear == null ? "rolling" : "fixed_term") : "uncontracted",
          coaching_attributes: {
          batting: member.batting_coaching,
          pace_bowling: member.pace_bowling_coaching,
          spin_bowling: member.spin_bowling_coaching,
          fielding: member.fielding_coaching,
          wicketkeeping: member.wicketkeeping_coaching,
          technical_coaching: member.technical_coaching,
          tactical_knowledge: member.tactical_knowledge,
          player_development: member.player_development,
          youth_development: member.youth_development,
          judging_ability: member.judging_ability,
          judging_potential: member.judging_potential,
          man_management: member.man_management,
          motivation: member.motivation,
          },
          role_ratings: calculateStaffRoleRatings(member),
          traits: traitLabels,
          trait_preferences: traitPreferences,
          staff_traits: staffTraits,
        };
      }),
      assignments,
    });
  } catch (error) {
    console.error("API error fetching staff:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load staff" },
      { status: 500 },
    );
  }
}
