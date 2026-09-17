"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, RotateCcw, Unlock, X } from "lucide-react";
import { useGameStore } from "@/lib/store/gameStore";
import { canReceiveBattingPositions, MIN_NON_BATTER_POSITION_RATING } from "@/lib/logic/playerBattingPositions";
import { INDIAN_REGEN_STATE_DISTRIBUTION } from "@/lib/data/indianStateRegenNames";
import { INJURY_CATALOGUE } from "@/lib/logic/injuries";
import { getPlayerSeasonHistory } from "@/lib/logic/playerHistory";
import { formatPrice } from "@/lib/logic/auctionRules";
import type { BattingStyle, BowlingType, Nationality, Player, Potential, Role } from "@/lib/types";

const ROLES: Role[] = ["Batsman", "WK-Batsman", "All-Rounder", "Pace Bowler", "Spin Bowler"];
const POTENTIALS: Potential[] = ["Established", "Promising", "World Class", "Wonderkid"];

type RatingKey =
  | "currentBatting" | "potentialBatting" | "currentBowling" | "potentialBowling"
  | "captaincy" | "reputation"
  | "powerplayBatting" | "middleOversBatting" | "deathBatting"
  | "powerplayBowling" | "middleOversBowling" | "deathBowling"
  | "battingConsistency" | "bowlingConsistency" | "battingAggression"
  | "bigMatchRating" | "pressureRating" | "fieldingRating" | "wicketkeepingRating"
  | "injuryProneness" | "paceRating" | "spinRating";

type FlagKey =
  | "isWicketkeeper" | "isPartTimeWk" | "isOpener"
  | "hasBattedAt3" | "hasBattedAt4" | "hasBattedAt5" | "hasBattedAt6" | "hasBattedAt7"
  | "isFinisher";

const CORE_RATINGS: Array<[RatingKey, string]> = [
  ["currentBatting", "Batting CA"],
  ["potentialBatting", "Batting PA"],
  ["currentBowling", "Bowling CA"],
  ["potentialBowling", "Bowling PA"],
  ["captaincy", "Captaincy"],
  ["reputation", "Reputation"],
];

const PHASE_RATINGS: Array<[RatingKey, string]> = [
  ["powerplayBatting", "PP Batting"],
  ["middleOversBatting", "Mid Batting"],
  ["deathBatting", "Death Batting"],
  ["powerplayBowling", "PP Bowling"],
  ["middleOversBowling", "Mid Bowling"],
  ["deathBowling", "Death Bowling"],
];

const TRAIT_RATINGS: Array<[RatingKey, string]> = [
  ["battingConsistency", "Bat Consistency"],
  ["bowlingConsistency", "Bowl Consistency"],
  ["battingAggression", "Aggression"],
  ["bigMatchRating", "Big Match"],
  ["pressureRating", "Pressure"],
  ["fieldingRating", "Fielding"],
  ["wicketkeepingRating", "Keeping"],
  ["injuryProneness", "Injury Risk"],
  ["paceRating", "Vs Pace"],
  ["spinRating", "Vs Spin"],
];

const RATING_RANGES: Partial<Record<RatingKey, { min: number; max: number }>> = {
  reputation: { min: 1, max: 10 },
};
const DEFAULT_RANGE = { min: 0, max: 100 };

function ratingRange(key: RatingKey) {
  return RATING_RANGES[key] ?? DEFAULT_RANGE;
}

const POSITION_FLAGS: Array<[FlagKey, string]> = [
  ["isOpener", "Opener"],
  ["hasBattedAt3", "Bats #3"],
  ["hasBattedAt4", "Bats #4"],
  ["hasBattedAt5", "Bats #5"],
  ["hasBattedAt6", "Bats #6"],
  ["hasBattedAt7", "Bats #7"],
  ["isFinisher", "Finisher"],
];

const KEEPING_FLAGS: Array<[FlagKey, string]> = [
  ["isWicketkeeper", "Wicketkeeper"],
  ["isPartTimeWk", "Part-time WK"],
];

