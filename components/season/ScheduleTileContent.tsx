"use client";

import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { dateKeyToLocalDate } from "@/lib/logic/careerCalendar";
import { PLAYOFF_TBD_TEAM_ID, LEAGUE_FIXTURE_COUNT } from "@/lib/logic/leagueSchedule";
import { appendRainAffectedResultLabel, isRainAffectedMatch } from "@/lib/logic/matchWeather";
import type { Player, Team } from "@/lib/types";

interface MatchScorecard {
  inningsA: any;
  inningsB: any;
}

interface Match {
  id: string;
  matchNumber: number;
  round: number;
  teamA: string;
  teamB: string;
  played: boolean;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  winner?: string;
  commentary?: string[];
  scorecard?: MatchScorecard;
  simulation?: any;
  date?: string;
  time?: string;
  stage?: string;
  label?: string;
  archivedResultText?: string;
}

const isRainAffected = (fixture: Match) => isRainAffectedMatch(fixture);

interface ScheduleTileContentProps {
  fixtures: Match[];
  teams: Record<string, Team>;
  userTeamId: string;
  isFixturesAnnounced: boolean;
  visibleHomeFixtureCount?: number;
  homeNextFixturesListRef?: React.Ref<HTMLDivElement>;
  variant?: "dashboard" | "overview";
}

