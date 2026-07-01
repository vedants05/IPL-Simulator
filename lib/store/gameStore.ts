"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import {
  GameState,
  Player,
  Team,
  AuctionSet,
} from "@/lib/types";
import { PLAYERS_SEED } from "@/lib/data/players";
import { TEAMS_SEED } from "@/lib/data/teams";
import {
  buildAuctionSets,
  getNextBidAmount,
  canTeamBidOnPlayer,
  canTeamAffordBid,
  TOTAL_PURSE_LAKHS,
} from "@/lib/logic/auctionRules";
import {
  buildInitialTeamPurses,
  processBid,
  canAIBidAtAmount,
  pickBiddingTeam,
  nextAIBidDelay,
  resetLotCache,
  AuctionContext,
} from "@/lib/logic/auctionEngine";

// ---------------------------------------------------------------------------
// Store actions interface
// ---------------------------------------------------------------------------
interface GameActions {
  initNewGame: (userTeamId: string) => void;
  retainPlayer: (playerId: string, slot: number) => void;
  releaseRetention: (playerId: string) => void;
  confirmRetentions: () => void;
  startAuction: () => void;
  placeBid: (teamId: string, amount: number) => void;
  passBid: () => void;
  useRTM: () => void;
  declineRTM: () => void;
  tickTimer: () => void;
  tickRTMTimer: () => void;
  dismissSoldFlash: () => void;
  resetGame: () => void;
}

// ---------------------------------------------------------------------------
// Full store type
// ---------------------------------------------------------------------------
type Store = GameState & GameActions;

// ---------------------------------------------------------------------------
// Helper: pick next player in sets
// ---------------------------------------------------------------------------
function pickNextLot(sets: AuctionSet[]): { setIndex: number; playerIndex: number } | null {
  for (let si = 0; si < sets.length; si++) {
    const set = sets[si];
    if (!set.isCompleted) {
      if (set.currentIndex < set.playerIds.length) {
        return { setIndex: si, playerIndex: set.currentIndex };
      }
    }
  }
  return null;
}

