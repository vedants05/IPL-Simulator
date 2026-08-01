"use client";

import { useState } from "react";
import { X, Award, MapPin, Calendar, Clock, Shield } from "lucide-react";

import BallByBallSummary from "@/components/match/BallByBallSummary";
import type { MatchSimulationRecord, MatchInnings } from "@/lib/logic/matchSimulation";
import type { Player, Team } from "@/lib/types";

export interface UnifiedMatchRecord {
  id: string;
  matchNumber: number;
  teamA: string;
  teamB: string;
  played: boolean;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  winner?: string;
  commentary?: string[];
  scorecard?: {
    inningsA?: {
      batting?: Array<{ id?: string; name: string; runs?: number; balls?: number; fours?: number; sixes?: number; dismissal?: string; notOut?: boolean }>;
      bowling?: Array<{ id?: string; name: string; overs?: number; maidens?: number; runsConceded?: number; wickets?: number }>;
    };
    inningsB?: {
      batting?: Array<{ id?: string; name: string; runs?: number; balls?: number; fours?: number; sixes?: number; dismissal?: string; notOut?: boolean }>;
      bowling?: Array<{ id?: string; name: string; overs?: number; maidens?: number; runsConceded?: number; wickets?: number }>;
    };
  };
  simulation?: MatchSimulationRecord;
  date?: string;
  time?: string;
  stage?: string;
  label?: string;
  archivedResultText?: string;
}

interface MatchScorecardModalProps {
  match: UnifiedMatchRecord | null;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  isOpen: boolean;
  onClose: () => void;
}

function safeNum(val: number | undefined | null, fallback = 0): number {
  if (val === undefined || val === null || Number.isNaN(val)) return fallback;
  return val;
}

function formatNum(val: number | undefined | null, decimals = 1): string {
  const num = safeNum(val, 0);
  return num.toFixed(decimals);
}

