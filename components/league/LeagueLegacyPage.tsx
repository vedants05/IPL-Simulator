"use client";

import { Award, Crown, Medal, Sparkles, Trophy, UserRound, UsersRound } from "lucide-react";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { LeagueHistorySeason, LeagueHistoryTeam } from "@/lib/data/leagueHistory";
import { HISTORICAL_RETIRED_LEGACY_PLAYERS, type LeagueLegacyPlayer } from "@/lib/data/leagueLegacyPlayers";
import type { CareerStaffState } from "@/lib/logic/staffContracts";
import type { Player } from "@/lib/types";

type LegacyCategory = "titles" | "runnerUps" | "mvps" | "emerging" | "orangeCaps" | "purpleCaps";
type LegacyView = "teams" | "players" | "coaches";

interface LegacyEntry { season: number; name?: string }
interface LegacyCounts {
  titles: LegacyEntry[]; runnerUps: LegacyEntry[]; mvps: LegacyEntry[];
  emerging: LegacyEntry[]; orangeCaps: LegacyEntry[]; purpleCaps: LegacyEntry[];
}
interface TeamLegacyRow extends LegacyCounts { team: LeagueHistoryTeam }
interface PersonLegacyRow extends LegacyCounts { id: string; name: string; subtitle: string; profileSlug?: string }
interface LeagueLegacyPageProps {
  seasons: LeagueHistorySeason[];
  teams: Record<string, LeagueHistoryTeam>;
  players: Player[];
  careerStaff: CareerStaffState;
  onOpenStaff?: (staffSlug: string) => void;
}

const LINEAGE: Record<string, string> = { DD: "DC", KXIP: "PBKS" };
const PAST_TEAM_IDS = new Set(["DCG", "RPS", "GL", "KTK", "PWI"]);
const canonicalTeamId = (teamId: string) => LINEAGE[teamId] ?? teamId;
const normalizeName = (name: string) => name.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const emptyCounts = (): LegacyCounts => ({ titles: [], runnerUps: [], mvps: [], emerging: [], orangeCaps: [], purpleCaps: [] });
const columns: Array<{ key: LegacyCategory; label: string; shortLabel: string; color: string }> = [
  { key: "titles", label: "Championship titles", shortLabel: "Titles", color: "#d69b24" },
  { key: "runnerUps", label: "Runner-up finishes", shortLabel: "Runners-up", color: "#94a3b8" },
  { key: "mvps", label: "Most Valuable Players", shortLabel: "MVPs", color: "#f59e0b" },
  { key: "emerging", label: "Emerging Players", shortLabel: "Emerging", color: "#0ea5e9" },
  { key: "orangeCaps", label: "Orange Caps", shortLabel: "Orange Caps", color: "#f97316" },
  { key: "purpleCaps", label: "Purple Caps", shortLabel: "Purple Caps", color: "#7e22ce" },
];

interface HistoricalStaffCredit { slug: string; name: string; role: string }
interface HistoricalFinalStaff { champion: HistoricalStaffCredit[]; runnerUp: HistoricalStaffCredit[] }
const staff = (slug: string, name: string, role: string): HistoricalStaffCredit => ({ slug, name, role });

