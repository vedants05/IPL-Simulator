"use client";

import type { Player, Team } from "@/lib/types";
import type { MatchSimulationRecord } from "@/lib/logic/matchSimulation";

type Fixture = {
  id: string;
  played: boolean;
  simulation?: MatchSimulationRecord;
};
type TeamLine = {
  teamId: string;
  matches: number;
  value: number;
  wickets?: number;
  wicketShare?: number;
};
type PlayerContribution = {
  playerId: string;
  name: string;
  value: number;
};
type PlayerAbilityOutputPoint = {
  playerId: string;
  name: string;
  teamId: string;
  output: number;
  ability: number;
};

const phaseDeliveries = (
  record: MatchSimulationRecord,
  inningsIndex: number,
  phase: "powerplay" | "death" | "middle",
) => {
  const innings = record.innings[inningsIndex];
  const lastOver = Math.max(
    ...innings.oversDetail.map((over) => over.number),
    20,
  );
  return innings.oversDetail
    .flatMap((over) => over.deliveries)
    .filter((delivery) =>
      phase === "powerplay"
        ? delivery.overNumber <= 6
        : phase === "death"
          ? delivery.overNumber > lastOver - 4
          : delivery.overNumber > 6 && delivery.overNumber <= lastOver - 4,
    );
};

type QuadrantChart = {
  title: string;
  note: string;
  xLabel: string;
  yLabel: string;
  xLowerBetter?: boolean;
  yLowerBetter?: boolean;
  labels: [string, string, string, string];
  points: Array<{ teamId: string; x: number; y: number }>;
};

function QuadrantComparison({
  chart,
  teams,
  userTeamId,
}: {
  chart: QuadrantChart;
  teams: Record<string, Team>;
  userTeamId: string;
}) {
  const xs = chart.points.map((point) => point.x);
  const ys = chart.points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xAverage = xs.reduce((sum, value) => sum + value, 0) / Math.max(xs.length, 1);
  const yAverage = ys.reduce((sum, value) => sum + value, 0) / Math.max(ys.length, 1);
  const position = (value: number, min: number, max: number) =>
    6 + ((value - min) / Math.max(max - min, 0.01)) * 88;
  const xPosition = (value: number) =>
    chart.xLowerBetter ? 100 - position(value, xMin, xMax) : position(value, xMin, xMax);
  const yPosition = (value: number) =>
    chart.yLowerBetter ? position(value, yMin, yMax) : 100 - position(value, yMin, yMax);
  const xTicks = chart.xLowerBetter
    ? [xMax, (xMin + xMax) / 2, xMin]
    : [xMin, (xMin + xMax) / 2, xMax];
  const yTicks = chart.yLowerBetter
    ? [yMin, (yMin + yMax) / 2, yMax]
    : [yMax, (yMin + yMax) / 2, yMin];
  const chartOrder = chart.title.startsWith("Powerplay")
    ? chart.title.includes("Run Rate")
      ? "order-1"
      : "order-4"
    : chart.title.startsWith("Middle")
      ? chart.title.includes("Run Rate")
        ? "order-2"
        : "order-5"
      : "order-6";

  return (
    <section
      className={`relative col-span-4 overflow-visible rounded-lg border border-border bg-bg p-3 hover:z-40 ${chartOrder}`}
    >
      <div className="mb-2 border-b border-border/40 pb-1.5">
        <div className="flex items-center justify-between">
          <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">{chart.title}</h3>
          <span className="font-space-mono text-[7px] font-bold uppercase text-accent">Two-way team comparison</span>
        </div>
        <p className="font-space-mono text-[9px] text-text-secondary">{chart.note}</p>
      </div>
      <div className="grid grid-cols-[28px_32px_minmax(0,1fr)] gap-2 font-space-mono text-[9px]">
        <div className="flex items-center justify-center [writing-mode:vertical-rl] rotate-180 font-bold uppercase tracking-wider text-text-secondary">{chart.yLabel}</div>
        <div className="relative h-[260px] text-[7px] text-text-secondary">
          <span className="absolute right-0 top-[6%] -translate-y-1/2">{yTicks[0].toFixed(1)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{yTicks[1].toFixed(1)}</span>
          <span className="absolute bottom-[6%] right-0 translate-y-1/2">{yTicks[2].toFixed(1)}</span>
        </div>
        <div>
          <div className="relative h-[260px] overflow-visible border border-border bg-surface/5">
            <div className="absolute inset-y-0 border-l border-dashed border-accent/50" style={{ left: `${xPosition(xAverage)}%` }} />
            <div className="absolute inset-x-0 border-t border-dashed border-accent/50" style={{ top: `${yPosition(yAverage)}%` }} />
            <span className="pointer-events-none absolute left-3 top-3 z-20 uppercase text-white">{chart.labels[0]}</span>
            <span className="pointer-events-none absolute right-3 top-3 z-20 text-right uppercase text-success">{chart.labels[1]}</span>
            <span className="pointer-events-none absolute bottom-3 left-3 z-20 uppercase text-danger">{chart.labels[2]}</span>
            <span className="pointer-events-none absolute bottom-3 right-3 z-20 text-right uppercase text-white">{chart.labels[3]}</span>
            {chart.points.map((point) => {
              const pointX = xPosition(point.x);
              const pointY = yPosition(point.y);
              const horizontalTooltip =
                pointX < 25
                  ? "left-0 translate-x-0"
                  : pointX > 75
                    ? "right-0 translate-x-0"
                    : "left-1/2 -translate-x-1/2";
              const verticalTooltip =
                pointY < 35 ? "top-full mt-2" : "bottom-full mb-2";
              return (
              <div key={point.teamId} className={`group absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[7px] text-white shadow-md hover:z-50 ${point.teamId === userTeamId ? "ring-2 ring-accent ring-offset-1 ring-offset-bg" : ""}`} style={{ left: `${pointX}%`, top: `${pointY}%`, backgroundColor: teams[point.teamId]?.primaryColor ?? "#555" }}>
                {teams[point.teamId]?.shortName ?? point.teamId}
                <span className={`pointer-events-none invisible absolute z-50 min-w-[190px] max-w-[280px] rounded border border-border bg-bg px-3 py-2 text-left text-[8px] leading-4 text-text-primary opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 ${horizontalTooltip} ${verticalTooltip}`}>
                  <span className="block whitespace-normal font-bold">{teams[point.teamId]?.name ?? point.teamId}</span>
                  <span className="mt-1 block whitespace-normal text-text-secondary">{chart.xLabel}: {point.x.toFixed(2)}</span>
                  <span className="block whitespace-normal text-text-secondary">{chart.yLabel}: {point.y.toFixed(2)}</span>
                </span>
              </div>
              );
            })}
          </div>
          <div className="relative h-4 text-[7px] text-text-secondary">
            <span className="absolute left-[6%] -translate-x-1/2">{xTicks[0].toFixed(1)}</span>
            <span className="absolute left-1/2 -translate-x-1/2">{xTicks[1].toFixed(1)}</span>
            <span className="absolute right-[6%] translate-x-1/2">{xTicks[2].toFixed(1)}</span>
          </div>
          <div className="pt-2 text-center font-bold uppercase tracking-wider text-text-secondary">{chart.xLabel}</div>
          <div className="text-center text-[7px] text-text-secondary">League averages: {xAverage.toFixed(2)} · {yAverage.toFixed(2)}</div>
        </div>
      </div>
    </section>
  );
}

function PlayerAbilityOutputChart({
  points,
  teams,
  userTeamId,
  yLabel,
  xLabel,
  outputLabel,
  abilityLabel,
  emptyMessage,
}: {
  points: PlayerAbilityOutputPoint[];
  teams: Record<string, Team>;
  userTeamId: string;
  yLabel: string;
  xLabel: string;
  outputLabel: string;
  abilityLabel: string;
  emptyMessage: string;
}) {
  const abilities = points.map((point) => point.ability);
  const maximumOutput = Math.max(1, ...points.map((point) => point.output));
  const xMin = abilities.length > 0 ? Math.min(...abilities) : 0;
  const xMax = abilities.length > 0 ? Math.max(...abilities) : 100;
  const yStep = maximumOutput > 100 ? 100 : maximumOutput > 20 ? 10 : 5;
  const yMax = Math.max(yStep, Math.ceil(maximumOutput / yStep) * yStep);
  const xTicks = Array.from({ length: 6 }, (_, index) => xMin + ((xMax - xMin) * index) / 5);
  const yTicks = Array.from({ length: 6 }, (_, index) => yMax - (yMax * index) / 5);
  const xPosition = (ability: number) => ((ability - xMin) / Math.max(1, xMax - xMin)) * 100;
  const yPosition = (runs: number) => (1 - runs / yMax) * 100;
  const regression = (() => {
    if (points.length < 2) return undefined;
    const meanAbility = abilities.reduce((sum, ability) => sum + ability, 0) / points.length;
    const meanOutput = points.reduce((sum, point) => sum + point.output, 0) / points.length;
    const denominator = points.reduce(
      (sum, point) => sum + Math.pow(point.ability - meanAbility, 2),
      0,
    );
    if (denominator === 0) return undefined;
    const slope = points.reduce(
      (sum, point) => sum + (point.ability - meanAbility) * (point.output - meanOutput),
      0,
    ) / denominator;
    const intercept = meanOutput - slope * meanAbility;
    return {
      x1: xPosition(xMin),
      y1: yPosition(intercept + slope * xMin),
      x2: xPosition(xMax),
      y2: yPosition(intercept + slope * xMax),
    };
  })();

  return (
    <div className="grid grid-cols-[34px_42px_minmax(0,1fr)] gap-2 px-4 pb-5 pt-4 font-space-mono text-[9px] sm:px-6">
      <div className="flex items-center justify-center [writing-mode:vertical-rl] rotate-180 font-bold uppercase tracking-wider text-text-secondary">
        {yLabel}
      </div>
      <div className="relative h-[480px] text-[8px] text-text-secondary">
        {yTicks.map((tick, index) => (
          <span
            key={tick}
            className="absolute right-0 -translate-y-1/2"
            style={{ top: `${index * 20}%` }}
          >
            {Math.round(tick)}
          </span>
        ))}
      </div>
      <div className="min-w-0">
        <div className="relative h-[480px] border border-border bg-surface/5">
          {xTicks.map((tick, index) => (
            <div
              key={`x-${tick}`}
              className="absolute inset-y-0 border-l border-dashed border-border/50"
              style={{ left: `${index * 20}%` }}
            />
          ))}
          {yTicks.map((tick, index) => (
            <div
              key={`y-${tick}`}
              className="absolute inset-x-0 border-t border-dashed border-border/50"
              style={{ top: `${index * 20}%` }}
            />
          ))}
          {regression && (
            <svg
              className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-hidden"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-label="Ordinary least squares regression line"
            >
              <line
                x1={regression.x1}
                y1={regression.y1}
                x2={regression.x2}
                y2={regression.y2}
                stroke="currentColor"
                strokeWidth="0.45"
                strokeDasharray="1.5 1"
                vectorEffect="non-scaling-stroke"
                className="text-text-primary/70"
              />
            </svg>
          )}
          {points.map((point) => {
            const pointX = xPosition(point.ability);
            const pointY = yPosition(point.output);
            const tooltipX = pointX < 18
              ? "left-0"
              : pointX > 82
                ? "right-0"
                : "left-1/2 -translate-x-1/2";
            const tooltipY = pointY < 30 ? "top-full mt-2" : "bottom-full mb-2";
            return (
              <div
                key={point.playerId}
                className={`group absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow hover:z-50 hover:scale-150 ${
                  point.teamId === userTeamId ? "ring-2 ring-accent ring-offset-1 ring-offset-bg" : ""
                }`}
                style={{
                  left: `${pointX}%`,
                  top: `${pointY}%`,
                  backgroundColor: teams[point.teamId]?.primaryColor ?? "#666",
                }}
              >
                <span className={`pointer-events-none invisible absolute z-50 min-w-[190px] rounded border border-border bg-bg px-3 py-2 text-left text-[8px] leading-4 text-text-primary opacity-0 shadow-xl group-hover:visible group-hover:opacity-100 ${tooltipX} ${tooltipY}`}>
                  <span className="block font-bold">{point.name}</span>
                  <span className="block text-text-secondary">{teams[point.teamId]?.name ?? point.teamId}</span>
                  <span className="mt-1 block text-accent">{abilityLabel}: {point.ability}</span>
                  <span className="block text-text-secondary">{outputLabel}: {point.output}</span>
                </span>
              </div>
            );
          })}
          {points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-wider text-text-secondary">
              {emptyMessage}
            </div>
          )}
        </div>
        <div className="relative h-5 text-[8px] text-text-secondary">
          {xTicks.map((tick, index) => (
            <span
              key={tick}
              className="absolute -translate-x-1/2 pt-1"
              style={{ left: `${index * 20}%` }}
            >
              {Math.round(tick)}
            </span>
          ))}
        </div>
        <div className="pt-2 text-center font-bold uppercase tracking-wider text-text-secondary">
          {xLabel}
        </div>
      </div>
    </div>
  );
}

