"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Crown, ShieldCheck, Sparkles, Trophy } from "lucide-react";

import { LEAGUE_HALL_OF_FAME, type HallOfFameRole, type LeagueHallOfFameMember } from "@/lib/data/leagueHallOfFame";
import { LEAGUE_HISTORY_TEAMS } from "@/lib/data/leagueHistory";
import type { Player, Team } from "@/lib/types";

interface LeagueHallOfFameProps {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  onOpenPlayer: (playerId: string) => void;
}

type HallFilter = "All" | HallOfFameRole;

const HALL_FILTERS: HallFilter[] = ["All", "Batter", "Wicketkeeper", "All-rounder", "Bowler"];

const normalizeName = (name: string) => name.toLocaleLowerCase("en-GB").replace(/[^a-z0-9]/g, "");

const getInitials = (name: string) => name
  .split(" ")
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join("");

export default function LeagueHallOfFame({ players, teams, onOpenPlayer }: LeagueHallOfFameProps) {
  const [activeFilter, setActiveFilter] = useState<HallFilter>("All");
  const playersByName = useMemo(() => {
    const mappedPlayers = new Map<string, Player>();
    Object.values(players).forEach((player) => mappedPlayers.set(normalizeName(player.name), player));
    return mappedPlayers;
  }, [players]);

  const filteredMembers = activeFilter === "All"
    ? LEAGUE_HALL_OF_FAME
    : LEAGUE_HALL_OF_FAME.filter((member) => member.role === activeFilter);
  const cornerstoneMembers = LEAGUE_HALL_OF_FAME.filter((member) => member.cornerstone);
  const galleryMembers = activeFilter === "All"
    ? LEAGUE_HALL_OF_FAME.filter((member) => !member.cornerstone)
    : filteredMembers;

  const getTeam = (teamId: string) => {
    const liveTeam = teams[teamId];
    if (liveTeam) return liveTeam;
    return LEAGUE_HISTORY_TEAMS[teamId] ?? {
      id: teamId,
      name: teamId,
      shortName: teamId,
      primaryColor: "#68616f",
      secondaryColor: "#ffffff",
    };
  };

  const renderTeamMarks = (member: LeagueHallOfFameMember) => (
    <span className="flex flex-wrap gap-1.5">
      {member.teamIds.map((teamId) => {
        const team = getTeam(teamId);
        return (
          <span
            key={teamId}
            className="border px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase tracking-wider"
            style={{ borderColor: `${team.primaryColor}80`, color: team.primaryColor }}
            title={team.name}
          >
            {team.shortName}
          </span>
        );
      })}
    </span>
  );

  return (
    <section className="flex h-[calc(100vh-200px)] min-h-[500px] flex-col overflow-hidden border-2 border-border bg-surface">
      <header className="relative shrink-0 overflow-hidden border-b-2 border-[#c9a95f]/55 bg-[#f6edd9] px-6 py-5 text-[#261f15] dark:border-[#d6ad55]/45 dark:bg-[#100d17] dark:text-white">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#8d68c7]/10 blur-3xl dark:bg-[#6f3db5]/30" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-2/5 bg-[radial-gradient(circle_at_center,rgba(184,137,46,0.16),transparent_68%)] dark:bg-[radial-gradient(circle_at_center,rgba(214,173,85,0.22),transparent_68%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d6ad55] to-transparent" />

        <div className="relative flex items-end justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#b8892e]/50 bg-white/45 shadow-[0_0_35px_rgba(184,137,46,0.13)] dark:border-[#d6ad55]/60 dark:bg-[#d6ad55]/10 dark:shadow-[0_0_35px_rgba(214,173,85,0.18)]">
              <Crown size={27} className="text-[#946514] dark:text-[#e7c576]" />
            </div>
            <div>
              <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.32em] text-[#8d6218] dark:text-[#d6ad55]">Immortals of the Indian Premier League</p>
              <h3 className="mt-1 font-anton text-[32px] uppercase leading-none tracking-wide">League Hall of Fame</h3>
              <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-[#6e6250] dark:text-white/55">
                The first-ballot class: players whose leadership, records and defining moments permanently shaped the league.
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-7 lg:flex">
            <div className="text-right">
              <div className="font-anton text-[28px] leading-none text-[#946514] dark:text-[#e7c576]">{LEAGUE_HALL_OF_FAME.length}</div>
              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-[#746957] dark:text-white/40">Founding class</div>
            </div>
            <div className="h-9 w-px bg-[#261f15]/15 dark:bg-white/15" />
            <div className="flex items-center gap-2 text-[#6e6250] dark:text-white/55">
              <ShieldCheck size={17} className="text-[#946514] dark:text-[#d6ad55]" />
              <span className="font-space-mono text-[8px] font-bold uppercase tracking-wider">First ballot</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-black/[0.025] px-6 py-3 dark:bg-white/[0.025]">
        <div className="flex items-center gap-2 overflow-x-auto">
          {HALL_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 border px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase tracking-wider transition-colors ${activeFilter === filter ? "border-[#8b631e] bg-[#8b631e] text-white dark:border-[#b68a32] dark:bg-[#b68a32]" : "border-border bg-surface text-text-secondary hover:border-[#b68a32]/60 hover:text-text-primary"}`}
            >
              {filter === "All" ? "All inductees" : filter}
            </button>
          ))}
        </div>
        <span className="hidden shrink-0 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary sm:block">
          {filteredMembers.length} {filteredMembers.length === 1 ? "member" : "members"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(20,16,28,0.025),transparent_16rem)] px-6 py-5">
        {activeFilter === "All" && (
          <div className="mb-7">
            <div className="mb-3 flex items-center gap-3">
              <Sparkles size={14} className="text-[#b68a32]" />
              <h4 className="font-anton text-[15px] uppercase tracking-wide text-text-primary">The Cornerstones</h4>
              <div className="h-px flex-1 bg-gradient-to-r from-[#b68a32]/40 to-transparent" />
              <span className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-text-secondary">No ranking · Shared distinction</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {cornerstoneMembers.map((member) => {
                const team = getTeam(member.primaryTeamId);
                const linkedPlayer = playersByName.get(normalizeName(member.name));
                return (
                  <button
                    key={member.name}
                    type="button"
                    disabled={!linkedPlayer}
                    onClick={() => linkedPlayer && onOpenPlayer(linkedPlayer.id)}
                    className="group relative min-h-44 overflow-hidden border border-[#d2b873] bg-[linear-gradient(145deg,#fffdf7,#f0e4cb)] p-4 text-left text-text-primary shadow-[0_5px_16px_rgba(73,56,28,0.09)] transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-[#a9781e] enabled:hover:shadow-lg disabled:cursor-default dark:border-[#d6ad55]/35 dark:bg-[#15111d] dark:bg-none dark:text-white dark:shadow-sm dark:enabled:hover:border-[#d6ad55]"
                    title={linkedPlayer ? `Open ${linkedPlayer.name}'s player profile` : `${member.name} is not in the current player database`}
                  >
                    <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: team.primaryColor }} />
                    <div className="pointer-events-none absolute -right-9 -top-9 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: team.primaryColor }} />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#a9781e]/40 bg-white/55 font-anton text-lg text-[#8d6218] dark:border-[#d6ad55]/40 dark:bg-[#d6ad55]/10 dark:text-[#e7c576]">
                          {getInitials(member.name)}
                        </span>
                        <Trophy size={15} className="text-[#946514]/75 dark:text-[#d6ad55]/70" />
                      </div>
                      <div className="mt-auto pt-4">
                        <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-[#8d6218] dark:text-[#d6ad55]/80">{member.role} · {member.era}</p>
                        <h5 className="mt-1 font-anton text-[21px] uppercase leading-none">{member.name}</h5>
                        <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#6e6250] dark:text-white/55">{member.legacy}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-3 flex items-center gap-3">
          <h4 className="font-anton text-[15px] uppercase tracking-wide text-text-primary">{activeFilter === "All" ? "Founding Class" : `${activeFilter} Inductees`}</h4>
          <div className="h-px flex-1 bg-gradient-to-r from-[#b68a32]/35 to-transparent" />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {galleryMembers.map((member) => {
            const team = getTeam(member.primaryTeamId);
            const linkedPlayer = playersByName.get(normalizeName(member.name));
            return (
              <button
                key={member.name}
                type="button"
                disabled={!linkedPlayer}
                onClick={() => linkedPlayer && onOpenPlayer(linkedPlayer.id)}
                className="group relative flex min-h-36 overflow-hidden border border-border bg-surface p-4 text-left shadow-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-[#b68a32] enabled:hover:shadow-md disabled:cursor-default"
                title={linkedPlayer ? `Open ${linkedPlayer.name}'s player profile` : `${member.name} is not in the current player database`}
              >
                <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: team.primaryColor }} />
                <span className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-anton text-base" style={{ borderColor: `${team.primaryColor}80`, color: team.primaryColor, backgroundColor: `${team.primaryColor}12` }}>
                  {getInitials(member.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-start justify-between gap-2">
                    <span>
                      <span className="block font-space-mono text-[7px] font-bold uppercase tracking-[0.15em] text-text-secondary">{member.role} · {member.nationality}</span>
                      <span className="mt-1 block font-anton text-[18px] uppercase leading-none text-text-primary">{member.name}</span>
                    </span>
                    {linkedPlayer && <ChevronRight size={14} className="shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-[#b68a32]" />}
                  </span>
                  <span className="mt-2 block text-[10px] leading-relaxed text-text-secondary">{member.legacy}</span>
                  <span className="mt-auto flex items-end justify-between gap-3 pt-3">
                    {renderTeamMarks(member)}
                    <span className="shrink-0 font-space-mono text-[7px] font-bold uppercase text-text-secondary">{member.era}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
