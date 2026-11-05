"use client";
import { formatDisplayDate, formatLongDisplayDate } from "@/lib/logic/displayDate";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, CircleGauge, Heart, Shield, TrendingUp, Users } from "lucide-react";

import type { ClubOwnershipRecord } from "@/lib/data/clubOwnership";
import {
  buildTeamSupporterView,
  type SupporterFixture,
  type SupporterBoardContext,
  type SupporterClubEvent,
  type SupporterDepartmentReview,
  type SupporterPlayerStats,
  type SupporterStaffMember,
} from "@/lib/logic/supporters";
import type { Player, Team } from "@/lib/types";

interface SupportersPageProps {
  team: Team;
  fixtures: SupporterFixture[];
  standingPosition: number | null;
  squadPlayers: Player[];
  playerStats: Record<string, SupporterPlayerStats>;
  staff: SupporterStaffMember[];
  ownership: ClubOwnershipRecord;
  captainId?: string | null;
  viceCaptainId?: string | null;
  activeInjuryCount?: number;
  clubEvents?: SupporterClubEvent[];
  departmentReviews?: SupporterDepartmentReview[];
  boardContext?: SupporterBoardContext;
  currentSeason?: number;
  commercial?: { pricing: number; service: number; outreach: number; cashDiscipline: number };
  onOpenPlayer?: (playerId: string) => void;
}

const sentimentTone = (score: number) => score >= 72
  ? "text-emerald-500"
  : score >= 52
    ? "text-amber-500"
    : "text-rose-500";

const sentimentBar = (score: number) => score >= 72
  ? "bg-emerald-500"
  : score >= 52
    ? "bg-amber-500"
    : "bg-rose-500";

function formatSentimentDate(value: unknown): string {
  const text = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return text;
  return formatLongDisplayDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).replace(/ \d{4}$/, "");
}

function Trend({ value }: { value: number }) {
  if (value > 0) return <span className="inline-flex items-center gap-1 text-emerald-500"><ArrowUpRight size={12} />+{value}</span>;
  if (value < 0) return <span className="inline-flex items-center gap-1 text-rose-500"><ArrowDownRight size={12} />{value}</span>;
  return <span className="text-text-secondary">Stable</span>;
}

function ApprovalBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="min-w-0" data-approval-bar>
      <div className="relative mb-1.5 h-10">
        <span className="block font-space-mono text-[8px] font-bold uppercase leading-tight tracking-wide text-text-secondary">{label}</span>
        <span
          className={`absolute bottom-0 -translate-x-1/2 whitespace-nowrap font-space-mono text-[9px] font-bold leading-none ${sentimentTone(score)}`}
          style={{ left: `clamp(16px, ${Math.max(0, Math.min(100, score))}%, calc(100% - 16px))` }}
        >{score}%</span>
      </div>
      <div role="meter" aria-label={`${label} supporter happiness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="h-2 overflow-hidden rounded-full border border-border/40 bg-text-secondary/20">
        <div className={`h-full rounded-full transition-all ${sentimentBar(score)}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-space-mono text-[7px] leading-none text-text-secondary"><span>0</span><span>100</span></div>
    </div>
  );
}

