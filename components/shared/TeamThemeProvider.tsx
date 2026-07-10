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

  const isDark = document.documentElement.classList.contains("dark");
  root.style.setProperty("--app-base-bg", "var(--surface)");
  root.style.setProperty("--chrome-nav-active", isDark ? "var(--foreground)" : theme.navActive);
  root.style.setProperty("--chrome-nav-muted", isDark ? "var(--chrome-nav-muted)" : theme.navMuted);
  root.style.setProperty("--team-primary", theme.accent);
  root.style.setProperty("--team-accent", theme.accent);
  root.style.setProperty("--team-accent-text", accentText);
  root.style.setProperty("--team-bowling-bar", theme.bowlingBar || "#ffc72c");
  root.style.setProperty("--team-primary-rgb", rgb);
  root.style.setProperty("--team-primary-tint", "rgba(22, 19, 15, 0.05)");
  root.style.setProperty("--team-bid-bg", theme.bidBg);
  root.style.setProperty("--team-bid-tinge", theme.bidTinge);
  root.style.setProperty("--team-bid-text", theme.bidText);
  root.style.setProperty("--team-bid-muted", theme.bidMuted);
  root.style.setProperty("--team-cta-bg", theme.ctaBg);
  root.style.setProperty("--team-cta-text", theme.ctaText);

  root.setAttribute("data-team", theme.code);
  document.body.style.backgroundColor = "var(--surface)";
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
