"use client";
import { useGameStore } from "@/lib/store/gameStore";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

export default function RTMModal() {
  const { auction, teams, userTeamId } = useGameStore();
  const useRTM = useGameStore((s) => s.useRTM);
  const declineRTM = useGameStore((s) => s.declineRTM);

  if (!auction?.rtmWindowOpen || !auction.currentPlayer) return null;

  const player = auction.currentPlayer;
  const winnerTeam = teams[auction.currentHighBidderTeamId!];
  const userTeam = teams[userTeamId];
  const rtmLeft = (userTeam?.rtmCardsTotal ?? 0) - (userTeam?.rtmCardsUsed ?? 0);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-border/80 backdrop-blur-sm">
      <div className="bg-bg border-2 border-border w-full max-w-md mx-4 shadow-2xl">
        {/* Header strip */}
        <div className="bg-accent px-6 py-4">
          <div className="font-space-mono font-bold text-[10px] tracking-[.16em] text-border mb-1 uppercase">
            Right to Match
          </div>
          <h2 className="font-anton text-[32px] leading-none text-border uppercase">{player.name}</h2>
        </div>

        <div className="px-6 py-5">
          <p className="font-barlow text-[13px] text-text-secondary mb-5">
            Sold to <span className="font-bold text-text-primary">{winnerTeam?.name}</span> for{" "}
            <span className="font-barlow-condensed font-bold text-[16px] text-danger">{crore(auction.currentBid)}</span>.
            You can match this bid using an RTM card.
          </p>

          <div className="flex gap-0 border-2 border-border mb-5">
            {[
              { label: "RTM Cards", value: rtmLeft },
              { label: "Match Price", value: crore(auction.currentBid), highlight: true },
              { label: "Time", value: `${auction.rtmTimerSeconds}s`, urgent: auction.rtmTimerSeconds <= 5 },
            ].map((item, i) => (
              <div
                key={item.label}
                className="flex-1 flex flex-col items-center justify-center py-4"
                style={i < 2 ? { borderRight: "2px solid #16130f" } : {}}
              >
                <div className="font-space-mono text-[9px] tracking-widest text-text-secondary mb-1 uppercase">
                  {item.label}
                </div>
                <div
                  className="font-barlow-condensed font-bold text-[24px] leading-none"
                  style={{ color: item.urgent ? "#d6492f" : "#16130f" }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={useRTM}
              className="flex-1 bg-border text-accent font-anton text-[18px] py-4 tracking-wide hover:bg-black transition-colors"
            >
              USE RTM · {crore(auction.currentBid)}
            </button>
            <button
              onClick={declineRTM}
              className="px-6 font-space-mono font-bold text-[12px] tracking-widest text-text-secondary
                border-2 border-border hover:bg-surface transition-colors"
            >
              DECLINE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