// Senior cricket/coaching staff attached to each finalist. Credits are keyed by
// the same slug as the staff directory, so different roles and career saves merge.
const HISTORICAL_FINAL_STAFF: Record<number, HistoricalFinalStaff> = {
  2008: { champion: [staff("shane-warne", "Shane Warne", "Coach / captain")], runnerUp: [staff("kepler-wessels", "Kepler Wessels", "Head coach")] },
  2009: { champion: [staff("darren-lehmann", "Darren Lehmann", "Head coach"), staff("robin-singh", "Robin Singh", "Fielding coach")], runnerUp: [staff("ray-jennings", "Ray Jennings", "Head coach") ] },
  2010: { champion: [staff("stephen-fleming", "Stephen Fleming", "Head coach")], runnerUp: [staff("robin-singh", "Robin Singh", "Head coach"), staff("jonty-rhodes", "Jonty Rhodes", "Fielding coach")] },
  2011: { champion: [staff("stephen-fleming", "Stephen Fleming", "Head coach")], runnerUp: [staff("ray-jennings", "Ray Jennings", "Head coach") ] },
  2012: { champion: [staff("trevor-bayliss", "Trevor Bayliss", "Head coach"), staff("vijay-dahiya", "Vijay Dahiya", "Assistant coach"), staff("wasim-akram", "Wasim Akram", "Bowling coach")], runnerUp: [staff("stephen-fleming", "Stephen Fleming", "Head coach") ] },
  2013: { champion: [staff("john-wright", "John Wright", "Head coach"), staff("anil-kumble", "Anil Kumble", "Mentor"), staff("robin-singh", "Robin Singh", "Batting coach")], runnerUp: [staff("stephen-fleming", "Stephen Fleming", "Head coach") ] },
  2014: { champion: [staff("trevor-bayliss", "Trevor Bayliss", "Head coach"), staff("vijay-dahiya", "Vijay Dahiya", "Assistant coach"), staff("wasim-akram", "Wasim Akram", "Bowling coach")], runnerUp: [staff("sanjay-bangar", "Sanjay Bangar", "Head coach") ] },
  2015: { champion: [staff("ricky-ponting", "Ricky Ponting", "Head coach"), staff("anil-kumble", "Anil Kumble", "Mentor"), staff("robin-singh", "Robin Singh", "Batting coach"), staff("shane-bond", "Shane Bond", "Bowling coach")], runnerUp: [staff("stephen-fleming", "Stephen Fleming", "Head coach") ] },
  2016: { champion: [staff("tom-moody", "Tom Moody", "Head coach"), staff("vvs-laxman", "VVS Laxman", "Mentor"), staff("muttiah-muralitharan", "Muttiah Muralitharan", "Bowling coach"), staff("simon-helmot", "Simon Helmot", "Assistant coach")], runnerUp: [staff("daniel-vettori", "Daniel Vettori", "Head coach") ] },
  2017: { champion: [staff("mahela-jayawardene", "Mahela Jayawardene", "Head coach"), staff("sachin-tendulkar", "Sachin Tendulkar", "Mentor"), staff("robin-singh", "Robin Singh", "Batting coach"), staff("shane-bond", "Shane Bond", "Bowling coach")], runnerUp: [staff("stephen-fleming", "Stephen Fleming", "Head coach") ] },
  2018: { champion: [staff("stephen-fleming", "Stephen Fleming", "Head coach"), staff("michael-hussey", "Michael Hussey", "Batting coach"), staff("eric-simons", "Eric Simons", "Bowling consultant")], runnerUp: [staff("tom-moody", "Tom Moody", "Head coach"), staff("vvs-laxman", "VVS Laxman", "Mentor"), staff("muttiah-muralitharan", "Muttiah Muralitharan", "Bowling coach") ] },
  2019: { champion: [staff("mahela-jayawardene", "Mahela Jayawardene", "Head coach"), staff("sachin-tendulkar", "Sachin Tendulkar", "Mentor"), staff("robin-singh", "Robin Singh", "Batting coach"), staff("shane-bond", "Shane Bond", "Bowling coach"), staff("zaheer-khan", "Zaheer Khan", "Director of cricket")], runnerUp: [staff("stephen-fleming", "Stephen Fleming", "Head coach"), staff("michael-hussey", "Michael Hussey", "Batting coach"), staff("eric-simons", "Eric Simons", "Bowling consultant") ] },
  2020: { champion: [staff("mahela-jayawardene", "Mahela Jayawardene", "Head coach"), staff("sachin-tendulkar", "Sachin Tendulkar", "Mentor"), staff("robin-singh", "Robin Singh", "Batting coach"), staff("shane-bond", "Shane Bond", "Bowling coach"), staff("zaheer-khan", "Zaheer Khan", "Director of cricket")], runnerUp: [staff("ricky-ponting", "Ricky Ponting", "Head coach"), staff("pravin-amre", "Pravin Amre", "Assistant coach"), staff("mohammad-kaif", "Mohammad Kaif", "Assistant coach") ] },
  2021: { champion: [staff("stephen-fleming", "Stephen Fleming", "Head coach"), staff("michael-hussey", "Michael Hussey", "Batting coach"), staff("eric-simons", "Eric Simons", "Bowling consultant")], runnerUp: [staff("brendon-mccullum", "Brendon McCullum", "Head coach"), staff("david-hussey", "David Hussey", "Mentor"), staff("abhishek-nayar", "Abhishek Nayar", "Assistant coach") ] },
  2022: { champion: [staff("ashish-nehra", "Ashish Nehra", "Head coach"), staff("gary-kirsten", "Gary Kirsten", "Batting coach / mentor"), staff("aashish-kapoor", "Aashish Kapoor", "Assistant coach"), staff("narender-negi", "Narender Negi", "Assistant coach")], runnerUp: [staff("kumar-sangakkara", "Kumar Sangakkara", "Head coach / director"), staff("lasith-malinga", "Lasith Malinga", "Fast bowling coach"), staff("trevor-penney", "Trevor Penney", "Assistant coach"), staff("dishant-yagnik", "Dishant Yagnik", "Fielding coach") ] },
  2023: { champion: [staff("stephen-fleming", "Stephen Fleming", "Head coach"), staff("michael-hussey", "Michael Hussey", "Batting coach"), staff("dwayne-bravo", "Dwayne Bravo", "Bowling coach"), staff("eric-simons", "Eric Simons", "Bowling consultant"), staff("rajiv-kumar", "Rajiv Kumar", "Fielding coach")], runnerUp: [staff("ashish-nehra", "Ashish Nehra", "Head coach"), staff("gary-kirsten", "Gary Kirsten", "Batting coach / mentor"), staff("aashish-kapoor", "Aashish Kapoor", "Assistant coach"), staff("narender-negi", "Narender Negi", "Assistant coach") ] },
  2024: { champion: [staff("chandrakant-pandit", "Chandrakant Pandit", "Head coach"), staff("gautam-gambhir", "Gautam Gambhir", "Mentor"), staff("bharat-arun", "Bharat Arun", "Bowling coach"), staff("abhishek-nayar", "Abhishek Nayar", "Assistant coach"), staff("ryan-ten-doeschate", "Ryan ten Doeschate", "Fielding coach"), staff("carl-crowe", "Carl Crowe", "Spin bowling coach")], runnerUp: [staff("daniel-vettori", "Daniel Vettori", "Head coach"), staff("james-franklin", "James Franklin", "Assistant coach"), staff("muttiah-muralitharan", "Muttiah Muralitharan", "Spin bowling coach") ] },
  2025: { champion: [staff("andy-flower", "Andy Flower", "Head coach"), staff("dinesh-karthik", "Dinesh Karthik", "Batting coach / mentor"), staff("omkar-salvi", "Omkar Salvi", "Bowling coach"), staff("malolan-rangarajan", "Malolan Rangarajan", "Assistant coach")], runnerUp: [staff("ricky-ponting", "Ricky Ponting", "Head coach"), staff("brad-haddin", "Brad Haddin", "Assistant coach"), staff("james-hopes", "James Hopes", "Bowling coach"), staff("sunil-joshi", "Sunil Joshi", "Spin bowling coach") ] },
  2026: { champion: [staff("andy-flower", "Andy Flower", "Head coach"), staff("dinesh-karthik", "Dinesh Karthik", "Batting coach / mentor"), staff("omkar-salvi", "Omkar Salvi", "Bowling coach")], runnerUp: [staff("ashish-nehra", "Ashish Nehra", "Head coach"), staff("parthiv-patel", "Parthiv Patel", "Batting coach / mentor"), staff("aashish-kapoor", "Aashish Kapoor", "Assistant coach"), staff("narender-negi", "Narender Negi", "Assistant coach"), staff("naeem-amin", "Naeem Amin", "Assistant coach") ] },
};

