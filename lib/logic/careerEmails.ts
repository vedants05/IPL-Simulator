import type { Player, Team } from "@/lib/types";
import type { TeamLeadership } from "./captaincy";

export type CareerEmailCategory = "task" | "fixture" | "match" | "squad" | "captaincy" | "league" | "season";
export type CareerEmailPriority = "normal" | "important" | "urgent";

export interface CareerEmailAction {
  label: string;
  kind: "navigate" | "fixture" | "player";
  tab?: "home" | "squad" | "scouting" | "season" | "history";
  subtab?: string;
  entityId?: string;
}

export interface CareerEmail {
  id: string;
  templateId: string;
  dedupeKey: string;
  threadId: string;
  daySequence: number;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  category: CareerEmailCategory;
  priority: CareerEmailPriority;
  date: string;
  unread: boolean;
  requiresAction: boolean;
  actionCompleted: boolean;
  actions: CareerEmailAction[];
}

export interface CareerEmailScorecardEntry {
  id: string;
  name: string;
  runs?: number;
  balls?: number;
  wickets?: number;
  runsConceded?: number;
}

export interface CareerEmailFixture {
  id: string;
  matchNumber: number;
  round: number;
  teamA: string;
  teamB: string;
  played: boolean;
  date?: string;
  time?: string;
  winner?: string;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  scorecard?: {
    inningsA: { batting: CareerEmailScorecardEntry[]; bowling: CareerEmailScorecardEntry[] };
    inningsB: { batting: CareerEmailScorecardEntry[]; bowling: CareerEmailScorecardEntry[] };
  };
}

export interface CareerEmailStanding {
  teamId: string;
  teamName: string;
  shortName: string;
  played: number;
  won: number;
  lost: number;
  noResults: number;
  points: number;
  nrr: number;
}

export interface CareerEmailPlayerStats {
  id: string;
  name: string;
  teamId: string;
  runs: number;
  wickets: number;
}

export interface CareerEmailLineupStatus {
  battingFirstValid: boolean;
  bowlingFirstValid: boolean;
  battingFirstCount: number;
  bowlingFirstCount: number;
  battingImpactCount: number;
  bowlingImpactCount: number;
  battingOverseasCount: number;
  bowlingOverseasCount: number;
  battingWicketkeepers: number;
  bowlingWicketkeepers: number;
  battingBowlingOptions: number;
  bowlingBowlingOptions: number;
}

export interface CareerEmailContext {
  currentDate: string;
  season: number;
  fixtureAnnouncementDate: string;
  fixturesAnnounced: boolean;
  userTeamId: string;
  userTeam: Team;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  fixtures: CareerEmailFixture[];
  standings: CareerEmailStanding[];
  playerStats: Record<string, CareerEmailPlayerStats>;
  leadership: TeamLeadership;
  captainChangeGamesRemaining: number;
  lineup: CareerEmailLineupStatus;
  tacticsPreset: string;
}

type DraftInput = Omit<CareerEmail, "id" | "unread" | "daySequence">;

const navigation = (
  label: string,
  tab: CareerEmailAction["tab"],
  subtab: string,
): CareerEmailAction => ({ label, kind: "navigate", tab, subtab });

const fixtureAction = (label: string, fixtureId: string): CareerEmailAction => ({
  label,
  kind: "fixture",
  tab: "season",
  subtab: "fixtures",
  entityId: fixtureId,
});

const playerAction = (label: string, playerId: string): CareerEmailAction => ({
  label,
  kind: "player",
  entityId: playerId,
});

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

const draft = (input: DraftInput, daySequence: number): CareerEmail => ({
  ...input,
  id: `mail_${safeId(input.dedupeKey)}`,
  daySequence,
  unread: true,
});

