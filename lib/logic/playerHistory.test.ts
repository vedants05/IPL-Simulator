import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlayerSeasonHistory,
  mergePlayerIplHistory,
  upsertPlayerIplHistory,
  wasPlayerAcquiredViaRtm,
} from "./playerHistory";

test("saved career seasons survive a database refresh", () => {
  const merged = mergePlayerIplHistory(
    [{ teamId: "MI", season: "2026", price: 1600 }],
    [
      { teamId: "MI", season: "2026", price: 1600 },
      { teamId: "KKR", season: "2027", price: 1850 },
    ],
  );

  assert.deepEqual(getPlayerSeasonHistory(merged, "2027"), {
    teamId: "KKR",
    season: "2027",
    price: 1850,
  });
});

test("a signed season entry wins over a duplicate unsold placeholder", () => {
  const merged = mergePlayerIplHistory([], [
    { teamId: "KKR", season: "2027", price: 300 },
    { teamId: "UNSOLD", season: "2027", price: 0 },
  ]);

  assert.deepEqual(merged, [{ teamId: "KKR", season: "2027", price: 300 }]);
});

test("upsert adds one authoritative team and salary per season", () => {
  const history = upsertPlayerIplHistory(
    [
      { teamId: "MI", season: "2026", price: 1600 },
      { teamId: "UNSOLD", season: "2027", price: 0 },
    ],
    { teamId: "CSK", season: "2027", price: 725, isRtm: true },
  );

  assert.equal(history.length, 2);
  assert.deepEqual(getPlayerSeasonHistory(history, "2027"), {
    teamId: "CSK",
    season: "2027",
    price: 725,
    isRtm: true,
  });
});

test("RTM detection uses the newest bid rather than the oldest bid", () => {
  const normalSale = {
    teamId: "KKR",
    bids: [{ teamId: "KKR" }, { teamId: "MI" }, { teamId: "CSK" }],
  };
  const rtmSale = {
    teamId: "MI",
    bids: [{ teamId: "KKR" }, { teamId: "MI" }, { teamId: "CSK" }],
  };

  assert.equal(wasPlayerAcquiredViaRtm(normalSale), false);
  assert.equal(wasPlayerAcquiredViaRtm(rtmSale), true);
});
