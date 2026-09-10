import { type MinorRecord } from "@/lib/data/minorRecords";
import { type Player } from "@/lib/types";

interface MatchScore {
  runs: number;
  wickets: number;
  overs: number;
}

interface ScorecardPlayer {
  name: string;
  id: string;
  battingPosition?: number;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  overs?: number;
  wickets?: number;
  runsConceded?: number;
  maidens?: number;
  dismissal?: string;
}

interface InningsScorecard {
  batting: ScorecardPlayer[];
  bowling: ScorecardPlayer[];
  extras: number;
}

interface MatchScorecard {
  inningsA: InningsScorecard;
  inningsB: InningsScorecard;
}

interface MatchPartnership {
  runs: number;
  batterIds?: string[];
  batterA?: string;
  batterB?: string;
  batterNames?: string[];
  wicket: number;
}

interface MatchSimulationRecord {
  partnerships?: MatchPartnership[];
  innings?: Array<{
    battingTeamId?: string;
    partnerships: MatchPartnership[];
    oversDetail?: Array<{
      number?: number;
      bowlerId?: string;
      bowlerName?: string;
      runs?: number;
      deliveries: Array<{
        strikerId: string;
        strikerName?: string;
        bowlerId?: string;
        bowlerName?: string;
        overNumber?: number;
        runsOffBat: number;
        totalRuns?: number;
        isLegal: boolean;
        wicket?: {
          playerId: string;
          kind: string;
          bowlerCredited: boolean;
          fielderId?: string;
          fielderName?: string;
        };
      }>;
    }>;
  }>;
  battingFirstTeamId?: string;
  winnerId?: string;
  playerOfTheMatchId?: string;
  playerOfTheMatchName?: string;
  lineups?: Record<string, {
    captainId?: string | null;
    startingXI: string[];
    finalXI: string[];
  }>;
}

interface Match {
  id: string;
  teamA: string;
  teamB: string;
  played: boolean;
  scoreA?: MatchScore;
  scoreB?: MatchScore;
  scorecard?: MatchScorecard;
  simulation?: MatchSimulationRecord;
  winner?: string;
  date?: string;
  stage?: "qualifier1" | "eliminator" | "qualifier2" | "final";
}

interface BattingSeasonStat {
  id: string;
  name: string;
  teamId: string;
  runs: number;
  balls?: number;
  matches?: number;
  battingInnings?: number;
  wickets?: number;
  catches?: number;
  stumpings?: number;
  maidens?: number;
  powerplayWickets?: number;
}

export interface MinorRecordEvaluationContext {
  players?: Record<string, Player>;
  /** Completed fixtures in the active season, including the match being evaluated. */
  fixtures?: Match[];
  /** Auction prices are stored in lakh throughout the game. */
  auctionSales?: Array<{ playerId: string; teamId: string; price: number }>;
}

export function updateAllTimeBattingSeasonRecords(
  currentRecords: MinorRecord[],
  seasonStats: Record<string, BattingSeasonStat>,
  teams: Record<string, { shortName?: string }>,
  currentSeason: number,
): MinorRecord[] {
  const leaderboardRecords = currentRecords.filter((record) => record.id.startsWith("all-time-season-runs-"));
  if (leaderboardRecords.length === 0) return currentRecords;

  const candidates = [
    ...leaderboardRecords.map((record) => ({
      holder: record.holder,
      runs: Number.parseInt(record.value, 10),
      season: record.season ?? "",
      notes: record.notes ?? "",
      source: record.source,
      verified: record.verified,
    })),
    ...Object.values(seasonStats)
      .filter((stat) => stat.runs > 0)
      .map((stat) => ({
        holder: stat.name,
        runs: stat.runs,
        season: String(currentSeason),
        notes: teams[stat.teamId]?.shortName ?? stat.teamId,
        source: "Career simulation",
        verified: true,
      })),
  ].filter((candidate) => Number.isFinite(candidate.runs));

  const bestByPlayerSeason = new Map<string, (typeof candidates)[number]>();
  candidates.forEach((candidate) => {
    const key = `${candidate.holder.toLocaleLowerCase("en-GB")}:${candidate.season}`;
    const existing = bestByPlayerSeason.get(key);
    if (!existing || candidate.runs > existing.runs) bestByPlayerSeason.set(key, candidate);
  });
  const leaders = Array.from(bestByPlayerSeason.values())
    .sort((left, right) => right.runs - left.runs || left.holder.localeCompare(right.holder))
    .slice(0, leaderboardRecords.length);

  const slots = [...leaderboardRecords].sort((left, right) => (
    Number.parseInt(left.id.split("-").pop() ?? "0", 10)
    - Number.parseInt(right.id.split("-").pop() ?? "0", 10)
  ));
  const replacements = new Map<string, MinorRecord>();
  let changed = false;
  slots.forEach((slot, index) => {
    const leader = leaders[index];
    if (!leader) return;
    const replacement: MinorRecord = {
      ...slot,
      value: `${leader.runs} runs`,
      holder: leader.holder,
      season: leader.season,
      notes: leader.notes,
      source: leader.source,
      verified: leader.verified,
    };
    replacements.set(slot.id, replacement);
    if (
      replacement.value !== slot.value
      || replacement.holder !== slot.holder
      || replacement.season !== slot.season
      || replacement.notes !== slot.notes
    ) changed = true;
  });

  return changed
    ? currentRecords.map((record) => replacements.get(record.id) ?? record)
    : currentRecords;
}

/** Rebuild innings-based run milestones from an active season's scorecards.
 * This also migrates saves in which a player crossed a threshold before live
 * milestone tracking was introduced. */
