"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Globe2, Map, Maximize2, Minimize2, Search, Star, UserPlus, Users, X } from "lucide-react";
import IndiaMap from "@svg-maps/india";
import WorldMap from "@svg-maps/world";
import { useGameStore } from "@/lib/store/gameStore";
import {
  INDIA_SCOUTING_REGIONS,
  INTERNATIONAL_SCOUTING_REGIONS,
  MAX_ACTIVE_SCOUTING_ASSIGNMENTS,
  SCOUTING_ASSIGNMENT_OPTIONS,
  getScoutingRegion,
  type ScoutingAssignmentKind,
  type ScoutingMarket,
  type ScoutingRegion,
} from "@/lib/logic/scoutingAssignments";

interface ScoutingAssignmentsPageProps {
  shortlist: string[];
  onToggleShortlist: (playerId: string) => void;
}

interface SvgMapLocation {
  id: string;
  name: string;
  path: string;
}

const INDIA_LOCATION_TO_REGION: Record<string, string> = {
  ap: "andhra-pradesh", ar: "arunachal-pradesh", as: "assam", br: "bihar",
  ct: "chhattisgarh", dl: "delhi", ga: "goa", gj: "gujarat", hr: "haryana",
  hp: "himachal-pradesh", jk: "jammu-kashmir", jh: "jharkhand", ka: "karnataka",
  kl: "kerala", mp: "madhya-pradesh", mh: "maharashtra", mn: "manipur",
  ml: "meghalaya", mz: "mizoram", nl: "nagaland", or: "odisha", pb: "punjab",
  rj: "rajasthan", sk: "sikkim", tn: "tamil-nadu", tg: "telangana", tr: "tripura",
  up: "uttar-pradesh", ut: "uttarakhand", wb: "west-bengal",
};

const WORLD_LOCATION_TO_REGION: Record<string, string> = {
  ae: "united-arab-emirates", af: "afghanistan", au: "australia", bd: "bangladesh",
  gb: "england", ie: "ireland", lk: "sri-lanka", na: "namibia", nl: "netherlands",
  np: "nepal", nz: "new-zealand", us: "united-states", za: "south-africa",
  zw: "zimbabwe",
  // West Indies is a cricketing region rather than one sovereign country.
  ag: "west-indies", bb: "west-indies", dm: "west-indies", gd: "west-indies",
  gy: "west-indies", jm: "west-indies", kn: "west-indies", lc: "west-indies",
  tt: "west-indies", vc: "west-indies",
};

function difficultyColor(difficulty: number): string {
  if (difficulty <= 2) return "#b7c7a0";
  if (difficulty === 3) return "#d9c58e";
  if (difficulty === 4) return "#d6a178";
  return "#c98274";
}

function InteractiveIndiaMap({ selectedId, hoveredId, onSelect, onHover }: {
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <svg viewBox={IndiaMap.viewBox} role="img" aria-label="Interactive geographic map of Indian states and territories" className="h-full w-full overflow-visible">
      {(IndiaMap.locations as SvgMapLocation[]).map((location) => {
        const regionId = INDIA_LOCATION_TO_REGION[location.id];
        const region = regionId ? getScoutingRegion(regionId) : undefined;
        const active = regionId === selectedId;
        const hovered = regionId === hoveredId;
        const selectable = Boolean(region);
        return (
          <path
            key={location.id}
            d={location.path}
            onClick={selectable ? () => onSelect(regionId) : undefined}
            onMouseEnter={selectable ? () => onHover(regionId) : undefined}
            onMouseLeave={selectable ? () => onHover(null) : undefined}
            fill={region ? (active ? "var(--accent)" : hovered ? "var(--ink)" : difficultyColor(region.difficulty)) : "rgb(22 19 15 / 0.08)"}
            stroke="var(--surface)"
            strokeWidth={active ? 2.8 : 1.2}
            vectorEffect="non-scaling-stroke"
            className={selectable ? "cursor-pointer transition-all duration-150" : "pointer-events-none"}
            style={{ filter: active || hovered ? "drop-shadow(0 3px 3px rgb(0 0 0 / 0.25))" : undefined }}
          >
            <title>{region?.name ?? location.name}</title>
          </path>
        );
      })}
    </svg>
  );
}

