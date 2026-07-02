"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";
import { TEAM_THEMES } from "@/lib/theme/teams";

const NAV_ITEMS = [
  { label: "Overview", href: "/game/overview" },
  { label: "Squad", href: "/game/squad" },
  { label: "Auction", href: "/game/auction" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { teams, userTeamId, currentDate, auction, isPaused, togglePaused, speed, increaseSpeed, decreaseSpeed, setUserTeam } = useGameStore();
  const userTeam = teams[userTeamId];
  const isAuctionPage = pathname.startsWith("/game/auction");

  return (
    <nav className="h-12 border-b-2 border-border flex items-center px-5 gap-0 shrink-0 z-50">
      {userTeam && (
        <div className="flex items-center gap-2.5 mr-5 shrink-0">
          <div
            className="h-7 min-w-[28px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors duration-200"
            style={{ backgroundColor: "var(--team-accent)", color: "var(--team-accent-text)" }}
          >
            {userTeam.shortName}
          </div>
          <span
            className="font-space-mono font-bold text-[10px] tracking-widest uppercase transition-colors duration-200"
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
        {/* Team Theme Switcher */}
        <div className="flex items-center gap-1 bg-border/5 p-1 rounded border border-border/20">
          {Object.values(TEAM_THEMES).map((theme) => {
            const isSelected = theme.code === userTeamId;
            return (
              <button
                key={theme.code}
                onClick={() => setUserTeam(theme.code)}
                title={`${theme.name} (${theme.code})`}
                className={`w-4 h-4 rounded-full transition-all duration-150 relative flex items-center justify-center shrink-0 cursor-pointer ${
                  isSelected ? "ring-2 ring-border scale-110 z-10" : "hover:scale-105 opacity-80 hover:opacity-100"
                }`}
                style={{ backgroundColor: theme.accent }}
              />
            );
          })}
        </div>

        {!isAuctionPage && (
          <span className="tracking-wider" style={{ color: "var(--chrome-nav-muted)" }}>{currentDate}</span>
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
