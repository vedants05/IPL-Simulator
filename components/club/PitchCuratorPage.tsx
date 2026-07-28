"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  Eye,
  Gauge,
  Hammer,
  Layers3,
  MapPin,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  getHomeStadium,
  type BoundaryDimensions,
  type CuratorPitch,
  type PitchPreference,
} from "@/lib/data/pitchCurator";
import { addDaysToDateKey, dateKeyToLocalDate } from "@/lib/logic/careerCalendar";
import {
  DEFAULT_PITCH_SLIDERS,
  deriveCustomPitch,
  isCustomCuratorPitch,
  MAX_PITCHES_PER_STADIUM,
  type CustomCuratorPitch,
  type PitchProject,
  type PitchSliderSettings,
  type PitchSoil,
} from "@/lib/logic/pitchCreator";

interface PitchCuratorPageProps {
  teamId: string;
  teamName: string;
  currentDate: string;
  selectedPitchId: string;
  boundaryDimensions: BoundaryDimensions;
  customPitches: readonly CustomCuratorPitch[];
  project?: PitchProject | null;
  onSelectPitch: (pitchId: string) => void;
  onCreatePitch: (soil: PitchSoil, sliders: PitchSliderSettings) => boolean;
  onDestroyPitch: (pitchId: string) => boolean;
}

const PREFERENCE_LABELS: Record<PitchPreference, string> = {
  "aggressive-batters": "Aggressive batters",
  "controlled-batters": "Controlled batters",
  "high-rated-batters": "High-rated batters",
  openers: "Openers",
  "top-order-batters": "Top-order batters",
  "middle-order-batters": "Middle-order batters",
  "pace-bowlers": "Pace bowlers",
  "high-rated-pace-bowlers": "High-rated pace bowlers",
  "spin-bowlers": "Spin bowlers",
  "chasing-team": "Chasing team",
};

const SLIDER_CONFIG: Array<{
  key: keyof PitchSliderSettings;
  label: string;
  low: string;
  high: string;
}> = [
  { key: "compaction", label: "Rolling and compaction", low: "Soft", high: "Very hard" },
  { key: "grassCover", label: "Grass coverage", low: "Bare", high: "Heavy grass" },
  { key: "moisture", label: "Moisture", low: "Very dry", high: "Damp" },
  { key: "surfaceWear", label: "Surface wear", low: "Fresh", high: "Heavily worn" },
  { key: "consistency", label: "Preparation consistency", low: "Variable", high: "Uniform" },
];

const METRIC_LABELS: Array<[keyof CustomCuratorPitch["metrics"], string]> = [
  ["battingEase", "Batting"],
  ["paceCarry", "Pace"],
  ["seamMovement", "Seam"],
  ["spinGrip", "Spin"],
  ["bounce", "Bounce"],
  ["deterioration", "Wear"],
];

const formatDate = (date: string) => dateKeyToLocalDate(date).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const daysRemaining = (currentDate: string, completesOn: string) => {
  const current = dateKeyToLocalDate(currentDate).getTime();
  const completion = dateKeyToLocalDate(completesOn).getTime();
  return Math.max(0, Math.round((completion - current) / 86_400_000));
};

function PreferenceTags({
  values,
  tone,
}: {
  values: readonly PitchPreference[];
  tone: "positive" | "negative";
}) {
  if (values.length === 0) {
    return <p className="font-space-mono text-[7px] uppercase text-text-secondary">No registered disadvantage</p>;
  }
  const colour = tone === "positive"
    ? "border-success/25 bg-success/[0.07] text-success"
    : "border-danger/25 bg-danger/[0.06] text-danger";
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((preference) => (
        <span
          key={preference}
          className={`rounded border px-1.5 py-1 font-space-mono text-[7px] font-bold uppercase ${colour}`}
        >
          {PREFERENCE_LABELS[preference]}
        </span>
      ))}
    </div>
  );
}

