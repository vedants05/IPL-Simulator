import { supabase } from "./client";
import { Team, FanBase, AIPersonality, BoardObjective } from "../types";

/**
 * Loads team config from the Supabase `teams` table and maps each row to a Team.
 * Only static config lives in the DB; runtime fields (squad, purse spent, RTM used,
 * overseas count) are initialised to defaults here and overwritten by the store when
 * a game starts.
 */
export async function fetchTeamsFromSupabase(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("prestige", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch teams from Supabase: ${error.message}`);
  }

  return data.map((row: any): Team => {
    const totalPurse = Number(row.total_purse) || 0;
    const boardObjectives: BoardObjective[] = Array.isArray(row.board_objectives)
      ? row.board_objectives
      : [];

    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      homeGround: row.home_ground,
      city: row.city,
      totalPurse,
      spentAmount: 0,
      remainingPurse: totalPurse,
      squad: [],
      retainedPlayers: [],
      rtmCardsUsed: 0,
      rtmCardsTotal: Number(row.rtm_cards_total) || 0,
      maxSquadSize: Number(row.max_squad_size) || 0,
      minSquadSize: Number(row.min_squad_size) || 0,
      overseasPlayersCurrent: 0,
      overseasPlayersMax: Number(row.overseas_players_max) || 0,
      boardObjectives,
      fanBase: row.fan_base as FanBase,
      prestige: Number(row.prestige) || 0,
      aiPersonality: row.ai_personality as AIPersonality,
      dna: {
        loyalty: Number(row.dna_loyalty) || 0,
        prefYoungsters: Number(row.dna_pref_youngsters) || 0,
        experienceFocus: Number(row.dna_experience_focus) || 0,
        bigNamesPref: Number(row.dna_big_names_pref) || 0,
        looksForDepth: Number(row.dna_looks_for_depth) || 0,
        alrValue: Number(row.dna_alr_value) || 0,
        batValue: Number(row.dna_bat_value) || 0,
        bowlValue: Number(row.dna_bowl_value) || 0,
        commitmentToTargets: Number(row.dna_commitment_to_targets) || 0,
        segmentFocus: {
          overseasPacers: Number(row.sf_overseas_pacers) || 0,
          indianPacers: Number(row.sf_indian_pacers) || 0,
          overseasSpinners: Number(row.sf_overseas_spinners) || 0,
          indianSpinners: Number(row.sf_indian_spinners) || 0,
          overseasAllRounders: Number(row.sf_overseas_all_rounders) || 0,
          indianAllRounders: Number(row.sf_indian_all_rounders) || 0,
          overseasBatters: Number(row.sf_overseas_batters) || 0,
          indianBatters: Number(row.sf_indian_batters) || 0,
        },
      },
      description: row.description,
    };
  });
}