const formatDate = (date: string | undefined) => {
  if (!date) return "Date TBC";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const daysBetween = (from: string, to: string) => {
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return Number.POSITIVE_INFINITY;
  return Math.round((toTime - fromTime) / 86_400_000);
};

const getOpponentId = (fixture: CareerEmailFixture, userTeamId: string) => (
  fixture.teamA === userTeamId ? fixture.teamB : fixture.teamA
);

const getVenue = (fixture: CareerEmailFixture, teams: Record<string, Team>) => (
  teams[fixture.teamA]?.homeGround ?? "Venue TBC"
);

const sortFixtures = (fixtures: CareerEmailFixture[]) => [...fixtures].sort((left, right) => (
  (left.date ?? "").localeCompare(right.date ?? "")
  || (left.time ?? "").localeCompare(right.time ?? "")
  || left.matchNumber - right.matchNumber
));

const ordinal = (position: number) => {
  const remainder100 = position % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${position}th`;
  if (position % 10 === 1) return `${position}st`;
  if (position % 10 === 2) return `${position}nd`;
  if (position % 10 === 3) return `${position}rd`;
  return `${position}th`;
};

const lineupProblems = (lineup: CareerEmailLineupStatus) => {
  const problems: string[] = [];
  if (lineup.battingFirstCount !== 11) problems.push(`Bat-first XI has ${lineup.battingFirstCount}/11 players`);
  if (lineup.bowlingFirstCount !== 11) problems.push(`Bowl-first XI has ${lineup.bowlingFirstCount}/11 players`);
  if (lineup.battingImpactCount !== 5) problems.push(`Bat-first plan has ${lineup.battingImpactCount}/5 impact substitutes`);
  if (lineup.bowlingImpactCount !== 5) problems.push(`Bowl-first plan has ${lineup.bowlingImpactCount}/5 impact substitutes`);
  if (lineup.battingOverseasCount > 4) problems.push(`Bat-first XI has ${lineup.battingOverseasCount} overseas players`);
  if (lineup.bowlingOverseasCount > 4) problems.push(`Bowl-first XI has ${lineup.bowlingOverseasCount} overseas players`);
  if (lineup.battingWicketkeepers < 1) problems.push("Bat-first XI has no wicketkeeper");
  if (lineup.bowlingWicketkeepers < 1) problems.push("Bowl-first XI has no wicketkeeper");
  if (lineup.battingBowlingOptions < 5) problems.push(`Bat-first XI has only ${lineup.battingBowlingOptions} bowling options`);
  if (lineup.bowlingBowlingOptions < 5) problems.push(`Bowl-first XI has only ${lineup.bowlingBowlingOptions} bowling options`);
  return problems;
};

const getTeamForm = (teamId: string, fixtures: CareerEmailFixture[]) => sortFixtures(fixtures)
  .filter((fixture) => fixture.played && (fixture.teamA === teamId || fixture.teamB === teamId))
  .slice(-5)
  .map((fixture) => fixture.winner === teamId ? "W" : "L")
  .join(" ") || "No completed matches";

const scoreLabel = (fixture: CareerEmailFixture, teamId: string) => {
  const score = fixture.teamA === teamId ? fixture.scoreA : fixture.scoreB;
  return score ? `${score.runs}/${score.wickets}` : "Score unavailable";
};

const bestMatchPerformers = (
  fixture: CareerEmailFixture,
  userTeamId: string,
  players: Record<string, Player>,
) => {
  const entries = fixture.scorecard
    ? [
        ...fixture.scorecard.inningsA.batting,
        ...fixture.scorecard.inningsA.bowling,
        ...fixture.scorecard.inningsB.batting,
        ...fixture.scorecard.inningsB.bowling,
      ].filter((entry) => players[entry.id]?.currentTeamId === userTeamId)
    : [];
  const batter = [...entries].sort((left, right) => (right.runs ?? 0) - (left.runs ?? 0))[0];
  const bowler = [...entries].sort((left, right) => (
    (right.wickets ?? 0) - (left.wickets ?? 0)
    || (left.runsConceded ?? 999) - (right.runsConceded ?? 999)
  ))[0];
  return { batter, bowler };
};

const selectionReady = (context: CareerEmailContext) => (
  context.lineup.battingFirstValid && context.lineup.bowlingFirstValid
);

const leadershipReady = (context: CareerEmailContext) => Boolean(
  context.leadership.captainId && context.leadership.viceCaptainId
);

export function buildCareerEmailDrafts(context: CareerEmailContext): CareerEmail[] {
  const messages: CareerEmail[] = [];
  const push = (input: DraftInput) => messages.push(draft(input, messages.length));
  const userFixtures = sortFixtures(context.fixtures.filter((fixture) => (
    fixture.teamA === context.userTeamId || fixture.teamB === context.userTeamId
  )));
  const playedUserFixtures = userFixtures.filter((fixture) => fixture.played);
  const nextFixture = userFixtures.find((fixture) => !fixture.played);
  const userStandingIndex = context.standings.findIndex((standing) => standing.teamId === context.userTeamId);
  const userStanding = userStandingIndex >= 0 ? context.standings[userStandingIndex] : null;
  const captain = context.leadership.captainId ? context.players[context.leadership.captainId] : null;
  const viceCaptain = context.leadership.viceCaptainId ? context.players[context.leadership.viceCaptainId] : null;
  const openingPhase = playedUserFixtures.length === 0;
  const lineupReady = selectionReady(context);
  const leadershipComplete = leadershipReady(context);

  if (openingPhase) {
    push({
      templateId: "career.welcome",
      dedupeKey: `welcome:${context.season}`,
      threadId: `welcome:${context.season}`,
      sender: "Club Executive Office",
      subject: `Welcome to ${context.userTeam.name}`,
      preview: "Your first responsibilities as team manager.",
      body: `Welcome to ${context.userTeam.name}. You are now in charge ahead of the ${context.season} IPL season.\n\nYour immediate priorities are to appoint the leadership group, review both Playing XI plans, name the impact substitutes and define the team's tactical approach.\n\nThe league schedule will be released by the IPL League Office on ${formatDate(context.fixtureAnnouncementDate)}.`,
      category: "season",
      priority: "important",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("Open squad hub", "squad", "overview")],
    });

    push({
      templateId: "task.appoint-leadership",
      dedupeKey: `appoint-leadership:${context.season}`,
      threadId: `task:leadership:${context.season}`,
      sender: "Director of Cricket",
      subject: "Action required: appoint your leadership group",
      preview: "The squad needs a captain and vice-captain.",
      body: "The squad needs a captain and vice-captain before the season begins.\n\nReview each player's captaincy rating and interest in IPL leadership before making the appointments. Once both selections are confirmed, a separate email will record the new leadership group.",
      category: "task",
      priority: "urgent",
      date: context.currentDate,
      requiresAction: true,
      actionCompleted: false,
      actions: [navigation("Open captaincy", "squad", "captaincy")],
    });

    push({
      templateId: "task.prepare-lineups",
      dedupeKey: `prepare-lineups:${context.season}`,
      threadId: `prepare-lineups:${context.season}`,
      sender: "Head Coach",
      subject: "Action required: review both Playing XI plans",
      preview: lineupReady ? "Both match plans are valid." : "One or both match plans need attention.",
      body: `Prepare separate match plans for batting first and bowling first.\n\nBat-first XI: ${context.lineup.battingFirstCount}/11\nBat-first impact substitutes: ${context.lineup.battingImpactCount}/5\nBowl-first XI: ${context.lineup.bowlingFirstCount}/11\nBowl-first impact substitutes: ${context.lineup.bowlingImpactCount}/5\n\nEach XI needs a wicketkeeper, at least five bowling options and no more than four overseas players.`,
      category: "task",
      priority: lineupReady ? "normal" : "urgent",
      date: context.currentDate,
      requiresAction: true,
      actionCompleted: lineupReady,
      actions: [navigation("Open Playing XIs", "squad", "playingxi")],
    });

    push({
      templateId: "task.review-tactics",
      dedupeKey: `review-tactics:${context.season}`,
      threadId: `review-tactics:${context.season}`,
      sender: "Assistant Coach",
      subject: `Set the tactical blueprint for ${context.season}`,
      preview: `Current approach: ${context.tacticsPreset}.`,
      body: `The coaching group needs direction on batting tempo, bowling plans, field settings, toss preference and impact-player policy.\n\nCurrent approach: ${context.tacticsPreset}\n\nYou can also assign specialist roles such as anchor, finisher, new-ball bowler and death bowler.`,
      category: "task",
      priority: "normal",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("Open team tactics", "squad", "tactics")],
    });

    const squadPlayers = context.userTeam.squad.map((id) => context.players[id]).filter((player): player is Player => Boolean(player));
    const roleCount = (roles: Player["role"][]) => squadPlayers.filter((player) => roles.includes(player.role)).length;
    push({
      templateId: "squad.audit",
      dedupeKey: `squad-audit:${context.season}`,
      threadId: `squad-audit:${context.season}`,
      sender: "Director of Cricket",
      subject: "Squad audit: strengths, risks and depth",
      preview: `${squadPlayers.length} squad players reviewed.`,
      body: `The squad contains ${squadPlayers.length} players.\n\nOverseas players: ${squadPlayers.filter((player) => player.nationality === "Overseas").length}/8\nWicketkeepers: ${roleCount(["WK-Batsman"])}\nBatters: ${roleCount(["Batsman", "WK-Batsman"])}\nAll-rounders: ${roleCount(["All-Rounder"])}\nPace bowlers: ${roleCount(["Pace Bowler"])}\nSpin bowlers: ${roleCount(["Spin Bowler"])}\n\nReview the roster before the season begins and identify any areas where depth may be limited.`,
      category: "squad",
      priority: "normal",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("Open roster overview", "squad", "roster")],
    });

    if (leadershipComplete && lineupReady) {
      push({
        templateId: "task.preseason-complete",
        dedupeKey: `preseason-complete:${context.season}`,
        threadId: `preseason-complete:${context.season}`,
        sender: "Cricket Operations",
        subject: "Pre-season preparations complete",
        preview: "The squad is ready for the season.",
        body: `The required matchday preparations have been completed.\n\n✓ Captain appointed\n✓ Vice-captain appointed\n✓ Both Playing XIs valid\n✓ Impact substitutes named\n✓ Tactical approach available\n\n${context.userTeam.shortName} are ready for the ${context.season} season.`,
        category: "season",
        priority: "normal",
        date: context.currentDate,
        requiresAction: false,
        actionCompleted: false,
        actions: [navigation("Return home", "home", "overview")],
      });
    }
  }

  if (context.fixturesAnnounced && userFixtures.length > 0) {
    const opener = userFixtures[0];
    const opponentId = getOpponentId(opener, context.userTeamId);
    const opponent = context.teams[opponentId];
    push({
      templateId: "fixture.announcement",
      dedupeKey: `fixtures-announced:${context.season}`,
      threadId: `fixtures-announced:${context.season}`,
      sender: "IPL League Office",
      subject: `${context.season} IPL fixtures released`,
      preview: `Opening fixture: ${opponent?.shortName ?? opponentId} on ${formatDate(opener.date)}.`,
      body: `The league schedule for the ${context.season} IPL season has been confirmed.\n\nYour opening fixture is against ${opponent?.name ?? opponentId} on ${formatDate(opener.date)} at ${getVenue(opener, context.teams)}.\n\nHome fixtures: ${userFixtures.filter((fixture) => fixture.teamA === context.userTeamId).length}\nAway fixtures: ${userFixtures.filter((fixture) => fixture.teamB === context.userTeamId).length}\n\nThe complete schedule is now available in the Season section.`,
      category: "fixture",
      priority: "important",
      date: context.fixtureAnnouncementDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("View fixtures", "season", "fixtures"), navigation("Open calendar", "home", "calendar")],
    });

    push({
      templateId: "fixture.opener",
      dedupeKey: `opening-fixture:${context.season}`,
      threadId: `opening-fixture:${context.season}`,
      sender: "Head Coach",
      subject: `Opening match: ${context.userTeam.shortName} v ${opponent?.shortName ?? opponentId}`,
      preview: `${formatDate(opener.date)} at ${getVenue(opener, context.teams)}.`,
      body: `Our season begins against ${opponent?.name ?? opponentId} at ${getVenue(opener, context.teams)} on ${formatDate(opener.date)}.\n\nReview the opposition, confirm both match plans and make sure the leadership group is settled before matchday.`,
      category: "fixture",
      priority: "important",
      date: context.fixtureAnnouncementDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [fixtureAction("View opening fixture", opener.id), navigation("Review Playing XIs", "squad", "playingxi")],
    });
  }

  if (context.fixturesAnnounced && nextFixture?.date) {
    const opponentId = getOpponentId(nextFixture, context.userTeamId);
    const opponent = context.teams[opponentId];
    const opponentSquad = opponent?.squad.map((id) => context.players[id]).filter((player): player is Player => Boolean(player)) ?? [];
    const likelyCaptain = [...opponentSquad]
      .filter((player) => !player.isIplCaptaincyUnavailable)
      .sort((left, right) => (right.captaincy ?? 0) - (left.captaincy ?? 0))[0];
    const threats = [...opponentSquad]
      .sort((left, right) => Math.max(right.currentBatting, right.currentBowling) - Math.max(left.currentBatting, left.currentBowling))
      .slice(0, 3);
    const opponentStandingIndex = context.standings.findIndex((standing) => standing.teamId === opponentId);
    const daysUntil = daysBetween(context.currentDate, nextFixture.date);
    const problems = lineupProblems(context.lineup);

    if (daysUntil >= 0 && daysUntil <= 3) {
      push({
        templateId: "fixture.next-briefing",
        dedupeKey: `next-fixture-briefing:${nextFixture.id}`,
        threadId: `next-fixture-briefing:${nextFixture.id}`,
        sender: "Performance Analyst",
        subject: `Next fixture: ${context.userTeam.shortName} v ${opponent?.shortName ?? opponentId}`,
        preview: `${formatDate(nextFixture.date)} · ${getVenue(nextFixture, context.teams)}.`,
        body: `Date: ${formatDate(nextFixture.date)}\nVenue: ${getVenue(nextFixture, context.teams)}\nOpponent position: ${opponentStandingIndex >= 0 ? ordinal(opponentStandingIndex + 1) : "Pre-season"}\nOpponent form: ${getTeamForm(opponentId, context.fixtures)}\nOur position: ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "Pre-season"}\n\nKey opposition threats:\n${threats.length > 0 ? threats.map((player) => `• ${player.name}`).join("\n") : "• Opposition data unavailable"}\n\nLikely opposition captain: ${likelyCaptain?.name ?? "Not confirmed"}\n\nSelection status:\nBat-first plan: ${context.lineup.battingFirstValid ? "Ready" : "Needs attention"}\nBowl-first plan: ${context.lineup.bowlingFirstValid ? "Ready" : "Needs attention"}\n\nRecommended focus: review the opposition's strongest ${(threats[0]?.currentBatting ?? 0) >= (threats[0]?.currentBowling ?? 0) ? "batting matchups" : "bowling threats"}.`,
        category: "fixture",
        priority: "important",
        date: context.currentDate,
        requiresAction: false,
        actionCompleted: false,
        actions: [fixtureAction("View fixture", nextFixture.id), navigation("Open Playing XIs", "squad", "playingxi"), navigation("Open tactics", "squad", "tactics")],
      });
    }

    if (daysUntil >= 0 && daysUntil <= 1 && (!lineupReady || !leadershipComplete)) {
      const warnings = [
        ...(!leadershipComplete ? ["Captain or vice-captain has not been appointed"] : []),
        ...problems,
      ];
      push({
        templateId: "fixture.selection-reminder",
        dedupeKey: `selection-reminder:${nextFixture.id}`,
        threadId: `task:selection:${nextFixture.id}`,
        sender: "Team Manager",
        subject: `Action required before ${opponent?.shortName ?? opponentId}`,
        preview: `${warnings.length} selection issue${warnings.length === 1 ? "" : "s"} require attention.`,
        body: `The fixture against ${opponent?.name ?? opponentId} is ${daysUntil === 0 ? "today" : "tomorrow"}.\n\nOutstanding issues:\n${warnings.map((warning) => `• ${warning}`).join("\n")}\n\nComplete the outstanding work before matchday.`,
        category: "task",
        priority: "urgent",
        date: context.currentDate,
        requiresAction: true,
        actionCompleted: lineupReady && leadershipComplete,
        actions: [navigation("Resolve selection", "squad", "playingxi"), navigation("Review captaincy", "squad", "captaincy")],
      });
    }

    if (daysUntil === 0 && lineupReady && leadershipComplete) {
      push({
        templateId: "fixture.matchday",
        dedupeKey: `matchday:${nextFixture.id}`,
        threadId: `task:selection:${nextFixture.id}`,
        sender: "Head Coach",
        subject: `Matchday: ${context.userTeam.shortName} v ${opponent?.shortName ?? opponentId}`,
        preview: `${captain?.name ?? "Captain TBC"} leads the side at ${getVenue(nextFixture, context.teams)}.`,
        body: `We face ${opponent?.name ?? opponentId} today at ${getVenue(nextFixture, context.teams)}.\n\nCaptain: ${captain?.name ?? "Not appointed"}\nVice-captain: ${viceCaptain?.name ?? "Not appointed"}\nBat-first plan: Ready\nBowl-first plan: Ready\nTactical approach: ${context.tacticsPreset}`,
        category: "match",
        priority: "important",
        date: context.currentDate,
        requiresAction: false,
        actionCompleted: false,
        actions: [fixtureAction("View match", nextFixture.id), navigation("Review match plans", "squad", "playingxi")],
      });
    }

    const previousFixture = [...playedUserFixtures].reverse().find((fixture) => fixture.date && fixture.date <= nextFixture.date!);
    if (previousFixture?.date) {
      const turnaround = daysBetween(previousFixture.date, nextFixture.date);
      if (turnaround <= 2 && turnaround >= 0) {
        push({
          templateId: "fixture.short-turnaround",
          dedupeKey: `short-turnaround:${nextFixture.id}`,
          threadId: `short-turnaround:${nextFixture.id}`,
          sender: "Head of Performance",
          subject: `Short turnaround before ${opponent?.shortName ?? opponentId}`,
          preview: `${turnaround} day${turnaround === 1 ? "" : "s"} between fixtures.`,
          body: `There are only ${turnaround} day${turnaround === 1 ? "" : "s"} between fixtures.\n\nReview the balance of the XI and consider whether changes are needed for ${getVenue(nextFixture, context.teams)}.`,
          category: "fixture",
          priority: "important",
          date: previousFixture.date,
          requiresAction: false,
          actionCompleted: false,
          actions: [navigation("Review squad", "squad", "roster"), navigation("Open Playing XIs", "squad", "playingxi")],
        });
      } else if (turnaround >= 8 && daysUntil <= 8 && daysUntil >= 0) {
        push({
          templateId: "fixture.rest-period",
          dedupeKey: `rest-period:${nextFixture.id}`,
          threadId: `rest-period:${nextFixture.id}`,
          sender: "Head Coach",
          subject: "Upcoming break in the schedule",
          preview: `${turnaround} days between fixtures.`,
          body: `There are ${turnaround} days between our previous match and the fixture against ${opponent?.name ?? opponentId}.\n\nUse the break to review recent performances, reconsider tactical roles and prepare the opposition plan.`,
          category: "fixture",
          priority: "normal",
          date: context.currentDate,
          requiresAction: false,
          actionCompleted: false,
          actions: [navigation("View player stats", "season", "stats"), navigation("Open tactics", "squad", "tactics")],
        });
      }
    }
  }

  playedUserFixtures.forEach((fixture) => {
    const opponentId = getOpponentId(fixture, context.userTeamId);
    const opponent = context.teams[opponentId];
    const won = fixture.winner === context.userTeamId;
    const { batter, bowler } = bestMatchPerformers(fixture, context.userTeamId, context.players);
    const nextAfter = userFixtures.find((candidate) => !candidate.played && (candidate.date ?? "") >= (fixture.date ?? ""));
    const userScore = fixture.teamA === context.userTeamId ? fixture.scoreA?.runs ?? 0 : fixture.scoreB?.runs ?? 0;
    const opponentScore = fixture.teamA === opponentId ? fixture.scoreA?.runs ?? 0 : fixture.scoreB?.runs ?? 0;
    const margin = Math.abs(userScore - opponentScore);
    const performanceNote = won
      ? margin >= 35 ? "This was a commanding result and a strong reflection of the match plan." : "The side handled the decisive moments well."
      : margin >= 35 ? "The margin exposed areas that require attention before the next fixture." : "The match was competitive, but the decisive moments went against us.";

    push({
      templateId: "match.result-report",
      dedupeKey: `match-result:${fixture.id}`,
      threadId: `match-result:${fixture.id}`,
      sender: "Match Analyst",
      subject: `Result: ${context.userTeam.shortName} ${won ? "defeated" : "lost to"} ${opponent?.shortName ?? opponentId}`,
      preview: `${scoreLabel(fixture, context.userTeamId)} · ${scoreLabel(fixture, opponentId)}.`,
      body: `${context.userTeam.name}: ${scoreLabel(fixture, context.userTeamId)}\n${opponent?.name ?? opponentId}: ${scoreLabel(fixture, opponentId)}\n\n${context.teams[fixture.winner ?? ""]?.name ?? "The opposition"} won the match. ${performanceNote}\n\nLeading performers:\n• ${batter?.name ?? "No batting data"}${batter ? `: ${batter.runs ?? 0} runs from ${batter.balls ?? 0} balls` : ""}\n• ${bowler?.name ?? "No bowling data"}${bowler ? `: ${bowler.wickets ?? 0}/${bowler.runsConceded ?? 0}` : ""}\n\nLeague position: ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "Unavailable"}\nPoints: ${userStanding?.points ?? 0}\nNet run rate: ${(userStanding?.nrr ?? 0) >= 0 ? "+" : ""}${(userStanding?.nrr ?? 0).toFixed(3)}\n\nNext fixture: ${nextAfter ? `${context.teams[getOpponentId(nextAfter, context.userTeamId)]?.name ?? getOpponentId(nextAfter, context.userTeamId)}, ${formatDate(nextAfter.date)}` : "No remaining league fixtures"}.`,
      category: "match",
      priority: "important",
      date: fixture.date ?? context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [fixtureAction("View scorecard", fixture.id), navigation("View standings", "season", "standings"), ...(nextAfter ? [fixtureAction("View next fixture", nextAfter.id)] : [])],
    });
  });

  if (leadershipComplete) {
    push({
      templateId: "captaincy.leadership-confirmed",
      dedupeKey: `leadership-confirmed:${context.season}`,
      threadId: `task:leadership:${context.season}`,
      sender: "Director of Cricket",
      subject: "Leadership group confirmed",
      preview: `${captain?.name} will be supported by ${viceCaptain?.name}.`,
      body: `${captain?.name} has been appointed captain, with ${viceCaptain?.name} serving as vice-captain.\n\nCaptaincy ratings:\n${captain?.name}: ${captain?.captaincy ?? 50}\n${viceCaptain?.name}: ${viceCaptain?.captaincy ?? 50}`,
      category: "captaincy",
      priority: "normal",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("View captaincy", "squad", "captaincy")],
    });
  }

  if (context.leadership.captainChangeLockedUntilGamesPlayed && captain) {
    const lockKey = context.leadership.captainChangeLockedUntilGamesPlayed;
    if (context.captainChangeGamesRemaining > 0) {
      push({
        templateId: "captaincy.change-confirmed",
        dedupeKey: `captain-change:${captain.id}:${lockKey}`,
        threadId: `captain-change:${captain.id}:${lockKey}`,
        sender: "Director of Cricket",
        subject: "Captaincy change recorded",
        preview: `${captain.name} is now captain.`,
        body: `${captain.name} has been appointed captain of ${context.userTeam.name}.\n\nFurther captain changes are locked for the next ${context.captainChangeGamesRemaining} team match${context.captainChangeGamesRemaining === 1 ? "" : "es"}. The vice-captain is ${viceCaptain?.name ?? "not currently appointed"}.`,
        category: "captaincy",
        priority: "important",
        date: context.currentDate,
        requiresAction: false,
        actionCompleted: false,
        actions: [navigation("View captaincy", "squad", "captaincy")],
      });
    } else {
      push({
        templateId: "captaincy.lock-expired",
        dedupeKey: `captain-lock-expired:${lockKey}`,
        threadId: `captain-lock-expired:${lockKey}`,
        sender: "Cricket Operations",
        subject: "Captaincy review window reopened",
        preview: "The restriction on further captain changes has expired.",
        body: `Three team matches have passed since the appointment of ${captain.name}.\n\nThe restriction on further captain changes has expired. Any future replacement will still require confirmation.`,
        category: "captaincy",
        priority: "normal",
        date: context.currentDate,
        requiresAction: false,
        actionCompleted: false,
        actions: [navigation("Open captaincy", "squad", "captaincy")],
      });
    }
  }

  Object.entries(context.leadership.temporaryUninterestedThroughSeason).forEach(([playerId, throughSeason]) => {
    const player = context.players[playerId];
    if (!player) return;
    if (context.season <= throughSeason) {
      push({
        templateId: "captaincy.temporary-interest",
        dedupeKey: `captain-interest-temporary:${playerId}:${throughSeason}`,
        threadId: `captain-interest-temporary:${playerId}:${throughSeason}`,
        sender: "Player Liaison Officer",
        subject: `${player.name} steps back from leadership consideration`,
        preview: `${player.name} is not interested in captaincy for now.`,
        body: `Following the captaincy change, ${player.name} has indicated that they are not interested in IPL captaincy for now.\n\nThe player remains fully available for normal selection and will continue to contribute as a member of the squad.`,
        category: "captaincy",
        priority: "normal",
        date: context.currentDate,
        requiresAction: false,
        actionCompleted: false,
        actions: [playerAction("View player", playerId)],
      });
    } else {
      push({
        templateId: "captaincy.interest-restored",
        dedupeKey: `captain-interest-restored:${playerId}:${throughSeason + 1}`,
        threadId: `captain-interest-restored:${playerId}:${throughSeason + 1}`,
        sender: "Player Liaison Officer",
        subject: `${player.name} is open to leadership again`,
        preview: "The player's captaincy interest has changed.",
        body: `${player.name} has indicated that they are once again willing to be considered for IPL captaincy.\n\nTheir status has been updated on the Captaincy page.`,
        category: "captaincy",
        priority: "normal",
        date: context.currentDate,
        requiresAction: false,
        actionCompleted: false,
        actions: [navigation("Open captaincy", "squad", "captaincy")],
      });
    }
  });

  context.leadership.permanentlyUninterestedPlayerIds.forEach((playerId) => {
    const player = context.players[playerId];
    if (!player) return;
    push({
      templateId: "captaincy.permanent-interest",
      dedupeKey: `captain-interest-permanent:${playerId}`,
      threadId: `captain-interest-permanent:${playerId}`,
      sender: "Player Liaison Officer",
      subject: `${player.name} closes the door on future captaincy`,
      preview: "The player is no longer interested in IPL captaincy.",
      body: `Following the leadership change, ${player.name} has informed the club that they are no longer interested in holding IPL captaincy.\n\nThis decision is permanent, although the player remains available for normal selection.`,
      category: "captaincy",
      priority: "important",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [playerAction("View player", playerId)],
    });
  });

  const gamesPlayed = playedUserFixtures.length;
  const digestMilestone = Math.min(12, Math.floor(gamesPlayed / 3) * 3);
  if (digestMilestone >= 3) {
    const orangeLeader = Object.values(context.playerStats).sort((left, right) => right.runs - left.runs)[0];
    const purpleLeader = Object.values(context.playerStats).sort((left, right) => right.wickets - left.wickets)[0];
    const tableLeader = context.standings[0];
    push({
      templateId: "league.digest",
      dedupeKey: `league-digest:${context.season}:${digestMilestone}`,
      threadId: `league-digest:${context.season}:${digestMilestone}`,
      sender: "IPL Media Office",
      subject: `IPL league digest after ${digestMilestone} matches`,
      preview: `${tableLeader?.shortName ?? "The league leader"} top the table.`,
      body: `League leader: ${tableLeader?.teamName ?? "Unavailable"}\n${context.userTeam.shortName} position: ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "Unavailable"}\n\nOrange Cap leader: ${orangeLeader ? `${orangeLeader.name} (${orangeLeader.runs} runs)` : "No leader yet"}\nPurple Cap leader: ${purpleLeader ? `${purpleLeader.name} (${purpleLeader.wickets} wickets)` : "No leader yet"}\n\nYour recent form: ${getTeamForm(context.userTeamId, context.fixtures)}.`,
      category: "league",
      priority: "normal",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("View standings", "season", "standings"), navigation("View tournament stats", "season", "stats")],
    });
  }

  if (gamesPlayed >= 5) {
    push({
      templateId: "season.five-match-review",
      dedupeKey: `five-match-review:${context.season}`,
      threadId: `five-match-review:${context.season}`,
      sender: "Performance Analyst",
      subject: "Performance review after five matches",
      preview: `${userStanding?.won ?? 0} wins, ${userStanding?.lost ?? 0} losses.`,
      body: `Matches played: ${gamesPlayed}\nRecord: ${userStanding?.won ?? 0} wins, ${userStanding?.lost ?? 0} losses\nPosition: ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "Unavailable"}\nNet run rate: ${(userStanding?.nrr ?? 0) >= 0 ? "+" : ""}${(userStanding?.nrr ?? 0).toFixed(3)}\n\nReview the tournament statistics and both match plans before the next phase of the season.`,
      category: "season",
      priority: "normal",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("View stats", "season", "stats"), navigation("Review squad", "squad", "overview")],
    });
  }

  if (gamesPlayed >= 7) {
    const userStats = Object.values(context.playerStats).filter((stats) => stats.teamId === context.userTeamId);
    const bestBatter = [...userStats].sort((left, right) => right.runs - left.runs)[0];
    const bestBowler = [...userStats].sort((left, right) => right.wickets - left.wickets)[0];
    push({
      templateId: "season.halfway-review",
      dedupeKey: `halfway-review:${context.season}`,
      threadId: `halfway-review:${context.season}`,
      sender: "Performance Analyst",
      subject: "Mid-season report",
      preview: `${context.userTeam.shortName} are ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "unranked"}.`,
      body: `Matches: ${gamesPlayed}\nRecord: ${userStanding?.won ?? 0} wins, ${userStanding?.lost ?? 0} losses\nPosition: ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "Unavailable"}\n\nLeading run-scorer: ${bestBatter ? `${bestBatter.name} (${bestBatter.runs})` : "Unavailable"}\nLeading wicket-taker: ${bestBowler ? `${bestBowler.name} (${bestBowler.wickets})` : "Unavailable"}\n\nThe second half of the league stage is an opportunity to reinforce successful combinations and correct recurring weaknesses.`,
      category: "season",
      priority: "important",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("View stats", "season", "stats"), navigation("Review Playing XIs", "squad", "playingxi")],
    });
  }

  if (gamesPlayed >= 10 && gamesPlayed < userFixtures.length) {
    const matchesRemaining = userFixtures.length - gamesPlayed;
    const likelyRequiredWins = Math.max(0, Math.ceil(((context.standings[3]?.points ?? 16) + 1 - (userStanding?.points ?? 0)) / 2));
    push({
      templateId: "season.qualification-scenarios",
      dedupeKey: `qualification-scenarios:${context.season}`,
      threadId: `qualification-scenarios:${context.season}`,
      sender: "Performance Analyst",
      subject: "League-stage qualification scenarios",
      preview: `${matchesRemaining} matches remain in the league stage.`,
      body: `With ${matchesRemaining} matches remaining, ${context.userTeam.name} are ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "currently unranked"} on ${userStanding?.points ?? 0} points.\n\nApproximately ${Math.min(matchesRemaining, likelyRequiredWins)} further win${likelyRequiredWins === 1 ? "" : "s"} may be required to finish in the top four. Net run rate could become decisive.`,
      category: "season",
      priority: "important",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("View standings", "season", "standings"), navigation("View fixtures", "season", "fixtures")],
    });
  }

  if (userFixtures.length > 0 && gamesPlayed === userFixtures.length) {
    const topFour = userStandingIndex >= 0 && userStandingIndex < 4;
    push({
      templateId: topFour ? "season.top-four" : "season.eliminated",
      dedupeKey: `league-stage-outcome:${context.season}`,
      threadId: `league-stage-outcome:${context.season}`,
      sender: "Cricket Operations",
      subject: topFour ? `${context.userTeam.name} secure a top-four finish` : "League campaign complete",
      preview: `Final league position: ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "Unavailable"}.`,
      body: topFour
        ? `${context.userTeam.name} have completed the league stage in ${ordinal(userStandingIndex + 1)} place with ${userStanding?.points ?? 0} points.\n\nThe club has secured a top-four finish. Playoff scheduling will follow when the competition system is available.`
        : `${context.userTeam.name} have completed the league stage in ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "an unconfirmed position"} with ${userStanding?.points ?? 0} points.\n\nThe club will not finish in the top four this season.`,
      category: "season",
      priority: "important",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("View standings", "season", "standings")],
    });

    const userStats = Object.values(context.playerStats).filter((stats) => stats.teamId === context.userTeamId);
    const topBatter = [...userStats].sort((left, right) => right.runs - left.runs)[0];
    const topBowler = [...userStats].sort((left, right) => right.wickets - left.wickets)[0];
    push({
      templateId: "season.review",
      dedupeKey: `season-review:${context.season}`,
      threadId: `season-review:${context.season}`,
      sender: "Director of Cricket",
      subject: `${context.season} league-stage review`,
      preview: `${userStanding?.won ?? 0} wins from ${gamesPlayed} matches.`,
      body: `Final position: ${userStandingIndex >= 0 ? ordinal(userStandingIndex + 1) : "Unavailable"}\nRecord: ${userStanding?.won ?? 0} wins, ${userStanding?.lost ?? 0} losses\nLeading run-scorer: ${topBatter ? `${topBatter.name} (${topBatter.runs})` : "Unavailable"}\nLeading wicket-taker: ${topBowler ? `${topBowler.name} (${topBowler.wickets})` : "Unavailable"}\n\nReview the season statistics and squad history before planning the next campaign.`,
      category: "season",
      priority: "important",
      date: context.currentDate,
      requiresAction: false,
      actionCompleted: false,
      actions: [navigation("View season history", "history", "leaguehistory"), navigation("View stats", "season", "stats")],
    });
  }

  return messages;
}

