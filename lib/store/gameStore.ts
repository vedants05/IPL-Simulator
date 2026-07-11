"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import {
  GameState,
  Player,
  Team,
  AuctionSet,
  SkipSetSummary,
  SkipSetResultItem,
  BidEntry,
  AuctionTargetPriority,
} from "@/lib/types";
import { fetchPlayersFromSupabase } from "@/lib/supabase/fetchPlayers";
import { fetchTeamsFromSupabase } from "@/lib/supabase/fetchTeams";
import {
  buildAuctionSets,
  getNextBidAmount,
  roundDownToLegalBid,
  canTeamBidOnPlayer,
  canTeamAffordBid,
  TOTAL_PURSE_LAKHS,
  MAX_AUCTION_TARGETS,
  calculateTotalRetentionCost,
  getPlayerRetentionCost,
  MAX_CAPPED_RETENTIONS,
  MAX_UNCAPPED_RETENTIONS,
  MAX_TOTAL_RETENTIONS,
  CAPPED_RETENTION_COSTS,
  UNCAPPED_RETENTION_COST,
  findRTMEligibleTeam,
} from "@/lib/logic/auctionRules";
import {
  buildInitialTeamPurses,
  processBid,
  canAIBidAtAmount,
  pickBiddingTeam,
  nextAIBidDelay,
  resetLotCache,
  resetAuctionQuirks,
  getCachedValuation,
  decideAIRetentions,
  AuctionContext,
  getLotValuation,
  ratingOf,
  isKeeper,
} from "@/lib/logic/auctionEngine";

// ---------------------------------------------------------------------------
// Store actions interface
// ---------------------------------------------------------------------------
interface GameStateAdditions {
  isPaused: boolean;
  speed: number;
  skipSetSummary: SkipSetSummary | null;
  auctionTargets: Record<string, number>;
  auctionTargetPriorities: Record<string, AuctionTargetPriority>;
}

interface GameActions {
  initNewGame: (userTeamId: string) => Promise<void>;
  refreshPlayersFromSupabase: () => Promise<void>;
  retainPlayer: (playerId: string) => void;
  releaseRetention: (playerId: string) => void;
  confirmRetentions: () => void;
  autoRetainPlayers: () => void;
  startAuction: () => void;
  placeBid: (teamId: string, amount: number) => void;
  passBid: () => void;
  // RTM actions — user as original team (offer phase)
  exerciseRtm: () => void;
  declineRtm: () => void;
  // RTM actions — user as winner team (winner_counter phase)
  raiseCounter: (amount: number) => void;
  passCounter: () => void;
  // RTM actions — user as original team (original_match phase)
  matchCounter: () => void;
  foldToCounter: () => void;
  tickTimer: () => void;
  tickRTMTimer: () => void;
  dismissSoldFlash: () => void;
  resetGame: () => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setUserTeam: (teamId: string) => void;
  increaseSpeed: () => void;
  decreaseSpeed: () => void;
  skipCurrentSet: () => void;
  skipAllAuction: () => void;
  skipToAcceleratedAuction: () => void;
  dismissSkipSetSummary: () => void;
  setAuctionTarget: (playerId: string, maxBidLakhs: number, priority?: AuctionTargetPriority) => void;
  removeAuctionTarget: (playerId: string) => void;
}

// ---------------------------------------------------------------------------
// Full store type
// ---------------------------------------------------------------------------
type Store = GameState & GameStateAdditions & GameActions;

// ---------------------------------------------------------------------------
// Helper: pick next player in sets
// ---------------------------------------------------------------------------
function pickNextLot(sets: AuctionSet[]): { setIndex: number; playerIndex: number } | null {
  for (let si = 0; si < sets.length; si++) {
    const set = sets[si];
    if (!set.isCompleted) {
      const unauctionedCount = set.playerIds.length - set.currentIndex;
      if (unauctionedCount > 0) {
        // Pick a random index from the remaining unauctioned players in this set
        const offset = Math.floor(Math.random() * unauctionedCount);
        const randomIndex = set.currentIndex + offset;

        // Swap randomly selected player into current lot position
        if (randomIndex !== set.currentIndex) {
          const temp = set.playerIds[set.currentIndex];
          set.playerIds[set.currentIndex] = set.playerIds[randomIndex];
          set.playerIds[randomIndex] = temp;
        }

        return { setIndex: si, playerIndex: set.currentIndex };
      }
    }
  }
  return null;
}

function allSetsComplete(sets: AuctionSet[]): boolean {
  return sets.every((s) => s.isCompleted);
}

function removeResolvedAuctionTargets<T>(
  targets: Record<string, T>,
  resolvedPlayerIds: Iterable<string>
): Record<string, T> {
  const remainingTargets = { ...targets };
  Array.from(resolvedPlayerIds).forEach((playerId) => delete remainingTargets[playerId]);
  return remainingTargets;
}