interface Draft {
  name: string;
  age: string;
  dateOfBirth: string;
  nationality: Nationality;
  country: string;
  state: string;
  role: Role;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingType | "";
  bowlingHand: "Right-hand" | "Left-hand";
  isCapped: boolean;
  potential: Potential;
  ratings: Record<RatingKey, string>;
  flags: Record<FlagKey, boolean>;
  frozen: RatingKey[];
  setForRelease: boolean;
  captaincyUnavailable: boolean;
  contractPrice: string;
  injuryConditionId: string;
  injuryDaysOut: string;
  targetTeamId: string;
  transferSalary: string;
}

const FREE_AGENT = "__free_agent__";

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function ratingText(value: number | undefined): string {
  return value == null ? "" : String(value);
}

function buildDraft(
  player: Player,
  frozen: RatingKey[],
  contractPrice: number,
  injury: { conditionId: string; daysOut: number } | null,
): Draft {
  return {
    frozen,
    setForRelease: Boolean(player.setForRelease),
    captaincyUnavailable: Boolean(player.isIplCaptaincyUnavailable),
    contractPrice: String(contractPrice),
    injuryConditionId: injury?.conditionId ?? "",
    injuryDaysOut: injury ? String(injury.daysOut) : "",
    targetTeamId: player.currentTeamId ?? FREE_AGENT,
    transferSalary: String(contractPrice),
    name: player.name,
    age: String(player.age),
    dateOfBirth: player.dateOfBirth ?? "",
    nationality: player.nationality,
    country: player.country ?? "",
    state: player.state ?? "",
    role: player.role,
    battingStyle: player.battingStyle,
    bowlingStyle: player.bowlingStyle ?? "",
    bowlingHand: player.bowlingHand ?? "Right-hand",
    isCapped: player.isCapped,
    potential: player.potential,
    ratings: {
      currentBatting: ratingText(player.currentBatting),
      potentialBatting: ratingText(player.potentialBatting),
      currentBowling: ratingText(player.currentBowling),
      potentialBowling: ratingText(player.potentialBowling),
      captaincy: ratingText(player.captaincy),
      reputation: ratingText(player.reputation),
      powerplayBatting: ratingText(player.powerplayBatting),
      middleOversBatting: ratingText(player.middleOversBatting),
      deathBatting: ratingText(player.deathBatting),
      powerplayBowling: ratingText(player.powerplayBowling),
      middleOversBowling: ratingText(player.middleOversBowling),
      deathBowling: ratingText(player.deathBowling),
      battingConsistency: ratingText(player.battingConsistency ?? player.stamina),
      bowlingConsistency: ratingText(player.bowlingConsistency ?? player.consistency),
      battingAggression: ratingText(player.battingAggression ?? player.aggression),
      bigMatchRating: ratingText(player.bigMatchRating),
      pressureRating: ratingText(player.pressureRating),
      fieldingRating: ratingText(player.fieldingRating),
      wicketkeepingRating: ratingText(player.wicketkeepingRating),
      injuryProneness: ratingText(player.injuryProneness),
      paceRating: ratingText(player.paceRating),
      spinRating: ratingText(player.spinRating),
    },
    flags: {
      isWicketkeeper: Boolean(player.isWicketkeeper),
      isPartTimeWk: Boolean(player.isPartTimeWk),
      isOpener: Boolean(player.isOpener),
      hasBattedAt3: Boolean(player.hasBattedAt3),
      hasBattedAt4: Boolean(player.hasBattedAt4),
      hasBattedAt5: Boolean(player.hasBattedAt5),
      hasBattedAt6: Boolean(player.hasBattedAt6),
      hasBattedAt7: Boolean(player.hasBattedAt7),
      isFinisher: Boolean(player.isFinisher),
    },
  };
}

