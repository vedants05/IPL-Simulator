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
  const { teams, userTeamId, currentDate } = useGameStore();
  const userTeam = teams[userTeamId];

  return (
    <nav className="h-12 bg-surface border-b border-border flex items-center px-4 gap-0 shrink-0 z-50">
      {/* Team badge */}
      {userTeam && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-4"
          style={{ backgroundColor: userTeam.primaryColor, color: userTeam.secondaryColor }}
        >
          {userTeam.shortName.slice(0, 2)}
        </div>
      )}

      {/* Nav links */}
      <div className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded
                ${active
                  ? "text-text-primary bg-surface2 border-b-2 border-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface2"
                }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right info */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-text-secondary">{currentDate} · Pre-Season</span>
        {userTeam && (
          <span className="text-success font-semibold">
            {formatPrice(userTeam.remainingPurse)} remaining
          </span>
        )}
        <button className="bg-accent hover:bg-accent-hover text-white px-4 py-1.5 rounded text-sm font-medium transition-colors">
          Continue →
        </button>
      </div>
    </nav>
  );
}
