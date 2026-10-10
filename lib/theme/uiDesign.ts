export const UI_DESIGN_STORAGE_KEY = "ipl-ui-design";
export const UI_DESIGN_CHANGED_EVENT = "ipl-ui-design-changed";
export const UI_DESIGNS = ["original", "modern", "sidebar"] as const;
export type UIDesign = (typeof UI_DESIGNS)[number];

export function normalizeUIDesign(value: string | null): UIDesign {
  return UI_DESIGNS.includes(value as UIDesign) ? value as UIDesign : "original";
}

export function getStoredUIDesign(): UIDesign {
  if (typeof window === "undefined") return "original";
  try { return normalizeUIDesign(window.localStorage.getItem(UI_DESIGN_STORAGE_KEY)); }
  catch { return "original"; }
}

export function applyUIDesign(design: UIDesign) {
  document.documentElement.setAttribute("data-ui-design", design);
  try { window.localStorage.setItem(UI_DESIGN_STORAGE_KEY, design); } catch { /* Keep the choice for this session. */ }
  window.dispatchEvent(new Event(UI_DESIGN_CHANGED_EVENT));
}

// Independent from colour initialisation so either preference can recover safely.
export const UI_DESIGN_INIT_SCRIPT = `
  try {
    var storedUIDesign = localStorage.getItem('${UI_DESIGN_STORAGE_KEY}');
    document.documentElement.setAttribute('data-ui-design', ${JSON.stringify(UI_DESIGNS)}.indexOf(storedUIDesign) !== -1 ? storedUIDesign : 'original');
  } catch (_) { document.documentElement.setAttribute('data-ui-design', 'original'); }
`;
