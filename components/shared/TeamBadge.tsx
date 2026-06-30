"use client";
import { Team } from "@/lib/types";

interface Props {
  team: Team;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
}

export default function TeamBadge({ team, size = "sm", showName = false }: Props) {
  const sizes = { xs: "w-5 h-5 text-[9px]", sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm" };
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`${sizes[size]} rounded-full flex items-center justify-center font-bold`}
        style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
      >
        {team.shortName.slice(0, 2)}
      </span>
      {showName && <span className="text-text-primary text-sm font-medium">{team.shortName}</span>}
    </span>
  );
}