function InteractiveWorldMap({ selectedId, hoveredId, onSelect, onHover }: {
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <svg viewBox={WorldMap.viewBox} role="img" aria-label="Interactive geographic world map of international scouting countries" className="h-full w-full">
      {(WorldMap.locations as SvgMapLocation[]).map((location) => {
        const regionId = WORLD_LOCATION_TO_REGION[location.id];
        const region = regionId ? getScoutingRegion(regionId) : undefined;
        const active = regionId === selectedId;
        const hovered = regionId === hoveredId;
        const selectable = Boolean(region);
        return (
          <path
            key={location.id}
            d={location.path}
            fill={region ? (active ? undefined : hovered ? "var(--accent)" : difficultyColor(region.difficulty)) : "var(--text-secondary)"}
            fillOpacity={region ? 1 : 0.32}
            stroke={active ? "var(--accent)" : "var(--surface)"}
            strokeWidth={0.7}
            vectorEffect="non-scaling-stroke"
            onClick={selectable ? () => {
              onSelect(regionId);
              onHover(regionId);
            } : undefined}
            onPointerEnter={selectable ? () => onHover(regionId) : undefined}
            onPointerLeave={selectable ? () => onHover(null) : undefined}
            className={`${selectable ? "cursor-pointer transition-colors duration-150" : "pointer-events-none"} ${active ? "fill-black dark:fill-white" : ""}`}
            style={{ pointerEvents: selectable ? "visiblePainted" : "none" }}
          >
            <title>{region?.name ?? location.name}</title>
          </path>
        );
      })}
    </svg>
  );
}