function buildTeamRows(seasons: LeagueHistorySeason[], teams: Record<string, LeagueHistoryTeam>): TeamLegacyRow[] {
  const ids = new Set(Object.keys(teams).map(canonicalTeamId));
  seasons.forEach((season) => [season.championTeamId, season.runnerUpTeamId, season.mvp?.teamId, season.emergingPlayer?.teamId, season.orangeCap.teamId, season.purpleCap.teamId]
    .forEach((id) => { if (id) ids.add(canonicalTeamId(id)); }));
  return Array.from(ids).map((teamId) => {
    const row: TeamLegacyRow = { team: teams[teamId] ?? { id: teamId, name: teamId, shortName: teamId, primaryColor: "#64748b", secondaryColor: "#fff" }, ...emptyCounts() };
    seasons.forEach((season) => {
      if (canonicalTeamId(season.championTeamId) === teamId) row.titles.push({ season: season.season });
      if (canonicalTeamId(season.runnerUpTeamId) === teamId) row.runnerUps.push({ season: season.season });
      if (season.mvp && canonicalTeamId(season.mvp.teamId) === teamId) row.mvps.push({ season: season.season, name: season.mvp.name });
      if (season.emergingPlayer && canonicalTeamId(season.emergingPlayer.teamId) === teamId) row.emerging.push({ season: season.season, name: season.emergingPlayer.name });
      if (canonicalTeamId(season.orangeCap.teamId) === teamId) row.orangeCaps.push({ season: season.season, name: season.orangeCap.name });
      if (canonicalTeamId(season.purpleCap.teamId) === teamId) row.purpleCaps.push({ season: season.season, name: season.purpleCap.name });
    });
    return row;
  }).sort((a, b) => b.titles.length - a.titles.length || b.runnerUps.length - a.runnerUps.length || a.team.name.localeCompare(b.team.name));
}