function getTargetBidBlockReason(
  team: Team,
  player: Player,
  bidAmount: number,
  players: Record<string, Player>,
  boughtEarlierInSkip: boolean,
  protectedTargetReserve = 0
): string | null {
  if (team.remainingPurse - bidAmount < protectedTargetReserve) {
    return "Funds reserved for higher-priority targets";
  }
  if (boughtEarlierInSkip && !canTeamAffordBid(team, bidAmount, players)) {
    return "Insufficient Purse remaining after earlier skipped purchases";
  }

  if (team.squad.length >= team.maxSquadSize) return "Max Squad Size Reached";
  if (player.nationality === "Overseas" && team.overseasPlayersCurrent >= team.overseasPlayersMax) {
    return "Hit Overseas Limit";
  }
  if (team.remainingPurse < bidAmount) return "Insufficient Purse";
  if (!canTeamAffordBid(team, bidAmount, players)) {
    const squad = team.squad.map((id) => players[id]).filter(Boolean);
    const isKeeperPlayer = (p: Player) => !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
    const bowlers = squad.filter((p) => p.role === "Pace Bowler" || p.role === "Spin Bowler").length;
    const spinners = squad.filter((p) => p.role === "Spin Bowler").length;
    const keepers = squad.filter(isKeeperPlayer).length;
    const indianBowlers = squad.filter((p) => p.nationality === "Indian" && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;
    const rating = (p: Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);
    const indianBatters = squad.filter((p) => p.nationality === "Indian" && (p.role === "Batsman" || p.role === "WK-Batsman"));
    const missingRoles = bowlers < 5 || spinners < 2 || keepers < 2 || indianBowlers < 4 ||
      indianBatters.filter((p) => rating(p) > 74).length < 5 ||
      indianBatters.filter((p) => rating(p) > 77).length < 3;
    return missingRoles ? "Other roles required" : "Insufficient Purse - You need to purchase more players!";
  }
  return null;
}

function canTeamBidDuringSkip(
  t: Team,
  p: Player,
  nextBid: number,
  playerId: string,
  newPlayers: Record<string, Player>,
  ctx: AuctionContext,
  userTeamId: string,
  targetMaxBid?: number,
  protectedTargetReserve = 0
): boolean {
  if (t.id === userTeamId) {
    const { canBid } = canTeamBidOnPlayer(t, p, newPlayers, false);
    if (!canBid) return false;
    if (!canTeamAffordBid(t, nextBid, newPlayers)) return false;
    if (t.remainingPurse - nextBid < protectedTargetReserve) return false;
    if (targetMaxBid !== undefined) return nextBid <= targetMaxBid;

    const squad = t.squad.map(id => newPlayers[id]).filter(Boolean);

    // ---- WICKETKEEPER-OPENER EXCLUSION RULE ----
    const isOpenerWK = isKeeper(p) && (p.isOpener || p.onlyOpensOrBenched);
    if (isOpenerWK) {
      const specialPairs = [
        ["sunil-narine", "finn-allen"],
        ["yashasvi-jaiswal", "vaibhav-suryavanshi"],
        ["travis-head", "abhishek-sharma"],
        ["shubman-gill", "sai-sudharsan"],
        ["prabhsimran-singh", "priyansh-arya"]
      ];
      const hasSpecialPair = specialPairs.some(pair => 
        t.squad.some(id => id.startsWith(pair[0])) && t.squad.some(id => id.startsWith(pair[1]))
      );
      const playerRating = ratingOf(p);
      const openersAboveRating = squad.filter(x => x.isOpener && ratingOf(x) > playerRating).length;

      if (hasSpecialPair || openersAboveRating >= 2) {
        return false;
      }
    }

    if (p.nationality === "Overseas") {
      const overseas = squad.filter(x => x.nationality === "Overseas").length;
      if (overseas >= 8) return false;
    }

    const currentSquadSize = squad.length;
    const minSquad = t.minSquadSize ?? 18;
    if (currentSquadSize >= minSquad) {
      if (currentSquadSize >= t.maxSquadSize - 1) return false;
    } else {
      if (currentSquadSize >= t.maxSquadSize) return false;
    }

    const slotsTo22 = Math.max(0, 22 - currentSquadSize);
    const fillerReserve = (slotsTo22 - 1) * 30;

    if (currentSquadSize < minSquad) {
      const slotsNeeded = minSquad - currentSquadSize;
      const neededReserve = Math.max((slotsNeeded - 1) * 30, fillerReserve);
      if (t.remainingPurse - nextBid < neededReserve) return false;
    } else {
      // Even if above minSquad, check if we need to reserve for remaining slots up to 22
      if (t.remainingPurse - nextBid < fillerReserve) return false;

      // Lower cushion from 200 Lakhs to 50 Lakhs to prevent bidding lockouts for cheap backups
      if (t.remainingPurse >= 50 && nextBid >= 50) {
        if (t.remainingPurse - nextBid < 50) return false;
      }
      if (t.remainingPurse - nextBid < 0) return false;
    }

    const valuation = getLotValuation(playerId, t, p, newPlayers, ctx);
    if (valuation === 0) return false;
    if (nextBid > valuation) return false;

    return true;
  } else {
    return canAIBidAtAmount(t, p, nextBid, playerId, newPlayers, ctx);
  }
}

function getProtectedTargetReserve(
  currentPlayerId: string,
  pendingTargetIds: Set<string>,
  targets: Record<string, number>,
  priorities: Record<string, AuctionTargetPriority>,
  team: Team,
  players: Record<string, Player>
): number {
  const rank: Record<AuctionTargetPriority, number> = { low: 0, medium: 1, high: 2 };
  const currentPriority = priorities[currentPlayerId] ?? "medium";
  return Array.from(pendingTargetIds).reduce((reserve, playerId) => {
    const priority = priorities[playerId] ?? "medium";
    if (rank[priority] <= rank[currentPriority]) return reserve;
    const player = players[playerId];
    if (!player) return reserve;
    if (!canTeamBidOnPlayer(team, player, players, false).canBid) return reserve;
    if (!canTeamAffordBid(team, player.basePrice, players)) return reserve;
    return reserve + (targets[playerId] ?? 0);
  }, 0);
}

function canAffordTargetRtm(
  team: Team,
  amount: number,
  players: Record<string, Player>,
  isUserTeam: boolean,
  priority: AuctionTargetPriority,
  protectedReserve: number
): boolean {
  if (!canTeamAffordBid(team, amount, players)) return false;
  return !isUserTeam || priority === "high" || team.remainingPurse - amount >= protectedReserve;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useGameStore = create<Store>()(
  persist(
    (set, get) => ({
      // ----- State -----
      saveId: "",
      saveCreatedAt: "",
      currentDate: "2026-10-01",
      currentSeason: 2027,
      auctionCycle: 1,
      players: {},
      teams: {},
      userTeamId: "",
      auction: null,
      isSetupComplete: false,
      isPaused: false,
      speed: 1,
      skipSetSummary: null,
      auctionTargets: {},
      auctionTargetPriorities: {},

      // ----- Actions -----
      initNewGame: async (userTeamId) => {
        const [fetchedPlayers, fetchedTeams] = await Promise.all([
          fetchPlayersFromSupabase(),
          fetchTeamsFromSupabase(),
        ]);

        const playersMap: Record<string, Player> = {};
        fetchedPlayers.forEach((p: Player) => {
          playersMap[p.id] = { ...p, currentTeamId: null, isRetained: false, retainedByTeamId: null };
        });

        const teamsMap: Record<string, Team> = {};
        fetchedTeams.forEach((t) => {
          const teamPlayers = fetchedPlayers.filter((p: Player) => 
            p.currentTeamId === t.id
          );
          teamsMap[t.id] = {
            ...t,
            squad: teamPlayers.map((p: Player) => p.id),
            retainedPlayers: [],
            remainingPurse: TOTAL_PURSE_LAKHS,
            spentAmount: 0,
            minSquadSize: t.id === userTeamId ? 18 : 22,
          };
        });

        set({
          saveId: uuidv4(),
          saveCreatedAt: new Date().toISOString(),
          currentDate: "2026-10-01",
          currentSeason: 2026,
          auctionCycle: 1,
          players: playersMap,
          teams: teamsMap,
          userTeamId,
          auctionTargets: {},
          auctionTargetPriorities: {},
          auction: {
            type: "mega",
            season: 2026,
            phase: "retention",
            allPlayerIds: [],
            soldPlayerIds: [],
            unsoldPlayerIds: [],
            currentLotIndex: 0,
            currentPlayer: null,
            currentBid: 0,
            currentHighBidderTeamId: null,
            biddingHistory: [],
            timerSeconds: 10,
            sets: [],
            currentSetIndex: 0,
            teamPurses: {},
            isAcceleratedPhase: false,
            rtm: null,
            soldFlash: null,
            unsoldFlash: null,
            saleHistory: [],
          },
          isSetupComplete: false,
        });
      },

      refreshPlayersFromSupabase: async () => {
        const fetchedPlayers = await fetchPlayersFromSupabase();
        const state = get();
        if (Object.keys(state.players).length === 0) return;

        const refreshedPlayers = { ...state.players };
        fetchedPlayers.forEach((freshPlayer) => {
          const savedPlayer = state.players[freshPlayer.id];
          refreshedPlayers[freshPlayer.id] = savedPlayer
            ? {
                ...freshPlayer,
                currentTeamId: savedPlayer.currentTeamId,
                isRetained: savedPlayer.isRetained,
                retainedByTeamId: savedPlayer.retainedByTeamId,
              }
            : freshPlayer;
        });

        const currentPlayerId = state.auction?.currentPlayer?.id;
        const refreshedCurrentPlayer = currentPlayerId
          ? refreshedPlayers[currentPlayerId] ?? state.auction?.currentPlayer ?? null
          : null;
        const refreshedSummary = state.skipSetSummary
          ? {
              ...state.skipSetSummary,
              results: state.skipSetSummary.results.map((result) => ({
                ...result,
                player: refreshedPlayers[result.player.id] ?? result.player,
              })),
            }
          : null;

        set({
          players: refreshedPlayers,
          auction: state.auction
            ? { ...state.auction, currentPlayer: refreshedCurrentPlayer }
            : null,
          skipSetSummary: refreshedSummary,
        });
      },

      retainPlayer: (playerId) => {
        const { teams, userTeamId, players } = get();
        const team = teams[userTeamId];
        if (!team) return;
        if (team.retainedPlayers.length >= MAX_TOTAL_RETENTIONS) return;
        if (team.retainedPlayers.includes(playerId)) return;

        const player = players[playerId];
        if (!player) return;

        const isPlayerCapped = player.isCapped || player.nationality === "Overseas";
        const cappedCount = team.retainedPlayers.filter((id) => {
          const p = players[id];
          return p && (p.isCapped || p.nationality === "Overseas");
        }).length;
        const uncappedCount = team.retainedPlayers.length - cappedCount;

        if (isPlayerCapped && cappedCount >= MAX_CAPPED_RETENTIONS) return;
        if (!isPlayerCapped && uncappedCount >= MAX_UNCAPPED_RETENTIONS) return;

        const newRetained = [...team.retainedPlayers, playerId];
        const newTotalCost = calculateTotalRetentionCost(newRetained, players);

        set((state) => ({
          teams: {
            ...state.teams,
            [userTeamId]: {
              ...team,
              retainedPlayers: newRetained,
              remainingPurse: TOTAL_PURSE_LAKHS - newTotalCost,
              spentAmount: newTotalCost,
            },
          },
          players: {
            ...state.players,
            [playerId]: { ...player, isRetained: true, retainedByTeamId: userTeamId },
          },
        }));
      },

      releaseRetention: (playerId) => {
        const { teams, userTeamId, players } = get();
        const team = teams[userTeamId];
        if (!team) return;
        if (!team.retainedPlayers.includes(playerId)) return;

        const player = players[playerId];
        const newRetained = team.retainedPlayers.filter((id) => id !== playerId);
        const newTotalCost = calculateTotalRetentionCost(newRetained, players);

        set((state) => ({
          teams: {
            ...state.teams,
            [userTeamId]: {
              ...team,
              retainedPlayers: newRetained,
              remainingPurse: TOTAL_PURSE_LAKHS - newTotalCost,
              spentAmount: newTotalCost,
            },
          },
          players: {
            ...state.players,
            [playerId]: { ...player, isRetained: false, retainedByTeamId: null },
          },
        }));
      },

      autoRetainPlayers: () => {
        const { teams, userTeamId, players } = get();
        const team = teams[userTeamId];
        if (!team) return;

        const resetTeams = { ...teams };
        const resetPlayers = { ...players };

        team.retainedPlayers.forEach((pid) => {
          const p = resetPlayers[pid];
          if (p) resetPlayers[pid] = { ...p, isRetained: false, retainedByTeamId: null };
        });

        resetTeams[userTeamId] = {
          ...team,
          retainedPlayers: [],
          remainingPurse: TOTAL_PURSE_LAKHS,
          spentAmount: 0,
        };

        const autoRetainedIds = decideAIRetentions(resetTeams[userTeamId], resetPlayers);

        autoRetainedIds.forEach((pid) => {
          const p = resetPlayers[pid];
          if (p) resetPlayers[pid] = { ...p, isRetained: true, retainedByTeamId: userTeamId };
        });

        const newTotalCost = calculateTotalRetentionCost(autoRetainedIds, resetPlayers);

        set({
          teams: {
            ...teams,
            [userTeamId]: {
              ...team,
              retainedPlayers: autoRetainedIds,
              remainingPurse: TOTAL_PURSE_LAKHS - newTotalCost,
              spentAmount: newTotalCost,
            },
          },
          players: resetPlayers,
        });
      },

      confirmRetentions: () => {
        const { teams, players, userTeamId } = get();

        // Fresh per-auction AI quirks (fuzzed roster targets, temperament,
        // budget envelopes) — sampled once per auction inside the engine
        resetAuctionQuirks();

        // Build player pool: all non-retained players
        const allPlayerIds = Object.values(players)
          .filter((p) => !p.isRetained)
          .map((p) => p.id);

        // AI teams: engine weighs each player's estimated worth against the
        // retention slab costs (loyalty DNA, reputation, age, potential…)
        const updatedTeams = { ...teams };
        const updatedPlayers = { ...players };

        Object.values(teams).forEach((team) => {
          if (team.id === userTeamId) return;

          const retainedIds = decideAIRetentions(team, players);
          retainedIds.forEach((pid) => {
            const p = players[pid];
            if (!p) return;
            const retentionCost = getPlayerRetentionCost(pid, retainedIds, players);
            const updatedHistory = [
              ...p.iplHistory.filter((h) => h.season !== "2027"),
              { teamId: team.id, season: "2027", price: retentionCost },
            ];
            updatedPlayers[pid] = {
              ...p,
              isRetained: true,
              retainedByTeamId: team.id,
              currentTeamId: team.id,
              iplHistory: updatedHistory,
            };
            const poolIdx = allPlayerIds.indexOf(pid);
            if (poolIdx !== -1) allPlayerIds.splice(poolIdx, 1);
          });

          const totalCost = calculateTotalRetentionCost(retainedIds, updatedPlayers);

          updatedTeams[team.id] = {
            ...team,
            retainedPlayers: retainedIds,
            remainingPurse: TOTAL_PURSE_LAKHS - totalCost,
            spentAmount: totalCost,
            squad: retainedIds,
            // RTM cards = 6 minus number of retentions (per IPL rules)
            rtmCardsTotal: Math.max(0, MAX_TOTAL_RETENTIONS - retainedIds.length),
          };
        });

        // User team retentions history update
        const userTeam = updatedTeams[userTeamId];
        userTeam.retainedPlayers.forEach((pid) => {
          const p = updatedPlayers[pid];
          if (!p) return;
          const retentionCost = getPlayerRetentionCost(pid, userTeam.retainedPlayers, players);
          const updatedHistory = [
            ...p.iplHistory.filter((h) => h.season !== "2027"),
            { teamId: userTeamId, season: "2027", price: retentionCost },
          ];
          updatedPlayers[pid] = {
            ...p,
            isRetained: true,
            retainedByTeamId: userTeamId,
            currentTeamId: userTeamId,
            iplHistory: updatedHistory,
          };
        });

        updatedTeams[userTeamId] = {
          ...userTeam,
          squad: userTeam.retainedPlayers,
          rtmCardsTotal: Math.max(0, MAX_TOTAL_RETENTIONS - userTeam.retainedPlayers.length),
        };

        const sets = buildAuctionSets(
          allPlayerIds.map((id) => updatedPlayers[id]).filter(Boolean)
        );

        const teamPurses = buildInitialTeamPurses(updatedTeams);

        set((state) => ({
          teams: updatedTeams,
          players: updatedPlayers,
          isSetupComplete: true,
          auction: state.auction
            ? {
                ...state.auction,
                phase: "live",
                allPlayerIds,
                sets,
                teamPurses,
              }
            : null,
        }));
      },

      startAuction: () => {
        const { auction, players, teams } = get();
        if (!auction || auction.phase !== "live") return;

        const updatedTeams = { ...teams };

        let activeSets = auction.sets;
        if (!activeSets || activeSets.length === 0) {
          const unretained = Object.values(players).filter((p) => !p.isRetained);
          activeSets = buildAuctionSets(unretained.length > 0 ? unretained : Object.values(players));
          set((state) => ({
            auction: state.auction ? { ...state.auction, sets: activeSets, currentSetIndex: 0 } : null,
          }));
        }

        if (activeSets.length === 0) return;

        const next = pickNextLot(activeSets);
        if (!next) return;

        const currentSet = activeSets[next.setIndex];
        const playerId = currentSet.playerIds[next.playerIndex];
        const player = players[playerId];

        set((state) => ({
          teams: updatedTeams,
          auction: state.auction
            ? {
                ...state.auction,
                currentSetIndex: next.setIndex,
                currentPlayer: player,
                currentBid: player.basePrice,
                currentHighBidderTeamId: null,
                biddingHistory: [],
                timerSeconds: 10,
                rtm: null,
                soldFlash: null,
                unsoldFlash: null,
              }
            : null,
        }));

        // Fresh lot — reset AI valuation cache and kick off first round
        resetLotCache();
        scheduleAIBids(player);
      },

      placeBid: (teamId, amount) => {
        const { auction, teams, players } = get();
        if (!auction || !auction.currentPlayer) return;

        const team = teams[teamId];
        if (!team) return;

        const { canBid } = canTeamBidOnPlayer(team, auction.currentPlayer, players, teamId !== get().userTeamId);
        if (!canBid) return;
        if (!canTeamAffordBid(team, amount, players)) return;

        const updates = processBid(amount, teamId, auction.biddingHistory);

        set((state) => ({
          auction: state.auction ? { ...state.auction, ...updates } : null,
        }));
      },

      passBid: () => {
        const { auction, players } = get();
        if (!auction?.currentPlayer) return;
        simulateRemainingBids(auction.currentPlayer);
      },

      // ---- RTM: user is original team, AI is winner ----

      exerciseRtm: () => {
        const { auction, teams, userTeamId, players } = get();
        if (!auction?.rtm || auction.rtm.phase !== "offer") return;
        if (auction.rtm.originalTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { winnerTeamId, baseAmount } = auction.rtm;
        const userTeam = teams[userTeamId];
        if (userTeam && !canTeamAffordBid(userTeam, baseAmount, players)) return; // Cannot afford RTM

        const player = auction.currentPlayer;
        const winnerValuation = getCachedValuation(winnerTeamId);

        // Winner AI counter decision: counter if their valuation > soldAmount by ≥5%
        if (winnerValuation > baseAmount * 1.05) {
          // AI counters to some point between baseAmount and their valuation
          let counterAmount = baseAmount;
          const target = Math.min(winnerValuation, Math.round(baseAmount * 1.25));
          while (counterAmount < target) {
            counterAmount = getNextBidAmount(counterAmount);
          }
          if (counterAmount <= baseAmount) counterAmount = getNextBidAmount(baseAmount);

          set((s) => ({
            auction: s.auction?.rtm
              ? {
                  ...s.auction,
                  rtm: { ...s.auction.rtm, phase: "original_match" as const, raisedAmount: counterAmount, timerSeconds: 15 },
                }
              : s.auction,
          }));
        } else {
          // AI doesn't counter → user gets player at baseAmount
          doRTMTransfer(userTeamId, winnerTeamId, player, baseAmount, baseAmount);
        }
      },

      declineRtm: () => {
        const { auction } = get();
        if (!auction?.rtm) return;
        const { winnerTeamId, baseAmount } = auction.rtm;
        set((s) => {
          const a = s.auction;
          if (!a?.currentPlayer) return {};
          return {
            auction: {
              ...a,
              rtm: null,
              soldFlash: { playerId: a.currentPlayer.id, teamId: winnerTeamId, amount: baseAmount },
              saleHistory: [...(a.saleHistory ?? []), { playerId: a.currentPlayer.id, teamId: winnerTeamId, price: baseAmount, lot: a.currentLotIndex, bids: a.biddingHistory }],
            },
          };
        });
        setTimeout(() => advanceToNextLot(), 2200);
      },

      // ---- RTM: user is winner, AI is original team ----

      raiseCounter: (amount) => {
        const { auction, teams, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "winner_counter") return;
        if (auction.rtm.winnerTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const userTeam = teams[userTeamId];
        if (userTeam && userTeam.remainingPurse < amount) return; // Cannot afford raised amount

        const { originalTeamId, baseAmount } = auction.rtm;
        const player = auction.currentPlayer;
        const aiValuation = getCachedValuation(originalTeamId);

        if (aiValuation >= amount) {
          // AI matches counter: AI (original) gets player at amount
          doRTMTransfer(originalTeamId, userTeamId, player, amount, baseAmount);
        } else {
          // AI folds: user keeps player but pays 'amount' (extra above baseAmount)
          doWinnerKeepsAtCounter(userTeamId, baseAmount, amount, player);
        }
      },

      passCounter: () => {
        const { auction, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "winner_counter") return;
        if (auction.rtm.winnerTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { originalTeamId, baseAmount } = auction.rtm;
        const player = auction.currentPlayer;
        // User doesn't raise → AI original gets player at baseAmount
        doRTMTransfer(originalTeamId, userTeamId, player, baseAmount, baseAmount);
      },

      // ---- RTM: user is original team, counter-bid phase ----

      matchCounter: () => {
        const { auction, teams, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "original_match") return;
        if (auction.rtm.originalTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { winnerTeamId, baseAmount, raisedAmount } = auction.rtm;
        const userTeam = teams[userTeamId];
        if (userTeam && userTeam.remainingPurse < raisedAmount) return; // Cannot afford raised amount

        const player = auction.currentPlayer;
        doRTMTransfer(userTeamId, winnerTeamId, player, raisedAmount, baseAmount);
      },

      foldToCounter: () => {
        const { auction, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "original_match") return;
        if (auction.rtm.originalTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { winnerTeamId, baseAmount, raisedAmount } = auction.rtm;
        const player = auction.currentPlayer;
        doWinnerKeepsAtCounter(winnerTeamId, baseAmount, raisedAmount, player);
      },

      tickTimer: () => {
        const { auction, isPaused } = get();
        if (isPaused) return;
        if (!auction || auction.phase !== "live" || !auction.currentPlayer) return;
        if (auction.rtm) return;
        if (auction.soldFlash) return;
        if (auction.unsoldFlash) return;

        if (auction.timerSeconds <= 0) {
          hammerFall();
          return;
        }

        set((state) => ({
          auction: state.auction
            ? { ...state.auction, timerSeconds: state.auction.timerSeconds - 1 }
            : null,
        }));
      },

      tickRTMTimer: () => {
        const { auction, isPaused } = get();
        if (isPaused) return;
        if (!auction?.rtm) return;

        if (auction.rtm.timerSeconds <= 0) {
          // Auto-action on timeout based on phase and user role
          const { rtm } = auction;
          const { userTeamId } = get();
          if (rtm.phase === "offer" && rtm.originalTeamId === userTeamId) get().declineRtm();
          if (rtm.phase === "winner_counter" && rtm.winnerTeamId === userTeamId) get().passCounter();
          if (rtm.phase === "original_match" && rtm.originalTeamId === userTeamId) get().foldToCounter();
          return;
        }

        set((state) => ({
          auction: state.auction?.rtm
            ? { ...state.auction, rtm: { ...state.auction.rtm, timerSeconds: state.auction.rtm.timerSeconds - 1 } }
            : state.auction,
        }));
      },

      dismissSoldFlash: () => {
        set((state) => ({
          auction: state.auction ? { ...state.auction, soldFlash: null, unsoldFlash: null } : null,
        }));
      },

      setPaused: (paused: boolean) => {
        set({ isPaused: paused });
      },

      togglePaused: () => {
        set((state) => ({ isPaused: !state.isPaused }));
      },

      setUserTeam: (teamId: string) => {
        if (!get().teams[teamId]) return;
        set({ userTeamId: teamId });
      },

      increaseSpeed: () => {
        set((state) => {
          let nextSpeed = state.speed;
          if (state.speed === 1) nextSpeed = 2;
          else if (state.speed === 2) nextSpeed = 4;
          else if (state.speed === 4) nextSpeed = 8;
          return { speed: nextSpeed };
        });
      },

      decreaseSpeed: () => {
        set((state) => {
          let nextSpeed = state.speed;
          if (state.speed === 8) nextSpeed = 4;
          else if (state.speed === 4) nextSpeed = 2;
          else if (state.speed === 2) nextSpeed = 1;
          return { speed: nextSpeed };
        });
      },

      dismissSkipSetSummary: () => {
        set({ skipSetSummary: null, isPaused: false });
        advanceToNextLot();
      },

      setAuctionTarget: (playerId, maxBidLakhs, priority = "medium") => {
        const { players, teams, userTeamId, auctionTargets } = get();
        const player = players[playerId];
        const userTeam = teams[userTeamId];
        if (!player || !Number.isFinite(maxBidLakhs) || maxBidLakhs < player.basePrice) return;
        if (!userTeam) return;
        if (!canTeamBidOnPlayer(userTeam, player, players, false).canBid) return;
        if (!canTeamAffordBid(userTeam, player.basePrice, players)) return;
        if (auctionTargets[playerId] === undefined && Object.keys(auctionTargets).length >= MAX_AUCTION_TARGETS) return;
        const legalMaxBid = roundDownToLegalBid(player.basePrice, maxBidLakhs);
        set((state) => ({
          auctionTargets: { ...state.auctionTargets, [playerId]: legalMaxBid },
          auctionTargetPriorities: { ...state.auctionTargetPriorities, [playerId]: priority },
        }));
      },

      removeAuctionTarget: (playerId) => {
        set((state) => {
          const auctionTargets = { ...state.auctionTargets };
          const auctionTargetPriorities = { ...state.auctionTargetPriorities };
          delete auctionTargets[playerId];
          delete auctionTargetPriorities[playerId];
          return { auctionTargets, auctionTargetPriorities };
        });
      },

      skipCurrentSet: () => {
        const state = get();
        const { auction, players, teams, userTeamId, auctionTargets, auctionTargetPriorities } = state;
        if (!auction || auction.phase !== "live") return;

        const currentSet = auction.sets[auction.currentSetIndex];
        if (!currentSet || currentSet.isCompleted) return;

        _hammerLotId = null;

        const newTeams = { ...teams };
        const newPlayers = { ...players };
        const newSoldIds = [...(auction.soldPlayerIds ?? [])];
        const newUnsoldIds = [...(auction.unsoldPlayerIds ?? [])];
        const newSaleHistory = [...(auction.saleHistory ?? [])];
        let currentLotIndex = auction.currentLotIndex;

        const setPlayerIds = currentSet.playerIds;
        const startIndex = currentSet.currentIndex;
        const playersToAuctionIds = setPlayerIds.slice(startIndex);
        const pendingTargetIds = new Set(
          Object.keys(auctionTargets).filter(
            (id) => !auction.soldPlayerIds.includes(id) && !auction.unsoldPlayerIds.includes(id)
          )
        );

        const results: SkipSetResultItem[] = [];
        const totalLots = auction.sets.reduce((sum, s) => sum + s.playerIds.length, 0);

        // The first player in this slice is the one already on the block, so it
        // keeps the current lot number; only subsequent players advance the lot.
        let isFirstProcessed = true;
        let userPurchasesDuringSkip = 0;

        playersToAuctionIds.forEach((playerId) => {
          const player = newPlayers[playerId];
          if (!player) return;

          const isCurrentLiveLot = isFirstProcessed && auction.currentPlayer?.id === player.id;
          if (!isFirstProcessed) currentLotIndex++;
          isFirstProcessed = false;
          resetLotCache();

          const ctx: AuctionContext = {
            remainingPlayerIds: auction.allPlayerIds.filter(
              (id) => !newSoldIds.includes(id) && id !== player.id
            ),
            soldPlayerIds: newSoldIds,
            currentLotIndex,
            totalLots,
            isAcceleratedPhase: auction.isAcceleratedPhase,
          };

          let currentBid = isCurrentLiveLot ? auction.currentBid : player.basePrice;
          let highBidderTeamId: string | null = isCurrentLiveLot
            ? auction.currentHighBidderTeamId
            : null;
          let biddingHistory: BidEntry[] = isCurrentLiveLot
            ? [...auction.biddingHistory]
            : [];

          let iterations = 0;
          const MAX_ITER = 300;
          const targetMaxBid = auctionTargets[player.id];
          const targetPriority = auctionTargetPriorities[player.id] ?? "medium";
          pendingTargetIds.delete(player.id);
          const protectedTargetReserve = getProtectedTargetReserve(
            player.id, pendingTargetIds, auctionTargets, auctionTargetPriorities, newTeams[userTeamId], newPlayers
          );
          while (iterations < MAX_ITER) {
            iterations++;
            const nextBid: number = highBidderTeamId ? getNextBidAmount(currentBid) : currentBid;

            const interested: Team[] = Object.values(newTeams).filter((t: Team): boolean => {
              if (t.id === highBidderTeamId) return false;
              if (t.id === userTeamId) {
                return targetMaxBid !== undefined && canTeamBidDuringSkip(
                  t, player, nextBid, player.id, newPlayers, ctx, userTeamId, targetMaxBid, protectedTargetReserve
                );
              }
              if (auction.isAcceleratedPhase) {
                return canAIBidAtAmount(t, player, nextBid, player.id, newPlayers, ctx);
              } else {
                return canAIBidAtAmount(t, player, nextBid, player.id, newPlayers, ctx);
              }
            });

            if (interested.length === 0) break;

            const bidder: Team | null | undefined = interested.find((team: Team) => team.id === userTeamId && targetMaxBid !== undefined)
              ?? pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
            if (!bidder) break;

            currentBid = nextBid;
            highBidderTeamId = bidder.id;
            biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
          }

          if (!highBidderTeamId) {
            newUnsoldIds.push(player.id);
            results.push({
              player,
              status: "unsold",
              targetRemainsActive: targetMaxBid !== undefined && !auction.isAcceleratedPhase,
              targetMissReason: targetMaxBid !== undefined && auction.isAcceleratedPhase
                ? getTargetBidBlockReason(newTeams[userTeamId], player, player.basePrice, newPlayers, userPurchasesDuringSkip > 0, protectedTargetReserve) ?? "Too expensive"
                : undefined,
            });
          } else {
            let finalWinnerId = highBidderTeamId;
            let finalPrice = currentBid;
            let usedRtm = false;

            const rtmTeamId = findRTMEligibleTeam(player, newTeams, highBidderTeamId, currentBid);

            if (rtmTeamId) {
              const rtmTeam = newTeams[rtmTeamId];
              const aiOrigValuation = rtmTeamId === userTeamId && targetMaxBid !== undefined
                ? targetMaxBid
                : getCachedValuation(rtmTeamId);
              const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
              const rtmCeiling = rtmTeamId === userTeamId ? aiOrigValuation : aiOrigValuation * loyaltyBonus;

              if (rtmCeiling >= currentBid && canAffordTargetRtm(rtmTeam, currentBid, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                const winnerTeam = newTeams[highBidderTeamId];
                const aiWinnerValuation = getCachedValuation(highBidderTeamId);

                if (aiWinnerValuation > currentBid * 1.05 && winnerTeam.remainingPurse >= currentBid * 1.05) {
                  let counterAmount = currentBid;
                  const target = Math.min(aiWinnerValuation, Math.round(currentBid * 1.25));
                  while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
                  if (counterAmount <= currentBid) counterAmount = getNextBidAmount(currentBid);

                  if (rtmCeiling >= counterAmount && canAffordTargetRtm(rtmTeam, counterAmount, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                    finalWinnerId = rtmTeamId;
                    finalPrice = counterAmount;
                    usedRtm = true;
                  } else {
                    finalWinnerId = highBidderTeamId;
                    finalPrice = counterAmount;
                  }
                } else {
                  finalWinnerId = rtmTeamId;
                  finalPrice = currentBid;
                  usedRtm = true;
                }
              }
            }

            // A skipped-auction target is a hard ceiling, including RTM counters.
            if (finalWinnerId === userTeamId && targetMaxBid !== undefined && rtmTeamId &&
                (finalPrice > targetMaxBid || (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve))) {
              finalWinnerId = rtmTeamId;
              finalPrice = currentBid;
              usedRtm = true;
            }

            const winnerTeam = newTeams[finalWinnerId];
            if (winnerTeam) {
              newTeams[finalWinnerId] = {
                ...winnerTeam,
                squad: [...winnerTeam.squad, player.id],
                remainingPurse: winnerTeam.remainingPurse - finalPrice,
                spentAmount: winnerTeam.spentAmount + finalPrice,
                rtmCardsUsed: usedRtm ? winnerTeam.rtmCardsUsed + 1 : winnerTeam.rtmCardsUsed,
                overseasPlayersCurrent:
                  player.nationality === "Overseas"
                    ? winnerTeam.overseasPlayersCurrent + 1
                    : winnerTeam.overseasPlayersCurrent,
              };
            }

            // Record the sale under the auction season ("2027"), matching the
            // live hammerFall / doRTMTransfer flow so skip-sold and live-sold
            // players have identical, accurate iplHistory.
            const updatedHistory = [
              ...player.iplHistory.filter((h) => h.season !== "2027"),
              { teamId: finalWinnerId, season: "2027", price: finalPrice, isRtm: usedRtm },
            ];

            newPlayers[player.id] = {
              ...player,
              currentTeamId: finalWinnerId,
              iplHistory: updatedHistory,
            };

            newSoldIds.push(player.id);

            newSaleHistory.push({
              playerId: player.id,
              teamId: finalWinnerId,
              price: finalPrice,
              lot: currentLotIndex,
              bids: biddingHistory,
            });

            let targetMissReason: string | undefined;
            if (targetMaxBid !== undefined && finalWinnerId !== userTeamId) {
              if (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve) {
                targetMissReason = "Funds reserved for higher-priority targets";
              } else if (usedRtm && finalPrice <= targetMaxBid) {
                targetMissReason = `${newTeams[finalWinnerId]?.name ?? finalWinnerId} exercised RTM`;
              } else if (finalPrice > targetMaxBid) {
                targetMissReason = "Too expensive";
              } else {
                targetMissReason = getTargetBidBlockReason(
                  newTeams[userTeamId], player, currentBid, newPlayers, userPurchasesDuringSkip > 0, protectedTargetReserve
                ) ?? "Too expensive";
              }
            }

            if (finalWinnerId === userTeamId) userPurchasesDuringSkip++;

            results.push({
              player: newPlayers[player.id],
              status: "sold",
              teamId: finalWinnerId,
              price: finalPrice,
              usedRtm,
              targetMissReason,
            });
          }
        });

        const updatedSets = auction.sets.map((s, i) => {
          if (i === auction.currentSetIndex) {
            return {
              ...s,
              currentIndex: s.playerIds.length,
              isCompleted: true,
            };
          }
          return s;
        });

        const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
        Object.values(newTeams).forEach((t) => {
          updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
        });

        if (auction.isAcceleratedPhase) {
          ensureMinimumSquadSizes(newTeams, newPlayers);
          const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
          Object.values(newTeams).forEach((t) => {
            updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
          });
          set({
            teams: newTeams,
            players: newPlayers,
            auctionTargets: removeResolvedAuctionTargets(auctionTargets, results.map((result) => result.player.id)),
            auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, results.map((result) => result.player.id)),
            isPaused: false,
            skipSetSummary: null,
            auction: {
              ...auction,
              sets: updatedSets,
              phase: "completed",
              currentLotIndex,
              currentPlayer: null,
              soldPlayerIds: newSoldIds,
              unsoldPlayerIds: newUnsoldIds,
              saleHistory: newSaleHistory,
              teamPurses: updatedPurses,
              soldFlash: null,
              unsoldFlash: null,
              rtm: null,
            },
          });
        } else {
          const soldResultIds = results
            .filter((result) => result.status === "sold")
            .map((result) => result.player.id);
          set({
            teams: newTeams,
            players: newPlayers,
            auctionTargets: removeResolvedAuctionTargets(auctionTargets, soldResultIds),
            auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, soldResultIds),
            isPaused: true,
            skipSetSummary: {
              setIndex: auction.currentSetIndex,
              setName: currentSet.name,
              results,
            },
            auction: {
              ...auction,
              sets: updatedSets,
              currentLotIndex,
              soldPlayerIds: newSoldIds,
              unsoldPlayerIds: newUnsoldIds,
              saleHistory: newSaleHistory,
              teamPurses: updatedPurses,
              soldFlash: null,
              unsoldFlash: null,
              rtm: null,
            },
          });
        }
      },

      skipAllAuction: () => {
        const state = get();
        const { auction, players, teams, userTeamId, auctionTargets, auctionTargetPriorities } = state;
        if (!auction || auction.phase !== "live") return;

        _hammerLotId = null;

        const newTeams = { ...teams };
        const newPlayers = { ...players };
        let newSoldIds = [...(auction.soldPlayerIds ?? [])];
        let newUnsoldIds = [...(auction.unsoldPlayerIds ?? [])];
        let newSaleHistory = [...(auction.saleHistory ?? [])];
        let currentLotIndex = auction.currentLotIndex;
        const totalLots = auction.allPlayerIds.length;
        const targetResults = new Map<string, SkipSetResultItem>();
        let userPurchasesDuringSkip = 0;

        // Gather all remaining players across all remaining sets
        const remainingPlayerIds: string[] = [];
        
        // 1. Current set remaining players
        const currentSet = auction.sets[auction.currentSetIndex];
        if (currentSet && !currentSet.isCompleted) {
          remainingPlayerIds.push(...currentSet.playerIds.slice(currentSet.currentIndex));
        }

        // 2. Future sets players
        for (let i = auction.currentSetIndex + 1; i < auction.sets.length; i++) {
          remainingPlayerIds.push(...auction.sets[i].playerIds);
        }

        const pendingTargetIds = new Set(remainingPlayerIds.filter((id) => auctionTargets[id] !== undefined));
        let isFirstProcessed = true;
        const simulateOne = (playerId: string) => {
          const player = newPlayers[playerId];
          if (!player) return;

          const isCurrentLiveLot = isFirstProcessed && auction.currentPlayer?.id === player.id;
          isFirstProcessed = false;
          resetLotCache();

          const ctx: AuctionContext = {
            remainingPlayerIds: auction.allPlayerIds.filter(
              (id) => !newSoldIds.includes(id) && id !== player.id
            ),
            soldPlayerIds: newSoldIds,
            currentLotIndex,
            totalLots,
            isAcceleratedPhase: auction.isAcceleratedPhase,
          };

          let currentBid = isCurrentLiveLot ? auction.currentBid : player.basePrice;
          let highBidderTeamId: string | null = isCurrentLiveLot
            ? auction.currentHighBidderTeamId
            : null;
          let biddingHistory: BidEntry[] = isCurrentLiveLot
            ? [...auction.biddingHistory]
            : [];

          let iterations = 0;
          const MAX_ITER = 300;
          const targetMaxBid = auctionTargets[player.id];
          const targetPriority = auctionTargetPriorities[player.id] ?? "medium";
          pendingTargetIds.delete(player.id);
          const protectedTargetReserve = getProtectedTargetReserve(
            player.id, pendingTargetIds, auctionTargets, auctionTargetPriorities, newTeams[userTeamId], newPlayers
          );
          while (iterations < MAX_ITER) {
            iterations++;
            const nextBid: number = highBidderTeamId ? getNextBidAmount(currentBid) : currentBid;

            const interested: Team[] = Object.values(newTeams).filter((t: Team): boolean => {
              if (t.id === highBidderTeamId) return false;
              return canTeamBidDuringSkip(t, player, nextBid, player.id, newPlayers, ctx, userTeamId, targetMaxBid, protectedTargetReserve);
            });

            if (interested.length === 0) break;

            const bidder: Team | null | undefined = interested.find((team: Team) => team.id === userTeamId && targetMaxBid !== undefined)
              ?? pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
            if (!bidder) break;

            currentBid = nextBid;
            highBidderTeamId = bidder.id;
            biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
          }

          if (!highBidderTeamId) {
            newUnsoldIds.push(player.id);
            if (targetMaxBid !== undefined) {
              targetResults.set(player.id, {
                player,
                status: "unsold",
                targetMissReason: getTargetBidBlockReason(
                  newTeams[userTeamId], player, player.basePrice, newPlayers, userPurchasesDuringSkip > 0, protectedTargetReserve
                ) ?? "Too expensive",
              });
            }
          } else {
            let finalWinnerId = highBidderTeamId;
            let finalPrice = currentBid;
            let usedRtm = false;

            const rtmTeamId = findRTMEligibleTeam(player, newTeams, highBidderTeamId, currentBid);

            if (rtmTeamId) {
              const rtmTeam = newTeams[rtmTeamId];
              const aiOrigValuation = rtmTeamId === userTeamId && targetMaxBid !== undefined
                ? targetMaxBid
                : getCachedValuation(rtmTeamId) || getLotValuation(player.id, rtmTeam, player, newPlayers, ctx);
              const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
              const rtmCeiling = rtmTeamId === userTeamId ? aiOrigValuation : aiOrigValuation * loyaltyBonus;

              if (rtmCeiling >= currentBid && canAffordTargetRtm(rtmTeam, currentBid, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                const winnerTeam = newTeams[highBidderTeamId];
                const aiWinnerValuation = getCachedValuation(highBidderTeamId) || getLotValuation(player.id, winnerTeam, player, newPlayers, ctx);

                if (aiWinnerValuation > currentBid * 1.05 && winnerTeam.remainingPurse >= currentBid * 1.05) {
                  let counterAmount = currentBid;
                  const target = Math.min(aiWinnerValuation, Math.round(currentBid * 1.25));
                  while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
                  if (counterAmount <= currentBid) counterAmount = getNextBidAmount(currentBid);

                  if (rtmCeiling >= counterAmount && canAffordTargetRtm(rtmTeam, counterAmount, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                    finalWinnerId = rtmTeamId;
                    finalPrice = counterAmount;
                    usedRtm = true;
                  } else {
                    finalWinnerId = highBidderTeamId;
                    finalPrice = counterAmount;
                  }
                } else {
                  finalWinnerId = rtmTeamId;
                  finalPrice = currentBid;
                  usedRtm = true;
                }
              }
            }

            if (finalWinnerId === userTeamId && targetMaxBid !== undefined && rtmTeamId &&
                (finalPrice > targetMaxBid || (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve))) {
              finalWinnerId = rtmTeamId;
              finalPrice = currentBid;
              usedRtm = true;
            }

            const winnerTeam = newTeams[finalWinnerId];
            if (winnerTeam) {
              newTeams[finalWinnerId] = {
                ...winnerTeam,
                squad: [...winnerTeam.squad, player.id],
                remainingPurse: winnerTeam.remainingPurse - finalPrice,
                spentAmount: winnerTeam.spentAmount + finalPrice,
                rtmCardsUsed: usedRtm ? winnerTeam.rtmCardsUsed + 1 : winnerTeam.rtmCardsUsed,
                overseasPlayersCurrent:
                  player.nationality === "Overseas"
                    ? winnerTeam.overseasPlayersCurrent + 1
                    : winnerTeam.overseasPlayersCurrent,
              };
            }

            const updatedHistory = [
              ...player.iplHistory.filter((h) => h.season !== "2027"),
              { teamId: finalWinnerId, season: "2027", price: finalPrice, isRtm: usedRtm },
            ];

            newPlayers[player.id] = {
              ...player,
              currentTeamId: finalWinnerId,
              iplHistory: updatedHistory,
            };

            newSoldIds.push(player.id);

            newSaleHistory.push({
              playerId: player.id,
              teamId: finalWinnerId,
              price: finalPrice,
              lot: currentLotIndex,
              bids: biddingHistory,
            });

            if (targetMaxBid !== undefined) {
              let targetMissReason: string | undefined;
              if (finalWinnerId !== userTeamId) {
                if (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve) {
                  targetMissReason = "Funds reserved for higher-priority targets";
                } else if (usedRtm && finalPrice <= targetMaxBid) {
                  targetMissReason = `${newTeams[finalWinnerId]?.name ?? finalWinnerId} exercised RTM`;
                } else if (finalPrice > targetMaxBid) {
                  targetMissReason = "Too expensive";
                } else {
                  targetMissReason = getTargetBidBlockReason(
                    newTeams[userTeamId], player, currentBid, newPlayers, userPurchasesDuringSkip > 0, protectedTargetReserve
                  ) ?? "Too expensive";
                }
              }
              targetResults.set(player.id, {
                player: newPlayers[player.id],
                status: "sold",
                teamId: finalWinnerId,
                price: finalPrice,
                usedRtm,
                targetMissReason,
              });
              if (finalWinnerId === userTeamId) userPurchasesDuringSkip++;
            }
          }
          currentLotIndex++;
        };

        // Simulate all remaining players in regular sets
        remainingPlayerIds.forEach(simulateOne);

        // Simulate accelerated phases
        let isAccelerated = true;
        let lastAccelUnsoldCount = newUnsoldIds.length;

        while (isAccelerated && newUnsoldIds.length > 0) {
          const unsoldPlayers = newUnsoldIds
            .map((id) => newPlayers[id])
            .filter(Boolean);
          
          if (unsoldPlayers.length === 0) break;

          const playersToSimulate = unsoldPlayers.map(p => p.id);
          newUnsoldIds = [];

          playersToSimulate.forEach((id) => {
            if (auctionTargets[id] !== undefined) pendingTargetIds.add(id);
          });
          playersToSimulate.forEach(simulateOne);

          const madeProgress = newUnsoldIds.length < lastAccelUnsoldCount;
          if (!madeProgress) break;
          lastAccelUnsoldCount = newUnsoldIds.length;
        }

        const updatedSets = auction.sets.map((s) => ({
          ...s,
          currentIndex: s.playerIds.length,
          isCompleted: true,
        }));

        ensureMinimumSquadSizes(newTeams, newPlayers);
        const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
        Object.values(newTeams).forEach((t) => {
          updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
        });

        set({
          teams: newTeams,
          players: newPlayers,
          auctionTargets: removeResolvedAuctionTargets(auctionTargets, remainingPlayerIds),
          auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, remainingPlayerIds),
          isPaused: false,
          skipSetSummary: targetResults.size > 0 ? {
            setIndex: -1,
            setName: "Target Results",
            results: Array.from(targetResults.values()),
          } : null,
          auction: {
            ...auction,
            sets: updatedSets,
            phase: "completed",
            currentLotIndex,
            currentPlayer: null,
            soldPlayerIds: newSoldIds,
            unsoldPlayerIds: newUnsoldIds,
            saleHistory: newSaleHistory,
            teamPurses: updatedPurses,
            soldFlash: null,
            unsoldFlash: null,
            rtm: null,
          },
        });
      },

      skipToAcceleratedAuction: () => {
        const state = get();
        const { auction, players, teams, userTeamId, auctionTargets, auctionTargetPriorities } = state;
        if (!auction || auction.phase !== "live") return;

        _hammerLotId = null;

        const newTeams = { ...teams };
        const newPlayers = { ...players };
        let newSoldIds = [...(auction.soldPlayerIds ?? [])];
        let newUnsoldIds = [...(auction.unsoldPlayerIds ?? [])];
        let newSaleHistory = [...(auction.saleHistory ?? [])];
        let currentLotIndex = auction.currentLotIndex;
        const totalLots = auction.allPlayerIds.length;

        const remainingPlayerIds: string[] = [];

        const currentSet = auction.sets[auction.currentSetIndex];
        if (currentSet && !currentSet.isCompleted) {
          remainingPlayerIds.push(...currentSet.playerIds.slice(currentSet.currentIndex));
        }

        for (let i = auction.currentSetIndex + 1; i < auction.sets.length; i++) {
          remainingPlayerIds.push(...auction.sets[i].playerIds);
        }

        const pendingTargetIds = new Set(remainingPlayerIds.filter((id) => auctionTargets[id] !== undefined));
        let isFirstProcessed = true;
        const simulateOne = (playerId: string) => {
          const player = newPlayers[playerId];
          if (!player) return;

          const isCurrentLiveLot = isFirstProcessed && auction.currentPlayer?.id === player.id;
          isFirstProcessed = false;
          resetLotCache();

          const ctx: AuctionContext = {
            remainingPlayerIds: auction.allPlayerIds.filter(
              (id) => !newSoldIds.includes(id) && id !== player.id
            ),
            soldPlayerIds: newSoldIds,
            currentLotIndex,
            totalLots,
            isAcceleratedPhase: auction.isAcceleratedPhase,
          };

          let currentBid = isCurrentLiveLot ? auction.currentBid : player.basePrice;
          let highBidderTeamId: string | null = isCurrentLiveLot
            ? auction.currentHighBidderTeamId
            : null;
          let biddingHistory: BidEntry[] = isCurrentLiveLot
            ? [...auction.biddingHistory]
            : [];

          let iterations = 0;
          const MAX_ITER = 300;
          const targetMaxBid = auctionTargets[player.id];
          const targetPriority = auctionTargetPriorities[player.id] ?? "medium";
          pendingTargetIds.delete(player.id);
          const protectedTargetReserve = getProtectedTargetReserve(
            player.id, pendingTargetIds, auctionTargets, auctionTargetPriorities, newTeams[userTeamId], newPlayers
          );
          while (iterations < MAX_ITER) {
            iterations++;
            const nextBid: number = highBidderTeamId ? getNextBidAmount(currentBid) : currentBid;

            const interested: Team[] = Object.values(newTeams).filter((t: Team): boolean => {
              if (t.id === highBidderTeamId) return false;
              return canTeamBidDuringSkip(t, player, nextBid, player.id, newPlayers, ctx, userTeamId, targetMaxBid, protectedTargetReserve);
            });

            if (interested.length === 0) break;

            const bidder: Team | null | undefined = interested.find((team: Team) => team.id === userTeamId && targetMaxBid !== undefined)
              ?? pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
            if (!bidder) break;

            currentBid = nextBid;
            highBidderTeamId = bidder.id;
            biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
          }

          if (!highBidderTeamId) {
            newUnsoldIds.push(player.id);
          } else {
            let finalWinnerId = highBidderTeamId;
            let finalPrice = currentBid;
            let usedRtm = false;

            const rtmTeamId = findRTMEligibleTeam(player, newTeams, highBidderTeamId, currentBid);

            if (rtmTeamId) {
              const rtmTeam = newTeams[rtmTeamId];
              const aiOrigValuation = rtmTeamId === userTeamId && targetMaxBid !== undefined
                ? targetMaxBid
                : getCachedValuation(rtmTeamId) || getLotValuation(player.id, rtmTeam, player, newPlayers, ctx);
              const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
              const rtmCeiling = rtmTeamId === userTeamId ? aiOrigValuation : aiOrigValuation * loyaltyBonus;

              if (rtmCeiling >= currentBid && canAffordTargetRtm(rtmTeam, currentBid, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                const winnerTeam = newTeams[highBidderTeamId];
                const aiWinnerValuation = getCachedValuation(highBidderTeamId) || getLotValuation(player.id, winnerTeam, player, newPlayers, ctx);

                if (aiWinnerValuation > currentBid * 1.05 && winnerTeam.remainingPurse >= currentBid * 1.05) {
                  let counterAmount = currentBid;
                  const target = Math.min(aiWinnerValuation, Math.round(currentBid * 1.25));
                  while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
                  if (counterAmount <= currentBid) counterAmount = getNextBidAmount(currentBid);

                  if (rtmCeiling >= counterAmount && canAffordTargetRtm(rtmTeam, counterAmount, newPlayers, rtmTeamId === userTeamId, targetPriority, protectedTargetReserve)) {
                    finalWinnerId = rtmTeamId;
                    finalPrice = counterAmount;
                    usedRtm = true;
                  } else {
                    finalWinnerId = highBidderTeamId;
                    finalPrice = counterAmount;
                  }
                } else {
                  finalWinnerId = rtmTeamId;
                  finalPrice = currentBid;
                  usedRtm = true;
                }
              }
            }

            if (finalWinnerId === userTeamId && targetMaxBid !== undefined && rtmTeamId &&
                (finalPrice > targetMaxBid || (targetPriority !== "high" && newTeams[userTeamId].remainingPurse - finalPrice < protectedTargetReserve))) {
              finalWinnerId = rtmTeamId;
              finalPrice = currentBid;
              usedRtm = true;
            }

            const winnerTeam = newTeams[finalWinnerId];
            if (winnerTeam) {
              newTeams[finalWinnerId] = {
                ...winnerTeam,
                squad: [...winnerTeam.squad, player.id],
                remainingPurse: winnerTeam.remainingPurse - finalPrice,
                spentAmount: winnerTeam.spentAmount + finalPrice,
                rtmCardsUsed: usedRtm ? winnerTeam.rtmCardsUsed + 1 : winnerTeam.rtmCardsUsed,
                overseasPlayersCurrent:
                  player.nationality === "Overseas"
                    ? winnerTeam.overseasPlayersCurrent + 1
                    : winnerTeam.overseasPlayersCurrent,
              };
            }

            const updatedHistory = [
              ...player.iplHistory.filter((h) => h.season !== "2027"),
              { teamId: finalWinnerId, season: "2027", price: finalPrice, isRtm: usedRtm },
            ];

            newPlayers[player.id] = {
              ...player,
              currentTeamId: finalWinnerId,
              iplHistory: updatedHistory,
            };

            newSoldIds.push(player.id);

            newSaleHistory.push({
              playerId: player.id,
              teamId: finalWinnerId,
              price: finalPrice,
              lot: currentLotIndex,
              bids: biddingHistory,
            });
          }
          currentLotIndex++;
        };

        remainingPlayerIds.forEach(simulateOne);

        const updatedSets = auction.sets.map((s) => ({
          ...s,
          currentIndex: s.playerIds.length,
          isCompleted: true,
        }));

        _lastAccelUnsoldCount = newUnsoldIds.length;
        const unsoldPlayers = newUnsoldIds
          .map((id) => newPlayers[id])
          .filter(Boolean);

        const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
        Object.values(newTeams).forEach((t) => {
          updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
        });

        if (unsoldPlayers.length > 0) {
          const soldDuringSkipIds = remainingPlayerIds.filter((id) => newSoldIds.includes(id));
          const acceleratedSets = [{
            id: "accelerated",
            name: "Accelerated Auction",
            playerIds: unsoldPlayers.map((p) => p.id),
            currentIndex: 0,
            isCompleted: false,
          }];

          const firstPlayer = unsoldPlayers[0];

          set({
            teams: newTeams,
            players: newPlayers,
            auctionTargets: removeResolvedAuctionTargets(auctionTargets, soldDuringSkipIds),
            auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, soldDuringSkipIds),
            isPaused: true,
            skipSetSummary: null,
            auction: {
              ...auction,
              sets: acceleratedSets,
              currentSetIndex: 0,
              currentLotIndex,
              currentPlayer: firstPlayer,
              currentBid: firstPlayer.basePrice,
              currentHighBidderTeamId: null,
              biddingHistory: [],
              timerSeconds: 10,
              isAcceleratedPhase: true,
              unsoldPlayerIds: [],
              soldPlayerIds: newSoldIds,
              saleHistory: newSaleHistory,
              teamPurses: updatedPurses,
              soldFlash: null,
              unsoldFlash: null,
              rtm: null,
            },
          });

          resetLotCache();
          scheduleAIBids(firstPlayer);
        } else {
          ensureMinimumSquadSizes(newTeams, newPlayers);
          const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
          Object.values(newTeams).forEach((t) => {
            updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
          });
          set({
            teams: newTeams,
            players: newPlayers,
            auctionTargets: removeResolvedAuctionTargets(auctionTargets, remainingPlayerIds),
            auctionTargetPriorities: removeResolvedAuctionTargets(auctionTargetPriorities, remainingPlayerIds),
            isPaused: false,
            skipSetSummary: null,
            auction: {
              ...auction,
              sets: updatedSets,
              phase: "completed",
              currentLotIndex,
              currentPlayer: null,
              soldPlayerIds: newSoldIds,
              unsoldPlayerIds: [],
              saleHistory: newSaleHistory,
              teamPurses: updatedPurses,
              soldFlash: null,
              unsoldFlash: null,
              rtm: null,
            },
          });
        }
      },

      resetGame: () => {
        set({
          saveId: "",
          saveCreatedAt: "",
          players: {},
          teams: {},
          userTeamId: "",
          auction: null,
          isSetupComplete: false,
          isPaused: false,
          speed: 1,
          auctionTargets: {},
          auctionTargetPriorities: {},
        });
      },
    }),
    {
      name: "ipl-simulator-save-v5",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        saveId: state.saveId,
        saveCreatedAt: state.saveCreatedAt,
        currentDate: state.currentDate,
        currentSeason: state.currentSeason,
        auctionCycle: state.auctionCycle,
        players: state.players,
        teams: state.teams,
        userTeamId: state.userTeamId,
        auction: state.auction,
        isSetupComplete: state.isSetupComplete,
        isPaused: state.isPaused,
        speed: state.speed,
        auctionTargets: state.auctionTargets,
        auctionTargetPriorities: state.auctionTargetPriorities,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Store>;
        return {
          ...current,
          ...p,
          auctionTargets: p.auctionTargets ?? {},
          auctionTargetPriorities: p.auctionTargetPriorities ?? {},
        };
      },
    }
  )
);

// ---------------------------------------------------------------------------
// RTM transfer helpers — called by both user RTM actions and AI-vs-AI RTM
// ---------------------------------------------------------------------------

/**
 * Transfer a player from winnerTeam to originalTeam (RTM exercised + accepted).
 * winnerTeam is refunded refundAmount (= hammer price).
 * originalTeam pays transferPrice (= hammer price or raised counter amount).
 */
function doRTMTransfer(
  originalTeamId: string,
  winnerTeamId: string,
  player: Player,
  transferPrice: number,
  refundAmount: number,
) {
  const state = useGameStore.getState();
  const origTeam = state.teams[originalTeamId];
  if (!origTeam || origTeam.remainingPurse < transferPrice) {
    // Original team cannot afford transferPrice -> fallback: winner team keeps player!
    doWinnerKeepsAtCounter(winnerTeamId, refundAmount, refundAmount, player);
    return;
  }

  useGameStore.setState((s) => {
    const newTeams = { ...s.teams };

    newTeams[winnerTeamId] = {
      ...newTeams[winnerTeamId],
      squad: newTeams[winnerTeamId].squad.filter((id) => id !== player.id),
      remainingPurse: newTeams[winnerTeamId].remainingPurse + refundAmount,
      spentAmount: newTeams[winnerTeamId].spentAmount - refundAmount,
      overseasPlayersCurrent:
        player.nationality === "Overseas"
          ? newTeams[winnerTeamId].overseasPlayersCurrent - 1
          : newTeams[winnerTeamId].overseasPlayersCurrent,
    };

    newTeams[originalTeamId] = {
      ...newTeams[originalTeamId],
      squad: [...newTeams[originalTeamId].squad, player.id],
      remainingPurse: newTeams[originalTeamId].remainingPurse - transferPrice,
      spentAmount: newTeams[originalTeamId].spentAmount + transferPrice,
      rtmCardsUsed: newTeams[originalTeamId].rtmCardsUsed + 1,
      overseasPlayersCurrent:
        player.nationality === "Overseas"
          ? newTeams[originalTeamId].overseasPlayersCurrent + 1
          : newTeams[originalTeamId].overseasPlayersCurrent,
    };

    const updatedHistory = [
      ...player.iplHistory.filter(h => h.season !== "2027"),
      { teamId: originalTeamId, season: "2027", price: transferPrice, isRtm: true }
    ];
    const newPlayers = { ...s.players, [player.id]: { ...player, currentTeamId: originalTeamId, iplHistory: updatedHistory } };
    const newPurses = {
      ...(s.auction?.teamPurses ?? {}),
      [originalTeamId]: { remaining: newTeams[originalTeamId].remainingPurse, squadCount: newTeams[originalTeamId].squad.length },
      [winnerTeamId]: { remaining: newTeams[winnerTeamId].remainingPurse, squadCount: newTeams[winnerTeamId].squad.length },
    };

    return {
      teams: newTeams,
      players: newPlayers,
      auction: s.auction
        ? {
            ...s.auction,
            rtm: null,
            soldFlash: { playerId: player.id, teamId: originalTeamId, amount: transferPrice },
            teamPurses: newPurses,
            saleHistory: [
              ...(s.auction.saleHistory ?? []),
              { playerId: player.id, teamId: originalTeamId, price: transferPrice, lot: s.auction.currentLotIndex, bids: s.auction.biddingHistory },
            ],
          }
        : null,
    };
  });
  setTimeout(() => advanceToNextLot(), 2200);
}

/**
 * Winner keeps the player but pays the counter amount (not just the hammer price).
 * Used when original team folds or when user (winner) raises and AI (original) folds.
 */
function doWinnerKeepsAtCounter(
  winnerTeamId: string,
  soldAmount: number,
  raisedAmount: number,
  player: Player,
) {
  const extra = raisedAmount - soldAmount;
  useGameStore.setState((s) => {
    const newTeams = { ...s.teams };
    newTeams[winnerTeamId] = {
      ...newTeams[winnerTeamId],
      remainingPurse: newTeams[winnerTeamId].remainingPurse - extra,
      spentAmount: newTeams[winnerTeamId].spentAmount + extra,
    };
    const newPurses = {
      ...(s.auction?.teamPurses ?? {}),
      [winnerTeamId]: { remaining: newTeams[winnerTeamId].remainingPurse, squadCount: newTeams[winnerTeamId].squad.length },
    };
    return {
      teams: newTeams,
      auction: s.auction
        ? {
            ...s.auction,
            rtm: null,
            soldFlash: { playerId: player.id, teamId: winnerTeamId, amount: raisedAmount },
            teamPurses: newPurses,
            saleHistory: [
              ...(s.auction.saleHistory ?? []),
              { playerId: player.id, teamId: winnerTeamId, price: raisedAmount, lot: s.auction.currentLotIndex, bids: s.auction.biddingHistory },
            ],
          }
        : null,
    };
  });
  setTimeout(() => advanceToNextLot(), 2200);
}

/**
 * Fast-forward the AI bidding for the current lot synchronously.
 * Called when the user presses PASS — runs all remaining AI bids instantly,
 * then hands off to hammerFall so the player sells (or goes unsold) normally.
 */
function simulateRemainingBids(player: Player) {
  // Guard: if hammer already fired for this lot, don't re-simulate
  if (_hammerLotId === player.id) return;

  const state = useGameStore.getState();
  const { auction, teams, players: allPlayers, userTeamId } = state;
  if (!auction || !auction.currentPlayer || auction.currentPlayer.id !== player.id) return;

  const lotId = player.id;
  let currentBid = auction.currentBid;
  let highBidderTeamId = auction.currentHighBidderTeamId;
  let biddingHistory = [...auction.biddingHistory];

  const totalLots = auction.sets.reduce((sum, s) => sum + s.playerIds.length, 0);
  const ctx: AuctionContext = {
    remainingPlayerIds: auction.allPlayerIds.filter(
      id => !auction.soldPlayerIds.includes(id) && id !== player.id,
    ),
    soldPlayerIds: auction.soldPlayerIds,
    currentLotIndex: auction.currentLotIndex,
    totalLots,
    isAcceleratedPhase: auction.isAcceleratedPhase,
  };

  let iterations = 0;
  const MAX_ITER = 300;

  while (iterations < MAX_ITER) {
    iterations++;
    const nextBid = getNextBidAmount(currentBid);

    const interested = Object.values(teams).filter(t => {
      if (t.id === userTeamId) return false;           // user decides for themselves
      if (t.id === highBidderTeamId) return false;     // can't outbid yourself
      return canAIBidAtAmount(t, player, nextBid, lotId, allPlayers, ctx);
    });

    if (interested.length === 0) break;

    const bidder = pickBiddingTeam(interested, player, lotId, allPlayers, ctx);
    if (!bidder) break;

    currentBid = nextBid;
    highBidderTeamId = bidder.id;
    biddingHistory = [{ teamId: bidder.id, amount: nextBid, timestamp: Date.now() }, ...biddingHistory];
  }

  // Commit the simulated result to the store, then trigger hammer
  useGameStore.setState(s => ({
    auction: s.auction
      ? { ...s.auction, currentBid, currentHighBidderTeamId: highBidderTeamId, biddingHistory }
      : null,
  }));

  hammerFall();
}

function hammerFall() {
  const state = useGameStore.getState();
  const { auction, teams, players, userTeamId } = state;
  if (!auction || !auction.currentPlayer) return;

  const player = auction.currentPlayer;

  // Idempotency: prevent double-hammer from timer race + rapid PASS clicks
  if (_hammerLotId === player.id) return;
  _hammerLotId = player.id;

  const highBidder = auction.currentHighBidderTeamId;

  if (!highBidder) {
    // No bids → unsold: show UNSOLD animation for 2.2s then advance
    useGameStore.setState((s) => ({
      auction: s.auction
        ? {
            ...s.auction,
            unsoldPlayerIds: [...s.auction.unsoldPlayerIds, player.id],
            unsoldFlash: { playerId: player.id },
            soldFlash: null,
            timerSeconds: 0,
          }
        : null,
    }));
    setTimeout(() => advanceToNextLot(), 2200);
    return;
  }

  // Sold to highBidder
  const soldAmount = auction.currentBid;

  // Commit winner's team state (deduct purse, add to squad)
  useGameStore.setState((s) => {
    const newTeams = { ...s.teams };
    newTeams[highBidder] = {
      ...newTeams[highBidder],
      squad: [...newTeams[highBidder].squad, player.id],
      remainingPurse: newTeams[highBidder].remainingPurse - soldAmount,
      spentAmount: newTeams[highBidder].spentAmount + soldAmount,
      overseasPlayersCurrent:
        player.nationality === "Overseas"
          ? newTeams[highBidder].overseasPlayersCurrent + 1
          : newTeams[highBidder].overseasPlayersCurrent,
    };
    const updatedHistory = [
      ...player.iplHistory.filter(h => h.season !== "2027"),
      { teamId: highBidder, season: "2027", price: soldAmount }
    ];
    const newPlayers = { ...s.players, [player.id]: { ...player, currentTeamId: highBidder, iplHistory: updatedHistory } };
    const newPurses = {
      ...(s.auction?.teamPurses ?? {}),
      [highBidder]: { remaining: newTeams[highBidder].remainingPurse, squadCount: newTeams[highBidder].squad.length },
    };
    const newSoldIds = [...(s.auction?.soldPlayerIds ?? []), player.id];
    return {
      teams: newTeams,
      players: newPlayers,
      auctionTargets: removeResolvedAuctionTargets(s.auctionTargets, [player.id]),
      auctionTargetPriorities: removeResolvedAuctionTargets(s.auctionTargetPriorities, [player.id]),
      auction: s.auction ? { ...s.auction, soldPlayerIds: newSoldIds, teamPurses: newPurses } : null,
    };
  });

  // Find RTM-eligible team (any team, not just user)
  const currentState = useGameStore.getState();
  const rtmTeamId = findRTMEligibleTeam(player, currentState.teams, highBidder, soldAmount);

  if (!rtmTeamId) {
    // No RTM: flash and advance
    useGameStore.setState((s) => ({
      auction: s.auction
        ? {
            ...s.auction,
            soldFlash: { playerId: player.id, teamId: highBidder, amount: soldAmount },
            saleHistory: [...(s.auction.saleHistory ?? []), { playerId: player.id, teamId: highBidder, price: soldAmount, lot: auction.currentLotIndex, bids: auction.biddingHistory }],
          }
        : null,
    }));
    setTimeout(() => advanceToNextLot(), 2200);
    return;
  }

  const isUserOriginal = rtmTeamId === userTeamId;
  const isUserWinner = highBidder === userTeamId;

  if (!isUserOriginal && !isUserWinner) {
    // AI-vs-AI RTM: resolve silently
    const aiOrigValuation = getCachedValuation(rtmTeamId);
    const rtmTeam = teams[rtmTeamId];
    const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
    if (aiOrigValuation * loyaltyBonus > soldAmount) {
      // AI original exercises RTM
      const aiWinnerValuation = getCachedValuation(highBidder);
      if (aiWinnerValuation > soldAmount * 1.05) {
        // Winner AI counters
        let counterAmount = soldAmount;
        const target = Math.min(aiWinnerValuation, Math.round(soldAmount * 1.25));
        while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
        if (counterAmount <= soldAmount) counterAmount = getNextBidAmount(soldAmount);
        // Original AI matches counter?
        if (aiOrigValuation * loyaltyBonus >= counterAmount) {
          doRTMTransfer(rtmTeamId, highBidder, player, counterAmount, soldAmount);
        } else {
          doWinnerKeepsAtCounter(highBidder, soldAmount, counterAmount, player);
        }
      } else {
        // Winner AI doesn't counter: original gets at soldAmount
        doRTMTransfer(rtmTeamId, highBidder, player, soldAmount, soldAmount);
      }
    } else {
      // AI declines RTM
      useGameStore.setState((s) => ({
        auction: s.auction
          ? {
              ...s.auction,
              soldFlash: { playerId: player.id, teamId: highBidder, amount: soldAmount },
              saleHistory: [...(s.auction.saleHistory ?? []), { playerId: player.id, teamId: highBidder, price: soldAmount, lot: auction.currentLotIndex, bids: auction.biddingHistory }],
            }
          : null,
      }));
      setTimeout(() => advanceToNextLot(), 2200);
    }
    return;
  }

  if (isUserOriginal) {
    // User is original team: show "offer" modal
    useGameStore.setState((s) => ({
      auction: s.auction
        ? { ...s.auction, rtm: { phase: "offer", originalTeamId: rtmTeamId, winnerTeamId: highBidder, baseAmount: soldAmount, raisedAmount: 0, timerSeconds: 15 } }
        : null,
    }));
    return;
  }

  // User is winner, AI is original: AI decides to RTM or not
  const rtmTeam = teams[rtmTeamId];
  const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;
  const aiOrigValuation = getCachedValuation(rtmTeamId);
  if (aiOrigValuation * loyaltyBonus > soldAmount) {
    // AI exercises RTM → show "winner_counter" modal to user
    useGameStore.setState((s) => ({
      auction: s.auction
        ? { ...s.auction, rtm: { phase: "winner_counter", originalTeamId: rtmTeamId, winnerTeamId: highBidder, baseAmount: soldAmount, raisedAmount: 0, timerSeconds: 15 } }
        : null,
    }));
  } else {
    // AI declines RTM: user keeps player
    useGameStore.setState((s) => ({
      auction: s.auction
        ? {
            ...s.auction,
            soldFlash: { playerId: player.id, teamId: highBidder, amount: soldAmount },
            saleHistory: [...(s.auction.saleHistory ?? []), { playerId: player.id, teamId: highBidder, price: soldAmount, lot: auction.currentLotIndex, bids: auction.biddingHistory }],
          }
        : null,
    }));
    setTimeout(() => advanceToNextLot(), 2200);
  }
}

function advanceToNextLot() {
  // Reset idempotency guard for the next lot
  _hammerLotId = null;

  const state = useGameStore.getState();
  const { auction, players, teams, userTeamId } = state;
  if (!auction) return;

  // Clear flash and rtm state
  useGameStore.setState((s) => ({
    auction: s.auction ? { ...s.auction, soldFlash: null, unsoldFlash: null, rtm: null } : null,
  }));

  // Advance current set index
  const newSets = auction.sets.map((set, si) => {
    if (si === auction.currentSetIndex) {
      const newIndex = set.currentIndex + 1;
      return {
        ...set,
        currentIndex: newIndex,
        isCompleted: newIndex >= set.playerIds.length,
      };
    }
    return set;
  });

  // Find next lot
  const next = pickNextLot(newSets);

  if (!next) {
    // All sets done — run (possibly repeated) accelerated rounds so teams can
    // keep filling toward a full 25-man squad. Re-run while each round is still
    // making sales; stop once a whole round clears no one (no more interest).
    const madeProgress = auction.unsoldPlayerIds.length > 0 &&
      (!auction.isAcceleratedPhase || auction.unsoldPlayerIds.length < _lastAccelUnsoldCount);
    if (madeProgress) {
      _lastAccelUnsoldCount = auction.unsoldPlayerIds.length;
      const unsoldPlayers = auction.unsoldPlayerIds
        .map((id) => players[id])
        .filter(Boolean);

      if (unsoldPlayers.length > 0) {
        const acceleratedSets = [{
          id: "accelerated",
          name: "Accelerated Auction",
          playerIds: unsoldPlayers.map((p) => p.id),
          currentIndex: 0,
          isCompleted: false,
        }];

        const firstPlayer = unsoldPlayers[0];

        useGameStore.setState((s) => ({
          auction: s.auction
            ? {
                ...s.auction,
                sets: acceleratedSets,
                currentSetIndex: 0,
                currentLotIndex: s.auction.currentLotIndex + 1,
                currentPlayer: firstPlayer,
                currentBid: firstPlayer.basePrice,
                currentHighBidderTeamId: null,
                biddingHistory: [],
                timerSeconds: 10,
                isAcceleratedPhase: true,
                unsoldPlayerIds: [],
                soldFlash: null,
                unsoldFlash: null,
              }
            : null,
        }));

        resetLotCache();
        scheduleAIBids(firstPlayer);
        return;
      }
    }

    // Auction complete
    const currentTeams = { ...useGameStore.getState().teams };
    const currentPlayers = { ...useGameStore.getState().players };
    ensureMinimumSquadSizes(currentTeams, currentPlayers);

    useGameStore.setState((s) => ({
      teams: currentTeams,
      players: currentPlayers,
      auctionTargets: {},
      auctionTargetPriorities: {},
      auction: s.auction ? { ...s.auction, phase: "completed", currentPlayer: null, soldFlash: null, unsoldFlash: null } : null,
    }));
    return;
  }

  const currentSet = newSets[next.setIndex];
  const playerId = currentSet.playerIds[next.playerIndex];
  const player = players[playerId];

  useGameStore.setState((s) => ({
    auction: s.auction
      ? {
          ...s.auction,
          sets: newSets,
          currentSetIndex: next.setIndex,
          currentLotIndex: s.auction.currentLotIndex + 1,
          currentPlayer: player,
          currentBid: player.basePrice,
          currentHighBidderTeamId: null,
          biddingHistory: [],
          timerSeconds: 10,
        }
      : null,
  }));

  // Reset per-lot AI valuation cache so each player gets fresh valuations
  resetLotCache();

  // Schedule first AI bid round
  scheduleAIBids(player);
}

/**
 * AI bidding — one team bids per round, then schedules the next round.
 * This prevents the previous cascade where all 9 teams fired simultaneously
 * and re-fired each other, causing bids to shoot to ₹49Cr in seconds.
 *
 * Flow:
 *   1. Wait a realistic delay (based on current bid size)
 *   2. Find all AI teams that still want to bid (under their cached valuation)
 *   3. Pick one team (weighted by remaining headroom)
 *   4. That team bids once
 *   5. Schedule the next round — stops naturally when no team wants to bid
 */
function scheduleAIBids(player: Player) {
  if (_aiBidsTimeoutId) {
    clearTimeout(_aiBidsTimeoutId);
    _aiBidsTimeoutId = null;
  }

  const state = useGameStore.getState();
  const { auction } = state;
  if (!auction?.currentPlayer) return;

  const delay = nextAIBidDelay(auction.currentBid);
  const lotId = player.id; // stable ID for the valuation cache
  const speed = state.speed;
  const speedAdjustedDelay = delay / speed;

  _aiBidsTimeoutId = setTimeout(() => {
    _aiBidsTimeoutId = null;
    const s = useGameStore.getState();
    const { auction: a, teams, players: allPlayers, userTeamId } = s;

    // Guard: lot must still be the same player and auction active
    if (!a || !a.currentPlayer || a.currentPlayer.id !== player.id) return;
    if (a.phase !== "live") return;
    if (a.rtm || a.soldFlash || a.unsoldFlash) return;

    if (s.isPaused) {
      scheduleAIBids(player);
      return;
    }

    const hasBids = !!a.currentHighBidderTeamId;
    const nextBid = hasBids ? getNextBidAmount(a.currentBid) : a.currentBid;

    // Build auction context for AI engine
    const totalLots = a.sets.reduce((sum, s) => sum + s.playerIds.length, 0);
    const ctx: AuctionContext = {
      remainingPlayerIds: a.allPlayerIds.filter(
        id => !a.soldPlayerIds.includes(id) && id !== player.id
      ),
      soldPlayerIds: a.soldPlayerIds,
      currentLotIndex: a.currentLotIndex,
      totalLots,
      isAcceleratedPhase: a.isAcceleratedPhase,
    };

    // Collect AI teams that both CAN and WANT to bid
    const interested = Object.values(teams).filter((t) => {
      if (t.id === userTeamId) return false;
      if (t.id === a.currentHighBidderTeamId) return false; // already highest bidder
      return canAIBidAtAmount(t, player, nextBid, lotId, allPlayers, ctx);
    });

    if (interested.length === 0) return; // nobody wants to bid — let timer run

    // Pick ONE team to bid this round
    const biddingTeam = pickBiddingTeam(interested, player, lotId, allPlayers, ctx);
    if (!biddingTeam) return;

    useGameStore.getState().placeBid(biddingTeam.id, nextBid);

    // Schedule next round — the chain continues until no one bids
    scheduleAIBids(player);
  }, speedAdjustedDelay);
}

// ---------------------------------------------------------------------------
// Hammer idempotency guard — prevents the same lot from being hammered twice
// (race between timer fire + PASS click, or rapid PASS double-click)
// ---------------------------------------------------------------------------
let _hammerLotId: string | null = null;
let _aiBidsTimeoutId: NodeJS.Timeout | null = null;

// Tracks the unsold count entering the current accelerated round, so repeated
// accelerated rounds stop once a whole pass clears no one.
let _lastAccelUnsoldCount = Infinity;

function ensureMinimumSquadSizes(
  teams: Record<string, Team>,
  players: Record<string, Player>
) {
  const userTeamId = useGameStore.getState().userTeamId;
  const isWK = (p: Player) => !!(p.isWicketkeeper || p.isPartTimeWk || p.role === "WK-Batsman");
  const isFullTimeKeeper = (p: Player) => !!((p.isWicketkeeper || p.role === "WK-Batsman") && !p.isPartTimeWk);
  const isIndianBatter = (p: Player) => p.nationality === "Indian" && (p.role === "Batsman" || p.role === "WK-Batsman");
  const ratingOf = (p: Player) => Math.max(p.currentBatting ?? 0, p.currentBowling ?? 0);

  const getMinSize = (t: Team) => (t.id === userTeamId ? 18 : 22);

  const getBowlersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;
  const getKeepersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && isWK(p)).length;
  const getSpinnersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && p.role === "Spin Bowler").length;
  const getIndianBowlersCount = (t: Team) => t.squad.map(id => players[id]).filter(p => p && p.nationality === "Indian" && (p.role === "Pace Bowler" || p.role === "Spin Bowler")).length;
  const getIndianBatters75Count = (t: Team) => t.squad.map(id => players[id]).filter(p => p && isIndianBatter(p) && ratingOf(p) > 75).length;
  const getIndianBatters77Count = (t: Team) => t.squad.map(id => players[id]).filter(p => p && isIndianBatter(p) && ratingOf(p) > 77).length;
  
  const shortTeams = Object.values(teams).filter(t => 
    t.squad.length < getMinSize(t) || 
    getBowlersCount(t) < 5 || 
    getKeepersCount(t) < 2 || 
    getSpinnersCount(t) < 2 ||
    getIndianBowlersCount(t) < 4 ||
    getIndianBatters75Count(t) < 6 ||
    getIndianBatters77Count(t) < 4
  );
  if (shortTeams.length === 0) return;

  const takenPlayerIds = new Set<string>();
  Object.values(teams).forEach(t => t.squad.forEach(id => takenPlayerIds.add(id)));

  const pool = Object.values(players).filter(
    p => !p.isRetained && !takenPlayerIds.has(p.id) && p.currentTeamId === null
  );

  const sortedPool = [...pool].sort((a, b) => {
    if (a.isCapped !== b.isCapped) return a.isCapped ? 1 : -1;
    const priceA = a.basePrice ?? 30;
    const priceB = b.basePrice ?? 30;
    if (priceA !== priceB) return priceA - priceB;
    return (a.currentBatting + a.currentBowling) - (b.currentBatting + b.currentBowling);
  });

  for (const team of shortTeams) {
    while (
      team.squad.length < 25 &&
      (team.squad.length < getMinSize(team) || 
       getBowlersCount(team) < 5 || 
       getKeepersCount(team) < 2 || 
       getSpinnersCount(team) < 2 ||
       getIndianBowlersCount(team) < 4 ||
       getIndianBatters75Count(team) < 6 ||
       getIndianBatters77Count(team) < 4) && 
      sortedPool.length > 0
    ) {
      const needsBowler = getBowlersCount(team) < 5;
      const needsKeeper = getKeepersCount(team) < 2;
      const needsSpinner = getSpinnersCount(team) < 2;
      const needsIndianBowler = getIndianBowlersCount(team) < 4;
      const needsIndianBatter77 = getIndianBatters77Count(team) < 4;
      const needsIndianBatter75 = getIndianBatters75Count(team) < 6;
      
      let candidateIdx = 0;
      let candidate = null;

      while (candidateIdx < sortedPool.length) {
        const tempCandidate = sortedPool[candidateIdx];
        const isBowler = tempCandidate.role === "Pace Bowler" || tempCandidate.role === "Spin Bowler";
        const isSpinner = tempCandidate.role === "Spin Bowler";
        const isWkCandidate = isWK(tempCandidate);
        const isIndBowler = tempCandidate.nationality === "Indian" && isBowler;
        const isIndBatter = isIndianBatter(tempCandidate);
        const rating = ratingOf(tempCandidate);
        
        const overseasCount = team.squad.map(id => players[id]).filter(p => p && p.nationality === "Overseas").length;
        const overseasOk = !(tempCandidate.nationality === "Overseas" && overseasCount >= 8);

        const isComputer = team.id !== userTeamId;
        const fullTimeKeepers = team.squad.map(id => players[id]).filter(p => p && isFullTimeKeeper(p)).length;
        const overseasKeepers = team.squad.map(id => players[id]).filter(p => p && isFullTimeKeeper(p) && p.nationality === "Overseas").length;
        
        const keeperAIConstraintOk = !isComputer || !isFullTimeKeeper(tempCandidate) || (
          fullTimeKeepers < 4 && 
          !(tempCandidate.nationality === "Overseas" && overseasKeepers >= 3)
        );

        if (overseasOk && keeperAIConstraintOk) {
          if (needsKeeper && isWkCandidate) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (needsIndianBatter77 && isIndBatter && rating > 77) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (needsIndianBatter75 && isIndBatter && rating > 75) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (needsIndianBowler && isIndBowler) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (!needsKeeper && !needsIndianBatter77 && !needsIndianBatter75 && !needsIndianBowler && needsSpinner && isSpinner) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (!needsKeeper && !needsIndianBatter77 && !needsIndianBatter75 && !needsIndianBowler && !needsSpinner && needsBowler && isBowler) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          } else if (!needsKeeper && !needsIndianBatter77 && !needsIndianBatter75 && !needsIndianBowler && !needsSpinner && !needsBowler) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          }
        }
        candidateIdx++;
      }

      if (!candidate && team.squad.length < getMinSize(team)) {
        // Fallback: If we couldn't find a matching candidate, accept any player to fill the squad to minSquadSize
        candidateIdx = 0;
        while (candidateIdx < sortedPool.length) {
          const tempCandidate = sortedPool[candidateIdx];
          const overseasCount = team.squad.map(id => players[id]).filter(p => p && p.nationality === "Overseas").length;
          const overseasOk = !(tempCandidate.nationality === "Overseas" && overseasCount >= 8);

          const isComputer = team.id !== userTeamId;
          const fullTimeKeepers = team.squad.map(id => players[id]).filter(p => p && isFullTimeKeeper(p)).length;
          const overseasKeepers = team.squad.map(id => players[id]).filter(p => p && isFullTimeKeeper(p) && p.nationality === "Overseas").length;
          
          const keeperAIConstraintOk = !isComputer || !isFullTimeKeeper(tempCandidate) || (
            fullTimeKeepers < 4 && 
            !(tempCandidate.nationality === "Overseas" && overseasKeepers >= 3)
          );

          if (overseasOk && keeperAIConstraintOk) {
            candidate = tempCandidate;
            sortedPool.splice(candidateIdx, 1);
            break;
          }
          candidateIdx++;
        }
      }

      if (!candidate) {
        // No candidate could be found, break to prevent infinite loop
        break;
      }

      team.squad.push(candidate.id);
      const cost = candidate.basePrice ?? 30;
      const actualCost = Math.min(team.remainingPurse, cost);
      team.remainingPurse = Math.max(0, team.remainingPurse - actualCost);
      team.spentAmount += actualCost;

      players[candidate.id] = {
        ...candidate,
        currentTeamId: team.id,
        iplHistory: [
          { teamId: team.id, season: "2027", price: cost },
          ...(candidate.iplHistory ?? [])
        ]
      };
    }
  }
}

export { hammerFall, advanceToNextLot, scheduleAIBids, ensureMinimumSquadSizes };
export type { }; // keep module boundary