export function PlayoffDiagramContent({
  fixtures,
  teams,
  standings,
  championTeamId,
  runnerUpTeamId,
}: {
  fixtures?: Match[];
  teams: Record<string, Team>;
  standings?: Array<{ teamId: string; teamName?: string }>;
  championTeamId?: string;
  runnerUpTeamId?: string;
}) {
  const markerSuffix = React.useId().replace(/:/g, "");
  const q2ArrowId = `arrow-q2-${markerSuffix}`;
  const finalArrowId = `arrow-final-${markerSuffix}`;
  const q1 = fixtures?.find((f) => f.stage === "qualifier1" || f.matchNumber === 71);
  const elim = fixtures?.find((f) => f.stage === "eliminator" || f.matchNumber === 72);
  const q2 = fixtures?.find((f) => f.stage === "qualifier2" || f.matchNumber === 73);
  const finalMatch = fixtures?.find((f) => f.stage === "final" || f.matchNumber === 74);

  const pos1 = standings?.[0]?.teamId;
  const pos2 = standings?.[1]?.teamId;
  const pos3 = standings?.[2]?.teamId;
  const pos4 = standings?.[3]?.teamId;

  const getTeamLabel = (teamId?: string, fallback: string = "TBD") => {
    if (!teamId || teamId === PLAYOFF_TBD_TEAM_ID) return fallback;
    return teams[teamId]?.shortName ?? teamId;
  };
  const getResultDescriptor = (match?: Match) => {
    // Older career archives did not always retain the `played` flag, but a
    // recorded winner is sufficient proof that the knockout was completed.
    if (!match?.winner) return null;
    const loserId = match.teamA === match.winner ? match.teamB : match.teamA;
    const winner = getTeamLabel(match.winner);
    const loser = getTeamLabel(loserId);
    const archivedResult = Array.isArray(match.commentary)
      ? [...match.commentary].reverse().find((line) => /\bwon\b/i.test(line))
      : undefined;
    const savedResult = (match.simulation?.resultText as string | undefined)
      ?? match.archivedResultText
      ?? archivedResult;
    if (savedResult) {
      const margin = savedResult.match(/\bwon\s+(.+)$/i)?.[1];
      if (margin) return appendRainAffectedResultLabel(`${winner} beat ${loser} ${margin}`, isRainAffected(match));
    }
    if (match.scoreA && match.scoreB) {
      const margin = Math.abs(match.scoreA.runs - match.scoreB.runs);
      return appendRainAffectedResultLabel(
        `${winner} beat ${loser}${margin > 0 ? ` by ${margin} run${margin === 1 ? "" : "s"}` : ""}`,
        isRainAffected(match),
      );
    }
    return appendRainAffectedResultLabel(`${winner} beat ${loser}`, isRainAffected(match));
  };

  const q1TeamA = q1?.teamA ?? pos1;
  const q1TeamB = q1?.teamB ?? pos2;
  const elimTeamA = elim?.teamA ?? pos3;
  const elimTeamB = elim?.teamB ?? pos4;
  const q1Loser = q1?.winner
    ? (q1TeamA === q1.winner ? q1TeamB : q1TeamA)
    : undefined;
  const eliminatorWinner = elim?.winner;
  const q2TeamA = q2?.teamA && q2.teamA !== PLAYOFF_TBD_TEAM_ID ? q2.teamA : q1Loser;
  const q2TeamB = q2?.teamB && q2.teamB !== PLAYOFF_TBD_TEAM_ID ? q2.teamB : eliminatorWinner;
  const finalTeamA = finalMatch?.teamA ?? championTeamId;
  const finalTeamB = finalMatch?.teamB ?? runnerUpTeamId;

  return (
    <div className="flex flex-1 min-h-0 flex-col space-y-3">
      <div className="flex items-center justify-between border-b border-[#16130f]/10 pb-1.5">
        <span className="font-anton text-[17px] uppercase text-text-primary">PLAYOFF BRACKET</span>
      </div>

      <div className="relative w-full overflow-x-auto py-1">
        <div className="relative grid grid-cols-[1fr_2rem_1fr_2rem_1fr] items-center min-w-[500px] gap-0 text-[10px]">
          {/* Q1 winner travels directly to the Final on its own top route. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[27px] z-20 h-2"
            style={{
              left: "calc((100% - 4rem) / 3)",
              width: "calc((100% - 4rem) / 3 + 4rem)",
            }}
          >
            <span className="absolute left-0 right-[7px] top-1/2 h-[1.5px] -translate-y-1/2 bg-accent" />
            <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-l-[7px] border-y-transparent border-l-accent" />
          </div>
          
          {/* COLUMN 1: Qualifier 1 (top) & Eliminator (bottom) */}
          <div className="relative z-10 flex flex-col justify-between space-y-5">
            {/* Qualifier 1 */}
            <div className={`rounded-md border p-2 flex flex-col justify-between shadow-sm ${q1?.played || (championTeamId && runnerUpTeamId) ? "border-border bg-black/5 dark:bg-white/5" : "border-accent/40 bg-accent/10"}`}>
              <div className="mb-1 flex items-start justify-between gap-2 font-barlow-condensed text-[12px] font-extrabold uppercase tracking-wide text-accent">
                <span className="shrink-0">Qualifier 1</span>
                  {getResultDescriptor(q1) && (
                  <span className="min-w-0 truncate text-right font-space-mono text-[10px] font-bold normal-case tracking-normal text-success">{getResultDescriptor(q1)}</span>
                )}
              </div>
              <div className="space-y-1 font-space-mono text-[10px]">
                <div className={`flex justify-between items-center ${q1?.winner ? (q1.winner === q1TeamA ? "font-bold text-text-primary" : "text-text-secondary") : "text-text-primary font-medium"}`}>
                  <span className="truncate">{getTeamLabel(q1TeamA, "1st")}</span>
                  <span>{q1?.scoreA ? `${q1.scoreA.runs}/${q1.scoreA.wickets}` : "-"}</span>
                </div>
                <div className={`flex justify-between items-center ${q1?.winner ? (q1.winner === q1TeamB ? "font-bold text-text-primary" : "text-text-secondary") : "text-text-primary font-medium"}`}>
                  <span className="truncate">{getTeamLabel(q1TeamB, "2nd")}</span>
                  <span>{q1?.scoreB ? `${q1.scoreB.runs}/${q1.scoreB.wickets}` : "-"}</span>
                </div>
              </div>
            </div>

            {/* Eliminator */}
            <div className={`rounded-md border p-2 flex flex-col justify-between shadow-sm ${elim?.played || (championTeamId && runnerUpTeamId) ? "border-border bg-black/5 dark:bg-white/5" : "border-accent/40 bg-accent/10"}`}>
              <div className="mb-1 flex items-start justify-between gap-2 font-barlow-condensed text-[12px] font-extrabold uppercase tracking-wide text-accent">
                <span className="shrink-0">Eliminator</span>
                {getResultDescriptor(elim) && (
                  <span className="min-w-0 truncate text-right font-space-mono text-[10px] font-bold normal-case tracking-normal text-success">{getResultDescriptor(elim)}</span>
                )}
              </div>
              <div className="space-y-1 font-space-mono text-[10px]">
                <div className={`flex justify-between items-center ${elim?.winner ? (elim.winner === elimTeamA ? "font-bold text-text-primary" : "text-text-secondary") : "text-text-primary font-medium"}`}>
                  <span className="truncate">{getTeamLabel(elimTeamA, "3rd")}</span>
                  <span>{elim?.scoreA ? `${elim.scoreA.runs}/${elim.scoreA.wickets}` : "-"}</span>
                </div>
                <div className={`flex justify-between items-center ${elim?.winner ? (elim.winner === elimTeamB ? "font-bold text-text-primary" : "text-text-secondary") : "text-text-primary font-medium"}`}>
                  <span className="truncate">{getTeamLabel(elimTeamB, "4th")}</span>
                  <span>{elim?.scoreB ? `${elim.scoreB.runs}/${elim.scoreB.wickets}` : "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ARROWS: Col 1 -> Col 2 (Q1 & Elim -> Q2) */}
          <div className="relative h-full flex items-center justify-center">
            <svg className="w-full h-full min-h-[140px] overflow-visible text-accent" fill="none" viewBox="0 0 32 140">
              <defs>
                <marker id={q2ArrowId} viewBox="0 0 7 8" refX="7" refY="4" markerWidth="7" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M 0 0 L 7 4 L 0 8 Z" fill="currentColor" />
                </marker>
              </defs>
              {/* Q1 Loser -> Q2 Top Slot */}
              <path d="M 0 30 H 15 V 55 H 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" markerEnd={`url(#${q2ArrowId})`} />
              {/* Elim Winner -> Q2 Bottom Slot */}
              <path d="M 0 110 H 15 V 85 H 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" markerEnd={`url(#${q2ArrowId})`} />
            </svg>
          </div>

          {/* COLUMN 2: Qualifier 2 */}
          <div className="relative z-10 flex flex-col justify-center my-auto">
            <div className={`rounded-md border p-2 flex flex-col justify-between shadow-sm ${q2?.played || (championTeamId && runnerUpTeamId) ? "border-border bg-black/5 dark:bg-white/5" : "border-accent/40 bg-accent/10"}`}>
              <div className="mb-1 flex items-start justify-between gap-2 font-barlow-condensed text-[12px] font-extrabold uppercase tracking-wide text-accent">
                <span className="shrink-0">Qualifier 2</span>
                {getResultDescriptor(q2) && (
                  <span className="min-w-0 truncate text-right font-space-mono text-[10px] font-bold normal-case tracking-normal text-success">{getResultDescriptor(q2)}</span>
                )}
              </div>
              <div className="space-y-1 font-space-mono text-[10px]">
                <div className={`flex justify-between items-center ${q2?.winner ? (q2.winner === q2TeamA ? "font-bold text-text-primary" : "text-text-secondary") : "text-text-primary font-medium"}`}>
                  <span className="truncate">{getTeamLabel(q2TeamA, "Q1 Loser")}</span>
                  <span>{q2?.scoreA ? `${q2.scoreA.runs}/${q2.scoreA.wickets}` : "-"}</span>
                </div>
                <div className={`flex justify-between items-center ${q2?.winner ? (q2.winner === q2TeamB ? "font-bold text-text-primary" : "text-text-secondary") : "text-text-primary font-medium"}`}>
                  <span className="truncate">{getTeamLabel(q2TeamB, "Elim Winner")}</span>
                  <span>{q2?.scoreB ? `${q2.scoreB.runs}/${q2.scoreB.wickets}` : "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ARROWS: Col 2 -> Col 3 (Q2 Winner -> Final) */}
          <div className="relative h-full flex items-center justify-center">
            <svg className="w-full h-full min-h-[140px] overflow-visible text-accent" fill="none" viewBox="0 0 32 140">
              <defs>
                <marker id={finalArrowId} viewBox="0 0 7 8" refX="7" refY="4" markerWidth="7" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M 0 0 L 7 4 L 0 8 Z" fill="currentColor" />
                </marker>
              </defs>
              {/* Q2 Winner -> Final */}
              <path d="M 0 70 H 15 V 30 H 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" markerEnd={`url(#${finalArrowId})`} />
            </svg>
          </div>

          {/* COLUMN 3: Final */}
          <div className="relative z-10 flex h-full flex-col justify-start">
            <div className={`rounded-md border-2 border-amber-500/60 bg-amber-500/10 p-2 shadow-md`}>
              <div className="mb-1 flex items-center justify-between font-barlow-condensed text-[12px] font-extrabold uppercase tracking-wide text-amber-500">
                <span>FINAL</span>
                {getResultDescriptor(finalMatch) && (
                  <span className="min-w-0 truncate text-right font-space-mono text-[10px] font-bold normal-case tracking-normal text-amber-400">
                    {getResultDescriptor(finalMatch)}
                  </span>
                )}
              </div>
              <div className="space-y-1 font-space-mono text-[10px]">
                <div className={`flex justify-between items-center ${championTeamId && championTeamId === finalTeamA ? "font-bold text-amber-400" : "text-text-secondary"}`}>
                  <span className="truncate">{getTeamLabel(finalTeamA, "Q1 Winner")} {championTeamId && championTeamId === finalTeamA ? "🏆" : ""}</span>
                  <span>{finalMatch?.scoreA ? `${finalMatch.scoreA.runs}/${finalMatch.scoreA.wickets}` : "-"}</span>
                </div>
                <div className={`flex justify-between items-center ${championTeamId && championTeamId === finalTeamB ? "font-bold text-amber-400" : "text-text-secondary"}`}>
                  <span className="truncate">{getTeamLabel(finalTeamB, "Q2 Winner")} {championTeamId && championTeamId === finalTeamB ? "🏆" : ""}</span>
                  <span>{finalMatch?.scoreB ? `${finalMatch.scoreB.runs}/${finalMatch.scoreB.wickets}` : "-"}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export function ChampionTileContent({
  finalFixture,
  teams,
  showRunnerUp = true,
}: {
  finalFixture: Match;
  teams: Record<string, Team>;
  showRunnerUp?: boolean;
}) {
  const champion = teams[finalFixture.winner ?? ""];
  const runnerUpId = finalFixture.teamA === finalFixture.winner ? finalFixture.teamB : finalFixture.teamA;
  const runnerUp = teams[runnerUpId];

  return (
    <div className="flex flex-1 min-h-0 flex-col justify-between rounded-md border border-amber-500/40 bg-gradient-to-b from-amber-500/20 via-surface to-surface p-3 text-center">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
        <span className="font-anton text-[13px] uppercase text-amber-500 tracking-wider">IPL CHAMPIONS</span>
        <span className="font-space-mono text-[8px] font-bold text-text-secondary uppercase">Season Complete</span>
      </div>

      <div className="my-auto flex flex-col items-center justify-center space-y-1.5 py-2">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full font-anton text-base shadow-md border-2 border-white/30"
          style={{ backgroundColor: champion?.primaryColor ?? "#E59B2A", color: champion?.secondaryColor ?? "#FFFFFF" }}
        >
          {champion?.shortName ?? "CHAMP"}
        </div>
        <div className="font-anton text-[20px] uppercase leading-none text-text-primary tracking-wide">{champion?.name ?? "Champions"}</div>
        {finalFixture.simulation?.resultText && (
          <div className="font-space-mono text-[8.5px] font-bold tracking-[-0.03em] text-accent">
            {appendRainAffectedResultLabel(finalFixture.simulation.resultText, isRainAffected(finalFixture))}
          </div>
        )}
      </div>

      {showRunnerUp && runnerUp && (
        <div className="rounded border border-border/40 bg-black/5 p-1.5 text-[8.5px] font-space-mono text-text-secondary dark:bg-white/5">
          Runner-up: <span className="font-bold text-text-primary">{runnerUp.name}</span>
        </div>
      )}
    </div>
  );
}

function PlayoffFixturesContent({
  fixtures,
  teams,
  showDateTime,
}: {
  fixtures: Match[];
  teams: Record<string, Team>;
  showDateTime: boolean;
}) {
  const playoffFixtures = fixtures
    .filter((fixture) => Boolean(fixture.stage) || (fixture.matchNumber >= 71 && fixture.matchNumber <= 74))
    .sort((left, right) => left.matchNumber - right.matchNumber)
    .slice(0, 4);
  const teamLabel = (teamId: string) => (
    teamId === PLAYOFF_TBD_TEAM_ID
      ? "TBD"
      : teams[teamId]?.shortName ?? teamId
  );
  const stageLabel = (fixture: Match) => {
    if (fixture.stage === "qualifier1" || fixture.matchNumber === 71) return "Qualifier 1";
    if (fixture.stage === "eliminator" || fixture.matchNumber === 72) return "Eliminator";
    if (fixture.stage === "qualifier2" || fixture.matchNumber === 73) return "Qualifier 2";
    if (fixture.stage === "final" || fixture.matchNumber === 74) return "Final";
    return fixture.label ?? `Match ${fixture.matchNumber}`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 flex-col items-center justify-center border-b border-[#16130f]/10 pb-2 text-center">
        <h4 className="font-anton text-[16px] uppercase">Playoff Fixtures</h4>
        <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">4 matches</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-4 gap-1.5">
        {playoffFixtures.map((fixture) => {
          const fixtureDate = fixture.date ? dateKeyToLocalDate(fixture.date) : null;
          return (
            <div
              key={fixture.id}
              className={`flex min-h-0 flex-col items-center justify-center gap-0.5 rounded border px-2 py-1.5 text-center ${
                fixture.played
                  ? "border-border/60 bg-black/[0.025] dark:bg-white/[0.04]"
                  : "border-accent/35 bg-accent/[0.07]"
              }`}
            >
              <div className="min-w-0 max-w-full">
                <div className="truncate font-barlow-condensed text-[11px] font-extrabold uppercase text-accent">
                  {stageLabel(fixture)}
                </div>
                {showDateTime && (
                  <div className="truncate font-space-mono text-[7px] uppercase text-text-secondary">
                    {fixtureDate?.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) ?? "Date TBD"}
                    {" · "}{fixture.time ?? "TBD"}
                  </div>
                )}
              </div>
              <div className="w-full truncate text-center font-space-mono text-[10px] font-bold uppercase text-text-primary">
                {teamLabel(fixture.teamA)} <span className="text-text-secondary">vs</span> {teamLabel(fixture.teamB)}
              </div>
              <div className="font-space-mono text-[8px] font-bold uppercase">
                {fixture.played && fixture.scoreA && fixture.scoreB
                  ? (
                      <span className="text-success">
                        {fixture.scoreA.runs}/{fixture.scoreA.wickets}
                        {" · "}
                        {fixture.scoreB.runs}/{fixture.scoreB.wickets}
                      </span>
                    )
                  : <span className="text-text-secondary">Upcoming</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HomePlayoffFixturesContent({
  fixtures,
  teams,
}: {
  fixtures: Match[];
  teams: Record<string, Team>;
}) {
  const playoffFixtures = fixtures
    .filter((fixture) => Boolean(fixture.stage) || (fixture.matchNumber >= 71 && fixture.matchNumber <= 74))
    .sort((left, right) => left.matchNumber - right.matchNumber)
    .slice(0, 4);
  const label = (fixture: Match) => fixture.stage === "qualifier1" || fixture.matchNumber === 71 ? "Q1"
    : fixture.stage === "eliminator" || fixture.matchNumber === 72 ? "ELIM"
      : fixture.stage === "qualifier2" || fixture.matchNumber === 73 ? "Q2" : "FINAL";
  const teamLabel = (id: string) => id === PLAYOFF_TBD_TEAM_ID ? "TBD" : teams[id]?.shortName ?? id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between border-b border-[#16130f]/10 pb-2">
        <h4 className="font-anton text-[16px] uppercase">PLAYOFF FIXTURES</h4>
        <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">4 matches</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-4 gap-1">
        {playoffFixtures.map((fixture) => (
          <div key={fixture.id} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-1 rounded border border-border/50 bg-black/[0.025] px-2 py-1 dark:bg-white/[0.04]">
            <span className="font-space-mono text-[9px] font-extrabold text-accent">{label(fixture)}</span>
            <span className="truncate text-center font-space-mono text-[9px] font-bold uppercase text-text-primary">
              {teamLabel(fixture.teamA)} <span className="text-text-secondary">v</span> {teamLabel(fixture.teamB)}
            </span>
            <span className="font-space-mono text-[8px] font-bold text-text-secondary">
              {fixture.played && fixture.scoreA && fixture.scoreB ? `${fixture.scoreA.runs}/${fixture.scoreA.wickets} · ${fixture.scoreB.runs}/${fixture.scoreB.wickets}` : "TBD"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleTileContent({
  fixtures,
  teams,
  userTeamId,
  isFixturesAnnounced,
  visibleHomeFixtureCount = 5,
  homeNextFixturesListRef,
  variant = "dashboard",
}: ScheduleTileContentProps) {
  const finalFixture = fixtures.find((f) => f.stage === "final" || f.matchNumber === 74);
  const isChampionDecided = Boolean(finalFixture?.played && finalFixture?.winner);
  const leagueFixtures = fixtures.filter((f) => !f.stage && f.matchNumber <= 70);
  const isLeagueComplete = leagueFixtures.length > 0 && leagueFixtures.every((f) => f.played);

  if (isChampionDecided && finalFixture) {
    return (
      <ChampionTileContent
        finalFixture={finalFixture}
        teams={teams}
        showRunnerUp={variant !== "dashboard"}
      />
    );
  }

  if (isLeagueComplete) {
    if (variant === "overview") {
      return (
        <PlayoffFixturesContent
          fixtures={fixtures}
          teams={teams}
          showDateTime
        />
      );
    }
    return (
      <HomePlayoffFixturesContent
        fixtures={fixtures}
        teams={teams}
      />
    );
  }

  if (variant === "overview") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex shrink-0 items-end justify-between border-b border-[#16130f]/10 pb-2">
          <h4 className="font-anton text-[16px] uppercase">SEASON SCHEDULE</h4>
          {isFixturesAnnounced && (
            <span className="font-space-mono text-[9px] font-bold uppercase text-text-secondary">
              {fixtures.filter((fixture) => !fixture.stage && fixture.played).length}/{LEAGUE_FIXTURE_COUNT} league matches played
            </span>
          )}
        </div>
        {isFixturesAnnounced ? (
          (() => {
            const upcomingFixtures = fixtures
              .filter((fixture) => !fixture.played)
              .sort((left, right) => (left.date ?? "").localeCompare(right.date ?? "") || (left.time ?? "").localeCompare(right.time ?? ""))
              .slice(0, 5);

            if (upcomingFixtures.length === 0) {
              return (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                  <Check size={20} className="mb-2 text-success" />
                  <p className="font-anton text-sm uppercase text-text-primary">Schedule complete</p>
                  <p className="mt-1 text-xs text-text-secondary">No upcoming league fixtures.</p>
                </div>
              );
            }

            return (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-2 shrink-0 text-center">
                  <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">Next league fixtures</span>
                </div>
                <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateRows: `repeat(${upcomingFixtures.length}, minmax(0, 1fr))` }}>
                  {upcomingFixtures.map((fixture) => {
                    const teamA = teams[fixture.teamA];
                    const teamB = teams[fixture.teamB];
                    const userTeam = teams[userTeamId];
                    const involvesUser = fixture.teamA === userTeamId || fixture.teamB === userTeamId;
                    const fixtureDate = fixture.date ? dateKeyToLocalDate(fixture.date) : null;

                    return (
                      <div
                        key={fixture.id}
                        className="flex min-h-0 flex-col justify-center border border-border px-2.5 py-2 text-center"
                        style={involvesUser && userTeam ? {
                          backgroundColor: `${userTeam.primaryColor}38`,
                          borderColor: userTeam.primaryColor,
                          boxShadow: `inset 4px 0 0 ${userTeam.primaryColor}, inset -4px 0 0 ${userTeam.primaryColor}`,
                        } : undefined}
                      >
                        <div className="truncate font-space-mono text-[11px] font-medium uppercase text-text-secondary">
                          {fixtureDate?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) ?? "Date TBD"}
                          {" · "}{fixture.time ?? "Time TBD"}{" · "}Match {fixture.matchNumber}
                        </div>
                        <div className="my-1.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 font-anton text-[16px] uppercase leading-none text-text-primary">
                          <span className="flex min-w-0 items-center justify-end gap-1.5 truncate px-1 py-1 text-right">
                            <span className="truncate">{teamA?.shortName ?? fixture.teamA}</span>
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: teamA?.primaryColor ?? "#777777" }} />
                          </span>
                          <span className="font-space-mono text-[10px] font-bold text-text-secondary">VS</span>
                          <span className="flex min-w-0 items-center gap-1.5 truncate px-1 py-1 text-left">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: teamB?.primaryColor ?? "#777777" }} />
                            <span className="truncate">{teamB?.shortName ?? fixture.teamB}</span>
                          </span>
                        </div>
                        <div className="truncate font-space-mono text-[11px] font-medium uppercase text-text-secondary">
                          {fixture.simulation?.conditions?.stadiumName ?? teamA?.homeGround ?? "Stadium TBD"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 shrink-0 border-t border-[#16130f]/10 pt-2 text-right font-space-mono text-[9px] font-bold uppercase text-accent">View full schedule →</div>
              </div>
            );
          })()
        ) : (
          <div className="font-space-mono text-[9px] text-text-secondary space-y-2">
            <span className="font-bold text-accent uppercase block font-space-mono text-[10px] bg-accent/10 py-0.5 px-1.5 rounded w-max">Announcing soon</span>
            <p className="font-barlow text-xs text-text-secondary">Fixtures will be announced soon.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <h3 className="shrink-0 font-anton text-[14px] uppercase text-text-primary border-b border-[#16130f]/10 pb-2 mb-3">NEXT FIXTURES</h3>
      {!isFixturesAnnounced ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-center font-space-mono text-xs uppercase text-text-secondary">
          Fixtures not yet announced
        </div>
      ) : (
        <div ref={homeNextFixturesListRef} className="min-h-0 flex-1 overflow-hidden">
          {(() => {
            const userFixtures = fixtures
              .filter((fixture) => (
                !fixture.played
                && (fixture.teamA === userTeamId || fixture.teamB === userTeamId)
              ))
              .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.round - b.round);

            if (userFixtures.length === 0) {
              return (
                <div className="flex h-full items-center justify-center text-center font-space-mono text-xs uppercase text-text-secondary">
                  No upcoming fixtures
                </div>
              );
            }

            return userFixtures.slice(0, visibleHomeFixtureCount).map((fixture, index) => {
              const opponentId = fixture.teamA === userTeamId ? fixture.teamB : fixture.teamA;
              const opponent = teams[opponentId];
              const fixtureDate = fixture.date ? dateKeyToLocalDate(fixture.date) : null;
              const isNextFixture = index === 0;

              return (
                <div
                  key={`next-fixture-${fixture.id}`}
                  className={`grid h-6 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#16130f]/10 px-1.5 text-text-primary ${isNextFixture ? "bg-accent/15 ring-1 ring-inset ring-accent/30" : ""}`}
                >
                  <div className="flex flex-col items-center justify-center leading-none">
                    <span className="font-space-mono text-[14px] font-bold">{fixtureDate?.getDate() ?? "-"}</span>
                    <span className="mt-0.5 font-space-mono text-[7px] uppercase text-text-secondary">
                      {fixtureDate?.toLocaleDateString("en-GB", { month: "short" }) ?? ""}
                    </span>
                  </div>
                  <span className="truncate text-[10px] font-medium">vs {opponent?.shortName ?? opponentId}</span>
                  <span className="font-space-mono text-[8px] font-bold uppercase text-text-secondary">
                    {fixture.teamA === userTeamId ? "Home" : "Away"}
                  </span>
                </div>
              );
            });
          })()}
        </div>
      )}
    </>
  );
}
