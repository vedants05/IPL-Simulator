import assert from "node:assert/strict";
import test from "node:test";

import type { Player, Team } from "@/lib/types";
import { EMPTY_TEAM_LEADERSHIP } from "./captaincy";
import {
  buildCareerEmailDrafts,
  orderCareerEmailThread,
  reconcileCareerEmails,
  type CareerEmailContext,
  type CareerEmailFixture,
} from "./careerEmails";

const team = (id: string, squad: string[]): Team => ({
  id,
  name: id === "user" ? "London Lions" : "Mumbai Mariners",
  shortName: id === "user" ? "LON" : "MUM",
  homeGround: id === "user" ? "Lions Ground" : "Mariners Ground",
  squad,
} as Team);

const player = (id: string, currentTeamId: string): Player => ({
  id,
  name: id.replaceAll("-", " ").toUpperCase(),
  age: 29,
  nationality: "Indian",
  role: "All-Rounder",
  currentTeamId,
  currentBatting: 70,
  currentBowling: 68,
  captaincy: 75,
} as Player);

const lineupReady = {
  battingFirstValid: true,
  bowlingFirstValid: true,
  battingFirstCount: 11,
  bowlingFirstCount: 11,
  battingImpactCount: 5,
  bowlingImpactCount: 5,
  battingOverseasCount: 4,
  bowlingOverseasCount: 4,
  battingWicketkeepers: 1,
  bowlingWicketkeepers: 1,
  battingBowlingOptions: 5,
  bowlingBowlingOptions: 5,
};

const basePlayers = {
  captain: player("captain", "user"),
  deputy: player("deputy", "user"),
  batter: player("batter", "user"),
  bowler: player("bowler", "user"),
  threat: player("threat", "opponent"),
};

const baseContext = (updates: Partial<CareerEmailContext> = {}): CareerEmailContext => ({
  currentDate: "2027-02-20",
  season: 2027,
  fixtureAnnouncementDate: "2027-02-27",
  fixturesAnnounced: false,
  userTeamId: "user",
  userTeam: team("user", ["captain", "deputy", "batter", "bowler"]),
  teams: {
    user: team("user", ["captain", "deputy", "batter", "bowler"]),
    opponent: team("opponent", ["threat"]),
  },
  players: basePlayers,
  fixtures: [],
  standings: [
    { teamId: "user", teamName: "London Lions", shortName: "LON", played: 0, won: 0, lost: 0, noResults: 0, points: 0, nrr: 0 },
    { teamId: "opponent", teamName: "Mumbai Mariners", shortName: "MUM", played: 0, won: 0, lost: 0, noResults: 0, points: 0, nrr: 0 },
  ],
  playerStats: {},
  leadership: { ...EMPTY_TEAM_LEADERSHIP },
  captainChangeGamesRemaining: 0,
  lineup: lineupReady,
  tacticsPreset: "Balanced",
  ...updates,
});

const fixture = (number: number, played = false): CareerEmailFixture => ({
  id: `fixture-${number}`,
  matchNumber: number,
  round: number,
  teamA: number % 2 === 0 ? "opponent" : "user",
  teamB: number % 2 === 0 ? "user" : "opponent",
  played,
  date: `2027-03-${String(19 + number).padStart(2, "0")}`,
  time: "19:30",
  winner: played ? (number % 2 === 0 ? "opponent" : "user") : undefined,
  scoreA: played ? { runs: 170 + number, wickets: 6, overs: 20 } : undefined,
  scoreB: played ? { runs: 165 + number, wickets: 8, overs: 20 } : undefined,
  scorecard: played ? {
    inningsA: {
      batting: [{ id: "batter", name: "BATTER", runs: 60, balls: 42 }],
      bowling: [{ id: "bowler", name: "BOWLER", wickets: 2, runsConceded: 28 }],
    },
    inningsB: {
      batting: [{ id: "threat", name: "THREAT", runs: 45, balls: 35 }],
      bowling: [{ id: "threat", name: "THREAT", wickets: 1, runsConceded: 35 }],
    },
  } : undefined,
});

test("opening mail covers setup without excluded systems", () => {
  const drafts = buildCareerEmailDrafts(baseContext());
  const templateIds = drafts.map((email) => email.templateId);
  const excludedTerms = /auction|retention|sponsor|trade|contract|board|injur/i;

  assert.ok(templateIds.includes("career.welcome"));
  assert.ok(templateIds.includes("task.appoint-leadership"));
  assert.ok(templateIds.includes("task.prepare-lineups"));
  assert.ok(templateIds.includes("task.review-tactics"));
  assert.ok(templateIds.includes("squad.audit"));
  assert.equal(excludedTerms.test(JSON.stringify(drafts)), false);
});

test("reconciliation deduplicates drafts and preserves read state", () => {
  const drafts = buildCareerEmailDrafts(baseContext());
  const firstPass = reconcileCareerEmails([], drafts);
  const readInbox = firstPass.map((email, index) => index === 0 ? { ...email, unread: false } : email);
  const secondPass = reconcileCareerEmails(readInbox, drafts);

  assert.equal(secondPass, readInbox);
  assert.equal(secondPass.length, new Set(secondPass.map((email) => email.dedupeKey)).size);
  assert.equal(secondPass[0].unread, false);
});

