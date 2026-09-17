"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, RotateCcw, Unlock, X } from "lucide-react";
import { useGameStore } from "@/lib/store/gameStore";
import { STAFF_RATING_ROLES, type StaffRatingAttributes } from "@/lib/logic/staffRatings";
import type { CareerStaffContract } from "@/lib/logic/staffContracts";

type AttributeKey = Exclude<keyof StaffRatingAttributes, "reputation">;
type PersonKey = "reputation" | "potentialAbility" | "loyalty" | "ambition" | "adaptability" | "learningRate";

const ATTRIBUTE_GROUPS: Array<[string, Array<[AttributeKey, string]>]> = [
  ["Coaching", [
    ["batting_coaching", "Batting"],
    ["pace_bowling_coaching", "Pace Bowling"],
    ["spin_bowling_coaching", "Spin Bowling"],
    ["fielding_coaching", "Fielding"],
    ["wicketkeeping_coaching", "Keeping"],
    ["technical_coaching", "Technical"],
  ]],
  ["Knowledge", [
    ["tactical_knowledge", "Tactical"],
    ["judging_ability", "Judging Ability"],
    ["judging_potential", "Judging Potential"],
    ["youth_development", "Youth Development"],
  ]],
  ["Management", [
    ["man_management", "Man Management"],
    ["motivation", "Motivation"],
    ["player_development", "Player Development"],
  ]],
];

const PERSON_FIELDS: Array<[PersonKey, string, number, number]> = [
  ["reputation", "Reputation", 0, 100],
  ["potentialAbility", "Potential Ability", 50, 95],
  ["loyalty", "Loyalty", 0, 100],
  ["ambition", "Ambition", 0, 100],
  ["adaptability", "Adaptability", 0, 100],
  ["learningRate", "Learning Rate", 0, 100],
];

const DEVELOPMENT_PHASES = ["developing", "emerging", "peak", "veteran"];
const FREE_AGENT = "__free_agent__";

const roleLabel = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

interface Draft {
  fullName: string;
  country: string;
  dateOfBirth: string;
  retirementAge: string;
  experienceYears: string;
  developmentPhase: string;
  coachingPhilosophy: string;
  preferredTeamStrategy: string;
  traits: string;
  person: Record<PersonKey, string>;
  attributes: Record<AttributeKey, string>;
  frozen: string[];
  teamId: string;
  primaryRole: string;
  secondaryRole: string;
  salaryCrore: string;
  endSeason: string;
}

function text(value: number | string | null | undefined): string {
  return value == null ? "" : String(value);
}

function buildDraft(contract: CareerStaffContract, frozen: string[]): Draft {
  const attributes = Object.fromEntries(
    ATTRIBUTE_GROUPS.flatMap(([, fields]) => fields.map(([key]) => [key, text(contract.coachingAttributes[key])])),
  ) as Record<AttributeKey, string>;
  return {
    fullName: contract.fullName,
    country: contract.country,
    dateOfBirth: contract.dateOfBirth ?? "",
    retirementAge: text(contract.retirementAge),
    experienceYears: text(contract.experienceYears),
    developmentPhase: contract.developmentPhase,
    coachingPhilosophy: contract.coachingPhilosophy ?? "",
    preferredTeamStrategy: contract.preferredTeamStrategy ?? "",
    traits: contract.traits.join(", "),
    person: {
      reputation: text(contract.reputation),
      potentialAbility: text(contract.potentialAbility),
      loyalty: text(contract.loyalty),
      ambition: text(contract.ambition),
      adaptability: text(contract.adaptability),
      learningRate: text(contract.learningRate),
    },
    attributes,
    frozen,
    teamId: contract.status === "contracted" && contract.teamId ? contract.teamId : FREE_AGENT,
    primaryRole: contract.primaryRole,
    secondaryRole: contract.roles.find((role) => role !== contract.primaryRole) ?? "",
    salaryCrore: (contract.annualSalary / 10_000_000).toFixed(2),
    endSeason: contract.endSeason == null ? "" : String(contract.endSeason),
  };
}

