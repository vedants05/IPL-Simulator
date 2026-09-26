import type { MatchSimulationRecord } from "./matchSimulation";
import type { Player } from "../types";

export type PlayerAnalysisFixture = {
  id: string;
  date?: string;
  played?: boolean;
  teamA?: string;
  teamB?: string;
  winner?: string;
  simulation?: MatchSimulationRecord;
  scorecard?: {
    inningsA: { batting: Array<{ id: string; runs?: number; balls?: number; fours?: number; sixes?: number; dismissal?: string }>; bowling: Array<{ id: string; balls?: number; overs?: number; runsConceded?: number; wickets?: number }> };
    inningsB: { batting: Array<{ id: string; runs?: number; balls?: number; fours?: number; sixes?: number; dismissal?: string }>; bowling: Array<{ id: string; balls?: number; overs?: number; runsConceded?: number; wickets?: number }> };
  };
};

export type PlayerAnalysisTotals = {
  matches: number; innings: number; runs: number; balls: number; dismissals: number;
  fours: number; sixes: number; fifties: number; hundreds: number;
  bowlingInnings: number; bowlBalls: number; conceded: number; wickets: number;
  dots: number; phase: Record<"powerplay" | "middle" | "death", {
    runs: number; balls: number; wickets: number; bowlBalls: number; conceded: number;
  }>;
  segments: Record<string, SegmentTotals>;
};

type SegmentTotals = {
  innings: number; runs: number; balls: number; dismissals: number; fours: number; sixes: number;
  wickets: number; bowlBalls: number; conceded: number; dots: number;
};
const emptySegment = (): SegmentTotals => ({ innings: 0, runs: 0, balls: 0, dismissals: 0, fours: 0, sixes: 0, wickets: 0, bowlBalls: 0, conceded: 0, dots: 0 });
const positionGroups = (position: number) => [`position:${position}`, `position:${position <= 2 ? "1-2" : position <= 5 ? "3-5" : "6plus"}`];
const overRanges = [[1, 6], [7, 12], [13, 16], [17, 20], [1, 4], [5, 8], [9, 12], [7, 10], [11, 14], [15, 18]] as const;
const overSegments = (over: number) => [`over:${over}`, ...overRanges.filter(([start, end]) => over >= start && over <= end).map(([start, end]) => `overs:${start}-${end}`)];
const segmentFor = (totals: PlayerAnalysisTotals, key: string) => (totals.segments[key] ??= emptySegment());
const emptyPhase = () => ({ runs: 0, balls: 0, wickets: 0, bowlBalls: 0, conceded: 0 });
export const emptyPlayerAnalysisTotals = (): PlayerAnalysisTotals => ({
  matches: 0, innings: 0, runs: 0, balls: 0, dismissals: 0,
  fours: 0, sixes: 0, fifties: 0, hundreds: 0,
  bowlingInnings: 0, bowlBalls: 0, conceded: 0, wickets: 0, dots: 0,
  phase: { powerplay: emptyPhase(), middle: emptyPhase(), death: emptyPhase() },
  segments: {},
});