test("same-day emails and legacy saves are ordered newest first", () => {
  const drafts = buildCareerEmailDrafts(baseContext());
  const legacyInbox = drafts
    .map(({ daySequence: _daySequence, ...email }) => email)
    .sort((left, right) => right.id.localeCompare(left.id));
  const reconciled = reconcileCareerEmails(legacyInbox, drafts);

  assert.equal(reconciled[0].templateId, "squad.audit");
  assert.equal(reconciled.at(-1)?.templateId, "career.welcome");
  assert.ok(reconciled.every((email, index) => (
    index === 0 || reconciled[index - 1].daySequence >= email.daySequence
  )));
});

test("match-eve selection reminders only appear when action is needed", () => {
  const nextFixture = fixture(1);
  const common = {
    currentDate: "2027-03-19",
    fixturesAnnounced: true,
    fixtures: [nextFixture],
    leadership: { ...EMPTY_TEAM_LEADERSHIP, captainId: "captain", viceCaptainId: "deputy" },
  };
  const invalidDrafts = buildCareerEmailDrafts(baseContext({
    ...common,
    lineup: { ...lineupReady, battingFirstValid: false, battingFirstCount: 10 },
  }));
  const readyDrafts = buildCareerEmailDrafts(baseContext({ ...common, lineup: lineupReady }));

  assert.ok(invalidDrafts.some((email) => email.templateId === "fixture.selection-reminder"));
  assert.equal(readyDrafts.some((email) => email.templateId === "fixture.selection-reminder"), false);
});

test("each completed fixture produces one combined match report", () => {
  const playedFixture = fixture(1, true);
  const drafts = buildCareerEmailDrafts(baseContext({
    currentDate: "2027-03-21",
    fixturesAnnounced: true,
    fixtures: [playedFixture, fixture(2)],
  }));
  const reports = drafts.filter((email) => email.templateId === "match.result-report");

  assert.equal(reports.length, 1);
  assert.equal(reports[0].threadId, `match-result:${playedFixture.id}`);
  assert.match(reports[0].body, /Leading performers:/);
  assert.match(reports[0].body, /League position:/);
});

test("only action prompts and their resolution emails share a thread", () => {
  const leadership = {
    ...EMPTY_TEAM_LEADERSHIP,
    captainId: "captain",
    viceCaptainId: "deputy",
  };
  const nextFixture = fixture(1);
  const seasonDrafts = buildCareerEmailDrafts(baseContext({
    currentDate: "2027-02-27",
    fixturesAnnounced: true,
    fixtures: [nextFixture],
    leadership,
  }));
  const leadershipPrompt = seasonDrafts.find((email) => email.templateId === "task.appoint-leadership");
  const leadershipResolution = seasonDrafts.find((email) => email.templateId === "captaincy.leadership-confirmed");
  const fixtureAnnouncement = seasonDrafts.find((email) => email.templateId === "fixture.announcement");
  const openingFixture = seasonDrafts.find((email) => email.templateId === "fixture.opener");

  assert.equal(leadershipPrompt?.threadId, leadershipResolution?.threadId);
  assert.notEqual(fixtureAnnouncement?.threadId, openingFixture?.threadId);

  const reminder = buildCareerEmailDrafts(baseContext({
    currentDate: "2027-03-20",
    fixturesAnnounced: true,
    fixtures: [nextFixture],
    leadership,
    lineup: { ...lineupReady, battingFirstValid: false },
  })).find((email) => email.templateId === "fixture.selection-reminder");
  const resolution = buildCareerEmailDrafts(baseContext({
    currentDate: "2027-03-20",
    fixturesAnnounced: true,
    fixtures: [nextFixture],
    leadership,
  })).find((email) => email.templateId === "fixture.matchday");

  assert.equal(reminder?.threadId, resolution?.threadId);
  assert.deepEqual(
    orderCareerEmailThread([resolution!, reminder!]).map((email) => email.templateId),
    ["fixture.selection-reminder", "fixture.matchday"],
  );
  assert.deepEqual(
    orderCareerEmailThread([leadershipResolution!, leadershipPrompt!]).map((email) => email.templateId),
    ["task.appoint-leadership", "captaincy.leadership-confirmed"],
  );
});

