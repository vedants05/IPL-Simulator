"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Filter, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { Player, Role, Team } from "@/lib/types";

type Scope = "season" | "ipl" | "t20";
type Op = "gt" | "gte" | "lt" | "lte" | "between" | "eq" | "contains";
type Condition = { id: number; key: string; op: Op; value: string; upper?: string; active: boolean };
type Filters = { minAge: string; maxAge: string; role: "all" | Role; scope: Scope; season: number; matchCount: number; conditions: Condition[] };
type Meta = { key: string; label: string; category: string; type: "number" | "text" | "select"; options?: string[]; defaultValue?: string };

const roles: Array<"all" | Role> = ["all", "Batsman", "WK-Batsman", "All-Rounder", "Pace Bowler", "Spin Bowler"];
const categories = ["Personal details", "Performance stats", "Attributes", "Advanced attributes"];
const ageOptions = [
  { value: "below 18", label: "< 18" },
  ...Array.from({ length: 22 }, (_, i) => {
    const age = 18 + i;
    return { value: String(age), label: String(age) };
  }),
  { value: "40+", label: "40+" },
];
const metadata: Meta[] = [
  { category: "Personal details", key: "name", label: "Player name", type: "text", defaultValue: "" },
  { category: "Personal details", key: "age", label: "Age", type: "number", defaultValue: "25" },
  { category: "Personal details", key: "state", label: "Indian state", type: "select" },
  { category: "Personal details", key: "country", label: "Country", type: "select" },
  { category: "Personal details", key: "team", label: "Current team", type: "select" },
  { category: "Personal details", key: "capped", label: "International status", type: "select", options: ["Capped", "Uncapped"] },
  { category: "Personal details", key: "battingStyle", label: "Batting hand", type: "select", options: ["Right-hand", "Left-hand"] },
  { category: "Personal details", key: "bowlingHand", label: "Bowling hand", type: "select", options: ["Right-hand", "Left-hand"] },
  { category: "Personal details", key: "bowlingStyle", label: "Bowling style", type: "select" },
  { category: "Personal details", key: "designation", label: "Playing designation", type: "select", options: ["Wicketkeeper", "Part-time keeper", "Opener", "Finisher", "Core batter"] },
  ...[["matches", "Matches", "5"], ["runs", "Runs", "100"], ["balls", "Balls faced", "100"], ["battingInnings", "Batting innings", "5"], ["battingAverage", "Batting average", "25"], ["strikeRate", "Strike rate", "130"], ["highestScore", "Highest score", "50"], ["fifties", "Fifties", "2"], ["hundreds", "Hundreds", "1"], ["fours", "Fours", "10"], ["sixes", "Sixes", "5"], ["wickets", "Wickets", "5"], ["oversBowled", "Overs bowled", "10"], ["runsConceded", "Runs conceded", "100"], ["bowlingAverage", "Bowling average", "30"], ["economy", "Economy", "8"], ["fourWickets", "Four-wicket hauls", "1"], ["fiveWickets", "Five-wicket hauls", "1"], ["catches", "Catches", "3"], ["stumpings", "Stumpings", "1"], ["runOuts", "Run outs", "1"], ["maidens", "Maidens", "1"], ["powerplayWickets", "Powerplay wickets", "2"]].map(([key, label, defaultValue]) => ({ category: "Performance stats", key, label, type: "number" as const, defaultValue })),
  ...[["currentBatting", "Current batting"], ["currentBowling", "Current bowling"], ["potentialBatting", "Potential batting"], ["potentialBowling", "Potential bowling"], ["reputation", "Reputation"], ["basePrice", "Base price"]].map(([key, label]) => ({ category: "Attributes", key, label, type: "number" as const, defaultValue: "60" })),
  ...[["captaincy", "Captaincy"], ["battingAggression", "Batting aggression"], ["paceRating", "Pace batting"], ["spinRating", "Spin batting"], ["powerplayBatting", "Powerplay batting"], ["middleOversBatting", "Middle-over batting"], ["deathBatting", "Death-over batting"], ["powerplayBowling", "Powerplay bowling"], ["middleOversBowling", "Middle-over bowling"], ["deathBowling", "Death-over bowling"], ["stamina", "Batting consistency"], ["consistency", "Bowling consistency"], ["pressureRating", "Pressure"], ["bigMatchRating", "Big match"], ["injuryProneness", "Injury proneness"], ["fieldingRating", "Fielding"], ["wicketkeepingRating", "Wicketkeeping"]].map(([key, label]) => ({ category: "Advanced attributes", key, label, type: "number" as const, defaultValue: "60" })),
];
const defaultFilters = (season: number): Filters => ({ minAge: "below 18", maxAge: "40+", role: "all", scope: "season", season, matchCount: 0, conditions: [] });
const control = "h-10 rounded-md border border-border bg-bg px-3 text-[12px] text-text-primary outline-none focus:border-accent";

