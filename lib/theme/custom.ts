import { readableAccentOn, readableOn } from "./teams";

export const CUSTOM_THEME_STORAGE_KEY = "ipl-custom-colours-v1";
export const COLOUR_FIELDS = [
  { key: "primary", label: "Primary accent", group: "Accents" },
  { key: "secondary", label: "Secondary / hover", group: "Accents" },
  { key: "background", label: "Page background", group: "Surfaces" },
  { key: "surface", label: "Cards & panels", group: "Surfaces" },
  { key: "surface2", label: "Raised panels & inputs", group: "Surfaces" },
  { key: "text", label: "Primary text", group: "Text & borders" },
  { key: "muted", label: "Secondary text", group: "Text & borders" },
  { key: "border", label: "Borders & dividers", group: "Text & borders" },
  { key: "nav", label: "Navigation background", group: "Navigation" },
  { key: "navText", label: "Navigation text", group: "Navigation" },
  { key: "navMuted", label: "Inactive navigation", group: "Navigation" },
  { key: "selection", label: "Selected navigation", group: "Navigation" },
  { key: "highlight", label: "Highlight panels", group: "Details" },
  { key: "footer", label: "Popup footer", group: "Details" },
  { key: "success", label: "Success indicators", group: "Details" },
  { key: "danger", label: "Danger indicators", group: "Details" },
] as const;
export type ColourKey = (typeof COLOUR_FIELDS)[number]["key"];
export type CustomPalette = Record<ColourKey, string>;

function palette(background: string, surface: string, surface2: string, primary: string, secondary: string, text: string, muted: string, border: string): CustomPalette {
  return { background, surface, surface2, primary, secondary, text, muted, border,
    nav: background, navText: text, navMuted: muted, selection: surface2,
    highlight: surface2, footer: background, success: "#1f9d57", danger: "#d6492f" };
}

export const CUSTOM_PRESETS = [
  { name: "Midnight", description: "Deep navy · electric blue", colours: palette("#0b1020", "#141e33", "#1e2c46", "#65a8ff", "#b699ff", "#f0f5ff", "#aab9d2", "#394b68") },
  { name: "Forest", description: "Pine green · soft mint", colours: palette("#0d1915", "#172b23", "#213d31", "#78d8a0", "#e5c878", "#eff8f1", "#aac7b5", "#3c614c") },
  { name: "Ocean", description: "Atlantic blue · turquoise", colours: palette("#091c27", "#102e3d", "#194153", "#54d5dc", "#8fb8ff", "#edfaff", "#9fc4d4", "#326074") },
  { name: "Burgundy", description: "Black cherry · rose gold", colours: palette("#211018", "#321e28", "#472b39", "#f69cae", "#eac48f", "#fff0f3", "#d2adb9", "#694452") },
  { name: "Amethyst", description: "Velvet purple · lilac", colours: palette("#181224", "#281f3b", "#392d50", "#c3a0ff", "#f4a3cc", "#f5efff", "#bcafd1", "#594774") },
  { name: "Graphite", description: "Cool charcoal · silver", colours: palette("#131518", "#202328", "#2c3037", "#c5d2e3", "#8bbcff", "#f2f4f7", "#b0b6c1", "#4c535f") },
  { name: "Sandstone", description: "Warm paper · terracotta", colours: palette("#f3ece1", "#fffaf2", "#e9dfcf", "#ac492a", "#76522d", "#30251c", "#715e4c", "#b8a58d") },
  { name: "Glacier", description: "Ice white · cobalt", colours: palette("#eaf1f8", "#f9fcff", "#dbe7f3", "#215bbc", "#177477", "#162c47", "#516b87", "#9fb7ce") },
  { name: "Lavender", description: "Soft lilac · plum", colours: palette("#f0eaf6", "#fdfaff", "#e5daee", "#7941a5", "#a13e70", "#35233f", "#72617e", "#bba5ca") },
  { name: "Matcha", description: "Sage paper · olive", colours: palette("#e9eddf", "#f8faef", "#dce3cd", "#466829", "#8c6224", "#28331e", "#626e52", "#a5b18f") },
  { name: "Sunset", description: "Burnt orange · amber", colours: palette("#241812", "#37261d", "#4b3527", "#ffae70", "#f5d278", "#fff3e8", "#d2b8a2", "#70523d") },
  { name: "Rose", description: "Blush white · raspberry", colours: palette("#f7e9ed", "#fff8fa", "#eed7df", "#a42d59", "#754bab", "#40212d", "#825d6c", "#c8a0af") },
] as const;

