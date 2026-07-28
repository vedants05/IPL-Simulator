"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  Droplets,
  Gauge,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  getHomeStadium,
  getStadiumBoundaryLimits,
  type BoundaryDimensions,
  type ExpectedScoreRange,
} from "@/lib/data/pitchCurator";
import {
  applyGroundScoringImpact,
  calculateGroundScoringImpact,
  calculateOutfieldPreparationTiming,
  calculateOutfieldScoringImpact,
  MAX_OUTFIELD_FIRMNESS_GMAX,
  MAX_OUTFIELD_GRASS_HEIGHT_MM,
  MAX_OUTFIELD_MOISTURE_PERCENT,
  MIN_OUTFIELD_FIRMNESS_GMAX,
  MIN_OUTFIELD_GRASS_HEIGHT_MM,
  MIN_OUTFIELD_MOISTURE_PERCENT,
  type BoundaryPreset,
  type OutfieldPreparationProject,
  type OutfieldSettings,
} from "@/lib/logic/stadiumManagement";
import { addDaysToDateKey } from "@/lib/logic/careerCalendar";

interface StadiumManagementPageProps {
  teamId: string;
  teamName: string;
  dimensions: BoundaryDimensions;
  presets: readonly BoundaryPreset[];
  currentPitchName: string;
  currentPitchScoreRange: ExpectedScoreRange;
  currentDate: string;
  outfieldSettings: OutfieldSettings;
  outfieldProject: OutfieldPreparationProject | null;
  onApplyDimensions: (dimensions: BoundaryDimensions) => void;
  onSavePreset: (name: string, dimensions: BoundaryDimensions) => string | null;
  onApplyPreset: (presetId: string) => boolean;
  onDeletePreset: (presetId: string) => boolean;
  onStartOutfieldPreparation: (settings: OutfieldSettings) => boolean;
}