export function reconcileFastestSeasonRunInningsRecords(
  currentRecords: MinorRecord[],
  fixtures: Match[],
  teams: Record<string, { shortName?: string }>,
  currentSeason: number,
): MinorRecord[] {
  const thresholds = currentRecords
    .filter((record) => /^fastest-\d+-innings$/.test(record.id))
    .map((record) => Number.parseInt(record.id.split("-")[1], 10));
  if (thresholds.length === 0) return currentRecords;

  const progress = new Map<string, { runs: number; innings: number }>();
  const candidates = new Map<number, { innings: number; holder: string; teamId: string; date?: string }>();
  [...fixtures]
    .filter((fixture) => fixture.played && fixture.scorecard)
    .sort((left, right) => (left.date ?? "").localeCompare(right.date ?? "") || left.id.localeCompare(right.id))
    .forEach((fixture) => {
      ([
        { batting: fixture.scorecard!.inningsA.batting, teamId: fixture.teamA },
        { batting: fixture.scorecard!.inningsB.batting, teamId: fixture.teamB },
      ] as const).forEach(({ batting, teamId }) => {
        batting.forEach((batter) => {
          const participated = batter.dismissal !== "did not bat"
            && ((batter.balls ?? 0) > 0 || (batter.runs ?? 0) > 0 || Boolean(batter.dismissal));
          if (!participated) return;
          const prior = progress.get(batter.id) ?? { runs: 0, innings: 0 };
          const next = { runs: prior.runs + (batter.runs ?? 0), innings: prior.innings + 1 };
          thresholds.forEach((threshold) => {
            if (prior.runs >= threshold || next.runs < threshold) return;
            const existing = candidates.get(threshold);
            if (!existing || next.innings < existing.innings) {
              candidates.set(threshold, {
                innings: next.innings,
                holder: batter.name,
                teamId,
                date: fixture.date,
              });
            }
          });
          progress.set(batter.id, next);
        });
      });
    });

  let changed = false;
  let nextBreakSequence = currentRecords.reduce(
    (latest, record) => Math.max(latest, record.breakSequence ?? 0),
    0,
  );
  const reconciled = currentRecords.map((record) => {
    const match = record.id.match(/^fastest-(\d+)-innings$/);
    if (!match) return record;
    const candidate = candidates.get(Number.parseInt(match[1], 10));
    const existingInnings = Number.parseInt(record.value, 10);
    if (!candidate || candidate.innings >= existingInnings) return record;
    changed = true;
    nextBreakSequence += 1;
    return {
      ...record,
      value: `${candidate.innings} innings`,
      holder: candidate.holder,
      season: String(currentSeason),
      notes: teams[candidate.teamId]?.shortName ?? candidate.teamId,
      source: "Career simulation",
      verified: true,
      lastBrokenOn: candidate.date ?? String(currentSeason),
      breakSequence: nextBreakSequence,
    };
  });
  return changed ? reconciled : currentRecords;
}