function playerAwardTotal(row: PersonLegacyRow) { return row.mvps.length + row.emerging.length + row.orangeCaps.length + row.purpleCaps.length; }

export function buildPlayerRows(seasons: LeagueHistorySeason[], players: Player[]): PersonLegacyRow[] {
  const seasonsByYear = new Map(seasons.map((season) => [season.season, season]));
  const rows = new Map<string, PersonLegacyRow>();
  const playersByName = new Map<string, LeagueLegacyPlayer>();
  HISTORICAL_RETIRED_LEGACY_PLAYERS.forEach((player) => playersByName.set(normalizeName(player.name), player));
  players.forEach((player) => playersByName.set(normalizeName(player.name), player));
  Array.from(playersByName.values()).forEach((player) => {
    const row = { id: player.id, name: player.name, subtitle: `${player.role} · ${player.nationality}`, ...emptyCounts() };
    player.iplHistory.forEach((history) => {
      const season = seasonsByYear.get(Number.parseInt(history.season, 10));
      if (!season) return;
      if (canonicalTeamId(history.teamId) === canonicalTeamId(season.championTeamId)) row.titles.push({ season: season.season, name: canonicalTeamId(season.championTeamId) });
      if (canonicalTeamId(history.teamId) === canonicalTeamId(season.runnerUpTeamId)) row.runnerUps.push({ season: season.season, name: canonicalTeamId(season.runnerUpTeamId) });
    });
    rows.set(player.id, row);
  });
  const award = (honour: { name: string; teamId: string } | undefined, season: number, key: "mvps" | "emerging" | "orangeCaps" | "purpleCaps") => {
    if (!honour) return;
    const player = playersByName.get(normalizeName(honour.name));
    if (player) rows.get(player.id)?.[key].push({ season, name: canonicalTeamId(honour.teamId) });
  };
  seasons.forEach((season) => {
    award(season.mvp, season.season, "mvps"); award(season.emergingPlayer, season.season, "emerging");
    award(season.orangeCap, season.season, "orangeCaps"); award(season.purpleCap, season.season, "purpleCaps");
  });
  return Array.from(rows.values()).filter((row) => row.titles.length >= 4 || playerAwardTotal(row) > 1)
    .sort((a, b) => b.titles.length - a.titles.length || b.runnerUps.length - a.runnerUps.length || playerAwardTotal(b) - playerAwardTotal(a) || a.name.localeCompare(b.name));
}