export interface LeagueScoutingPageStat {
  matches?: number; runs?: number; balls?: number; wickets?: number; runsConceded?: number; oversBowled?: number;
  battingInnings?: number; dismissals?: number; highestScore?: number; fours?: number; sixes?: number;
  fifties?: number; hundreds?: number; fourWickets?: number; fiveWickets?: number; catches?: number;
  stumpings?: number; runOuts?: number; maidens?: number; powerplayWickets?: number;
}
type ResolvedScoutingStats = Record<string, number | undefined> & { matches: number; runs: number; wickets: number };
export interface LeagueScoutingPageProps {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  userTeamId: string;
  currentSeason: number;
  currentSeasonStats: Record<string, LeagueScoutingPageStat>;
  seasonArchives?: Array<{
    season: number;
    playerStats?: Record<string, any>;
    playerMatchLogs?: Record<string, unknown[]>;
  }>;
  scoutingReports?: unknown[];
  shortlist: string[];
  onToggleShortlist: (id: string) => void;
  onAnalyse: (id: string) => void;
}

export default function LeagueScoutingPage(props: LeagueScoutingPageProps) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [editingConditionId, setEditingConditionId] = useState<number | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string>(categories[0]);
  const [applied, setApplied] = useState<Filters>(() => defaultFilters(props.currentSeason));
  const [draft, setDraft] = useState<Filters>(() => defaultFilters(props.currentSeason));

  // Historical searches must retain every player who has appeared in the IPL,
  // including currently unsold and retired-history players.
  const players = useMemo(
    () => Object.values(props.players).filter((p) => (
      Boolean(p.currentTeamId && props.teams[p.currentTeamId])
      || (p.iplHistory ?? []).some((entry) => Boolean(entry.teamId && entry.teamId !== "UNSOLD"))
    )),
    [props.players, props.teams]
  );
  const seasons = useMemo(() => {
    const years = new Set<number>();

    // Current active season
    years.add(props.currentSeason);

    // Completed season archives from careerSeasonArchives
    for (const archive of props.seasonArchives ?? []) {
      if (typeof archive.season === "number" && Number.isFinite(archive.season)) {
        years.add(archive.season);
      }
    }

    // Historical entries in player IPL records (starting from simulation start year 2027)
    for (const p of Object.values(props.players)) {
      for (const h of p.iplHistory ?? []) {
        const yr = Number(h.season);
        if (Number.isFinite(yr) && yr >= 2027 && yr <= props.currentSeason) {
          years.add(yr);
        }
      }
    }

    // Any year between initial simulation year (2027) and currentSeason
    for (let yr = 2027; yr < props.currentSeason; yr++) {
      years.add(yr);
    }

    return Array.from(years)
      .sort((a, b) => b - a)
      .map(String);
  }, [props.players, props.currentSeason, props.seasonArchives]);

  const latestSimulatedSeason = Number(seasons[0] ?? props.currentSeason);
  const dynamicOptions = useMemo(
    () => ({
      state: unique(players.map((p) => p.state)),
      country: unique(players.map((p) => p.country || p.nationality)),
      team: Object.values(props.teams).map((t) => t.name).sort(),
      bowlingStyle: unique(players.map((p) => p.bowlingStyle)),
    }),
    [players, props.teams]
  );
  const resolvedMeta = (key: string) => {
    const item = metadata.find((m) => m.key === key)!;
    return { ...item, options: item.options ?? dynamicOptions[key as keyof typeof dynamicOptions] };
  };

  const results = useMemo(() => players.flatMap((player) => {
    if (query && !player.name.toLowerCase().includes(query.trim().toLowerCase())) return [];
    if (applied.role !== "all" && player.role !== applied.role) return [];
    if (!ageMatches(player.age, applied.minAge, applied.maxAge)) return [];

    let seasonStats: LeagueScoutingPageStat | undefined;
    if (applied.season === props.currentSeason) {
      seasonStats = props.currentSeasonStats[player.id];
    } else {
      const archive = props.seasonArchives?.find((candidate) => candidate.season === applied.season);
      const archivedStats = archive?.playerStats?.[player.id] as LeagueScoutingPageStat | undefined;
      const historyStats = (player.iplHistory ?? [])
        .filter((entry) => Number(entry.season) === applied.season && entry.seasonStats)
        .map((entry) => entry.seasonStats as LeagueScoutingPageStat);
      const matchLogStats = resolveArchivedMatchLogs(archive?.playerMatchLogs?.[player.id]);
      seasonStats = mergeSeasonStatSources([archivedStats, ...historyStats, matchLogStats]);
    }

    const stats = applied.scope === "season"
      ? resolveSeasonStats(seasonStats)
      : applied.scope === "ipl"
      ? resolveIplStats(player)
      : resolveT20Stats(player);
    const activeConditions = applied.conditions.filter((condition) => condition.active);
    const conditionResults = activeConditions.map((condition) => (
      conditionMatches(conditionValue(condition.key, player, stats, props.teams), condition)
    ));
    if (conditionResults.length > 0) {
      const requiredMatches = Math.min(Math.max(1, applied.matchCount), conditionResults.length);
      if (conditionResults.filter(Boolean).length < requiredMatches) return [];
    }
    return [{ player, stats, ability: Math.max(player.currentBatting, player.currentBowling) }];
  }).sort((a, b) => b.ability - a.ability), [players, query, applied, props]);

  const openFilters = () => {
    const season = applied.scope === "season" && !seasons.includes(String(applied.season)) ? latestSimulatedSeason : applied.season;
    setDraft({ ...applied, season, conditions: applied.conditions.map((c) => ({ ...c })) });
    setAddPanelOpen(false);
    setEditingConditionId(null);
    setHoveredCategory(categories[0]);
    setModalOpen(true);
  };
  const addCondition = (meta: Meta = metadata.find((item) => item.key === "wickets")!) => {
    setDraft((current) => {
      const activeCount = current.conditions.filter((condition) => condition.active).length;
      const wasMatchingAll = current.matchCount === activeCount;
      return {
        ...current,
        matchCount: activeCount === 0 || wasMatchingAll ? activeCount + 1 : current.matchCount,
        conditions: [
        ...current.conditions,
        {
          id: Date.now() + Math.random(),
          key: meta.key,
          op: meta.type === "number" ? "gte" : meta.type === "text" ? "contains" : "eq",
          value: meta.defaultValue ?? meta.options?.[0] ?? dynamicOptions[meta.key as keyof typeof dynamicOptions]?.[0] ?? "",
          active: true,
        },
      ],
      };
    });
  };
  const updateCondition = (id: number, patch: Partial<Condition>) => setDraft((current) => ({ ...current, conditions: current.conditions.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  const chooseCondition = (meta: Meta) => {
    if (editingConditionId === null) {
      addCondition(meta);
    } else {
      const resolved = resolvedMeta(meta.key);
      updateCondition(editingConditionId, {
        key: meta.key,
        op: meta.type === "number" ? "gte" : meta.type === "text" ? "contains" : "eq",
        value: meta.defaultValue ?? resolved.options?.[0] ?? "",
        upper: undefined,
      });
    }
    setEditingConditionId(null);
    setAddPanelOpen(false);
  };
  const toggleCondition = (id: number) => {
    setDraft((current) => {
      const activeCount = current.conditions.filter((condition) => condition.active).length;
      const target = current.conditions.find((condition) => condition.id === id);
      if (!target) return current;
      const nextActiveCount = activeCount + (target.active ? -1 : 1);
      const wasMatchingAll = current.matchCount === activeCount;
      return {
        ...current,
        matchCount: nextActiveCount === 0 ? 0 : wasMatchingAll ? nextActiveCount : Math.min(Math.max(1, current.matchCount), nextActiveCount),
        conditions: current.conditions.map((condition) => condition.id === id ? { ...condition, active: !condition.active } : condition),
      };
    });
  };
  const removeCondition = (id: number) => {
    setDraft((current) => {
      const removed = current.conditions.find((condition) => condition.id === id);
      const activeCount = current.conditions.filter((condition) => condition.active).length;
      const nextActiveCount = activeCount - Number(removed?.active ?? false);
      const wasMatchingAll = current.matchCount === activeCount;
      return {
        ...current,
        matchCount: nextActiveCount === 0 ? 0 : wasMatchingAll ? nextActiveCount : Math.min(current.matchCount, nextActiveCount),
        conditions: current.conditions.filter((condition) => condition.id !== id),
      };
    });
  };
  const search = () => { setApplied({ ...draft, conditions: draft.conditions.map((c) => ({ ...c })) }); setModalOpen(false); };
  const reset = () => { const clean = defaultFilters(latestSimulatedSeason); setApplied(clean); setDraft(clean); setQuery(""); };

  const isAgeFiltered = applied.minAge !== "below 18" || applied.maxAge !== "40+";
  const activeConditionCount = applied.conditions.filter((condition) => condition.active).length;
  const draftActiveConditions = draft.conditions.filter((condition) => condition.active);
  const activeCount = activeConditionCount + Number(isAgeFiltered) + Number(applied.role !== "all") + Number(applied.scope !== "season") + Number(applied.season !== props.currentSeason);

  const handleMinAgeChange = (val: string) => {
    setDraft((f) => {
      const minNum = val === "below 18" ? 17 : val === "40+" ? 40 : Number(val);
      const maxNum = f.maxAge === "below 18" ? 17 : f.maxAge === "40+" ? 40 : Number(f.maxAge);
      const nextMax = minNum > maxNum ? val : f.maxAge;
      return { ...f, minAge: val, maxAge: nextMax };
    });
  };

  const handleMaxAgeChange = (val: string) => {
    setDraft((f) => {
      const maxNum = val === "below 18" ? 17 : val === "40+" ? 40 : Number(val);
      const minNum = f.minAge === "below 18" ? 17 : f.minAge === "40+" ? 40 : Number(f.minAge);
      const nextMin = maxNum < minNum ? val : f.minAge;
      return { ...f, maxAge: val, minAge: nextMin };
    });
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden p-5">
      <section className="shrink-0 rounded-lg border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <h2 className="font-anton text-[16px] uppercase tracking-wide">Find an IPL player</h2>
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-space-mono text-[10px] font-bold uppercase text-accent">
              {results.length} matches
            </span>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 max-w-xl">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-3.5 text-text-secondary"/>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by player name..."
                className="h-8 w-full rounded-md border border-border bg-bg pl-8 pr-3 text-[12px] text-text-primary outline-none focus:border-accent"
              />
            </label>
            <button
              onClick={openFilters}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-accent bg-accent/10 px-3 text-[11px] font-bold text-accent hover:bg-accent/20 transition-colors"
            >
              <SlidersHorizontal className="size-3.5"/>
              Detailed filters{activeCount ? ` (${activeCount})` : ""}
            </button>
          </div>
        </div>

        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-2 text-[10px]">
            <b className="uppercase text-text-secondary text-[9px] font-space-mono">Applied:</b>
            {isAgeFiltered && (
              <Tag
                text={
                  applied.minAge === "below 18"
                    ? `Age ≤ ${applied.maxAge}`
                    : applied.maxAge === "40+"
                    ? `Age ≥ ${applied.minAge}`
                    : `Age: ${applied.minAge}–${applied.maxAge}`
                }
              />
            )}
            {applied.role !== "all" && <Tag text={applied.role}/>}
            {applied.conditions.filter((condition) => condition.active).slice(0, 4).map((c) => (
              <Tag key={c.id} text={`${metadata.find((m) => m.key === c.key)?.label} ${opLabel(c.op)} ${c.value}${c.op === "between" ? `–${c.upper}` : ""}`}/>
            ))}
            {activeCount > 6 && <Tag text={`+${activeCount - 6} more`}/>}
            <div className="ml-auto flex items-center gap-2">
              {activeConditionCount > 1 && applied.matchCount < activeConditionCount && (
                <span className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 font-space-mono text-[9px] font-bold uppercase text-accent">
                  Partial match · only {Math.max(1, applied.matchCount)} of {activeConditionCount} conditions required
                </span>
              )}
              <button onClick={openFilters} className="font-bold uppercase text-accent hover:underline">Edit</button>
              <button onClick={reset} className="font-bold uppercase text-danger hover:underline">Clear</button>
            </div>
          </div>
        )}
      </section>

      <Results results={results} props={props} reset={reset}/>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <section
            className="flex h-[92vh] max-h-[860px] w-full max-w-[1120px] flex-col overflow-hidden rounded-xl border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-space-mono text-[9px] font-bold uppercase tracking-wider text-accent">
                    Scouting Criteria
                  </span>
                  <span className="rounded bg-bg px-1.5 py-0.5 font-space-mono text-[9px] font-semibold text-text-secondary">
                    League Filters
                  </span>
                </div>
                <h2 className="mt-0.5 font-anton text-[22px] uppercase tracking-wide text-text-primary">
                  Filter Players
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="grid size-8 place-items-center rounded-lg border border-border/80 text-text-secondary hover:bg-bg hover:text-text-primary transition-colors"
                title="Close"
              >
                <X className="size-4"/>
              </button>
            </div>

            {/* Modal Body */}
            <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)] gap-4 overflow-hidden bg-bg/30 p-4">
              {/* Section 1: Base Filters Card */}
              <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                  <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Core Filters
                  </span>
                  <span className="text-[10px] text-text-secondary">
                    Always applied
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Playing Role */}
                  <div>
                    <label className="mb-1.5 block font-space-mono text-[10px] font-bold uppercase text-text-secondary">
                      Playing Role
                    </label>
                    <select
                      value={draft.role}
                      onChange={(e) => setDraft((f) => ({ ...f, role: e.target.value as Filters["role"] }))}
                      className={`${control} w-full`}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r === "all" ? "All Playing Roles" : r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Performance Scope & Season */}
                  <div>
                    <label className="mb-1.5 block font-space-mono text-[10px] font-bold uppercase text-text-secondary">
                      Performance Scope
                    </label>
                    <div className="flex flex-col gap-2">
                      <select
                        value={draft.scope}
                        onChange={(e) => setDraft((f) => ({ ...f, scope: e.target.value as Scope }))}
                        className={`${control} flex-1`}
                      >
                        <option value="season">Selected season</option>
                        <option value="ipl">IPL career</option>
                        <option value="t20">T20 career</option>
                      </select>
                      {draft.scope === "season" && (
                        <select
                          value={draft.season}
                          onChange={(e) => setDraft((f) => ({ ...f, season: Number(e.target.value) }))}
                          className={`${control} w-full`}
                        >
                          {seasons.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Age Range */}
                  <div>
                    <label className="mb-1.5 block font-space-mono text-[10px] font-bold uppercase text-text-secondary">
                      Age Range
                    </label>
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 font-space-mono text-[9px] font-bold uppercase text-text-secondary">From</span>
                        <select
                          value={draft.minAge}
                          onChange={(e) => handleMinAgeChange(e.target.value)}
                          className={`${control} min-w-0 flex-1 px-2`}
                        >
                          {ageOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="shrink-0 font-space-mono text-[9px] font-bold uppercase text-text-secondary">to</span>
                        <select
                          value={draft.maxAge}
                          onChange={(e) => handleMaxAgeChange(e.target.value)}
                          className={`${control} min-w-0 flex-1 px-2`}
                        >
                          {ageOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Custom Attribute Conditions */}
              <div className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-bg/25 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-primary">Detailed conditions</span>
                      <p className="mt-1 text-[10px] text-text-secondary">Combine player details, performance and attributes into one precise search.</p>
                    </div>
                    {draft.conditions.length > 0 && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 font-space-mono text-[9px] font-bold text-accent">
                        {draft.conditions.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {draftActiveConditions.length > 0 && (
                      <label className="flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1.5">
                        <span className="font-space-mono text-[9px] font-bold uppercase text-text-secondary">Match</span>
                        <select value={Math.min(Math.max(1, draft.matchCount), draftActiveConditions.length)} onChange={(event) => setDraft((current) => ({ ...current, matchCount: Number(event.target.value) }))} className="rounded border border-border bg-surface px-2 py-1 font-space-mono text-[10px] font-bold text-text-primary outline-none focus:border-accent" aria-label="Number of conditions that must match">
                          {Array.from({ length: draftActiveConditions.length }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} / {draftActiveConditions.length}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                </div>

                {/* Condition List */}
                <div className="min-h-[360px] flex-1 space-y-2 overflow-y-auto p-3">
                  {draftActiveConditions.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-[10px]">
                      <span className="font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">Search reads</span>
                      <span className="font-semibold text-text-primary">{draft.scope === "season" ? `${draft.season} season` : draft.scope === "ipl" ? "IPL career" : "T20 career"}</span>
                      <span className="text-text-secondary">·</span>
                      <span className="font-space-mono text-[8px] font-bold uppercase text-accent">match {Math.min(Math.max(1, draft.matchCount), draftActiveConditions.length)} of {draftActiveConditions.length}</span>
                      {draftActiveConditions.map((condition) => (
                        <span key={condition.id} className="contents">
                          <span className="rounded border border-border bg-surface px-2 py-1 font-semibold">{conditionSummary(condition)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {draft.conditions.map((condition, index) => {
                    const meta = resolvedMeta(condition.key);
                    return (
                      <div
                        key={condition.id}
                        className={`grid grid-cols-[2rem_minmax(10rem,1.25fr)_8rem_minmax(8rem,1fr)_2rem] items-center gap-2 rounded-md border p-2 shadow-sm transition-all ${condition.active ? "border-border bg-surface hover:border-accent/40" : "border-border/60 bg-bg/40 opacity-60"}`}
                      >
                        <span className="grid size-7 place-items-center rounded bg-bg font-space-mono text-[9px] font-bold text-text-secondary">{index + 1}</span>
                        {/* Attribute info */}
                        <div className="flex min-w-0 items-center gap-2">
                          <label className="cursor-pointer">
                            <span className={`grid size-5 shrink-0 place-items-center rounded border transition-colors ${condition.active ? "border-accent bg-accent text-white" : "border-border bg-bg text-transparent"}`}>
                              <input type="checkbox" checked={condition.active} onChange={() => toggleCondition(condition.id)} className="sr-only" aria-label={`${condition.active ? "Disable" : "Enable"} ${meta.label} condition`}/>
                              <Check className="size-3" strokeWidth={3}/>
                            </span>
                          </label>
                          <button type="button" onClick={() => { setEditingConditionId(condition.id); setHoveredCategory(meta.category); setAddPanelOpen(true); }} className="flex h-8 min-w-0 flex-1 items-center justify-between rounded border border-border bg-bg px-2.5 text-left text-[11px] font-semibold text-text-primary transition-colors hover:border-accent">
                            <span className="truncate">{meta.label}</span><ChevronRight className="size-3.5 shrink-0 rotate-90 text-text-secondary"/>
                          </button>
                        </div>

                        {/* Operator */}
                        <div className="w-32">
                          {meta.type === "number" ? (
                            <select
                              value={condition.op}
                              onChange={(e) => updateCondition(condition.id, { op: e.target.value as Op })}
                              className={`${control} h-8 w-full text-[11px]`}
                            >
                              <option value="gt">More than (&gt;)</option>
                              <option value="gte">At least (≥)</option>
                              <option value="lt">Less than (&lt;)</option>
                              <option value="lte">At most (≤)</option>
                              <option value="between">Between</option>
                            </select>
                          ) : (
                            <div className="h-8 flex items-center px-2.5 text-[11px] font-medium text-text-secondary bg-bg/50 rounded-lg border border-border/40">
                              {meta.type === "text" ? "contains" : "is"}
                            </div>
                          )}
                        </div>

                        {/* Value Input */}
                        <div className="flex-1 min-w-[130px] flex items-center gap-1.5">
                          {meta.type === "select" ? (
                            <select
                              value={condition.value}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                              className={`${control} h-8 w-full text-[11px]`}
                            >
                              {(meta.options ?? []).map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={meta.type === "number" ? "number" : "text"}
                              value={condition.value}
                              onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                              className={`${control} h-8 w-full text-[11px]`}
                            />
                          )}
                          {condition.op === "between" && (
                            <>
                              <span className="text-text-secondary text-[11px] font-bold">–</span>
                              <input
                                type="number"
                                value={condition.upper ?? ""}
                                placeholder="Max"
                                onChange={(e) => updateCondition(condition.id, { upper: e.target.value })}
                                className={`${control} h-8 w-20 text-[11px]`}
                              />
                            </>
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeCondition(condition.id)}
                          className="grid size-8 place-items-center rounded-lg text-text-secondary hover:bg-danger/10 hover:text-danger transition-colors shrink-0"
                          title="Remove condition"
                        >
                          <X className="size-4"/>
                        </button>
                      </div>
                    );
                  })}

                  {draft.conditions.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-bg/20 p-6 text-center">
                      <p className="text-[12px] font-medium text-text-secondary">
                        Start with one condition
                      </p>
                      <p className="text-[10px] text-text-secondary/70 mt-0.5">
                        Example: bowling consistency at least 70 and more than 5 wickets in 2027.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 justify-end border-t border-border bg-surface px-3 py-2.5">
                  <button type="button" onClick={() => { setEditingConditionId(null); setHoveredCategory(categories[0]); setAddPanelOpen((open) => !open); }} className="flex h-8 items-center gap-2 rounded-sm border border-border bg-bg px-3 text-[11px] font-semibold text-text-primary shadow-sm transition-colors hover:border-accent hover:bg-accent/10">
                    <Plus className="size-3.5"/> Add condition <ChevronRight className={`size-3.5 transition-transform ${addPanelOpen ? "rotate-90" : "-rotate-90"}`}/>
                  </button>
                </div>

                {/* Add Condition Picker Panel */}
                {addPanelOpen && (
                  <div
                    onMouseLeave={() => { setAddPanelOpen(false); setEditingConditionId(null); }}
                    className="absolute bottom-[52px] right-3 z-30 flex flex-row-reverse items-end animate-in fade-in zoom-in-95 duration-100"
                  >
                      <div className="w-48 overflow-hidden rounded-sm border border-border bg-surface py-1 shadow-xl">
                        {categories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onMouseEnter={() => setHoveredCategory(category)}
                            onFocus={() => setHoveredCategory(category)}
                            onClick={() => setHoveredCategory(category)}
                            className={`flex h-8 w-full items-center justify-between border-b border-border/40 px-3 text-left text-[11px] transition-colors last:border-b-0 ${hoveredCategory === category ? "bg-accent text-white" : "text-text-primary hover:bg-bg"}`}
                          >
                            <span>{category}</span><ChevronRight className="size-3.5"/>
                          </button>
                        ))}
                      </div>
                      <div className="mr-1 max-h-[420px] w-60 overflow-y-auto rounded-sm border border-border bg-surface py-1 shadow-xl">
                          {metadata.filter((meta) => meta.category === hoveredCategory).map((meta) => {
                            const timesAdded = draft.conditions.filter((condition) => condition.key === meta.key).length;
                            return (
                              <button
                                key={meta.key}
                                type="button"
                                onClick={() => chooseCondition(meta)}
                                className="flex h-8 w-full items-center justify-between border-b border-border/40 px-3 text-left text-[11px] text-text-primary transition-colors last:border-b-0 hover:bg-accent hover:text-white"
                              >
                                <span>{meta.label}</span>
                                <span className="flex items-center gap-2">
                                  {timesAdded > 0 && <><span className="font-space-mono text-[8px] font-bold opacity-70">{timesAdded}</span><Check className="size-3"/></>}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-6 py-4">
              <button
                onClick={() => setDraft(defaultFilters(latestSimulatedSeason))}
                className="font-space-mono text-[11px] font-bold uppercase text-danger hover:underline"
              >
                Reset Conditions
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-border px-5 py-2 font-space-mono text-[11px] font-bold uppercase text-text-secondary hover:bg-bg hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={search}
                  className="rounded-lg bg-accent px-7 py-2 font-space-mono text-[11px] font-bold uppercase text-white shadow-md hover:bg-accent/90 active:scale-95 transition-all"
                >
                  Apply Filters
                </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      );
    }

function Results({
  results,
  props,
  reset,
}: {
  results: Array<{ player: Player; stats: ResolvedScoutingStats; ability: number }>;
  props: LeagueScoutingPageProps;
  reset: () => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-border bg-surface shadow-sm">
      <div className="grid grid-cols-[minmax(13rem,1.4fr)_7rem_5.5rem_5rem_5rem_5rem_8.5rem] gap-4 border-b border-border bg-bg/50 px-5 py-3 font-space-mono text-[9px] font-bold uppercase text-text-secondary">
        <span>Player</span>
        <span>Role</span>
        <span>Ability</span>
        <span className="text-right">Matches</span>
        <span className="text-right">Runs</span>
        <span className="text-right">Wickets</span>
        <span/>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {results.map(({ player, ability, stats }) => (
          <div key={player.id} className="grid min-h-16 grid-cols-[minmax(13rem,1.4fr)_7rem_5.5rem_5rem_5rem_5rem_8.5rem] items-center gap-4 border-b border-border/60 px-5 py-3 hover:bg-bg/40">
            <div>
              <button onClick={() => props.onAnalyse(player.id)} className="text-left text-[14px] font-bold hover:text-accent">
                {player.name}
              </button>
              <p className="text-[10px] text-text-secondary">
                {props.teams[player.currentTeamId!]?.name ?? "IPL"} · Age {player.age}
                {player.state ? ` · ${player.state}` : ""}
              </p>
            </div>
            <span className="text-[11px] text-text-secondary">{player.role}</span>
            <span className="font-anton text-[20px]">{ability}</span>
            <span className="text-right font-space-mono text-[13px] font-bold text-text-primary">{stats.matches}</span>
            <span className="text-right font-space-mono text-[13px] font-bold text-text-primary">{stats.runs}</span>
            <span className="text-right font-space-mono text-[13px] font-bold text-text-primary">{stats.wickets}</span>
            <div className="flex justify-end gap-2">
              <button onClick={() => props.onAnalyse(player.id)} className="rounded-md bg-[var(--ink)] px-3 py-2 text-[10px] font-bold uppercase text-bg">
                Analyse
              </button>
              <button onClick={() => props.onToggleShortlist(player.id)} className="rounded-md border border-border px-3 py-2 font-bold">
                {props.shortlist.includes(player.id) ? "✓" : "+"}
              </button>
            </div>
          </div>
        ))}
        {!results.length && (
          <div className="flex h-full flex-col items-center justify-center text-text-secondary">
            <Filter className="mb-3 size-8 opacity-40"/>
            <p>No players match this search</p>
            <button onClick={reset} className="mt-2 text-[10px] font-bold uppercase text-accent">Clear search</button>
          </div>
        )}
      </div>
    </section>
  );
}

function mergeSeasonStatSources(sources: Array<LeagueScoutingPageStat | undefined>): LeagueScoutingPageStat | undefined {
  const available = sources.filter((source): source is LeagueScoutingPageStat => Boolean(source));
  if (available.length === 0) return undefined;
  const ranked = [...available].sort((left, right) => (
    (right.matches ?? 0) - (left.matches ?? 0)
    || ((right.runs ?? 0) + (right.wickets ?? 0)) - ((left.runs ?? 0) + (left.wickets ?? 0))
  ));
  const merged: LeagueScoutingPageStat = { ...ranked[0] };
  for (const source of ranked.slice(1)) {
    for (const [key, value] of Object.entries(source)) {
      const statKey = key as keyof LeagueScoutingPageStat;
      if (merged[statKey] === undefined && value !== undefined) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }
  return merged;
}

function resolveArchivedMatchLogs(value: unknown): LeagueScoutingPageStat | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  let runs = 0;
  let balls = 0;
  let wickets = 0;
  let runsConceded = 0;
  let bowlingBalls = 0;
  let battingInnings = 0;
  let highestScore = 0;
  let fifties = 0;
  let hundreds = 0;
  let fourWickets = 0;
  let fiveWickets = 0;
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const log = raw as { batting?: unknown; bowling?: unknown };
    const batting = typeof log.batting === "string" ? log.batting.match(/^(\d+)\s*\((\d+)\)/) : null;
    if (batting) {
      const inningsRuns = Number(batting[1]);
      runs += inningsRuns;
      balls += Number(batting[2]);
      battingInnings += 1;
      highestScore = Math.max(highestScore, inningsRuns);
      if (inningsRuns >= 100) hundreds += 1;
      else if (inningsRuns >= 50) fifties += 1;
    }
    const bowling = typeof log.bowling === "string" ? log.bowling.match(/^(\d+)\/(\d+)\s*\(([\d.]+)\)/) : null;
    if (bowling) {
      const inningsWickets = Number(bowling[1]);
      wickets += inningsWickets;
      runsConceded += Number(bowling[2]);
      bowlingBalls += oversToBalls(Number(bowling[3]));
      if (inningsWickets >= 5) fiveWickets += 1;
      else if (inningsWickets >= 4) fourWickets += 1;
    }
  }
  return {
    matches: value.length,
    runs,
    balls,
    wickets,
    runsConceded,
    oversBowled: Math.floor(bowlingBalls / 6) + (bowlingBalls % 6) / 10,
    battingInnings,
    highestScore,
    fifties,
    hundreds,
    fourWickets,
    fiveWickets,
  };
}

function resolveSeasonStats(source?: LeagueScoutingPageStat): ResolvedScoutingStats {
  const runs = source?.runs ?? 0;
  const balls = source?.balls ?? 0;
  const wickets = source?.wickets ?? 0;
  const runsConceded = source?.runsConceded ?? 0;
  const bowlingBalls = oversToBalls(source?.oversBowled ?? 0);
  const dismissals = source?.dismissals ?? 0;
  return {
    matches: source?.matches ?? 0,
    runs,
    balls,
    battingInnings: source?.battingInnings,
    battingAverage: dismissals > 0 ? runs / dismissals : runs > 0 ? runs : undefined,
    strikeRate: balls > 0 ? runs * 100 / balls : undefined,
    highestScore: source?.highestScore,
    fifties: source?.fifties,
    hundreds: source?.hundreds,
    fours: source?.fours,
    sixes: source?.sixes,
    wickets,
    oversBowled: bowlingBalls > 0 ? bowlingBalls / 6 : undefined,
    runsConceded: bowlingBalls > 0 ? runsConceded : undefined,
    bowlingAverage: wickets > 0 ? runsConceded / wickets : undefined,
    economy: bowlingBalls > 0 ? runsConceded / (bowlingBalls / 6) : undefined,
    fourWickets: source?.fourWickets,
    fiveWickets: source?.fiveWickets,
    catches: source?.catches,
    stumpings: source?.stumpings,
    runOuts: source?.runOuts,
    maidens: source?.maidens,
    powerplayWickets: source?.powerplayWickets,
  };
}

function resolveIplStats(player: Player): ResolvedScoutingStats {
  const stats = player.iplStats;
  const bowlingBalls = stats.bowlingBalls ?? 0;
  return {
    matches: stats.matches ?? 0,
    runs: stats.runs ?? 0,
    balls: stats.ballsFaced ?? stats.battingBalls,
    battingInnings: stats.innings,
    battingAverage: stats.battingAverage > 0 ? stats.battingAverage : undefined,
    strikeRate: stats.strikeRate > 0 ? stats.strikeRate : undefined,
    highestScore: stats.highScore,
    fifties: stats.fifties,
    hundreds: stats.hundreds,
    fours: stats.fours,
    sixes: stats.sixes,
    wickets: stats.wickets ?? 0,
    oversBowled: bowlingBalls > 0 ? bowlingBalls / 6 : undefined,
    runsConceded: bowlingBalls > 0 ? stats.runsConceded ?? stats.bowlingRunsConceded : undefined,
    bowlingAverage: stats.wickets > 0 && stats.bowlingAverage > 0 ? stats.bowlingAverage : undefined,
    economy: bowlingBalls > 0 ? stats.economy : undefined,
    fourWickets: stats.fourWickets,
    fiveWickets: stats.fiveWickets,
    catches: stats.catches,
    stumpings: stats.stumpings,
    runOuts: stats.runOuts,
  };
}

function resolveT20Stats(player: Player): ResolvedScoutingStats {
  const batting = player.careerStats.batting;
  const bowling = player.careerStats.bowling;
  const bowlingBalls = bowling.balls ?? 0;
  return {
    matches: Math.max(batting.matches ?? 0, bowling.matches ?? 0),
    runs: batting.runs ?? 0,
    balls: batting.balls,
    battingInnings: batting.innings,
    battingAverage: batting.innings > 0 && batting.average > 0 ? batting.average : undefined,
    strikeRate: batting.innings > 0 && batting.strikeRate > 0 ? batting.strikeRate : undefined,
    fifties: batting.fifties,
    hundreds: batting.hundreds,
    wickets: bowling.wickets ?? 0,
    oversBowled: bowlingBalls > 0 ? bowlingBalls / 6 : undefined,
    runsConceded: bowlingBalls > 0 ? bowling.runsConceded : undefined,
    bowlingAverage: bowling.wickets > 0 && bowling.average > 0 ? bowling.average : undefined,
    economy: bowlingBalls > 0 && bowling.economy > 0 ? bowling.economy : undefined,
  };
}

function oversToBalls(overs: number) {
  const wholeOvers = Math.floor(Math.max(0, overs));
  const remainingBalls = Math.min(5, Math.max(0, Math.round((overs - wholeOvers) * 10)));
  return wholeOvers * 6 + remainingBalls;
}

function conditionValue(key: string, p: Player, stats: ResolvedScoutingStats, teams: Record<string, Team>): string | number | boolean | undefined {
  if (key in stats) return stats[key as keyof typeof stats];
  if (key === "country") return p.country || p.nationality;
  if (key === "team") return teams[p.currentTeamId ?? ""]?.name ?? "";
  if (key === "capped") return p.isCapped ? "Capped" : "Uncapped";
  if (key === "designation") return [[p.isWicketkeeper, "Wicketkeeper"], [p.isPartTimeWk, "Part-time keeper"], [p.isOpener, "Opener"], [p.isFinisher, "Finisher"], [p.isCoreBatter, "Core batter"]].filter(([active]) => active).map(([, name]) => name).join("|");
  return p[key as keyof Player] as string | number | boolean;
}

function conditionMatches(actual: string | number | boolean | undefined, condition: Condition) {
  if (condition.op === "contains") return String(actual ?? "").toLowerCase().includes(condition.value.toLowerCase());
  if (condition.op === "eq") return String(actual ?? "").split("|").includes(condition.value);
  if (actual === undefined || actual === null || actual === "") return false;
  const a = Number(actual), value = Number(condition.value || 0);
  if (!Number.isFinite(a) || !Number.isFinite(value)) return false;
  if (condition.op === "gte") return a >= value;
  if (condition.op === "gt") return a > value;
  if (condition.op === "lte") return a <= value;
  if (condition.op === "lt") return a < value;
  return a >= value && a <= Number(condition.upper || value);
}

function conditionSummary(condition: Condition) {
  const label = metadata.find((item) => item.key === condition.key)?.label ?? condition.key;
  const operator = opLabel(condition.op);
  return `${label} ${operator} ${condition.value}${condition.op === "between" ? `–${condition.upper || "?"}` : ""}`;
}

function ageMatches(age: number, minAge: string, maxAge: string) {
  if (minAge !== "below 18") {
    const minVal = minAge === "40+" ? 40 : Number(minAge);
    if (!isNaN(minVal) && age < minVal) return false;
  }
  if (maxAge !== "40+") {
    if (maxAge === "below 18") {
      if (age >= 18) return false;
    } else {
      const maxVal = Number(maxAge);
      if (!isNaN(maxVal) && age > maxVal) return false;
    }
  }
  return true;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();
}

function opLabel(op: Op) {
  return op === "gt" ? ">" : op === "gte" ? "≥" : op === "lt" ? "<" : op === "lte" ? "≤" : op === "between" ? "between" : op === "contains" ? "contains" : "is";
}

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-accent/25 bg-surface px-2 font-space-mono text-[9px] font-semibold text-text-primary shadow-sm">
      <span className="size-1.5 shrink-0 rounded-full bg-accent"/>
      {text}
    </span>
  );
}