const formatCapacity = (capacity: number) => new Intl.NumberFormat("en-GB").format(capacity);
const formatDate = (dateKey: string) => new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function BoundaryControl({
  label,
  value,
  historical,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  historical: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  const stopCount = maximum - 50 + 1;
  const progress = (value - 50) / Math.max(1, maximum - 50);

  return (
    <label className="block">
      <div className="mb-1 flex items-end justify-between gap-3">
        <div>
          <div className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-text-secondary">
            {label}
          </div>
          <div className="font-barlow text-[9px] text-text-secondary">
            Historical setting: {historical}m
          </div>
        </div>
        <div className="font-anton text-[20px] leading-none text-accent">
          {value}<span className="ml-0.5 text-[12px] text-text-secondary">M</span>
        </div>
      </div>
      <div className="relative h-6 select-none">
        <div className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute left-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent transition-[width] duration-150"
          style={{ width: `calc((100% - 1rem) * ${progress})` }}
        />
        {Array.from({ length: stopCount }, (_, index) => {
          const stopValue = index + 50;
          const active = stopValue <= value;
          return (
            <span
              key={stopValue}
              className={`pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors ${
                active ? "border-accent bg-accent" : "border-border bg-surface"
              }`}
              style={{ left: `calc(0.5rem + (100% - 1rem) * ${index / Math.max(1, stopCount - 1)})` }}
            />
          );
        })}
        <span
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-accent shadow-[0_1px_6px_rgba(0,0,0,.28)] transition-[left] duration-150"
          style={{ left: `calc(0.5rem + (100% - 1rem) * ${progress})` }}
        />
        <input
          type="range"
          min={50}
          max={maximum}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="flex justify-between font-space-mono text-[6px] font-bold text-text-secondary">
        <span>50M MIN</span>
        <span>{maximum}M MAX</span>
      </div>
    </label>
  );
}

function OutfieldControl({
  label,
  value,
  minimum,
  maximum,
  step,
  unit,
  low,
  high,
  explanation,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  unit: string;
  low: string;
  high: string;
  explanation: string;
  onChange: (value: number) => void;
}) {
  const stopCount = Math.floor((maximum - minimum) / step) + 1;
  const progress = (value - minimum) / Math.max(1, maximum - minimum);
  return (
    <label className="block rounded-lg border border-border bg-bg/40 p-3">
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-primary">{label}</span>
          <span className="mt-0.5 block font-barlow text-[9px] leading-snug text-text-secondary">{explanation}</span>
        </span>
        <span className="shrink-0 font-anton text-[20px] leading-none text-accent">
          {value}<span className="ml-0.5 text-[10px] text-text-secondary">{unit}</span>
        </span>
      </span>
      <span className="relative mt-2 block h-7 select-none">
        <span className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        <span
          className="absolute left-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent transition-[width] duration-150"
          style={{ width: `calc((100% - 1rem) * ${progress})` }}
        />
        {Array.from({ length: stopCount }, (_, index) => {
          const stopValue = minimum + index * step;
          return (
            <span
              key={stopValue}
              className={`pointer-events-none absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                stopValue <= value ? "border-accent bg-accent" : "border-border bg-surface"
              }`}
              style={{ left: `calc(0.5rem + (100% - 1rem) * ${index / Math.max(1, stopCount - 1)})` }}
            />
          );
        })}
        <span
          className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-accent shadow-[0_1px_6px_rgba(0,0,0,.28)] transition-[left] duration-150"
          style={{ left: `calc(0.5rem + (100% - 1rem) * ${progress})` }}
        />
        <input
          type="range"
          min={minimum}
          max={maximum}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
      </span>
      <span className="flex justify-between font-space-mono text-[6px] font-bold uppercase text-text-secondary">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

function StadiumDiagram({
  name,
  straightMetres,
  wideMetres,
  straightMaximum,
  wideMaximum,
}: {
  name: string;
  straightMetres: number;
  wideMetres: number;
  straightMaximum: number;
  wideMaximum: number;
}) {
  const ropeRadiusX = 92 + ((wideMetres - 50) / Math.max(1, wideMaximum - 50)) * 54;
  const ropeRadiusY = 62 + ((straightMetres - 50) / Math.max(1, straightMaximum - 50)) * 36;
  const top = 125 - ropeRadiusY;
  const bottom = 125 + ropeRadiusY;
  const left = 200 - ropeRadiusX;
  const right = 200 + ropeRadiusX;

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-lg border border-white/10 bg-[#153d2c]">
      <div className="absolute left-3 top-3 z-10">
        <div className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-white/55">
          Live rope layout
        </div>
        <div className="mt-1 max-w-[220px] truncate font-anton text-[15px] uppercase text-white">
          {name}
        </div>
      </div>
      <svg
        viewBox="0 0 400 250"
        role="img"
        aria-label={`Animated boundary diagram showing ${straightMetres} metre straight and ${wideMetres} metre wide boundaries`}
        className="h-full min-h-0 w-full"
      >
        <defs>
          <radialGradient id="outfieldGradient" cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="#3f8e56" />
            <stop offset="72%" stopColor="#286c43" />
            <stop offset="100%" stopColor="#1d5237" />
          </radialGradient>
          <pattern id="mownGrass" width="34" height="34" patternUnits="userSpaceOnUse">
            <rect width="17" height="34" fill="rgba(255,255,255,.018)" />
            <rect x="17" width="17" height="34" fill="rgba(0,0,0,.025)" />
          </pattern>
          <filter id="ropeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="200" cy="125" rx="184" ry="113" fill="#0d271c" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
        <ellipse cx="200" cy="125" rx="168" ry="103" fill="url(#outfieldGradient)" />
        <ellipse cx="200" cy="125" rx="168" ry="103" fill="url(#mownGrass)" />

        <ellipse
          cx="200"
          cy="125"
          rx={ropeRadiusX}
          ry={ropeRadiusY}
          fill="none"
          stroke="#f4dd73"
          strokeWidth="2"
          strokeDasharray="4 5"
          filter="url(#ropeGlow)"
          style={{ transition: "all 500ms cubic-bezier(.22,1,.36,1)" }}
        />
        <ellipse
          cx="200"
          cy="125"
          rx={ropeRadiusX + 4}
          ry={ropeRadiusY + 4}
          fill="none"
          stroke="rgba(244,221,115,.22)"
          strokeWidth="1"
          className="animate-pulse"
          style={{ transition: "all 500ms cubic-bezier(.22,1,.36,1)" }}
        />

        <rect x="190" y="86" width="20" height="78" rx="2" fill="#c6a86b" stroke="rgba(22,19,15,.45)" />
        <line x1="190" y1="96" x2="210" y2="96" stroke="#f4e9cc" strokeWidth="1.5" />
        <line x1="190" y1="154" x2="210" y2="154" stroke="#f4e9cc" strokeWidth="1.5" />
        <line x1="200" y1={top} x2="200" y2="86" stroke="rgba(255,255,255,.72)" strokeWidth="1" />
        <line x1="200" y1="164" x2="200" y2={bottom} stroke="rgba(255,255,255,.72)" strokeWidth="1" />
        <line x1={left} y1="125" x2="190" y2="125" stroke="rgba(255,255,255,.72)" strokeWidth="1" />
        <line x1="210" y1="125" x2={right} y2="125" stroke="rgba(255,255,255,.72)" strokeWidth="1" />

        <g
          style={{ transition: "transform 500ms cubic-bezier(.22,1,.36,1)" }}
        >
          <rect x="166" y={top - 8} width="68" height="16" rx="8" fill="#111d17" />
          <text x="200" y={top + 3} textAnchor="middle" fill="#ffffff" fontSize="8" fontFamily="monospace" fontWeight="700">
            STRAIGHT {straightMetres}M
          </text>
        </g>
        <g>
          <rect x={right - 24} y="117" width="66" height="16" rx="8" fill="#111d17" />
          <text x={right + 9} y="128" textAnchor="middle" fill="#ffffff" fontSize="8" fontFamily="monospace" fontWeight="700">
            WIDE {wideMetres}M
          </text>
        </g>
      </svg>
      <div className="absolute bottom-2 left-0 right-0 text-center font-space-mono text-[6px] font-bold uppercase tracking-[0.2em] text-white/45">
        Rope movement updates with your settings
      </div>
    </div>
  );
}

export default function StadiumManagementPage({
  teamId,
  teamName,
  dimensions,
  presets,
  currentPitchName,
  currentPitchScoreRange,
  currentDate,
  outfieldSettings,
  outfieldProject,
  onApplyDimensions,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onStartOutfieldPreparation,
}: StadiumManagementPageProps) {
  const stadium = getHomeStadium(teamId);
  const limits = getStadiumBoundaryLimits(teamId);
  const [draft, setDraft] = useState(dimensions);
  const [presetName, setPresetName] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [outfieldCustomizerOpen, setOutfieldCustomizerOpen] = useState(false);
  const [outfieldDraft, setOutfieldDraft] = useState(outfieldSettings);

  useEffect(() => {
    setDraft(dimensions);
  }, [dimensions.straightMetres, dimensions.wideMetres]);

  useEffect(() => {
    setOutfieldDraft(outfieldSettings);
  }, [
    outfieldSettings.firmnessGmax,
    outfieldSettings.grassHeightMm,
    outfieldSettings.moisturePercent,
  ]);

  const impact = useMemo(
    () => calculateGroundScoringImpact(teamId, draft, outfieldSettings),
    [draft, outfieldSettings, teamId],
  );
  const adjustedScoreRange = useMemo(
    () => applyGroundScoringImpact(currentPitchScoreRange, impact),
    [currentPitchScoreRange, impact],
  );
  const activeOutfieldImpact = useMemo(
    () => calculateOutfieldScoringImpact(teamId, outfieldSettings),
    [outfieldSettings, teamId],
  );
  const draftOutfieldImpact = useMemo(
    () => calculateOutfieldScoringImpact(teamId, outfieldDraft),
    [outfieldDraft, teamId],
  );
  const outfieldTiming = useMemo(
    () => calculateOutfieldPreparationTiming(teamId, outfieldSettings, outfieldDraft),
    [outfieldDraft, outfieldSettings, teamId],
  );
  const hasChanges = (
    draft.straightMetres !== dimensions.straightMetres
    || draft.wideMetres !== dimensions.wideMetres
  );
  const hasOutfieldChanges = (
    outfieldDraft.grassHeightMm !== outfieldSettings.grassHeightMm
    || outfieldDraft.moisturePercent !== outfieldSettings.moisturePercent
    || outfieldDraft.firmnessGmax !== outfieldSettings.firmnessGmax
  );

  if (!stadium || !limits) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border-2 border-border bg-surface p-8 font-space-mono text-xs uppercase text-text-secondary">
        No home stadium has been registered for {teamName}.
      </div>
    );
  }

  const savePreset = () => {
    const id = onSavePreset(presetName, draft);
    if (!id) return;
    setPresetName("");
    setSavedMessage("Preset saved");
    window.setTimeout(() => setSavedMessage(""), 1800);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-bg">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-surface px-4 py-2.5 [@media(max-height:650px)]:py-2">
        <div>
          <div className="font-space-mono text-[7px] font-bold uppercase tracking-[0.2em] text-accent">
            {teamName} · Grounds department
          </div>
          <h2 className="mt-0.5 font-anton text-[20px] uppercase leading-none text-text-primary">
            Stadium Management
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="font-space-mono text-[7px] font-bold uppercase text-warning">
              Unsaved rope changes
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              onApplyDimensions(draft);
              setSavedMessage("Boundary layout applied");
              window.setTimeout(() => setSavedMessage(""), 1800);
            }}
            disabled={!hasChanges}
            className="flex items-center gap-2 rounded border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 font-space-mono text-[8px] font-bold uppercase tracking-wider text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Check size={13} />
            Apply layout
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-3 [@media(max-height:650px)]:p-2">
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.35fr)_minmax(290px,.65fr)] gap-3 [@media(max-height:650px)]:gap-2">
          <section className="grid h-full min-h-0 grid-rows-[minmax(150px,1fr)_auto_minmax(105px,.52fr)] gap-3 overflow-hidden [@media(max-height:650px)]:grid-rows-[minmax(125px,1fr)_auto_minmax(90px,.45fr)] [@media(max-height:650px)]:gap-2">
            <StadiumDiagram
              name={stadium.name}
              straightMetres={draft.straightMetres}
              wideMetres={draft.wideMetres}
              straightMaximum={limits.straightMaximum}
              wideMaximum={limits.wideMaximum}
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border-2 border-border bg-surface p-3 [@media(max-height:650px)]:p-2">
                <BoundaryControl
                  label="Straight boundaries"
                  value={draft.straightMetres}
                  historical={stadium.defaultBoundaryDimensions.straightMetres}
                  maximum={limits.straightMaximum}
                  onChange={(straightMetres) => setDraft((current) => ({ ...current, straightMetres }))}
                />
              </div>
              <div className="rounded-lg border-2 border-border bg-surface p-3 [@media(max-height:650px)]:p-2">
                <BoundaryControl
                  label="Wide boundaries"
                  value={draft.wideMetres}
                  historical={stadium.defaultBoundaryDimensions.wideMetres}
                  maximum={limits.wideMaximum}
                  onChange={(wideMetres) => setDraft((current) => ({ ...current, wideMetres }))}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-3 [@media(max-height:650px)]:p-2">
              <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-anton text-[15px] uppercase text-text-primary">Boundary presets</div>
                  <div className="font-barlow text-[9px] text-text-secondary [@media(max-height:650px)]:hidden">
                    Store rope layouts and restore them without rebuilding the settings.
                  </div>
                </div>
                {savedMessage && (
                  <span className="font-space-mono text-[7px] font-bold uppercase text-success">
                    {savedMessage}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                <input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && presetName.trim()) savePreset();
                  }}
                  maxLength={32}
                  placeholder="Preset name"
                  className="min-w-0 flex-1 rounded border border-border bg-bg px-3 py-1.5 font-barlow text-xs text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-accent"
                />
                <button
                  type="button"
                  onClick={savePreset}
                  disabled={!presetName.trim()}
                  className="flex items-center gap-2 rounded border border-accent bg-accent px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Save size={12} />
                  Save preset
                </button>
              </div>

              <div className="mt-2 grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-1.5 overflow-y-auto pr-1">
                {presets.length === 0 && (
                  <div className="col-span-full rounded border border-dashed border-border px-4 py-3 text-center font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                    No boundary presets saved
                  </div>
                )}
                {presets.map((preset) => (
                  <div key={preset.id} className="flex min-w-0 items-center gap-2 rounded border border-border bg-bg px-2.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-barlow text-xs font-bold text-text-primary">{preset.name}</div>
                      <div className="mt-0.5 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                        {preset.dimensions.straightMetres}m straight · {preset.dimensions.wideMetres}m wide
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onApplyPreset(preset.id)}
                      className="rounded border border-border px-2 py-1.5 font-space-mono text-[7px] font-bold uppercase text-text-primary hover:border-accent hover:text-accent"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePreset(preset.id)}
                      aria-label={`Delete ${preset.name}`}
                      className="rounded border border-border p-1.5 text-text-secondary hover:border-danger hover:text-danger"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden [@media(max-height:650px)]:gap-2">
            <div className="rounded-lg border-2 border-border bg-surface p-3 [@media(max-height:650px)]:p-2.5">
              <div className="flex items-center gap-2 border-b border-[#16130f]/10 pb-2">
                <Building2 size={14} className="text-accent" />
                <div className="font-anton text-[15px] uppercase text-text-primary">Stadium profile</div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <dt className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Capacity</dt>
                  <dd className="mt-0.5 font-anton text-[19px] leading-none text-text-primary">{formatCapacity(stadium.capacity)}</dd>
                </div>
                <div>
                  <dt className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Location</dt>
                  <dd className="mt-0.5 font-barlow text-xs font-bold text-text-primary">{stadium.location}</dd>
                </div>
                <div>
                  <dt className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Historical straight</dt>
                  <dd className="mt-0.5 font-barlow text-xs font-bold text-text-primary">{stadium.defaultBoundaryDimensions.straightMetres}m</dd>
                </div>
                <div>
                  <dt className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Historical wide</dt>
                  <dd className="mt-0.5 font-barlow text-xs font-bold text-text-primary">{stadium.defaultBoundaryDimensions.wideMetres}m</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => setDraft(stadium.defaultBoundaryDimensions)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-border py-1.5 font-space-mono text-[7px] font-bold uppercase text-text-secondary hover:border-accent hover:text-accent"
              >
                <RotateCcw size={12} />
                Reset draft to historical
              </button>
            </div>

            <div className="min-h-0 overflow-hidden rounded-lg border-2 border-border bg-surface p-3 [@media(max-height:650px)]:p-2.5">
              <div className="flex items-center justify-between border-b border-[#16130f]/10 pb-2">
                <div className="flex items-center gap-2">
                  <Droplets size={14} className="text-accent" />
                  <div className="font-anton text-[15px] uppercase text-text-primary">Outfield</div>
                </div>
                <span className="rounded-full bg-success/15 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-success">
                  {activeOutfieldImpact.label}
                </span>
              </div>
              <div className="mt-1.5 truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">
                {stadium.outfield.grass} · {stadium.outfield.drainage}
              </div>
              <div className="mt-2">
                <div className="mb-1 flex justify-between font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                  <span>Outfield speed</span>
                  <span>{activeOutfieldImpact.speedRating}/10</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#16130f]/10">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-500"
                    style={{ width: `${activeOutfieldImpact.speedRating * 10}%` }}
                  />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <dt className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Cut height</dt>
                  <dd className="mt-0.5 font-barlow text-xs font-semibold text-text-primary">{outfieldSettings.grassHeightMm}mm</dd>
                </div>
                <div>
                  <dt className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Moisture</dt>
                  <dd className="mt-0.5 font-barlow text-xs font-semibold text-text-primary">{outfieldSettings.moisturePercent}%</dd>
                </div>
                <div>
                  <dt className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Firmness</dt>
                  <dd className="mt-0.5 font-barlow text-xs font-semibold text-text-primary">{outfieldSettings.firmnessGmax} Gmax</dd>
                </div>
              </dl>
              <div className="mt-2 border-t border-[#16130f]/10 pt-2">
                {outfieldProject ? (
                  <div className="flex items-center gap-2 rounded border border-accent/25 bg-accent/[0.06] px-2 py-1.5">
                    <CalendarClock size={13} className="shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="font-space-mono text-[7px] font-bold uppercase text-accent">Preparation underway</div>
                      <div className="truncate font-barlow text-[9px] text-text-secondary">
                        New outfield ready {formatDate(outfieldProject.completesOn)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOutfieldDraft(outfieldSettings);
                      setOutfieldCustomizerOpen(true);
                    }}
                    className="w-full rounded border border-accent px-3 py-1.5 font-space-mono text-[7px] font-bold uppercase text-accent transition-colors hover:bg-accent hover:text-white"
                  >
                    Customise outfield
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-lg border-2 border-border bg-[#16130f] p-3 text-white [@media(max-height:650px)]:p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-space-mono text-[7px] font-bold uppercase tracking-[0.15em] text-white/55">
                    <Gauge size={13} />
                    Projected run environment
                  </div>
                  <div className="mt-1.5 font-anton text-[22px] leading-none">
                    {impact.percentageChange > 0 ? "+" : ""}{impact.percentageChange}%
                  </div>
                  <div className="mt-1 font-space-mono text-[8px] font-bold uppercase text-[#f4dd73]">
                    {impact.label}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-space-mono text-[7px] font-bold uppercase text-white/45">Adjusted range</div>
                  <div className="mt-1 font-anton text-[18px] text-white">
                    {adjustedScoreRange.min}–{adjustedScoreRange.max}
                  </div>
                </div>
              </div>
              <div className="mt-2 border-t border-white/10 pt-2 font-barlow text-[9px] leading-snug text-white/60">
                Based on the {currentPitchName} baseline of {currentPitchScoreRange.min}–{currentPitchScoreRange.max}.
                Boundaries contribute {impact.boundary.percentageChange > 0 ? "+" : ""}{impact.boundary.percentageChange}%;
                the outfield contributes {impact.outfield.percentageChange > 0 ? "+" : ""}{impact.outfield.percentageChange}%.
              </div>
            </div>
          </aside>
        </div>
      </div>

      {outfieldCustomizerOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border-2 border-border bg-surface shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-border px-5 py-4">
              <div>
                <div className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-accent">
                  Grounds department · {stadium.name}
                </div>
                <h3 className="mt-1 font-anton text-[22px] uppercase leading-none text-text-primary">Outfield customiser</h3>
                <p className="mt-1 max-w-2xl font-barlow text-[10px] leading-relaxed text-text-secondary">
                  Set measurable match-day targets. The existing outfield stays active until preparation is complete.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOutfieldCustomizerOpen(false)}
                aria-label="Close outfield customiser"
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1.12fr)_minmax(280px,.88fr)]">
              <section className="min-h-0 space-y-3 overflow-y-auto p-4">
                <OutfieldControl
                  label="Grass cut height"
                  value={outfieldDraft.grassHeightMm}
                  minimum={MIN_OUTFIELD_GRASS_HEIGHT_MM}
                  maximum={MAX_OUTFIELD_GRASS_HEIGHT_MM}
                  step={1}
                  unit="MM"
                  low="Short and quick"
                  high="Longer and slower"
                  explanation="Professional playing range. Lower cuts help the ball retain speed; taller grass adds resistance."
                  onChange={(grassHeightMm) => setOutfieldDraft((current) => ({ ...current, grassHeightMm }))}
                />
                <OutfieldControl
                  label="Rootzone moisture target"
                  value={outfieldDraft.moisturePercent}
                  minimum={MIN_OUTFIELD_MOISTURE_PERCENT}
                  maximum={MAX_OUTFIELD_MOISTURE_PERCENT}
                  step={2}
                  unit="%"
                  low="Dry"
                  high="Moist"
                  explanation="Sensor target by volume. Irrigation raises it; evaporation and the registered drainage system lower it."
                  onChange={(moisturePercent) => setOutfieldDraft((current) => ({ ...current, moisturePercent }))}
                />
                <OutfieldControl
                  label="Surface firmness"
                  value={outfieldDraft.firmnessGmax}
                  minimum={MIN_OUTFIELD_FIRMNESS_GMAX}
                  maximum={MAX_OUTFIELD_FIRMNESS_GMAX}
                  step={5}
                  unit="GMAX"
                  low="Resilient"
                  high="Firm and quick"
                  explanation="Clegg-style hardness target. Firming is quick; softening requires aeration and recovery time."
                  onChange={(firmnessGmax) => setOutfieldDraft((current) => ({ ...current, firmnessGmax }))}
                />
                <div className="rounded-lg border border-border bg-bg/40 px-3 py-2 font-barlow text-[9px] leading-relaxed text-text-secondary">
                  Cut reductions obey the one-third mowing rule. Growing the sward takes roughly two days per millimetre,
                  while meaningful softening includes recovery after aeration. Workstreams run concurrently.
                </div>
              </section>

              <section className="min-h-0 overflow-y-auto border-l-2 border-border bg-bg/40 p-4">
                <div className="rounded-lg border-2 border-accent/30 bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Forecast speed</div>
                      <div className="mt-1 font-anton text-[27px] uppercase leading-none text-text-primary">{draftOutfieldImpact.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-anton text-[24px] leading-none text-accent">{draftOutfieldImpact.speedRating}/10</div>
                      <div className="mt-1 font-space-mono text-[6px] font-bold uppercase text-text-secondary">Speed rating</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${draftOutfieldImpact.speedRating * 10}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded border border-border bg-bg/40 p-2.5">
                      <div className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Run effect</div>
                      <div className="mt-1 font-anton text-[19px] leading-none text-text-primary">
                        {draftOutfieldImpact.percentageChange > 0 ? "+" : ""}{draftOutfieldImpact.percentageChange}%
                      </div>
                    </div>
                    <div className="rounded border border-border bg-bg/40 p-2.5">
                      <div className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Preparation</div>
                      <div className="mt-1 font-anton text-[19px] leading-none text-text-primary">
                        {outfieldTiming.totalDays || 0} days
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border-2 border-border bg-surface p-3">
                  <div className="font-anton text-[14px] uppercase text-text-primary">Work schedule</div>
                  <dl className="mt-2 space-y-2">
                    {[
                      ["Mowing / growth", outfieldTiming.mowingOrGrowthDays],
                      ["Moisture conditioning", outfieldTiming.moistureConditioningDays],
                      ["Firmness treatment", outfieldTiming.firmnessTreatmentDays],
                    ].map(([label, days]) => (
                      <div key={label} className="flex items-center justify-between border-b border-[#16130f]/10 pb-1.5 last:border-0 last:pb-0">
                        <dt className="font-barlow text-[10px] text-text-secondary">{label}</dt>
                        <dd className="font-space-mono text-[8px] font-bold uppercase text-text-primary">{days} days</dd>
                      </div>
                    ))}
                  </dl>
                  {outfieldTiming.totalDays > 0 && (
                    <div className="mt-3 flex items-center gap-2 rounded bg-accent/[0.08] px-2.5 py-2">
                      <CalendarClock size={13} className="text-accent" />
                      <span className="font-space-mono text-[7px] font-bold uppercase text-text-primary">
                        Ready {formatDate(addDaysToDateKey(currentDate, outfieldTiming.totalDays))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                  <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Fixed infrastructure</div>
                  <div className="mt-1 font-barlow text-[10px] font-semibold text-text-primary">{stadium.outfield.grass}</div>
                  <div className="mt-0.5 font-barlow text-[9px] text-text-secondary">{stadium.outfield.drainage}</div>
                </div>
              </section>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-border px-5 py-3">
              <div className="font-barlow text-[9px] text-text-secondary">
                Current: {outfieldSettings.grassHeightMm}mm · {outfieldSettings.moisturePercent}% · {outfieldSettings.firmnessGmax} Gmax
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOutfieldDraft(outfieldSettings)}
                  className="rounded border border-border px-3 py-2 font-space-mono text-[7px] font-bold uppercase text-text-secondary hover:text-text-primary"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={!hasOutfieldChanges || outfieldTiming.totalDays < 1}
                  onClick={() => {
                    if (!onStartOutfieldPreparation(outfieldDraft)) return;
                    setOutfieldCustomizerOpen(false);
                  }}
                  className="rounded border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 font-space-mono text-[7px] font-bold uppercase text-bg disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Start preparation
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
