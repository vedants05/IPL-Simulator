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
} from "@/lib/types";
import { PLAYERS_SEED } from "@/lib/data/players";
import { TEAMS_SEED } from "@/lib/data/teams";
import {
  buildAuctionSets,
  getNextBidAmount,
  canTeamBidOnPlayer,
  canTeamAffordBid,
  TOTAL_PURSE_LAKHS,
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
} from "@/lib/logic/auctionEngine";

// ---------------------------------------------------------------------------
// Store actions interface
// ---------------------------------------------------------------------------
interface GameStateAdditions {
  isPaused: boolean;
  speed: number;
  skipSetSummary: SkipSetSummary | null;
}

interface GameActions {
  initNewGame: (userTeamId: string) => void;
  retainPlayer: (playerId: string) => void;
  releaseRetention: (playerId: string) => void;
  confirmRetentions: () => void;
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
  dismissSkipSetSummary: () => void;
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

      // ----- Actions -----
      initNewGame: (userTeamId) => {
        const playersMap: Record<string, Player> = {};
        PLAYERS_SEED.forEach((p: Player) => {
          playersMap[p.id] = { ...p, currentTeamId: null, isRetained: false, retainedByTeamId: null };
        });

        const teamsMap: Record<string, Team> = {};
        TEAMS_SEED.forEach((t) => {
          const teamPlayers = PLAYERS_SEED.filter((p: Player) => 
            p.iplHistory?.some((h) => h.season === "2026" && h.teamId === t.id)
          );
          teamsMap[t.id] = {
            ...t,
            squad: teamPlayers.map((p: Player) => p.id),
            retainedPlayers: [],
            remainingPurse: TOTAL_PURSE_LAKHS,
            spentAmount: 0,
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

        // Sync teams colors with updated TEAMS_SEED
        const updatedTeams = { ...teams };
        TEAMS_SEED.forEach((t) => {
          if (updatedTeams[t.id]) {
            updatedTeams[t.id] = {
              ...updatedTeams[t.id],
              primaryColor: t.primaryColor,
              secondaryColor: t.secondaryColor,
            };
          }
        });

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

      // ---- RTM: user is original team, AI is winner ----

      exerciseRtm: () => {
        const { auction, teams, userTeamId } = get();
        if (!auction?.rtm || auction.rtm.phase !== "offer") return;
        if (auction.rtm.originalTeamId !== userTeamId) return;
        if (!auction.currentPlayer) return;

        const { winnerTeamId, baseAmount } = auction.rtm;
        const userTeam = teams[userTeamId];
        if (userTeam && userTeam.remainingPurse < baseAmount) return; // Cannot afford RTM

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

      skipCurrentSet: () => {
        const state = get();
        const { auction, players, teams, userTeamId } = state;
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

        const results: SkipSetResultItem[] = [];
        const totalLots = auction.sets.reduce((sum, s) => sum + s.playerIds.length, 0);

        // The first player in this slice is the one already on the block, so it
        // keeps the current lot number; only subsequent players advance the lot.
        let isFirstProcessed = true;

        playersToAuctionIds.forEach((playerId) => {
          const player = newPlayers[playerId];
          if (!player) return;

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
          };

          let currentBid = player.basePrice;
          let highBidderTeamId: string | null = null;
          let biddingHistory: BidEntry[] = [];

          let iterations = 0;
          const MAX_ITER = 300;
          while (iterations < MAX_ITER) {
            iterations++;
            const nextBid = getNextBidAmount(currentBid);

            const interested = Object.values(newTeams).filter((t) => {
              if (t.id === userTeamId) return false;
              if (t.id === highBidderTeamId) return false;
              return canAIBidAtAmount(t, player, nextBid, player.id, newPlayers, ctx);
            });

            if (interested.length === 0) break;

            const bidder = pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
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
            });
          } else {
            let finalWinnerId = highBidderTeamId;
            let finalPrice = currentBid;
            let usedRtm = false;

            const rtmTeamId = findRTMEligibleTeam(player, newTeams, highBidderTeamId, currentBid);

            if (rtmTeamId && rtmTeamId !== userTeamId) {
              const rtmTeam = newTeams[rtmTeamId];
              const aiOrigValuation = getCachedValuation(rtmTeamId);
              const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;

              if (aiOrigValuation * loyaltyBonus > currentBid && rtmTeam.remainingPurse >= currentBid) {
                const winnerTeam = newTeams[highBidderTeamId];
                const aiWinnerValuation = getCachedValuation(highBidderTeamId);

                if (aiWinnerValuation > currentBid * 1.05 && winnerTeam.remainingPurse >= currentBid * 1.05) {
                  let counterAmount = currentBid;
                  const target = Math.min(aiWinnerValuation, Math.round(currentBid * 1.25));
                  while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
                  if (counterAmount <= currentBid) counterAmount = getNextBidAmount(currentBid);

                  if (aiOrigValuation * loyaltyBonus >= counterAmount && rtmTeam.remainingPurse >= counterAmount) {
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

            results.push({
              player: newPlayers[player.id],
              status: "sold",
              teamId: finalWinnerId,
              price: finalPrice,
              usedRtm,
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

        set({
          teams: newTeams,
          players: newPlayers,
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
      },

      skipAllAuction: () => {
        const state = get();
        const { auction, players, teams, userTeamId } = state;
        if (!auction || auction.phase !== "live") return;

        _hammerLotId = null;

        const newTeams = { ...teams };
        const newPlayers = { ...players };
        let newSoldIds = [...(auction.soldPlayerIds ?? [])];
        let newUnsoldIds = [...(auction.unsoldPlayerIds ?? [])];
        let newSaleHistory = [...(auction.saleHistory ?? [])];
        let currentLotIndex = auction.currentLotIndex;
        const totalLots = auction.allPlayerIds.length;

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

        const simulateOne = (playerId: string) => {
          const player = newPlayers[playerId];
          if (!player) return;

          resetLotCache();

          const ctx: AuctionContext = {
            remainingPlayerIds: auction.allPlayerIds.filter(
              (id) => !newSoldIds.includes(id) && id !== player.id
            ),
            soldPlayerIds: newSoldIds,
            currentLotIndex,
            totalLots,
          };

          let currentBid = player.basePrice;
          let highBidderTeamId: string | null = null;
          let biddingHistory: BidEntry[] = [];

          let iterations = 0;
          const MAX_ITER = 300;
          while (iterations < MAX_ITER) {
            iterations++;
            const nextBid = getNextBidAmount(currentBid);

            const interested = Object.values(newTeams).filter((t) => {
              if (t.id === highBidderTeamId) return false;
              return canAIBidAtAmount(t, player, nextBid, player.id, newPlayers, ctx);
            });

            if (interested.length === 0) break;

            const bidder = pickBiddingTeam(interested, player, player.id, newPlayers, ctx);
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
              const aiOrigValuation = getCachedValuation(rtmTeamId) || getLotValuation(player.id, rtmTeam, player, newPlayers, ctx);
              const loyaltyBonus = 1.0 + (rtmTeam?.dna.loyalty ?? 50) / 100 * 0.25;

              if (aiOrigValuation * loyaltyBonus > currentBid && rtmTeam.remainingPurse >= currentBid) {
                const winnerTeam = newTeams[highBidderTeamId];
                const aiWinnerValuation = getCachedValuation(highBidderTeamId) || getLotValuation(player.id, winnerTeam, player, newPlayers, ctx);

                if (aiWinnerValuation > currentBid * 1.05 && winnerTeam.remainingPurse >= currentBid * 1.05) {
                  let counterAmount = currentBid;
                  const target = Math.min(aiWinnerValuation, Math.round(currentBid * 1.25));
                  while (counterAmount < target) counterAmount = getNextBidAmount(counterAmount);
                  if (counterAmount <= currentBid) counterAmount = getNextBidAmount(currentBid);

                  if (aiOrigValuation * loyaltyBonus >= counterAmount && rtmTeam.remainingPurse >= counterAmount) {
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

        // Simulate all remaining players in regular sets
        remainingPlayerIds.forEach(simulateOne);

        // Simulate accelerated phases
        let isAccelerated = true;
        let lastAccelUnsoldCount = newUnsoldIds.length;
        let halve = true;

        while (isAccelerated && newUnsoldIds.length > 0) {
          const unsoldPlayers = newUnsoldIds
            .map((id) => newPlayers[id])
            .filter(Boolean)
            .map((p) => halve ? { ...p, basePrice: Math.max(20, Math.floor(p.basePrice / 2)) } : { ...p });
          
          halve = false;
          
          if (unsoldPlayers.length === 0) break;

          const playersToSimulate = unsoldPlayers.map(p => p.id);
          newUnsoldIds = [];

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

        const updatedPurses: Record<string, { remaining: number; squadCount: number }> = {};
        Object.values(newTeams).forEach((t) => {
          updatedPurses[t.id] = { remaining: t.remainingPurse, squadCount: t.squad.length };
        });

        set({
          teams: newTeams,
          players: newPlayers,
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
        });
      },
    }),
    {
      name: "ipl-simulator-save-v3",
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
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Store>;
        if (p.teams) {
          for (const [id, team] of Object.entries(p.teams)) {
            const seed = TEAMS_SEED.find(t => t.id === id);
            if (!team.dna) {
              if (seed) team.dna = seed.dna;
            } else if (!team.dna.segmentFocus && seed?.dna.segmentFocus) {
              // Older saves predate teamLogic.csv segment focus — patch it in
              team.dna.segmentFocus = seed.dna.segmentFocus;
            }
          }
        }
        return { ...current, ...p };
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
      // Halve base price only on the FIRST accelerated round; later rounds keep
      // the reduced base so prices don't collapse to nothing.
      const halve = !auction.isAcceleratedPhase;
      const unsoldPlayers = auction.unsoldPlayerIds
        .map((id) => players[id])
        .filter(Boolean)
        .map((p) => halve ? { ...p, basePrice: Math.max(20, Math.floor(p.basePrice / 2)) } : { ...p });

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
          players: {
            ...s.players,
            ...Object.fromEntries(unsoldPlayers.map((p) => [p.id, p])),
          },
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
    useGameStore.setState((s) => ({
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
  const state = useGameStore.getState();
  const { auction } = state;
  if (!auction?.currentPlayer) return;

  const delay = nextAIBidDelay(auction.currentBid);
  const lotId = player.id; // stable ID for the valuation cache
  const speed = state.speed;
  const speedAdjustedDelay = delay / speed;

  setTimeout(() => {
    const s = useGameStore.getState();
    const { auction: a, teams, players: allPlayers, userTeamId } = s;

    // Guard: lot must still be the same player and auction active
    if (!a || !a.currentPlayer || a.currentPlayer.id !== player.id) return;
    if (a.phase !== "live") return;
    if (a.rtm || a.soldFlash || a.unsoldFlash) return;

    if (s.isPaused) {
      setTimeout(() => scheduleAIBids(player), 500);
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

// Tracks the unsold count entering the current accelerated round, so repeated
// accelerated rounds stop once a whole pass clears no one.
let _lastAccelUnsoldCount = Infinity;

export { hammerFall, advanceToNextLot, scheduleAIBids };
export type { }; // keep module boundary