function careerFinalStaff(state: CareerStaffState, season: number, teamId: string): HistoricalStaffCredit[] {
  const direct = Object.values(state.contracts).filter((item) => canonicalTeamId(item.teamId ?? "") === canonicalTeamId(teamId)
    && (item.startSeason ?? season) <= season && (item.endSeason == null || item.endSeason >= season));
  if (direct.length) return direct.map((item) => staff(item.staffSlug, item.fullName, item.roles.map((role) => role.replaceAll("_", " ")).join(" / ")));

  const ids = new Set(state.employmentHistory.filter((event) => event.season >= season && canonicalTeamId(event.teamId ?? "") === canonicalTeamId(teamId)).map((event) => event.staffId));
  return Array.from(ids).map((id) => {
    const contract = state.contracts[id];
    const event = [...state.employmentHistory].reverse().find((item) => item.staffId === id && item.teamId === teamId && item.roles.length);
    return staff(contract?.staffSlug ?? id, contract?.fullName ?? state.generatedProfiles[id]?.fullName ?? "Unknown staff member", (event?.roles ?? []).map((role) => role.replaceAll("_", " ")).join(" / ") || "Coaching staff");
  });
}

function buildCoachRows(seasons: LeagueHistorySeason[], state: CareerStaffState): PersonLegacyRow[] {
  const rows = new Map<string, PersonLegacyRow>();
  const profileSlugs = new Set(Object.values(state.contracts).map((contract) => contract.staffSlug));
  const add = (coach: HistoricalStaffCredit, season: number, teamId: string, key: "titles" | "runnerUps") => {
    const row = rows.get(coach.slug) ?? { id: coach.slug, name: coach.name, subtitle: coach.role, profileSlug: profileSlugs.has(coach.slug) ? coach.slug : undefined, ...emptyCounts() };
    if (!row.subtitle.split(" · ").includes(coach.role)) row.subtitle += ` · ${coach.role}`;
    row[key].push({ season, name: `${canonicalTeamId(teamId)} · ${coach.role}` }); rows.set(coach.slug, row);
  };
  seasons.forEach((season) => {
    if (season.source === "historical") {
      const finalStaff = HISTORICAL_FINAL_STAFF[season.season];
      finalStaff?.champion.forEach((coach) => add(coach, season.season, season.championTeamId, "titles"));
      finalStaff?.runnerUp.forEach((coach) => add(coach, season.season, season.runnerUpTeamId, "runnerUps"));
    } else {
      careerFinalStaff(state, season.season, season.championTeamId).forEach((coach) => add(coach, season.season, season.championTeamId, "titles"));
      careerFinalStaff(state, season.season, season.runnerUpTeamId).forEach((coach) => add(coach, season.season, season.runnerUpTeamId, "runnerUps"));
    }
  });
  return Array.from(rows.values()).sort((a, b) => b.titles.length - a.titles.length || b.runnerUps.length - a.runnerUps.length || a.name.localeCompare(b.name));
}