export function buildPlayerAnalysisTotals(fixtures: readonly PlayerAnalysisFixture[], players: Record<string, Player> = {}): Record<string, PlayerAnalysisTotals> {
  const result: Record<string, PlayerAnalysisTotals> = {};
  const ensure = (id: string) => (result[id] ??= emptyPlayerAnalysisTotals());
  for (const fixture of fixtures) {
    if (!fixture.played) continue;
    const appearanceIds = new Set<string>();
    const innings = fixture.simulation?.innings ?? (fixture.scorecard ? [fixture.scorecard.inningsA, fixture.scorecard.inningsB] : []);
    for (let inningsIndex = 0; inningsIndex < innings.length; inningsIndex += 1) {
      const entry = innings[inningsIndex];
      const battingTeamId = "battingTeamId" in entry ? entry.battingTeamId : inningsIndex === 0 ? fixture.teamA : fixture.teamB;
      const bowlingTeamId = "bowlingTeamId" in entry ? entry.bowlingTeamId : inningsIndex === 0 ? fixture.teamB : fixture.teamA;
      const winnerId = fixture.simulation?.winnerId ?? fixture.winner;
      const battingKeys = [`innings:${inningsIndex + 1}`, ...(winnerId && battingTeamId ? [`result:${battingTeamId === winnerId ? "win" : "loss"}`] : [])];
      const bowlingKeys = [`innings:${inningsIndex + 1}`, ...(winnerId && bowlingTeamId ? [`result:${bowlingTeamId === winnerId ? "win" : "loss"}`] : [])];
      for (let index = 0; index < entry.batting.length; index += 1) {
        const batter = entry.batting[index];
        appearanceIds.add(batter.id);
        const stats = ensure(batter.id);
        if ((batter.balls ?? 0) === 0 && (batter.runs ?? 0) === 0) continue;
        stats.innings += 1;
        stats.runs += batter.runs ?? 0;
        stats.balls += batter.balls ?? 0;
        stats.fours += batter.fours ?? 0;
        stats.sixes += batter.sixes ?? 0;
        if ((batter.runs ?? 0) >= 100) stats.hundreds += 1;
        else if ((batter.runs ?? 0) >= 50) stats.fifties += 1;
        if ("notOut" in batter ? !batter.notOut : batter.dismissal !== "not out") stats.dismissals += 1;
        const position = "battingPosition" in batter && typeof batter.battingPosition === "number" ? batter.battingPosition : index + 1;
        for (const key of [...positionGroups(position), ...battingKeys]) {
          const segment = segmentFor(stats, key);
          segment.innings += 1; segment.runs += batter.runs ?? 0; segment.balls += batter.balls ?? 0;
          segment.fours += batter.fours ?? 0; segment.sixes += batter.sixes ?? 0;
          if ("notOut" in batter ? !batter.notOut : batter.dismissal !== "not out") segment.dismissals += 1;
        }
      }
      for (const bowler of entry.bowling) {
        appearanceIds.add(bowler.id);
        const stats = ensure(bowler.id);
        const balls = bowler.balls ?? (Math.floor(bowler.overs ?? 0) * 6 + Math.round(((bowler.overs ?? 0) % 1) * 10));
        if (balls === 0) continue;
        stats.bowlingInnings += 1;
        stats.bowlBalls += balls;
        stats.conceded += bowler.runsConceded ?? 0;
        stats.wickets += bowler.wickets ?? 0;
        for (const key of bowlingKeys) {
          const segment = segmentFor(stats, key);
          segment.bowlBalls += balls; segment.conceded += bowler.runsConceded ?? 0; segment.wickets += bowler.wickets ?? 0;
        }
      }
    }
    for (const lineup of Object.values(fixture.simulation?.lineups ?? {})) {
      for (const id of [...lineup.startingXI, ...lineup.finalXI]) appearanceIds.add(id);
    }
    appearanceIds.forEach((id) => { ensure(id).matches += 1; });

    if (!fixture.simulation) continue;
    for (const inningsRecord of fixture.simulation.innings) {
      const deliveries = inningsRecord.oversDetail.flatMap((over) => over.deliveries);
      if (!deliveries.length || deliveries.filter((ball) => ball.isLegal).length !== inningsRecord.legalBalls) continue;
      const lastOver = Math.max(20, ...inningsRecord.oversDetail.map((over) => over.number));
      const battingPosition = Object.fromEntries(inningsRecord.batting.map((batter) => [batter.id, batter.battingPosition]));
      for (const ball of deliveries) {
        const phase = ball.overNumber <= 6 ? "powerplay" : ball.overNumber > lastOver - 4 ? "death" : "middle";
        const batter = ensure(ball.strikerId);
        const bowler = ensure(ball.bowlerId);
        if (ball.isLegal || ball.extras.noBalls > 0) {
          batter.phase[phase].runs += ball.runsOffBat;
          if (ball.isLegal) batter.phase[phase].balls += 1;
        }
        bowler.phase[phase].conceded += ball.totalRuns - ball.extras.byes - ball.extras.legByes;
        if (ball.isLegal) {
          bowler.phase[phase].bowlBalls += 1;
          if (ball.totalRuns === 0) bowler.dots += 1;
        }
        if (ball.wicket?.bowlerCredited) bowler.phase[phase].wickets += 1;
        const keys = overSegments(ball.overNumber);
        const position = battingPosition[ball.strikerId];
        const battingKeys = position ? [...keys, ...positionGroups(position).filter((key) => key !== `position:${position}`).flatMap((group) => keys.filter((key) => key.startsWith("overs:")).map((key) => `${group}:${key}`))] : keys;
        const bowlerType = players[ball.bowlerId]?.bowlingStyle;
        if (bowlerType === "Pacer" || bowlerType === "Spinner") battingKeys.push(`vs:${bowlerType === "Pacer" ? "pace" : "spin"}`);
        const batterHand = players[ball.strikerId]?.battingStyle;
        if (batterHand === "Left-hand" || batterHand === "Right-hand") keys.push(`vs:${batterHand === "Left-hand" ? "left" : "right"}`);
        for (const key of battingKeys) {
          const segment = segmentFor(batter, key);
          if (ball.isLegal || ball.extras.noBalls > 0) {
            segment.runs += ball.runsOffBat;
            if (ball.runsOffBat === 4) segment.fours += 1;
            if (ball.runsOffBat === 6) segment.sixes += 1;
            if (ball.isLegal) segment.balls += 1;
          }
        }
        for (const key of keys) {
          const segment = segmentFor(bowler, key);
          segment.conceded += ball.totalRuns - ball.extras.byes - ball.extras.legByes;
          if (ball.isLegal) { segment.bowlBalls += 1; if (ball.totalRuns === 0) segment.dots += 1; }
          if (ball.wicket?.bowlerCredited) segment.wickets += 1;
        }
      }
    }
  }
  return result;
}

