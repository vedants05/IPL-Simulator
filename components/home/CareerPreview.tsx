import TeamBadge from "@/components/shared/TeamBadge";
import { formatDisplayDate } from "@/lib/logic/displayDate";
import type { Team } from "@/lib/types";
import type { CareerEmailFixture, CareerEmailStanding } from "@/lib/logic/careerEmails";

export interface HomeCareerPreview {
  team?: Team;
  teams: Record<string, Team>;
  phase: string;
  fixtures: CareerEmailFixture[];
  standings: CareerEmailStanding[];
}

export default function CareerPreview({ preview, loading, hasSave }: { preview: HomeCareerPreview | null; loading: boolean; hasSave: boolean }) {
  const team = preview?.team;
  const fixtures = preview?.fixtures.filter(match => match.teamA === team?.id || match.teamB === team?.id) ?? [];
  const next = fixtures.find(match => !match.played);
  const recent = fixtures.filter(match => match.played).slice(-3).reverse();
  const position = preview?.standings.findIndex(row => row.teamId === team?.id) ?? -1;
  const standing = position >= 0 ? preview?.standings[position] : undefined;
  const teamName = (id: string) => preview?.teams[id]?.shortName ?? id;
  const labelClass = "font-space-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary";

  return <section aria-label="Career preview" className="w-full max-w-2xl border-2 border-border bg-surface p-6 sm:p-8">
    <p className={labelClass}>Your career at a glance</p>
    {!preview ? <div className="py-12">
      <h2 className="font-anton text-3xl uppercase">{loading ? "Loading career..." : hasSave ? "Career preview unavailable" : "Your next chapter starts here"}</h2>
      <p className="mt-4 text-sm text-text-secondary">{loading ? "Reading your latest save." : hasSave ? "Continue your career to pick up where you left off." : "Choose a team and build your IPL legacy. Your latest career will appear here."}</p>
    </div> : <>
      <div className="mt-5 flex items-center gap-3">
        {team && <TeamBadge team={team} size="md" />}
        <h2 className="font-anton text-3xl uppercase">{team?.name ?? "Latest career"}</h2>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-5 border-y border-border py-5">
        <div><p className={labelClass}>League position</p><p className="mt-2 font-anton text-3xl">{standing && standing.played > 0 ? `${position + 1} / ${preview.standings.length}` : "—"}</p><p className="mt-1 text-xs text-text-secondary">{standing && standing.played > 0 ? `${standing.points} points · ${standing.played} played` : "Season yet to begin"}</p></div>
        <div><p className={labelClass}>Career stage</p><p className="mt-2 font-anton text-2xl uppercase">{preview.phase}</p></div>
      </div>
      <div className="py-5">
        <h3 className={labelClass}>Next match</h3>
        {next ? <><p className="mt-2 font-anton text-2xl">{teamName(next.teamA)} <span className="text-text-secondary">vs</span> {teamName(next.teamB)}</p><p className="mt-1 text-xs text-text-secondary">{next.date ? formatDisplayDate(next.date) : "Date to be confirmed"}{next.time ? ` · ${next.time}` : ""}</p></> : <p className="mt-3 text-sm text-text-secondary">{preview.phase.includes("Auction") || preview.phase === "Retentions" ? "Complete the auction to prepare for the season." : "No upcoming fixture scheduled."}</p>}
      </div>
      <div className="border-t border-border pt-5">
        <h3 className={labelClass}>Recent results</h3>
        {recent.length ? <ul className="mt-3 space-y-3">{recent.map(match => <li key={match.id} className="flex items-center justify-between gap-3 text-sm"><span>{teamName(match.teamA)} vs {teamName(match.teamB)}{match.date && <span className="ml-2 text-xs text-text-secondary">{formatDisplayDate(match.date)}</span>}</span><span className="font-space-mono text-[10px] font-bold uppercase">{match.winner === team?.id ? "Won" : match.winner && [match.teamA, match.teamB].includes(match.winner) ? "Lost" : "No result"}</span></li>)}</ul> : <p className="mt-3 text-sm text-text-secondary">No matches played this season.</p>}
      </div>
    </>}
  </section>;
}
