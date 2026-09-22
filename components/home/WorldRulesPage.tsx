"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check, RotateCcw, Scale, Wallet } from "lucide-react";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";
import {
  DEFAULT_WORLD_RULES,
  WORLD_RULE_FIELDS,
  normalizeWorldRules,
  type WorldRuleField,
  type WorldRules,
} from "@/lib/logic/worldRules";

const inputClass = "h-8 w-full rounded border border-border bg-surface px-2 font-space-mono text-[10px] text-text-primary outline-none transition-colors focus:border-accent disabled:opacity-40";

type RuleDraft = Record<keyof WorldRules, string | boolean>;

function toDraft(rules: WorldRules): RuleDraft {
  return Object.fromEntries(
    Object.entries(rules).map(([key, value]) => [key, typeof value === "boolean" ? value : String(Array.isArray(value) ? value.join(",") : value)]),
  ) as RuleDraft;
}

function fromDraft(draft: RuleDraft, current: WorldRules): WorldRules {
  const tiersText = String(draft.cappedRetentionTiers ?? "");
  const tiers = tiersText.split(",").map((tier) => Number(tier.trim()));
  return normalizeWorldRules({
    ...Object.fromEntries(
      WORLD_RULE_FIELDS.map((field) => [
        field.key,
        field.unit === "toggle" ? Boolean(draft[field.key]) : Number(draft[field.key]),
      ]),
    ),
    cappedRetentionTiers: tiers.length === 3 && tiers.every((tier) => Number.isFinite(tier))
      ? [tiers[0], tiers[1], tiers[2]]
      : current.cappedRetentionTiers,
  });
}

