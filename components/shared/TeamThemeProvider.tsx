"use client";
import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { TEAM_THEMES, readableOn } from "@/lib/theme/teams";

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function applyTeamTheme(teamCode: string) {
  const theme = TEAM_THEMES[teamCode] || TEAM_THEMES.MI;
  const root = document.documentElement;

  const rgb = hexToRgb(theme.accent);
  const accentText = readableOn(theme.accent);

  root.style.setProperty("--app-base-bg", theme.baseBg);
  root.style.setProperty("--chrome-nav-active", theme.navActive);
  root.style.setProperty("--chrome-nav-muted", theme.navMuted);
  root.style.setProperty("--team-primary", theme.accent);
  root.style.setProperty("--team-accent", theme.accent);
  root.style.setProperty("--team-accent-text", accentText);
  root.style.setProperty("--team-primary-rgb", rgb);
  root.style.setProperty("--team-primary-tint", `rgba(${rgb}, 0.12)`);
  root.style.setProperty("--team-bid-bg", theme.bidBg);
  root.style.setProperty("--team-bid-text", theme.bidText);
  root.style.setProperty("--team-bid-muted", theme.bidMuted);
  root.style.setProperty("--team-cta-bg", theme.ctaBg);
  root.style.setProperty("--team-cta-text", theme.ctaText);

  root.setAttribute("data-team", theme.code);
  document.body.style.backgroundColor = theme.baseBg;
}

export default function TeamThemeProvider({ children }: { children: React.ReactNode }) {
  const userTeamId = useGameStore((s) => s.userTeamId);

  useEffect(() => {
    if (userTeamId) {
      applyTeamTheme(userTeamId);
    }
  }, [userTeamId]);

  return <>{children}</>;
}