export type PlayerMetricKey = string;

export type MetricDefinition = {
  key: PlayerMetricKey; label: string; group: string;
  unit: string; lowerBetter?: boolean; minimum: string;
  qualifies: (totals: PlayerAnalysisTotals) => boolean;
  value: (totals: PlayerAnalysisTotals) => number | null;
};
const ratio = (a: number, b: number, scale = 1) => b > 0 ? a / b * scale : null;
const bat = (key: PlayerMetricKey, label: string, minimum: string, qualifies: MetricDefinition["qualifies"], value: MetricDefinition["value"], unit = ""):
  MetricDefinition => ({ key, label, group: "Batting", unit, minimum, qualifies, value });
const bowl = (key: PlayerMetricKey, label: string, minimum: string, qualifies: MetricDefinition["qualifies"], value: MetricDefinition["value"], unit = "", lowerBetter = false):
  MetricDefinition => ({ key, label, group: "Bowling", unit, minimum, qualifies, value, lowerBetter });

export const PLAYER_METRICS: MetricDefinition[] = [
  bat("matches", "Matches", "1 match", (s) => s.matches >= 1, (s) => s.matches),
  bat("runs", "Runs", "2 batting innings", (s) => s.innings >= 2, (s) => s.runs),
  bat("runsPerMatch", "Runs per match", "4 matches", (s) => s.matches >= 4, (s) => ratio(s.runs, s.matches)),
  bat("batAverage", "Batting average", "4 innings and 2 dismissals", (s) => s.innings >= 4 && s.dismissals >= 2, (s) => ratio(s.runs, s.dismissals)),
  bat("strikeRate", "Strike rate", "60 balls faced", (s) => s.balls >= 60, (s) => ratio(s.runs, s.balls, 100)),
  bat("fours", "Fours", "2 batting innings", (s) => s.innings >= 2, (s) => s.fours),
  bat("sixes", "Sixes", "2 batting innings", (s) => s.innings >= 2, (s) => s.sixes),
  bat("boundaryRate", "Boundary ball %", "60 balls faced", (s) => s.balls >= 60, (s) => ratio(s.fours + s.sixes, s.balls, 100), "%"),
  bat("fifties", "Fifties", "2 batting innings", (s) => s.innings >= 2, (s) => s.fifties),
  bat("hundreds", "Hundreds", "2 batting innings", (s) => s.innings >= 2, (s) => s.hundreds),
  bowl("wickets", "Wickets", "2 bowling innings", (s) => s.bowlingInnings >= 2, (s) => s.wickets),
  bowl("wicketsPerMatch", "Wickets per match", "4 bowling innings", (s) => s.bowlingInnings >= 4, (s) => ratio(s.wickets, s.bowlingInnings)),
  bowl("economy", "Economy", "60 balls bowled", (s) => s.bowlBalls >= 60, (s) => ratio(s.conceded, s.bowlBalls, 6), "", true),
  bowl("bowlAverage", "Bowling average", "60 balls and 2 wickets", (s) => s.bowlBalls >= 60 && s.wickets >= 2, (s) => ratio(s.conceded, s.wickets), "", true),
  bowl("dotRate", "Dot ball %", "60 balls bowled with delivery data", (s) => s.bowlBalls >= 60 && s.phase.powerplay.bowlBalls + s.phase.middle.bowlBalls + s.phase.death.bowlBalls >= 60, (s) => ratio(s.dots, s.phase.powerplay.bowlBalls + s.phase.middle.bowlBalls + s.phase.death.bowlBalls, 100), "%"),
  ...(["powerplay", "middle", "death"] as const).flatMap((phase) => {
    const label = phase === "powerplay" ? "Powerplay" : phase === "middle" ? "Middle overs" : "Death overs";
    const prefix = phase === "middle" ? "middle" : phase;
    return [
      { key: `${prefix}Runs` as PlayerMetricKey, label: `${label} runs`, group: "Batting phases" as const, unit: "", minimum: "12 balls faced in phase", qualifies: (s: PlayerAnalysisTotals) => s.phase[phase].balls >= 12, value: (s: PlayerAnalysisTotals) => s.phase[phase].balls ? s.phase[phase].runs : null },
      { key: `${prefix}StrikeRate` as PlayerMetricKey, label: `${label} strike rate`, group: "Batting phases" as const, unit: "", minimum: "24 balls faced in phase", qualifies: (s: PlayerAnalysisTotals) => s.phase[phase].balls >= 24, value: (s: PlayerAnalysisTotals) => ratio(s.phase[phase].runs, s.phase[phase].balls, 100) },
      { key: `${prefix}Wickets` as PlayerMetricKey, label: `${label} wickets`, group: "Bowling phases" as const, unit: "", minimum: "12 balls bowled in phase", qualifies: (s: PlayerAnalysisTotals) => s.phase[phase].bowlBalls >= 12, value: (s: PlayerAnalysisTotals) => s.phase[phase].bowlBalls ? s.phase[phase].wickets : null },
      { key: `${prefix}Economy` as PlayerMetricKey, label: `${label} economy`, group: "Bowling phases" as const, unit: "", minimum: "24 balls bowled in phase", qualifies: (s: PlayerAnalysisTotals) => s.phase[phase].bowlBalls >= 24, value: (s: PlayerAnalysisTotals) => ratio(s.phase[phase].conceded, s.phase[phase].bowlBalls, 6), lowerBetter: true },
    ];
  }),
];

