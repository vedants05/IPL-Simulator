"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { getInjuryReturnLabel, type InjuryCategory, type PlayerInjury } from "@/lib/logic/injuries";
import {
  MAX_INJURY_REPLACEMENTS_PER_TEAM,
  eligibleInjuryReplacementCandidates,
  injuryQualifiesForReplacement,
  replacementForInjury,
  teamReplacementCount,
  type InjuryReplacementRecord,
} from "@/lib/logic/injuryReplacements";
import type { Player, Team } from "@/lib/types";

type HubMode = "club" | "league";
type HubView = "active" | "history";

interface InjuryHubPageProps {
  mode: HubMode;
  userTeamId: string;
  activeInjuries: Record<string, PlayerInjury>;
  injuryHistory: PlayerInjury[];
  replacementRecords: InjuryReplacementRecord[];
  replacementPoolIds: string[];
  players: Record<string, Player>;
  teams: Record<string, Team>;
  seasonFinalDate?: string;
  currentDate: string;
  currentSeason: number;
  teamFinalLeagueDate?: string;
  onSignReplacement?: (injuryId: string, replacementPlayerId: string) => boolean;
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
  replacementRecords,
  replacementPoolIds,
  players,
  teams,
  seasonFinalDate,
  currentDate,
  currentSeason,
  teamFinalLeagueDate,
  onSignReplacement,
}: InjuryHubPageProps) {
  const [view, setView] = useState<HubView>("active");
  const [category, setCategory] = useState<"all" | InjuryCategory>("all");
  const [teamId, setTeamId] = useState("all");
  const [selectedReplacementInjuryId, setSelectedReplacementInjuryId] = useState<string | null>(null);

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
  const pendingReplacementInjuries = Object.values(activeInjuries)
    .filter((injury) => injury.teamId === userTeamId)
    .filter((injury) => injuryQualifiesForReplacement(injury, {
      date: currentDate,
      season: currentSeason,
      seasonFinalDate,
      teamFinalLeagueDate,
    }))
    .filter((injury) => !replacementForInjury(replacementRecords, injury.id));
  const selectedReplacementInjury = pendingReplacementInjuries.find(
    (injury) => injury.id === selectedReplacementInjuryId,
  ) ?? pendingReplacementInjuries[0];
  const replacementCandidates = selectedReplacementInjury
    ? eligibleInjuryReplacementCandidates({
        injury: selectedReplacementInjury,
        players,
        unsoldPlayerIds: replacementPoolIds,
        records: replacementRecords,
        season: currentSeason,
      }).sort((left, right) => (
        Math.max(right.currentBatting, right.currentBowling) - Math.max(left.currentBatting, left.currentBowling)
        || Math.max(right.potentialBatting, right.potentialBowling) - Math.max(left.potentialBatting, left.potentialBowling)
        || left.name.localeCompare(right.name)
      )).filter((candidate) => {
        const team = teams[userTeamId];
        if (!team) return false;
        const availableIds = team.squad.filter((playerId) => !activeInjuries[playerId]);
        if (availableIds.length >= (team.maxSquadSize ?? 25)) return false;
        if (candidate.nationality !== "Overseas") return true;
        const activeOverseas = availableIds.filter(
          (playerId) => players[playerId]?.nationality === "Overseas",
        ).length;
        return activeOverseas < (team.overseasPlayersMax ?? 8);
      })
    : [];
  const userReplacementLimitReached = teamReplacementCount(
    replacementRecords,
    userTeamId,
    currentSeason,
  ) >= MAX_INJURY_REPLACEMENTS_PER_TEAM;

  const replacementName = (injury: PlayerInjury) => {
    const record = replacementForInjury(replacementRecords, injury.id)
      ?? replacementRecords.find((candidate) => candidate.season === injury.season && candidate.injuredPlayerId === injury.playerId);
    return record ? players[record.replacementPlayerId]?.name ?? record.replacementPlayerName ?? record.replacementPlayerId : "—";
  };

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
        {mode === "club" && pendingReplacementInjuries.length > 0 && (
          <div className="shrink-0 border-b-2 border-accent/35 bg-accent/5 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Injury replacement recruitment</p>
                <h3 className="mt-1 font-anton text-[18px] uppercase text-text-primary">Choose from the unsold auction pool</h3>
                <p className="mt-1 text-xs text-text-secondary">The signing costs no remaining purse and cannot exceed the injured player&apos;s salary.</p>
              </div>
              {pendingReplacementInjuries.length > 1 && (
                <select
                  value={selectedReplacementInjury?.id ?? ""}
                  onChange={(event) => setSelectedReplacementInjuryId(event.target.value)}
                  className="h-9 border border-border bg-bg px-3 font-space-mono text-[9px] font-bold uppercase text-text-primary"
                >
                  {pendingReplacementInjuries.map((injury) => (
                    <option key={injury.id} value={injury.id}>Replace {injury.playerName}</option>
                  ))}
                </select>
              )}
            </div>
            {userReplacementLimitReached ? (
              <p className="mt-3 border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">The five-replacement limit has been reached for this season.</p>
            ) : replacementCandidates.length > 0 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {replacementCandidates.map((candidate) => (
                  <div key={candidate.id} className="min-w-56 border border-border bg-surface p-3">
                    <div className="truncate font-semibold text-text-primary">{candidate.name}</div>
                    <div className="mt-1 font-space-mono text-[9px] uppercase text-text-secondary">
                      {candidate.role} · CA {Math.max(candidate.currentBatting, candidate.currentBowling)} · PA {Math.max(candidate.potentialBatting, candidate.potentialBowling)}
                    </div>
                    <div className="mt-1 font-space-mono text-[9px] text-text-secondary">Base price ₹{(candidate.basePrice / 100).toFixed(2)} Cr</div>
                    <button
                      type="button"
                      onClick={() => selectedReplacementInjury && onSignReplacement?.(selectedReplacementInjury.id, candidate.id)}
                      className="mt-3 w-full border border-accent bg-accent px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase text-white hover:bg-accent/85"
                    >
                      Sign replacement
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 border border-border bg-bg px-3 py-2 text-xs text-text-secondary">No eligible unsold player currently fits the salary ceiling. This action remains open until your final league match.</p>
            )}
          </div>
        )}
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

        <div className="min-h-0 flex-1 overflow-auto">
          {view === "active" && (
            active.length > 0 ? (
              <table className="w-full min-w-[1120px] table-fixed text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-border bg-bg font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="w-[17%] px-5 py-3">Player</th>
                    {mode === "league" && <th className="w-[7%] px-3 py-3">Club</th>}
                    <th className="w-[16%] px-3 py-3">Condition</th>
                    <th className="w-[8%] px-3 py-3">Severity</th>
                    <th className="w-[10%] px-3 py-3">Worsening risk</th>
                    <th className="w-[18%] px-3 py-3">Injury replacement</th>
                    <th className="w-[16%] px-3 py-3">Estimated return</th>
                    <th className="w-[8%] px-3 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {active.map((injury) => {
                    const activeTeamId = getActiveTeamId(injury);
                    return (
                      <tr key={injury.id} className="hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                        <td className="px-5 py-3">
                          <div className="line-clamp-2 font-semibold leading-4 text-text-primary">{players[injury.playerId]?.name ?? injury.playerName}</div>
                          <div className="mt-0.5 whitespace-nowrap font-space-mono text-[12px] uppercase text-text-secondary">Since {displayDate(injury.startedOn)}</div>
                        </td>
                        {mode === "league" && <td className="px-3 py-3 font-space-mono font-bold text-text-secondary">{teams[activeTeamId]?.shortName ?? activeTeamId}</td>}
                        <td className="px-3 py-3 font-medium leading-4 text-text-primary"><span className="line-clamp-2">{injury.conditionName}</span></td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex border px-2 py-1 font-space-mono text-[8px] font-bold uppercase ${categoryClass(injury.category)}`}>{injury.category}</span>
                        </td>
                        <td className="px-3 py-3 font-space-mono text-[9px] font-bold uppercase text-text-secondary">{riskLabel(injury)}</td>
                        <td className="px-3 py-3 text-xs font-semibold leading-4 text-text-primary"><span className="line-clamp-2">{replacementName(injury)}</span></td>
                        <td className="px-3 py-3 font-space-mono text-[12px] leading-4 text-text-primary"><span className="line-clamp-2">{getInjuryReturnLabel(injury, seasonFinalDate)}</span></td>
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
              <table className="w-full min-w-[1080px] table-fixed text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-border bg-bg font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="w-[17%] px-5 py-3">Player</th>
                    {mode === "league" && <th className="w-[7%] px-3 py-3">Club</th>}
                    <th className="w-[17%] px-3 py-3">Condition</th>
                    <th className="w-[8%] px-3 py-3">Severity</th>
                    <th className="w-[12%] px-3 py-3">Started</th>
                    <th className="w-[18%] px-3 py-3">Injury replacement</th>
                    <th className="w-[12%] px-3 py-3">Ended</th>
                    <th className="w-[9%] px-3 py-3 text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((injury) => (
                    <tr key={`${injury.id}:${injury.endedOn}`} className="hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                      <td className="px-5 py-3">
                        <div className="line-clamp-2 font-semibold leading-4 text-text-primary">{injury.playerName}</div>
                        <div className="mt-0.5 font-space-mono text-[12px] uppercase text-text-secondary">{injury.season} season</div>
                      </td>
                      {mode === "league" && <td className="px-3 py-3 font-space-mono font-bold text-text-secondary">{teams[injury.teamId]?.shortName ?? injury.teamId}</td>}
                      <td className="px-3 py-3 font-medium leading-4 text-text-primary"><span className="line-clamp-2">{injury.conditionName}</span></td>
                      <td className="px-3 py-3"><span className={`inline-flex border px-2 py-1 font-space-mono text-[8px] font-bold uppercase ${categoryClass(injury.category)}`}>{injury.category}</span></td>
                      <td className="px-3 py-3 font-space-mono text-[12px] text-text-secondary">{displayDate(injury.startedOn)}</td>
                      <td className="px-3 py-3 text-xs font-semibold leading-4 text-text-primary"><span className="line-clamp-2">{replacementName(injury)}</span></td>
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
