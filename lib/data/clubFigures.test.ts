import assert from "node:assert/strict";
import test from "node:test";

import type { Player } from "@/lib/types";
import {
  getClubFigureOverrideKey,
  getClubFigures,
  promoteClubFigureTier,
} from "./clubFigures";

const player = (id: string, name: string, currentTeamId: string | null = null) => ({ id, name, currentTeamId }) as Player;

test("club figures link to database players by normalized name and aliases", () => {
  const players = {
    "rohit-sharma": player("rohit-sharma", "Rohit Sharma"),
    "t-natarajan": player("t-natarajan", "T Natarajan"),
  };

  const miRohit = getClubFigures("MI", players).find((figure) => figure.name === "Rohit Sharma");
  const srhNatarajan = getClubFigures("SRH", players).find((figure) => figure.playerId === "t-natarajan");

  assert.equal(miRohit?.playerId, "rohit-sharma");
  assert.equal(miRohit?.isLinked, true);
  assert.equal(miRohit?.currentTeamId, null);
  assert.equal(srhNatarajan?.isLinked, true);
});

test("linked figures expose their current in-game club", () => {
  const figures = getClubFigures("KKR", {
    "rinku-singh": player("rinku-singh", "Rinku Singh", "KKR"),
  });
  const rinku = figures.find((figure) => figure.playerId === "rinku-singh");

  assert.equal(rinku?.currentTeamId, "KKR");
});

test("unmatched historical figures remain available without a player id", () => {
  const sachin = getClubFigures("MI", {}).find((figure) => figure.name === "Sachin Tendulkar");

  assert.equal(sachin?.playerId, null);
  assert.equal(sachin?.isLinked, false);
});

test("team-specific overrides can move linked players between tiers", () => {
  const players = { "hardik-pandya": player("hardik-pandya", "Hardik Pandya") };
  const overrideKey = getClubFigureOverrideKey("MI", "hardik-pandya", "Hardik Pandya");
  const hardik = getClubFigures("MI", players, { [overrideKey]: "legend" })
    .find((figure) => figure.playerId === "hardik-pandya");

  assert.equal(hardik?.baseTier, "hero");
  assert.equal(hardik?.tier, "legend");
  assert.equal(promoteClubFigureTier("hero"), "icon");
  assert.equal(promoteClubFigureTier("icon"), "legend");
  assert.equal(promoteClubFigureTier("legend"), "legend");
});
