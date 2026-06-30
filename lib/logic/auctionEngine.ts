import { Player, Team, AuctionState, BidEntry, Difficulty } from "@/lib/types";
import { getNextBidAmount, canTeamBidOnPlayer, canTeamAffordBid } from "./auctionRules";

export function computeAIValuation(
  player: Player,
  team: Team,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty
): number {
  const baseVal = player.starRating * player.basePrice * 2.5;

  // Need score: how badly does this team need this role
  const squadPlayers = team.squad.map((id) => allPlayers[id]).filter(Boolean);
  const needScore = computeNeedScore(player, squadPlayers, team);

  // Personality multiplier
  const personalityMult =
    team.aiPersonality === "Aggressive" ? 1.15 :
    team.aiPersonality === "Conservative" ? 0.88 : 1.0;

  // Difficulty multiplier
  const diffMult =
    difficulty === "Hard" ? 1.15 :
    difficulty === "Easy" ? 0.85 : 1.0;

  // Random variance ±10%
  const variance = 0.9 + Math.random() * 0.2;

  return Math.round(baseVal * needScore * personalityMult * diffMult * variance);
}

function computeNeedScore(player: Player, squad: Player[], team: Team): number {
  const roleCount = squad.filter((p) => p.role === player.role).length;
  const totalSquad = squad.length;

  // More need = higher multiplier
  if (roleCount === 0) return 1.3;
  if (totalSquad < 10) return 1.2;
  if (roleCount <= 2) return 1.1;
  if (roleCount >= 5) return 0.8;
  return 1.0;
}

export function shouldAIBid(
  team: Team,
  player: Player,
  currentBid: number,
  allPlayers: Record<string, Player>,
  difficulty: Difficulty
): boolean {
  const { canBid } = canTeamBidOnPlayer(team, player);
  if (!canBid) return false;

  const nextBid = getNextBidAmount(currentBid);
  if (!canTeamAffordBid(team, nextBid)) return false;

  // Keep a minimum reserve: 500L per remaining squad spot needed
  const spotsNeeded = Math.max(0, team.minSquadSize - team.squad.length - 1);
  const reserve = spotsNeeded * 200;
  if (team.remainingPurse - nextBid < reserve) return false;

  const valuation = computeAIValuation(player, team, allPlayers, difficulty);
  return nextBid <= valuation;
}

export function getAIBidDelay(): number {
  return 800 + Math.random() * 1200; // 0.8s – 2s
}

export function buildInitialTeamPurses(
  teams: Record<string, Team>
): Record<string, { remaining: number; squadCount: number }> {
  return Object.fromEntries(
    Object.values(teams).map((t) => [
      t.id,
      { remaining: t.remainingPurse, squadCount: t.squad.length },
    ])
  );
}

export function processBid(
  state: AuctionState,
  teamId: string,
  amount: number
): Partial<AuctionState> {
  const entry: BidEntry = { teamId, amount, timestamp: Date.now() };
  const newPurses = { ...state.teamPurses };
  newPurses[teamId] = { ...newPurses[teamId] };

  return {
    currentBid: amount,
    currentHighBidderTeamId: teamId,
    biddingHistory: [entry, ...state.biddingHistory],
    timerSeconds: 10,
  };
}