function PersonList({
  title,
  items,
  empty,
  onOpen,
}: {
  title: string;
  items: Array<{ id: string; name: string; detail: string; approval: number; trend: number }>;
  empty: string;
  onOpen?: (id: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col border border-border bg-surface2 p-4" data-supporter-person-list>
      <h3 className="font-anton text-[15px] uppercase tracking-wide text-text-primary">{title}</h3>
      <div className="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto" style={{ gridTemplateRows: `repeat(${Math.max(1, items.length)}, minmax(min-content, 1fr))` }}>
        {items.length === 0 && <p className="py-4 text-center text-[10px] text-text-secondary">{empty}</p>}
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen?.(item.id)}
            disabled={!onOpen}
            className="grid w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-3 border border-border/70 bg-surface px-3 py-2 text-left transition-colors enabled:hover:border-accent"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 font-anton text-xs text-accent">{index + 1}</span>
            <span className="min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-barlow-condensed text-[17px] font-bold leading-tight text-text-primary">{item.name}</span>
                <span className={`shrink-0 font-anton text-[21px] leading-none ${sentimentTone(item.approval)}`}>{item.approval}<span className="ml-0.5 font-space-mono text-[8px] font-normal text-text-secondary">/100</span></span>
              </span>
              <span className="mt-1 block break-words text-[11px] leading-snug text-text-secondary">{item.detail}</span>
              <span className="mt-1.5 flex items-center justify-between gap-2 font-space-mono text-[9px] font-bold">
                <span className={sentimentTone(item.approval)}>{item.approval >= 72 ? "Supportive" : item.approval >= 52 ? "Mixed" : "Critical"}</span>
                <span className="inline-flex items-center gap-1"><Trend value={item.trend} /><span className="font-normal text-text-secondary">{item.trend === 0 ? "" : "pts"}</span></span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function SupportersPage(props: SupportersPageProps) {
  const [activeView, setActiveView] = useState<"overview" | "people" | "trends" | "issues" | "culture">("overview");
  const view = useMemo(() => buildTeamSupporterView(props), [props]);
  const categoryEntries = [
    ["Results", view.categoryApproval.results],
    ["Playing squad", view.categoryApproval.squad],
    ["Staff", view.categoryApproval.staff],
    ["Board and ownership", view.categoryApproval.board],
    ["Captaincy", view.categoryApproval.leadership],
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-2 border-border bg-surface" data-supporters-page>
      <header
        className="relative shrink-0 overflow-hidden border-b border-border px-5 py-3 text-text-primary"
        style={{ background: "linear-gradient(125deg, color-mix(in srgb, var(--surface2) 86%, var(--team-primary) 14%), var(--surface))" }}
      >
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 font-space-mono text-[8px] font-bold uppercase tracking-[0.22em] text-accent">
              <Users size={13} /> {props.team.name} supporter culture
            </div>
            <div className="mt-1 flex items-baseline gap-3"><h2 className="font-anton text-[25px] uppercase leading-none">{view.mood}</h2><p className="max-w-2xl truncate text-[10px] text-text-secondary">{view.summary}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-6 lg:text-right">
            <div><div className={`font-anton text-[22px] leading-none ${sentimentTone(view.overallHappiness)}`}>{view.overallHappiness}%</div><div className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Happiness</div></div>
            <div><div className="font-anton text-[22px] leading-none text-text-primary">{props.team.fanBase}</div><div className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Fanbase</div></div>
            <div><div className="font-anton text-[22px] leading-none text-accent">{view.homeAtmosphere}</div><div className="mt-1 font-space-mono text-[7px] font-bold uppercase tracking-wider text-text-secondary">Atmosphere</div></div>
          </div>
        </div>
      </header>

      <nav className="flex shrink-0 items-center gap-1 border-b border-border bg-surface2 px-4 py-1.5">
        {(["overview", "people", "trends", "issues", "culture"] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveView(tab)} className={`border px-4 py-1.5 font-space-mono text-[8px] font-bold uppercase tracking-wider transition-colors ${activeView === tab ? "border-accent bg-accent text-white" : "border-border bg-surface text-text-secondary hover:text-text-primary"}`}>{tab}</button>
        ))}
        <span className="ml-auto font-space-mono text-[8px] font-bold uppercase text-text-secondary">Direction <Trend value={view.trajectory} /></span>
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {activeView === "overview" && (
          <div className="grid h-full min-h-0 grid-cols-[1.05fr_1.15fr] gap-3" data-supporters-overview>
            <div className="grid min-h-0 grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
              <section className="flex min-h-0 flex-col justify-between gap-2 border border-border bg-surface2 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Current outlook</p><h3 className="mt-1 font-anton text-[20px] uppercase leading-tight text-text-primary">{view.culture.identity}</h3></div>
                  <span className={`font-anton text-[28px] leading-none ${sentimentTone(view.confidenceInDirection)}`}>{view.confidenceInDirection}%</span>
                </div>
                <p className="text-[12px] leading-relaxed text-text-secondary">{view.culture.description}</p>
                <div className="rounded-r-md border border-accent/15 border-l-[3px] border-l-accent bg-accent/5 px-4 py-3" data-supporter-expectation>
                  <p className="mb-1 font-space-mono text-[8px] font-bold uppercase tracking-[0.16em] text-accent">Supporter expectations</p>
                  <p className="font-barlow-condensed text-[20px] font-semibold leading-tight text-text-primary">{view.expectation}</p>
                </div>
                <div className="grid grid-cols-5 gap-3 border-t border-border/40 pt-2">{categoryEntries.map(([label, score]) => <ApprovalBar key={label} label={label} score={score} />)}</div>
              </section>
              <section className="flex min-h-0 flex-col border border-border bg-surface2 p-4">
                <div className="mb-3 flex shrink-0 items-center gap-2"><CircleGauge size={16} className="text-accent" /><h3 className="font-anton text-[17px] uppercase text-text-primary">Current priorities</h3></div>
                <div className="grid min-h-0 flex-1 grid-rows-3 gap-2">
                  {view.priorities.map((priority, index) => <div key={priority} className="flex min-h-0 items-center gap-3 border border-border/60 bg-surface px-3 py-2"><span className="shrink-0 font-anton text-[22px] text-accent">0{index + 1}</span><span className="text-[12px] font-semibold leading-snug text-text-primary">{priority}</span></div>)}
                </div>
              </section>
            </div>
            <section className="flex min-h-0 flex-col border border-border bg-surface2 p-4">
              <div className="flex shrink-0 items-center justify-between border-b border-border/40 pb-3"><div><p className="font-space-mono text-[8px] font-bold uppercase tracking-[0.18em] text-accent">Who follows the club</p><h3 className="mt-1 font-anton text-[20px] uppercase text-text-primary">Fanbase composition</h3></div><Heart size={18} className="text-accent" /></div>
              <div className="grid min-h-0 flex-1 grid-rows-[minmax(150px,1fr)_auto] gap-3 pt-3">
                <div className="min-h-0">
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={view.groups} dataKey="share" nameKey="shortLabel" innerRadius="53%" outerRadius="85%" paddingAngle={1.5} stroke="none">{view.groups.map(group => <Cell key={group.id} fill={group.color} />)}</Pie><Tooltip formatter={value => `${Number(value).toFixed(1)}%`} contentStyle={{ background: "var(--surface2)", border: "1px solid var(--hairline)", fontSize: 11 }} /></PieChart></ResponsiveContainer>
                </div>
                <div>
                  <div className="grid grid-cols-[10px_minmax(0,1fr)_55px_45px] gap-2 border-b border-border/50 pb-1 font-space-mono text-[8px] uppercase text-text-secondary"><span /><span>Group</span><span className="text-right">Share</span><span className="text-right">Mood</span></div>
                  {view.groups.map(group => <div key={group.id} className="grid grid-cols-[10px_minmax(0,1fr)_55px_45px] items-center gap-2 border-b border-border/30 py-1.5 last:border-0"><span className="size-2 rounded-full" style={{ backgroundColor: group.color }} /><span className="text-[11px] font-semibold leading-tight text-text-primary">{group.label}<span className="font-normal text-text-secondary"> — {group.description}</span></span><span className="text-right font-space-mono text-[10px] text-text-secondary">{group.share.toFixed(1)}%</span><span className={`text-right font-space-mono text-[11px] font-bold ${sentimentTone(group.happiness)}`}>{group.happiness}</span></div>)}
                </div>
              </div>
            </section>
            {/* Group descriptions are shown inline; group priorities remain available in view.groups. */}
          </div>
        )}

        {activeView === "people" && (
          <div className="grid h-full min-h-0 grid-cols-3 gap-3" data-supporters-people>
            <PersonList title="Most popular players" items={view.popularPlayers} empty="No player has established a strong supporter standing yet." onOpen={props.onOpenPlayer} /><PersonList title="Players under pressure" items={view.playersUnderPressure} empty="No player is currently facing concentrated supporter pressure." onOpen={props.onOpenPlayer} /><PersonList title="Staff approval" items={view.staffApproval.slice(0, 5)} empty="The current staff setup has not been assessed." />
          </div>
        )}

        {activeView === "trends" && (
          <div className="grid h-full min-h-0 grid-rows-[1.1fr_.9fr] gap-3">
            <section className="min-h-0 border border-border bg-surface2 p-3"><div className="flex items-center justify-between"><div><p className="font-space-mono text-[7px] font-bold uppercase tracking-[0.18em] text-accent">Match-by-match movement</p><h3 className="font-anton text-[15px] uppercase text-text-primary">Sentiment history</h3></div><TrendingUp size={15} className="text-accent" /></div><div className="h-[calc(100%-30px)] min-h-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={view.trend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="supporterSentimentFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--team-primary)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--team-primary)" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" opacity={0.45} /><XAxis dataKey="date" tick={{ fill: "var(--text-secondary)", fontSize: 8 }} tickFormatter={formatSentimentDate} minTickGap={24} /><YAxis domain={[0, 100]} tick={{ fill: "var(--text-secondary)", fontSize: 8 }} /><Tooltip labelFormatter={formatSentimentDate} contentStyle={{ background: "var(--surface2)", border: "1px solid var(--hairline)", fontSize: 10 }} /><Area type="monotone" dataKey="happiness" stroke="var(--team-primary)" strokeWidth={2} fill="url(#supporterSentimentFill)" /></AreaChart></ResponsiveContainer></div></section>
            <section className="min-h-0 border border-border bg-surface2 p-3"><div className="mb-2 flex items-center gap-2"><Shield size={14} className="text-accent" /><h3 className="font-anton text-[14px] uppercase text-text-primary">Recent supporter reactions</h3></div><div className="grid h-[calc(100%-26px)] min-h-0 grid-cols-2 grid-rows-3 gap-2">{view.reactions.length === 0 && <p className="col-span-2 self-center text-center text-[9px] text-text-secondary">Supporter reactions will appear after the first match.</p>}{view.reactions.map((reaction) => <article key={reaction.id} className="flex min-h-0 gap-2 overflow-hidden border border-border bg-surface px-2 py-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-anton text-xs ${reaction.delta >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>{reaction.delta > 0 ? `+${reaction.delta}` : reaction.delta}</span><div className="min-w-0"><div className="flex items-center gap-2"><h4 className="truncate text-[9px] font-bold text-text-primary">{reaction.title}</h4><span className="shrink-0 font-space-mono text-[7px] text-text-secondary">{formatDisplayDate(reaction.date)}</span></div><p className="mt-1 line-clamp-2 text-[8px] leading-relaxed text-text-secondary">{reaction.body}</p></div></article>)}</div></section>
          </div>
        )}

        {activeView === "issues" && (
          <div className="grid h-full min-h-0 grid-cols-[.9fr_1.1fr] gap-3">
            <section className="min-h-0 overflow-hidden border border-border bg-surface2 p-3">
              <div className="mb-2 flex items-center gap-2"><CircleGauge size={14} className="text-accent" /><h3 className="font-anton text-[14px] uppercase text-text-primary">Evidence-based concerns</h3></div>
              <div className="grid h-[calc(100%-26px)] min-h-0 grid-rows-5 gap-2">
                {view.concerns.length === 0 && <p className="self-center text-center text-[9px] text-text-secondary">No concentrated concern is currently visible.</p>}
                {view.concerns.map((concern) => <article key={concern.id} className="min-h-0 overflow-hidden border border-border bg-surface px-3 py-2"><div className="flex items-center justify-between gap-2"><h4 className="truncate text-[9px] font-bold text-text-primary">{concern.title}</h4><span className={`font-anton text-base ${sentimentTone(100 - concern.severity)}`}>{concern.severity}</span></div><p className="line-clamp-2 text-[8px] leading-relaxed text-text-secondary">{concern.evidence}</p></article>)}
              </div>
            </section>
            <section className="min-h-0 overflow-hidden border border-border bg-surface2 p-3">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-anton text-[14px] uppercase text-text-primary">Supporter event ledger</h3><span className="font-space-mono text-[7px] uppercase text-text-secondary">Newest first</span></div>
              <div className="grid h-[calc(100%-26px)] min-h-0 grid-cols-2 grid-rows-5 gap-2">
                {view.eventLedger.slice(0, 10).map((event) => <article key={event.id} className="min-h-0 overflow-hidden border border-border bg-surface px-2 py-1.5"><div className="flex items-center gap-2"><span className={`font-anton text-sm ${event.impact >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{event.impact > 0 ? `+${event.impact}` : event.impact}</span><h4 className="truncate text-[8px] font-bold text-text-primary">{event.title}</h4></div><p className="truncate text-[7px] text-text-secondary">{formatSentimentDate(event.date)} · {event.category} · {event.detail}</p></article>)}
              </div>
            </section>
          </div>
        )}

        {activeView === "culture" && (
          <div className="grid h-full min-h-0 grid-cols-[1fr_1.15fr] gap-3">
            <section className="border border-border bg-surface2 p-4">
              <p className="font-space-mono text-[7px] font-bold uppercase tracking-[.18em] text-accent">Supporter identity over time</p>
              <div className="mt-2 grid grid-cols-3 gap-2"><div className="border border-border bg-surface p-3"><div className="font-anton text-2xl text-text-primary">{view.fanbaseIndex}</div><div className="font-space-mono text-[7px] uppercase text-text-secondary">Reach index</div></div><div className="border border-border bg-surface p-3"><div className={`font-anton text-2xl ${view.fanbaseGrowth >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{view.fanbaseGrowth > 0 ? "+" : ""}{view.fanbaseGrowth}%</div><div className="font-space-mono text-[7px] uppercase text-text-secondary">Growth momentum</div></div><div className="border border-border bg-surface p-3"><div className="font-anton text-2xl text-accent">{view.culture.loyalty}</div><div className="font-space-mono text-[7px] uppercase text-text-secondary">Core loyalty</div></div></div>
              <div className="mt-3 space-y-2">{view.cultureEvolution.map((item) => <div key={item} className="border-l-2 border-accent bg-surface px-3 py-2 text-[9px] text-text-primary">{item}</div>)}</div>
              <p className="mt-3 text-[8px] leading-relaxed text-text-secondary">{view.memorySummary}</p>
            </section>
            <section className="border border-border bg-surface2 p-4"><h3 className="font-anton text-[15px] uppercase text-text-primary">Why supporters feel this way</h3><div className="mt-3 grid grid-rows-5 gap-2">{view.categoryTrends.map((category) => <article key={category.category} className="border border-border bg-surface px-3 py-2"><div className="flex items-center justify-between"><h4 className="text-[9px] font-bold text-text-primary">{category.label}</h4><div className="flex items-center gap-3"><Trend value={category.trend} /><span className={`font-anton text-base ${sentimentTone(category.score)}`}>{category.score}</span></div></div><p className="truncate text-[8px] text-text-secondary">{category.explanation}</p></article>)}</div></section>
          </div>
        )}
      </div>
    </div>
  );
}
