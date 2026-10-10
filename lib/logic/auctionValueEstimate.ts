import type { AuctionState, Player, Team } from "@/lib/types";
import type { PlayerInjury } from "@/lib/logic/injuries";

export type ValueDirection = "up" | "down" | "flat";
export interface ValueFactor {
  group: string;
  direction: ValueDirection;
  effect: number;
  reason: string;
  brief: string;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const signed = (group: string, effect: number, reason: string, brief: string): ValueFactor => ({
  group, effect, reason, brief, direction: effect > 0.025 ? "up" : effect < -0.025 ? "down" : "flat",
});
const roleName = (player: Player) => player.role === "All-Rounder" && player.bowlingStyle
  ? `${player.bowlingStyle === "Pacer" ? "pace-bowling" : "spin-bowling"} all-rounder`
  : player.role.toLowerCase();
const sameMarketRole = (candidate: Player, player: Player) => candidate.role === player.role
  && (player.role !== "All-Rounder" || !player.bowlingStyle || candidate.bowlingStyle === player.bowlingStyle);

function currentRoleQuality(player: Player): number {
  if (player.role === "Pace Bowler" || player.role === "Spin Bowler") return player.currentBowling;
  if (player.role !== "All-Rounder") return player.currentBatting;
  const stronger = Math.max(player.currentBatting, player.currentBowling);
  const weaker = Math.min(player.currentBatting, player.currentBowling);
  const blended = stronger - weaker >= 7 ? stronger * 0.8 + weaker * 0.2 : stronger * 0.6 + weaker * 0.4;
  return weaker >= 68 ? Math.max(blended, stronger - 1) : blended;
}

/** Lakhs. A player's current, visible role ability sets the price tier. */
function abilityPrice(quality: number): number {
  const anchors = [[30, 20], [55, 50], [65, 150], [75, 460], [85, 1280], [97, 2050]];
  for (let index = 1; index < anchors.length; index++) {
    const [upperRating, upperPrice] = anchors[index];
    const [lowerRating, lowerPrice] = anchors[index - 1];
    if (quality <= upperRating) return lowerPrice + (upperPrice - lowerPrice) * clamp((quality - lowerRating) / (upperRating - lowerRating), 0, 1);
  }
  return anchors[anchors.length - 1][1] + (quality - 97) * 65;
}

/** A deterministic, public-data estimate in lakhs. It is independent of AI bidding randomness. */
export function estimateAuctionValue(
  player: Player,
  players: Record<string, Player>,
  teams: Record<string, Team>,
  auction: AuctionState | null,
  currentSeason: number,
  activeInjury?: PlayerInjury | null,
) {
  const allPlayers = Object.values(players);
  const quality = currentRoleQuality(player);
  const anchor = Math.max(player.basePrice, abilityPrice(quality));
  const factors: ValueFactor[] = [];

  const abilityEffect = clamp(abilityPrice(quality) / abilityPrice(75) - 1, -0.85, 3);
  factors.push(signed("Current ability", abilityEffect,
    `${Math.round(quality)} current ${player.role === "Pace Bowler" || player.role === "Spin Bowler" ? "bowling" : player.role === "All-Rounder" ? "combined batting and bowling" : "batting"} rating sets the main price tier; base price is only the minimum.`,
    player.role === "All-Rounder" ? `${player.currentBatting}B/${player.currentBowling}O` : `${Math.round(quality)} rated`));

  const ageEffect = player.age <= 24 ? 0.09 : player.age <= 30 ? 0.04 : player.age >= 37 ? -0.15 : player.age >= 34 ? -0.07 : 0;
  factors.push(signed("Age", ageEffect, `Age ${player.age}: ${ageEffect > 0 ? "more seasons of expected availability can attract longer-term bids" : ageEffect < 0 ? "a shorter expected playing window may limit bids" : "within the usual prime-age range"}.`, `${player.age} y.o.`));

  const rolePool = auction?.allPlayerIds.length ? auction.allPlayerIds.map((id) => players[id]).filter((candidate): candidate is Player => !!candidate) : allPlayers.filter((candidate) => !candidate.currentTeamId);
  const comparable = rolePool.filter((candidate) => sameMarketRole(candidate, player) && candidate.nationality === player.nationality);
  const poolCount = comparable.length;
  const scarce = poolCount > 0 && poolCount <= 3;
  const plentiful = poolCount >= 12;
  factors.push(signed("Role supply", scarce ? 0.13 : plentiful ? -0.06 : 0,
    `${poolCount} ${player.nationality.toLowerCase()} ${roleName(player)}${poolCount === 1 ? "" : "s"} in the ${auction?.allPlayerIds.length ? "auction" : "available"} pool${poolCount === 0 ? "; no comparable pool is available to judge scarcity" : scarce ? "; few alternatives may increase demand" : plentiful ? "; teams have several alternatives" : "; supply is moderate"}.`, `${poolCount} in pool`));

  const teamList = Object.values(teams);
  const teamsShort = teamList.filter((team) => {
    const squad = team.squad.map((id) => players[id]).filter((candidate): candidate is Player => !!candidate);
    const roleCount = squad.filter((candidate) => candidate.role === player.role).length;
    const target = player.role === "WK-Batsman" ? 2 : player.role === "All-Rounder" ? 3 : player.role === "Batsman" ? 5 : 4;
    const hasSlot = squad.length < team.maxSquadSize;
    const hasOverseasRoom = player.nationality === "Indian" || squad.filter((candidate) => candidate.nationality === "Overseas").length < team.overseasPlayersMax;
    return hasSlot && hasOverseasRoom && roleCount < target;
  }).length;
  factors.push(signed("Team demand", teamsShort >= 3 ? 0.1 : teamsShort === 0 ? -0.08 : 0,
    `${teamsShort} team${teamsShort === 1 ? "" : "s"} have room and are below their ${player.role.toLowerCase()} depth target${teamsShort >= 3 ? "; several potential bidders may lift the price" : teamsShort === 0 ? "; limited immediate squad need may reduce bidding" : ""}.`, `${teamsShort} teams need`));

  factors.push(signed("Eligibility", player.nationality === "Indian" ? 0.05 : -0.04,
    player.nationality === "Indian" ? "Indian eligibility does not use a limited overseas squad slot." : "An overseas signing uses a limited squad slot, narrowing the eligible bidders.", player.nationality === "Indian" ? "Indian slot" : "OS slot"));

  const experience = player.iplStats.matches;
  factors.push(signed("Experience", experience >= 60 ? 0.07 : experience === 0 ? 0 : 0.02,
    experience ? `${experience} IPL matches provide ${experience >= 60 ? "an established" : "some"} record for teams to assess.` : "No IPL appearances yet; this widens uncertainty but is not a penalty.", experience ? `${experience} IPL apps` : "Unproven"));

  const capped = player.isCapped;
  factors.push(signed("International", capped ? 0.06 : 0,
    capped ? "Internationally capped; national selection adds a visible experience signal." : "Uncapped; no international premium is applied.", capped ? "Capped" : "Uncapped"));

  const ipl = player.iplStats;
  const battingRelevant = player.role === "Batsman" || player.role === "WK-Batsman" || player.role === "All-Rounder";
  if (battingRelevant && (ipl.innings ?? 0) >= 10) {
    const sr = ipl.strikeRate;
    const avg = ipl.battingAverage;
    const effect = clamp((sr - 130) / 500 + (avg - 25) / 250, -0.12, 0.15);
    factors.push(signed("Batting", effect, `${Math.round(ipl.runs)} IPL runs in ${ipl.innings} innings, ${avg.toFixed(1)} average and ${sr.toFixed(1)} strike rate; ${effect > 0.025 ? "stronger output supports the estimate" : effect < -0.025 ? "lower output limits the estimate" : "near the reference level"}.`, `${Math.round(ipl.runs)} @ ${sr.toFixed(1)}`));
  }
  if (player.role === "Pace Bowler" || player.role === "Spin Bowler" || player.role === "All-Rounder") {
    if (ipl.bowlingInnings >= 10) {
      const economy = ipl.economy ?? (ipl.bowlingBalls && ipl.runsConceded ? ipl.runsConceded * 6 / ipl.bowlingBalls : 0);
      const wicketsPerInnings = ipl.wickets / ipl.bowlingInnings;
      const effect = clamp((wicketsPerInnings - 1) * 0.11 + (economy ? (8.5 - economy) * 0.035 : 0), -0.12, 0.15);
      factors.push(signed("Bowling", effect, `${ipl.wickets} wickets in ${ipl.bowlingInnings} bowling innings${economy ? ` at ${economy.toFixed(2)} economy` : ""}; ${effect > 0.025 ? "stronger output supports the estimate" : effect < -0.025 ? "lower output limits the estimate" : "near the reference level"}.`, economy ? `${ipl.wickets} @ ${economy.toFixed(1)}` : `${ipl.wickets} wickets`));
    }
  }

  const awards = (player.iplMvpSeasons?.length ?? 0) + (player.iplOrangeCapSeasons?.length ?? 0) + (player.iplPurpleCapSeasons?.length ?? 0);
  factors.push(signed("Honours", awards ? Math.min(0.12, awards * 0.04) : 0,
    awards ? `${awards} major IPL individual award${awards === 1 ? "" : "s"} provide a visible distinction.` : "No individual IPL awards recorded; no penalty is applied.", awards ? `${awards} awards` : "No awards"));

  const latestSeason = player.iplHistory.filter((entry) => Number(entry.season) >= currentSeason - 1 && entry.seasonStats && entry.seasonStats.matches >= 5).sort((a, b) => Number(b.season) - Number(a.season))[0];
  if (latestSeason?.seasonStats) {
    const stats = latestSeason.seasonStats;
    const batPerMatch = stats.runs / stats.matches;
    const bowlPerMatch = stats.wickets / stats.matches;
    const output = player.role === "Pace Bowler" || player.role === "Spin Bowler" ? bowlPerMatch : player.role === "All-Rounder" ? Math.max(bowlPerMatch * 20, batPerMatch) : batPerMatch;
    const effect = clamp((output - 20) / 180, -0.07, 0.08);
    factors.push(signed("Recent season", effect, `${stats.matches} matches in ${latestSeason.season}: ${stats.runs} runs and ${stats.wickets} wickets; ${effect > 0.025 ? "recent output adds to demand" : effect < -0.025 ? "limited recent output tempers demand" : "recent output is near the reference level"}.`, `${stats.runs} R / ${stats.wickets} W`));
  }

  if (player.isWicketkeeper || player.role === "WK-Batsman") factors.push(signed("Keeping", 0.04,
    "Wicketkeeping gives teams another way to fill a required XI role.", "Keeper"));
  if (ipl.matches >= 15 && ((ipl.catches ?? 0) + (ipl.stumpings ?? 0) + (ipl.runOuts ?? 0)) / ipl.matches > 0.6) {
    factors.push(signed("Fielding", 0.03, `${(ipl.catches ?? 0) + (ipl.stumpings ?? 0) + (ipl.runOuts ?? 0)} recorded catches, stumpings and run-outs in ${ipl.matches} IPL matches.`, `${(ipl.catches ?? 0) + (ipl.stumpings ?? 0) + (ipl.runOuts ?? 0)} dismissals`));
  }
  if (activeInjury) factors.push(signed("Availability", -0.12, `Currently injured (${activeInjury.conditionName}); immediate availability is uncertain.`, "Injured"));

  // Ability establishes the anchor, so its displayed contribution is not applied twice.
  const multiplier = factors.filter((factor) => factor.group !== "Current ability")
    .reduce((value, factor) => value * (1 + factor.effect), 1);
  const midpoint = Math.max(player.basePrice, Math.round(anchor * multiplier / 5) * 5);
  const uncertainty = experience === 0 ? 0.35 : experience < 15 ? 0.28 : 0.2;
  const low = Math.max(player.basePrice, Math.round(midpoint * (1 - uncertainty) / 5) * 5);
  const high = Math.max(low + 5, Math.round(midpoint * (1 + uncertainty) / 5) * 5);
  return { low, high, anchor, factors };
}
