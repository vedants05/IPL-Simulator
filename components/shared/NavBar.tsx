"use client";
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
  const { teams, userTeamId, currentDate, auction, isPaused, togglePaused, speed, increaseSpeed, decreaseSpeed } = useGameStore();
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
              className={`px-3.5 rounded font-space-mono font-bold text-[10px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center h-[28px]
                ${isPaused
                  ? "bg-danger text-white hover:brightness-95 animate-pulse"
                  : "hover:brightness-110"
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