function RuleInput({ field, value, onChange }: { field: WorldRuleField; value: string | boolean; onChange: (value: string | boolean) => void }) {
  const isDefault = field.unit === "toggle"
    ? Boolean(value) === DEFAULT_WORLD_RULES[field.key]
    : Number(value) === DEFAULT_WORLD_RULES[field.key];
  return (
    <div className="min-w-0 rounded border border-border bg-bg p-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{field.label}</span>
        {!isDefault && <span className="shrink-0 rounded-[2px] bg-accent/15 px-1 font-space-mono text-[6.5px] font-bold uppercase text-accent">Changed</span>}
      </div>
      {field.unit === "toggle" ? (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`h-8 w-full rounded border px-2 font-space-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
            value ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-text-secondary"
          }`}
        >
          {value ? "Enabled" : "Disabled"}
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={String(value)}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} text-center font-anton text-[15px]`}
          />
          {field.unit === "lakhs" && (
            <span className="w-16 shrink-0 text-right font-space-mono text-[8px] font-bold text-accent">{formatPrice(Math.max(0, Number(value) || 0))}</span>
          )}
          {field.unit === "percent" && (
            <span className="w-10 shrink-0 text-right font-space-mono text-[8px] font-bold text-accent">{Number(value) || 0}%</span>
          )}
          {field.unit === "years" && (
            <span className="w-10 shrink-0 text-right font-space-mono text-[8px] font-bold text-accent">{Number(value) > 0 ? "+" : ""}{Number(value) || 0} yr</span>
          )}
        </div>
      )}
      <div className="mt-1 font-space-mono text-[6.5px] uppercase text-text-secondary">
        {field.unit === "toggle" ? "" : `${field.min}-${field.max}${field.unit === "lakhs" ? " lakhs" : field.unit === "percent" ? "%" : field.unit === "years" ? " years" : ""}`}
        {field.hint ? ` · ${field.hint}` : ""}
      </div>
    </div>
  );
}

export default function WorldRulesPage() {
  const worldRules = useGameStore((state) => state.worldRules);
  const setWorldRules = useGameStore((state) => state.setWorldRules);
  const resetWorldRules = useGameStore((state) => state.resetWorldRules);
  const setTeamFinances = useGameStore((state) => state.setTeamFinances);
  const setTeamStaffBudget = useGameStore((state) => state.setTeamStaffBudget);
  const staffFinances = useGameStore((state) => state.careerStaff.financesByTeam);
  const teams = useGameStore((state) => state.teams);
  const auction = useGameStore((state) => state.auction);
  const userTeamId = useGameStore((state) => state.userTeamId);

  const [draft, setDraft] = useState<RuleDraft>(() => toDraft(worldRules));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [purseDrafts, setPurseDrafts] = useState<Record<string, { total: string; remaining: string }>>({});
  const [staffBudgetDrafts, setStaffBudgetDrafts] = useState<Record<string, string>>({});
  const formatCrore = (rupees: number) => `₹${(rupees / 10_000_000).toFixed(2)} Cr`;

  useEffect(() => { setDraft(toDraft(worldRules)); }, [worldRules]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, WorldRuleField[]>();
    WORLD_RULE_FIELDS.forEach((field) => byGroup.set(field.group, [...(byGroup.get(field.group) ?? []), field]));
    return Array.from(byGroup.entries());
  }, []);

  const pendingRules = fromDraft(draft, worldRules);
  const isDirty = JSON.stringify(pendingRules) !== JSON.stringify(worldRules);
  const changedCount = WORLD_RULE_FIELDS.filter((field) => (
    JSON.stringify(worldRules[field.key]) !== JSON.stringify(DEFAULT_WORLD_RULES[field.key])
  )).length + (JSON.stringify(worldRules.cappedRetentionTiers) !== JSON.stringify(DEFAULT_WORLD_RULES.cappedRetentionTiers) ? 1 : 0);

  const orderedTeams = useMemo(
    () => Object.values(teams).sort((left, right) => (left.id === userTeamId ? -1 : right.id === userTeamId ? 1 : left.name.localeCompare(right.name))),
    [teams, userTeamId],
  );

  const handleSave = () => {
    setWorldRules(pendingRules);
    setSavedAt(Date.now());
  };

  const handleReset = () => {
    if (!window.confirm("Reset every world rule to the default IPL values?")) return;
    resetWorldRules();
    setSavedAt(Date.now());
  };

  const purseDraftFor = (teamId: string) => purseDrafts[teamId] ?? {
    total: String(teams[teamId]?.totalPurse ?? 0),
    remaining: String(teams[teamId]?.remainingPurse ?? 0),
  };

  const applyPurse = (teamId: string) => {
    const entry = purseDraftFor(teamId);
    const total = Number(entry.total);
    const remaining = Number(entry.remaining);
    setTeamFinances(teamId, {
      totalPurse: Number.isFinite(total) ? total : undefined,
      remainingPurse: Number.isFinite(remaining) ? remaining : undefined,
    });
    setPurseDrafts((current) => {
      const { [teamId]: _removed, ...rest } = current;
      return rest;
    });
  };

  const applyPurseToAll = () => {
    const total = Number(window.prompt("Set every team's total purse (in lakhs). Remaining purse moves by the same amount.", String(worldRules.megaAuctionPurseLakhs)));
    if (!Number.isFinite(total) || total < 0) return;
    orderedTeams.forEach((team) => setTeamFinances(team.id, { totalPurse: total }));
    setPurseDrafts({});
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">
      <header className="relative shrink-0 overflow-hidden bg-[var(--ink)] px-6 py-5 text-white">
        <div className="absolute -right-16 -top-24 size-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <p className="font-space-mono text-[8px] font-bold uppercase tracking-[.25em] text-accent">Universal editor</p>
            <h2 className="mt-1 font-anton text-[30px] uppercase">World Rules</h2>
            <p className="mt-2 font-space-mono text-[8px] uppercase text-white/50">
              League-wide settings for this save · {changedCount === 0 ? "All defaults" : `${changedCount} rule${changedCount === 1 ? "" : "s"} changed`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex h-9 items-center gap-1.5 rounded border border-white/20 px-3 font-space-mono text-[9px] font-bold uppercase tracking-wider text-white/80 transition-colors hover:border-red-400 hover:text-red-300"
            >
              <RotateCcw size={12} /> Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              className="flex h-9 items-center gap-1.5 rounded border border-accent bg-accent px-4 font-space-mono text-[9px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={12} /> {isDirty ? "Apply Rules" : savedAt ? "Applied" : "No Changes"}
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1500px] gap-4 xl:grid-cols-12">
          {groups.map(([group, fields]) => (
            <section key={group} className="rounded-xl border border-border bg-surface p-5 xl:col-span-6">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <span className="grid size-8 place-items-center rounded bg-[var(--ink)] text-accent"><Scale size={14} /></span>
                <h3 className="font-anton text-[19px] uppercase">{group}</h3>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                {fields.map((field) => (
                  <RuleInput
                    key={field.key}
                    field={field}
                    value={draft[field.key]}
                    onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
                  />
                ))}
                {group === "Retentions" && (
                  <div className="min-w-0 rounded border border-border bg-bg p-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Capped retention tiers</span>
                      {JSON.stringify(pendingRules.cappedRetentionTiers) !== JSON.stringify(DEFAULT_WORLD_RULES.cappedRetentionTiers) && (
                        <span className="shrink-0 rounded-[2px] bg-accent/15 px-1 font-space-mono text-[6.5px] font-bold uppercase text-accent">Changed</span>
                      )}
                    </div>
                    <input
                      value={String(draft.cappedRetentionTiers)}
                      onChange={(event) => setDraft((current) => ({ ...current, cappedRetentionTiers: event.target.value }))}
                      placeholder="1800,1400,1100"
                      className={`${inputClass} text-center font-anton text-[13px]`}
                    />
                    <div className="mt-1 font-space-mono text-[6.5px] uppercase text-text-secondary">
                      Three prices in lakhs, high to low · slabs: 1st, 2nd, 3rd; 4th+ reuse them
                    </div>
                  </div>
                )}
              </div>
            </section>
          ))}

          <section className="rounded-xl border border-border bg-surface p-5 xl:col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded bg-[var(--ink)] text-accent"><Wallet size={14} /></span>
                <div>
                  <h3 className="font-anton text-[19px] uppercase">Team Finances</h3>
                  <p className="font-space-mono text-[7px] uppercase text-text-secondary">
                    Purse values in lakhs (100 lakhs = ₹1 Cr){auction && auction.phase === "live" ? " · applies live to the running auction" : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={applyPurseToAll}
                className="h-8 rounded border border-border bg-bg px-3 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-primary transition-colors hover:border-accent hover:text-accent"
              >
                Set all purses
              </button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <div className="grid min-w-[720px] grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_1fr_6rem] gap-2 border-b border-border pb-2 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                <span>Team</span>
                <span>Squad</span>
                <span>Spent</span>
                <span>Total purse</span>
                <span>Remaining</span>
                <span />
              </div>
              {orderedTeams.map((team) => {
                const entry = purseDraftFor(team.id);
                const dirty = Number(entry.total) !== team.totalPurse || Number(entry.remaining) !== team.remainingPurse;
                return (
                  <div key={team.id} className="grid min-w-[720px] grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_1fr_6rem] items-center gap-2 border-b border-border/60 py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.primaryColor }} />
                      <span className="truncate text-[10px] font-semibold text-text-primary">{team.name}</span>
                      {team.id === userTeamId && <span className="shrink-0 rounded-[2px] bg-accent/15 px-1 font-space-mono text-[6.5px] font-bold uppercase text-accent">You</span>}
                    </span>
                    <span className="font-space-mono text-[9px] text-text-secondary">
                      {team.squad.length}/{team.maxSquadSize} · {team.overseasPlayersCurrent}/{team.overseasPlayersMax} OS
                    </span>
                    <span className="font-space-mono text-[9px] text-text-secondary">{formatPrice(team.spentAmount)}</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={entry.total}
                      onChange={(event) => setPurseDrafts((current) => ({ ...current, [team.id]: { ...entry, total: event.target.value } }))}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      step={100}
                      value={entry.remaining}
                      onChange={(event) => setPurseDrafts((current) => ({ ...current, [team.id]: { ...entry, remaining: event.target.value } }))}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={!dirty}
                      onClick={() => applyPurse(team.id)}
                      className="h-8 rounded border border-accent bg-accent/10 px-2 font-space-mono text-[8px] font-bold uppercase text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Apply
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5 xl:col-span-12">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <span className="grid size-8 place-items-center rounded bg-[var(--ink)] text-accent"><BriefcaseBusiness size={14} /></span>
              <div>
                <h3 className="font-anton text-[19px] uppercase">Staff Budgets</h3>
                <p className="font-space-mono text-[7px] uppercase text-text-secondary">Annual coaching salary cap per club, in crore · the Staff budget rule above rescales all of these</p>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_6rem] gap-2 border-b border-border pb-2 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                <span>Team</span>
                <span>Committed</span>
                <span>Available</span>
                <span>Budget (Cr)</span>
                <span />
              </div>
              {orderedTeams.map((team) => {
                const finance = staffFinances[team.id];
                const budget = finance?.annualBudget ?? 0;
                const committed = finance?.committedSalary ?? 0;
                const entry = staffBudgetDrafts[team.id] ?? (budget / 10_000_000).toFixed(2);
                const dirty = Math.round(Number(entry) * 10_000_000) !== budget;
                return (
                  <div key={team.id} className="grid min-w-[640px] grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_6rem] items-center gap-2 border-b border-border/60 py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.primaryColor }} />
                      <span className="truncate text-[10px] font-semibold text-text-primary">{team.name}</span>
                      {team.id === userTeamId && <span className="shrink-0 rounded-[2px] bg-accent/15 px-1 font-space-mono text-[6.5px] font-bold uppercase text-accent">You</span>}
                    </span>
                    <span className="font-space-mono text-[9px] text-text-secondary">{formatCrore(committed)}</span>
                    <span className={`font-space-mono text-[9px] ${budget - committed < 0 ? "text-red-500" : "text-text-secondary"}`}>{formatCrore(budget - committed)}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={entry}
                      onChange={(event) => setStaffBudgetDrafts((current) => ({ ...current, [team.id]: event.target.value }))}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={!dirty || !Number.isFinite(Number(entry))}
                      onClick={() => {
                        setTeamStaffBudget(team.id, Number(entry) * 10_000_000);
                        setStaffBudgetDrafts((current) => {
                          const { [team.id]: _removed, ...rest } = current;
                          return rest;
                        });
                      }}
                      className="h-8 rounded border border-accent bg-accent/10 px-2 font-space-mono text-[8px] font-bold uppercase text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Apply
                    </button>
                  </div>
                );
              })}
              {orderedTeams.length > 0 && Object.keys(staffFinances).length === 0 && (
                <p className="py-4 text-center font-space-mono text-[8px] uppercase text-text-secondary">Staff budgets appear once the staff directory has loaded (open Club → Staff Management).</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
