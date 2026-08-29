export const APPEARANCE_THEME_STORAGE_KEY = "theme";

export const APPEARANCE_THEMES = ["light", "dark", "retro", "team"] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];

export function isAppearanceTheme(value: string | null): value is AppearanceTheme {
  return value !== null && APPEARANCE_THEMES.includes(value as AppearanceTheme);
}

export function getStoredAppearanceTheme(): AppearanceTheme {
  if (typeof window === "undefined") return "light";
  const storedTheme = window.localStorage.getItem(APPEARANCE_THEME_STORAGE_KEY);
  return isAppearanceTheme(storedTheme) ? storedTheme : "light";
}