function parseRating(key: RatingKey, text: string, fallback: number | undefined): number | undefined {
  if (text.trim() === "") return fallback == null ? undefined : fallback;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return fallback;
  const { min, max } = ratingRange(key);
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function buildPatch(player: Player, draft: Draft): Partial<Player> {
  const patch: Partial<Player> = {};
  const assign = <K extends keyof Player>(key: K, value: Player[K]) => {
    if (player[key] !== value) patch[key] = value;
  };

  assign("name", draft.name.trim() || player.name);
  const parsedAge = Number(draft.age);
  assign("age", Number.isFinite(parsedAge) && parsedAge > 0 ? Math.round(parsedAge) : player.age);
  assign("dateOfBirth", draft.dateOfBirth.trim() || undefined);
  assign("nationality", draft.nationality);
  assign("country", draft.country.trim() || undefined);
  assign("state", draft.state.trim() || undefined);
  assign("role", draft.role);
  assign("battingStyle", draft.battingStyle);
  assign("bowlingStyle", draft.bowlingStyle === "" ? null : draft.bowlingStyle);
  assign("bowlingHand", draft.bowlingStyle === "" ? null : draft.bowlingHand);
  assign("isCapped", draft.isCapped);
  assign("potential", draft.potential);
  assign("setForRelease", draft.setForRelease);
  assign("isIplCaptaincyUnavailable", draft.captaincyUnavailable);

  (Object.keys(draft.ratings) as RatingKey[]).forEach((key) => {
    const current = key === "battingConsistency" ? player.battingConsistency ?? player.stamina
      : key === "bowlingConsistency" ? player.bowlingConsistency ?? player.consistency
      : key === "battingAggression" ? player.battingAggression ?? player.aggression
      : player[key];
    const next = parseRating(key, draft.ratings[key], current);
    if (next === current) return;
    (patch as Record<string, unknown>)[key] = next;
    if (key === "battingConsistency") patch.stamina = next;
    if (key === "bowlingConsistency") patch.consistency = next;
    if (key === "battingAggression") patch.aggression = next;
  });

  (Object.keys(draft.flags) as FlagKey[]).forEach((key) => {
    if (Boolean(player[key]) !== draft.flags[key]) patch[key] = draft.flags[key];
  });

  return patch;
}

const inputClass = "h-8 w-full rounded border border-border bg-surface px-2 font-space-mono text-[10px] text-text-primary outline-none transition-colors focus:border-accent";
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

interface PlayerEditorModalProps {
  player: Player;
  onClose: () => void;
}

export function PlayerEditorModal({ player, onClose }: PlayerEditorModalProps) {
  const applyPlayerEdit = useGameStore((state) => state.applyPlayerEdit);
  const resetPlayerToDatabase = useGameStore((state) => state.resetPlayerToDatabase);
  const setPlayerInjury = useGameStore((state) => state.setPlayerInjury);
  const setPlayerContractPrice = useGameStore((state) => state.setPlayerContractPrice);
  const transferPlayer = useGameStore((state) => state.transferPlayer);
  const players = useGameStore((state) => state.players);
  const teams = useGameStore((state) => state.teams);
  const auction = useGameStore((state) => state.auction);
  const currentSeason = useGameStore((state) => state.currentSeason);
  const currentDate = useGameStore((state) => state.currentDate);
  const activeInjury = useGameStore((state) => state.activeInjuries[player.id]);
  const frozenAttributes = useGameStore((state) => state.frozenPlayerAttributes[player.id]);

  const rosterSeason = String(auction?.season ?? currentSeason);
  const currentContractPrice = auction?.saleHistory.find((sale) => sale.playerId === player.id)?.price
    ?? getPlayerSeasonHistory(player.iplHistory, rosterSeason)?.price
    ?? 0;
  const isAuctionLive = auction?.phase === "live";
  const isGeneratedPlayer = player.careerState?.origin === "generated";
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [draft, setDraft] = useState<Draft>(() => buildDraft(
    player,
    Object.keys(frozenAttributes ?? {}) as RatingKey[],
    currentContractPrice,
    activeInjury
      ? { conditionId: activeInjury.conditionId, daysOut: daysBetween(currentDate, activeInjury.actualReturnDate) }
      : null,
  ));

  const teamOptions = useMemo(
    () => Object.values(teams).sort((left, right) => left.name.localeCompare(right.name)),
    [teams],
  );
  const selectedInjury = INJURY_CATALOGUE.find((definition) => definition.id === draft.injuryConditionId);

  const indianStateOptions = useMemo(() => {
    const names = new Set<string>(INDIAN_REGEN_STATE_DISTRIBUTION.map((state) => state.name));
    Object.values(players).forEach((candidate) => {
      if (candidate.nationality === "Indian" && candidate.state?.trim()) names.add(candidate.state.trim());
    });
    if (draft.state.trim()) names.add(draft.state.trim());
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [players, draft.state]);

  const update = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
  const updateRating = (key: RatingKey, value: string) =>
    setDraft((current) => ({ ...current, ratings: { ...current.ratings, [key]: value } }));
  const toggleFlag = (key: FlagKey) =>
    setDraft((current) => ({ ...current, flags: { ...current.flags, [key]: !current.flags[key] } }));
  const toggleFrozen = (key: RatingKey) =>
    setDraft((current) => ({
      ...current,
      frozen: current.frozen.includes(key) ? current.frozen.filter((item) => item !== key) : [...current.frozen, key],
    }));

  const draftBattingCa = parseRating("currentBatting", draft.ratings.currentBatting, player.currentBatting) ?? 0;
  const positionsAllowed = canReceiveBattingPositions({ role: draft.role, currentBatting: draftBattingCa });

  const handleSave = () => {
    const patch = buildPatch(player, draft);
    const previousFrozen = Object.keys(frozenAttributes ?? {}).sort().join(",");
    const frozenChanged = previousFrozen !== [...draft.frozen].sort().join(",");
    if (Object.keys(patch).length > 0 || frozenChanged) applyPlayerEdit(player.id, patch, draft.frozen);

    const previousDaysOut = activeInjury ? daysBetween(currentDate, activeInjury.actualReturnDate) : null;
    const nextDaysOut = Number(draft.injuryDaysOut);
    if (draft.injuryConditionId === "") {
      if (activeInjury) setPlayerInjury(player.id, null);
    } else if (
      draft.injuryConditionId !== activeInjury?.conditionId
      || (Number.isFinite(nextDaysOut) && nextDaysOut > 0 && nextDaysOut !== previousDaysOut)
    ) {
      setPlayerInjury(player.id, {
        conditionId: draft.injuryConditionId,
        daysOut: Number.isFinite(nextDaysOut) && nextDaysOut > 0 ? nextDaysOut : (selectedInjury?.minimumRecoveryDays ?? 7),
      });
    }

    const nextTeamId = draft.targetTeamId === FREE_AGENT ? null : draft.targetTeamId;
    const salary = Number(draft.transferSalary);
    const price = Number(draft.contractPrice);
    if (nextTeamId !== (player.currentTeamId ?? null)) {
      if (!isAuctionLive) transferPlayer(player.id, nextTeamId, Number.isFinite(salary) ? salary : undefined);
    } else if (player.currentTeamId && Number.isFinite(price) && Math.round(price) !== currentContractPrice) {
      setPlayerContractPrice(player.id, price);
    }
    onClose();
  };

  const handleReset = async () => {
    if (!window.confirm(`Reset ${player.name} to the database values? This clears every edit and frozen rating for this save.`)) return;
    setIsResetting(true);
    const result = await resetPlayerToDatabase(player.id);
    setIsResetting(false);
    if (result === "reset") {
      onClose();
      return;
    }
    setResetMessage(result === "not-in-database"
      ? "This player was generated in this save and has no database record to reset to."
      : "The database roster could not be loaded right now.");
  };

  const renderRatingGrid = (fields: Array<[RatingKey, string]>, columns: string) => (
    <div className={`grid ${columns} gap-2`}>
      {fields.map(([key, label]) => {
        const { min, max } = ratingRange(key);
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
              value={draft.ratings[key]}
              placeholder="-"
              onChange={(event) => updateRating(key, event.target.value)}
              className={`${inputClass} text-center font-anton text-[15px] ${isFrozen ? "border-accent/70 bg-accent/5" : ""}`}
            />
          </div>
        );
      })}
    </div>
  );

  const renderFlagChips = (fields: Array<[FlagKey, string]>, disabled: boolean) => (
    <div className="flex flex-wrap gap-1.5">
      {fields.map(([key, label]) => {
        const active = draft.flags[key];
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => toggleFlag(key)}
            className={`rounded border px-2.5 py-1 font-space-mono text-[8px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-surface text-text-secondary hover:border-accent/60 hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-lg border-2 border-border bg-surface text-text-primary shadow-2xl animate-in zoom-in-95 duration-150"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b-2 border-border px-4 py-3">
          <div className="min-w-0">
            <span className="font-space-mono text-[9px] font-bold uppercase tracking-widest text-text-secondary">Player Editor</span>
            <h3 className="truncate font-anton text-[22px] uppercase leading-none">{player.name}</h3>
            <p className="mt-1 font-space-mono text-[8px] uppercase text-text-secondary">Changes apply to this save only</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close player editor"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface p-3">
          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Profile</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="col-span-2">
                <Field label="Name">
                  <input value={draft.name} onChange={(event) => update({ name: event.target.value })} className={inputClass} />
                </Field>
              </div>
              <Field label="Age">
                <input type="number" min={15} max={50} value={draft.age} onChange={(event) => update({ age: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Date of Birth">
                <input type="date" value={draft.dateOfBirth} onChange={(event) => update({ dateOfBirth: event.target.value })} className={inputClass} />
              </Field>
              <Field label="Nationality">
                <select value={draft.nationality} onChange={(event) => update({ nationality: event.target.value as Nationality })} className={inputClass}>
                  <option value="Indian">Indian</option>
                  <option value="Overseas">Overseas</option>
                </select>
              </Field>
              <Field label="Country">
                <input value={draft.country} onChange={(event) => update({ country: event.target.value })} className={inputClass} />
              </Field>
              <Field label={draft.nationality === "Indian" ? "State" : "Region"}>
                {draft.nationality === "Indian" ? (
                  <select value={draft.state} onChange={(event) => update({ state: event.target.value })} className={inputClass}>
                    <option value="">Not set</option>
                    {indianStateOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                ) : (
                  <input value={draft.state} onChange={(event) => update({ state: event.target.value })} className={inputClass} />
                )}
              </Field>
              <Field label="Status">
                <select value={draft.isCapped ? "capped" : "uncapped"} onChange={(event) => update({ isCapped: event.target.value === "capped" })} className={inputClass}>
                  <option value="capped">Capped</option>
                  <option value="uncapped">Uncapped</option>
                </select>
              </Field>
              <Field label="Role">
                <select value={draft.role} onChange={(event) => update({ role: event.target.value as Role })} className={inputClass}>
                  {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </Field>
              <Field label="Batting Style">
                <select value={draft.battingStyle} onChange={(event) => update({ battingStyle: event.target.value as BattingStyle })} className={inputClass}>
                  <option value="Right-hand">Right-hand</option>
                  <option value="Left-hand">Left-hand</option>
                </select>
              </Field>
              <Field label="Bowling Style">
                <select value={draft.bowlingStyle} onChange={(event) => update({ bowlingStyle: event.target.value as BowlingType | "" })} className={inputClass}>
                  <option value="">Does not bowl</option>
                  <option value="Pacer">Pacer</option>
                  <option value="Spinner">Spinner</option>
                </select>
              </Field>
              <Field label="Bowling Hand">
                <select
                  value={draft.bowlingHand}
                  disabled={draft.bowlingStyle === ""}
                  onChange={(event) => update({ bowlingHand: event.target.value as "Right-hand" | "Left-hand" })}
                  className={`${inputClass} disabled:opacity-40`}
                >
                  <option value="Right-hand">Right-hand</option>
                  <option value="Left-hand">Left-hand</option>
                </select>
              </Field>
              <Field label="Potential Tier">
                <select value={draft.potential} onChange={(event) => update({ potential: event.target.value as Potential })} className={inputClass}>
                  {POTENTIALS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Roles & Batting Positions</SectionTitle>
            <div className="space-y-2">
              {renderFlagChips(KEEPING_FLAGS, false)}
              {renderFlagChips(POSITION_FLAGS, !positionsAllowed)}
              {!positionsAllowed && (
                <p className="font-space-mono text-[8px] uppercase text-text-secondary">
                  Batting positions need the Batsman or WK-Batsman role, or Batting CA of {MIN_NON_BATTER_POSITION_RATING}+
                </p>
              )}
            </div>
          </section>

          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Career & Contract</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label={`Contract '${rosterSeason.slice(-2)} (Lakhs)`}>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={draft.contractPrice}
                  disabled={!player.currentTeamId || draft.targetTeamId !== (player.currentTeamId ?? FREE_AGENT)}
                  onChange={(event) => update({ contractPrice: event.target.value })}
                  className={`${inputClass} disabled:opacity-40`}
                />
              </Field>
              <div className="col-span-2 sm:col-span-3 flex flex-wrap items-end gap-1.5 pb-0.5">
                {[
                  ["setForRelease", "Set for release", draft.setForRelease] as const,
                  ["captaincyUnavailable", "No IPL captaincy", draft.captaincyUnavailable] as const,
                ].map(([key, label, active]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update({ [key]: !active } as Partial<Draft>)}
                    className={`h-8 rounded border px-2.5 font-space-mono text-[8px] font-bold uppercase tracking-wider transition-colors ${
                      active
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-surface text-text-secondary hover:border-accent/60 hover:text-text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <span className="font-space-mono text-[7px] uppercase text-text-secondary">
                  {player.currentTeamId ? `Currently ${formatPrice(currentContractPrice)}` : "No contract"}
                </span>
              </div>
              <div className="col-span-2">
                <Field label="Injury">
                  <select
                    value={draft.injuryConditionId}
                    onChange={(event) => {
                      const definition = INJURY_CATALOGUE.find((candidate) => candidate.id === event.target.value);
                      update({
                        injuryConditionId: event.target.value,
                        injuryDaysOut: definition
                          ? String(Math.round((definition.minimumRecoveryDays + definition.maximumRecoveryDays) / 2))
                          : "",
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="">Fit</option>
                    <optgroup label="Minor">
                      {INJURY_CATALOGUE.filter((definition) => definition.category === "minor").map((definition) => (
                        <option key={definition.id} value={definition.id}>{definition.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Major">
                      {INJURY_CATALOGUE.filter((definition) => definition.category === "major").map((definition) => (
                        <option key={definition.id} value={definition.id}>{definition.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
              </div>
              <Field label="Days Out">
                <input
                  type="number"
                  min={1}
                  value={draft.injuryDaysOut}
                  disabled={draft.injuryConditionId === ""}
                  onChange={(event) => update({ injuryDaysOut: event.target.value })}
                  className={`${inputClass} disabled:opacity-40`}
                />
              </Field>
              <div className="flex items-end pb-1 font-space-mono text-[7px] uppercase text-text-secondary">
                {activeInjury
                  ? `Now: ${activeInjury.conditionName}, back ${activeInjury.actualReturnDate}`
                  : "Currently fit"}
              </div>
            </div>
          </section>

          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Team</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="col-span-2">
                <Field label="Club">
                  <select
                    value={draft.targetTeamId}
                    disabled={isAuctionLive}
                    onChange={(event) => update({ targetTeamId: event.target.value })}
                    className={`${inputClass} disabled:opacity-40`}
                  >
                    <option value={FREE_AGENT}>Free agent (release)</option>
                    {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Salary (Lakhs)">
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={draft.transferSalary}
                  disabled={isAuctionLive || draft.targetTeamId === FREE_AGENT || draft.targetTeamId === (player.currentTeamId ?? FREE_AGENT)}
                  onChange={(event) => update({ transferSalary: event.target.value })}
                  className={`${inputClass} disabled:opacity-40`}
                />
              </Field>
              <div className="flex items-end pb-1 font-space-mono text-[7px] uppercase text-text-secondary">
                {isAuctionLive
                  ? "Locked while the auction is live"
                  : draft.targetTeamId !== (player.currentTeamId ?? FREE_AGENT)
                    ? draft.targetTeamId === FREE_AGENT
                      ? `Releases from ${teams[player.currentTeamId ?? ""]?.shortName ?? "club"}`
                      : `Moves ${player.currentTeamId ? `from ${teams[player.currentTeamId]?.shortName}` : "from free agency"} for ${formatPrice(Math.max(0, Number(draft.transferSalary) || 0))}`
                    : player.currentTeamId ? `Current: ${teams[player.currentTeamId]?.name}` : "Free agent"}
              </div>
            </div>
          </section>

          <p className="font-space-mono text-[8px] uppercase text-text-secondary">
            Use the lock beside a rating to freeze it. Frozen values are pinned for this save and never move with age, form or development.
          </p>

          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Ability</SectionTitle>
            {renderRatingGrid(CORE_RATINGS, "grid-cols-3 sm:grid-cols-6")}
          </section>

          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Phase Ratings</SectionTitle>
            {renderRatingGrid(PHASE_RATINGS, "grid-cols-3 sm:grid-cols-6")}
          </section>

          <section className="rounded border border-border bg-bg p-3">
            <SectionTitle>Match Traits</SectionTitle>
            {renderRatingGrid(TRAIT_RATINGS, "grid-cols-3 sm:grid-cols-5")}
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t-2 border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isResetting || isGeneratedPlayer}
              title={isGeneratedPlayer ? "Generated players have no database record" : "Restore every field from the database and clear frozen ratings"}
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
