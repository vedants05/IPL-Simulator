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
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-border pb-3">
      <div>
        <div className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-text-secondary">
          Innings {innings.inningsNumber}
        </div>
        <div className="mt-1 font-anton text-[20px] uppercase text-text-primary">
          {teams[innings.battingTeamId]?.name ?? innings.battingTeamId}
        </div>
      </div>
      <div className="text-right">
        <div className="font-anton text-[28px] leading-none text-text-primary">
          {innings.runs}/{innings.wickets}
        </div>
        <div className="mt-1 font-space-mono text-[8px] uppercase text-text-secondary">
          {innings.overs.toFixed(1)} overs
          {innings.target ? ` · Target ${innings.target}` : ""}
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
  const innings = simulation.innings[inningsNumber - 1];
  const overs = useMemo(() => (
    Array.from({ length: 20 }, (_, index) => (
      innings.oversDetail.find((over) => over.number === index + 1) ?? null
    ))
  ), [innings]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {simulation.innings.map((candidate) => (
          <button
            key={candidate.inningsNumber}
            type="button"
            onClick={() => setInningsNumber(candidate.inningsNumber)}
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
                  <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Bowler</div>
                  <div className="truncate font-space-mono text-[9px] font-bold text-text-primary">{over.bowlerName}</div>
                </div>
                <div className="min-w-0">
                  <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Batters faced</div>
                  <div className="truncate font-space-mono text-[8px] text-text-primary">
                    {over.batterNames.join(" · ")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {over.deliveries.map((delivery) => (
                    <div key={delivery.id} className="group relative">
                      <button
                        type="button"
                        aria-label={`${delivery.displayBall}: ${delivery.bowlerName} to ${delivery.strikerName}, ${delivery.commentary}`}
                        className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 font-space-mono text-[8px] font-bold ${deliveryTone(delivery)}`}
                      >
                        {delivery.resultCode}
                      </button>
                      <div
                        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 isolate rounded-md border-2 border-[var(--ink)] p-3 text-left opacity-100 shadow-2xl group-hover:block group-focus-within:block"
                        style={{ backgroundColor: "var(--surface)" }}
                      >
                        <div className="font-space-mono text-[7px] font-bold uppercase text-accent">
                          Ball {delivery.displayBall}
                        </div>
                        <div className="mt-1 font-space-mono text-[9px] font-bold text-text-primary">
                          {delivery.bowlerName} to {delivery.strikerName}
                        </div>
                        <div className="mt-1 font-space-mono text-[7px] text-text-secondary">
                          Non-striker: {delivery.nonStrikerName}
                        </div>
                        <div className="mt-2 border-t border-border pt-2 font-space-mono text-[8px] leading-relaxed text-text-primary">
                          {delivery.commentary}
                        </div>
                        <div className="mt-2 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                          Score: {delivery.scoreAfter}/{delivery.wicketsAfter}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right">
                  <div className="font-anton text-[15px] text-text-primary">{over.runs} run{over.runs === 1 ? "" : "s"}</div>
                  <div className="font-space-mono text-[7px] text-text-secondary">
                    {over.scoreAfter}/{over.wicketsAfter}
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-4 font-space-mono text-[8px] uppercase text-text-secondary/60">
                Not bowled
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
