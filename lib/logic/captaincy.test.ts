import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_TEAM_LEADERSHIP,
  appointCaptain,
  appointViceCaptain,
  confirmCaptainChange,
  getCaptainChangeGamesRemaining,
  getCaptaincyInterestStatus,
  normalizeTeamLeadership,
  recommendTeamLeadership,
  type TeamLeadership,
} from "./captaincy";
import type { Player } from "@/lib/types";

const player = (
  id: string,
  captaincy: number,
  isIplCaptaincyUnavailable = false,
  age = 30,
): Player => ({
  id,
  name: id.toUpperCase(),
  age,
  captaincy,
  isIplCaptaincyUnavailable,
} as Player);

const squad = [
  player("leader", 90),
  player("deputy", 82),
  player("candidate", 78),
  player("veteran", 70, false, 33),
  player("uninterested", 99, true),
];
const ACTIVE_SEASON = 2027;

const leadership = (update: Partial<TeamLeadership> = {}): TeamLeadership => ({
  ...EMPTY_TEAM_LEADERSHIP,
  temporaryUninterestedThroughSeason: {},
  permanentlyUninterestedPlayerIds: [],
  ...update,
});

test("captaincy recommendations ignore uninterested players", () => {
  assert.deepEqual(recommendTeamLeadership(squad), {
    captainId: "leader",
    viceCaptainId: "deputy",
    captainChangeLockedUntilGamesPlayed: null,
    temporaryUninterestedThroughSeason: {},
    permanentlyUninterestedPlayerIds: [],
  });
});

test("captaincy selections are normalized against the current squad", () => {
  assert.deepEqual(normalizeTeamLeadership({
    captainId: "uninterested",
    viceCaptainId: "missing",
  }, squad), {
    captainId: null,
    viceCaptainId: null,
    captainChangeLockedUntilGamesPlayed: null,
    temporaryUninterestedThroughSeason: {},
    permanentlyUninterestedPlayerIds: [],
  });
});

test("the first captain can be appointed immediately", () => {
  assert.equal(appointCaptain(leadership(), "leader", squad).captainId, "leader");
});

test("an existing captain cannot be replaced through the initial appointment action", () => {
  const current = leadership({ captainId: "leader", viceCaptainId: "deputy" });
  assert.deepEqual(appointCaptain(current, "candidate", squad), current);
});

test("a confirmed captain change locks the role and removes the outgoing captain's interest through next season", () => {
  const current = leadership({ captainId: "leader", viceCaptainId: "deputy" });
  const changed = confirmCaptainChange(current, "candidate", squad, 5, ACTIVE_SEASON);

  assert.equal(changed.captainId, "candidate");
  assert.equal(changed.viceCaptainId, "deputy");
  assert.equal(changed.captainChangeLockedUntilGamesPlayed, 8);
  assert.equal(changed.temporaryUninterestedThroughSeason.leader, ACTIVE_SEASON + 1);
  assert.equal(getCaptainChangeGamesRemaining(changed, 5), 3);
  assert.deepEqual(getCaptaincyInterestStatus(squad[0], changed, ACTIVE_SEASON), {
    interested: false,
    temporarilyUnavailable: true,
    permanentlyUnavailable: false,
    uninterestedThroughSeason: ACTIVE_SEASON + 1,
  });
  assert.equal(getCaptaincyInterestStatus(squad[0], changed, ACTIVE_SEASON + 1).interested, false);
});

test("captain changes are rejected until three more games have been played", () => {
  const changed = confirmCaptainChange(
    leadership({ captainId: "leader", viceCaptainId: "deputy" }),
    "candidate",
    squad,
    5,
    ACTIVE_SEASON,
  );

  assert.deepEqual(confirmCaptainChange(changed, "deputy", squad, 7, ACTIVE_SEASON), changed);
  const unlocked = normalizeTeamLeadership(changed, squad, 8, ACTIVE_SEASON);
  assert.equal(getCaptainChangeGamesRemaining(unlocked, 8), 0);
  assert.deepEqual(getCaptaincyInterestStatus(squad[0], unlocked, ACTIVE_SEASON), {
    interested: false,
    temporarilyUnavailable: true,
    permanentlyUnavailable: false,
    uninterestedThroughSeason: ACTIVE_SEASON + 1,
  });

  const interestRecovered = normalizeTeamLeadership(changed, squad, 8, ACTIVE_SEASON + 2);
  assert.deepEqual(getCaptaincyInterestStatus(squad[0], interestRecovered, ACTIVE_SEASON + 2), {
    interested: true,
    temporarilyUnavailable: false,
    permanentlyUnavailable: false,
    uninterestedThroughSeason: null,
  });
});

test("legacy game-based interest cooldowns migrate through the end of next season", () => {
  const migrated = normalizeTeamLeadership({
    captainId: "candidate",
    viceCaptainId: "deputy",
    temporaryUninterestedUntilGamesPlayed: { leader: 8 },
  }, squad, 5, ACTIVE_SEASON);

  assert.equal(migrated.temporaryUninterestedThroughSeason.leader, ACTIVE_SEASON + 1);
});

test("an outgoing captain aged 33 or older becomes permanently uninterested", () => {
  const changed = confirmCaptainChange(
    leadership({ captainId: "veteran", viceCaptainId: "deputy" }),
    "candidate",
    squad,
    5,
    ACTIVE_SEASON,
  );
  const veteran = squad.find((candidate) => candidate.id === "veteran")!;

  assert.equal(changed.temporaryUninterestedThroughSeason.veteran, undefined);
  assert.deepEqual(changed.permanentlyUninterestedPlayerIds, ["veteran"]);
  assert.deepEqual(getCaptaincyInterestStatus(veteran, changed, ACTIVE_SEASON + 10), {
    interested: false,
    temporarilyUnavailable: false,
    permanentlyUnavailable: true,
    uninterestedThroughSeason: null,
  });
});

test("vice-captain selection cannot bypass captain change confirmation", () => {
  const current = leadership({ captainId: "leader", viceCaptainId: "deputy" });
  assert.deepEqual(appointViceCaptain(current, "leader", squad), current);
});