export const DEFAULT_CUSTOM_PALETTE: CustomPalette = CUSTOM_PRESETS[0].colours;
export function normalizePalette(value: unknown): CustomPalette {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(COLOUR_FIELDS.map(({ key }) => [key,
    typeof input[key] === "string" && /^#[0-9a-f]{6}$/i.test(input[key]) ? input[key] : DEFAULT_CUSTOM_PALETTE[key],
  ])) as CustomPalette;
}
export function getStoredCustomPalette(): CustomPalette {
  try { return normalizePalette(JSON.parse(localStorage.getItem(CUSTOM_THEME_STORAGE_KEY) || "null")?.palette); }
  catch { return { ...DEFAULT_CUSTOM_PALETTE }; }
}
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function customThemeVariables(p: CustomPalette): Record<string, string> {
  const rgb = [1, 3, 5].map(i => parseInt(p.primary.slice(i, i + 2), 16)).join(", ");
  return {
    "--background": p.background, "--base-bg": p.background, "--app-base-bg": p.background,
    "--surface": p.surface, "--surface2": p.surface2, "--foreground": p.text, "--ink": p.text,
    "--text-secondary": p.muted, "--hairline": p.border, "--custom-border": p.border,
    "--accent": p.primary, "--accent-hover": p.secondary, "--accent-readable": readableAccentOn(p.primary, p.surface),
    "--on-accent": readableOn(p.primary), "--marquee": p.highlight, "--modal-footer": p.footer,
    "--custom-nav": p.nav, "--chrome-nav-active": p.navText, "--chrome-nav-muted": p.navMuted,
    "--custom-selection": p.selection, "--auction-status-bg": p.surface2, "--auction-status-border": p.border,
    "--team-primary": p.primary, "--team-accent": p.primary, "--team-accent-text": readableOn(p.primary),
    "--team-primary-rgb": rgb, "--team-primary-tint": `rgba(${rgb}, 0.12)`,
    "--team-cta-bg": p.primary, "--team-cta-text": readableOn(p.primary),
    "--team-bid-bg": p.surface2, "--team-bid-text": p.text, "--team-bid-muted": p.muted,
    "--team-bid-tinge": "none", "--team-bowling-bar": p.secondary,
    "--custom-success": p.success, "--custom-danger": p.danger, "--app-pattern-image": "none",
  };
}
export const CUSTOM_VARIABLE_NAMES = Object.keys(customThemeVariables(DEFAULT_CUSTOM_PALETTE));
export function saveCustomPalette(palette: CustomPalette) {
  const safe = normalizePalette(palette);
  localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify({ version: 1, palette: safe, variables: customThemeVariables(safe) }));
}

// Only our known colour variables can be restored before React hydrates.
export const CUSTOM_THEME_INIT_SCRIPT = `
  if (theme === 'custom') {
    var customDefaults = ${JSON.stringify(customThemeVariables(DEFAULT_CUSTOM_PALETTE))};
    var savedCustom; try { savedCustom = JSON.parse(localStorage.getItem('${CUSTOM_THEME_STORAGE_KEY}') || 'null'); } catch (_) {}
    var customVars = savedCustom && savedCustom.version === 1 ? savedCustom.variables || {} : {};
    Object.keys(customDefaults).forEach(function(key) {
      var value = customVars[key];
      if (typeof value !== 'string' || !/^(#[0-9a-f]{6}|[0-9, .]+|rgba\\([0-9, .]+\\)|none)$/i.test(value)) value = customDefaults[key];
      document.documentElement.style.setProperty(key, value);
    });
    var bg = document.documentElement.style.getPropertyValue('--background');
    var channels = [1,3,5].map(function(i) { var c = parseInt(bg.slice(i,i+2),16)/255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); });
    var customDark = channels[0]*0.2126 + channels[1]*0.7152 + channels[2]*0.0722 <= 0.179;
    document.documentElement.classList.toggle('dark', customDark);
    document.documentElement.style.colorScheme = customDark ? 'dark' : 'light';
  }
`;

export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1))); };
  return `#${[5, 3, 1].map(n => Math.round(f(n) * 255).toString(16).padStart(2, "0")).join("")}`;
}
export function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max === 0 ? 0 : d / max, max];
}
