import assert from "node:assert/strict";
import test from "node:test";

test("completed careers roll into an idempotent next-season retention state", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  const testGlobal = globalThis as typeof globalThis & { WebSocket?: typeof WebSocket };
  testGlobal.WebSocket ??= class TestWebSocket {} as unknown as typeof WebSocket;
  const { getSeasonDates, useGameStore } = await import("./gameStore");

  useGameStore.setState({
    currentSeason: 2027,
    currentDate: "2027-05-31",
    auctionCycle: 1,
    fixtureSeed: "season-2027",
    userTeamId: "KKR",
    lastRolledOverSeason: null,
    players: {
      player: { id: "player", isRetained: true, retainedByTeamId: "KKR", currentTeamId: "KKR" } as never,
    },
    teams: {
      KKR: {
        id: "KKR", squad: ["player"], retainedPlayers: ["player"], remainingPurse: 100,
        spentAmount: 11900, rtmCardsTotal: 0,
      } as never,
    },
    auction: { season: 2027, phase: "completed" } as never,
  });

  assert.equal(useGameStore.getState().beginNextSeasonRetention(), true);
  const advanced = useGameStore.getState();
  assert.equal(advanced.currentSeason, 2028);
  assert.equal(advanced.currentDate, getSeasonDates(2028).retentionDate);
  assert.equal(advanced.auctionCycle, 2);
  assert.equal(advanced.auction?.season, 2028);
  assert.equal(advanced.auction?.phase, "retention");
  assert.deepEqual(advanced.teams.KKR.squad, ["player"]);
  assert.deepEqual(advanced.teams.KKR.retainedPlayers, []);
  assert.equal(advanced.players.player.currentTeamId, "KKR");
  assert.equal(advanced.players.player.isRetained, false);
  assert.equal(advanced.lastRolledOverSeason, 2027);

  assert.equal(useGameStore.getState().beginNextSeasonRetention(), false);
  assert.equal(useGameStore.getState().currentSeason, 2028);
  assert.equal(useGameStore.getState().auctionCycle, 2);

  useGameStore.setState({ auction: { ...useGameStore.getState().auction, phase: "completed" } as never });
  assert.equal(useGameStore.getState().beginNextSeasonRetention(), true);
  assert.equal(useGameStore.getState().currentSeason, 2029);
  assert.equal(useGameStore.getState().auction?.season, 2029);
  assert.equal(useGameStore.getState().auctionCycle, 3);
});

test("career season archives replace duplicate years without losing other seasons", async () => {
  const { useGameStore } = await import("./gameStore");
  useGameStore.setState({ careerSeasonArchives: [] });
  const archive = { season: 2027, fixtures: [{ id: "final" }], standings: [], playerStats: {} };
  useGameStore.getState().archiveCareerSeason(archive);
  useGameStore.getState().archiveCareerSeason({ ...archive, fixtures: [{ id: "updated-final" }] });
  assert.equal(useGameStore.getState().careerSeasonArchives.length, 1);
  assert.deepEqual(useGameStore.getState().careerSeasonArchives[0].fixtures, [{ id: "updated-final" }]);
});