export default function PitchCuratorPage({
  teamId,
  teamName,
  currentDate,
  selectedPitchId,
  boundaryDimensions,
  customPitches,
  project,
  onSelectPitch,
  onCreatePitch,
  onDestroyPitch,
}: PitchCuratorPageProps) {
  const stadium = getHomeStadium(teamId);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [soil, setSoil] = useState<PitchSoil>("red");
  const [sliders, setSliders] = useState<PitchSliderSettings>({ ...DEFAULT_PITCH_SLIDERS });
  const [destroyPitch, setDestroyPitch] = useState<CustomCuratorPitch | null>(null);
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(false);

  const preview = useMemo(() => {
    if (!stadium) return null;
    return deriveCustomPitch({
      id: "custom-pitch-preview",
      teamId: stadium.teamId,
      stadium,
      soil,
      sliders,
      createdOn: currentDate,
    });
  }, [currentDate, sliders, soil, stadium]);

  if (!stadium) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border-2 border-border bg-surface">
        <div className="text-center">
          <h2 className="font-anton text-[22px] uppercase text-text-primary">Pitch Curator</h2>
          <p className="mt-2 text-xs text-text-secondary">No home stadium is registered for {teamName}.</p>
        </div>
      </div>
    );
  }

  const allPitches: Array<CuratorPitch | CustomCuratorPitch> = [
    ...stadium.pitches,
    ...customPitches,
  ];
  const selectedPitch = allPitches.find((pitch) => pitch.id === selectedPitchId)
    ?? stadium.pitches.find((pitch) => pitch.id === stadium.defaultPitchId);
  const capacityReached = allPitches.length >= MAX_PITCHES_PER_STADIUM;
  const projectPitchId = project?.kind === "destroy" ? project.pitchId : null;
  const creationProject = project?.kind === "create" ? project : null;

  const updateSlider = (key: keyof PitchSliderSettings, value: number) => {
    setSliders((current) => ({ ...current, [key]: value }));
  };

  const beginCreation = () => {
    if (!preview || !onCreatePitch(soil, sliders)) return;
    setCreatorOpen(false);
    setSoil("red");
    setSliders({ ...DEFAULT_PITCH_SLIDERS });
  };

  const confirmDestruction = () => {
    if (!destroyPitch || !onDestroyPitch(destroyPitch.id)) return;
    setDestroyPitch(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="flex shrink-0 items-center justify-between rounded-lg border-2 border-border bg-surface px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <MapPin size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Home stadium</p>
            <h2 className="mt-1 truncate font-anton text-[22px] uppercase leading-none text-text-primary">{stadium.name}</h2>
            <p className="mt-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">{stadium.location} · {teamName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="grid grid-cols-[auto_auto_auto_auto_minmax(8rem,1fr)] divide-x divide-border overflow-hidden rounded-md border border-border bg-bg/40 text-center">
            <div className="px-3 py-2">
              <div className="font-anton text-[18px] leading-none text-text-primary">{stadium.capacity.toLocaleString("en-GB")}</div>
              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary">Fixed capacity</div>
            </div>
            <div className="px-3 py-2">
              <div className="font-anton text-[18px] leading-none text-text-primary">{boundaryDimensions.straightMetres}m</div>
              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary">Straight boundary</div>
              <div className="mt-0.5 font-space-mono text-[6px] font-bold uppercase text-accent">Default {stadium.defaultBoundaryDimensions.straightMetres}m</div>
            </div>
            <div className="px-3 py-2">
              <div className="font-anton text-[18px] leading-none text-text-primary">{boundaryDimensions.wideMetres}m</div>
              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary">Wide boundary</div>
              <div className="mt-0.5 font-space-mono text-[6px] font-bold uppercase text-accent">Default {stadium.defaultBoundaryDimensions.wideMetres}m</div>
            </div>
            <div className="px-4 py-2">
              <div className="font-anton text-[18px] leading-none text-text-primary">{allPitches.length}/{MAX_PITCHES_PER_STADIUM}</div>
              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary">Pitch capacity</div>
            </div>
            <div className="max-w-44 px-4 py-2">
              <div className="truncate text-[10px] font-bold leading-none text-text-primary">{selectedPitch?.name}</div>
              <div className="mt-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary">Currently in use</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            disabled={capacityReached || Boolean(project)}
            title={capacityReached ? "This stadium already has five pitches" : project ? "Complete the current grounds project first" : undefined}
            className="inline-flex h-12 items-center gap-2 rounded-md border border-accent bg-accent px-4 font-space-mono text-[8px] font-bold uppercase tracking-wider text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} aria-hidden="true" /> Create pitch
          </button>
        </div>
      </header>

      {project && (
        <div className="flex shrink-0 items-center justify-between rounded-lg border border-accent/35 bg-accent/[0.07] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Hammer size={14} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold text-text-primary">
                {project.kind === "create"
                  ? `Creating ${project.pitch.name}`
                  : `Removing ${project.pitchName}`}
              </p>
              <p className="mt-0.5 font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                One grounds project at a time · completes {formatDate(project.completesOn)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {creationProject && (
              <button
                type="button"
                onClick={() => setProjectDetailsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/35 bg-surface px-3 py-2 font-space-mono text-[8px] font-bold uppercase tracking-wider text-accent transition-colors hover:bg-accent/10"
              >
                <Eye size={12} aria-hidden="true" /> View pitch details
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-surface px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase text-accent">
              <Clock3 size={11} aria-hidden="true" />
              {daysRemaining(currentDate, project.completesOn)} days remaining
            </span>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 auto-rows-[minmax(23rem,1fr)] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {allPitches.map((pitch) => {
          const custom = isCustomCuratorPitch(pitch);
          const isDefault = pitch.id === stadium.defaultPitchId;
          const isSelected = pitch.id === selectedPitch?.id;
          const isBeingDestroyed = projectPitchId === pitch.id;
          return (
            <article
              key={pitch.id}
              className={`flex min-h-0 flex-col overflow-hidden rounded-lg border-2 bg-surface ${
                isSelected ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-border"
              } ${isBeingDestroyed ? "opacity-55" : ""}`}
            >
              <div className={`shrink-0 border-b px-4 py-3 ${isSelected ? "border-accent/30 bg-accent/[0.06]" : "border-border bg-bg/25"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-anton text-[17px] uppercase leading-none text-text-primary">{pitch.name}</p>
                    <p className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{pitch.type}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-white">
                        <Check size={9} aria-hidden="true" /> In use
                      </span>
                    )}
                    {isDefault && (
                      <span className="rounded-full border border-border bg-bg/70 px-2 py-1 font-space-mono text-[6px] font-bold uppercase text-text-secondary">Main default</span>
                    )}
                    {custom && (
                      <span className="rounded-full border border-purple-500/25 bg-purple-500/[0.08] px-2 py-1 font-space-mono text-[6px] font-bold uppercase text-purple-700">Custom</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-[auto_1fr] items-center gap-3 border-b border-border px-4 py-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-success/10 text-success">
                  <Gauge size={15} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Expected first innings</p>
                  <p className="mt-0.5 font-anton text-[20px] leading-none text-text-primary">
                    {pitch.expectedFirstInningsScore.min}–{pitch.expectedFirstInningsScore.max}
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-4">
                <section>
                  <h3 className="mb-1.5 flex items-center gap-1.5 font-space-mono text-[7px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                    <Layers3 size={11} aria-hidden="true" /> Surface characteristics
                  </h3>
                  <ul className="space-y-1 text-[10px] leading-snug text-text-primary">
                    {pitch.characteristics.map((characteristic) => (
                      <li key={characteristic} className="flex gap-2">
                        <span className="mt-[5px] size-1 shrink-0 rounded-full bg-accent" />
                        <span>{characteristic}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="mb-1.5 font-space-mono text-[7px] font-bold uppercase tracking-[0.14em] text-success">Favours</h3>
                  <PreferenceTags values={pitch.favours} tone="positive" />
                </section>
                <section>
                  <h3 className="mb-1.5 font-space-mono text-[7px] font-bold uppercase tracking-[0.14em] text-danger">Less suited</h3>
                  <PreferenceTags values={pitch.doesNotFavour} tone="negative" />
                </section>
                {custom && (
                  <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                    {pitch.soil} soil · {pitch.upkeepDifficulty} upkeep · {pitch.recoveryDays}-day recovery
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-2 border-t border-border bg-bg/25 p-3">
                <button
                  type="button"
                  onClick={() => onSelectPitch(pitch.id)}
                  disabled={isSelected || isBeingDestroyed}
                  className={`min-w-0 flex-1 rounded border px-3 py-2 font-space-mono text-[8px] font-bold uppercase tracking-wider transition-colors ${
                    isSelected
                      ? "cursor-default border-accent bg-accent text-white"
                      : "border-border bg-surface text-text-primary hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                >
                  {isSelected ? "Currently in use" : isBeingDestroyed ? "Removal underway" : "Use this pitch"}
                </button>
                {custom && (
                  <button
                    type="button"
                    onClick={() => setDestroyPitch(pitch)}
                    disabled={isSelected || Boolean(project)}
                    title={isSelected ? "Select another pitch before removing this one" : project ? "Complete the current grounds project first" : "Remove this custom pitch"}
                    className="flex size-9 shrink-0 items-center justify-center rounded border border-danger/35 bg-surface text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Remove ${pitch.name}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {creatorOpen && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5">
          <div className="grid max-h-[calc(100vh-2.5rem)] w-full max-w-5xl grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] overflow-hidden rounded-xl border-2 border-border bg-surface shadow-2xl">
            <section className="min-h-0 overflow-y-auto border-r border-border p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Grounds project</p>
                  <h2 className="mt-1 font-anton text-[25px] uppercase leading-none text-text-primary">Create a new pitch</h2>
                  <p className="mt-2 max-w-xl text-[10px] leading-relaxed text-text-secondary">
                    Build the surface through physical preparation choices. The completed pitch cannot be edited.
                  </p>
                </div>
                <button type="button" onClick={() => setCreatorOpen(false)} className="text-text-secondary hover:text-text-primary" aria-label="Close pitch creator">
                  <X size={18} />
                </button>
              </div>

              <div className="mb-5">
                <label className="mb-2 block font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary">Soil base</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["red", "black"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSoil(option)}
                      className={`rounded-md border-2 px-4 py-3 text-left transition-colors ${
                        soil === option ? "border-accent bg-accent/[0.07]" : "border-border bg-bg/30 hover:border-accent/50"
                      }`}
                    >
                      <span className="block text-[11px] font-bold capitalize text-text-primary">{option} soil</span>
                      <span className="mt-1 block text-[8px] leading-snug text-text-secondary">
                        {option === "red" ? "Naturally supports pace, carry and bounce." : "Naturally supports grip, lower bounce and deterioration."}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {SLIDER_CONFIG.map((config) => (
                  <label key={config.key} className="block">
                    <span className="mb-1.5 flex items-center justify-between">
                      <span className="font-space-mono text-[8px] font-bold uppercase text-text-primary">{config.label}</span>
                      <span className="font-anton text-[17px] leading-none text-accent">{sliders[config.key]}/10</span>
                    </span>
                    <div className="relative h-7 select-none">
                      <div className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
                      <div
                        className="absolute left-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent transition-[width] duration-150"
                        style={{ width: `calc((100% - 1rem) * ${(sliders[config.key] - 1) / 9})` }}
                      />
                      {Array.from({ length: 10 }, (_, index) => {
                        const stop = index + 1;
                        const active = stop <= sliders[config.key];
                        return (
                          <span
                            key={stop}
                            className={`pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors ${
                              active ? "border-accent bg-accent" : "border-border bg-surface"
                            }`}
                            style={{ left: `calc(0.5rem + (100% - 1rem) * ${index / 9})` }}
                          />
                        );
                      })}
                      <span
                        className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-accent shadow-[0_1px_6px_rgba(0,0,0,.28)] transition-[left] duration-150"
                        style={{ left: `calc(0.5rem + (100% - 1rem) * ${(sliders[config.key] - 1) / 9})` }}
                      />
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={sliders[config.key]}
                        onChange={(event) => updateSlider(config.key, Number(event.target.value))}
                        aria-label={config.label}
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      />
                    </div>
                    <span className="mt-1 flex justify-between font-space-mono text-[6px] font-bold uppercase text-text-secondary">
                      <span>{config.low}</span><span>{config.high}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="min-h-0 overflow-y-auto bg-bg/35 p-5">
              <div className="mb-4 flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-accent" />
                <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-accent">Live surface forecast</p>
              </div>
              <div className="rounded-lg border-2 border-accent/35 bg-surface p-4">
                <p className="font-anton text-[24px] uppercase leading-none text-text-primary">{preview.name}</p>
                <p className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{preview.type}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded border border-border bg-bg/30 p-3">
                    <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Expected score</p>
                    <p className="mt-1 font-anton text-[22px] leading-none text-success">{preview.expectedFirstInningsScore.min}–{preview.expectedFirstInningsScore.max}</p>
                  </div>
                  <div className="rounded border border-border bg-bg/30 p-3">
                    <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Project time</p>
                    <p className="mt-1 font-anton text-[22px] leading-none text-text-primary">{preview.creationDays} days</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                  {METRIC_LABELS.map(([key, label]) => (
                    <div key={key}>
                      <div className="mb-1 flex justify-between font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                        <span>{label}</span><span>{preview.metrics[key].toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border/70">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${preview.metrics[key] * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <p className="mb-1.5 font-space-mono text-[7px] font-bold uppercase text-success">Favours</p>
                  <PreferenceTags values={preview.favours} tone="positive" />
                </div>
                <div className="mt-3">
                  <p className="mb-1.5 font-space-mono text-[7px] font-bold uppercase text-danger">Less suited</p>
                  <PreferenceTags values={preview.doesNotFavour} tone="negative" />
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-[9px] leading-relaxed text-text-secondary">
                <p><strong className="text-text-primary">Upkeep:</strong> {preview.upkeepDifficulty} · {preview.recoveryDays} days between full preparations</p>
                <p className="mt-1"><strong className="text-text-primary">Ready:</strong> {formatDate(addDaysToDateKey(currentDate, preview.creationDays))}</p>
                <p className="mt-1">Extreme or conflicting preparation choices take longer and create a more demanding surface to maintain.</p>
              </div>

              <button
                type="button"
                onClick={beginCreation}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-accent bg-accent px-4 py-3 font-space-mono text-[9px] font-bold uppercase tracking-wider text-white"
              >
                <Hammer size={14} aria-hidden="true" /> Start {preview.creationDays}-day project
              </button>
            </section>
          </div>
        </div>
      )}

      {projectDetailsOpen && creationProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5">
          <div className="grid max-h-[calc(100vh-2.5rem)] w-full max-w-5xl grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] overflow-hidden rounded-xl border-2 border-border bg-surface shadow-2xl">
            <section className="min-h-0 overflow-y-auto border-r border-border p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Pitch under construction</p>
                  <h2 className="mt-1 font-anton text-[25px] uppercase leading-none text-text-primary">{creationProject.pitch.name}</h2>
                  <p className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">{creationProject.pitch.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProjectDetailsOpen(false)}
                  className="text-text-secondary hover:text-text-primary"
                  aria-label="Close pitch project details"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border bg-bg/30 p-3">
                  <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Started</p>
                  <p className="mt-1 text-[11px] font-bold text-text-primary">{formatDate(creationProject.startedOn)}</p>
                </div>
                <div className="rounded-md border border-border bg-bg/30 p-3">
                  <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Completion</p>
                  <p className="mt-1 text-[11px] font-bold text-text-primary">{formatDate(creationProject.completesOn)}</p>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-accent/30 bg-accent/[0.06] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Construction status</p>
                    <p className="mt-1 font-anton text-[20px] uppercase leading-none text-accent">
                      {daysRemaining(currentDate, creationProject.completesOn)} days remaining
                    </p>
                  </div>
                  <Hammer size={22} className="text-accent" aria-hidden="true" />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          ((creationProject.pitch.creationDays - daysRemaining(currentDate, creationProject.completesOn))
                            / creationProject.pitch.creationDays) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-3 font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">Saved preparation recipe</p>
                <div className="space-y-3.5">
                  {SLIDER_CONFIG.map((config) => {
                    const value = creationProject.pitch.sliders[config.key];
                    return (
                      <div key={config.key}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-space-mono text-[7px] font-bold uppercase text-text-primary">{config.label}</span>
                          <span className="font-anton text-[15px] leading-none text-accent">{value}/10</span>
                        </div>
                        <div className="relative mx-1 h-3">
                          <div className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
                          {Array.from({ length: 10 }, (_, index) => {
                            const stop = index + 1;
                            return (
                              <span
                                key={stop}
                                className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                                  stop <= value ? "border-accent bg-accent" : "border-border bg-surface"
                                }`}
                                style={{ left: `calc(0.25rem + (100% - 0.5rem) * ${index / 9})` }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 rounded-md border border-border bg-bg/30 p-3 font-space-mono text-[7px] font-bold uppercase leading-relaxed text-text-secondary">
                <p><span className="text-text-primary">Soil:</span> {creationProject.pitch.soil}</p>
                <p className="mt-1"><span className="text-text-primary">Upkeep:</span> {creationProject.pitch.upkeepDifficulty}</p>
                <p className="mt-1"><span className="text-text-primary">Full recovery:</span> {creationProject.pitch.recoveryDays} days</p>
              </div>
            </section>

            <section className="min-h-0 overflow-y-auto bg-bg/35 p-5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border-2 border-success/25 bg-surface p-4">
                  <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Expected first innings</p>
                  <p className="mt-1 font-anton text-[25px] leading-none text-success">
                    {creationProject.pitch.expectedFirstInningsScore.min}–{creationProject.pitch.expectedFirstInningsScore.max}
                  </p>
                </div>
                <div className="rounded-lg border-2 border-border bg-surface p-4">
                  <p className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Total project length</p>
                  <p className="mt-1 font-anton text-[25px] leading-none text-text-primary">{creationProject.pitch.creationDays} days</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border-2 border-border bg-surface p-4">
                <p className="mb-3 font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">Derived pitch behaviour</p>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  {METRIC_LABELS.map(([key, label]) => (
                    <div key={key}>
                      <div className="mb-1 flex justify-between font-space-mono text-[7px] font-bold uppercase text-text-secondary">
                        <span>{label}</span><span>{creationProject.pitch.metrics[key].toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border/70">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${creationProject.pitch.metrics[key] * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-lg border-2 border-border bg-surface p-4">
                <h3 className="mb-2 flex items-center gap-1.5 font-space-mono text-[8px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                  <Layers3 size={12} aria-hidden="true" /> Surface characteristics
                </h3>
                <ul className="space-y-1.5 text-[10px] leading-snug text-text-primary">
                  {creationProject.pitch.characteristics.map((characteristic) => (
                    <li key={characteristic} className="flex gap-2">
                      <span className="mt-[5px] size-1 shrink-0 rounded-full bg-accent" />
                      <span>{characteristic}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-success/25 bg-surface p-4">
                  <p className="mb-2 font-space-mono text-[7px] font-bold uppercase tracking-[0.14em] text-success">Favours</p>
                  <PreferenceTags values={creationProject.pitch.favours} tone="positive" />
                </div>
                <div className="rounded-lg border border-danger/25 bg-surface p-4">
                  <p className="mb-2 font-space-mono text-[7px] font-bold uppercase tracking-[0.14em] text-danger">Less suited</p>
                  <PreferenceTags values={creationProject.pitch.doesNotFavour} tone="negative" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setProjectDetailsOpen(false)}
                className="mt-4 w-full rounded-md border border-border bg-surface px-4 py-3 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-primary transition-colors hover:border-accent hover:text-accent"
              >
                Close details
              </button>
            </section>
          </div>
        </div>
      )}

      {destroyPitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5">
          <div className="w-full max-w-md rounded-xl border-2 border-border bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2 className="font-anton text-[21px] uppercase leading-none text-text-primary">Remove {destroyPitch.name}?</h2>
                <p className="mt-2 text-[10px] leading-relaxed text-text-secondary">
                  Removal takes seven days and permanently destroys this custom pitch. The grounds team cannot work on another project during that time.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDestroyPitch(null)} className="rounded border border-border px-4 py-2.5 font-space-mono text-[8px] font-bold uppercase text-text-primary">
                Keep pitch
              </button>
              <button type="button" onClick={confirmDestruction} className="rounded border border-danger bg-danger px-4 py-2.5 font-space-mono text-[8px] font-bold uppercase text-white">
                Start removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