test("fixture announcement lists home and away opponents in schedule order", () => {
  const opponentTeam = (id: string, shortName: string): Team => ({
    ...team(id, []),
    name: `${shortName} Franchise`,
    shortName,
    homeGround: `${shortName} Ground`,
  });
  const scheduledFixture = (
    matchNumber: number,
    date: string,
    opponentId: string,
    home: boolean,
  ): CareerEmailFixture => ({
    id: `scheduled-${matchNumber}`,
    matchNumber,
    round: matchNumber,
    teamA: home ? "user" : opponentId,
    teamB: home ? opponentId : "user",
    played: false,
    date,
    time: "19:30",
  });
  const teams = {
    user: team("user", ["captain", "deputy", "batter", "bowler"]),
    rcb: opponentTeam("rcb", "RCB"),
    csk: opponentTeam("csk", "CSK"),
    gt: opponentTeam("gt", "GT"),
    mi: opponentTeam("mi", "MI"),
  };
  const fixtures = [
    scheduledFixture(4, "2027-03-24", "rcb", true),
    scheduledFixture(2, "2027-03-22", "gt", false),
    scheduledFixture(1, "2027-03-21", "csk", true),
    scheduledFixture(3, "2027-03-23", "mi", false),
  ];
  const announcement = buildCareerEmailDrafts(baseContext({
    currentDate: "2027-02-27",
    fixturesAnnounced: true,
    fixtures,
    teams,
  })).find((email) => email.templateId === "fixture.announcement");

  assert.match(announcement?.body ?? "", /Home: CSK,RCB/);
  assert.match(announcement?.body ?? "", /Away: GT,MI/);
  assert.doesNotMatch(announcement?.body ?? "", /Home fixtures: \d|Away fixtures: \d/);
});

test("stored fixture announcements refresh without becoming unread again", () => {
  const drafts = buildCareerEmailDrafts(baseContext({
    currentDate: "2027-02-27",
    fixturesAnnounced: true,
    fixtures: [fixture(1), fixture(2)],
  }));
  const announcement = drafts.find((email) => email.templateId === "fixture.announcement")!;
  const storedAnnouncement = {
    ...announcement,
    body: "Home fixtures: 1\nAway fixtures: 1",
    unread: false,
  };
  const refreshedAnnouncement = reconcileCareerEmails(
    [storedAnnouncement],
    drafts,
  ).find((email) => email.templateId === "fixture.announcement");

  assert.match(refreshedAnnouncement?.body ?? "", /Home: MUM/);
  assert.match(refreshedAnnouncement?.body ?? "", /Away: MUM/);
  assert.equal(refreshedAnnouncement?.unread, false);
});

test("leadership selection leaves the original prompt unchanged", () => {
  const originalDrafts = buildCareerEmailDrafts(baseContext());
  const originalInbox = reconcileCareerEmails([], originalDrafts);
  const originalPrompt = originalInbox.find((email) => email.templateId === "task.appoint-leadership");
  const leadership = {
    ...EMPTY_TEAM_LEADERSHIP,
    captainId: "captain",
    viceCaptainId: "deputy",
  };
  const selectedDrafts = buildCareerEmailDrafts(baseContext({ leadership }));
  const selectedInbox = reconcileCareerEmails(originalInbox, selectedDrafts);
  const unchangedPrompt = selectedInbox.find((email) => email.templateId === "task.appoint-leadership");
  const confirmation = selectedInbox.find((email) => email.templateId === "captaincy.leadership-confirmed");

  assert.deepEqual(unchangedPrompt, originalPrompt);
  assert.doesNotMatch(unchangedPrompt?.body ?? "", /CAPTAIN|DEPUTY/);
  assert.match(confirmation?.body ?? "", /CAPTAIN/);
  assert.match(confirmation?.body ?? "", /DEPUTY/);
});

test("league updates are consolidated into the latest three-match digest", () => {
  const fixtures = Array.from({ length: 14 }, (_, index) => fixture(index + 1, index < 7));
  const drafts = buildCareerEmailDrafts(baseContext({
    currentDate: "2027-04-10",
    fixturesAnnounced: true,
    fixtures,
    standings: [
      { teamId: "user", teamName: "London Lions", shortName: "LON", played: 7, won: 4, lost: 3, noResults: 0, points: 8, nrr: 0.25 },
      { teamId: "opponent", teamName: "Mumbai Mariners", shortName: "MUM", played: 7, won: 3, lost: 4, noResults: 0, points: 6, nrr: -0.2 },
    ],
  }));
  const digests = drafts.filter((email) => email.templateId === "league.digest");

  assert.equal(digests.length, 1);
  assert.equal(digests[0].dedupeKey, "league-digest:2027:6");
});

test("completed setup tasks update in place without becoming unread again", () => {
  const incompleteDrafts = buildCareerEmailDrafts(baseContext({
    lineup: { ...lineupReady, battingFirstValid: false },
  }));
  const initialInbox = reconcileCareerEmails([], incompleteDrafts).map((email) => (
    email.templateId === "task.prepare-lineups" ? { ...email, unread: false } : email
  ));
  const completedDrafts = buildCareerEmailDrafts(baseContext());
  const updatedInbox = reconcileCareerEmails(initialInbox, completedDrafts);
  const lineupTask = updatedInbox.find((email) => email.templateId === "task.prepare-lineups");

  assert.equal(lineupTask?.actionCompleted, true);
  assert.equal(lineupTask?.unread, false);
  assert.equal(updatedInbox.filter((email) => email.templateId === "task.prepare-lineups").length, 1);
});