function LegacyCell({ entries, label, color }: { entries: LegacyEntry[]; label: string; color: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number; placeBelow: boolean } | null>(null);
  const grouped = new Map<string, number[]>();
  entries.forEach((entry) => { if (entry.name) grouped.set(entry.name, [...(grouped.get(entry.name) ?? []), entry.season]); });
  const details = entries.length === 0 ? [`No ${label.toLowerCase()} recorded`] : grouped.size
    ? Array.from(grouped).map(([name, years]) => `${name} — ${years.sort((a, b) => a - b).join(", ")}`)
    : [entries.map((entry) => entry.season).sort((a, b) => a - b).join(", ")];
  const showTooltip = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 224;
    setTooltipPosition({ left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)), top: rect.top, placeBelow: rect.top < 260 });
  };
  return <div className="relative flex h-full items-center justify-center">
    <button ref={buttonRef} type="button" onMouseEnter={showTooltip} onMouseLeave={() => setTooltipPosition(null)} onFocus={showTooltip} onBlur={() => setTooltipPosition(null)} className="flex h-7 min-w-10 items-center justify-center rounded-md border border-transparent font-anton text-[17px] hover:border-border hover:bg-bg focus-visible:border-accent focus-visible:outline-none" style={{ color }} aria-label={`${entries.length} ${label}. ${details.join(", ")}`}>{entries.length}</button>
    {tooltipPosition && typeof document !== "undefined" && createPortal(<div role="tooltip" className="pointer-events-none fixed z-[9999] w-56 rounded-lg border border-border bg-surface p-3 text-left shadow-2xl" style={{ left: tooltipPosition.left, top: tooltipPosition.placeBelow ? tooltipPosition.top + 34 : tooltipPosition.top - 6, transform: tooltipPosition.placeBelow ? undefined : "translateY(-100%)" }}><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em]" style={{ color }}>{label}</p><div className="mt-2 max-h-52 space-y-1 overflow-y-auto">{details.map((detail) => <p key={detail} className="text-[10px] font-semibold text-text-primary">{detail}</p>)}</div></div>, document.body)}
  </div>;
}

function SortableHeader({ column, sortKey, ascending, onSort }: { column: typeof columns[number]; sortKey: LegacyCategory; ascending: boolean; onSort: (key: LegacyCategory) => void }) {
  return <button type="button" onClick={() => onSort(column.key)} className={`text-center font-space-mono text-[7px] font-bold uppercase hover:text-accent ${sortKey === column.key ? "text-accent" : "text-text-secondary"}`}>{column.shortLabel}{sortKey === column.key ? ` ${ascending ? "▲" : "▼"}` : ""}</button>;
}

function PersonTable({ rows, visibleColumns, onOpenStaff, sortKey, ascending, onSort }: { rows: PersonLegacyRow[]; visibleColumns: typeof columns; onOpenStaff?: (staffSlug: string) => void; sortKey: LegacyCategory; ascending: boolean; onSort: (key: LegacyCategory) => void }) {
  const gridTemplate = `minmax(210px,1.55fr) repeat(${visibleColumns.length},minmax(88px,1fr))`;
  return <div className="h-full overflow-y-auto rounded-xl border border-border bg-surface shadow-sm"><div className="sticky top-0 z-20 grid h-[36px] items-center border-b-2 border-border bg-bg px-3" style={{ gridTemplateColumns: gridTemplate }}><span className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-text-secondary">Rank · Name</span>{visibleColumns.map((column) => <SortableHeader key={column.key} column={column} sortKey={sortKey} ascending={ascending} onSort={onSort} />)}</div>
    {rows.length ? rows.map((row, index) => <div key={row.id} className="grid min-h-[48px] items-center border-b border-border/60 px-3 last:border-b-0 hover:bg-accent/[0.04]" style={{ gridTemplateColumns: gridTemplate }}><div className="flex min-w-0 items-center gap-3 pr-3"><span className={`flex size-7 shrink-0 items-center justify-center rounded-md font-anton text-sm ${index < 3 ? "bg-warning/15 text-warning" : "bg-bg text-text-secondary"}`}>{index + 1}</span><span className="min-w-0">{row.profileSlug && onOpenStaff ? <button type="button" onClick={() => onOpenStaff(row.profileSlug!)} className="block max-w-full truncate text-left text-[11px] font-bold text-text-primary underline-offset-2 hover:text-accent hover:underline">{row.name}</button> : <span className="block truncate text-[11px] font-bold text-text-primary">{row.name}</span>}<span className="block truncate font-space-mono text-[6px] font-bold uppercase text-text-secondary">{row.subtitle}</span></span></div>{visibleColumns.map((column) => <LegacyCell key={column.key} entries={row[column.key]} label={column.label} color={column.color} />)}</div>) : <div className="flex h-40 items-center justify-center font-space-mono text-[9px] font-bold uppercase text-text-secondary">No qualifying legacy records yet</div>}
  </div>;
}

