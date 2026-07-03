"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

const NAV_ITEMS = [
  { label: "Overview", href: "/game/overview" },
  { label: "Squad", href: "/game/squad" },
  { label: "Auction", href: "/game/auction" },
];

export default function NavBar() {
  const pathname = usePathname();
  const {
    teams,
    userTeamId,
    currentDate,
    auction,
    isPaused,
    setPaused,
    togglePaused,
    speed,
    increaseSpeed,
    decreaseSpeed,
    skipCurrentSet,
  } = useGameStore();

  const [showConfirm, setShowConfirm] = useState(false);
  const [wasPausedBeforeConfirm, setWasPausedBeforeConfirm] = useState(false);

  const handleSkipPress = () => {
    setWasPausedBeforeConfirm(isPaused);
    setPaused(true);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    skipCurrentSet();
  };

  const handleCancel = () => {
    setShowConfirm(false);
    if (!wasPausedBeforeConfirm) {
      setPaused(false);
    }
  };
  const userTeam = teams[userTeamId];
  const isAuctionPage = pathname.startsWith("/game/auction");

  return (
    <nav className="h-12 border-b-2 border-border flex items-center px-5 gap-0 shrink-0 z-50">
      {userTeam && (
        <div className="flex items-center gap-2.5 mr-5 shrink-0">
          <div
            className="h-7 min-w-[28px] px-2 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all duration-200 shadow-sm"
            style={{ backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor }}
          >
            {userTeam.shortName}
          </div>
          <span
            className="font-space-mono font-bold text-[11px] tracking-widest uppercase transition-colors duration-200"
            style={{ color: "var(--chrome-nav-active, #16130f)" }}
          >
            {userTeam.name}
          </span>
        </div>
      )}

      <div className="flex items-center gap-0">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 h-12 flex items-center text-[11px] font-bold tracking-widest uppercase font-space-mono transition-colors border-b-2
                ${active
                  ? "bg-surface"
                  : "hover:bg-surface"
                }`}
              style={{
                color: active ? "var(--chrome-nav-active, #16130f)" : "var(--chrome-nav-muted, #8a92a3)",
                borderBottomColor: active ? "var(--team-accent, #16130f)" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4 font-space-mono text-[10px]">
        {!isAuctionPage && (
          <span className="tracking-wider" style={{ color: "var(--chrome-nav-muted)" }}>{currentDate}</span>
        )}
        {isAuctionPage && auction && auction.phase === "live" && (
          <>
            {/* Skip Set Button */}
            <div className="relative flex items-center">
              <button
                onClick={handleSkipPress}
                className="px-3 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center h-[28px] cursor-pointer hover:bg-[#1d55c4] hover:text-white hover:scale-105 active:scale-95"
                style={{
                  border: "1.5px solid #16130f",
                  backgroundColor: "var(--team-bid-bg, #111622)",
                  backgroundImage: "var(--team-bid-tinge)",
                  color: "#ffffff",
                }}
                title="Skip remaining players in current set"
              >
                ⏭ Skip Set
              </button>

              {showConfirm && (
                <>
                  {/* Invisible overlay for clicking outside */}
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={handleCancel}
                  />
                  {/* Small confirmation tile */}
                  <div
                    className="absolute right-0 top-full mt-2 w-64 p-4 z-50 rounded shadow-xl text-left border-2 flex flex-col gap-3 font-space-mono animate-in fade-in slide-in-from-top-2 duration-150"
                    style={{
                      backgroundColor: "var(--surface, #efece3)",
                      color: "var(--ink, #16130f)",
                      borderColor: "var(--ink, #16130f)",
                    }}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px] font-bold tracking-wider uppercase text-danger flex items-center gap-1">
                        ⚠️ Skip Set?
                      </div>
                      <p className="text-[10px] leading-normal font-bold">
                        Skip all remaining players in{" "}
                        <span className="underline decoration-wavy decoration-[#1d55c4]">
                          {auction?.sets?.[auction?.currentSetIndex]?.name || "current set"}
                        </span>
                        ?
                      </p>
                      <p className="text-[9px] leading-normal opacity-85 font-medium">
                        This will instantly simulate and finalize the auction for the rest of this set.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirm}
                        className="flex-1 h-[26px] rounded font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer bg-danger text-white hover:bg-red-600 active:scale-95 flex items-center justify-center"
                        style={{
                          border: "1.5px solid var(--ink, #16130f)",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 h-[26px] rounded font-bold text-[9px] uppercase tracking-wider transition-all cursor-pointer bg-transparent text-[#16130f] hover:bg-black/5 active:scale-95 flex items-center justify-center"
                        style={{
                          border: "1.5px solid var(--ink, #16130f)",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Speed Controls */}
            <div
              className="flex items-center gap-0 rounded select-none h-[28px] overflow-hidden transition-colors duration-200"
              style={{
                backgroundColor: "var(--team-bid-bg, #111622)",
                backgroundImage: "var(--team-bid-tinge)",
                border: "1.5px solid #16130f",
              }}
            >
              <button
                disabled={speed === 1}
                onClick={decreaseSpeed}
                className="px-2 text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all h-full flex items-center justify-center font-bold text-[10px] cursor-pointer"
                title="Decrease Speed"
              >
                &lt;&lt;
              </button>
              <span
                className="font-space-mono font-bold text-[10px] min-w-[28px] text-center text-white flex items-center justify-center h-full border-x border-white/15 px-1.5 select-none"
              >
                {speed}x
              </span>
              <button
                disabled={speed === 8}
                onClick={increaseSpeed}
                className="px-2 text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all h-full flex items-center justify-center font-bold text-[10px] cursor-pointer"
                title="Increase Speed"
              >
                &gt;&gt;
              </button>
            </div>

            <button
              onClick={togglePaused}
              className={`px-3.5 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center h-[28px] cursor-pointer ${
                isPaused
                  ? "bg-danger text-white hover:bg-red-600 hover:scale-105 active:scale-95 animate-pulse"
                  : "hover:bg-[#1d55c4] hover:text-white hover:scale-105 active:scale-95"
              }`}
              style={{
                border: "1.5px solid #16130f",
                backgroundColor: isPaused ? undefined : "var(--team-bid-bg, #111622)",
                backgroundImage: isPaused ? undefined : "var(--team-bid-tinge)",
                color: "#ffffff",
              }}
            >
              {isPaused ? "▶ Resume" : "❚❚ Pause"}
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
