"use client";
import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { TEAM_THEMES, readableOn } from "@/lib/theme/teams";
import {
  APPEARANCE_THEME_STORAGE_KEY,
  getStoredAppearanceTheme,
  type AppearanceTheme,
} from "@/lib/theme/appearance";

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function mixHex(baseHex: string, tintHex: string, tintWeight: number): string {
  const channels = (hex: string) => {
    const normalized = hex.replace("#", "");
    return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  };
  const base = channels(baseHex);
  const tint = channels(tintHex);
  return `#${base.map((value, index) => Math.round(value * (1 - tintWeight) + tint[index] * tintWeight)
    .toString(16)
    .padStart(2, "0")).join("")}`;
}

const TEAM_SKIN_VARIABLES = [
  "--background", "--foreground", "--app-base-bg", "--base-bg", "--surface",
  "--surface2", "--ink", "--hairline", "--text-secondary", "--marquee",
  "--modal-footer", "--auction-status-bg", "--auction-status-border", "--accent",
  "--accent-hover", "--app-pattern-image", "--team-skin-nav-start",
  "--team-skin-nav-end", "--team-skin-selected",
] as const;

function clearTeamSkinPalette(root: HTMLElement) {
  TEAM_SKIN_VARIABLES.forEach((property) => root.style.removeProperty(property));
}

function applyTeamSkinPalette(root: HTMLElement, primary: string, secondary: string) {
  const background = mixHex("#0d1018", primary, 0.13);
  const surface = mixHex("#191d27", primary, 0.11);
  const surface2 = mixHex("#232834", primary, 0.12);
  const hairline = mixHex("#3b4250", primary, 0.28);
  const muted = mixHex("#aeb6c6", secondary, 0.13);
  const patternSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><g fill="none" stroke-width="1.4" stroke-linecap="round"><path d="M15 7v16M7 15h16" transform="rotate(-24 15 15)" stroke="${primary}" opacity=".18"/><path d="M70 61v14M63 68h14" transform="rotate(-24 70 68)" stroke="${secondary}" opacity=".16"/></g></svg>`;

  root.style.setProperty("--background", background);
  root.style.setProperty("--foreground", "#f4f6fb");
  root.style.setProperty("--app-base-bg", background);
  root.style.setProperty("--base-bg", background);
  root.style.setProperty("--surface", surface);
  root.style.setProperty("--surface2", surface2);
  root.style.setProperty("--ink", "#f4f6fb");
  root.style.setProperty("--hairline", hairline);
  root.style.setProperty("--text-secondary", muted);
  root.style.setProperty("--marquee", mixHex(surface2, secondary, 0.13));
  root.style.setProperty("--modal-footer", mixHex(background, primary, 0.08));
  root.style.setProperty("--auction-status-bg", mixHex("#090c12", primary, 0.18));
  root.style.setProperty("--auction-status-border", hairline);
  root.style.setProperty("--accent", primary);
  root.style.setProperty("--accent-hover", secondary);
  root.style.setProperty("--app-pattern-image", `url("data:image/svg+xml,${encodeURIComponent(patternSvg)}")`);
  root.style.setProperty("--team-skin-nav-start", mixHex("#151923", primary, 0.32));
  root.style.setProperty("--team-skin-nav-end", mixHex("#090c12", secondary, 0.13));
  root.style.setProperty("--team-skin-selected", mixHex("#242a36", primary, 0.24));
}

export function applyTeamTheme(teamCode: string) {
  const theme = TEAM_THEMES[teamCode] || TEAM_THEMES.MI;
  const root = document.documentElement;

  const rgb = hexToRgb(theme.accent);
  const accentText = readableOn(theme.accent);

  const isDark = root.classList.contains("dark");
  const isRetro = root.classList.contains("retro");
  const isTeam = root.classList.contains("team");
  if (isTeam) applyTeamSkinPalette(root, theme.accent, theme.bowlingBar);
  else clearTeamSkinPalette(root);
  root.style.setProperty("--app-base-bg", "var(--surface)");
  root.style.setProperty(
    "--chrome-nav-active",
    isTeam ? "#ffffff" : isRetro ? "var(--retro-nav-ink)" : isDark ? "var(--foreground)" : theme.navActive,
  );
  root.style.setProperty(
    "--chrome-nav-muted",
    isTeam ? mixHex("#aeb6c6", theme.bowlingBar, 0.16) : isRetro ? "var(--retro-nav-muted)" : isDark ? "#9ca3af" : theme.navMuted,
  );
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

let themeTransitionTimer: ReturnType<typeof setTimeout> | null = null;

export function switchColorMode(mode: AppearanceTheme, teamCode?: string) {
  const root = document.documentElement;

  if (themeTransitionTimer) clearTimeout(themeTransitionTimer);
  root.classList.add("theme-changing");

  // Activate the shared transition before changing any theme values.
  void root.offsetWidth;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("retro", mode === "retro");
  root.classList.toggle("team", mode === "team");
  root.setAttribute("data-theme", mode);
  localStorage.setItem(APPEARANCE_THEME_STORAGE_KEY, mode);

  if (teamCode || mode === "team") applyTeamTheme(teamCode || root.getAttribute("data-team") || "MI");

  themeTransitionTimer = setTimeout(() => {
    root.classList.remove("theme-changing");
    themeTransitionTimer = null;
  }, 220);
}

export default function TeamThemeProvider({ children }: { children: React.ReactNode }) {
  const userTeamId = useGameStore((s) => s.userTeamId);

  useEffect(() => {
    switchColorMode(getStoredAppearanceTheme(), userTeamId || undefined);
  }, [userTeamId]);

  return <>{children}</>;
}