function allSetsComplete(sets: AuctionSet[]): boolean {
  return sets.every((s) => s.isCompleted);
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
      currentDate: "2025-01-10",
      currentSeason: 2025,
      auctionCycle: 1,
      players: {},
      teams: {},
      userTeamId: "",
      auction: null,
      isSetupComplete: false,

      // ----- Actions -----
      initNewGame: (userTeamId) => {
        const playersMap: Record<string, Player> = {};
        PLAYERS_SEED.forEach((p) => {
          playersMap[p.id] = { ...p };
        });

        const teamsMap: Record<string, Team> = {};
        TEAMS_SEED.forEach((t) => {
          const teamPlayers = PLAYERS_SEED.filter((p) => p.currentTeamId === t.id);
          teamsMap[t.id] = {
            ...t,
            squad: teamPlayers.map((p) => p.id),
            remainingPurse: TOTAL_PURSE_LAKHS,
            spentAmount: 0,
          };
        });

        set({
          saveId: uuidv4(),
          saveCreatedAt: new Date().toISOString(),
          currentDate: "2025-01-10",
          currentSeason: 2025,
          auctionCycle: 1,
          players: playersMap,
          teams: teamsMap,
          userTeamId,
          auction: {
            type: "mega",
            season: 2025,
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
            rtmEligibleTeamId: null,
            rtmWindowOpen: false,
            rtmTimerSeconds: 15,
            soldFlash: null,
            saleHistory: [],
          },
          isSetupComplete: false,
        });
      },

      retainPlayer: (playerId, slot) => {
        const { teams, userTeamId, players } = get();
        const team = teams[userTeamId];
        if (!team) return;
        if (team.retainedPlayers.length >= 6) return;
        if (team.retainedPlayers.includes(playerId)) return;

        const player = players[playerId];
        if (!player) return;

        // Validate uncapped slots (4-6 must be uncapped Indian)
        const isUncappedSlot = slot >= 4;
        if (isUncappedSlot && (player.isCapped || player.nationality !== "Indian")) return;

        const cost = getRetentionCostForSlot(slot);

        set((state) => {
          const newTeam = {
            ...team,
            retainedPlayers: [...team.retainedPlayers, playerId],
            remainingPurse: team.remainingPurse - cost,
            spentAmount: team.spentAmount + cost,
          };
          const newPlayer = {
            ...player,
            isRetained: true,
            retainedByTeamId: userTeamId,
          };
          return {
            teams: { ...state.teams, [userTeamId]: newTeam },
            players: { ...state.players, [playerId]: newPlayer },
          };
        });
      },

      releaseRetention: (playerId) => {
        const { teams, userTeamId, players } = get();
        const team = teams[userTeamId];
        if (!team) return;

        const retainedIndex = team.retainedPlayers.indexOf(playerId);
        if (retainedIndex === -1) return;

        const slot = retainedIndex + 1;
        const cost = getRetentionCostForSlot(slot);

        set((state) => {
          const newRetained = team.retainedPlayers.filter((id) => id !== playerId);
          const newTeam = {
            ...team,
            retainedPlayers: newRetained,
            remainingPurse: team.remainingPurse + cost,
            spentAmount: team.spentAmount - cost,
          };
          const player = players[playerId];
          const newPlayer = { ...player, isRetained: false, retainedByTeamId: null };
          return {
            teams: { ...state.teams, [userTeamId]: newTeam },
            players: { ...state.players, [playerId]: newPlayer },
          };
        });
      },

      confirmRetentions: () => {
        const { teams, players, userTeamId } = get();

        // Build player pool: all non-retained players
        const allPlayerIds = Object.values(players)
          .filter((p) => !p.isRetained)
          .map((p) => p.id);

        // AI teams: auto-retain their top 3 players
        const updatedTeams = { ...teams };
        const updatedPlayers = { ...players };

        Object.values(teams).forEach((team) => {
          if (team.id === userTeamId) return;

          const teamPlayers = team.squad
            .map((id) => players[id])
            .filter(Boolean)
            .sort((a, b) => b.starRating - a.starRating);

          const toRetain = teamPlayers.slice(0, 3);
          let purse = TOTAL_PURSE_LAKHS;
          const retainedIds: string[] = [];

          toRetain.forEach((p, idx) => {
            const cost = getRetentionCostForSlot(idx + 1);
            retainedIds.push(p.id);
            purse -= cost;
            updatedPlayers[p.id] = { ...p, isRetained: true, retainedByTeamId: team.id };
            // Remove from allPlayerIds
            const poolIdx = allPlayerIds.indexOf(p.id);
            if (poolIdx !== -1) allPlayerIds.splice(poolIdx, 1);
          });

          updatedTeams[team.id] = {
            ...team,
            retainedPlayers: retainedIds,
            remainingPurse: purse,
            spentAmount: TOTAL_PURSE_LAKHS - purse,
            squad: retainedIds,
            rtmCardsTotal: Math.min(3, 3 - retainedIds.length + (retainedIds.length > 0 ? 1 : 0)),
          };
        });

        // User team: clear squad to only retained players
        const userTeam = updatedTeams[userTeamId];
        updatedTeams[userTeamId] = {
          ...userTeam,
          squad: userTeam.retainedPlayers,
          rtmCardsTotal: Math.max(0, 3 - userTeam.retainedPlayers.length),
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
        const { auction, players } = get();
        if (!auction || auction.phase !== "live") return;
        if (auction.sets.length === 0) return;

        const next = pickNextLot(auction.sets);
        if (!next) return;

        const currentSet = auction.sets[next.setIndex];
        const playerId = currentSet.playerIds[next.playerIndex];
        const player = players[playerId];

        set((state) => ({
          auction: state.auction
            ? {
                ...state.auction,
                currentSetIndex: next.setIndex,
                currentPlayer: player,
                currentBid: player.basePrice,
                currentHighBidderTeamId: null,
                biddingHistory: [],
                timerSeconds: 10,
                soldFlash: null,
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

        const { canBid } = canTeamBidOnPlayer(team, auction.currentPlayer);
        if (!canBid) return;
        if (!canTeamAffordBid(team, amount)) return;

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

      useRTM: () => {
        const { auction, teams, players, userTeamId } = get();
        if (!auction || !auction.rtmWindowOpen || !auction.currentPlayer) return;

        const userTeam = teams[userTeamId];
        if (!userTeam) return;

        const player = auction.currentPlayer;
        const rtmAmount = auction.currentBid;

        // Transfer player to user team
        const winnerTeamId = auction.currentHighBidderTeamId!;

        set((state) => {
          const newTeams = { ...state.teams };

          // Remove from winner's squad
          newTeams[winnerTeamId] = {
            ...newTeams[winnerTeamId],
            squad: newTeams[winnerTeamId].squad.filter((id) => id !== player.id),
            remainingPurse: newTeams[winnerTeamId].remainingPurse + rtmAmount,
            spentAmount: newTeams[winnerTeamId].spentAmount - rtmAmount,
            overseasPlayersCurrent:
              player.nationality === "Overseas"
                ? newTeams[winnerTeamId].overseasPlayersCurrent - 1
                : newTeams[winnerTeamId].overseasPlayersCurrent,
          };

          // Add to user team
          newTeams[userTeamId] = {
            ...newTeams[userTeamId],
            squad: [...newTeams[userTeamId].squad, player.id],
            remainingPurse: newTeams[userTeamId].remainingPurse - rtmAmount,
            spentAmount: newTeams[userTeamId].spentAmount + rtmAmount,
            rtmCardsUsed: newTeams[userTeamId].rtmCardsUsed + 1,
            overseasPlayersCurrent:
              player.nationality === "Overseas"
                ? newTeams[userTeamId].overseasPlayersCurrent + 1
                : newTeams[userTeamId].overseasPlayersCurrent,
          };

          const newPlayers = {
            ...state.players,
            [player.id]: { ...player, currentTeamId: userTeamId },
          };

          const newSoldIds = [...(state.auction?.soldPlayerIds ?? []), player.id];
          const newPurses = {
            ...(state.auction?.teamPurses ?? {}),
            [userTeamId]: {
              remaining: newTeams[userTeamId].remainingPurse,
              squadCount: newTeams[userTeamId].squad.length,
            },
            [winnerTeamId]: {
              remaining: newTeams[winnerTeamId].remainingPurse,
              squadCount: newTeams[winnerTeamId].squad.length,
            },
          };

          return {
            teams: newTeams,
            players: newPlayers,
            auction: state.auction
              ? {
                  ...state.auction,
                  soldPlayerIds: newSoldIds,
                  soldFlash: { playerId: player.id, teamId: userTeamId, amount: rtmAmount },
                  rtmWindowOpen: false,
                  rtmEligibleTeamId: null,
                  teamPurses: newPurses,
                  saleHistory: [...(state.auction.saleHistory ?? []), { playerId: player.id, teamId: userTeamId, price: rtmAmount, lot: state.auction.currentLotIndex, bids: state.auction.biddingHistory }],
                }
              : null,
          };
        });

        // Advance after flash
        setTimeout(() => advanceToNextLot(), 2200);
      },

      declineRTM: () => {
        set((state) => {
          const a = state.auction;
          if (!a) return {};
          const newSale = a.currentPlayer && a.currentHighBidderTeamId
            ? { playerId: a.currentPlayer.id, teamId: a.currentHighBidderTeamId, price: a.currentBid, lot: a.currentLotIndex, bids: a.biddingHistory }
            : null;
          return {
            auction: {
              ...a,
              rtmWindowOpen: false,
              rtmEligibleTeamId: null,
              saleHistory: newSale ? [...(a.saleHistory ?? []), newSale] : (a.saleHistory ?? []),
            },
          };
        });
        setTimeout(() => advanceToNextLot(), 300);
      },

      tickTimer: () => {
        const { auction } = get();
        if (!auction || auction.phase !== "live" || !auction.currentPlayer) return;
        if (auction.rtmWindowOpen) return;
        if (auction.soldFlash) return;

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
        const { auction } = get();
        if (!auction?.rtmWindowOpen) return;

        if (auction.rtmTimerSeconds <= 0) {
          get().declineRTM();
          return;
        }

        set((state) => ({
          auction: state.auction
            ? { ...state.auction, rtmTimerSeconds: state.auction.rtmTimerSeconds - 1 }
            : null,
        }));
      },

      dismissSoldFlash: () => {
        set((state) => ({
          auction: state.auction ? { ...state.auction, soldFlash: null } : null,
        }));
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
        });
      },
    }),
    {
      name: "ipl-simulator-save",
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
      }),
    }
  )
);