export default function MatchScorecardModal({
  match,
  teams,
  players,
  isOpen,
  onClose,
}: MatchScorecardModalProps) {
  const [activeTab, setActiveTab] = useState<"scorecard" | "ballbyball" | "info">("scorecard");
  const [selectedInningsIndex, setSelectedInningsIndex] = useState<0 | 1>(0);

  if (!isOpen || !match) return null;

  const teamA = teams[match.teamA];
  const teamB = teams[match.teamB];
  const sim = match.simulation;

  // Normalized innings resolution: prefers simulation, falls back to legacy scorecard format
  let inningsList: Array<{
    inningsNumber: number;
    battingTeamId: string;
    bowlingTeamId: string;
    runs: number;
    wickets: number;
    overs: number;
    batting: Array<{
      playerId: string;
      name: string;
      dismissal?: string;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      strikeRate: number;
    }>;
    bowling: Array<{
      playerId: string;
      name: string;
      overs: number;
      maidens: number;
      runsConceded: number;
      wickets: number;
      economy: number;
    }>;
  }> = [];

  if (sim?.innings && sim.innings.length > 0) {
    inningsList = sim.innings.map((inn) => ({
      inningsNumber: inn.inningsNumber,
      battingTeamId: inn.battingTeamId,
      bowlingTeamId: inn.bowlingTeamId,
      runs: safeNum(inn.runs),
      wickets: safeNum(inn.wickets),
      overs: safeNum(inn.overs),
      batting: (inn.batting ?? []).map((b) => ({
        playerId: b.id ?? b.name,
        name: b.name,
        dismissal: b.dismissal,
        runs: safeNum(b.runs),
        balls: safeNum(b.balls),
        fours: safeNum(b.fours),
        sixes: safeNum(b.sixes),
        strikeRate: b.balls ? (safeNum(b.runs) / Math.max(1, b.balls)) * 100 : 0,
      })),
      bowling: (inn.bowling ?? []).map((bw) => ({
        playerId: bw.id ?? bw.name,
        name: bw.name,
        overs: safeNum(bw.overs),
        maidens: safeNum(bw.maidens),
        runsConceded: safeNum(bw.runsConceded),
        wickets: safeNum(bw.wickets),
        economy: bw.overs ? (safeNum(bw.runsConceded) * 6) / Math.max(1, bw.balls) : 0,
      })),
    }));
  } else if (match.scorecard) {
    const sc = match.scorecard;
    if (sc.inningsA) {
      inningsList.push({
        inningsNumber: 1,
        battingTeamId: match.teamA,
        bowlingTeamId: match.teamB,
        runs: safeNum(match.scoreA?.runs),
        wickets: safeNum(match.scoreA?.wickets),
        overs: safeNum(match.scoreA?.overs),
        batting: (sc.inningsA.batting ?? []).map((b) => ({
          playerId: b.id ?? b.name,
          name: b.name,
          dismissal: b.dismissal ?? (b.notOut ? "not out" : "out"),
          runs: safeNum(b.runs),
          balls: safeNum(b.balls),
          fours: safeNum(b.fours),
          sixes: safeNum(b.sixes),
          strikeRate: b.balls ? (safeNum(b.runs) / Math.max(1, b.balls)) * 100 : 0,
        })),
        bowling: (sc.inningsA.bowling ?? []).map((bw) => ({
          playerId: bw.id ?? bw.name,
          name: bw.name,
          overs: safeNum(bw.overs),
          maidens: safeNum(bw.maidens),
          runsConceded: safeNum(bw.runsConceded),
          wickets: safeNum(bw.wickets),
          economy: bw.overs ? safeNum(bw.runsConceded) / Math.max(0.1, bw.overs) : 0,
        })),
      });
    }
    if (sc.inningsB) {
      inningsList.push({
        inningsNumber: 2,
        battingTeamId: match.teamB,
        bowlingTeamId: match.teamA,
        runs: safeNum(match.scoreB?.runs),
        wickets: safeNum(match.scoreB?.wickets),
        overs: safeNum(match.scoreB?.overs),
        batting: (sc.inningsB.batting ?? []).map((b) => ({
          playerId: b.id ?? b.name,
          name: b.name,
          dismissal: b.dismissal ?? (b.notOut ? "not out" : "out"),
          runs: safeNum(b.runs),
          balls: safeNum(b.balls),
          fours: safeNum(b.fours),
          sixes: safeNum(b.sixes),
          strikeRate: b.balls ? (safeNum(b.runs) / Math.max(1, b.balls)) * 100 : 0,
        })),
        bowling: (sc.inningsB.bowling ?? []).map((bw) => ({
          playerId: bw.id ?? bw.name,
          name: bw.name,
          overs: safeNum(bw.overs),
          maidens: safeNum(bw.maidens),
          runsConceded: safeNum(bw.runsConceded),
          wickets: safeNum(bw.wickets),
          economy: bw.overs ? safeNum(bw.runsConceded) / Math.max(0.1, bw.overs) : 0,
        })),
      });
    }
  }

  const currentInnings = inningsList[selectedInningsIndex] ?? inningsList[0] ?? null;

  const resultText =
    sim?.resultText ??
    match.archivedResultText ??
    (match.winner && match.winner !== "TIE"
      ? `${teams[match.winner]?.name ?? match.winner} won`
      : match.played
      ? "Match Completed"
      : "Upcoming Match");

  const potmPlayer = sim?.playerOfTheMatchId
    ? players[sim.playerOfTheMatchId] ?? { name: sim.playerOfTheMatchName }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        {/* Top Header */}
        <div className="relative border-b border-border bg-bg px-6 py-4">
          <button
            onClick={onClose}
            type="button"
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-surface-elevated text-text-secondary hover:bg-border hover:text-text-primary"
            aria-label="Close match details"
          >
            <X size={18} />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4 pr-10">
            <div>
              <span className="font-space-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                {match.label || `Match ${match.matchNumber}`} {match.stage ? `· ${match.stage.toUpperCase()}` : ""}
              </span>
              <h3 className="mt-0.5 font-anton text-2xl uppercase tracking-wide text-text-primary">
                {teamA?.shortName ?? match.teamA} <span className="text-text-secondary">vs</span> {teamB?.shortName ?? match.teamB}
              </h3>
            </div>

            {match.played && (
              <div className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-2 text-right">
                <div>
                  <div className="font-space-mono text-[9px] font-bold text-text-secondary uppercase">
                    {teamA?.shortName ?? match.teamA}
                  </div>
                  <div className="font-anton text-lg text-text-primary">
                    {match.scoreA ? `${safeNum(match.scoreA.runs)}/${safeNum(match.scoreA.wickets)}` : "N/A"}
                  </div>
                </div>
                <div className="font-space-mono text-xs font-bold text-text-secondary">VS</div>
                <div>
                  <div className="font-space-mono text-[9px] font-bold text-text-secondary uppercase">
                    {teamB?.shortName ?? match.teamB}
                  </div>
                  <div className="font-anton text-lg text-text-primary">
                    {match.scoreB ? `${safeNum(match.scoreB.runs)}/${safeNum(match.scoreB.wickets)}` : "N/A"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Result & POTM Banner */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-accent/10 px-3.5 py-2">
            <span className="font-barlow text-sm font-bold text-accent">
              🏆 {resultText}
            </span>
            {potmPlayer && (
              <div className="flex items-center gap-1.5 font-space-mono text-xs font-semibold text-text-primary">
                <Award size={14} className="text-accent" /> POTM: {potmPlayer.name}
              </div>
            )}
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-border bg-surface px-6">
          <button
            type="button"
            onClick={() => setActiveTab("scorecard")}
            className={`border-b-2 px-5 py-3 font-space-mono text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === "scorecard"
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Match Scorecard
          </button>
          {sim?.innings?.some((innings) => innings.oversDetail.length > 0) && (
            <button
              type="button"
              onClick={() => setActiveTab("ballbyball")}
              className={`border-b-2 px-5 py-3 font-space-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === "ballbyball"
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              Ball by Ball
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`border-b-2 px-5 py-3 font-space-mono text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === "info"
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Venue & Conditions
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* TAB 1: SCORECARD */}
          {activeTab === "scorecard" && (
            <div className="space-y-6">
              {inningsList.length > 0 ? (
                <>
                  {/* Innings Selector Buttons */}
                  <div className="flex gap-2">
                    {inningsList.map((inn, idx) => (
                      <button
                        key={inn.inningsNumber}
                        type="button"
                        onClick={() => setSelectedInningsIndex(idx as 0 | 1)}
                        className={`flex-1 rounded-lg border p-3 text-left transition-all ${
                          selectedInningsIndex === idx
                            ? "border-accent bg-accent/10 shadow-sm"
                            : "border-border bg-bg hover:border-text-secondary"
                        }`}
                      >
                        <div className="font-space-mono text-[9px] font-bold uppercase text-text-secondary">
                          Innings {inn.inningsNumber} · {teams[inn.battingTeamId]?.shortName ?? inn.battingTeamId}
                        </div>
                        <div className="mt-1 font-anton text-xl text-text-primary">
                          {inn.runs}/{inn.wickets} <span className="font-space-mono text-xs text-text-secondary">({formatNum(inn.overs, 1)} ov)</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {currentInnings && (
                    <div className="space-y-6">
                      {/* Batting Card */}
                      <div className="overflow-hidden rounded-lg border border-border bg-bg">
                        <div className="border-b border-border bg-surface px-4 py-2.5 font-space-mono text-xs font-bold uppercase text-text-primary">
                          Batting — {teams[currentInnings.battingTeamId]?.name ?? currentInnings.battingTeamId}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-barlow text-sm">
                            <thead className="border-b border-border bg-surface-elevated font-space-mono text-[10px] font-bold uppercase text-text-secondary">
                              <tr>
                                <th className="px-4 py-2">Batter</th>
                                <th className="px-4 py-2">Dismissal</th>
                                <th className="px-4 py-2 text-right">R</th>
                                <th className="px-4 py-2 text-right">B</th>
                                <th className="px-4 py-2 text-right">4s</th>
                                <th className="px-4 py-2 text-right">6s</th>
                                <th className="px-4 py-2 text-right">SR</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {currentInnings.batting.map((entry, idx) => (
                                <tr key={entry.playerId || idx} className="hover:bg-surface/50">
                                  <td className="px-4 py-2.5 font-bold text-text-primary">
                                    {entry.name}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                                    {entry.dismissal ?? "not out"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-text-primary">{entry.runs}</td>
                                  <td className="px-4 py-2.5 text-right text-text-secondary">{entry.balls}</td>
                                  <td className="px-4 py-2.5 text-right text-text-secondary">{entry.fours}</td>
                                  <td className="px-4 py-2.5 text-right text-text-secondary">{entry.sixes}</td>
                                  <td className="px-4 py-2.5 text-right font-space-mono text-xs text-text-primary">
                                    {formatNum(entry.strikeRate, 1)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Bowling Card */}
                      <div className="overflow-hidden rounded-lg border border-border bg-bg">
                        <div className="border-b border-border bg-surface px-4 py-2.5 font-space-mono text-xs font-bold uppercase text-text-primary">
                          Bowling — {teams[currentInnings.bowlingTeamId]?.name ?? currentInnings.bowlingTeamId}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-barlow text-sm">
                            <thead className="border-b border-border bg-surface-elevated font-space-mono text-[10px] font-bold uppercase text-text-secondary">
                              <tr>
                                <th className="px-4 py-2">Bowler</th>
                                <th className="px-4 py-2 text-right">O</th>
                                <th className="px-4 py-2 text-right">M</th>
                                <th className="px-4 py-2 text-right">R</th>
                                <th className="px-4 py-2 text-right">W</th>
                                <th className="px-4 py-2 text-right">Econ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {currentInnings.bowling.map((entry, idx) => (
                                <tr key={entry.playerId || idx} className="hover:bg-surface/50">
                                  <td className="px-4 py-2.5 font-bold text-text-primary">{entry.name}</td>
                                  <td className="px-4 py-2.5 text-right text-text-secondary">{entry.overs}</td>
                                  <td className="px-4 py-2.5 text-right text-text-secondary">{entry.maidens}</td>
                                  <td className="px-4 py-2.5 text-right text-text-secondary">{entry.runsConceded}</td>
                                  <td className="px-4 py-2.5 text-right font-bold text-accent">{entry.wickets}</td>
                                  <td className="px-4 py-2.5 text-right font-space-mono text-xs text-text-primary">
                                    {formatNum(entry.economy, 2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 text-center text-text-secondary font-barlow">
                  No detailed scorecard payload available for this match.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BALL BY BALL */}
          {activeTab === "ballbyball" && sim && (
            <BallByBallSummary simulation={sim} teams={teams} />
          )}

          {/* TAB 3: VENUE & CONDITIONS */}
          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-bg p-4">
                  <div className="flex items-center gap-2 font-space-mono text-xs font-bold text-accent uppercase">
                    <MapPin size={16} /> Stadium & Pitch
                  </div>
                  <div className="mt-2 font-barlow text-sm text-text-primary">
                    {sim?.conditions?.stadiumName ?? teamA?.homeGround ?? "IPL Stadium"}
                  </div>
                  <div className="mt-1 font-space-mono text-xs text-text-secondary">
                    Pitch Type: {sim?.conditions?.pitchType ?? "Standard Flat"}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-bg p-4">
                  <div className="flex items-center gap-2 font-space-mono text-xs font-bold text-accent uppercase">
                    <Calendar size={16} /> Date & Time
                  </div>
                  <div className="mt-2 font-barlow text-sm text-text-primary">
                    Date: {match.date ?? "Matchday"}
                  </div>
                  <div className="mt-1 font-space-mono text-xs text-text-secondary flex items-center gap-1">
                    <Clock size={12} /> Time: {match.time ?? "19:30"} IST
                  </div>
                </div>
              </div>

              {sim?.tossWinnerId && (
                <div className="rounded-lg border border-border bg-bg p-4">
                  <div className="flex items-center gap-2 font-space-mono text-xs font-bold text-accent uppercase">
                    <Shield size={16} /> Toss Decision
                  </div>
                  <div className="mt-2 font-barlow text-sm text-text-primary">
                    {teams[sim.tossWinnerId]?.name ?? sim.tossWinnerId} won the toss and elected to {sim.tossDecision}.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
