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

      <div className="flex items-center gap-5 font-space-mono text-[10px]">
        <span className="text-text-secondary tracking-wider">{currentDate}</span>
        {userTeam && (
          <span className="text-success font-bold tracking-wider">
            {formatPrice(userTeam.remainingPurse)} left
          </span>
        )}
      </div>
    </nav>
  );
}
