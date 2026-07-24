import assert from "node:assert/strict";
import test from "node:test";

import {
  TACTICAL_ROLE_DEFINITIONS,
  applyTeamTacticsPreset,
  autoAssignTacticalRoles,
  createTeamTactics,
  isPlayerEligibleForTacticalRole,
  normalizeTeamTactics,
  setPlayerTacticalRole,
} from "./teamTactics";
import type { Player } from "@/lib/types";

test("legacy strategy saves migrate into full tactics presets", () => {
  const tactics = normalizeTeamTactics(undefined, "Ultra Aggressive");

  assert.equal(tactics.preset, "Ultra Aggressive");
  assert.equal(tactics.batting.powerplay, "attack");
  assert.equal(tactics.batting.death, "all-out");
  assert.equal(tactics.bowling.field, "attacking");
});

test("changing a preset keeps specialist role assignments", () => {
  const tactics = createTeamTactics("Balanced");
  tactics.roles.battingFirst.anchor = "anchor-player";
  tactics.roles.bowlingFirst.deathBowler = "death-player";

  const changed = applyTeamTacticsPreset(tactics, "Bowling Dominant");

  assert.equal(changed.roles.battingFirst.anchor, "anchor-player");
  assert.equal(changed.roles.bowlingFirst.deathBowler, "death-player");
  assert.equal(changed.impactPolicy, "extra-bowler");
  assert.equal(changed.bowling.middle, "spin-choke");
});

test("malformed saved controls fall back to their selected preset", () => {
  const tactics = normalizeTeamTactics({
    preset: "Anchor & Explode",
    batting: { powerplay: "invalid" },
    bowling: { death: "also-invalid" },
  });

  assert.equal(tactics.batting.powerplay, "cautious");
  assert.equal(tactics.bowling.death, "yorkers");
});

test("legacy role maps migrate to both plans and remove duplicate assignments", () => {
  const tactics = normalizeTeamTactics({
    roles: {
      anchor: "best-batter",
      powerplayAggressor: "best-batter",
      finisher: "finisher",
    },
  });

  assert.equal(tactics.roles.battingFirst.anchor, "best-batter");
  assert.equal(tactics.roles.battingFirst.powerplayAggressor, null);
  assert.equal(tactics.roles.battingFirst.finisher, "finisher");
  assert.deepEqual(tactics.roles.bowlingFirst, tactics.roles.battingFirst);
});

test("a player can hold only one role per discipline within each match plan", () => {
  let tactics = createTeamTactics();
  tactics = setPlayerTacticalRole(tactics, "battingFirst", "player-one", "batting", "anchor");
  tactics = setPlayerTacticalRole(tactics, "battingFirst", "player-one", "batting", "powerplayAggressor");

  assert.equal(tactics.roles.battingFirst.anchor, null);
  assert.equal(tactics.roles.battingFirst.powerplayAggressor, "player-one");
  assert.equal(tactics.roles.bowlingFirst.powerplayAggressor, null);

  tactics = setPlayerTacticalRole(tactics, "battingFirst", "player-two", "batting", "powerplayAggressor");
  assert.equal(tactics.roles.battingFirst.powerplayAggressor, "player-two");
});

test("automatic XI roles are unique and obey their eligibility rules", () => {
  const player = (
    id: string,
    batting: number,
    bowling: number,
    bowlingStyle: Player["bowlingStyle"] = null,
    flags: Partial<Player> = {},
  ) => ({
    id,
    name: id,
    currentBatting: batting,
    currentBowling: bowling,
    bowlingStyle,
    ...flags,
  } as unknown as Player);
  const lineup = [
    player("opener-one", 90, 0, null, { isOpener: true }),
    player("opener-two", 86, 0, null, { isOpener: true }),
    player("number-three", 84, 0),
    player("number-four", 82, 0),
    player("finisher", 80, 0, null, { isFinisher: true }),
    player("all-rounder", 72, 62, "Pacer"),
    player("spinner", 42, 80, "Spinner"),
    player("quick-one", 32, 82, "Pacer"),
    player("quick-two", 30, 78, "Pacer"),
    player("quick-three", 25, 74, "Pacer"),
    player("tailender", 20, 55, "Spinner"),
  ];

  const roles = autoAssignTacticalRoles(lineup);
  assert.equal(roles.powerplayAggressor, "opener-one");
  assert.equal(roles.finisher, "finisher");
  assert.equal(roles.strikeSpinner, "spinner");
  assert.equal(roles.newBallBowler, "quick-one");

  (["batting", "bowling"] as const).forEach((discipline) => {
    const assigned = TACTICAL_ROLE_DEFINITIONS
      .filter((definition) => definition.discipline === discipline)
      .map((definition) => roles[definition.id])
      .filter((playerId): playerId is string => Boolean(playerId));
    assert.equal(new Set(assigned).size, assigned.length);
  });
  TACTICAL_ROLE_DEFINITIONS.forEach((definition) => {
    const playerId = roles[definition.id];
    if (!playerId) return;
    const battingPosition = lineup.findIndex((candidate) => candidate.id === playerId);
    assert.equal(isPlayerEligibleForTacticalRole(lineup[battingPosition], definition.id, battingPosition), true);
  });
});
