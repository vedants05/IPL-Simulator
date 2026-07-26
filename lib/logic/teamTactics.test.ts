import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTeamTacticsPreset,
  createTeamTactics,
  normalizeTeamTactics,
} from "./teamTactics";

test("legacy strategy saves migrate into full tactics presets", () => {
  const tactics = normalizeTeamTactics(undefined, "Ultra Aggressive");

  assert.equal(tactics.preset, "Ultra Aggressive");
  assert.equal(tactics.batting.powerplay, "attack");
  assert.equal(tactics.batting.death, "all-out");
  assert.equal(tactics.bowling.field, "attacking");
});

test("changing a preset applies every control from the new approach", () => {
  const tactics = createTeamTactics("Balanced");
  const changed = applyTeamTacticsPreset(tactics, "Bowling Dominant");

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

test("obsolete specialist role assignments are ignored when loading old saves", () => {
  const tactics = normalizeTeamTactics({
    roles: {
      anchor: "best-batter",
      powerplayAggressor: "best-batter",
      finisher: "finisher",
    },
  });

  assert.equal("roles" in tactics, false);
});