function segmentMetrics(key: string, label: string, kind: "over" | "position" | "position-over"): MetricDefinition[] {
  const source = (s: PlayerAnalysisTotals) => s.segments[key];
  const over = kind !== "position";
  const minVolume = kind === "over" && key.startsWith("over:") ? 6 : 12;
  const minRate = kind === "over" && key.startsWith("over:") ? 12 : 24;
  const prefix = over ? "Ball by ball" : "Batting position";
  const batting = [
    { suffix: "runs", name: "runs", denominator: "balls", minimum: minVolume, value: (s: SegmentTotals) => s.runs },
    { suffix: "balls", name: "balls faced", denominator: "balls", minimum: minVolume, value: (s: SegmentTotals) => s.balls },
    { suffix: "sr", name: "strike rate", denominator: "balls", minimum: minRate, value: (s: SegmentTotals) => ratio(s.runs, s.balls, 100) },
    { suffix: "fours", name: "fours", denominator: "balls", minimum: minVolume, value: (s: SegmentTotals) => s.fours },
    { suffix: "sixes", name: "sixes", denominator: "balls", minimum: minVolume, value: (s: SegmentTotals) => s.sixes },
    { suffix: "boundary", name: "boundary ball %", denominator: "balls", minimum: minRate, value: (s: SegmentTotals) => ratio(s.fours + s.sixes, s.balls, 100) },
  ].map((item): MetricDefinition => ({
    key: `${key}:${item.suffix}`, label: `${label} ${item.name}`, group: `${prefix} batting`,
    unit: item.suffix === "boundary" ? "%" : "", minimum: `${item.minimum} balls faced in ${label.toLowerCase()}`,
    qualifies: (s) => (source(s)?.balls ?? 0) >= item.minimum,
    value: (s) => source(s)?.balls ? item.value(source(s)!) : null,
  }));
  if (kind !== "over") return batting;
  const bowling = [
    { suffix: "wickets", name: "wickets", minimum: minVolume, value: (s: SegmentTotals) => s.wickets },
    { suffix: "conceded", name: "runs conceded", minimum: minVolume, value: (s: SegmentTotals) => s.conceded },
    { suffix: "bowlBalls", name: "balls bowled", minimum: minVolume, value: (s: SegmentTotals) => s.bowlBalls },
    { suffix: "economy", name: "economy", minimum: minRate, value: (s: SegmentTotals) => ratio(s.conceded, s.bowlBalls, 6), lowerBetter: true },
    { suffix: "dotRate", name: "dot ball %", minimum: minRate, value: (s: SegmentTotals) => ratio(s.dots, s.bowlBalls, 100) },
  ].map((item): MetricDefinition => ({
    key: `${key}:${item.suffix}`, label: `${label} ${item.name}`, group: `${prefix} bowling`,
    unit: item.suffix === "dotRate" ? "%" : "", lowerBetter: item.lowerBetter,
    minimum: `${item.minimum} balls bowled in ${label.toLowerCase()}`,
    qualifies: (s) => (source(s)?.bowlBalls ?? 0) >= item.minimum,
    value: (s) => source(s)?.bowlBalls ? item.value(source(s)!) : null,
  }));
  return [...batting, ...bowling];
}