const isCareerEmail = (value: unknown): value is CareerEmail => {
  if (!value || typeof value !== "object") return false;
  const email = value as Partial<CareerEmail>;
  return typeof email.id === "string"
    && typeof email.dedupeKey === "string"
    && typeof email.subject === "string"
    && typeof email.body === "string"
    && typeof email.date === "string";
};

const LEGACY_TEMPLATE_DAY_SEQUENCE: Record<string, number> = {
  "career.welcome": 0,
  "task.appoint-leadership": 10,
  "task.prepare-lineups": 20,
  "task.review-tactics": 30,
  "squad.audit": 40,
  "task.preseason-complete": 50,
  "captaincy.leadership-confirmed": 60,
  "fixture.announcement": 70,
  "fixture.opener": 80,
  "fixture.rest-period": 90,
  "fixture.short-turnaround": 90,
  "fixture.next-briefing": 100,
  "fixture.selection-reminder": 110,
  "fixture.matchday": 120,
  "match.result-report": 130,
  "captaincy.change-confirmed": 140,
  "captaincy.lock-expired": 150,
  "captaincy.temporary-interest": 160,
  "captaincy.permanent-interest": 160,
  "captaincy.interest-restored": 170,
  "league.digest": 180,
  "season.five-match-review": 190,
  "season.halfway-review": 200,
  "season.qualification-scenarios": 210,
  "season.top-four": 220,
  "season.eliminated": 220,
  "season.review": 230,
};

