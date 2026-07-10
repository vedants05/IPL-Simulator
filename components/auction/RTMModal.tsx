"use client";
import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { getNextBidAmount } from "@/lib/logic/auctionRules";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function RTMModal() {
  const { auction, teams, userTeamId } = useGameStore();
  const exerciseRtm = useGameStore((s) => s.exerciseRtm);
  const declineRtm = useGameStore((s) => s.declineRtm);
  const raiseCounter = useGameStore((s) => s.raiseCounter);
  const passCounter = useGameStore((s) => s.passCounter);
  const matchCounter = useGameStore((s) => s.matchCounter);
  const foldToCounter = useGameStore((s) => s.foldToCounter);
  const [counterInput, setCounterInput] = useState<number | null>(null);

  const rtm = auction?.rtm;
  if (!rtm || !auction?.currentPlayer) return null;

  const player = auction.currentPlayer;
  const { phase, originalTeamId, winnerTeamId, baseAmount, raisedAmount, timerSeconds } = rtm;
  const originalTeam = teams[originalTeamId];
  const winnerTeam = teams[winnerTeamId];
  const isUserOriginal = originalTeamId === userTeamId;
  const isUserWinner = winnerTeamId === userTeamId;

  const userTeam = teams[userTeamId];
  const rtmLeft = (userTeam?.rtmCardsTotal ?? 0) - (userTeam?.rtmCardsUsed ?? 0);  // ---- Phase: offer — user is original team ----
  if (phase === "offer" && isUserOriginal) {
    const canAfford = (userTeam?.remainingPurse ?? 0) >= baseAmount;
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-border/80 backdrop-blur-sm">
        <div
          className="border-2 border-border w-full max-w-md mx-4 shadow-2xl rounded-[8px] overflow-hidden transition-colors duration-200"
          style={{ backgroundColor: "var(--app-base-bg, var(--background))" }}
        >
          <div
            className="px-6 py-4 transition-colors duration-200"
            style={{ backgroundColor: "var(--team-cta-bg, #1d55c4)", color: "var(--team-cta-text, #ffffff)" }}
          >
            <div className="font-space-mono font-bold text-[10px] tracking-[.16em] uppercase mb-1" style={{ opacity: 0.85 }}>
              Right to Match · Your Decision
            </div>
            <h2 className="font-anton text-[32px] leading-none uppercase">{player.name}</h2>
          </div>

          <div className="px-6 py-5">
            <p className="font-barlow text-[13px] text-text-secondary mb-5">
              Sold to <span className="font-bold text-text-primary">{winnerTeam?.name}</span> for{" "}
              <span className="font-barlow-condensed font-bold text-[16px] text-danger">{crore(baseAmount)}</span>.
              {" "}This player previously played for you. Exercise RTM to match this bid.
            </p>

            <div className="flex gap-0 border-2 border-border mb-4 bg-surface2">
              {[
                { label: "RTM Cards Left", value: rtmLeft },
                { label: "Match Price", value: crore(baseAmount), highlight: true },
                { label: "Time", value: `${timerSeconds}s`, urgent: timerSeconds <= 5 },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="flex-1 flex flex-col items-center justify-center py-4"
                  style={i < 2 ? { borderRight: "2px solid var(--ink)" } : {}}
                >
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary mb-1 uppercase">{item.label}</div>
                  <div className="font-barlow-condensed font-bold text-[24px] leading-none" style={{ color: item.urgent ? "#d6492f" : "var(--ink)" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {!canAfford && (
              <div className="font-space-mono text-[10px] text-red-600 font-bold mb-3 uppercase">
                ⚠️ Insufficient purse ({crore(userTeam?.remainingPurse ?? 0)}) to match {crore(baseAmount)}.
              </div>
            )}

            <div className="font-space-mono text-[10px] text-text-secondary tracking-wider mb-4">
              Note: {winnerTeam?.shortName} may raise their bid after you RTM.
            </div>

            <div className="flex gap-3">
              <button
                onClick={exerciseRtm}
                disabled={!canAfford}
                className="flex-1 font-anton text-[18px] py-4 tracking-wide hover:brightness-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--team-cta-bg, #1d55c4)", color: "var(--team-cta-text, #ffffff)" }}
              >
                USE RTM · {crore(baseAmount)}
              </button>
              <button
                onClick={declineRtm}
                className="px-6 font-space-mono font-bold text-[12px] tracking-widest text-text-secondary border-2 border-border hover:bg-surface transition-colors"
              >
                DECLINE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Phase: winner_counter — user is winner, AI original exercised RTM ----
  if (phase === "winner_counter" && isUserWinner) {
    const minRaise = getNextBidAmount(baseAmount);
    const currentCounter = counterInput ?? minRaise;
    const canAffordCounter = (userTeam?.remainingPurse ?? 0) >= currentCounter;
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-border/80 backdrop-blur-sm">
        <div
          className="border-2 border-border w-full max-w-md mx-4 shadow-2xl rounded-[8px] overflow-hidden transition-colors duration-200"
          style={{ backgroundColor: "var(--app-base-bg, var(--background))" }}
        >
          <div className="bg-danger px-6 py-4">
            <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-white mb-1 uppercase">
              RTM Alert · {originalTeam?.shortName} Exercised RTM
            </div>
            <h2 className="font-anton text-[32px] leading-none text-white uppercase">{player.name}</h2>
          </div>

          <div className="px-6 py-5">
            <p className="font-barlow text-[13px] text-text-secondary mb-5">
              <span className="font-bold text-text-primary">{originalTeam?.name}</span> matched your bid of{" "}
              <span className="font-barlow-condensed font-bold text-[16px] text-danger">{crore(baseAmount)}</span>.
              {" "}Raise your bid to try and keep this player — they must then decide to match or concede.
            </p>

            <div className="flex gap-0 border-2 border-border mb-4 bg-surface2">
              {[
                { label: "RTM Price", value: crore(baseAmount), highlight: true },
                { label: "Time", value: `${timerSeconds}s`, urgent: timerSeconds <= 5 },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="flex-1 flex flex-col items-center justify-center py-4"
                  style={i < 1 ? { borderRight: "2px solid var(--ink)" } : {}}
                >
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary mb-1 uppercase">{item.label}</div>
                  <div className="font-barlow-condensed font-bold text-[24px] leading-none" style={{ color: item.urgent ? "#d6492f" : "var(--ink)" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Counter bid stepper */}
            <div className="flex items-center gap-3 mb-4 border-2 border-border p-3 bg-surface2">
              <button
                onClick={() => setCounterInput(Math.max(minRaise, getNextBidAmount(currentCounter - getNextBidAmount(currentCounter))))}
                className="w-10 h-10 font-barlow-condensed font-bold text-[20px] border border-border hover:bg-surface transition-colors"
              >−</button>
              <div className="flex-1 text-center font-barlow-condensed font-bold text-[22px] text-text-primary">
                {crore(currentCounter)}
              </div>
              <button
                onClick={() => setCounterInput(getNextBidAmount(currentCounter))}
                className="w-10 h-10 font-barlow-condensed font-bold text-[20px] border border-border hover:bg-surface transition-colors"
              >+</button>
            </div>

            {!canAffordCounter && (
              <div className="font-space-mono text-[10px] text-red-600 font-bold mb-3 uppercase">
                ⚠️ Insufficient purse ({crore(userTeam?.remainingPurse ?? 0)}) for {crore(currentCounter)}.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { raiseCounter(currentCounter); setCounterInput(null); }}
                disabled={!canAffordCounter}
                className="flex-1 font-anton text-[16px] py-4 tracking-wide hover:brightness-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--team-cta-bg, #1d55c4)", color: "var(--team-cta-text, #ffffff)" }}
              >
                RAISE TO {crore(currentCounter)}
              </button>
              <button
                onClick={passCounter}
                className="px-6 font-space-mono font-bold text-[11px] tracking-widest text-text-secondary border-2 border-border hover:bg-surface transition-colors"
              >
                CONCEDE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Phase: original_match — user is original team, winner AI countered ----
  if (phase === "original_match" && isUserOriginal) {
    const canAffordMatch = (userTeam?.remainingPurse ?? 0) >= raisedAmount;
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-border/80 backdrop-blur-sm">
        <div
          className="border-2 border-border w-full max-w-md mx-4 shadow-2xl rounded-[8px] overflow-hidden transition-colors duration-200"
          style={{ backgroundColor: "var(--app-base-bg, var(--background))" }}
        >
          <div
            className="px-6 py-4 transition-colors duration-200"
            style={{ backgroundColor: "var(--team-cta-bg, #1d55c4)", color: "var(--team-cta-text, #ffffff)" }}
          >
            <div className="font-space-mono font-bold text-[10px] tracking-[.16em] uppercase mb-1" style={{ opacity: 0.85 }}>
              RTM Counter · Your Final Decision
            </div>
            <h2 className="font-anton text-[32px] leading-none uppercase">{player.name}</h2>
          </div>

          <div className="px-6 py-5">
            <p className="font-barlow text-[13px] text-text-secondary mb-5">
              <span className="font-bold text-text-primary">{winnerTeam?.name}</span> raised their bid to{" "}
              <span className="font-barlow-condensed font-bold text-[16px] text-danger">{crore(raisedAmount)}</span>.
              {" "}Match this price to take the player — or fold and they keep it.
            </p>

            <div className="flex gap-0 border-2 border-border mb-4 bg-surface2">
              {[
                { label: "Original Bid", value: crore(baseAmount) },
                { label: "Counter Bid", value: crore(raisedAmount), highlight: true },
                { label: "Time", value: `${timerSeconds}s`, urgent: timerSeconds <= 5 },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="flex-1 flex flex-col items-center justify-center py-4"
                  style={i < 2 ? { borderRight: "2px solid var(--ink)" } : {}}
                >
                  <div className="font-space-mono text-[9px] tracking-widest text-text-secondary mb-1 uppercase">{item.label}</div>
                  <div className="font-barlow-condensed font-bold text-[22px] leading-none" style={{ color: item.urgent ? "#d6492f" : "var(--ink)" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {!canAffordMatch && (
              <div className="font-space-mono text-[10px] text-red-600 font-bold mb-3 uppercase">
                ⚠️ Insufficient purse ({crore(userTeam?.remainingPurse ?? 0)}) to match {crore(raisedAmount)}.
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={matchCounter}
                disabled={!canAffordMatch}
                className="flex-1 font-anton text-[18px] py-4 tracking-wide hover:brightness-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--team-cta-bg, #1d55c4)", color: "var(--team-cta-text, #ffffff)" }}
              >
                MATCH · {crore(raisedAmount)}
              </button>
              <button
                onClick={foldToCounter}
                className="px-6 font-space-mono font-bold text-[12px] tracking-widest text-text-secondary border-2 border-border hover:bg-surface transition-colors"
              >
                FOLD
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
