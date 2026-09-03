import { type MinorRecord } from "@/lib/data/minorRecords";

interface MatchScore {
  runs: number;
  wickets: number;
  overs: number;
}

interface ScorecardPlayer {
  name: string;
  id: string;
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
  batterA: string;
  batterB: string;
  wicket: number;
}

interface MatchSimulationRecord {
  partnerships?: MatchPartnership[];
  battingFirstTeamId?: string;
  winnerId?: string;
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
}

export function trackMinorRecordsOnMatchComplete(
  match: any,
  currentRecords: MinorRecord[],
  teams: Record<string, any>,
  currentSeason: number
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
      const isTeamScore = id.startsWith("highest-score-") || id.startsWith("lowest-score-");
      const recordValue = (value: string) => isTeamScore
        ? parseFloat(value.split("/")[0].replace(/[^\d.]/g, ""))
        : parseFloat(value.replace(/[^\d.]/g, ""));
      const oldVal = recordValue(oldRecord.value);
      const newVal = recordValue(newValue);
      
      const isLowestScore = id.startsWith("lowest-score-");
      const isLowestDefended = id.startsWith("lowest-defended-");
      const shouldUpdate = (isLowestScore || isLowestDefended) 
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
        const pos = idx + 1;
        if (pos >= 1 && pos <= 11) {
          const runsStr = p.runs.toString() + (p.dismissal === "not out" || !p.dismissal ? "*" : "");
          updateRecord(`highest-score-pos-${pos}`, runsStr, p.name, `${ownTeamShort} vs ${oppTeamShort}`);
        }
      }
    });
  };

  checkBattingInnings(match.scorecard.inningsA.batting, teamA.shortName, teamB.shortName);
  checkBattingInnings(match.scorecard.inningsB.batting, teamB.shortName, teamA.shortName);

  // 3. Partnerships by wicket/position
  if (match.simulation?.partnerships) {
    match.simulation.partnerships.forEach((p: any) => {
      if (p.wicket >= 1 && p.wicket <= 10) {
        const pos = p.wicket;
        updateRecord(
          `highest-partnership-pos-${pos}`,
          p.runs.toString(),
          `${p.batterA} & ${p.batterB}`,
          `${teamA.shortName} vs ${teamB.shortName} (${p.wicket}${p.wicket === 1 ? "st" : p.wicket === 2 ? "nd" : p.wicket === 3 ? "rd" : "th"} wicket)`
        );
      }
    });
  }

  return { updatedRecords, brokenRecordNotices };
}