function RegionDetails({ region, networkLevel, activeSlots, onStart }: {
  region: ScoutingRegion;
  networkLevel: number;
  activeSlots: number;
  onStart: (kind: ScoutingAssignmentKind) => void;
}) {
  const [pendingKind, setPendingKind] = useState<ScoutingAssignmentKind | null>(null);

  useEffect(() => {
    setPendingKind(null);
  }, [region.id]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-3">
      <div className="shrink-0 border-b border-[#16130f]/10 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-space-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-secondary">Selected region</div>
            <h2 className="mt-1 font-anton text-[21px] uppercase leading-none text-text-primary">{region.name}</h2>
          </div>
          <div className="rounded border border-border px-2.5 py-1.5 text-right">
            <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Talent depth</div>
            <div className="font-space-mono text-[10px] font-bold uppercase text-text-primary">{region.depth}</div>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-text-secondary">{region.description}</p>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-[#16130f]/10 py-2.5">
        <div>
          <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Scouting difficulty</div>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => <span key={level} className={`h-2 w-5 rounded-sm ${level <= region.difficulty ? "bg-[var(--ink)]" : "bg-[#16130f]/10"}`} />)}
          </div>
        </div>
        <div>
          <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Network level</div>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4].map((level) => <Star key={level} size={13} className={level <= networkLevel ? "fill-accent text-accent" : "text-[#16130f]/15"} />)}
            <span className="ml-1 font-space-mono text-[9px] font-bold text-text-secondary">{networkLevel}/4</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 py-2.5">
        <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Player profile strengths</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {region.specialisms.map((specialism) => <span key={specialism} className="rounded-full bg-[#16130f]/7 px-2.5 py-1 font-space-mono text-[8px] font-bold uppercase text-text-primary">{specialism}</span>)}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-3 gap-1.5 overflow-hidden border-t border-[#16130f]/10 pt-2.5">
        {SCOUTING_ASSIGNMENT_OPTIONS.map((option) => {
          const isPending = pendingKind === option.kind;
          return (
          <div key={option.kind} className="relative min-h-0 overflow-hidden rounded">
          <button
            type="button"
            disabled={activeSlots >= MAX_ACTIVE_SCOUTING_ASSIGNMENTS || pendingKind !== null}
            onClick={() => setPendingKind(option.kind)}
            className={`group flex h-full min-h-0 w-full flex-col justify-center rounded border border-border px-2.5 py-1.5 text-left transition-all hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed ${activeSlots >= MAX_ACTIVE_SCOUTING_ASSIGNMENTS ? "opacity-40" : ""} ${isPending ? "blur-[2px] brightness-75" : ""}`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-anton text-[12px] uppercase text-text-primary">{option.label}</span>
              <span className="flex items-center gap-1 font-space-mono text-[8px] font-bold text-text-secondary"><Clock3 size={10} /> {option.days} days</span>
            </span>
            <span className="mt-0.5 block truncate text-[9px] leading-snug text-text-secondary">{option.description}</span>
            <span className="mt-1 block truncate font-space-mono text-[7px] font-bold uppercase text-accent">
              {region.market === "india"
                ? `Up to ${option.newDiscoveryLimit} new state regen ${option.newDiscoveryLimit === 1 ? "report" : "reports"}`
                : `${option.reportCount} reports · up to ${option.newDiscoveryLimit} new discoveries`}
            </span>
          </button>
          {isPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-surface/35 px-2 backdrop-blur-[1px]">
              <button type="button" onClick={() => setPendingKind(null)} className="rounded border border-border bg-surface px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase text-text-primary shadow-sm hover:border-accent">
                Go back
              </button>
              <button
                type="button"
                onClick={() => {
                  onStart(option.kind);
                  setPendingKind(null);
                }}
                className="rounded border border-accent bg-accent px-3 py-1.5 font-space-mono text-[8px] font-bold uppercase text-white shadow-sm hover:brightness-110"
              >
                Confirm
              </button>
            </div>
          )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScoutingAssignmentsPage({ shortlist, onToggleShortlist }: ScoutingAssignmentsPageProps) {
  const {
    players,
    currentDate,
    currentSeason,
    scoutingAssignments,
    scoutingReports,
    scoutingNetworks,
    startScoutingAssignment,
    cancelScoutingAssignment,
    startDeepScoutingAssignment,
    reconcileScoutingAssignments,
  } = useGameStore();
  const [market, setMarket] = useState<ScoutingMarket>("india");
  const [selectedIndia, setSelectedIndia] = useState("maharashtra");
  const [selectedInternational, setSelectedInternational] = useState("australia");
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [pendingCancellation, setPendingCancellation] = useState<string | null>(null);

  useEffect(() => {
    const completed = reconcileScoutingAssignments(currentDate);
    if (completed > 0) setNotice(`${completed} scouting assignment${completed === 1 ? "" : "s"} completed. Reports have been updated.`);
  }, [currentDate, reconcileScoutingAssignments]);

  const selectedId = market === "india" ? selectedIndia : selectedInternational;
  const selectedRegion = getScoutingRegion(selectedId)!;
  const active = scoutingAssignments.filter((assignment) => assignment.status === "active");
  const visibleRegions = market === "india" ? INDIA_SCOUTING_REGIONS : INTERNATIONAL_SCOUTING_REGIONS;
  const latestReports = useMemo(() => [...scoutingReports].sort((left, right) => (
    right.discoveredOn.localeCompare(left.discoveredOn) || right.id.localeCompare(left.id)
  )), [scoutingReports]);

  const selectRegion = (id: string) => {
    if (market === "india") setSelectedIndia(id);
    else setSelectedInternational(id);
  };
  const startAssignment = (kind: ScoutingAssignmentKind) => {
    const result = startScoutingAssignment({ market, regionId: selectedId, kind });
    if (!result.ok) setNotice(result.message);
  };
  useEffect(() => {
    if (!pendingCancellation) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingCancellation(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingCancellation]);

  const confirmCancellation = () => {
    if (!pendingCancellation) return;
    const result = cancelScoutingAssignment(pendingCancellation);
    setNotice(result.message);
    setPendingCancellation(null);
  };
  const scoutPlayerInMoreDepth = (reportId: string) => {
    const result = startDeepScoutingAssignment(reportId);
    if (!result.ok) setNotice(result.message);
  };
  const hoveredName = hoveredRegion ? getScoutingRegion(hoveredRegion)?.name : undefined;

  return (
    <div className="relative grid h-full min-h-0 grid-cols-12 grid-rows-[auto_minmax(210px,0.82fr)_minmax(0,1.18fr)] gap-3 overflow-hidden p-1">
      <section className="col-span-12 rounded-lg border-2 border-border bg-surface px-3 py-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="hidden">Recruitment department</div>
            <h1 className="font-anton text-[20px] uppercase leading-none text-text-primary">Scouting Assignments</h1>
            <p className="hidden">Build regional knowledge and uncover future auction players.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex min-w-28 items-baseline justify-between gap-3 rounded border border-border px-2.5 py-1"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Assignments</div><div className="font-anton text-base text-text-primary">{active.length}/{MAX_ACTIVE_SCOUTING_ASSIGNMENTS}</div></div>
            <div className="flex min-w-24 items-baseline justify-between gap-3 rounded border border-border px-2.5 py-1"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Reports</div><div className="font-anton text-base text-text-primary">{scoutingReports.length}</div></div>
            <div className="flex min-w-28 items-baseline justify-between gap-3 rounded border border-border px-2.5 py-1"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Next auction</div><div className="font-anton text-base text-text-primary">{currentSeason + 1}</div></div>
          </div>
        </div>
        {notice && <button type="button" onClick={() => setNotice(null)} className="mt-1.5 flex w-full items-center justify-between rounded border border-accent/30 bg-accent/10 px-2 py-1 text-left font-space-mono text-[8px] font-bold uppercase text-text-primary"><span>{notice}</span><span aria-hidden>×</span></button>}
      </section>

      <div className="col-span-8 row-span-2 grid min-h-0 grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)] gap-3 overflow-hidden">
        <section className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-4">
          <div className="flex min-w-0 items-center gap-2 border-b border-[#16130f]/10 pb-4">
            <div className="inline-flex shrink-0 rounded border border-border bg-[#16130f]/5 p-1">
              <button type="button" onClick={() => setMarket("india")} className={`flex items-center gap-1 whitespace-nowrap rounded px-2 py-2 font-space-mono text-[7px] font-bold uppercase transition-colors ${market === "india" ? "bg-[var(--ink)] text-bg" : "text-text-secondary hover:text-text-primary"}`}><Map size={12} /> Scout India</button>
              <button type="button" onClick={() => setMarket("international")} className={`flex items-center gap-1 whitespace-nowrap rounded px-2 py-2 font-space-mono text-[7px] font-bold uppercase transition-colors ${market === "international" ? "bg-[var(--ink)] text-bg" : "text-text-secondary hover:text-text-primary"}`}><Globe2 size={12} /> Scout internationally</button>
            </div>
            <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
              <div className="shrink-0 whitespace-nowrap font-space-mono text-[7px] font-bold uppercase text-text-secondary">{hoveredName ? `Viewing: ${hoveredName}` : `${visibleRegions.length} selectable regions`}</div>
              <select
                value={selectedId}
                onChange={(event) => selectRegion(event.target.value)}
                aria-label={market === "india" ? "Select an Indian state" : "Select an international country"}
                className="w-[9.5rem] shrink-0 rounded border border-border bg-surface px-2 py-2 font-space-mono text-[7px] font-bold uppercase text-text-primary outline-none focus:border-accent"
              >
                {visibleRegions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded bg-[#16130f]/[0.025] p-3">
            {market === "india" ? (
              <InteractiveIndiaMap selectedId={selectedId} hoveredId={hoveredRegion} onSelect={selectRegion} onHover={setHoveredRegion} />
            ) : (
              <InteractiveWorldMap selectedId={selectedId} hoveredId={hoveredRegion} onSelect={selectRegion} onHover={setHoveredRegion} />
            )}
            <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded border border-border bg-surface/95 px-3 py-2 font-space-mono text-[7px] font-bold uppercase text-text-secondary shadow-sm">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#b7c7a0]" /> Easier</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#d9c58e]" /> Moderate</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#c98274]" /> Harder</span>
            </div>
            <a
              href="https://github.com/VictorCazanave/svg-maps"
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-3 right-3 rounded bg-surface/90 px-2 py-1 font-space-mono text-[6px] font-bold uppercase text-text-secondary hover:text-accent"
            >
              Geography: SVG Maps · CC BY 4.0
            </a>
          </div>
        </section>
        <RegionDetails region={selectedRegion} networkLevel={scoutingNetworks[selectedRegion.id]?.level ?? 0} activeSlots={active.length} onStart={startAssignment} />
      </div>

      <section className="col-span-4 row-start-2 flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-3">
        <div className="mb-2 flex shrink-0 items-center justify-between border-b border-[#16130f]/10 pb-1.5">
          <div><h2 className="font-anton text-[17px] uppercase text-text-primary">Active assignments</h2><p className="hidden">Results resolve from the calendar.</p></div>
          <Users size={18} className="text-text-secondary" />
        </div>
        {active.length === 0 ? (
          <div className="flex h-[calc(100%_-_3rem)] items-center justify-center rounded border border-dashed border-border px-3 text-center font-space-mono text-[8px] font-bold uppercase text-text-secondary">Select a region on either map to begin an assignment.</div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
            {[1, 2, 3].map((slot) => {
              const assignment = active.find((candidate) => candidate.slot === slot);
              const region = assignment ? getScoutingRegion(assignment.regionId) : undefined;
              const option = assignment ? SCOUTING_ASSIGNMENT_OPTIONS.find((candidate) => candidate.kind === assignment.kind) : undefined;
              const targetReport = assignment?.targetReportId
                ? scoutingReports.find((report) => report.id === assignment.targetReportId)
                : undefined;
              const targetPlayer = targetReport ? players[targetReport.playerId] : undefined;
              const assignmentLabel = assignment?.kind === "deep-scout" ? "In-depth player scout" : option?.label;
              const isPendingCancellation = assignment?.id === pendingCancellation;
              return assignment && region && assignmentLabel ? (
                <div key={slot} className="relative min-h-0 min-w-0 overflow-hidden rounded border border-border">
                  <div className={`flex h-full min-h-0 min-w-0 flex-col p-2 transition-all ${isPendingCancellation ? "blur-[2px] brightness-75" : ""}`}>
                    <div className="flex items-center justify-between"><span className="font-space-mono text-[8px] font-bold uppercase text-accent">Scout slot {slot}</span><Clock3 size={13} className="text-text-secondary" /></div>
                    <div className="mt-1 truncate font-anton text-[13px] uppercase text-text-primary">{targetPlayer?.name ?? region.name}</div>
                    <div className="mt-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">{assignmentLabel}</div>
                    <div className="mt-auto flex items-center justify-between gap-1 border-t border-[#16130f]/10 pt-1.5 font-space-mono text-[7px] font-bold uppercase"><span className="text-text-secondary">Due</span><span className="truncate text-text-primary">{assignment.completesOn}</span></div>
                    <button
                      type="button"
                      disabled={pendingCancellation !== null}
                      onClick={() => setPendingCancellation(assignment.id)}
                      className="mt-1.5 flex w-full shrink-0 items-center justify-center gap-1 rounded border border-danger/35 px-1 py-0.5 font-space-mono text-[7px] font-bold uppercase text-danger transition-colors hover:bg-danger/10 disabled:cursor-default"
                    >
                      <X size={11} /> Cancel assignment
                    </button>
                  </div>
                  {isPendingCancellation && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 bg-surface/35 px-1 backdrop-blur-[1px]">
                      <button type="button" autoFocus onClick={() => setPendingCancellation(null)} className="rounded border border-border bg-surface px-2 py-1.5 font-space-mono text-[7px] font-bold uppercase text-text-primary shadow-sm hover:border-accent">Go back</button>
                      <button type="button" onClick={confirmCancellation} className="rounded border border-danger bg-danger px-2 py-1.5 font-space-mono text-[7px] font-bold uppercase text-white shadow-sm hover:brightness-110">Confirm</button>
                    </div>
                  )}
                </div>
              ) : <div key={slot} className="flex min-h-20 items-center justify-center rounded border border-dashed border-border px-1 text-center font-space-mono text-[7px] font-bold uppercase text-text-secondary">Scout slot {slot} available</div>;
            })}
          </div>
        )}
      </section>

      <section className={`${reportsExpanded ? "absolute inset-1 z-30" : "col-span-4 row-start-3"} flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-border bg-surface p-3 shadow-sm`}>
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#16130f]/10 pb-2">
          <div><h2 className="font-anton text-[18px] uppercase text-text-primary">Scouting reports</h2><p className="mt-1 text-[11px] text-text-secondary">Rating ranges narrow as assignment depth and regional network strength improve.</p></div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary sm:flex"><CalendarDays size={13} /> Reserved for the {currentSeason + 1} auction intake</div>
            <button type="button" onClick={() => setReportsExpanded((value) => !value)} className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary transition-colors hover:border-accent hover:text-accent" title={reportsExpanded ? "Collapse scouting reports" : "Expand scouting reports"} aria-label={reportsExpanded ? "Collapse scouting reports" : "Expand scouting reports"}>
              {reportsExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </div>
        {latestReports.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded border border-dashed border-border text-center"><Search size={22} className="text-text-secondary" /><div className="mt-2 font-space-mono text-[9px] font-bold uppercase text-text-secondary">No completed reports yet</div></div>
        ) : (
          <>
          {reportsExpanded && (
            <div className="min-h-0 flex-1 overflow-auto border border-border">
              <table className="w-full min-w-[1080px] table-fixed text-left">
                <thead className="sticky top-0 z-10 bg-surface2 font-space-mono text-[8px] font-bold uppercase tracking-wider text-text-secondary shadow-sm">
                  <tr>
                    <th className="w-52 px-4 py-3">Player</th>
                    <th className="w-14 px-3 py-3 text-center">Age</th>
                    <th className="w-32 px-3 py-3">Role</th>
                    <th className="w-36 px-3 py-3">Region</th>
                    <th className="w-24 px-3 py-3 text-center">Ability</th>
                    <th className="w-24 px-3 py-3 text-center">Potential</th>
                    <th className="w-24 px-3 py-3 text-center">Confidence</th>
                    <th className="w-28 px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {latestReports.map((report) => {
                    const player = players[report.playerId];
                    const region = getScoutingRegion(report.regionId);
                    if (!player || !region) return null;
                    const isShortlisted = shortlist.includes(player.id);
                    const deepScoutActive = active.some((assignment) => assignment.targetReportId === report.id);
                    const noScoutSlotAvailable = active.length >= MAX_ACTIVE_SCOUTING_ASSIGNMENTS;
                    return (
                      <tr key={report.id} className="bg-surface text-[11px] transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                        <td className="px-4 py-3"><div className="truncate font-semibold text-text-primary">{player.name}</div><div className="mt-0.5 truncate text-[9px] text-text-secondary">{report.summary}</div></td>
                        <td className="px-3 py-3 text-center font-space-mono text-text-secondary">{player.age}</td>
                        <td className="truncate px-3 py-3 font-space-mono text-[9px] font-bold uppercase text-text-secondary">{player.role}</td>
                        <td className="truncate px-3 py-3 text-text-secondary">{region.name}</td>
                        <td className="px-3 py-3 text-center font-anton text-[15px] text-text-primary">{report.currentAbilityRange[0]}–{report.currentAbilityRange[1]}</td>
                        <td className="px-3 py-3 text-center font-anton text-[15px] text-text-primary">{report.potentialRange[0]}–{report.potentialRange[1]}</td>
                        <td className="px-3 py-3 text-center font-space-mono font-bold text-text-primary">{report.confidence}%</td>
                        <td className="px-3 py-3 font-space-mono text-[8px] font-bold uppercase text-text-secondary">{isShortlisted ? "Shortlisted" : deepScoutActive ? "Deep scout active" : report.confidence >= 100 ? "Fully scouted" : "Available"}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => onToggleShortlist(player.id)} className={`h-8 whitespace-nowrap rounded border px-2 font-space-mono text-[7px] font-bold uppercase ${isShortlisted ? "border-[var(--ink)] bg-[var(--ink)] text-bg" : "border-border text-text-primary hover:border-accent"}`}>{isShortlisted ? "Remove shortlist" : "Shortlist"}</button>
                            <button type="button" disabled={report.confidence >= 100 || deepScoutActive || noScoutSlotAvailable} onClick={() => scoutPlayerInMoreDepth(report.id)} className="h-8 whitespace-nowrap rounded border border-accent px-2 font-space-mono text-[7px] font-bold uppercase text-accent hover:bg-accent/10 disabled:cursor-default disabled:border-border disabled:text-text-secondary disabled:opacity-50">{report.confidence >= 100 ? "Complete" : deepScoutActive ? "In progress" : "Deep scout"}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className={`min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1 ${reportsExpanded ? "hidden" : "grid grid-cols-2"}`}>
            {latestReports.map((report) => {
              const player = players[report.playerId];
              const region = getScoutingRegion(report.regionId);
              if (!player || !region) return null;
              const isShortlisted = shortlist.includes(player.id);
              const deepScoutActive = active.some((assignment) => assignment.targetReportId === report.id);
              const noScoutSlotAvailable = active.length >= MAX_ACTIVE_SCOUTING_ASSIGNMENTS;
              return (
                <article key={report.id} className={`rounded border border-border transition-colors hover:border-accent/60 ${reportsExpanded ? "p-3" : "p-2"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`${reportsExpanded ? "truncate text-[16px]" : "whitespace-normal text-[13px] leading-tight"} block font-anton uppercase text-text-primary`}>{player.name}</span>
                      <span className="mt-0.5 block truncate font-space-mono text-[7px] font-bold uppercase text-text-secondary">{player.age} · {player.role}</span>
                    </div>
                    <div className="shrink-0 text-right"><div className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Confidence</div><div className={`font-anton text-text-primary ${reportsExpanded ? "text-[14px]" : "text-[11px]"}`}>{report.confidence}%</div></div>
                  </div>
                  <div className={`grid grid-cols-2 gap-1.5 ${reportsExpanded ? "mt-3" : "mt-1.5"}`}>
                    <div className={`rounded bg-[#16130f]/5 ${reportsExpanded ? "p-2" : "px-1.5 py-1"}`}><div className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">{reportsExpanded ? "Current ability" : "Ability"}</div><div className={`font-anton text-text-primary ${reportsExpanded ? "mt-1 text-[16px]" : "text-[13px]"}`}>{report.currentAbilityRange[0]}–{report.currentAbilityRange[1]}</div></div>
                    <div className={`rounded bg-[#16130f]/5 ${reportsExpanded ? "p-2" : "px-1.5 py-1"}`}><div className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">Potential</div><div className={`font-anton text-text-primary ${reportsExpanded ? "mt-1 text-[16px]" : "text-[13px]"}`}>{report.potentialRange[0]}–{report.potentialRange[1]}</div></div>
                  </div>
                  {reportsExpanded && <p className="mt-3 text-[11px] leading-relaxed text-text-secondary">{report.summary}</p>}
                  {reportsExpanded && <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => onToggleShortlist(player.id)} className={`flex min-h-9 items-center justify-center gap-2 rounded border px-3 py-2 font-space-mono text-[8px] font-bold uppercase transition-colors ${isShortlisted ? "border-[var(--ink)] bg-[var(--ink)] text-bg" : "border-border text-text-primary hover:border-accent hover:bg-accent/5"}`}>
                      {isShortlisted ? <Check size={12} /> : <UserPlus size={12} />} {isShortlisted ? "On auction shortlist" : "Add to auction shortlist"}
                    </button>
                    <button
                      type="button"
                      disabled={report.confidence >= 100 || deepScoutActive || noScoutSlotAvailable}
                      onClick={() => scoutPlayerInMoreDepth(report.id)}
                      className="flex min-h-9 items-center justify-center gap-2 rounded border border-accent px-3 py-2 font-space-mono text-[8px] font-bold uppercase text-accent transition-colors hover:bg-accent/10 disabled:cursor-default disabled:border-border disabled:text-text-secondary disabled:opacity-60"
                    >
                      {report.confidence >= 100 ? <Check size={12} /> : deepScoutActive ? <Clock3 size={12} /> : <Search size={12} />}
                      {report.confidence >= 100 ? "Fully scouted" : deepScoutActive ? "Scouting in progress" : noScoutSlotAvailable ? "No scout slot available" : "Scout in more depth · 14 days"}
                    </button>
                  </div>}
                  {!reportsExpanded && (isShortlisted || deepScoutActive) && <div className="mt-1.5 truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">{isShortlisted ? "Shortlisted" : "Deep scout active"}</div>}
                </article>
              );
            })}
          </div>
          </>
        )}
      </section>

    </div>
  );
}