function getRetentionCostForSlot(slot: number): number {
  const costs = [1800, 1400, 1100, 1800, 1400, 1100];
  return costs[slot - 1] ?? 0;
}

/**
 * Fast-forward the AI bidding for the current lot synchronously.
 * Called when the user presses PASS — runs all remaining AI bids instantly,
 * then hands off to hammerFall so the player sells (or goes unsold) normally.
 */
function simulateRemainingBids(player: Player) {
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
  const highBidder = auction.currentHighBidderTeamId;

  if (!highBidder) {
    // No bids → unsold
    useGameStore.setState((s) => ({
      auction: s.auction
        ? {
            ...s.auction,
            unsoldPlayerIds: [...s.auction.unsoldPlayerIds, player.id],
            soldFlash: null,
          }
        : null,
    }));
    setTimeout(() => advanceToNextLot(), 500);
    return;
  }

  // Sold to highBidder
  const soldAmount = auction.currentBid;
  const winnerTeam = teams[highBidder];

  // Check RTM eligibility for user
  const userTeam = teams[userTeamId];
  const rtmEligible =
    highBidder !== userTeamId &&
    userTeam.rtmCardsUsed < userTeam.rtmCardsTotal &&
    player.iplHistory.some((h) => h.teamId === userTeamId && h.season === "2024");

  useGameStore.setState((s) => {
    const newTeams = { ...s.teams };

    // Update winner team
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

    const newPlayers = {
      ...s.players,
      [player.id]: { ...player, currentTeamId: highBidder },
    };

    const newPurses = {
      ...(s.auction?.teamPurses ?? {}),
      [highBidder]: {
        remaining: newTeams[highBidder].remainingPurse,
        squadCount: newTeams[highBidder].squad.length,
      },
    };

    const newSoldIds = [...(s.auction?.soldPlayerIds ?? []), player.id];

    if (rtmEligible) {
      return {
        teams: newTeams,
        players: newPlayers,
        auction: s.auction
          ? {
              ...s.auction,
              soldPlayerIds: newSoldIds,
              teamPurses: newPurses,
              rtmWindowOpen: true,
              rtmEligibleTeamId: userTeamId,
              rtmTimerSeconds: 15,
            }
          : null,
      };
    }

    return {
      teams: newTeams,
      players: newPlayers,
      auction: s.auction
        ? {
            ...s.auction,
            soldPlayerIds: newSoldIds,
            teamPurses: newPurses,
            soldFlash: { playerId: player.id, teamId: highBidder, amount: soldAmount },
            saleHistory: [...(s.auction.saleHistory ?? []), { playerId: player.id, teamId: highBidder, price: soldAmount, lot: auction.currentLotIndex, bids: auction.biddingHistory }],
          }
        : null,
    };
  });

  if (!rtmEligible) {
    setTimeout(() => advanceToNextLot(), 2200);
  }
}