export function trackMinorRecordsOnMatchComplete(
  match: Match,
  currentRecords: MinorRecord[],
  teams: Record<string, any>,
  currentSeason: number,
  seasonStats?: Record<string, BattingSeasonStat>,
  context: MinorRecordEvaluationContext = {},
): { updatedRecords: MinorRecord[]; brokenRecordNotices: string[] } {
  const updatedRecords = [...currentRecords];
  const brokenRecordNotices: string[] = [];

  const teamA = teams[match.teamA];
  const teamB = teams[match.teamB];
  if (!teamA || !teamB || !match.scorecard) {
    return { updatedRecords, brokenRecordNotices };
  }

  const seasonStr = currentSeason.toString();
  const brokenOn = match.date ?? seasonStr;

  const updateRecord = (id: string, newValue: string, holder: string, notes: string) => {
    const idx = updatedRecords.findIndex(r => r.id === id);
    if (idx !== -1) {
      const oldRecord = updatedRecords[idx];
      const isTeamScore = id.startsWith("highest-score-") || id.startsWith("lowest-score-")
        || id === "highest-team-score-final" || id === "lowest-team-score-final";
      const recordValue = (value: string) => isTeamScore
        ? parseFloat(value.split("/")[0].replace(/[^\d.]/g, ""))
        : parseFloat(value.replace(/[^\d.]/g, ""));
      const oldVal = recordValue(oldRecord.value);
      const newVal = recordValue(newValue);
      
      const isLowestScore = id.startsWith("lowest-score-") || id === "lowest-team-score-final";
      const isLowestDefended = id.startsWith("lowest-defended-");
      const isFastest = id.startsWith("fastest-");
      const shouldUpdate = (isLowestScore || isLowestDefended || isFastest)
        ? newVal < oldVal 
        : newVal > oldVal;

      if (shouldUpdate) {
        const breakSequence = updatedRecords.reduce(
          (latest, record) => Math.max(latest, record.breakSequence ?? 0),
          0,
        ) + 1;
        updatedRecords[idx] = {
          ...oldRecord,
          value: newValue,
          holder,
          season: seasonStr,
          notes,
          verified: true,
          lastBrokenOn: brokenOn,
          breakSequence,
        };
        brokenRecordNotices.push(
          `Record Broken! "${oldRecord.title}" has been updated: ${holder} achieved ${newValue} (${notes}, ${seasonStr})`
        );
      }
    }
  };

  // 1. Team scores: Highest & Lowest
  if (match.scoreA) {
    const scoreAStr = `${match.scoreA.runs}/${match.scoreA.wickets}`;
    updateRecord(`highest-score-${match.teamA.toLowerCase()}`, scoreAStr, teamA.shortName, `vs ${teamB.shortName}`);
    if (match.scoreA.wickets === 10 || match.scoreA.overs >= 20) {
      updateRecord(`lowest-score-${match.teamA.toLowerCase()}`, scoreAStr, teamA.shortName, `vs ${teamB.shortName}`);
    }
  }

  if (match.scoreB) {
    const scoreBStr = `${match.scoreB.runs}/${match.scoreB.wickets}`;
    updateRecord(`highest-score-${match.teamB.toLowerCase()}`, scoreBStr, teamB.shortName, `vs ${teamA.shortName}`);
    if (match.scoreB.wickets === 10 || match.scoreB.overs >= 20) {
      updateRecord(`lowest-score-${match.teamB.toLowerCase()}`, scoreBStr, teamB.shortName, `vs ${teamA.shortName}`);
    }
  }

  // Match-level team records derived from the completed scorecard.
  if (match.scoreA && match.scoreB) {
    const battingFirstTeamId = match.simulation?.battingFirstTeamId ?? match.teamA;
    const battingSecondTeamId = battingFirstTeamId === match.teamA ? match.teamB : match.teamA;
    const battingFirstScore = battingFirstTeamId === match.teamA ? match.scoreA : match.scoreB;
    const battingSecondScore = battingSecondTeamId === match.teamA ? match.scoreA : match.scoreB;
    const battingFirstTeam = teams[battingFirstTeamId];
    const battingSecondTeam = teams[battingSecondTeamId];
    const winnerId = match.winner ?? match.simulation?.winnerId;
    const matchLabel = `${teamA.shortName} vs ${teamB.shortName}`;
    const aggregateRuns = match.scoreA.runs + match.scoreB.runs;
    const allBatting = [
      ...match.scorecard.inningsA.batting,
      ...match.scorecard.inningsB.batting,
    ];
    const totalSixes = allBatting.reduce((sum, player) => sum + (player.sixes ?? 0), 0);
    const totalBoundaries = allBatting.reduce(
      (sum, player) => sum + (player.fours ?? 0) + (player.sixes ?? 0),
      0,
    );

    updateRecord("most-runs-in-match", `${aggregateRuns} runs`, matchLabel, `${match.scoreA.runs}/${match.scoreA.wickets} & ${match.scoreB.runs}/${match.scoreB.wickets}`);
    updateRecord("most-sixes-in-match", `${totalSixes} sixes`, matchLabel, seasonStr);
    updateRecord("most-boundaries-in-match", `${totalBoundaries} boundaries`, matchLabel, seasonStr);

    // A runs-margin victory and a defended total both require the side batting
    // first to have won; chase victories are tracked for the second innings.
    if (winnerId === battingFirstTeamId && battingFirstTeam && battingSecondTeam) {
      const winningMargin = battingFirstScore.runs - battingSecondScore.runs;
      if (winningMargin > 0) {
        updateRecord("largest-victory-runs", `${winningMargin} runs`, battingFirstTeam.shortName, `vs ${battingSecondTeam.shortName}`);
      }
      if (battingFirstScore.wickets === 10 || battingFirstScore.overs >= 20) {
        const defendedScore = `${battingFirstScore.runs}/${battingFirstScore.wickets}`;
        updateRecord("lowest-score-defended", defendedScore, battingFirstTeam.shortName, `vs ${battingSecondTeam.shortName}`);
        updateRecord(`lowest-defended-totals-${battingFirstTeamId.toLowerCase()}`, defendedScore, battingFirstTeam.shortName, `vs ${battingSecondTeam.shortName}`);
      }
    } else if (winnerId === battingSecondTeamId && battingFirstTeam && battingSecondTeam) {
      const chaseScore = `${battingSecondScore.runs}/${battingSecondScore.wickets}`;
      updateRecord(`highest-runs-chased-${battingSecondTeamId.toLowerCase()}`, chaseScore, battingSecondTeam.shortName, `vs ${battingFirstTeam.shortName}`);
    }

    const extrasConceded = [
      { team: teamB, value: match.scorecard.inningsA.extras, opponent: teamA },
      { team: teamA, value: match.scorecard.inningsB.extras, opponent: teamB },
    ];
    extrasConceded.forEach(({ team, value, opponent }) => {
      updateRecord("most-extras-in-innings", `${value} extras`, team.shortName, `vs ${opponent.shortName}`);
    });
  }

  // 2. Individual batting scores by position
  const checkBattingInnings = (battingPlayers: ScorecardPlayer[], ownTeamShort: string, oppTeamShort: string) => {
    battingPlayers.forEach((p, idx) => {
      if (p.runs !== undefined && p.runs > 0) {
        const pos = p.battingPosition ?? idx + 1;
        if (pos >= 1 && pos <= 11) {
          const runsStr = p.runs.toString() + (p.dismissal === "not out" || !p.dismissal ? "*" : "");
          updateRecord(`highest-score-pos-${pos}`, runsStr, p.name, `${ownTeamShort} vs ${oppTeamShort}`);
        }
      }
    });
  };

  checkBattingInnings(match.scorecard.inningsA.batting, teamA.shortName, teamB.shortName);
  checkBattingInnings(match.scorecard.inningsB.batting, teamB.shortName, teamA.shortName);

  const players = context.players ?? {};
  const matchLabel = `${teamA.shortName} vs ${teamB.shortName}`;
  const inningsWithTeams = [
    { scorecard: match.scorecard.inningsA, battingTeamId: match.teamA, bowlingTeamId: match.teamB },
    { scorecard: match.scorecard.inningsB, battingTeamId: match.teamB, bowlingTeamId: match.teamA },
  ];
  const simulatedInnings = match.simulation?.innings ?? [];

  const ageValue = (player: Player | undefined) => player?.age;
  const updateAgeRecord = (id: string, player: Player, lowerIsBetter: boolean, notes: string) => {
    const index = updatedRecords.findIndex((record) => record.id === id);
    if (index < 0) return;
    const oldAge = Number.parseInt(updatedRecords[index].value, 10);
    const newAge = ageValue(player);
    if (newAge === undefined || !Number.isFinite(oldAge)) return;
    if ((lowerIsBetter && newAge < oldAge) || (!lowerIsBetter && newAge > oldAge)) {
      // Age is currently stored as whole years, so do not manufacture day precision.
      const oldRecord = updatedRecords[index];
      const breakSequence = updatedRecords.reduce((latest, record) => Math.max(latest, record.breakSequence ?? 0), 0) + 1;
      updatedRecords[index] = { ...oldRecord, value: `${newAge} years`, holder: player.name, season: seasonStr, notes, source: "Career simulation", verified: true, lastBrokenOn: brokenOn, breakSequence };
      brokenRecordNotices.push(`Record Broken! "${oldRecord.title}" has been updated: ${player.name} achieved ${newAge} years (${notes}, ${seasonStr})`);
    }
  };

  inningsWithTeams.forEach(({ scorecard, battingTeamId, bowlingTeamId }, inningsIndex) => {
    const battingTeam = teams[battingTeamId];
    const bowlingTeam = teams[bowlingTeamId];
    const detail = simulatedInnings.find((innings) => innings.battingTeamId === battingTeamId)
      ?? simulatedInnings[inningsIndex];
    const deliveries = detail?.oversDetail?.flatMap((over) => over.deliveries) ?? [];

    scorecard.batting.forEach((batter) => {
      const runs = batter.runs ?? 0;
      const balls = batter.balls ?? 0;
      const player = players[batter.id];
      if (runs >= 50 && balls > 0) {
        const batterBalls = deliveries.filter((delivery) => delivery.strikerId === batter.id && delivery.isLegal);
        let cumulative = 0;
        let fiftyBall: number | undefined;
        let hundredBall: number | undefined;
        batterBalls.forEach((delivery, index) => {
          cumulative += delivery.runsOffBat;
          if (fiftyBall === undefined && cumulative >= 50) fiftyBall = index + 1;
          if (hundredBall === undefined && cumulative >= 100) hundredBall = index + 1;
        });
        updateRecord("fastest-fifty-ipl", `${fiftyBall ?? balls} balls`, batter.name, matchLabel);
        if (runs >= 100) updateRecord("fastest-century-ipl", `${hundredBall ?? balls} balls`, batter.name, matchLabel);
        if (runs >= 50) updateRecord("highest-strike-rate-innings", (runs / balls * 100).toFixed(2), batter.name, `${runs}${batter.dismissal === "not out" ? "*" : ""} off ${balls}, ${matchLabel}`);
      }
      if (player) {
        updateAgeRecord("youngest-player-ipl", player, true, `Played for ${battingTeam?.shortName ?? battingTeamId}`);
        updateAgeRecord("oldest-player-ipl", player, false, `Played for ${battingTeam?.shortName ?? battingTeamId}`);
        if (!player.isCapped) {
          updateRecord("highest-score-uncapped-match", `${runs}${batter.dismissal === "not out" ? "*" : ""}`, batter.name, matchLabel);
          if (match.stage) updateRecord("highest-score-uncapped-playoffs", `${runs}${batter.dismissal === "not out" ? "*" : ""}`, batter.name, matchLabel);
          if (runs >= 50) updateAgeRecord("youngest-uncapped-fifty", player, true, matchLabel);
        }
      }
      if (match.stage === "final") {
        updateRecord("highest-score-final", `${runs}${batter.dismissal === "not out" ? "*" : ""}`, batter.name, matchLabel);
        updateRecord("most-sixes-final", `${batter.sixes ?? 0} sixes`, batter.name, matchLabel);
        if (runs >= 50 && balls > 0) {
          const batterBalls = deliveries.filter((delivery) => delivery.strikerId === batter.id && delivery.isLegal);
          let accumulated = 0;
          let crossing = balls;
          batterBalls.some((delivery, index) => {
            accumulated += delivery.runsOffBat;
            if (accumulated < 50) return false;
            crossing = index + 1;
            return true;
          });
          updateRecord("fastest-fifty-final", `${crossing} balls`, batter.name, matchLabel);
        }
      }
    });

    scorecard.bowling.forEach((bowler) => {
      const player = players[bowler.id];
      updateRecord("most-runs-conceded-spell", `${bowler.runsConceded ?? 0} runs`, bowler.name, `${bowler.overs ?? 0}-${bowler.runsConceded ?? 0}-${bowler.wickets ?? 0}, ${matchLabel}`);
      const dots = deliveries.filter((delivery) => delivery.bowlerId === bowler.id && delivery.isLegal && (delivery.totalRuns ?? delivery.runsOffBat) === 0).length;
      const sixes = deliveries.filter((delivery) => delivery.bowlerId === bowler.id && delivery.runsOffBat === 6).length;
      if (dots > 0) updateRecord("most-dot-balls-innings", `${dots} dot balls`, bowler.name, matchLabel);
      if (sixes > 0) updateRecord("most-overs-conceded-sixes", `${sixes} sixes`, bowler.name, matchLabel);
      if (match.stage === "final") {
        const id = "best-bowling-final";
        const index = updatedRecords.findIndex((record) => record.id === id);
        if (index >= 0) {
          const [oldWickets, oldRuns] = updatedRecords[index].value.split("/").map((value) => Number.parseInt(value, 10));
          const wickets = bowler.wickets ?? 0;
          const runs = bowler.runsConceded ?? 0;
          if (wickets > oldWickets || (wickets === oldWickets && runs < oldRuns)) {
            const oldRecord = updatedRecords[index];
            const breakSequence = updatedRecords.reduce((latest, record) => Math.max(latest, record.breakSequence ?? 0), 0) + 1;
            updatedRecords[index] = { ...oldRecord, value: `${wickets}/${runs}`, holder: bowler.name, season: seasonStr, notes: matchLabel, source: "Career simulation", verified: true, lastBrokenOn: brokenOn, breakSequence };
            brokenRecordNotices.push(`Record Broken! "${oldRecord.title}" has been updated: ${bowler.name} achieved ${wickets}/${runs} (${matchLabel}, ${seasonStr})`);
          }
        }
      }
      if (player && !player.isCapped && (player.iplStats?.matches ?? 0) === 0) {
        const id = "most-wickets-uncapped-debut";
        const index = updatedRecords.findIndex((record) => record.id === id);
        if (index >= 0) {
          const [oldWickets, oldRuns] = updatedRecords[index].value.split("/").map((value) => Number.parseInt(value, 10));
          const wickets = bowler.wickets ?? 0;
          const runs = bowler.runsConceded ?? 0;
          if (wickets > oldWickets || (wickets === oldWickets && runs < oldRuns)) {
            const oldRecord = updatedRecords[index];
            updatedRecords[index] = { ...oldRecord, value: `${wickets}/${runs}`, holder: bowler.name, season: seasonStr, notes: matchLabel, source: "Career simulation", verified: true, lastBrokenOn: brokenOn, breakSequence: updatedRecords.reduce((latest, record) => Math.max(latest, record.breakSequence ?? 0), 0) + 1 };
            brokenRecordNotices.push(`Record Broken! "${oldRecord.title}" has been updated: ${bowler.name} achieved ${wickets}/${runs} (${matchLabel}, ${seasonStr})`);
          }
        }
      }
    });

    const perFielder = new Map<string, { name: string; catches: number; dismissals: number }>();
    deliveries.forEach((delivery) => {
      const wicket = delivery.wicket;
      if (!wicket?.fielderId) return;
      const current = perFielder.get(wicket.fielderId) ?? { name: wicket.fielderName ?? players[wicket.fielderId]?.name ?? "Unknown", catches: 0, dismissals: 0 };
      if (wicket.kind === "caught") current.catches += 1;
      if (wicket.kind === "caught" || wicket.kind === "stumped") current.dismissals += 1;
      perFielder.set(wicket.fielderId, current);
    });
    perFielder.forEach((value, playerId) => {
      if (value.catches > 0 && !players[playerId]?.isWicketkeeper) updateRecord("most-catches-innings", `${value.catches} catches`, value.name, matchLabel);
      if (players[playerId]?.isWicketkeeper && value.dismissals > 0) updateRecord("most-dismissals-keeper-innings", `${value.dismissals} dismissals`, value.name, matchLabel);
    });

    detail?.oversDetail?.forEach((over) => {
      const overRuns = over.runs ?? over.deliveries.reduce((sum, delivery) => sum + (delivery.totalRuns ?? delivery.runsOffBat), 0);
      const bowlerId = over.bowlerId ?? over.deliveries[0]?.bowlerId;
      const bowler = bowlerId ? players[bowlerId] : undefined;
      const bowlerName = over.bowlerName ?? over.deliveries[0]?.bowlerName ?? bowler?.name ?? "Unknown";
      const scoringBatters = Array.from(new Set(over.deliveries.filter((delivery) => delivery.runsOffBat > 0).map((delivery) => delivery.strikerName).filter(Boolean))).join(" & ");
      updateRecord("most-runs-in-over", `${overRuns} runs`, scoringBatters || matchLabel, `${bowlerName} bowling, ${matchLabel}`);
      updateRecord("most-runs-conceded-in-over-bowler", `${overRuns} runs`, bowlerName, matchLabel);
      if (bowler?.role === "Spin Bowler" || bowler?.bowlingStyle?.toLowerCase().includes("spin")) updateRecord("most-expensive-over-spinner", `${overRuns} runs`, bowlerName, matchLabel);
      else if (bowler) updateRecord("most-expensive-over-pacer", `${overRuns} runs`, bowlerName, matchLabel);
    });

    if (match.stage === "final") {
      (detail?.partnerships ?? []).forEach((partnership) => updateRecord("highest-partnership-final", `${partnership.runs} runs`, partnership.batterNames?.join(" & ") ?? "Partnership", matchLabel));
    }
  });

  if (match.stage === "final" && match.scoreA && match.scoreB) {
    [[match.teamA, match.scoreA, teamA, teamB], [match.teamB, match.scoreB, teamB, teamA]].forEach(([teamId, score, own, opponent]) => {
      const typedScore = score as MatchScore;
      const ownTeam = own as { shortName: string };
      const opponentTeam = opponent as { shortName: string };
      const value = `${typedScore.runs}/${typedScore.wickets}`;
      updateRecord("highest-team-score-final", value, ownTeam.shortName, `vs ${opponentTeam.shortName}`);
      if (typedScore.wickets === 10 || typedScore.overs >= 20) updateRecord("lowest-team-score-final", value, ownTeam.shortName, `vs ${opponentTeam.shortName}`);
    });
    const winningLineup = match.winner ? match.simulation?.lineups?.[match.winner] : undefined;
    const captain = winningLineup?.captainId ? players[winningLineup.captainId] : undefined;
    if (captain) {
      updateAgeRecord("youngest-captain-title", captain, true, teams[match.winner!]?.shortName ?? match.winner!);
      updateAgeRecord("oldest-captain-title", captain, false, teams[match.winner!]?.shortName ?? match.winner!);
    }
  }

  // Capture cumulative season milestones in the match where they are crossed.
  if (seasonStats) {
    const ballMilestones = updatedRecords
      .filter((record) => /^fastest-\d+-balls$/.test(record.id))
      .map((record) => Number.parseInt(record.id.split("-")[1], 10));
    const inningsMilestones = updatedRecords
      .filter((record) => /^fastest-\d+-innings$/.test(record.id))
      .map((record) => Number.parseInt(record.id.split("-")[1], 10));
    const inningsSources = [
      { scorecard: match.scorecard.inningsA, teamId: match.teamA },
      { scorecard: match.scorecard.inningsB, teamId: match.teamB },
    ];
    const simulation = match.simulation as MatchSimulationRecord | undefined;

    inningsSources.forEach(({ scorecard, teamId }) => {
      const simulatedInnings = simulation?.innings?.find((innings) => innings.battingTeamId === teamId);
      scorecard.batting.forEach((batter: ScorecardPlayer) => {
        const inningsRuns = batter.runs ?? 0;
        if (inningsRuns <= 0) return;
        const finalStat = seasonStats[batter.id];
        if (!finalStat) return;
        const priorRuns = Math.max(0, finalStat.runs - inningsRuns);
        const priorBalls = Math.max(0, (finalStat.balls ?? 0) - (batter.balls ?? 0));
        const finalInnings = Math.max(1, finalStat.battingInnings ?? finalStat.matches ?? 1);
        const teamShort = teams[teamId]?.shortName ?? teamId;
        const batterDeliveries = (simulatedInnings?.oversDetail ?? [])
          .flatMap((over) => over.deliveries)
          .filter((delivery) => delivery.strikerId === batter.id);

        ballMilestones.forEach((threshold) => {
          if (priorRuns >= threshold || finalStat.runs < threshold) return;
          const runsNeeded = threshold - priorRuns;
          let inningsBall = 0;
          let inningsRunningRuns = 0;
          let crossingBall: number | null = null;
          batterDeliveries.some((delivery) => {
            if (delivery.isLegal) inningsBall += 1;
            inningsRunningRuns += delivery.runsOffBat;
            if (inningsRunningRuns < runsNeeded) return false;
            crossingBall = inningsBall;
            return true;
          });
          // A scorecard only gives the final innings total. Without deliveries
          // the exact milestone ball is unknowable, so do not invent a record.
          if (crossingBall === null) return;
          const ballsToMilestone = priorBalls + crossingBall;
          updateRecord(`fastest-${threshold}-balls`, `${ballsToMilestone} balls`, batter.name, `${teamShort} - reached ${threshold} runs`);
        });

        inningsMilestones.forEach((threshold) => {
          if (priorRuns >= threshold || finalStat.runs < threshold) return;
          updateRecord(`fastest-${threshold}-innings`, `${finalInnings} innings`, batter.name, `${teamShort} - reached ${threshold} runs`);
        });
      });
    });
  }

  // 3. Partnerships by wicket/position
  const simulation = match.simulation as MatchSimulationRecord | undefined;
  const partnerships = simulation?.innings?.flatMap((innings) => innings.partnerships)
    ?? simulation?.partnerships
    ?? [];
  if (partnerships.length > 0) {
    partnerships.forEach((p) => {
      if (p.wicket >= 1 && p.wicket <= 10) {
        const batterNames = p.batterNames?.filter(Boolean)
          ?? [p.batterA, p.batterB].filter(Boolean) as string[];
        if (batterNames.length < 2) return;
        const allBatters = [...match.scorecard!.inningsA.batting, ...match.scorecard!.inningsB.batting];
        const positions = (p.batterIds?.length ? p.batterIds.map((id) => allBatters.find((batter) => batter.id === id)?.battingPosition) : batterNames.map((name) => allBatters.find((batter) => batter.name === name)?.battingPosition))
          .filter((position): position is number => Boolean(position && position >= 1 && position <= 11));
        // Older compact saves may not retain batter IDs. Wicket + 1 is a safe
        // fallback for the lower partner and, crucially, makes #11 reachable
        // for a tenth-wicket stand instead of inventing an eleventh wicket.
        const recordPositions = new Set(positions.length > 0 ? positions : [Math.min(11, p.wicket + 1)]);
        recordPositions.forEach((pos) => updateRecord(
          `highest-partnership-pos-${pos}`,
          p.runs.toString(),
          `${batterNames[0]} & ${batterNames[1]}`,
          `${teamA.shortName} vs ${teamB.shortName} (${p.wicket}${p.wicket === 1 ? "st" : p.wicket === 2 ? "nd" : p.wicket === 3 ? "rd" : "th"} wicket)`,
        ));
      }
    });
  }

  return { updatedRecords, brokenRecordNotices };
}

