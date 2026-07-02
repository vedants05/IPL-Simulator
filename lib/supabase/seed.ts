/**
 * Run with: npx tsx lib/supabase/seed.ts
 * Seeds all players from players.ts into Supabase.
 */
import { createClient } from "@supabase/supabase-js";
import { PLAYERS_SEED } from "../data/players";
import { Player, IPLHistoryEntry } from "../types";

const supabase = createClient(
  "https://qnmmplezmitcllovbyur.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFubW1wbGV6bWl0Y2xsb3ZieXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzIxMDQsImV4cCI6MjA5ODQwODEwNH0.w6OHOuz8O92tYXmvTuOmO1SnBuuqx_VzixN_jW5KTsA"
);

async function seed() {
  console.log(`Seeding ${PLAYERS_SEED.length} players...`);

  // Clear existing data
  await supabase.from("ipl_history").delete().neq("id", 0);
  await supabase.from("players").delete().neq("id", "");

  // Insert players in batches of 50
  const playerRows = PLAYERS_SEED.map((p: Player) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    nationality: p.nationality,
    role: p.role,
    batting_style: p.battingStyle,
    bowling_style: p.bowlingStyle,
    star_rating: p.starRating,
    base_price: p.basePrice,
    is_capped: p.isCapped,
    current_team_id: p.currentTeamId,
    potential: p.potential,
    // Attributes
    attr_technique: p.attributes.technique,
    attr_power: p.attributes.power,
    attr_timing: p.attributes.timing,
    attr_placement: p.attributes.placement,
    attr_running: p.attributes.running,
    attr_pace: p.attributes.pace,
    attr_swing: p.attributes.swing,
    attr_seam: p.attributes.seam,
    attr_spin: p.attributes.spin,
    attr_flight: p.attributes.flight,
    attr_accuracy: p.attributes.accuracy,
    attr_variation: p.attributes.variation,
    attr_catching: p.attributes.catching,
    attr_throwing: p.attributes.throwing,
    attr_agility: p.attributes.agility,
    attr_composure: p.attributes.composure,
    attr_leadership: p.attributes.leadership,
    attr_determination: p.attributes.determination,
    // Batting stats
    bat_matches: p.careerStats.batting.matches,
    bat_innings: p.careerStats.batting.innings,
    bat_runs: p.careerStats.batting.runs,
    bat_average: p.careerStats.batting.average,
    bat_strike_rate: p.careerStats.batting.strikeRate,
    bat_fifties: p.careerStats.batting.fifties,
    bat_hundreds: p.careerStats.batting.hundreds,
    // Bowling stats
    bowl_matches: p.careerStats.bowling.matches,
    bowl_wickets: p.careerStats.bowling.wickets,
    bowl_economy: p.careerStats.bowling.economy,
    bowl_average: p.careerStats.bowling.average,
    bowl_best_figures: p.careerStats.bowling.bestFigures,
  }));

  for (let i = 0; i < playerRows.length; i += 50) {
    const batch = playerRows.slice(i, i + 50);
    const { error } = await supabase.from("players").insert(batch);
    if (error) {
      console.error(`Error inserting batch at ${i}:`, error.message);
      process.exit(1);
    }
    console.log(`  Inserted players ${i + 1}–${i + batch.length}`);
  }

  // Insert IPL history
  const historyRows = PLAYERS_SEED.flatMap((p: Player) =>
    p.iplHistory.map((h: IPLHistoryEntry) => ({
      player_id: p.id,
      team_id: h.teamId,
      season: h.season,
      price: h.price,
    }))
  );

  for (let i = 0; i < historyRows.length; i += 100) {
    const batch = historyRows.slice(i, i + 100);
    const { error } = await supabase.from("ipl_history").insert(batch);
    if (error) {
      console.error(`Error inserting history batch at ${i}:`, error.message);
      process.exit(1);
    }
  }

  console.log(`Done! ${PLAYERS_SEED.length} players and ${historyRows.length} history rows seeded.`);
}

seed().catch(console.error);