function advanceToNextLot() {
  const state = useGameStore.getState();
  const { auction, players, teams, userTeamId } = state;
  if (!auction) return;

  // Clear sold flash
  useGameStore.setState((s) => ({
    auction: s.auction ? { ...s.auction, soldFlash: null } : null,
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
    // All sets done — start accelerated phase or end
    if (!auction.isAcceleratedPhase && auction.unsoldPlayerIds.length > 0) {
      // Build accelerated set with unsold players at half price
      const unsoldPlayers = auction.unsoldPlayerIds
        .map((id) => players[id])
        .filter(Boolean)
        .map((p) => ({ ...p, basePrice: Math.max(20, Math.floor(p.basePrice / 2)) }));

      const acceleratedSets = [{
        id: "accelerated",
        name: "Accelerated Auction",
        playerIds: unsoldPlayers.map((p) => p.id),
        currentIndex: 0,
        isCompleted: false,
      }];

      const firstPlayer = unsoldPlayers[0];

      useGameStore.setState((s) => ({
        players: {
          ...s.players,
          ...Object.fromEntries(unsoldPlayers.map((p) => [p.id, p])),
        },
        auction: s.auction
          ? {
              ...s.auction,
              sets: acceleratedSets,
              currentSetIndex: 0,
              currentPlayer: firstPlayer,
              currentBid: firstPlayer.basePrice,
              currentHighBidderTeamId: null,
              biddingHistory: [],
              timerSeconds: 10,
              isAcceleratedPhase: true,
              unsoldPlayerIds: [],
            }
          : null,
      }));
      return;
    }

    // Auction complete
    useGameStore.setState((s) => ({
      auction: s.auction ? { ...s.auction, phase: "completed", currentPlayer: null } : null,
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
  const state = useGameStore.getState();
  const { auction } = state;
  if (!auction?.currentPlayer) return;

  const delay = nextAIBidDelay(auction.currentBid);
  const lotId = player.id; // stable ID for the valuation cache

  setTimeout(() => {
    const s = useGameStore.getState();
    const { auction: a, teams, players: allPlayers, userTeamId } = s;

    // Guard: lot must still be the same player and auction active
    if (!a || !a.currentPlayer || a.currentPlayer.id !== player.id) return;
    if (a.phase !== "live") return;
    if (a.rtmWindowOpen || a.soldFlash) return;

    const nextBid = getNextBidAmount(a.currentBid);

    // Build auction context for AI engine
    const totalLots = a.sets.reduce((sum, s) => sum + s.playerIds.length, 0);
    const ctx: AuctionContext = {
      remainingPlayerIds: a.allPlayerIds.filter(
        id => !a.soldPlayerIds.includes(id) && id !== player.id
      ),
      soldPlayerIds: a.soldPlayerIds,
      currentLotIndex: a.currentLotIndex,
      totalLots,
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
  }, delay);
}

export { hammerFall, advanceToNextLot, scheduleAIBids };
