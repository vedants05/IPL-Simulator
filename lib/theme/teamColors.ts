import type { CSSProperties } from "react";

interface TeamColorSource {
  id?: string;
  primaryColor?: string;
}

const DARK_MODE_PRIMARY_COLORS: Record<string, string> = {
  GT: "#2d6bc4",
};

export type TeamColorStyle = CSSProperties & {
  "--team-primary-color": string;
  "--team-primary-color-dark": string;
};

export function getTeamColorStyle(
  team: TeamColorSource | null | undefined,
  fallback = "#5b6472",
): TeamColorStyle {
  const primaryColor = team?.primaryColor ?? fallback;
  return {
    "--team-primary-color": primaryColor,
    "--team-primary-color-dark": team?.id
      ? (DARK_MODE_PRIMARY_COLORS[team.id] ?? primaryColor)
      : primaryColor,
  };
}
