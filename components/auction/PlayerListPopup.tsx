"use client";
import { useGameStore } from "@/lib/store/gameStore";
import { Player } from "@/lib/types";

type PopupType = "sold" | "unsold" | "left";

function crore(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)} Cr`;
}

const CATEGORIES: Array<{ label: string; roles: string[]; marquee?: boolean }> = [
  { label: "Marquee Players", roles: ["Batsman", "WK-Batsman", "All-Rounder", "Pace Bowler", "Spin Bowler"], marquee: true },
  { label: "Wicketkeepers", roles: ["WK-Batsman"] },
  { label: "All-Rounders", roles: ["All-Rounder"] },
  { label: "Batsmen", roles: ["Batsman"] },
  { label: "Fast Bowlers", roles: ["Pace Bowler"] },
  { label: "Spinners", roles: ["Spin Bowler"] },
];

function PlayerRow({
  player,
  type,
  soldPrice,
  buyerTeamName,
  buyerColor,
}: {
  player: Player;
  type: PopupType;
  soldPrice?: number;
  buyerTeamName?: string;
  buyerColor?: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-6 py-[9px]"
      style={{ borderBottom: "1px solid rgba(22,19,15,.1)" }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Star dots */}
        <div className="flex gap-[3px] shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-[7px] h-[7px] rounded-sm transition-colors duration-200"
              style={{ backgroundColor: i < player.starRating ? "var(--team-accent, #1d55c4)" : "rgba(22,19,15,.12)" }}
            />
          ))}
        </div>
        <div className="min-w-0">
          <div className="font-barlow font-semibold text-[13px] text-text-primary truncate leading-tight">
            {player.name}
          </div>
          <div className="flex items-center gap-1.5 mt-[1px]">
            {player.nationality === "Overseas" && (
              <span
                className="font-space-mono text-[7px] px-1 rounded-[2px] font-bold"
                style={{ backgroundColor: "var(--team-accent)", color: "var(--team-accent-text)" }}
              >
                OS
              </span>
            )}
            <span className="font-space-mono text-[8px] text-muted">
              {player.isCapped ? "CAPPED" : "UNCAPPED"} · AGE {player.age}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-4">
        {type === "sold" && buyerTeamName && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: buyerColor ?? "#8a8378" }} />
            <span className="font-space-mono text-[9px] text-text-secondary font-bold">{buyerTeamName}</span>
          </div>
        )}
        <span
          className="font-barlow-condensed font-bold text-[14px]"
          style={{ color: type === "sold" ? "#1f9d57" : type === "unsold" ? "#d6492f" : "#16130f" }}
        >
          {type === "sold" && soldPrice != null
            ? crore(soldPrice)
            : crore(player.basePrice)}
        </span>
      </div>
    </div>
  );
}

export default function PlayerListPopup({
  type,
  onClose,
}: {
  type: PopupType;
  onClose: () => void;
}) {
  const { auction, players, teams } = useGameStore();
  if (!auction) return null;

  const ids =
    type === "sold"
      ? auction.soldPlayerIds
      : type === "unsold"
      ? auction.unsoldPlayerIds
      : auction.allPlayerIds.filter(
          (id) =>
            !auction.soldPlayerIds.includes(id) &&
            !auction.unsoldPlayerIds.includes(id)
        );

  const playerList = ids.map((id) => players[id]).filter(Boolean) as Player[];
  const saleMap = new Map((auction.saleHistory ?? []).map((s) => [s.playerId, s]));

  const labelMap: Record<PopupType, string> = {
    sold: "SOLD PLAYERS",
    unsold: "UNSOLD PLAYERS",
    left: "UPCOMING PLAYERS",
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center"
      style={{ backgroundColor: "rgba(22,19,15,.65)", paddingTop: "48px", paddingBottom: "32px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col rounded-[8px] overflow-hidden shadow-2xl transition-colors duration-200"
        style={{
          maxWidth: "640px",
          border: "2px solid #16130f",
          maxHeight: "calc(100vh - 80px)",
          backgroundColor: "var(--app-base-bg, #f4f1ea)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0 transition-colors duration-200"
          style={{ backgroundColor: "var(--team-bid-bg, #1b2133)", borderBottom: "2px solid #16130f" }}
        >
          <div>
            <div className="font-space-mono font-bold text-[9px] tracking-[.16em] uppercase mb-1" style={{ color: "var(--team-accent, #1d55c4)" }}>
              {labelMap[type]}
            </div>
            <div className="font-anton text-[30px] leading-none uppercase" style={{ color: "var(--team-bid-text, #ffffff)" }}>
              {playerList.length} Players
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center font-bold transition-all duration-150 rounded shrink-0 text-[14px]"
            style={{ backgroundColor: "var(--team-accent, #1d55c4)", color: "var(--team-accent-text, #ffffff)" }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {playerList.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="font-space-mono text-[10px] text-text-secondary tracking-wider">
                {type === "sold" ? "No players sold yet" : type === "unsold" ? "No unsold players" : "No players remaining"}
              </span>
            </div>
          ) : (
            CATEGORIES.map((cat) => {
              const catPlayers = cat.marquee
                ? playerList.filter((p) => p.starRating >= 4.5)
                : playerList.filter(
                    (p) => cat.roles.includes(p.role) && p.starRating < 4.5
                  );

              if (catPlayers.length === 0) return null;

              const indian = catPlayers.filter((p) => p.nationality !== "Overseas");
              const overseas = catPlayers.filter((p) => p.nationality === "Overseas");

              return (
                <div key={cat.label}>
                  {/* Category header */}
                  <div
                    className="px-6 py-[10px] flex items-center justify-between transition-colors duration-200"
                    style={{
                      backgroundColor: "var(--team-primary-tint, rgba(0,0,0,0.05))",
                      borderBottom: "2px solid #16130f",
                      borderTop: "2px solid #16130f",
                    }}
                  >
                    <span className="font-space-mono font-bold text-[10px] tracking-widest text-text-primary uppercase">
                      {cat.label}
                    </span>
                    <span className="font-space-mono text-[9px] text-text-secondary">{catPlayers.length}</span>
                  </div>

                  {/* Indian sub-section */}
                  {indian.length > 0 && (
                    <>
                      <div
                        className="px-6 py-[5px]"
                        style={{ borderBottom: "1px solid rgba(22,19,15,.15)", backgroundColor: "rgba(0,0,0,0.03)" }}
                      >
                        <span className="font-space-mono text-[8px] tracking-widest text-muted uppercase">Indian</span>
                      </div>
                      {indian.map((p) => {
                        const sale = saleMap.get(p.id);
                        const buyer = sale ? teams[sale.teamId] : undefined;
                        return (
                          <PlayerRow
                            key={p.id}
                            player={p}
                            type={type}
                            soldPrice={sale?.price}
                            buyerTeamName={buyer?.shortName}
                            buyerColor={buyer?.primaryColor}
                          />
                        );
                      })}
                    </>
                  )}

                  {/* Overseas sub-section */}
                  {overseas.length > 0 && (
                    <>
                      <div
                        className="px-6 py-[5px]"
                        style={{ borderBottom: "1px solid rgba(22,19,15,.15)", backgroundColor: "var(--team-primary-tint)" }}
                      >
                        <span className="font-space-mono text-[8px] tracking-widest text-muted uppercase">Overseas</span>
                      </div>
                      {overseas.map((p) => {
                        const sale = saleMap.get(p.id);
                        const buyer = sale ? teams[sale.teamId] : undefined;
                        return (
                          <PlayerRow
                            key={p.id}
                            player={p}
                            type={type}
                            soldPrice={sale?.price}
                            buyerTeamName={buyer?.shortName}
                            buyerColor={buyer?.primaryColor}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
