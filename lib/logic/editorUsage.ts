import { DEFAULT_WORLD_RULES, normalizeWorldRules, type WorldRules } from "./worldRules";

export interface EditorUsage {
  editorUsed: boolean;
  editorFirstUsedAt: string | null;
}

interface SavedEditorUsage extends Partial<EditorUsage> {
  playerOverrides?: object;
  frozenPlayerAttributes?: object;
  staffOverrides?: object;
  frozenStaffAttributes?: object;
  worldRules?: Partial<WorldRules>;
  careerStaff?: { employmentHistory?: Array<{ id: string }> };
}

/** Older saves can prove previous use through retained editor overrides/rules. */
export function normalizeEditorUsage(saved: SavedEditorUsage): EditorUsage {
  const timestamp = typeof saved.editorFirstUsedAt === "string" && Number.isFinite(Date.parse(saved.editorFirstUsedAt))
    ? saved.editorFirstUsedAt : null;
  const hasOverrides = [saved.playerOverrides, saved.frozenPlayerAttributes, saved.staffOverrides, saved.frozenStaffAttributes]
    .some((entry) => entry && Object.keys(entry).length > 0);
  const hasCustomRules = saved.worldRules !== undefined
    && JSON.stringify(normalizeWorldRules(saved.worldRules)) !== JSON.stringify(normalizeWorldRules(DEFAULT_WORLD_RULES));
  const hasEditorTransfer = saved.careerStaff?.employmentHistory?.some((entry) => typeof entry?.id === "string" && entry.id.includes(":editor-")) ?? false;
  return {
    editorUsed: saved.editorUsed === true || timestamp !== null || hasOverrides || hasCustomRules || hasEditorTransfer,
    // Do not invent a first-use date for an older save.
    editorFirstUsedAt: timestamp,
  };
}

export function recordEditorUsage(previous: EditorUsage, now = new Date().toISOString()): EditorUsage {
  return { editorUsed: true, editorFirstUsedAt: previous.editorUsed ? previous.editorFirstUsedAt : now };
}
