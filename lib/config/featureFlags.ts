// Set to true when the managerial season is ready to be exposed again.
export const SEASON_ACCESS_ENABLED = true;

// Keep enabled while fixture simulation is in active development. Switching
// this off creates a hard stop before any scheduled match can be simulated,
// without disabling access to the season pages themselves.
export const FIXTURE_SIMULATION_ENABLED = false;

export const SEASON_ACCESS_CHANGED_EVENT = "ipl_season_access_changed";

export const getSeasonAccessStorageKey = (teamId: string) =>
  `ipl_continued_to_season_${teamId}`;