/**
 * Rebuild every cumulative minor-record candidate from persisted season data.
 * Calling this after each match makes loading an older save and live play follow
 * the same rules, and avoids fragile increment-only counters.
 */
export function reconcileCumulativeMinorRecords(
  currentRecords: MinorRecord[],
  fixtures: Match[],
  seasonStats: Record<string, BattingSeasonStat>,
  players: Record<string, Player>,
  teams: Record<string, { shortName?: string }>,
  currentSeason: number,
  auctionSales: Array<{ playerId: string; teamId: string; price: number }> = [],
): MinorRecord[] {
  let next = [...currentRecords];
  const season = String(currentSeason);
  const completed = fixtures.filter((fixture) => fixture.played && fixture.scorecard);
  const numeric = (value: string) => Number.parseFloat(value.replace(/[^\d.]/g, ""));
  const replace = (id: string, value: number, display: string, holder: string, notes: string, lower = false) => {
    const index = next.findIndex((record) => record.id === id);
    if (index < 0) return;
    const oldValue = numeric(next[index].value);
    if (!Number.isFinite(value) || (lower ? value >= oldValue : value <= oldValue)) return;
    const old = next[index];
    next[index] = { ...old, value: display, holder, season, notes, source: "Career simulation", verified: true, lastBrokenOn: season, breakSequence: next.reduce((maximum, record) => Math.max(maximum, record.breakSequence ?? 0), 0) + 1 };
  };
  const teamName = (teamId: string) => teams[teamId]?.shortName ?? teamId;
  const stats = Object.values(seasonStats);

  stats.forEach((stat) => {
    const player = players[stat.id];
    if (!player) return;
    const ageBucket = player.age < 21 ? 20 : Math.min(44, player.age);
    if (player.age <= 44) {
      replace(`runs-by-age-${ageBucket}`, stat.runs, `${stat.runs} runs`, player.name, teamName(stat.teamId));
      replace(`wickets-by-age-${ageBucket}`, stat.wickets ?? 0, `${stat.wickets ?? 0} wickets`, player.name, teamName(stat.teamId));
    }
    const nationality = player.nationality === "Overseas" ? "overseas" : "indian";
    replace(`season-most-runs-${nationality}`, stat.runs, `${stat.runs} runs`, player.name, teamName(stat.teamId));
    replace(`season-most-wickets-${nationality}`, stat.wickets ?? 0, `${stat.wickets ?? 0} wickets`, player.name, teamName(stat.teamId));
    if (!player.isCapped) {
      replace("season-wickets-uncapped-record", stat.wickets ?? 0, `${stat.wickets ?? 0} wickets`, player.name, teamName(stat.teamId));
    }
    if (player.role === "Pace Bowler") replace("most-maiden-overs-season-pacers", stat.maidens ?? 0, `${stat.maidens ?? 0} maidens`, player.name, teamName(stat.teamId));
    if (player.role === "Spin Bowler") replace("most-maiden-overs-season-spinners", stat.maidens ?? 0, `${stat.maidens ?? 0} maidens`, player.name, teamName(stat.teamId));
    if (!player.isWicketkeeper) replace("most-catches-season", stat.catches ?? 0, `${stat.catches ?? 0} catches`, player.name, teamName(stat.teamId));
    if (player.isWicketkeeper) {
      const dismissals = (stat.catches ?? 0) + (stat.stumpings ?? 0);
      replace("most-dismissals-keeper-season", dismissals, `${dismissals} dismissals`, player.name, teamName(stat.teamId));
    }
  });

  // Maintain the top two uncapped season totals rather than treating the
  // "previous" record as an unrelated maximum.
  const uncappedCandidates = stats
    .filter((stat) => players[stat.id] && !players[stat.id].isCapped)
    .map((stat) => ({ value: stat.runs, holder: stat.name, teamId: stat.teamId }))
    .sort((left, right) => right.value - left.value || left.holder.localeCompare(right.holder));
  const uncappedRecord = next.find((record) => record.id === "season-runs-uncapped-record");
  const uncappedPrevious = next.find((record) => record.id === "season-runs-uncapped-previous");
  const uncappedAllTime = [
    ...(uncappedRecord ? [{ value: numeric(uncappedRecord.value), holder: uncappedRecord.holder, teamId: uncappedRecord.notes ?? "", season: uncappedRecord.season }] : []),
    ...(uncappedPrevious ? [{ value: numeric(uncappedPrevious.value), holder: uncappedPrevious.holder, teamId: uncappedPrevious.notes ?? "", season: uncappedPrevious.season }] : []),
    ...uncappedCandidates.map((candidate) => ({ ...candidate, season })),
  ].filter((candidate, index, candidates) => candidates.findIndex((other) => other.holder === candidate.holder && other.season === candidate.season) === index)
    .sort((left, right) => right.value - left.value || left.holder.localeCompare(right.holder));
  const writeRankedUncapped = (id: string, candidate: typeof uncappedAllTime[number] | undefined) => {
    const index = next.findIndex((record) => record.id === id);
    if (index < 0 || !candidate || candidate.value <= numeric(next[index].value)) return;
    next[index] = { ...next[index], value: `${candidate.value} runs`, holder: candidate.holder, season: candidate.season, notes: candidate.teamId, source: "Career simulation", verified: true, lastBrokenOn: season, breakSequence: next.reduce((maximum, record) => Math.max(maximum, record.breakSequence ?? 0), 0) + 1 };
  };
  writeRankedUncapped("season-runs-uncapped-record", uncappedAllTime[0]);
  writeRankedUncapped("season-runs-uncapped-previous", uncappedAllTime[1]);

  const positionRuns = new Map<string, { runs: number; name: string; teamId: string; position: number }>();
  const fifties = new Map<string, number>();
  const playerMatchAwards = new Map<string, number>();
  const teamRuns = new Map<string, number>();
  const powerplayWickets = new Map<string, number>();
  const hatTricks = new Map<string, number>();
  const matchSequenceByPlayer = new Map<string, Array<{ opponent: string; fifty: boolean }>>();

  [...completed].sort((left, right) => (left.date ?? "").localeCompare(right.date ?? "") || left.id.localeCompare(right.id)).forEach((fixture) => {
    if (fixture.simulation?.playerOfTheMatchId) playerMatchAwards.set(fixture.simulation.playerOfTheMatchId, (playerMatchAwards.get(fixture.simulation.playerOfTheMatchId) ?? 0) + 1);
    const pairs = [
      { innings: fixture.scorecard!.inningsA, teamId: fixture.teamA, opponent: fixture.teamB },
      { innings: fixture.scorecard!.inningsB, teamId: fixture.teamB, opponent: fixture.teamA },
    ];
    pairs.forEach(({ innings, teamId, opponent }, inningsIndex) => {
      teamRuns.set(teamId, (teamRuns.get(teamId) ?? 0) + innings.batting.reduce((sum, batter) => sum + (batter.runs ?? 0), 0) + (innings.extras ?? 0));
      innings.batting.forEach((batter, index) => {
        const position = batter.battingPosition ?? index + 1;
        const key = `${batter.id}:${position}`;
        const aggregate = positionRuns.get(key) ?? { runs: 0, name: batter.name, teamId, position };
        aggregate.runs += batter.runs ?? 0;
        positionRuns.set(key, aggregate);
        const fifty = (batter.runs ?? 0) >= 50;
        if (fifty) fifties.set(batter.id, (fifties.get(batter.id) ?? 0) + 1);
        const sequence = matchSequenceByPlayer.get(batter.id) ?? [];
        sequence.push({ opponent, fifty });
        matchSequenceByPlayer.set(batter.id, sequence);
      });
      const detail = fixture.simulation?.innings?.find((candidate) => candidate.battingTeamId === teamId) ?? fixture.simulation?.innings?.[inningsIndex];
      const deliveries = detail?.oversDetail?.flatMap((over) => over.deliveries) ?? [];
      const wicketBallsByBowler = new Map<string, number[]>();
      deliveries.forEach((delivery, ballIndex) => {
        if (!delivery.wicket?.bowlerCredited || !delivery.bowlerId) return;
        if ((delivery.overNumber ?? 99) <= 6) powerplayWickets.set(delivery.bowlerId, (powerplayWickets.get(delivery.bowlerId) ?? 0) + 1);
        const wicketBalls = wicketBallsByBowler.get(delivery.bowlerId) ?? [];
        wicketBalls.push(ballIndex);
        wicketBallsByBowler.set(delivery.bowlerId, wicketBalls);
      });
      wicketBallsByBowler.forEach((wicketBalls, bowlerId) => {
        for (let index = 2; index < wicketBalls.length; index += 1) {
          const slice = deliveries.slice(wicketBalls[index - 2], wicketBalls[index] + 1).filter((delivery) => delivery.isLegal);
          const credited = slice.filter((delivery) => delivery.wicket?.bowlerCredited && delivery.bowlerId === bowlerId).length;
          if (credited === 3 && slice.length === 3) hatTricks.set(bowlerId, (hatTricks.get(bowlerId) ?? 0) + 1);
        }
      });
    });
  });

  positionRuns.forEach((entry) => replace(`season-most-runs-pos-${entry.position}`, entry.runs, `${entry.runs} runs`, entry.name, teamName(entry.teamId)));
  playerMatchAwards.forEach((awards, playerId) => replace("most-player-match-season", awards, `${awards} awards`, players[playerId]?.name ?? playerId, teamName(seasonStats[playerId]?.teamId ?? players[playerId]?.currentTeamId ?? "")));
  stats.forEach((stat) => {
    if ((stat.powerplayWickets ?? 0) > 0) powerplayWickets.set(stat.id, stat.powerplayWickets ?? 0);
  });
  powerplayWickets.forEach((wickets, playerId) => replace("most-wickets-powerplay-season", wickets, `${wickets} wickets`, players[playerId]?.name ?? playerId, teamName(seasonStats[playerId]?.teamId ?? "")));
  hatTricks.forEach((count, playerId) => replace("most-hat-tricks", count, `${count} hat-tricks`, players[playerId]?.name ?? playerId, season));
  fifties.forEach((count, playerId) => {
    if (!players[playerId]?.isCapped) replace("most-fifties-season-uncapped", count, String(count), players[playerId]?.name ?? playerId, teamName(seasonStats[playerId]?.teamId ?? ""));
  });

  stats.forEach((stat) => {
    const total = teamRuns.get(stat.teamId) ?? 0;
    if (total > 0) replace("highest-percentage-team-runs", stat.runs / total * 100, `${(stat.runs / total * 100).toFixed(1)}%`, stat.name, `Scored ${stat.runs} of ${teamName(stat.teamId)}'s ${total} runs`);
  });

  matchSequenceByPlayer.forEach((sequence, playerId) => {
    let overall = 0;
    let current = 0;
    const byOpponent = new Map<string, number>();
    const bestByOpponent = new Map<string, number>();
    sequence.forEach(({ opponent, fifty }) => {
      current = fifty ? current + 1 : 0;
      overall = Math.max(overall, current);
      const opponentRun = fifty ? (byOpponent.get(opponent) ?? 0) + 1 : 0;
      byOpponent.set(opponent, opponentRun);
      bestByOpponent.set(opponent, Math.max(bestByOpponent.get(opponent) ?? 0, opponentRun));
    });
    replace("most-consecutive-fifties-ipl", overall, `${overall} matches`, players[playerId]?.name ?? playerId, season);
    bestByOpponent.forEach((count, opponent) => replace("most-consecutive-fifties-warner", count, `${count} matches`, players[playerId]?.name ?? playerId, `Against ${teamName(opponent)}`));
  });

  const winsByTeam = new Map<string, number>();
  teams && Object.keys(teams).forEach((teamId) => {
    let streak = 0;
    let best = 0;
    [...completed].filter((fixture) => fixture.teamA === teamId || fixture.teamB === teamId).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).forEach((fixture) => {
      streak = fixture.winner === teamId ? streak + 1 : 0;
      best = Math.max(best, streak);
    });
    winsByTeam.set(teamId, best);
  });
  winsByTeam.forEach((wins, teamId) => replace("most-consecutive-wins", wins, `${wins} wins`, teamName(teamId), season));

  const wicketThresholds = next.filter((record) => /^fastest-\d+-wickets$/.test(record.id)).map((record) => Number.parseInt(record.id.split("-")[1], 10));
  wicketThresholds.forEach((threshold) => {
    stats.forEach((stat) => {
      if ((stat.wickets ?? 0) < threshold) return;
      let wickets = 0;
      let matches = 0;
      for (const fixture of [...completed].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))) {
        const bowling = fixture.teamA === stat.teamId ? fixture.scorecard!.inningsB.bowling : fixture.teamB === stat.teamId ? fixture.scorecard!.inningsA.bowling : [];
        const entry = bowling.find((bowler) => bowler.id === stat.id);
        const lineup = fixture.simulation?.lineups?.[stat.teamId];
        const appeared = lineup
          ? lineup.startingXI.includes(stat.id) || lineup.finalXI.includes(stat.id)
          : Boolean(entry);
        if (!appeared) continue;
        matches += 1;
        wickets += entry?.wickets ?? 0;
        if (wickets >= threshold) break;
      }
      if (wickets >= threshold) replace(`fastest-${threshold}-wickets`, matches, `${matches} matches`, stat.name, teamName(stat.teamId), true);
    });
  });

  auctionSales.forEach((sale) => {
    const player = players[sale.playerId];
    const crores = sale.price / 100;
    replace("most-expensive-auction-buy", crores, `₹${crores.toFixed(2)} Crore`, player?.name ?? sale.playerId, `Bought by ${teamName(sale.teamId)}`);
    replace("highest-auction-purse-spent", crores, `₹${crores.toFixed(2)} Cr`, teamName(sale.teamId), player?.name ?? sale.playerId);
  });

  return next;
}
