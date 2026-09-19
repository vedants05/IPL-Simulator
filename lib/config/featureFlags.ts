// Set to true when the managerial season is ready to be exposed again.
export const SEASON_ACCESS_ENABLED = true;

// Keep enabled while fixture simulation is in active development. Switching
// this off creates a hard stop before any scheduled match can be simulated,
// without disabling access to the season pages themselves.
export const FIXTURE_SIMULATION_ENABLED = true;

export const SEASON_ACCESS_CHANGED_EVENT = "ipl_season_access_changed";

export const getSeasonAccessStorageKey = (teamId: string, saveId?: string) =>
  `ipl_continued_to_season_${saveId || teamId}`;

export function hasSeasonAccess(storage: Storage, teamId: string, saveId: string): boolean {
  const key = getSeasonAccessStorageKey(teamId, saveId);
  if (storage.getItem(key) === "true") return true;
  const legacyKey = getSeasonAccessStorageKey(teamId);
  if (storage.getItem(legacyKey) !== "true") return false;
  storage.setItem(key, "true");
  storage.removeItem(legacyKey);
  return true;
}
