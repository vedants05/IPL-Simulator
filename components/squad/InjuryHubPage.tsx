"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { getInjuryReturnLabel, type InjuryCategory, type PlayerInjury } from "@/lib/logic/injuries";
import type { Player, Team } from "@/lib/types";

type HubMode = "club" | "league";
type HubView = "active" | "history";

interface InjuryHubPageProps {
  mode: HubMode;
  userTeamId: string;
  activeInjuries: Record<string, PlayerInjury>;
  injuryHistory: PlayerInjury[];
  players: Record<string, Player>;
  teams: Record<string, Team>;
  seasonFinalDate?: string;
}

const displayDate = (dateKey?: string) => dateKey
  ? new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
  : "—";

const categoryClass = (category: InjuryCategory) => category === "major"
  ? "border-danger/35 bg-danger/10 text-danger"
  : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";

const riskLabel = (injury: PlayerInjury) => injury.worseningRisk
  ? `${injury.worseningRisk[0].toUpperCase()}${injury.worseningRisk.slice(1)}`
  : "—";

export default function InjuryHubPage({
  mode,
  userTeamId,
  activeInjuries,
  injuryHistory,
  players,
  teams,
  seasonFinalDate,
}: InjuryHubPageProps) {
  const [view, setView] = useState<HubView>("active");
  const [category, setCategory] = useState<"all" | InjuryCategory>("all");
  const [teamId, setTeamId] = useState("all");

  const getActiveTeamId = (injury: PlayerInjury) => (
    players[injury.playerId]?.currentTeamId ?? injury.teamId
  );
  const active = useMemo(() => Object.values(activeInjuries)
    .filter((injury) => mode === "league" || getActiveTeamId(injury) === userTeamId)
    .filter((injury) => category === "all" || injury.category === category)
    .filter((injury) => mode === "club" || teamId === "all" || getActiveTeamId(injury) === teamId)
    .sort((left, right) => (
      Number(right.category === "major") - Number(left.category === "major")
      || left.estimatedReturnEarliest.localeCompare(right.estimatedReturnEarliest)
      || left.playerName.localeCompare(right.playerName)
    )), [activeInjuries, category, mode, players, teamId, userTeamId]);

  const history = useMemo(() => injuryHistory
    .filter((injury) => mode === "league" || injury.teamId === userTeamId)
    .filter((injury) => category === "all" || injury.category === category)
    .filter((injury) => mode === "club" || teamId === "all" || injury.teamId === teamId)
    .sort((left, right) => (
      (right.endedOn ?? right.actualReturnDate).localeCompare(left.endedOn ?? left.actualReturnDate)
      || right.startedOn.localeCompare(left.startedOn)
    )), [category, injuryHistory, mode, teamId, userTeamId]);

  const scopedActive = Object.values(activeInjuries).filter((injury) => (
    mode === "league" || getActiveTeamId(injury) === userTeamId
  ));
  const majorCount = scopedActive.filter((injury) => injury.category === "major").length;
  const minorCount = scopedActive.filter((injury) => injury.category === "minor").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="grid shrink-0 grid-cols-3 gap-3">
        <div className="border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">Active conditions</span>
            <Activity size={16} className="text-accent" />
          </div>
          <div className="mt-2 font-anton text-[28px] leading-none text-text-primary">{scopedActive.length}</div>
        </div>
        <div className="border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">Minor · playable</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="mt-2 font-anton text-[28px] leading-none text-amber-600 dark:text-amber-300">{minorCount}</div>
        </div>
        <div className="border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary">Major · unavailable</span>
            <ShieldAlert size={16} className="text-danger" />
          </div>
          <div className="mt-2 font-anton text-[28px] leading-none text-danger">{majorCount}</div>
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-border bg-surface">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div>
            <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">
              {mode === "club" ? "Squad medical status" : "League medical report"}
            </p>
            <h2 className="mt-1 font-anton text-[20px] uppercase leading-none text-text-primary">
              {view === "active" ? "Current injuries" : "Injury history"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {mode === "league" && (
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="h-8 border border-border bg-bg px-2 font-space-mono text-[9px] font-bold uppercase text-text-primary"
                aria-label="Filter injuries by club"
              >
                <option value="all">All clubs</option>
                {Object.values(teams).sort((left, right) => left.name.localeCompare(right.name)).map((team) => (
                  <option key={team.id} value={team.id}>{team.shortName} · {team.name}</option>
                ))}
              </select>
            )}
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as "all" | InjuryCategory)}
              className="h-8 border border-border bg-bg px-2 font-space-mono text-[9px] font-bold uppercase text-text-primary"
              aria-label="Filter injuries by severity"
            >
              <option value="all">Minor &amp; major</option>
              <option value="minor">Minor only</option>
              <option value="major">Major only</option>
            </select>
            <div className="flex h-8 border border-border bg-bg">
              {(["active", "history"] as HubView[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={`px-3 font-space-mono text-[9px] font-bold uppercase ${view === item ? "bg-[var(--ink)] text-bg" : "text-text-secondary hover:text-text-primary"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "active" && (
            active.length > 0 ? (
              <table className="w-full table-fixed text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-border bg-bg font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="w-[22%] px-5 py-3">Player</th>
                    {mode === "league" && <th className="w-[9%] px-3 py-3">Club</th>}
                    <th className="w-[20%] px-3 py-3">Condition</th>
                    <th className="w-[10%] px-3 py-3">Severity</th>
                    <th className="w-[13%] px-3 py-3">Worsening risk</th>
                    <th className="px-3 py-3">Estimated return</th>
                    <th className="w-[10%] px-3 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {active.map((injury) => {
                    const activeTeamId = getActiveTeamId(injury);
                    return (
                      <tr key={injury.id} className="hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                        <td className="px-5 py-3">
                          <div className="truncate font-semibold text-text-primary">{players[injury.playerId]?.name ?? injury.playerName}</div>
                          <div className="mt-0.5 font-space-mono text-[12px] uppercase text-text-secondary">Since {displayDate(injury.startedOn)}</div>
                        </td>
                        {mode === "league" && <td className="px-3 py-3 font-space-mono font-bold text-text-secondary">{teams[activeTeamId]?.shortName ?? activeTeamId}</td>}
                        <td className="px-3 py-3 font-medium text-text-primary">{injury.conditionName}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex border px-2 py-1 font-space-mono text-[8px] font-bold uppercase ${categoryClass(injury.category)}`}>{injury.category}</span>
                        </td>
                        <td className="px-3 py-3 font-space-mono text-[9px] font-bold uppercase text-text-secondary">{riskLabel(injury)}</td>
                        <td className="px-3 py-3 font-space-mono text-[12px] text-text-primary">{getInjuryReturnLabel(injury, seasonFinalDate)}</td>
                        <td className="px-3 py-3 text-right font-space-mono text-[8px] font-bold uppercase">
                          <span className={injury.category === "major" ? "text-danger" : "text-amber-700 dark:text-amber-300"}>
                            {injury.category === "major" ? "Unavailable" : "Playable"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex h-full min-h-64 flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 size={30} className="text-success" />
                <h3 className="mt-3 font-anton text-[18px] uppercase text-text-primary">No matching active injuries</h3>
                <p className="mt-1 max-w-md text-xs text-text-secondary">The selected squad and severity filters have no current conditions.</p>
              </div>
            )
          )}

          {view === "history" && (
            history.length > 0 ? (
              <table className="w-full table-fixed text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-border bg-bg font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="w-[22%] px-5 py-3">Player</th>
                    {mode === "league" && <th className="w-[9%] px-3 py-3">Club</th>}
                    <th className="w-[21%] px-3 py-3">Condition</th>
                    <th className="w-[10%] px-3 py-3">Severity</th>
                    <th className="w-[13%] px-3 py-3">Started</th>
                    <th className="w-[13%] px-3 py-3">Ended</th>
                    <th className="px-3 py-3 text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((injury) => (
                    <tr key={`${injury.id}:${injury.endedOn}`} className="hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                      <td className="px-5 py-3">
                        <div className="truncate font-semibold text-text-primary">{injury.playerName}</div>
                        <div className="mt-0.5 font-space-mono text-[12px] uppercase text-text-secondary">{injury.season} season</div>
                      </td>
                      {mode === "league" && <td className="px-3 py-3 font-space-mono font-bold text-text-secondary">{teams[injury.teamId]?.shortName ?? injury.teamId}</td>}
                      <td className="px-3 py-3 font-medium text-text-primary">{injury.conditionName}</td>
                      <td className="px-3 py-3"><span className={`inline-flex border px-2 py-1 font-space-mono text-[8px] font-bold uppercase ${categoryClass(injury.category)}`}>{injury.category}</span></td>
                      <td className="px-3 py-3 font-space-mono text-[12px] text-text-secondary">{displayDate(injury.startedOn)}</td>
                      <td className="px-3 py-3 font-space-mono text-[12px] text-text-secondary">{displayDate(injury.endedOn)}</td>
                      <td className="px-3 py-3 text-right font-space-mono text-[8px] font-bold uppercase">
                        <span className={injury.resolution === "worsened" ? "text-danger" : "text-success"}>
                          {injury.resolution === "worsened" ? "Worsened" : "Recovered"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex h-full min-h-64 flex-col items-center justify-center p-8 text-center">
                <Clock3 size={30} className="text-text-secondary" />
                <h3 className="mt-3 font-anton text-[18px] uppercase text-text-primary">No matching injury history</h3>
                <p className="mt-1 text-xs text-text-secondary">Recovered and worsened conditions will be recorded here.</p>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
