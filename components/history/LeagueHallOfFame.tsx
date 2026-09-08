"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Crown, ShieldCheck, Sparkles, Trophy } from "lucide-react";

import { LEAGUE_HALL_OF_FAME, type HallOfFameRole, type LeagueHallOfFameMember } from "@/lib/data/leagueHallOfFame";
import { LEAGUE_HISTORY_TEAMS } from "@/lib/data/leagueHistory";
import { evaluateCareerHallOfFame } from "@/lib/logic/hallOfFame";
import { useGameStore } from "@/lib/store/gameStore";
import { readableOn } from "@/lib/theme/teams";
import type { Player, Team } from "@/lib/types";

export const isValidTeamId = (teamId?: string | null): teamId is string => {
  if (!teamId) return false;
  const clean = teamId.trim().toUpperCase();
  return (
    clean !== "" &&
    clean !== "UNSOLD" &&
    clean !== "FREE AGENT" &&
    clean !== "NONE" &&
    clean !== "NULL" &&
    clean !== "UNDEFINED"
  );
};

const DARK_MODE_TEAM_COLORS: Record<string, string> = {
  GT: "#2d6bc4",
  KKR: "#552c87",
};

const safeReadableOn = (hexStr?: string): string => {
  if (!hexStr) return "#ffffff";
  try {
    let clean = hexStr.trim().replace(/^#/, "");
    if (clean.length === 3) {
      clean = clean.split("").map((c) => c + c).join("");
    }
    if (clean.length === 6) {
      return readableOn(`#${clean}`);
    }
    return "#ffffff";
  } catch {
    return "#ffffff";
  }
};

const getBadgeColors = (team: { id?: string; primaryColor?: string }) => {
  const lightBg = (team.primaryColor || "#555555").trim();
  const darkBg = (team.id && DARK_MODE_TEAM_COLORS[team.id]) ? DARK_MODE_TEAM_COLORS[team.id] : lightBg;
  const lightFg = safeReadableOn(lightBg);
  const darkFg = safeReadableOn(darkBg);
  return { lightBg, darkBg, lightFg, darkFg };
};

interface LeagueHallOfFameProps {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  onOpenPlayer: (playerId: string) => void;
}

type HallFilter = "All" | HallOfFameRole;

export interface DynamicHallOfFameMember extends LeagueHallOfFameMember {
  id?: string;
  score?: number;
  isCareerInductee?: boolean;
}

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
  const retiredPlayerSnapshots = useGameStore((state) => state.retiredPlayerSnapshots);
  const simulatedLeagueHistory = useGameStore((state) => state.simulatedLeagueHistory) ?? [];

  // Map players and retired snapshots to their IDs for direct profile access
  const candidatePlayersByName = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(players).forEach((p) => map.set(normalizeName(p.name), p.id));
    Object.values(retiredPlayerSnapshots).forEach((s) => {
      if (!map.has(normalizeName(s.name))) {
        map.set(normalizeName(s.name), s.id);
      }
    });
    return map;
  }, [players, retiredPlayerSnapshots]);

  const retiredPlayersByName = useMemo(() => {
    const mappedPlayers = new Map<string, number>();
    Object.values(retiredPlayerSnapshots).forEach((player) => {
      mappedPlayers.set(normalizeName(player.name), player.retirementSeason);
    });
    return mappedPlayers;
  }, [retiredPlayerSnapshots]);

  const getMemberEra = (member: LeagueHallOfFameMember) => {
    const retirementSeason = retiredPlayersByName.get(normalizeName(member.name));
    if (retirementSeason === undefined || !/present$/i.test(member.era)) return member.era;
    return member.era.replace(/present$/i, String(retirementSeason));
  };

  // Dynamically evaluate career players for Hall of Fame induction
  const dynamicHallOfFameMembers = useMemo<DynamicHallOfFameMember[]>(() => {
    const evaluations = evaluateCareerHallOfFame(players, retiredPlayerSnapshots, simulatedLeagueHistory);
    const foundingSet = new Set(LEAGUE_HALL_OF_FAME.map((m) => normalizeName(m.name)));

    // Candidates that qualify and are not already in founding class
    const candidates = evaluations.filter((e) => e.inducted && !foundingSet.has(normalizeName(e.name)));

    return candidates.map((candidate) => {
      const playerOrSnapshot = players[candidate.playerId] ?? retiredPlayerSnapshots[candidate.playerId];
      const iplHistory = playerOrSnapshot?.iplHistory ?? [];

      const teamSeasonsCount: Record<string, number> = {};
      iplHistory.forEach((entry) => {
        if (isValidTeamId(entry.teamId)) {
          const tid = entry.teamId.trim().toUpperCase();
          teamSeasonsCount[tid] = (teamSeasonsCount[tid] || 0) + 1;
        }
      });
      if (playerOrSnapshot && "currentTeamId" in playerOrSnapshot && isValidTeamId(playerOrSnapshot.currentTeamId)) {
        const ctid = playerOrSnapshot.currentTeamId.trim().toUpperCase();
        teamSeasonsCount[ctid] = (teamSeasonsCount[ctid] || 0) + 1;
      }

      // If a player has both KXIP and PBKS, merge KXIP into PBKS and remove KXIP
      if (teamSeasonsCount["KXIP"] && teamSeasonsCount["PBKS"]) {
        teamSeasonsCount["PBKS"] += teamSeasonsCount["KXIP"];
        delete teamSeasonsCount["KXIP"];
      }

      const teamIds = Object.keys(teamSeasonsCount).sort((a, b) => teamSeasonsCount[b] - teamSeasonsCount[a]);
      const validCurrentTeamId =
        playerOrSnapshot && "currentTeamId" in playerOrSnapshot && isValidTeamId(playerOrSnapshot.currentTeamId)
          ? playerOrSnapshot.currentTeamId.trim().toUpperCase()
          : null;
      let primaryTeamId = teamIds[0] ?? validCurrentTeamId ?? "IPL";
      if (primaryTeamId === "KXIP" && (teamSeasonsCount["PBKS"] || validCurrentTeamId === "PBKS")) {
        primaryTeamId = "PBKS";
      }

      const seasons = iplHistory.map((h) => parseInt(h.season, 10)).filter((s) => !isNaN(s));
      const startSeason = seasons.length > 0 ? Math.min(...seasons) : 2024;
      let era = `${startSeason}–present`;
      if (candidate.isRetired && candidate.retirementSeason) {
        era = `${startSeason}–${candidate.retirementSeason}`;
      } else if (candidate.isRetired && seasons.length > 0) {
        era = `${startSeason}–${Math.max(...seasons)}`;
      }

      let role: HallOfFameRole = "Batter";
      const isWk = candidate.role === "WK-Batsman" || Boolean(playerOrSnapshot && "isWicketkeeper" in playerOrSnapshot && playerOrSnapshot.isWicketkeeper);
      if (isWk) {
        role = "Wicketkeeper";
      } else if (candidate.role === "All-Rounder") {
        role = "All-rounder";
      } else if (candidate.role === "Pace Bowler" || candidate.role === "Spin Bowler") {
        role = "Bowler";
      }

      const nationality = (playerOrSnapshot && ("country" in playerOrSnapshot ? playerOrSnapshot.country : playerOrSnapshot.nationality)) || "India";

      const accolades: string[] = [];
      if (candidate.orangeCaps > 0) accolades.push(`${candidate.orangeCaps}x Orange Cap`);
      if (candidate.purpleCaps > 0) accolades.push(`${candidate.purpleCaps}x Purple Cap`);
      if (candidate.seasonMvps > 0) accolades.push(`${candidate.seasonMvps}x MVP`);

      const statHighlight = role === "Bowler"
        ? `${candidate.wickets} wkts at ${candidate.bowlingAverage.toFixed(1)} avg (${candidate.economy.toFixed(2)} econ)`
        : role === "All-rounder"
          ? `${candidate.runs.toLocaleString()} runs & ${candidate.wickets} wkts`
          : `${candidate.runs.toLocaleString()} runs (${candidate.battingAverage.toFixed(1)} avg, ${candidate.strikeRate.toFixed(1)} SR)`;

      const reasons = candidate.qualificationReasons.filter((q) => !q.includes("Existing"));
      const keyReason = accolades.length > 0 ? accolades.join(", ") : reasons[0] ?? `${candidate.matches} matches`;
      const legacy = `${statHighlight}. ${keyReason}.`;

      return {
        id: candidate.playerId,
        name: candidate.name,
        role,
        nationality,
        primaryTeamId,
        teamIds: teamIds.length > 0 ? teamIds : (isValidTeamId(primaryTeamId) && primaryTeamId !== "IPL" ? [primaryTeamId] : []),
        era,
        legacy,
        score: candidate.score,
        isCareerInductee: true,
      };
    });
  }, [players, retiredPlayerSnapshots, simulatedLeagueHistory]);

  const cornerstoneMembers = useMemo(() => {
    return LEAGUE_HALL_OF_FAME.filter((member) => member.cornerstone);
  }, []);

  const foundingGalleryMembers = useMemo(() => {
    return LEAGUE_HALL_OF_FAME.filter((member) => !member.cornerstone);
  }, []);

  const allMembers = useMemo(() => {
    return [...LEAGUE_HALL_OF_FAME, ...dynamicHallOfFameMembers];
  }, [dynamicHallOfFameMembers]);

  const filteredMembers = useMemo(() => {
    if (activeFilter === "All") return allMembers;
    return allMembers.filter((member) => member.role === activeFilter);
  }, [activeFilter, allMembers]);

  const filteredCareerMembers = useMemo(() => {
    if (activeFilter === "All") return dynamicHallOfFameMembers;
    return dynamicHallOfFameMembers.filter((m) => m.role === activeFilter);
  }, [activeFilter, dynamicHallOfFameMembers]);

  const filteredFoundingMembers = useMemo(() => {
    if (activeFilter === "All") return foundingGalleryMembers;
    return LEAGUE_HALL_OF_FAME.filter((m) => m.role === activeFilter && !m.cornerstone);
  }, [activeFilter, foundingGalleryMembers]);

  const getTeam = (teamId: string) => {
    const cleanId = (teamId || "").trim().toUpperCase();
    const liveTeam = teams[cleanId];
    if (liveTeam) return liveTeam;
    return LEAGUE_HISTORY_TEAMS[cleanId] ?? {
      id: cleanId,
      name: cleanId,
      shortName: cleanId,
      primaryColor: "#68616f",
      secondaryColor: "#ffffff",
    };
  };

  const renderTeamMarks = (member: LeagueHallOfFameMember) => {
    let validTeamIds = member.teamIds.filter(isValidTeamId);
    if (validTeamIds.includes("KXIP") && validTeamIds.includes("PBKS")) {
      validTeamIds = validTeamIds.filter((id) => id !== "KXIP");
    }
    if (validTeamIds.length === 0 && isValidTeamId(member.primaryTeamId) && member.primaryTeamId !== "IPL") {
      const fallbackId = member.primaryTeamId === "KXIP" && member.teamIds.includes("PBKS") ? "PBKS" : member.primaryTeamId;
      validTeamIds.push(fallbackId);
    }
    if (validTeamIds.length === 0) return null;

    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {validTeamIds.map((teamId) => {
          const team = getTeam(teamId);
          const { lightBg, darkBg, lightFg, darkFg } = getBadgeColors(team);

          return (
            <span
              key={teamId}
              className="inline-flex items-center rounded-[3px] px-1.5 py-0.5 font-space-mono text-[7.5px] font-bold uppercase tracking-wider bg-[var(--badge-bg)] text-[var(--badge-fg)] dark:bg-[var(--badge-bg-dark)] dark:text-[var(--badge-fg-dark)] shadow-xs ring-1 ring-black/15 dark:ring-white/25 border border-black/10 dark:border-white/10"
              style={{
                "--badge-bg": lightBg,
                "--badge-fg": lightFg,
                "--badge-bg-dark": darkBg,
                "--badge-fg-dark": darkFg,
              } as React.CSSProperties}
              title={team.name}
            >
              {team.shortName}
            </span>
          );
        })}
      </span>
    );
  };

  const renderMemberCard = (member: DynamicHallOfFameMember) => {
    const effectivePrimaryTeamId =
      member.primaryTeamId === "KXIP" && member.teamIds.includes("PBKS") ? "PBKS" : member.primaryTeamId;
    const team = getTeam(effectivePrimaryTeamId);
    const linkedPlayerId = member.id ?? candidatePlayersByName.get(normalizeName(member.name));
    const { lightBg, darkBg, lightFg, darkFg } = getBadgeColors(team);

    return (
      <button
        key={member.name + (member.id ?? "")}
        type="button"
        disabled={!linkedPlayerId}
        onClick={() => linkedPlayerId && onOpenPlayer(linkedPlayerId)}
        className="group relative flex min-h-36 overflow-hidden border border-border bg-surface p-4 text-left shadow-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-[#b68a32] enabled:hover:shadow-md disabled:cursor-default"
        title={linkedPlayerId ? `Open ${member.name}'s player profile` : `${member.name} is not in the current player database`}
      >
        <span
          className="absolute inset-y-0 left-0 w-1 bg-[var(--accent-bar-light)] dark:bg-[var(--accent-bar-dark)]"
          style={{
            "--accent-bar-light": lightBg,
            "--accent-bar-dark": darkBg,
          } as React.CSSProperties}
        />
        <span
          className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-anton text-base shadow-xs ring-1 ring-black/15 dark:ring-white/25 bg-[var(--avatar-bg)] text-[var(--avatar-fg)] dark:bg-[var(--avatar-bg-dark)] dark:text-[var(--avatar-fg-dark)]"
          style={{
            "--avatar-bg": lightBg,
            "--avatar-fg": lightFg,
            "--avatar-bg-dark": darkBg,
            "--avatar-fg-dark": darkFg,
          } as React.CSSProperties}
        >
          {getInitials(member.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-start justify-between gap-2">
            <span>
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-space-mono text-[7px] font-bold uppercase tracking-[0.15em] text-text-secondary">
                  {member.role} · {member.nationality}
                </span>
                {member.isCareerInductee && (
                  <span className="rounded-[2px] border border-amber-500/60 bg-amber-500/10 px-1 py-0.5 font-space-mono text-[6.5px] font-bold uppercase text-amber-600 dark:text-amber-400">
                    Career Inductee
                  </span>
                )}
              </span>
              <span className="mt-1 block font-anton text-[18px] uppercase leading-none text-text-primary">{member.name}</span>
            </span>
            <div className="flex items-center gap-1">
              {member.score !== undefined && (
                <span className="font-space-mono text-[8px] font-bold text-amber-600 dark:text-amber-400" title={`Hall of Fame Score: ${member.score}`}>
                  {member.score.toFixed(1)}
                </span>
              )}
              {linkedPlayerId && (
                <ChevronRight size={14} className="shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-[#b68a32]" />
              )}
            </div>
          </span>
          <span className="mt-2 block text-[10px] leading-relaxed text-text-secondary">{member.legacy}</span>
          <span className="mt-auto flex items-end justify-between gap-3 pt-3">
            {renderTeamMarks(member)}
            <span className="shrink-0 font-space-mono text-[7px] font-bold uppercase text-text-secondary">{getMemberEra(member)}</span>
          </span>
        </span>
      </button>
    );
  };

  return (
    <section className="flex h-[calc(100vh-200px)] min-h-[500px] flex-col overflow-hidden border-2 border-border bg-surface">
      <header
        className="relative shrink-0 overflow-hidden border-b-2 border-[#c9a95f]/55 px-6 py-5 text-text-primary dark:border-[#d6ad55]/45"
        style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--surface2) 92%, #d6ad55 8%), var(--surface))" }}
      >
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
              <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-text-secondary">
                The pantheon of cricket greats: founding icons and legends inducted through extraordinary careers in the league.
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-7 lg:flex">
            <div className="text-right">
              <div className="font-anton text-[28px] leading-none text-[#946514] dark:text-[#e7c576]">{allMembers.length}</div>
              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                {dynamicHallOfFameMembers.length > 0
                  ? `${LEAGUE_HALL_OF_FAME.length} Founding · ${dynamicHallOfFameMembers.length} Career`
                  : "Founding class"}
              </div>
            </div>
            <div className="h-9 w-px bg-current opacity-15" />
            <div className="flex items-center gap-2 text-text-secondary">
              <ShieldCheck size={17} className="text-[#946514] dark:text-[#d6ad55]" />
              <span className="font-space-mono text-[8px] font-bold uppercase tracking-wider">Hall of Fame</span>
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
          <>
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
                  const linkedPlayerId = candidatePlayersByName.get(normalizeName(member.name));
                  const { lightBg, darkBg, lightFg, darkFg } = getBadgeColors(team);
                  return (
                    <button
                      key={member.name}
                      type="button"
                      disabled={!linkedPlayerId}
                      onClick={() => linkedPlayerId && onOpenPlayer(linkedPlayerId)}
                      className="group relative min-h-44 overflow-hidden border border-[#d2b873]/60 p-4 text-left text-text-primary shadow-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-[#a9781e] enabled:hover:shadow-lg disabled:cursor-default dark:border-[#d6ad55]/35 dark:enabled:hover:border-[#d6ad55]"
                      style={{ background: "linear-gradient(145deg, color-mix(in srgb, var(--surface2) 94%, #d6ad55 6%), var(--surface))" }}
                      title={linkedPlayerId ? `Open ${member.name}'s player profile` : `${member.name} is not in the current player database`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 w-1 bg-[var(--accent-bar-light)] dark:bg-[var(--accent-bar-dark)]"
                        style={{
                          "--accent-bar-light": lightBg,
                          "--accent-bar-dark": darkBg,
                        } as React.CSSProperties}
                      />
                      <div className="pointer-events-none absolute -right-9 -top-9 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: team.primaryColor }} />
                      <div className="relative flex h-full flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className="flex h-11 w-11 items-center justify-center rounded-full font-anton text-lg shadow-sm ring-2 ring-[#d6ad55] bg-[var(--avatar-bg)] text-[var(--avatar-fg)] dark:bg-[var(--avatar-bg-dark)] dark:text-[var(--avatar-fg-dark)]"
                            style={{
                              "--avatar-bg": lightBg,
                              "--avatar-fg": lightFg,
                              "--avatar-bg-dark": darkBg,
                              "--avatar-fg-dark": darkFg,
                            } as React.CSSProperties}
                          >
                            {getInitials(member.name)}
                          </span>
                          <Trophy size={15} className="text-[#946514]/75 dark:text-[#d6ad55]/70" />
                        </div>
                        <div className="mt-auto pt-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-[#8d6218] dark:text-[#d6ad55]/80">{member.role}</p>
                            <span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">{getMemberEra(member)}</span>
                          </div>
                          <h5 className="mt-1 font-anton text-[21px] uppercase leading-none">{member.name}</h5>
                          <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-text-secondary">{member.legacy}</p>
                          <div className="mt-3">
                            {renderTeamMarks(member)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {dynamicHallOfFameMembers.length > 0 && (
              <div className="mb-7">
                <div className="mb-3 flex items-center gap-3">
                  <Crown size={14} className="text-amber-500" />
                  <h4 className="font-anton text-[15px] uppercase tracking-wide text-text-primary">Career Inductees</h4>
                  <div className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-transparent" />
                  <span className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                    {dynamicHallOfFameMembers.length} Inducted During Simulation
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {dynamicHallOfFameMembers.map(renderMemberCard)}
                </div>
              </div>
            )}

            <div className="mb-3 flex items-center gap-3">
              <h4 className="font-anton text-[15px] uppercase tracking-wide text-text-primary">Founding Class</h4>
              <div className="h-px flex-1 bg-gradient-to-r from-[#b68a32]/35 to-transparent" />
              <span className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                {foundingGalleryMembers.length} Legends
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {foundingGalleryMembers.map(renderMemberCard)}
            </div>
          </>
        )}

        {activeFilter !== "All" && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <h4 className="font-anton text-[15px] uppercase tracking-wide text-text-primary">{activeFilter} Inductees</h4>
              <div className="h-px flex-1 bg-gradient-to-r from-[#b68a32]/35 to-transparent" />
              <span className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                {filteredMembers.length} Total ({filteredCareerMembers.length} Career · {filteredFoundingMembers.length + (cornerstoneMembers.some((m) => m.role === activeFilter) ? 1 : 0)} Founding)
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredMembers.map(renderMemberCard)}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
