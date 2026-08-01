"use client";

import { useMemo, useState } from "react";

import type {
  MatchDelivery,
  MatchInnings,
  MatchSimulationRecord,
} from "@/lib/logic/matchSimulation";
import type { Team } from "@/lib/types";

const deliveryTone = (delivery: MatchDelivery) => {
  if (delivery.wicket) return "border-danger bg-danger text-white";
  if (delivery.runsOffBat === 6) return "border-accent bg-accent text-white";
  if (delivery.runsOffBat === 4) return "border-success bg-success text-white";
  if (!delivery.isLegal) return "border-warning/50 bg-warning/15 text-warning";
  return "border-border bg-surface text-text-primary";
};

function InningsHeader({
  innings,
  teams,
}: {
  innings: MatchInnings;
  teams: Record<string, Team>;
}) {
  const oversNum = typeof innings?.overs === "number" ? innings.overs : 0;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-border pb-3">
      <div>
        <div className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-text-secondary">
          Innings {innings?.inningsNumber ?? 1}
        </div>
        <div className="mt-1 font-anton text-[20px] uppercase text-text-primary">
          {teams[innings?.battingTeamId]?.name ?? innings?.battingTeamId ?? "Batting Team"}
        </div>
      </div>
      <div className="text-right">
        <div className="font-anton text-[28px] leading-none text-text-primary">
          {innings?.runs ?? 0}/{innings?.wickets ?? 0}
        </div>
        <div className="mt-1 font-space-mono text-[8px] uppercase text-text-secondary">
          {oversNum.toFixed(1)} overs
          {innings?.target ? ` · Target ${innings.target}` : ""}
        </div>
      </div>
    </div>
  );
}

export default function BallByBallSummary({
  simulation,
  teams,
}: {
  simulation: MatchSimulationRecord;
  teams: Record<string, Team>;
}) {
  const [inningsNumber, setInningsNumber] = useState<1 | 2>(1);

  if (!simulation || !simulation.innings || simulation.innings.length === 0) {
    return (
      <div className="py-8 text-center font-space-mono text-xs text-text-secondary">
        No ball-by-ball delivery log recorded for this match.
      </div>
    );
  }

  const innings = simulation.innings[inningsNumber - 1] ?? simulation.innings[0];

  const overs = useMemo(() => {
    if (!innings || !innings.oversDetail) return [];
    return Array.from({ length: 20 }, (_, index) => (
      innings.oversDetail.find((over) => over.number === index + 1) ?? null
    ));
  }, [innings]);

  if (!innings) return null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {simulation.innings.map((candidate) => (
          <button
            key={candidate.inningsNumber}
            type="button"
            onClick={() => setInningsNumber(candidate.inningsNumber as 1 | 2)}
            className={`min-w-[130px] rounded-md border-2 px-3 py-2 text-left transition-colors ${
              inningsNumber === candidate.inningsNumber
                ? "border-accent bg-accent/10"
                : "border-border bg-surface hover:border-text-secondary"
            }`}
          >
            <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">
              {teams[candidate.battingTeamId]?.shortName ?? candidate.battingTeamId}
            </div>
            <div className="mt-0.5 font-anton text-[16px] text-text-primary">
              {candidate.runs}/{candidate.wickets}
            </div>
          </button>
        ))}
      </div>

      <InningsHeader innings={innings} teams={teams} />

      <div className="space-y-2">
        {overs.map((over, index) => (
          <div
            key={index + 1}
            className={`grid min-h-[54px] grid-cols-[42px_minmax(116px,0.8fr)_minmax(140px,1fr)_minmax(240px,2fr)_70px] items-center gap-3 rounded-md border px-3 py-2 ${
              over ? "border-border bg-bg-primary" : "border-border/50 bg-surface/40"
            }`}
          >
            <div className="font-anton text-[17px] text-text-primary">{index + 1}</div>
            {over ? (
              <>
                <div className="min-w-0">
                  <div className="truncate font-barlow text-xs font-bold text-text-primary">
                    {over.bowlerName}
                  </div>
                  <div className="font-space-mono text-[8px] text-text-secondary">
                    {over.runsConceded} runs · {over.wickets} wickets
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate font-barlow text-xs text-text-primary">
                    {over.batterNames.join(" & ")}
                  </div>
                  <div className="font-space-mono text-[8px] text-text-secondary">
                    {over.deliveries.length} balls
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {over.deliveries.map((delivery, dIndex) => (
                    <div
                      key={dIndex}
                      className={`flex size-6 items-center justify-center rounded border font-space-mono text-[9px] font-bold ${deliveryTone(
                        delivery
                      )}`}
                      title={`${delivery.bowlerName} to ${delivery.batterName}: ${delivery.commentary}`}
                    >
                      {delivery.wicket
                        ? "W"
                        : delivery.runsOffBat > 0
                        ? delivery.runsOffBat
                        : delivery.extras > 0
                        ? `+${delivery.extras}`
                        : "•"}
                    </div>
                  ))}
                </div>

                <div className="text-right">
                  <div className="font-anton text-base text-text-primary">
                    {over.runsConceded}
                  </div>
                  <div className="font-space-mono text-[8px] uppercase text-text-secondary">
                    Over runs
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-4 font-space-mono text-xs text-text-secondary">
                Over not bowled
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
