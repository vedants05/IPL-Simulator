"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { formatPrice } from "@/lib/logic/auctionRules";

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
    <nav className="h-12 bg-bg border-b-2 border-border flex items-center px-5 gap-0 shrink-0 z-50">
      {userTeam && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mr-4 shrink-0"
          style={{ backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor }}
        >
          {userTeam.shortName.slice(0, 2)}
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
                  ? "text-text-primary border-border bg-surface"
                  : "text-text-secondary border-transparent hover:text-text-primary hover:bg-surface"
                }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4 font-space-mono text-[10px]">
        {!isAuctionPage && (
          <span className="text-text-secondary tracking-wider">{currentDate}</span>
        )}
        {isAuctionPage && auction && auction.phase === "live" && (
          <>
            {/* Speed Controls */}
            <div className="flex items-center gap-0 border border-border rounded bg-border text-white select-none h-[28px] overflow-hidden">
              <button
                disabled={speed === 1}
                onClick={decreaseSpeed}
                className="hover:text-accent hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white transition-all w-7 h-full flex items-center justify-center font-bold text-[10px] cursor-pointer"
                title="Decrease Speed"
              >
                &lt;&lt;
              </button>
              <span className="font-space-mono font-bold text-[9px] min-w-[26px] text-center text-accent flex items-center justify-center h-full border-x border-white/5 bg-black/10 select-none">
                {speed}x
              </span>
              <button
                disabled={speed === 8}
                onClick={increaseSpeed}
                className="hover:text-accent hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white transition-all w-7 h-full flex items-center justify-center font-bold text-[10px] cursor-pointer"
                title="Increase Speed"
              >
                &gt;&gt;
              </button>
            </div>

            <button
              onClick={togglePaused}
              className={`px-3 border border-border rounded font-space-mono font-bold text-[9px] tracking-wider uppercase transition-all duration-150 flex items-center justify-center h-[28px]
                ${isPaused
                  ? "bg-danger text-white hover:brightness-95 animate-pulse"
                  : "bg-border text-accent hover:bg-border/90"
                }`}
            >
              {isPaused ? "▶ Resume" : "❚❚ Pause"}
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