function parseBounded(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (value.trim() === "" || !Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function buildPatch(contract: CareerStaffContract, draft: Draft): Partial<CareerStaffContract> {
  const patch: Partial<CareerStaffContract> = {};
  const assign = <K extends keyof CareerStaffContract>(key: K, value: CareerStaffContract[K]) => {
    if (JSON.stringify(contract[key]) !== JSON.stringify(value)) patch[key] = value;
  };

  assign("fullName", draft.fullName.trim() || contract.fullName);
  assign("country", draft.country.trim() || contract.country);
  assign("dateOfBirth", draft.dateOfBirth.trim() || null);
  assign("retirementAge", parseBounded(draft.retirementAge, contract.retirementAge, 40, 90));
  assign("experienceYears", parseBounded(draft.experienceYears, contract.experienceYears, 0, 60));
  assign("developmentPhase", draft.developmentPhase);
  assign("coachingPhilosophy", draft.coachingPhilosophy.trim() || null);
  assign("preferredTeamStrategy", draft.preferredTeamStrategy.trim() || null);
  assign("traits", draft.traits.split(",").map((trait) => trait.trim()).filter(Boolean));

  PERSON_FIELDS.forEach(([key, , min, max]) => {
    assign(key, parseBounded(draft.person[key], contract[key], min, max));
  });

  const attributes: StaffRatingAttributes = { ...contract.coachingAttributes };
  let attributesChanged = false;
  ATTRIBUTE_GROUPS.forEach(([, fields]) => fields.forEach(([key]) => {
    const next = parseBounded(draft.attributes[key], Number(contract.coachingAttributes[key] ?? 1), 1, 20);
    if (next !== contract.coachingAttributes[key]) {
      attributes[key] = next;
      attributesChanged = true;
    }
  }));
  if (attributesChanged) patch.coachingAttributes = attributes;

  return patch;
}

const inputClass = "h-8 w-full rounded border border-border bg-surface px-2 font-space-mono text-[10px] text-text-primary outline-none transition-colors focus:border-accent disabled:opacity-40";
const labelClass = "mb-1 block font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 border-b border-border pb-1.5 font-anton text-[12px] uppercase text-text-primary">{children}</h4>;
}

interface StaffEditorModalProps {
  contract: CareerStaffContract;
  onClose: () => void;
}

export function StaffEditorModal({ contract, onClose }: StaffEditorModalProps) {
  const applyStaffEdit = useGameStore((state) => state.applyStaffEdit);
  const resetStaffToDatabase = useGameStore((state) => state.resetStaffToDatabase);
  const transferStaffMember = useGameStore((state) => state.transferStaffMember);
  const teams = useGameStore((state) => state.teams);
  const contracts = useGameStore((state) => state.careerStaff.contracts);
  const generatedProfiles = useGameStore((state) => state.careerStaff.generatedProfiles);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const frozenAttributes = useGameStore((state) => state.frozenStaffAttributes[contract.staffId]);

  const [draft, setDraft] = useState<Draft>(() => buildDraft(contract, Object.keys(frozenAttributes ?? {})));
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const isGenerated = Boolean(generatedProfiles?.[contract.staffId]);
  const teamOptions = useMemo(
    () => Object.values(teams).sort((left, right) => left.name.localeCompare(right.name)),
    [teams],
  );
  const suggestions = useMemo(() => {
    const philosophies = new Set<string>();
    const strategies = new Set<string>();
    const countries = new Set<string>();
    Object.values(contracts).forEach((candidate) => {
      if (candidate.coachingPhilosophy) philosophies.add(candidate.coachingPhilosophy);
      if (candidate.preferredTeamStrategy) strategies.add(candidate.preferredTeamStrategy);
      if (candidate.country) countries.add(candidate.country);
    });
    const sorted = (values: Set<string>) => Array.from(values).sort((left, right) => left.localeCompare(right));
    return { philosophies: sorted(philosophies), strategies: sorted(strategies), countries: sorted(countries) };
  }, [contracts]);

  const update = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
  const updatePerson = (key: PersonKey, value: string) =>
    setDraft((current) => ({ ...current, person: { ...current.person, [key]: value } }));
  const updateAttribute = (key: AttributeKey, value: string) =>
    setDraft((current) => ({ ...current, attributes: { ...current.attributes, [key]: value } }));
  const toggleFrozen = (key: string) =>
    setDraft((current) => ({
      ...current,
      frozen: current.frozen.includes(key) ? current.frozen.filter((item) => item !== key) : [...current.frozen, key],
    }));

  const currentTeamKey = contract.status === "contracted" && contract.teamId ? contract.teamId : FREE_AGENT;
  const contractChanged = draft.teamId !== currentTeamKey
    || draft.primaryRole !== contract.primaryRole
    || draft.secondaryRole !== (contract.roles.find((role) => role !== contract.primaryRole) ?? "")
    || Math.round(Number(draft.salaryCrore) * 10_000_000) !== contract.annualSalary
    || (draft.endSeason.trim() === "" ? null : Number(draft.endSeason)) !== contract.endSeason;

  const handleSave = () => {
    const patch = buildPatch(contract, draft);
    const previousFrozen = Object.keys(frozenAttributes ?? {}).sort().join(",");
    const frozenChanged = previousFrozen !== [...draft.frozen].sort().join(",");
    if (Object.keys(patch).length > 0 || frozenChanged) applyStaffEdit(contract.staffId, patch, draft.frozen);

    if (contractChanged) {
      const toTeamId = draft.teamId === FREE_AGENT ? null : draft.teamId;
      const salary = Number(draft.salaryCrore);
      transferStaffMember(contract.staffId, toTeamId, {
        primaryRole: draft.primaryRole,
        roles: draft.secondaryRole ? [draft.primaryRole, draft.secondaryRole] : [draft.primaryRole],
        annualSalary: Number.isFinite(salary) ? salary * 10_000_000 : contract.annualSalary,
        endSeason: draft.endSeason.trim() === "" ? null : Math.max(currentSeason, Math.round(Number(draft.endSeason))),
      });
    }
    onClose();
  };

  const handleReset = async () => {
    if (!window.confirm(`Reset ${contract.fullName} to the database values? This clears every edit and frozen rating for this save.`)) return;
    setIsResetting(true);
    const result = await resetStaffToDatabase(contract.staffId);
    setIsResetting(false);
    if (result === "reset") {
      onClose();
      return;
    }
    setResetMessage(result === "not-in-database"
      ? "This staff member was generated in this save and has no database record to reset to."
      : "The staff directory could not be loaded right now.");
  };

  const renderLockedNumber = (
    key: string,
    label: string,
    value: string,
    min: number,
    max: number,
    onChange: (value: string) => void,
  ) => {
    const isFrozen = draft.frozen.includes(key);
    return (
      <div key={key} className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-1">
          <span className="truncate font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">
            {label} <span className="font-normal opacity-70">{min}-{max}</span>
          </span>
          <button
            type="button"
            onClick={() => toggleFrozen(key)}
            title={isFrozen ? "Frozen: this value will never change. Click to unfreeze." : "Freeze this value so development never changes it"}
            aria-pressed={isFrozen}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
              isFrozen ? "text-accent" : "text-text-secondary/50 hover:text-text-primary"
            }`}
          >
            {isFrozen ? <Lock size={10} /> : <Unlock size={10} />}
          </button>
        </div>
        <input
          type="number"
          min={min}
          max={max}
          inputMode="numeric"
          value={value}
          placeholder="-"
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} text-center font-anton text-[15px] ${isFrozen ? "border-accent/70 bg-accent/5" : ""}`}
        />
      </div>
    );
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-lg border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-150"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b-2 border-border px-4 py-3">
          <div className="min-w-0">
            <span className="font-space-mono text-[9px] font-bold uppercase tracking-widest text-text-secondary">Staff Editor</span>
            <h3 className="truncate font-anton text-[22px] uppercase leading-none">{contract.fullName}</h3>
            <p className="mt-1 font-space-mono text-[8px] uppercase text-text-secondary">Changes apply to this save only</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close staff editor"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface p-3">
          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Profile</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="col-span-2">
                <Field label="Full Name">
                  <input value={draft.fullName} onChange={(event) => update({ fullName: event.target.value })} className={inputClass} />
                </Field>
              </div>
              <Field label="Country">
                <input list="staff-editor-countries" value={draft.country} onChange={(event) => update({ country: event.target.value })} className={inputClass} />
                <datalist id="staff-editor-countries">
                  {suggestions.countries.map((value) => <option key={value} value={value} />)}
                </datalist>
              </Field>
              <Field label="Date of Birth">
                <input type="date" value={draft.dateOfBirth} onChange={(event) => update({ dateOfBirth: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Experience (Years)">
                <input type="number" min={0} max={60} value={draft.experienceYears} onChange={(event) => update({ experienceYears: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Retirement Age">
                <input type="number" min={40} max={90} value={draft.retirementAge} onChange={(event) => update({ retirementAge: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Development Phase">
                <select value={draft.developmentPhase} onChange={(event) => update({ developmentPhase: event.target.value })} className={inputClass}>
                  {(DEVELOPMENT_PHASES.includes(draft.developmentPhase) ? DEVELOPMENT_PHASES : [draft.developmentPhase, ...DEVELOPMENT_PHASES]).map((phase) => (
                    <option key={phase} value={phase}>{roleLabel(phase)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Philosophy">
                <input list="staff-editor-philosophies" value={draft.coachingPhilosophy} onChange={(event) => update({ coachingPhilosophy: event.target.value })} className={inputClass} />
                <datalist id="staff-editor-philosophies">
                  {suggestions.philosophies.map((value) => <option key={value} value={value} />)}
                </datalist>
              </Field>
              <div className="col-span-2">
                <Field label="Team Strategy">
                  <input list="staff-editor-strategies" value={draft.preferredTeamStrategy} onChange={(event) => update({ preferredTeamStrategy: event.target.value })} className={inputClass} />
                  <datalist id="staff-editor-strategies">
                    {suggestions.strategies.map((value) => <option key={value} value={value} />)}
                  </datalist>
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Traits (comma separated)">
                  <input value={draft.traits} onChange={(event) => update({ traits: event.target.value })} className={inputClass} />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Contract & Club</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Field label="Club">
                <select value={draft.teamId} onChange={(event) => update({ teamId: event.target.value })} className={inputClass}>
                  <option value={FREE_AGENT}>Free agent (release)</option>
                  {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </Field>
              <Field label="Primary Role">
                <select value={draft.primaryRole} onChange={(event) => update({ primaryRole: event.target.value, secondaryRole: draft.secondaryRole === event.target.value ? "" : draft.secondaryRole })} className={inputClass}>
                  {STAFF_RATING_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                </select>
              </Field>
              <Field label="Secondary Role">
                <select value={draft.secondaryRole} disabled={draft.teamId === FREE_AGENT} onChange={(event) => update({ secondaryRole: event.target.value })} className={inputClass}>
                  <option value="">None</option>
                  {STAFF_RATING_ROLES.filter((role) => role !== draft.primaryRole).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                </select>
              </Field>
              <Field label="Salary (Cr / Year)">
                <input type="number" min={0} step={0.05} value={draft.salaryCrore} disabled={draft.teamId === FREE_AGENT} onChange={(event) => update({ salaryCrore: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Contract Until">
                <input type="number" min={currentSeason} placeholder="Rolling" value={draft.endSeason} disabled={draft.teamId === FREE_AGENT} onChange={(event) => update({ endSeason: event.target.value })} className={inputClass} />
              </Field>
            </div>
            <p className="mt-2 font-space-mono text-[7px] uppercase text-text-secondary">
              {contractChanged
                ? draft.teamId === FREE_AGENT
                  ? "Will be released to the free-agent pool on save"
                  : `Will be contracted to ${teams[draft.teamId]?.name ?? draft.teamId} on save (no negotiation, budget checks skipped)`
                : contract.status === "contracted"
                  ? `Current: ${teams[contract.teamId ?? ""]?.name ?? "club"} · ${contract.endSeason == null ? "rolling" : `until ${contract.endSeason}`}`
                  : "Currently a free agent"}
            </p>
          </section>

          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Reputation & Personality</SectionTitle>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PERSON_FIELDS.map(([key, label, min, max]) => (
                renderLockedNumber(key, label, draft.person[key], min, max, (value) => updatePerson(key, value))
              ))}
            </div>
          </section>

          <p className="font-space-mono text-[8px] uppercase text-text-secondary">
            Role ratings and current ability are calculated from the coaching attributes below. Use the lock to freeze a value so seasonal development never changes it.
          </p>

          {ATTRIBUTE_GROUPS.map(([title, fields]) => (
            <section key={title} className="rounded border border-border bg-bg p-3">
              <SectionTitle>{title} Attributes</SectionTitle>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {fields.map(([key, label]) => (
                  renderLockedNumber(`attr:${key}`, label, draft.attributes[key], 1, 20, (value) => updateAttribute(key, value))
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t-2 border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isResetting || isGenerated}
              title={isGenerated ? "Generated staff have no database record" : "Restore every field from the database and clear frozen ratings"}
              className="flex h-9 items-center gap-1.5 rounded border border-border bg-surface px-3 font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-secondary transition-colors hover:border-red-500/60 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={12} />
              {isResetting ? "Resetting" : "Reset to Database"}
            </button>
            {resetMessage && <span className="truncate font-space-mono text-[8px] uppercase text-red-500">{resetMessage}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded border border-border bg-surface px-4 font-space-mono text-[9px] font-bold uppercase tracking-wider text-text-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 rounded border border-accent bg-accent px-4 font-space-mono text-[9px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