export default function SeasonDataAnalysisPage({
  fixtures,
  teams,
  players,
  seasonStartBattingAbilities,
  seasonStartBowlingAbilities,
  userTeamId,
}: {
  fixtures: Fixture[];
  teams: Record<string, Team>;
  players: Record<string, Player>;
  seasonStartBattingAbilities: Record<string, number>;
  seasonStartBowlingAbilities: Record<string, number>;
  userTeamId: string;
}) {
  const completedScorecards = fixtures.filter(
    (fixture) => fixture.played && fixture.simulation,
  );
  const records = completedScorecards
    .filter((fixture) =>
      fixture.simulation!.innings.every(
        (innings) =>
          innings.oversDetail.length > 0 &&
          innings.oversDetail
            .flatMap((over) => over.deliveries)
            .filter((delivery) => delivery.isLegal).length ===
            innings.legalBalls,
      ),
    )
    .map((fixture) => fixture.simulation!);
  const teamIds = Object.keys(teams);
  const matches = (teamId: string) =>
    records.filter((record) =>
      record.innings.some((innings) => innings.battingTeamId === teamId),
    ).length;
  const sumPhase = (
    teamId: string,
    phase: "powerplay" | "death" | "middle",
    kind: "runs" | "wickets" | "balls" | "dots",
  ) =>
    records.reduce(
      (sum, record) =>
        record.innings.reduce((inningsSum, innings, index) => {
          const deliveries =
            innings.battingTeamId === teamId || innings.bowlingTeamId === teamId
              ? phaseDeliveries(record, index, phase)
              : [];
          if (kind === "runs" && innings.battingTeamId === teamId)
            return (
              inningsSum +
              deliveries.reduce((value, ball) => value + ball.totalRuns, 0)
            );
          if (kind === "wickets" && innings.bowlingTeamId === teamId)
            return (
              inningsSum +
              deliveries.filter((ball) => ball.wicket?.bowlerCredited).length
            );
          if (kind === "balls" && innings.bowlingTeamId === teamId)
            return (
              inningsSum + deliveries.filter((ball) => ball.isLegal).length
            );
          if (kind === "dots" && innings.bowlingTeamId === teamId)
            return (
              inningsSum +
              deliveries.filter((ball) => ball.isLegal && ball.totalRuns === 0)
                .length
            );
          return inningsSum;
        }, 0),
      0,
    );
  const phaseRunsConceded = (
    teamId: string,
    phase: "powerplay" | "death" | "middle",
  ) =>
    records.reduce(
      (sum, record) =>
        record.innings.reduce(
          (inningsSum, innings, index) =>
            innings.bowlingTeamId === teamId
              ? inningsSum +
                phaseDeliveries(record, index, phase).reduce(
                  (value, ball) =>
                    value +
                    ball.totalRuns -
                    ball.extras.byes -
                    ball.extras.legByes,
                  0,
                )
              : inningsSum,
          0,
        ),
      0,
    );
  const lines = (
    value: (teamId: string) => number,
    descending = true,
  ): TeamLine[] =>
    teamIds
      .map((teamId) => ({
        teamId,
        matches: matches(teamId),
        value: value(teamId),
      }))
      .sort((a, b) => (descending ? b.value - a.value : a.value - b.value));
  const perMatch = (teamId: string, value: number) =>
    value / Math.max(matches(teamId), 1);
  const economy = (teamId: string, phase: "powerplay" | "death" | "middle") =>
    phaseRunsConceded(teamId, phase) /
    Math.max(sumPhase(teamId, phase, "balls") / 6, 1);
  const bowlingTypeWickets = (teamId: string, style: "Spinner" | "Pacer") =>
    records.reduce(
      (sum, record) =>
        record.innings.reduce(
          (inningsSum, innings) =>
            innings.bowlingTeamId === teamId
              ? inningsSum +
                innings.oversDetail
                  .flatMap((over) => over.deliveries)
                  .filter(
                    (ball) =>
                      ball.wicket?.bowlerCredited &&
                      players[ball.bowlerId]?.bowlingStyle === style,
                  ).length
              : inningsSum,
          0,
        ),
      0,
    );
  const seasonBowlingTypeWicketLines = (
    style: "Spinner" | "Pacer",
  ): TeamLine[] =>
    teamIds
      .map((teamId) => {
        const wicketDeliveries = records.flatMap((record) =>
          record.innings
            .filter((innings) => innings.bowlingTeamId === teamId)
            .flatMap((innings) => innings.oversDetail)
            .flatMap((over) => over.deliveries)
            .filter((delivery) => delivery.wicket?.bowlerCredited),
        );
        const styleWickets = wicketDeliveries.filter((delivery) => {
          const bowler = players[delivery.bowlerId];
          const bowlerStyle =
            bowler?.bowlingStyle ??
            (bowler?.role === "Spin Bowler"
              ? "Spinner"
              : bowler?.role === "Pace Bowler"
                ? "Pacer"
                : null);
          return bowlerStyle === style;
        }).length;
        return {
          teamId,
          matches: matches(teamId),
          value: styleWickets,
          wickets: styleWickets,
          wicketShare: wicketDeliveries.length
            ? (styleWickets * 100) / wicketDeliveries.length
            : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
  const openerRuns = (teamId: string) =>
    records.reduce(
      (sum, record) =>
        sum +
        record.innings
          .filter((innings) => innings.battingTeamId === teamId)
          .reduce((inningsSum, innings) => {
            const openerIds = new Set(
              innings.batting
                .filter((entry) => entry.battingPosition <= 2)
                .map((entry) => entry.id),
            );
            return (
              inningsSum +
              innings.oversDetail
                .flatMap((over) => over.deliveries)
                .filter((ball) => openerIds.has(ball.strikerId))
                .reduce((value, ball) => value + ball.runsOffBat, 0)
            );
          }, 0),
      0,
    );
  const playerContributions = (
    title: string,
    teamId: string,
  ): PlayerContribution[] => {
    const totals = new Map<string, PlayerContribution>();
    const add = (playerId: string, fallbackName: string, value: number) => {
      if (value <= 0) return;
      const current = totals.get(playerId);
      totals.set(playerId, {
        playerId,
        name: players[playerId]?.name ?? fallbackName,
        value: (current?.value ?? 0) + value,
      });
    };

    if (title === "Opening runs") {
      records.forEach((record) => {
        record.innings
          .filter((innings) => innings.battingTeamId === teamId)
          .forEach((innings) => {
            const openerIds = new Set(
              innings.batting
                .filter((entry) => entry.battingPosition <= 2)
                .map((entry) => entry.id),
            );
            innings.oversDetail
              .flatMap((over) => over.deliveries)
              .filter((delivery) => openerIds.has(delivery.strikerId))
              .forEach((delivery) => add(
                delivery.strikerId,
                delivery.strikerName,
                delivery.runsOffBat,
              ));
          });
      });
    }

    if (title === "Spin wickets" || title === "Pace wickets") {
      const requiredStyle = title === "Spin wickets" ? "Spinner" : "Pacer";
      records.forEach((record) => {
        record.innings
          .filter((innings) => innings.bowlingTeamId === teamId)
          .flatMap((innings) => innings.oversDetail)
          .flatMap((over) => over.deliveries)
          .filter((delivery) => delivery.wicket?.bowlerCredited)
          .forEach((delivery) => {
            const bowler = players[delivery.bowlerId];
            const style = bowler?.bowlingStyle ?? (
              bowler?.role === "Spin Bowler"
                ? "Spinner"
                : bowler?.role === "Pace Bowler"
                  ? "Pacer"
                  : null
            );
            if (style === requiredStyle) {
              add(delivery.bowlerId, delivery.bowlerName, 1);
            }
          });
      });
    }

    return Array.from(totals.values()).sort((left, right) =>
      right.value - left.value || left.name.localeCompare(right.name),
    );
  };
  const winPct = (teamId: string, chase: boolean) => {
    const sample = records.filter(
      (record) =>
        (chase ? record.bowlingFirstTeamId : record.battingFirstTeamId) ===
        teamId,
    );
    return sample.length
      ? (sample.filter((record) => record.winnerId === teamId).length * 100) /
          sample.length
      : 0;
  };
  const winLines = (chase: boolean): TeamLine[] =>
    teamIds
      .map((teamId) => {
        const sample = records.filter(
          (record) =>
            (chase ? record.bowlingFirstTeamId : record.battingFirstTeamId) ===
            teamId,
        );
        return { teamId, matches: sample.length, value: winPct(teamId, chase) };
      })
      .sort((a, b) => b.value - a.value);
  const boundaryPct = (teamId: string) => {
    let runs = 0;
    let boundaries = 0;
    records.forEach((record) =>
      record.innings
        .filter((innings) => innings.battingTeamId === teamId)
        .forEach((innings) =>
          innings.oversDetail
            .flatMap((over) => over.deliveries)
            .forEach((ball) => {
              runs += ball.runsOffBat;
              if (ball.runsOffBat === 4 || ball.runsOffBat === 6)
                boundaries += ball.runsOffBat;
            }),
        ),
    );
    return runs ? (boundaries * 100) / runs : 0;
  };
  const powerplayRunLines: TeamLine[] = teamIds
    .map((teamId) => {
      const inningsScores = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.battingTeamId === teamId)
        .map(
          (innings) =>
            innings.oversDetail.find((over) => over.number === 6)?.scoreAfter,
        )
        .filter((score): score is number => score !== undefined);
      return {
        teamId,
        matches: inningsScores.length,
        value: inningsScores.length
          ? inningsScores.reduce((sum, score) => sum + score, 0) /
            inningsScores.length
          : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
  const powerplayWicketLines: TeamLine[] = teamIds
    .map((teamId) => {
      const inningsWickets = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId)
        .map((innings) => {
          const powerplayOvers = innings.oversDetail.filter(
            (over) => over.number <= 6,
          );
          return powerplayOvers.at(-1)?.wicketsAfter;
        })
        .filter((wickets): wickets is number => wickets !== undefined);
      return {
        teamId,
        matches: inningsWickets.length,
        value: inningsWickets.length
          ? inningsWickets.reduce((sum, wickets) => sum + wickets, 0) /
            inningsWickets.length
          : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
  const powerplayEconomyLines: TeamLine[] = teamIds
    .map((teamId) => {
      const inningsEconomies = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId)
        .map((innings) => {
          const deliveries = innings.oversDetail
            .filter((over) => over.number <= 6)
            .flatMap((over) => over.deliveries);
          const legalBalls = deliveries.filter(
            (delivery) => delivery.isLegal,
          ).length;
          if (legalBalls === 0) return undefined;
          const bowlerRunsConceded = deliveries.reduce(
            (sum, delivery) =>
              sum +
              delivery.totalRuns -
              delivery.extras.byes -
              delivery.extras.legByes,
            0,
          );
          return bowlerRunsConceded / (legalBalls / 6);
        })
        .filter((value): value is number => value !== undefined);
      return {
        teamId,
        matches: inningsEconomies.length,
        value: inningsEconomies.length
          ? inningsEconomies.reduce((sum, value) => sum + value, 0) /
            inningsEconomies.length
          : 0,
      };
    })
    .sort((a, b) => a.value - b.value);
  const deathOverRunRateLines: TeamLine[] = teamIds
    .map((teamId) => {
      const battingInnings = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.battingTeamId === teamId);
      const deliveries = battingInnings
        .flatMap((innings) => innings.oversDetail)
        .filter((over) => over.number >= 17 && over.number <= 20)
        .flatMap((over) => over.deliveries);
      const legalBalls = deliveries.filter(
        (delivery) => delivery.isLegal,
      ).length;
      const runs = deliveries.reduce(
        (sum, delivery) => sum + delivery.totalRuns,
        0,
      );
      return {
        teamId,
        matches: battingInnings.length,
        value: legalBalls ? runs / (legalBalls / 6) : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
  const deathWicketLines: TeamLine[] = teamIds
    .map((teamId) => {
      const inningsWickets = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId)
        .map((innings) =>
          innings.oversDetail
            .filter((over) => over.number >= 17 && over.number <= 20)
            .reduce((sum, over) => sum + over.wickets, 0),
        );
      return {
        teamId,
        matches: inningsWickets.length,
        value: inningsWickets.length
          ? inningsWickets.reduce((sum, value) => sum + value, 0) /
            inningsWickets.length
          : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
  const deathEconomyLines: TeamLine[] = teamIds
    .map((teamId) => {
      const inningsEconomies = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId)
        .map((innings) => {
          const deliveries = innings.oversDetail
            .filter((over) => over.number >= 17 && over.number <= 20)
            .flatMap((over) => over.deliveries);
          const legalBalls = deliveries.filter(
            (delivery) => delivery.isLegal,
          ).length;
          if (legalBalls === 0) return undefined;
          const bowlerRunsConceded = deliveries.reduce(
            (sum, delivery) =>
              sum +
              delivery.totalRuns -
              delivery.extras.byes -
              delivery.extras.legByes,
            0,
          );
          return bowlerRunsConceded / (legalBalls / 6);
        })
        .filter((value): value is number => value !== undefined);
      return {
        teamId,
        matches: inningsEconomies.length,
        value: inningsEconomies.length
          ? inningsEconomies.reduce((sum, value) => sum + value, 0) /
            inningsEconomies.length
          : 0,
      };
    })
    .sort((a, b) => {
      if (a.matches === 0) return 1;
      if (b.matches === 0) return -1;
      return a.value - b.value;
    });
  const middleOverEconomyLines: TeamLine[] = teamIds
    .map((teamId) => {
      const inningsEconomies = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId)
        .map((innings) => {
          const deliveries = innings.oversDetail
            .filter((over) => over.number >= 7 && over.number <= 16)
            .flatMap((over) => over.deliveries);
          const legalBalls = deliveries.filter(
            (delivery) => delivery.isLegal,
          ).length;
          if (legalBalls === 0) return undefined;
          const bowlerRunsConceded = deliveries.reduce(
            (sum, delivery) =>
              sum +
              delivery.totalRuns -
              delivery.extras.byes -
              delivery.extras.legByes,
            0,
          );
          return bowlerRunsConceded / (legalBalls / 6);
        })
        .filter((value): value is number => value !== undefined);
      return {
        teamId,
        matches: inningsEconomies.length,
        value: inningsEconomies.length
          ? inningsEconomies.reduce((sum, value) => sum + value, 0) /
            inningsEconomies.length
          : 0,
      };
    })
    .sort((a, b) => {
      if (a.matches === 0) return 1;
      if (b.matches === 0) return -1;
      return a.value - b.value;
    });
  const middleOverRunRateLines: TeamLine[] = teamIds
    .map((teamId) => {
      const battingInnings = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.battingTeamId === teamId);
      const deliveries = battingInnings
        .flatMap((innings) => innings.oversDetail)
        .filter((over) => over.number >= 7 && over.number <= 16)
        .flatMap((over) => over.deliveries);
      const legalBalls = deliveries.filter(
        (delivery) => delivery.isLegal,
      ).length;
      const runs = deliveries.reduce(
        (sum, delivery) => sum + delivery.totalRuns,
        0,
      );
      return {
        teamId,
        matches: battingInnings.length,
        value: legalBalls ? runs / (legalBalls / 6) : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
  const middleOverWicketLines: TeamLine[] = teamIds
    .map((teamId) => {
      const bowlingInnings = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId);
      const wickets = bowlingInnings.reduce(
        (total, innings) =>
          total +
          innings.oversDetail
            .filter((over) => over.number >= 7 && over.number <= 16)
            .flatMap((over) => over.deliveries)
            .filter((delivery) => delivery.wicket?.bowlerCredited).length,
        0,
      );
      return {
        teamId,
        matches: bowlingInnings.length,
        value: bowlingInnings.length ? wickets / bowlingInnings.length : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
  const powerplayDotBallLines: TeamLine[] = teamIds
    .map((teamId) => {
      const deliveries = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId)
        .flatMap((innings) => innings.oversDetail)
        .filter((over) => over.number >= 1 && over.number <= 6)
        .flatMap((over) => over.deliveries)
        .filter((delivery) => delivery.isLegal);
      const dotBalls = deliveries.filter(
        (delivery) => delivery.totalRuns === 0,
      ).length;
      return {
        teamId,
        matches: matches(teamId),
        value: deliveries.length ? (dotBalls * 100) / deliveries.length : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
  const deathDotBallLines: TeamLine[] = teamIds
    .map((teamId) => {
      const bowlingInnings = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId);
      const deliveries = bowlingInnings
        .flatMap((innings) => innings.oversDetail)
        .filter((over) => over.number >= 17 && over.number <= 20)
        .flatMap((over) => over.deliveries)
        .filter((delivery) => delivery.isLegal);
      const dotBalls = deliveries.filter(
        (delivery) => delivery.totalRuns === 0,
      ).length;
      return {
        teamId,
        matches: bowlingInnings.length,
        value: deliveries.length ? (dotBalls * 100) / deliveries.length : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
  const middleOverDotBallLines: TeamLine[] = teamIds
    .map((teamId) => {
      const bowlingInnings = records
        .flatMap((record) => record.innings)
        .filter((innings) => innings.bowlingTeamId === teamId);
      const deliveries = bowlingInnings
        .flatMap((innings) => innings.oversDetail)
        .filter((over) => over.number >= 7 && over.number <= 16)
        .flatMap((over) => over.deliveries)
        .filter((delivery) => delivery.isLegal);
      const dotBalls = deliveries.filter(
        (delivery) => delivery.totalRuns === 0,
      ).length;
      return {
        teamId,
        matches: bowlingInnings.length,
        value: deliveries.length ? (dotBalls * 100) / deliveries.length : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const sections: Array<{
    title: string;
    note: string;
    rows: TeamLine[];
    format: (value: number) => string;
    wicketBreakdown?: boolean;
  }> = [
    {
      title: "Powerplay runs",
      note: "Average team runs in overs 1–6",
      rows: lines((id) => perMatch(id, sumPhase(id, "powerplay", "runs"))),
      format: (v) => v.toFixed(1),
    },
    {
      title: "Powerplay wickets",
      note: "Average wickets taken in overs 1–6",
      rows: lines((id) => perMatch(id, sumPhase(id, "powerplay", "wickets"))),
      format: (v) => v.toFixed(2),
    },
    {
      title: "Powerplay economy",
      note: "Runs conceded per six legal balls",
      rows: lines((id) => economy(id, "powerplay"), false),
      format: (v) => v.toFixed(2),
    },
    {
      title: "Death runs",
      note: "Average batting output in the final four overs",
      rows: lines((id) => perMatch(id, sumPhase(id, "death", "runs"))),
      format: (v) => v.toFixed(1),
    },
    {
      title: "Death wickets",
      note: "Average wickets taken in the final four overs",
      rows: lines((id) => perMatch(id, sumPhase(id, "death", "wickets"))),
      format: (v) => v.toFixed(2),
    },
    {
      title: "Death economy",
      note: "Runs conceded per six legal balls",
      rows: lines((id) => economy(id, "death"), false),
      format: (v) => v.toFixed(2),
    },
    {
      title: "Spin wickets",
      note: "Bowler-credited wickets taken by spinners",
      rows: lines((id) => bowlingTypeWickets(id, "Spinner")),
      format: (v) => v.toFixed(0),
    },
    {
      title: "Pace wickets",
      note: "Bowler-credited wickets taken by pacers",
      rows: lines((id) => bowlingTypeWickets(id, "Pacer")),
      format: (v) => v.toFixed(0),
    },
    {
      title: "Opening runs",
      note: "Runs scored by batting positions one and two",
      rows: lines((id) => openerRuns(id)),
      format: (v) => v.toFixed(0),
    },
    {
      title: "Batting-first win rate",
      note: "Wins when setting a target; Matches is the batting-first sample",
      rows: winLines(false),
      format: (v) => `${v.toFixed(1)}%`,
    },
    {
      title: "Chasing win rate",
      note: "Wins when batting second; Matches is the chasing sample",
      rows: winLines(true),
      format: (v) => `${v.toFixed(1)}%`,
    },
    {
      title: "Middle-over economy",
      note: "Bowling control between powerplay and death",
      rows: lines((id) => economy(id, "middle"), false),
      format: (v) => v.toFixed(2),
    },
    {
      title: "Powerplay dot-ball rate",
      note: "Legal powerplay balls yielding zero runs",
      rows: lines(
        (id) =>
          (sumPhase(id, "powerplay", "dots") * 100) /
          Math.max(sumPhase(id, "powerplay", "balls"), 1),
      ),
      format: (v) => `${v.toFixed(1)}%`,
    },
    {
      title: "Boundary dependency",
      note: "Percentage of batting runs scored in boundaries",
      rows: lines((id) => boundaryPct(id)),
      format: (v) => `${v.toFixed(1)}%`,
    },
  ];
  sections[0] = {
    title: "Powerplay runs",
    note: "Average team score at the end of the sixth over",
    rows: powerplayRunLines,
    format: (value) => value.toFixed(1),
  };
  sections[1] = {
    title: "Powerplay wickets",
    note: "Average wickets taken by the end of the sixth over per match",
    rows: powerplayWicketLines,
    format: (value) => value.toFixed(2),
  };
  sections[2] = {
    title: "Powerplay economy",
    note: "Average runs conceded per over in overs 1–6 of each bowling innings",
    rows: powerplayEconomyLines,
    format: (value) => value.toFixed(2),
  };
  sections[3] = {
    title: "Death-overs RR",
    note: "Season run rate from balls actually faced in overs 17–20",
    rows: deathOverRunRateLines,
    format: (value) => value.toFixed(2),
  };
  sections[4] = {
    title: "Death wickets",
    note: "Average wickets taken per match in overs 17–20 of the bowling innings",
    rows: deathWicketLines,
    format: (value) => value.toFixed(2),
  };
  sections[5] = {
    title: "Death economy",
    note: "Average runs conceded per over in overs 17–20 of each bowling innings",
    rows: deathEconomyLines,
    format: (value) => value.toFixed(2),
  };
  sections[6] = {
    title: "Spin wickets",
    note: "Spin wickets and their share of all bowler-credited wickets",
    rows: seasonBowlingTypeWicketLines("Spinner"),
    format: (value) => value.toFixed(0),
    wicketBreakdown: true,
  };
  sections[7] = {
    title: "Pace wickets",
    note: "Pace wickets and their share of all bowler-credited wickets",
    rows: seasonBowlingTypeWicketLines("Pacer"),
    format: (value) => value.toFixed(0),
    wicketBreakdown: true,
  };
  sections[11] = {
    title: "Middle-over economy",
    note: "Average runs conceded per over in overs 7–16 of each bowling innings",
    rows: middleOverEconomyLines,
    format: (value) => value.toFixed(2),
  };
  sections[12] = {
    title: "Powerplay dot-ball rate",
    note: "Percentage of all legal balls bowled in overs 1–6 this season that conceded zero runs",
    rows: powerplayDotBallLines,
    format: (value) => `${value.toFixed(1)}%`,
  };
  sections.push(
    {
      title: "Death dot-ball rate",
      note: "Percentage of legal balls in overs 17–20 that conceded zero runs",
      rows: deathDotBallLines,
      format: (value) => `${value.toFixed(1)}%`,
    },
    {
      title: "Middle-over RR",
      note: "Season run rate from balls actually faced in overs 7–16",
      rows: middleOverRunRateLines,
      format: (value) => value.toFixed(2),
    },
    {
      title: "Middle-over wickets",
      note: "Average wickets taken per match in overs 7–16",
      rows: middleOverWicketLines,
      format: (value) => value.toFixed(2),
    },
    {
      title: "Middle-over dot-ball rate",
      note: "Percentage of legal balls in overs 7–16 that conceded zero runs",
      rows: middleOverDotBallLines,
      format: (value) => `${value.toFixed(1)}%`,
    },
  );

  const phaseMetricOrder = [
    "runs",
    "RR",
    "wickets",
    "economy",
    "dot-ball rate",
  ];
  const phaseSections = (prefix: string) =>
    sections
      .filter((section) => section.title.startsWith(prefix))
      .sort(
        (a, b) =>
          phaseMetricOrder.findIndex((metric) => a.title.endsWith(metric)) -
          phaseMetricOrder.findIndex((metric) => b.title.endsWith(metric)),
      );
  const displaySections = [
    ...phaseSections("Powerplay"),
    ...phaseSections("Death"),
    ...phaseSections("Middle-over"),
    ...sections.filter(
      (section) =>
        section.title === "Batting-first win rate" ||
        section.title === "Chasing win rate",
    ),
    ...sections.filter(
      (section) =>
        !section.title.startsWith("Powerplay") &&
        !section.title.startsWith("Death") &&
        !section.title.startsWith("Middle-over") &&
        section.title !== "Batting-first win rate" &&
        section.title !== "Chasing win rate",
    ),
  ];
  const deathRunRateVsEconomy = deathOverRunRateLines.map((battingRow) => ({
    teamId: battingRow.teamId,
    matches: battingRow.matches,
    runRate: battingRow.value,
    economy:
      deathEconomyLines.find((row) => row.teamId === battingRow.teamId)
        ?.value ?? 0,
  }));
  const deathRunRates = deathRunRateVsEconomy.map((row) => row.runRate);
  const deathEconomies = deathRunRateVsEconomy.map((row) => row.economy);
  const deathRunRateAverage =
    deathRunRates.reduce((sum, value) => sum + value, 0) /
    Math.max(deathRunRates.length, 1);
  const deathEconomyAverage =
    deathEconomies.reduce((sum, value) => sum + value, 0) /
    Math.max(deathEconomies.length, 1);
  const deathRunRateMin = Math.min(...deathRunRates);
  const deathRunRateMax = Math.max(...deathRunRates);
  const deathEconomyMin = Math.min(...deathEconomies);
  const deathEconomyMax = Math.max(...deathEconomies);
  const chartPosition = (value: number, min: number, max: number) =>
    6 + ((value - min) / Math.max(max - min, 0.01)) * 88;
  const battingPhaseStat = (
    teamId: string,
    fromOver: number,
    toOver: number,
    stat: "runRate" | "dotRate" | "boundaryRate",
  ) => {
    const deliveries = records
      .flatMap((record) => record.innings)
      .filter((innings) => innings.battingTeamId === teamId)
      .flatMap((innings) => innings.oversDetail)
      .filter((over) => over.number >= fromOver && over.number <= toOver)
      .flatMap((over) => over.deliveries);
    const legalBalls = deliveries.filter((delivery) => delivery.isLegal);
    if (!legalBalls.length) return 0;
    if (stat === "runRate")
      return deliveries.reduce((sum, delivery) => sum + delivery.totalRuns, 0) / (legalBalls.length / 6);
    if (stat === "dotRate")
      return (legalBalls.filter((delivery) => delivery.totalRuns === 0).length * 100) / legalBalls.length;
    return (legalBalls.filter((delivery) => delivery.runsOffBat === 4 || delivery.runsOffBat === 6).length * 100) / legalBalls.length;
  };
  const lineValue = (rows: TeamLine[], teamId: string) =>
    rows.find((row) => row.teamId === teamId)?.value ?? 0;
  const quadrantCharts: QuadrantChart[] = [
    {
      title: "Death Overs: Run Rate vs Economy",
      note: "Batting run rate scored and bowling economy conceded in overs 17–20",
      xLabel: "Death run rate scored →",
      yLabel: "Death economy conceded",
      yLowerBetter: true,
      labels: ["Score low · concede low", "Good finishers", "Bad finishers", "Score high · concede high"],
      points: deathRunRateVsEconomy.map((row) => ({ teamId: row.teamId, x: row.runRate, y: row.economy })),
    },
    {
      title: "Powerplay: Run Rate vs Economy",
      note: "Batting run rate scored and bowling economy conceded in overs 1–6",
      xLabel: "Powerplay run rate →",
      yLabel: "Powerplay economy",
      yLowerBetter: true,
      labels: ["Slow · restrictive", "Strong starters", "Weak starters", "Fast · expensive"],
      points: teamIds.map((teamId) => ({ teamId, x: battingPhaseStat(teamId, 1, 6, "runRate"), y: lineValue(powerplayEconomyLines, teamId) })),
    },
    {
      title: "Middle Overs: Run Rate vs Economy",
      note: "Batting run rate scored and bowling economy conceded in overs 7–16",
      xLabel: "Middle-over run rate →",
      yLabel: "Middle-over economy",
      yLowerBetter: true,
      labels: ["Slow · restrictive", "Middle-over control", "Weak middle overs", "Fast · expensive"],
      points: teamIds.map((teamId) => ({ teamId, x: lineValue(middleOverRunRateLines, teamId), y: lineValue(middleOverEconomyLines, teamId) })),
    },
    {
      title: "Powerplay Dot-ball Control",
      note: "Dot-ball percentage faced while batting versus dot-ball percentage created while bowling",
      xLabel: "Batting dot rate faced ←",
      yLabel: "Bowling dot rate",
      xLowerBetter: true,
      labels: ["Constrained · restrictive", "Powerplay control", "Poor control", "Fluent · low pressure"],
      points: teamIds.map((teamId) => ({ teamId, x: battingPhaseStat(teamId, 1, 6, "dotRate"), y: lineValue(powerplayDotBallLines, teamId) })),
    },
    {
      title: "Middle Overs: Boundaries vs Wickets",
      note: "Batting boundary-ball percentage versus bowling wickets taken per match in overs 7–16",
      xLabel: "Boundary-ball rate →",
      yLabel: "Wickets per match",
      labels: ["Low boundaries · threatening", "Middle-over impact", "Passive teams", "Boundary-heavy · wicket-light"],
      points: teamIds.map((teamId) => ({ teamId, x: battingPhaseStat(teamId, 7, 16, "boundaryRate"), y: lineValue(middleOverWicketLines, teamId) })),
    },
    {
      title: "Death Overs: Dots Faced vs Wickets",
      note: "Batting dot-ball percentage faced versus bowling wickets taken per match in overs 17–20",
      xLabel: "Batting dot rate faced ←",
      yLabel: "Death wickets per match",
      xLowerBetter: true,
      labels: ["Constrained · wicket-taking", "Complete finishers", "Weak finishers", "Fluent · wicket-light"],
      points: teamIds.map((teamId) => ({ teamId, x: battingPhaseStat(teamId, 17, 20, "dotRate"), y: lineValue(deathWicketLines, teamId) })),
    },
  ];
  const seasonRunAbilityRows = Array.from(
    completedScorecards.reduce((totals, fixture) => {
      fixture.simulation!.innings.forEach((innings) => {
        innings.batting.forEach((entry) => {
          if (entry.didNotBat) return;
          const current = totals.get(entry.id);
          totals.set(entry.id, {
            playerId: entry.id,
            name: players[entry.id]?.name ?? entry.name,
            teamId: innings.battingTeamId,
            output: (current?.output ?? 0) + entry.runs,
            ability: seasonStartBattingAbilities[entry.id] ?? players[entry.id]?.currentBatting ?? 0,
          });
        });
      });
      return totals;
    }, new Map<string, PlayerAbilityOutputPoint>()),
  )
    .map(([, row]) => row)
    .filter((row) => row.output > 100)
    .sort((left, right) => (
      right.output - left.output
      || right.ability - left.ability
      || left.name.localeCompare(right.name)
    ));
  const seasonWicketAbilityRows = (style: "Spinner" | "Pacer") => Array.from(
    completedScorecards.reduce((totals, fixture) => {
      fixture.simulation!.innings.forEach((innings) => {
        innings.bowling.forEach((entry) => {
          const player = players[entry.id];
          if (player?.bowlingStyle !== style) return;
          const current = totals.get(entry.id);
          totals.set(entry.id, {
            playerId: entry.id,
            name: player.name ?? entry.name,
            teamId: innings.bowlingTeamId,
            output: (current?.output ?? 0) + entry.wickets,
            ability: seasonStartBowlingAbilities[entry.id] ?? player.currentBowling ?? 0,
          });
        });
      });
      return totals;
    }, new Map<string, PlayerAbilityOutputPoint>()),
  )
    .map(([, row]) => row)
    .filter((row) => row.output > 0)
    .sort((left, right) => (
      right.output - left.output
      || right.ability - left.ability
      || left.name.localeCompare(right.name)
    ));
  const spinnerWicketAbilityRows = seasonWicketAbilityRows("Spinner");
  const pacerWicketAbilityRows = seasonWicketAbilityRows("Pacer");

  return (
    <div className="h-full overflow-y-auto p-5">
      {records.length < completedScorecards.length && (
        <div className="mt-4 border border-warning/40 bg-warning/10 px-3 py-2 font-space-mono text-[9px] font-bold uppercase text-text-primary">
          Loading archived ball-by-ball data. Compact scorecards are excluded
          until their delivery archive is available.
        </div>
      )}
      {records.length === 0 ? (
        <div className="mt-6 border border-dashed border-border p-10 text-center text-xs text-text-secondary">
          Complete season matches to populate the analysis.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-12 gap-3">
          {displaySections.map((section) => (
            <section
              key={section.title}
              className={`relative overflow-visible rounded-lg border border-border bg-bg p-3 hover:z-40 ${
                section.title.startsWith("Powerplay")
                  ? "col-span-3"
                  : section.title.startsWith("Death")
                    ? "col-span-3"
                    : section.title.startsWith("Middle-over")
                      ? "col-span-3"
                    : section.title === "Batting-first win rate" ||
                        section.title === "Chasing win rate"
                      ? "col-span-6"
                    : "col-span-12 xl:col-span-6 2xl:col-span-4"
              }`}
            >
              <div className="mb-2 border-b border-border/40 pb-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">
                    {section.title}
                  </h3>
                  <span className="font-space-mono text-[7px] font-bold uppercase text-accent">
                    1–10 league ranking
                  </span>
                </div>
                <p className="font-space-mono text-[9px] text-text-secondary">
                  {section.note}
                </p>
              </div>
              <div className="space-y-0.5 overflow-visible font-space-mono text-[10px]">
                <div
                  className={`grid border-b border-border pb-1 text-[9px] font-bold uppercase text-text-secondary ${
                    section.wicketBreakdown
                      ? "grid-cols-[40px_minmax(0,1fr)_72px_72px_92px] gap-3"
                      : "grid-cols-[35px_1fr_60px_74px]"
                  }`}
                >
                  <span>Rank</span>
                  <span>Franchise</span>
                  <span
                    className={
                      section.wicketBreakdown ? "text-center" : "text-right"
                    }
                  >
                    Matches
                  </span>
                  {section.wicketBreakdown ? (
                    <>
                      <span className="text-center">Wickets</span>
                      <span className="whitespace-nowrap text-center">
                        Wicket Share
                      </span>
                    </>
                  ) : (
                    <span className="text-right">Value</span>
                  )}
                </div>
                {section.rows.map((row, index) => {
                  const contributions = playerContributions(section.title, row.teamId);
                  const contributionTotal = contributions.reduce((sum, contribution) => sum + contribution.value, 0);
                  return (
                  <div
                    key={row.teamId}
                    className={`group/team relative grid items-center rounded px-1 py-0.5 ${
                      section.wicketBreakdown
                        ? "grid-cols-[40px_minmax(0,1fr)_72px_72px_92px] gap-3"
                        : "grid-cols-[35px_1fr_60px_74px]"
                    } ${
                      row.teamId === userTeamId
                        ? "bg-accent/10"
                        : "hover:bg-surface/5"
                    }`}
                  >
                    <span className="font-anton text-[11px] text-accent">
                      #{index + 1}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-bold text-text-primary">
                      <span
                        className="size-2 shrink-0 rounded-full border border-border"
                        style={{
                          backgroundColor: teams[row.teamId]?.primaryColor,
                        }}
                      />
                      <span
                        className="truncate"
                        title={teams[row.teamId]?.name ?? row.teamId}
                      >
                        {section.title.startsWith("Powerplay") ||
                        section.title.startsWith("Death") ||
                        section.title.startsWith("Middle-over")
                          ? (teams[row.teamId]?.shortName ?? row.teamId)
                          : (teams[row.teamId]?.name ?? row.teamId)}
                      </span>
                    </span>
                    <span
                      className={`${section.wicketBreakdown ? "text-center" : "text-right"} text-[10px] text-text-secondary`}
                    >
                      {row.matches}
                    </span>
                    {section.wicketBreakdown ? (
                      <>
                        <span className="text-center font-bold text-accent">
                          {row.matches ? (row.wickets ?? 0).toFixed(0) : "—"}
                        </span>
                        <span className="text-center font-bold text-accent">
                          {row.matches
                            ? `${(row.wicketShare ?? 0).toFixed(1)}%`
                            : "—"}
                        </span>
                      </>
                    ) : (
                      <span className="text-right font-bold text-accent">
                        {row.matches ? section.format(row.value) : "—"}
                      </span>
                    )}
                    {contributions.length > 0 && (
                      <div className="pointer-events-none invisible absolute right-2 top-full z-50 mt-1 w-64 rounded border border-border bg-bg p-3 text-left opacity-0 shadow-xl transition-opacity group-hover/team:visible group-hover/team:opacity-100">
                        <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                          <span className="truncate font-bold text-text-primary">{teams[row.teamId]?.name ?? row.teamId}</span>
                          <span className="shrink-0 text-[8px] font-bold uppercase text-accent">Contributions</span>
                        </div>
                        <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                          {contributions.map((contribution) => (
                            <div key={contribution.playerId} className="grid grid-cols-[minmax(0,1fr)_38px_45px] items-center gap-2 text-[9px]">
                              <span className="truncate font-bold text-text-primary">{contribution.name}</span>
                              <span className="text-right font-bold text-accent">{contribution.value}</span>
                              <span className="text-right text-text-secondary">
                                {contributionTotal ? `${((contribution.value * 100) / contributionTotal).toFixed(1)}%` : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex justify-between border-t border-border pt-2 text-[8px] font-bold uppercase text-text-secondary">
                          <span>{contributions.length} contributor{contributions.length === 1 ? "" : "s"}</span>
                          <span>Total {contributionTotal}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </section>
          ))}
          <section className="relative order-3 col-span-4 overflow-visible rounded-lg border border-border bg-bg p-3 hover:z-40">
            <div className="mb-2 border-b border-border/40 pb-1.5">
              <div className="flex items-center justify-between">
                <h3 className="font-anton text-sm uppercase tracking-wider text-text-primary">
                  Death Overs: Run Rate vs Economy
                </h3>
                <span className="font-space-mono text-[7px] font-bold uppercase text-accent">
                  Two-way team comparison
                </span>
              </div>
              <p className="font-space-mono text-[9px] text-text-secondary">
                Batting run rate scored and bowling economy conceded in overs
                17–20
              </p>
            </div>
            <div className="grid grid-cols-[28px_32px_minmax(0,1fr)] gap-2 font-space-mono text-[9px]">
              <div className="flex items-center justify-center [writing-mode:vertical-rl] rotate-180 font-bold uppercase tracking-wider text-text-secondary">
                Death economy conceded →
              </div>
              <div className="relative h-[260px] text-[7px] text-text-secondary">
                <span className="absolute right-0 top-[6%] -translate-y-1/2">
                  {deathEconomyMin.toFixed(1)}
                </span>
                <span className="absolute right-0 top-1/2 -translate-y-1/2">
                  {((deathEconomyMin + deathEconomyMax) / 2).toFixed(1)}
                </span>
                <span className="absolute bottom-[6%] right-0 translate-y-1/2">
                  {deathEconomyMax.toFixed(1)}
                </span>
              </div>
              <div>
                <div className="relative h-[260px] overflow-visible border border-border bg-surface/5">
                  <div
                    className="absolute inset-y-0 border-l border-dashed border-accent/50"
                    style={{
                      left: `${chartPosition(deathRunRateAverage, deathRunRateMin, deathRunRateMax)}%`,
                    }}
                  />
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-accent/50"
                    style={{
                      top: `${chartPosition(deathEconomyAverage, deathEconomyMin, deathEconomyMax)}%`,
                    }}
                  />
                  <span className="pointer-events-none absolute left-3 top-3 z-20 uppercase text-white">
                    Score low · concede low
                  </span>
                  <span className="pointer-events-none absolute right-3 top-3 z-20 text-right uppercase text-success">
                    Good finishers
                  </span>
                  <span className="pointer-events-none absolute bottom-3 left-3 z-20 uppercase text-danger">
                    Bad finishers
                  </span>
                  <span className="pointer-events-none absolute bottom-3 right-3 z-20 text-right uppercase text-white">
                    Score high · concede high
                  </span>

                  {deathRunRateVsEconomy.map((row) => {
                    const pointX = chartPosition(
                      row.runRate,
                      deathRunRateMin,
                      deathRunRateMax,
                    );
                    const pointY = chartPosition(
                      row.economy,
                      deathEconomyMin,
                      deathEconomyMax,
                    );
                    const horizontalTooltip =
                      pointX < 25
                        ? "left-0 translate-x-0"
                        : pointX > 75
                          ? "right-0 translate-x-0"
                          : "left-1/2 -translate-x-1/2";
                    const verticalTooltip =
                      pointY < 35 ? "top-full mt-2" : "bottom-full mb-2";
                    return (
                    <div
                      key={row.teamId}
                      className={`group absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[7px] text-white shadow-md hover:z-50 ${
                        row.teamId === userTeamId
                          ? "ring-2 ring-accent ring-offset-1 ring-offset-bg"
                          : ""
                      }`}
                      style={{
                        left: `${pointX}%`,
                        top: `${pointY}%`,
                        backgroundColor:
                          teams[row.teamId]?.primaryColor ?? "#555",
                      }}
                    >
                      {teams[row.teamId]?.shortName ?? row.teamId}
                      <span
                        className={`pointer-events-none invisible absolute z-50 min-w-[190px] max-w-[280px] rounded border border-border bg-bg px-3 py-2 text-left text-[8px] leading-4 text-text-primary opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 ${horizontalTooltip} ${verticalTooltip}`}
                      >
                        <span className="block whitespace-normal font-bold">
                          {teams[row.teamId]?.name ?? row.teamId}
                        </span>
                        <span className="mt-1 block whitespace-normal text-text-secondary">
                          Death RR: {row.runRate.toFixed(2)}
                        </span>
                        <span className="block whitespace-normal text-text-secondary">
                          Death economy: {row.economy.toFixed(2)}
                        </span>
                      </span>
                    </div>
                    );
                  })}
                </div>
                <div className="relative h-4 text-[7px] text-text-secondary">
                  <span className="absolute left-[6%] -translate-x-1/2">
                    {deathRunRateMin.toFixed(1)}
                  </span>
                  <span className="absolute left-1/2 -translate-x-1/2">
                    {((deathRunRateMin + deathRunRateMax) / 2).toFixed(1)}
                  </span>
                  <span className="absolute right-[6%] translate-x-1/2">
                    {deathRunRateMax.toFixed(1)}
                  </span>
                </div>
                <div className="pt-2 text-center font-bold uppercase tracking-wider text-text-secondary">
                  Death run rate scored →
                </div>
                <div className="text-center text-[7px] text-text-secondary">
                  League averages: RR {deathRunRateAverage.toFixed(2)} · Economy {deathEconomyAverage.toFixed(2)}
                </div>
              </div>
            </div>
          </section>
          {quadrantCharts.slice(1).map((chart) => (
            <QuadrantComparison
              key={chart.title}
              chart={chart}
              teams={teams}
              userTeamId={userTeamId}
            />
          ))}
          <section className="order-[100] col-span-12 overflow-hidden rounded-lg border border-border bg-bg">
            <div className="flex items-end justify-between gap-4 border-b border-border bg-surface/5 px-5 py-4">
              <div>
                <span className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-accent">
                  Full league batting sample
                </span>
                <h3 className="mt-1 font-anton text-xl uppercase tracking-wider text-text-primary">
                  Runs vs Start-of-Season Batting Ability
                </h3>
                <p className="mt-1 font-space-mono text-[9px] text-text-secondary">
                  Every player with more than 100 runs in the current season.
                </p>
              </div>
              <span className="shrink-0 font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                {seasonRunAbilityRows.length} qualifiers
              </span>
            </div>
            <PlayerAbilityOutputChart
              points={seasonRunAbilityRows}
              teams={teams}
              userTeamId={userTeamId}
              yLabel="Season Runs"
              xLabel="Start-of-Season Batting Ability"
              outputLabel="Season runs"
              abilityLabel="Batting ability"
              emptyMessage="No players have passed 100 runs yet"
            />
          </section>
          <section className="order-[101] col-span-12 overflow-hidden rounded-lg border border-border bg-bg">
            <div className="flex items-end justify-between gap-4 border-b border-border bg-surface/5 px-5 py-4">
              <div>
                <span className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-accent">
                  Full league spin-bowling sample
                </span>
                <h3 className="mt-1 font-anton text-xl uppercase tracking-wider text-text-primary">
                  Spinner Wickets vs Start-of-Season Bowling Ability
                </h3>
                <p className="mt-1 font-space-mono text-[9px] text-text-secondary">
                  Every spinner with at least one wicket in the current season.
                </p>
              </div>
              <span className="shrink-0 font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                {spinnerWicketAbilityRows.length} qualifiers
              </span>
            </div>
            <PlayerAbilityOutputChart
              points={spinnerWicketAbilityRows}
              teams={teams}
              userTeamId={userTeamId}
              yLabel="Season Wickets"
              xLabel="Start-of-Season Bowling Ability"
              outputLabel="Season wickets"
              abilityLabel="Bowling ability"
              emptyMessage="No spinners have taken a wicket yet"
            />
          </section>
          <section className="order-[102] col-span-12 overflow-hidden rounded-lg border border-border bg-bg">
            <div className="flex items-end justify-between gap-4 border-b border-border bg-surface/5 px-5 py-4">
              <div>
                <span className="font-space-mono text-[8px] font-bold uppercase tracking-[0.2em] text-accent">
                  Full league pace-bowling sample
                </span>
                <h3 className="mt-1 font-anton text-xl uppercase tracking-wider text-text-primary">
                  Pacer Wickets vs Start-of-Season Bowling Ability
                </h3>
                <p className="mt-1 font-space-mono text-[9px] text-text-secondary">
                  Every pacer with at least one wicket in the current season.
                </p>
              </div>
              <span className="shrink-0 font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                {pacerWicketAbilityRows.length} qualifiers
              </span>
            </div>
            <PlayerAbilityOutputChart
              points={pacerWicketAbilityRows}
              teams={teams}
              userTeamId={userTeamId}
              yLabel="Season Wickets"
              xLabel="Start-of-Season Bowling Ability"
              outputLabel="Season wickets"
              abilityLabel="Bowling ability"
              emptyMessage="No pacers have taken a wicket yet"
            />
          </section>
        </div>
      )}
    </div>
  );
}