export default function LeagueLegacyPage({ seasons, teams, players, careerStaff, onOpenStaff }: LeagueLegacyPageProps) {
  const [view, setView] = useState<LegacyView>("teams");
  const [sortKey, setSortKey] = useState<LegacyCategory>("titles");
  const [sortAscending, setSortAscending] = useState(false);
  const [includePastTeams, setIncludePastTeams] = useState(true);
  const sortRows = <T extends LegacyCounts,>(rows: T[], nameOf: (row: T) => string) => [...rows].sort((a, b) => {
    const difference = a[sortKey].length - b[sortKey].length;
    return (sortAscending ? difference : -difference) || nameOf(a).localeCompare(nameOf(b));
  });
  const teamRows = useMemo(() => sortRows(buildTeamRows(seasons, teams).filter((row) => includePastTeams || !PAST_TEAM_IDS.has(row.team.id)), (row) => row.team.name), [includePastTeams, seasons, sortAscending, sortKey, teams]);
  const playerRows = useMemo(() => sortRows(buildPlayerRows(seasons, players), (row) => row.name), [players, seasons, sortAscending, sortKey]);
  const coachSortKey = sortKey === "titles" || sortKey === "runnerUps" ? sortKey : "titles";
  const coachRows = useMemo(() => [...buildCoachRows(seasons, careerStaff)].sort((a, b) => {
    const difference = a[coachSortKey].length - b[coachSortKey].length;
    return (sortAscending ? difference : -difference) || a.name.localeCompare(b.name);
  }), [careerStaff, coachSortKey, seasons, sortAscending]);
  const handleSort = (key: LegacyCategory) => { if (sortKey === key) setSortAscending((current) => !current); else { setSortKey(key); setSortAscending(false); } };
  const firstSeason = Math.min(...seasons.map((season) => season.season)); const latestSeason = Math.max(...seasons.map((season) => season.season));
  const config = view === "players" ? { title: "Player Legacy", copy: "Players with 4+ titles or multiple major individual honours.", icon: UserRound, rows: playerRows }
    : view === "coaches" ? { title: "Coaching Legacy", copy: "Head coaches ranked by championships and runner-up finishes.", icon: UsersRound, rows: coachRows }
      : { title: "Franchise Legacy", copy: "Every championship finish and individual season honour, by franchise lineage.", icon: Crown, rows: teamRows };
  const Icon = config.icon;
  return <div className="relative flex h-[calc(100vh-200px)] min-h-[560px] flex-col overflow-hidden rounded-2xl border-2 border-border bg-bg/50 shadow-lg">
    <header className="relative flex h-[96px] shrink-0 items-center justify-between overflow-hidden border-b border-border px-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_-40%,rgba(214,155,36,.28),transparent_38%),radial-gradient(circle_at_90%_0%,rgba(14,165,233,.12),transparent_32%)]" /><div className="relative flex items-center gap-4"><span className="flex size-12 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning shadow-sm"><Icon size={23} /></span><div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.28em] text-warning">The IPL honours archive</p><h2 className="mt-1 font-anton text-3xl uppercase leading-none text-text-primary">{config.title}</h2><p className="mt-1.5 text-[10px] text-text-secondary">{config.copy}</p></div></div><div className="relative grid grid-cols-3 gap-2 text-center">{[{ label: view === "teams" ? "Teams" : view, value: config.rows.length }, { label: "Archive years", value: seasons.length }, { label: "Career additions", value: seasons.filter((season) => season.source === "career").length }].map((item) => <div key={item.label} className="min-w-[88px] rounded-xl border border-border bg-surface/80 px-4 py-2.5 shadow-sm"><b className="block font-anton text-2xl leading-none text-text-primary">{item.value}</b><span className="mt-1 block font-space-mono text-[6px] font-bold uppercase tracking-wider text-text-secondary">{item.label}</span></div>)}</div></header>
    <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface/55 px-5 py-3"><div className="flex items-center gap-3"><div className="grid grid-cols-3 gap-2">{(["teams", "players", "coaches"] as LegacyView[]).map((option) => <button key={option} type="button" onClick={() => setView(option)} className={`min-w-[108px] rounded-lg border px-5 py-2 font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] transition-colors ${view === option ? "border-accent bg-accent text-white shadow-sm" : "border-border bg-bg/60 text-text-secondary hover:border-accent/50 hover:text-text-primary"}`}>{option === "teams" ? "Teams" : option}</button>)}</div>{view === "teams" && <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-bg/60 px-3 py-2 font-space-mono text-[7px] font-bold uppercase text-text-secondary"><input type="checkbox" checked={includePastTeams} onChange={(event) => setIncludePastTeams(event.target.checked)} className="accent-[var(--accent)]" />Include past teams</label>}</div><div className="flex items-center gap-5">{[{ icon: Trophy, label: "Archive", value: `${firstSeason}–${latestSeason}` }, { icon: Medal, label: "Finals", value: seasons.length }, { icon: Award, label: "Awards", value: seasons.reduce((sum, season) => sum + 2 + Number(Boolean(season.mvp)) + Number(Boolean(season.emergingPlayer)), 0) }, { icon: Sparkles, label: "Live", value: seasons.filter((season) => season.source === "career").length }].map(({ icon: ItemIcon, label, value }) => <span key={label} className="flex items-center gap-1.5"><ItemIcon size={12} className="text-accent" /><b className="font-anton text-xs text-text-primary">{value}</b><small className="font-space-mono text-[6px] font-bold uppercase text-text-secondary">{label}</small></span>)}</div></div>
    <div className="relative min-h-0 flex-1 p-4">{view === "teams" ? <div className="grid h-full overflow-hidden rounded-xl border border-border bg-surface shadow-sm grid-rows-[36px_repeat(var(--legacy-rows),minmax(0,1fr))]" style={{ "--legacy-rows": teamRows.length } as CSSProperties}><div className="grid grid-cols-[minmax(190px,1.45fr)_repeat(6,minmax(82px,1fr))] items-center border-b-2 border-border bg-bg px-3"><span className="font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-text-secondary">Rank · Franchise</span>{columns.map((column) => <SortableHeader key={column.key} column={column} sortKey={sortKey} ascending={sortAscending} onSort={handleSort} />)}</div>{teamRows.map((row, index) => <div key={row.team.id} className="grid min-h-0 grid-cols-[minmax(190px,1.45fr)_repeat(6,minmax(82px,1fr))] items-center border-b border-border/60 px-3 last:border-b-0 hover:bg-accent/[0.04]"><div className="flex min-w-0 items-center gap-3"><span className={`flex size-7 shrink-0 items-center justify-center rounded-md font-anton text-sm ${index < 3 ? "bg-warning/15 text-warning" : "bg-bg text-text-secondary"}`}>{index + 1}</span><span className="flex size-7 shrink-0 items-center justify-center rounded text-[8px] font-black" style={{ backgroundColor: row.team.primaryColor, color: row.team.secondaryColor }}>{row.team.shortName.slice(0, 4)}</span><span className="truncate text-[10px] font-bold text-text-primary">{row.team.name}</span></div>{columns.map((column) => <LegacyCell key={column.key} entries={row[column.key]} label={column.label} color={column.color} />)}</div>)}</div> : view === "players" ? <PersonTable rows={playerRows} visibleColumns={columns} sortKey={sortKey} ascending={sortAscending} onSort={handleSort} /> : <PersonTable rows={coachRows} visibleColumns={columns.slice(0, 2)} onOpenStaff={onOpenStaff} sortKey={coachSortKey} ascending={sortAscending} onSort={handleSort} />}</div>
  </div>;
}