for (let over = 1; over <= 20; over += 1) PLAYER_METRICS.push(...segmentMetrics(`over:${over}`, `Over ${over}`, "over"));
for (const [start, end] of overRanges) PLAYER_METRICS.push(...segmentMetrics(`overs:${start}-${end}`, `Overs ${start}–${end}`, "over"));
for (let position = 1; position <= 11; position += 1) PLAYER_METRICS.push(...segmentMetrics(`position:${position}`, `Batting at No. ${position}`, "position"));
for (const [key, label] of [["1-2", "Batting at Nos. 1–2"], ["3-5", "Batting at Nos. 3–5"], ["6plus", "Batting at No. 6 or lower"]]) {
  PLAYER_METRICS.push(...segmentMetrics(`position:${key}`, label, "position"));
  for (const [start, end] of overRanges.slice(0, 4)) {
    PLAYER_METRICS.push(...segmentMetrics(`position:${key}:overs:${start}-${end}`, `${label} in overs ${start}–${end}`, "position-over"));
  }
}
for (const [key, label] of [["innings:1", "Batting or bowling first"], ["innings:2", "Batting or bowling second"], ["result:win", "In wins"], ["result:loss", "In losses"]]) {
  PLAYER_METRICS.push(...segmentMetrics(key, label, "over"));
}
PLAYER_METRICS.push(...segmentMetrics("vs:pace", "Against pace", "over").filter((metric) => metric.group.endsWith("batting")));
PLAYER_METRICS.push(...segmentMetrics("vs:spin", "Against spin", "over").filter((metric) => metric.group.endsWith("batting")));
PLAYER_METRICS.push(...segmentMetrics("vs:left", "Bowling to left-hand batters", "over").filter((metric) => metric.group.endsWith("bowling")));
PLAYER_METRICS.push(...segmentMetrics("vs:right", "Bowling to right-hand batters", "over").filter((metric) => metric.group.endsWith("bowling")));

export const metricByKey = Object.fromEntries(PLAYER_METRICS.map((metric) => [metric.key, metric])) as Record<PlayerMetricKey, MetricDefinition>;
