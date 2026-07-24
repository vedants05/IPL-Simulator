"use client";

import { useState } from "react";
import {
  Check,
  Clock3,
  Crown,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRoundX,
} from "lucide-react";

import {
  appointCaptain,
  appointViceCaptain,
  confirmCaptainChange,
  getCaptainChangeGamesRemaining,
  getCaptaincyInterestStatus,
  normalizeTeamLeadership,
  recommendTeamLeadership,
  sortByCaptaincy,
  type TeamLeadership,
} from "@/lib/logic/captaincy";
import type { Player, Team } from "@/lib/types";

interface CaptaincyPageProps {
  team: Team;
  players: Record<string, Player>;
  leadership: TeamLeadership;
  gamesPlayed: number;
  activeSeason: number;
  onChange: (leadership: TeamLeadership) => void;
  onOpenPlayer: (playerId: string) => void;
}

const captaincyTier = (rating: number) => {
  if (rating >= 85) return "Elite leader";
  if (rating >= 75) return "Strong leader";
  if (rating >= 60) return "Capable leader";
  return "Developing leader";
};

export default function CaptaincyPage({
  team,
  players,
  leadership: savedLeadership,
  gamesPlayed,
  activeSeason,
  onChange,
  onOpenPlayer,
}: CaptaincyPageProps) {
  const [pendingCaptainId, setPendingCaptainId] = useState<string | null>(null);
  const squad = team.squad
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player));
  const sortedSquad = sortByCaptaincy(squad);
  const leadership = normalizeTeamLeadership(savedLeadership, squad, gamesPlayed, activeSeason);
  const captain = leadership.captainId ? players[leadership.captainId] : null;
  const viceCaptain = leadership.viceCaptainId ? players[leadership.viceCaptainId] : null;
  const pendingCaptain = pendingCaptainId ? players[pendingCaptainId] : null;
  const captainChangeGamesRemaining = getCaptainChangeGamesRemaining(leadership, gamesPlayed);
  const interestedCount = squad.filter((player) => (
    getCaptaincyInterestStatus(player, leadership, activeSeason).interested
  )).length;

  const selectCaptain = (playerId: string) => {
    if (!captain) {
      onChange(appointCaptain(leadership, playerId, squad, gamesPlayed, activeSeason));
      return;
    }
    if (captain.id !== playerId && captainChangeGamesRemaining === 0) setPendingCaptainId(playerId);
  };
  const confirmPendingCaptain = () => {
    if (!pendingCaptainId) return;
    onChange(confirmCaptainChange(leadership, pendingCaptainId, squad, gamesPlayed, activeSeason));
    setPendingCaptainId(null);
  };
  const selectViceCaptain = (playerId: string) => onChange(appointViceCaptain(
    leadership,
    playerId,
    squad,
    gamesPlayed,
    activeSeason,
  ));

  return (
    <div className="relative flex h-[calc(100vh-200px)] min-h-0 flex-col overflow-hidden border-2 border-border bg-surface">
      <header className="flex shrink-0 items-center justify-between gap-5 border-b-2 border-border bg-[linear-gradient(110deg,rgba(var(--team-primary-rgb),0.12),transparent_48%)] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--team-primary)] text-[var(--team-accent-text)]">
            <Crown size={21} />
          </span>
          <div className="min-w-0">
            <p className="font-space-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">Leadership group</p>
            <h3 className="mt-0.5 font-anton text-[27px] uppercase leading-none text-text-primary">Captaincy</h3>
            <p className="mt-1 text-[12px] text-text-secondary">Appoint the captain and vice-captain who will lead {team.shortName}.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(recommendTeamLeadership(squad, leadership, gamesPlayed, activeSeason))}
          disabled={interestedCount === 0}
          className="flex shrink-0 items-center gap-2 border border-border bg-surface px-3 py-2 font-space-mono text-[10px] font-bold uppercase tracking-wide text-text-primary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles size={15} /> Recommend leaders
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.7fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-border bg-black/[0.018] p-4 dark:bg-white/[0.018]">
          <div className="mb-3">
            <p className="font-space-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-secondary">Current appointments</p>
            <h4 className="mt-1 font-anton text-[20px] uppercase text-text-primary">Team leadership</h4>
          </div>

          <div className="space-y-3">
            <section className={`border-2 bg-surface p-4 ${captain ? "border-accent" : "border-border"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[#16130f]"><Crown size={17} /></span>
                <span className="font-space-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Captain</span>
              </div>
              {captain ? (
                <div className="mt-4">
                  <button type="button" onClick={() => onOpenPlayer(captain.id)} className="max-w-full text-left text-[17px] font-bold text-text-primary hover:underline">{captain.name}</button>
                  <p className="mt-1 font-space-mono text-[10px] font-bold uppercase text-text-secondary">{captain.role} · Captaincy {captain.captaincy ?? 50}</p>
                  <span className={`mt-4 inline-flex items-center gap-1.5 px-2 py-1 font-space-mono text-[9px] font-bold uppercase ${captainChangeGamesRemaining > 0 ? "bg-danger/[0.1] text-danger" : "bg-success/[0.1] text-success"}`}>
                    {captainChangeGamesRemaining > 0 ? <LockKeyhole size={12} /> : <Check size={12} />}
                    {captainChangeGamesRemaining > 0
                      ? `Changes locked · ${captainChangeGamesRemaining} game${captainChangeGamesRemaining === 1 ? "" : "s"}`
                      : "Changes available with confirmation"}
                  </span>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-[15px] font-bold text-text-primary">No captain appointed</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">Choose an interested player from the squad list.</p>
                </div>
              )}
            </section>

            <section className={`border-2 bg-surface p-4 ${viceCaptain ? "border-success/70" : "border-border"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/[0.14] text-success"><ShieldCheck size={17} /></span>
                <span className="font-space-mono text-[10px] font-bold uppercase tracking-[0.14em] text-success">Vice-captain</span>
              </div>
              {viceCaptain ? (
                <div className="mt-4">
                  <button type="button" onClick={() => onOpenPlayer(viceCaptain.id)} className="max-w-full text-left text-[17px] font-bold text-text-primary hover:underline">{viceCaptain.name}</button>
                  <p className="mt-1 font-space-mono text-[10px] font-bold uppercase text-text-secondary">{viceCaptain.role} · Captaincy {viceCaptain.captaincy ?? 50}</p>
                  <button type="button" onClick={() => onChange({ ...leadership, viceCaptainId: null })} className="mt-4 font-space-mono text-[9px] font-bold uppercase tracking-wide text-danger hover:underline">Remove appointment</button>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-[15px] font-bold text-text-primary">No vice-captain appointed</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">Choose a different interested player as deputy.</p>
                </div>
              )}
            </section>
          </div>

          <div className="mt-3 border border-border bg-surface p-3">
            <p className="font-space-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-secondary">Selection rules</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-text-secondary">
              <li>Captain and vice-captain must be different players.</li>
              <li>Replacing an appointed captain always requires confirmation.</li>
              <li>A confirmed change locks captain changes for the next three games.</li>
              <li>An outgoing captain under 33 is not interested for now and can recover after the following season.</li>
              <li>An outgoing captain aged 33 or older becomes permanently uninterested.</li>
              <li>Players marked not interested cannot hold either appointment.</li>
            </ul>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-end justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-space-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-secondary">All contracted players</p>
              <h4 className="mt-1 font-anton text-[20px] uppercase text-text-primary">Squad candidates</h4>
            </div>
            <span className="font-space-mono text-[10px] font-bold uppercase text-text-secondary">{interestedCount}/{squad.length} interested</span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <div className="min-w-[56rem]">
              <div className="grid grid-cols-[minmax(14rem,1.25fr)_minmax(11rem,0.9fr)_minmax(10rem,0.8fr)_minmax(16rem,1.1fr)] items-center gap-3 border-b border-border bg-black/[0.035] px-4 py-2 font-space-mono text-[9px] font-bold uppercase tracking-wide text-text-secondary dark:bg-white/[0.035]">
                <span>Player</span>
                <span>Captaincy stat</span>
                <span>IPL captaincy interest</span>
                <span className="text-right">Appointment</span>
              </div>

              {sortedSquad.map((player) => {
                const rating = player.captaincy ?? 50;
                const interest = getCaptaincyInterestStatus(player, leadership, activeSeason);
                const interested = interest.interested;
                const isCaptain = leadership.captainId === player.id;
                const isViceCaptain = leadership.viceCaptainId === player.id;
                const captainChangeLocked = Boolean(captain && !isCaptain && captainChangeGamesRemaining > 0);
                const captainButtonDisabled = !interested || captainChangeLocked;
                const viceButtonDisabled = !interested || isCaptain;
                const unavailableReason = interest.temporarilyUnavailable
                  ? `${player.name} is not interested for now`
                  : `${player.name} is not interested in IPL captaincy`;

                return (
                  <div
                    key={player.id}
                    className={`grid min-h-[4.25rem] grid-cols-[minmax(14rem,1.25fr)_minmax(11rem,0.9fr)_minmax(10rem,0.8fr)_minmax(16rem,1.1fr)] items-center gap-3 border-b border-[#16130f]/10 px-4 py-2.5 transition-colors dark:border-white/10 ${isCaptain ? "bg-accent/[0.08]" : isViceCaptain ? "bg-success/[0.055]" : "hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"}`}
                  >
                    <button type="button" onClick={() => onOpenPlayer(player.id)} className="flex min-w-0 items-center gap-2 text-left">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-space-mono text-[10px] font-bold ${isCaptain ? "bg-accent text-[#16130f]" : isViceCaptain ? "bg-success text-white" : "bg-black/[0.055] text-text-secondary dark:bg-white/[0.07]"}`}>
                        {isCaptain ? "C" : isViceCaptain ? "VC" : player.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <strong className="truncate text-[13px] text-text-primary hover:underline">{player.name}</strong>
                          {player.nationality === "Overseas" && <span className="shrink-0 rounded-[2px] bg-[#1d55c4] px-1 py-0.5 font-space-mono text-[8px] font-bold leading-none text-white">OS</span>}
                        </span>
                        <small className="mt-0.5 block truncate font-space-mono text-[9px] font-bold uppercase text-text-secondary">{player.role} · Age {player.age}</small>
                      </span>
                    </button>

                    <span className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2">
                      <strong className="font-space-mono text-[17px] text-text-primary">{rating}</strong>
                      <span className="min-w-0">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.09]">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(99, rating))}%` }} />
                        </span>
                        <small className="mt-1 block truncate font-space-mono text-[8px] font-bold uppercase text-text-secondary">{captaincyTier(rating)}</small>
                      </span>
                    </span>

                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 font-space-mono text-[9px] font-bold uppercase ${interested ? "bg-success/[0.12] text-success" : interest.temporarilyUnavailable ? "bg-amber-500/[0.14] text-amber-700 dark:text-amber-300" : "bg-danger/[0.12] text-danger"}`}>
                      {interested ? <Check size={12} /> : interest.temporarilyUnavailable ? <Clock3 size={12} /> : <UserRoundX size={12} />}
                      {interested
                        ? "Interested"
                        : interest.temporarilyUnavailable
                          ? "Not interested for now"
                          : "Not interested"}
                    </span>

                    <span className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => selectCaptain(player.id)}
                        disabled={captainButtonDisabled}
                        title={!interested
                          ? unavailableReason
                          : captainChangeLocked
                            ? `Captain changes are locked for ${captainChangeGamesRemaining} more game${captainChangeGamesRemaining === 1 ? "" : "s"}`
                            : captain
                              ? `Propose ${player.name} as captain; confirmation required`
                              : `Appoint ${player.name} as captain`}
                        className={`min-w-[6.6rem] border px-2 py-1.5 font-space-mono text-[9px] font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${isCaptain ? "border-accent bg-accent text-[#16130f]" : "border-border bg-surface text-text-primary hover:border-accent hover:text-accent"}`}
                      >
                        {isCaptain ? "Captain" : "Make captain"}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectViceCaptain(player.id)}
                        disabled={viceButtonDisabled}
                        title={!interested
                          ? unavailableReason
                          : isCaptain
                            ? "The current captain cannot be moved to vice-captain without a confirmed captain change"
                            : `Appoint ${player.name} as vice-captain`}
                        className={`min-w-[7.2rem] border px-2 py-1.5 font-space-mono text-[9px] font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${isViceCaptain ? "border-success bg-success text-white" : "border-border bg-surface text-text-primary hover:border-success hover:text-success"}`}
                      >
                        {isViceCaptain ? "Vice-captain" : "Make vice"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {captain && pendingCaptain && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-6 backdrop-blur-[2px]" onMouseDown={() => setPendingCaptainId(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="captain-change-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-lg border-2 border-border bg-surface p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/[0.12] text-danger"><Crown size={19} /></span>
              <div>
                <p className="font-space-mono text-[9px] font-bold uppercase tracking-[0.16em] text-danger">Confirmation required</p>
                <h4 id="captain-change-title" className="mt-1 font-anton text-[23px] uppercase text-text-primary">Change team captain?</h4>
                <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">This replaces <strong className="text-text-primary">{captain.name}</strong> with <strong className="text-text-primary">{pendingCaptain.name}</strong>.</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="border border-border bg-black/[0.025] p-3 dark:bg-white/[0.025]">
                <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Outgoing</span>
                <strong className="mt-1 block truncate text-[13px] text-text-primary">{captain.name}</strong>
              </div>
              <span className="font-space-mono text-[12px] font-bold text-text-secondary">→</span>
              <div className="border border-accent bg-accent/[0.07] p-3">
                <span className="font-space-mono text-[8px] font-bold uppercase text-accent">Incoming</span>
                <strong className="mt-1 block truncate text-[13px] text-text-primary">{pendingCaptain.name}</strong>
              </div>
            </div>

            <div className="mt-4 border border-danger/30 bg-danger/[0.07] p-3 text-[11px] leading-relaxed text-text-secondary">
              Confirming locks further captain changes for <strong className="text-text-primary">three games</strong>. {captain.age < 33
                ? `${captain.name} will be marked “Not interested for now” and can recover after the ${activeSeason + 1} season.`
                : `${captain.name} will become permanently uninterested in IPL captaincy.`}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingCaptainId(null)} className="border border-border bg-surface px-4 py-2 font-space-mono text-[10px] font-bold uppercase text-text-primary hover:border-text-secondary">Cancel</button>
              <button type="button" onClick={confirmPendingCaptain} className="border border-danger bg-danger px-4 py-2 font-space-mono text-[10px] font-bold uppercase text-white hover:bg-danger/90">Confirm captain change</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
