import assert from "node:assert/strict";
import test from "node:test";

import type { Player } from "@/lib/types";
import {
  getClubFigures,
  normalizeClubFigureName,
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

test("club figure identity does not change when a player profile becomes available", () => {
  const beforeLink = getClubFigures("MI", {})
    .find((figure) => figure.name === "Hardik Pandya");
  const afterLink = getClubFigures("MI", {
    "opaque-player-id": player("opaque-player-id", "Hardik Pandya", "MI"),
  }).find((figure) => figure.playerId === "opaque-player-id");

  assert.equal(afterLink?.id, beforeLink?.id);
  assert.equal(afterLink?.id, "MI:hardikpandya");
});

test("unmatched historical figures remain available without a player id", () => {
  const sachin = getClubFigures("MI", {}).find((figure) => figure.name === "Sachin Tendulkar");

  assert.equal(sachin?.playerId, null);
  assert.equal(sachin?.isLinked, false);
});

test("every club has progressively more legends, icons, and heroes without duplicate figures", () => {
  const teamIds = ["MI", "CSK", "KKR", "RCB", "SRH", "RR", "DC", "PBKS", "GT", "LSG"];

  teamIds.forEach((teamId) => {
    const clubFigures = getClubFigures(teamId, {});
    const legendCount = clubFigures.filter((figure) => figure.baseTier === "legend").length;
    const iconCount = clubFigures.filter((figure) => figure.baseTier === "icon").length;
    const heroCount = clubFigures.filter((figure) => figure.baseTier === "hero").length;
    const uniqueNames = new Set(clubFigures.map((figure) => normalizeClubFigureName(figure.name)));

    assert.equal(legendCount, 3, `${teamId} should have three legends`);
    assert.equal(iconCount, 5, `${teamId} should have five icons`);
    assert.equal(heroCount, 7, `${teamId} should have seven heroes`);
    assert.equal(uniqueNames.size, clubFigures.length, `${teamId} should not repeat a club figure`);
  });
});

test("team-specific overrides can move linked players between tiers", () => {
  const players = { "hardik-pandya": player("hardik-pandya", "Hardik Pandya") };
  const figureId = getClubFigures("MI", players)
    .find((figure) => figure.playerId === "hardik-pandya")?.id;
  assert.ok(figureId);

  const hardik = getClubFigures("MI", players, { [figureId]: "legend" })
    .find((figure) => figure.playerId === "hardik-pandya");

  assert.equal(hardik?.baseTier, "hero");
  assert.equal(hardik?.tier, "legend");
});

test("legacy player-id tier keys remain readable without rewriting existing saves", () => {
  const players = { "opaque-player-id": player("opaque-player-id", "Hardik Pandya") };
  const hardik = getClubFigures("MI", players, { "MI:opaque-player-id": "icon" })
    .find((figure) => figure.playerId === "opaque-player-id");

  assert.equal(hardik?.baseTier, "hero");
  assert.equal(hardik?.tier, "icon");
});
