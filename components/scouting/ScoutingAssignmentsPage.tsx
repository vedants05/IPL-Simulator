"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Globe2, Map, Search, Star, UserPlus, Users, X } from "lucide-react";
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
  np: "nepal", nz: "new-zealand", pk: "pakistan", us: "united-states", za: "south-africa",
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
            stroke="var(--surface)"
            strokeWidth={active ? 2.2 : 0.7}
            vectorEffect="non-scaling-stroke"
            onClick={selectable ? () => onSelect(regionId) : undefined}
            onMouseEnter={selectable ? () => onHover(regionId) : undefined}
            onMouseLeave={selectable ? () => onHover(null) : undefined}
            className={`${selectable ? "cursor-pointer transition-all duration-150" : "pointer-events-none"} ${active ? "fill-black dark:fill-white" : ""}`}
            style={{ filter: active || hovered ? "drop-shadow(0 4px 5px rgb(0 0 0 / 0.22))" : undefined }}
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
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-5">
      <div className="border-b border-[#16130f]/10 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-space-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-secondary">Selected region</div>
            <h2 className="mt-1 font-anton text-[25px] uppercase leading-none text-text-primary">{region.name}</h2>
          </div>
          <div className="rounded border border-border px-2.5 py-1.5 text-right">
            <div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Talent depth</div>
            <div className="font-space-mono text-[10px] font-bold uppercase text-text-primary">{region.depth}</div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-secondary">{region.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-[#16130f]/10 py-4">
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

      <div className="py-4">
        <div className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">Player profile strengths</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {region.specialisms.map((specialism) => <span key={specialism} className="rounded-full bg-[#16130f]/7 px-2.5 py-1 font-space-mono text-[8px] font-bold uppercase text-text-primary">{specialism}</span>)}
        </div>
      </div>

      <div className="min-h-0 space-y-2 overflow-y-auto border-t border-[#16130f]/10 pt-4">
        {SCOUTING_ASSIGNMENT_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            disabled={activeSlots >= MAX_ACTIVE_SCOUTING_ASSIGNMENTS}
            onClick={() => onStart(option.kind)}
            className="group w-full rounded border border-border p-3 text-left transition-colors hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-anton text-[13px] uppercase text-text-primary">{option.label}</span>
              <span className="flex items-center gap-1 font-space-mono text-[9px] font-bold text-text-secondary"><Clock3 size={11} /> {option.days} days</span>
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-text-secondary">{option.description}</span>
            <span className="mt-2 block font-space-mono text-[8px] font-bold uppercase text-accent">
              {region.market === "india"
                ? `Up to ${option.newDiscoveryLimit} new state regen ${option.newDiscoveryLimit === 1 ? "report" : "reports"}`
                : `${option.reportCount} reports · up to ${option.newDiscoveryLimit} new discoveries`}
            </span>
          </button>
        ))}
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
    reconcileScoutingAssignments,
  } = useGameStore();
  const [market, setMarket] = useState<ScoutingMarket>("india");
  const [selectedIndia, setSelectedIndia] = useState("maharashtra");
  const [selectedInternational, setSelectedInternational] = useState("australia");
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const completed = reconcileScoutingAssignments(currentDate);
    if (completed > 0) setNotice(`${completed} scouting assignment${completed === 1 ? "" : "s"} completed. New reports are ready.`);
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
    setNotice(result.message);
  };
  const cancelAssignment = (assignmentId: string, regionName: string) => {
    if (!window.confirm(`Cancel the active scouting assignment in ${regionName}? All progress will be lost.`)) return;
    const result = cancelScoutingAssignment(assignmentId);
    setNotice(result.message);
  };
  const hoveredName = hoveredRegion ? getScoutingRegion(hoveredRegion)?.name : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-8">
      <section className="rounded-lg border-2 border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="font-space-mono text-[9px] font-bold uppercase tracking-[0.22em] text-accent">Recruitment department</div>
            <h1 className="mt-1 font-anton text-[30px] uppercase leading-none text-text-primary">Scouting Assignments</h1>
            <p className="mt-2 max-w-2xl text-xs text-text-secondary">Build regional knowledge, uncover future auction players and improve report accuracy. Talent tiers are reserved centrally, so changing region changes the type of player you find—not the quality roll.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-24 rounded border border-border px-3 py-2"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Assignments</div><div className="mt-1 font-anton text-xl text-text-primary">{active.length}/{MAX_ACTIVE_SCOUTING_ASSIGNMENTS}</div></div>
            <div className="min-w-24 rounded border border-border px-3 py-2"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Reports</div><div className="mt-1 font-anton text-xl text-text-primary">{scoutingReports.length}</div></div>
            <div className="min-w-24 rounded border border-border px-3 py-2"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Next auction</div><div className="mt-1 font-anton text-xl text-text-primary">{currentSeason + 1}</div></div>
          </div>
        </div>
        {notice && <button type="button" onClick={() => setNotice(null)} className="mt-4 flex w-full items-center justify-between rounded border border-accent/30 bg-accent/10 px-3 py-2 text-left font-space-mono text-[9px] font-bold uppercase text-text-primary"><span>{notice}</span><span aria-hidden>×</span></button>}
      </section>

      <div className="grid min-h-[650px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
        <section className="flex min-h-0 flex-col rounded-lg border-2 border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#16130f]/10 pb-4">
            <div className="inline-flex rounded border border-border bg-[#16130f]/5 p-1">
              <button type="button" onClick={() => setMarket("india")} className={`flex items-center gap-2 rounded px-4 py-2 font-space-mono text-[9px] font-bold uppercase transition-colors ${market === "india" ? "bg-[var(--ink)] text-bg" : "text-text-secondary hover:text-text-primary"}`}><Map size={13} /> Scout India</button>
              <button type="button" onClick={() => setMarket("international")} className={`flex items-center gap-2 rounded px-4 py-2 font-space-mono text-[9px] font-bold uppercase transition-colors ${market === "international" ? "bg-[var(--ink)] text-bg" : "text-text-secondary hover:text-text-primary"}`}><Globe2 size={13} /> Scout internationally</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden font-space-mono text-[8px] font-bold uppercase text-text-secondary md:block">{hoveredName ? `Viewing: ${hoveredName}` : `${visibleRegions.length} selectable regions`}</div>
              <select
                value={selectedId}
                onChange={(event) => selectRegion(event.target.value)}
                aria-label={market === "india" ? "Select an Indian state" : "Select an international country"}
                className="max-w-48 rounded border border-border bg-surface px-2.5 py-2 font-space-mono text-[8px] font-bold uppercase text-text-primary outline-none focus:border-accent"
              >
                {visibleRegions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </div>
          </div>
          <div className="relative min-h-[490px] flex-1 overflow-hidden rounded bg-[#16130f]/[0.025] p-3">
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

      <section className="rounded-lg border-2 border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#16130f]/10 pb-3">
          <div><h2 className="font-anton text-[18px] uppercase text-text-primary">Active assignments</h2><p className="mt-1 text-[11px] text-text-secondary">Results resolve from the calendar and are fixed when an assignment starts.</p></div>
          <Users size={18} className="text-text-secondary" />
        </div>
        {active.length === 0 ? (
          <div className="rounded border border-dashed border-border py-8 text-center font-space-mono text-[9px] font-bold uppercase text-text-secondary">Select a region on either map to begin an assignment.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((slot) => {
              const assignment = active.find((candidate) => candidate.slot === slot);
              const region = assignment ? getScoutingRegion(assignment.regionId) : undefined;
              const option = assignment ? SCOUTING_ASSIGNMENT_OPTIONS.find((candidate) => candidate.kind === assignment.kind) : undefined;
              return assignment && region && option ? (
                <div key={slot} className="rounded border border-border p-4">
                  <div className="flex items-center justify-between"><span className="font-space-mono text-[8px] font-bold uppercase text-accent">Scout slot {slot}</span><Clock3 size={13} className="text-text-secondary" /></div>
                  <div className="mt-2 font-anton text-[16px] uppercase text-text-primary">{region.name}</div>
                  <div className="mt-1 font-space-mono text-[8px] font-bold uppercase text-text-secondary">{option.label}</div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#16130f]/10 pt-3 font-space-mono text-[8px] font-bold uppercase"><span className="text-text-secondary">Report due</span><span className="text-text-primary">{assignment.completesOn}</span></div>
                  <button
                    type="button"
                    onClick={() => cancelAssignment(assignment.id, region.name)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-danger/35 px-2.5 py-2 font-space-mono text-[8px] font-bold uppercase text-danger transition-colors hover:bg-danger/10"
                  >
                    <X size={11} /> Cancel assignment
                  </button>
                </div>
              ) : <div key={slot} className="flex min-h-32 items-center justify-center rounded border border-dashed border-border font-space-mono text-[8px] font-bold uppercase text-text-secondary">Scout slot {slot} available</div>;
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border-2 border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#16130f]/10 pb-3">
          <div><h2 className="font-anton text-[18px] uppercase text-text-primary">Scouting reports</h2><p className="mt-1 text-[11px] text-text-secondary">Rating ranges narrow as assignment depth and regional network strength improve.</p></div>
          <div className="flex items-center gap-2 font-space-mono text-[8px] font-bold uppercase text-text-secondary"><CalendarDays size={13} /> Reserved for the {currentSeason + 1} auction intake</div>
        </div>
        {latestReports.length === 0 ? (
          <div className="rounded border border-dashed border-border py-10 text-center"><Search size={22} className="mx-auto text-text-secondary" /><div className="mt-3 font-space-mono text-[9px] font-bold uppercase text-text-secondary">No completed reports yet</div></div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {latestReports.map((report) => {
              const player = players[report.playerId];
              const region = getScoutingRegion(report.regionId);
              if (!player || !region) return null;
              const isShortlisted = shortlist.includes(player.id);
              return (
                <article key={report.id} className="rounded border border-border p-4 transition-colors hover:border-accent/60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="flex items-center gap-2"><span className="truncate font-anton text-[16px] uppercase text-text-primary">{player.name}</span>{report.isNewDiscovery && <span className="rounded bg-accent/15 px-1.5 py-0.5 font-space-mono text-[7px] font-bold uppercase text-accent">New</span>}</span>
                      <span className="mt-1 block font-space-mono text-[8px] font-bold uppercase text-text-secondary">{player.age} · {player.role} · {region.name}</span>
                    </div>
                    <div className="shrink-0 text-right"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Confidence</div><div className="font-anton text-[17px] text-text-primary">{report.confidence}%</div></div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded bg-[#16130f]/5 p-2"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Current ability</div><div className="mt-1 font-anton text-[16px] text-text-primary">{report.currentAbilityRange[0]}–{report.currentAbilityRange[1]}</div></div>
                    <div className="rounded bg-[#16130f]/5 p-2"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Potential</div><div className="mt-1 font-anton text-[16px] text-text-primary">{report.potentialRange[0]}–{report.potentialRange[1]}</div></div>
                    <div className="rounded bg-[#16130f]/5 p-2"><div className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Auction</div><div className="mt-1 font-anton text-[16px] text-text-primary">{report.scheduledAuctionSeason}</div></div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-text-secondary">{report.summary}</p>
                  <button type="button" onClick={() => onToggleShortlist(player.id)} className={`mt-3 flex w-full items-center justify-center gap-2 rounded border px-3 py-2 font-space-mono text-[8px] font-bold uppercase transition-colors ${isShortlisted ? "border-[var(--ink)] bg-[var(--ink)] text-bg" : "border-border text-text-primary hover:border-accent hover:bg-accent/5"}`}>
                    {isShortlisted ? <Check size={12} /> : <UserPlus size={12} />} {isShortlisted ? "On auction shortlist" : "Add to auction shortlist"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