const normalizedThreadId = (email: Pick<CareerEmail, "dedupeKey">) => {
  if (email.dedupeKey.startsWith("appoint-leadership:")) {
    return `task:leadership:${email.dedupeKey.slice("appoint-leadership:".length)}`;
  }
  if (email.dedupeKey.startsWith("leadership-confirmed:")) {
    return `task:leadership:${email.dedupeKey.slice("leadership-confirmed:".length)}`;
  }
  if (email.dedupeKey.startsWith("selection-reminder:")) {
    return `task:selection:${email.dedupeKey.slice("selection-reminder:".length)}`;
  }
  if (email.dedupeKey.startsWith("matchday:")) {
    return `task:selection:${email.dedupeKey.slice("matchday:".length)}`;
  }
  return email.dedupeKey;
};

export function normalizeCareerEmails(value: unknown): CareerEmail[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCareerEmail).map((email, index) => ({
    ...email,
    templateId: email.templateId || "legacy",
    threadId: normalizedThreadId(email),
    daySequence: typeof email.daySequence === "number" && Number.isFinite(email.daySequence)
      ? email.daySequence
      : LEGACY_TEMPLATE_DAY_SEQUENCE[email.templateId] ?? index,
    preview: email.preview || email.body.split("\n")[0] || "",
    category: email.category || "season",
    priority: email.priority || "normal",
    unread: Boolean(email.unread),
    requiresAction: Boolean(email.requiresAction),
    actionCompleted: Boolean(email.actionCompleted),
    actions: Array.isArray(email.actions) ? email.actions : [],
  }));
}

