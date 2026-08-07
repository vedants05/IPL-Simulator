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

  const updateRecord = (id: string, newValue: string, holder: string, notes: string) => {
    const idx = updatedRecords.findIndex(r => r.id === id);
    if (idx !== -1) {
      const oldRecord = updatedRecords[idx];
      const oldVal = parseFloat(oldRecord.value.replace(/[^\d.]/g, ""));
      const newVal = parseFloat(newValue.replace(/[^\d.]/g, ""));
      
      const isLowestScore = id.startsWith("lowest-score-");
      const isLowestDefended = id.startsWith("lowest-defended-");
      const shouldUpdate = (isLowestScore || isLowestDefended) 
        ? newVal < oldVal 
        : newVal > oldVal;

      if (shouldUpdate) {
        updatedRecords[idx] = {
          ...oldRecord,
          value: newValue,
          holder,
          season: seasonStr,
          notes,
          verified: true
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
    updateRecord(`highest-score-${match.teamA.toLowerCase()}`, scoreAStr, teamA.name, `vs ${teamB.shortName}`);
    if (match.scoreA.wickets === 10 || match.scoreA.overs >= 20) {
      updateRecord(`lowest-score-${match.teamA.toLowerCase()}`, scoreAStr, teamA.name, `vs ${teamB.shortName}`);
    }
  }

  if (match.scoreB) {
    const scoreBStr = `${match.scoreB.runs}/${match.scoreB.wickets}`;
    updateRecord(`highest-score-${match.teamB.toLowerCase()}`, scoreBStr, teamB.name, `vs ${teamA.shortName}`);
    if (match.scoreB.wickets === 10 || match.scoreB.overs >= 20) {
      updateRecord(`lowest-score-${match.teamB.toLowerCase()}`, scoreBStr, teamB.name, `vs ${teamA.shortName}`);
    }
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