export function reconcileCareerEmails(existingValue: unknown, drafts: CareerEmail[]): CareerEmail[] {
  const original = Array.isArray(existingValue) ? existingValue : [];
  const existing = normalizeCareerEmails(existingValue);
  const byDedupeKey = new Map(existing.map((email) => [email.dedupeKey, email]));
  let changed = false;

  drafts.forEach((candidate) => {
    const current = byDedupeKey.get(candidate.dedupeKey);
    if (!current) {
      byDedupeKey.set(candidate.dedupeKey, candidate);
      changed = true;
      return;
    }

    const taskChanged = candidate.requiresAction && (
      current.actionCompleted !== candidate.actionCompleted
      || current.body !== candidate.body
      || current.preview !== candidate.preview
      || current.priority !== candidate.priority
    );
    if (current.daySequence !== candidate.daySequence || taskChanged) {
      byDedupeKey.set(candidate.dedupeKey, {
        ...current,
        daySequence: candidate.daySequence,
        ...(taskChanged ? {
          body: candidate.body,
          preview: candidate.preview,
          priority: candidate.priority,
          actionCompleted: candidate.actionCompleted,
          actions: candidate.actions,
        } : {}),
      });
      changed = true;
    }
  });

  const next = Array.from(byDedupeKey.values()).sort((left, right) => (
    right.date.localeCompare(left.date)
    || right.daySequence - left.daySequence
    || right.id.localeCompare(left.id)
  ));
  if (!changed && JSON.stringify(next) === JSON.stringify(original)) return original as CareerEmail[];
  if (JSON.stringify(next) === JSON.stringify(original)) return original as CareerEmail[];
  return next;
}

const promptResolutionRank = (email: CareerEmail) => {
  if (email.templateId === "task.appoint-leadership" || email.templateId === "fixture.selection-reminder") return 0;
  if (email.templateId === "captaincy.leadership-confirmed" || email.templateId === "fixture.matchday") return 1;
  return 2;
};

export function orderCareerEmailThread(messages: CareerEmail[]): CareerEmail[] {
  const newestFirst = [...messages].sort((left, right) => (
    right.date.localeCompare(left.date)
    || right.daySequence - left.daySequence
    || right.id.localeCompare(left.id)
  ));
  const hasPrompt = newestFirst.some((email) => promptResolutionRank(email) === 0);
  const hasResolution = newestFirst.some((email) => promptResolutionRank(email) === 1);
  if (!hasPrompt || !hasResolution) return newestFirst;

  return [...newestFirst].sort((left, right) => (
    promptResolutionRank(left) - promptResolutionRank(right)
  ));
}
