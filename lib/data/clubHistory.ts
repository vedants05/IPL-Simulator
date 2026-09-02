import { HISTORICAL_LEAGUE_HISTORY, type LeagueHistorySeason, type LeagueHistoryTeamOutcome } from "./leagueHistory";

export type ClubSeasonOutcome = string;

export interface ClubSeasonHistoryEntry {
  season: number;
  clubName: string;
  outcome: ClubSeasonOutcome;
}

export const LAST_HISTORICAL_CLUB_SEASON = 2026;

interface ClubHistoryDefinition {
  firstSeason: number;
  names?: Array<{ from: number; name: string }>;
  didNotParticipate?: number[];
}

const CLUB_HISTORY: Record<string, ClubHistoryDefinition> = {
  MI: {
    firstSeason: 2008,
  },
  CSK: {
    firstSeason: 2008,
    didNotParticipate: [2016, 2017],
  },
  KKR: {
    firstSeason: 2008,
  },
  RCB: {
    firstSeason: 2008,
    names: [
      { from: 2008, name: "Royal Challengers Bangalore" },
      { from: 2024, name: "Royal Challengers Bengaluru" },
    ],
  },
  SRH: {
    firstSeason: 2013,
  },
  RR: {
    firstSeason: 2008,
    didNotParticipate: [2016, 2017],
  },
  DC: {
    firstSeason: 2008,
    names: [
      { from: 2008, name: "Delhi Daredevils" },
      { from: 2019, name: "Delhi Capitals" },
    ],
  },
  PBKS: {
    firstSeason: 2008,
    names: [
      { from: 2008, name: "Kings XI Punjab" },
      { from: 2021, name: "Punjab Kings" },
    ],
  },
  GT: {
    firstSeason: 2022,
  },
  LSG: {
    firstSeason: 2022,
  },
};

function clubNameForSeason(definition: ClubHistoryDefinition, fallbackName: string, season: number): string {
  const historicalName = definition.names
    ?.filter((entry) => entry.from <= season)
    .sort((a, b) => b.from - a.from)[0];
  return historicalName?.name ?? fallbackName;
}

export function getClubSeasonHistory(teamId: string, fallbackName: string): ClubSeasonHistoryEntry[] {
  const definition = CLUB_HISTORY[teamId];
  if (!definition) return [];

  return Array.from({ length: LAST_HISTORICAL_CLUB_SEASON - definition.firstSeason + 1 }, (_, index) => {
    const season = definition.firstSeason + index;
    const leagueSeason = HISTORICAL_LEAGUE_HISTORY.find((entry) => entry.season === season);
    const outcome: ClubSeasonOutcome = definition.didNotParticipate?.includes(season)
      ? "Did not participate"
      : formatClubSeasonOutcome(findClubTeamOutcome(leagueSeason, teamId));

    return {
      season,
      clubName: clubNameForSeason(definition, fallbackName, season),
      outcome,
    };
  }).reverse();
}

const CLUB_TEAM_ALIASES: Record<string, string[]> = {
  DC: ["DC", "DD"],
  PBKS: ["PBKS", "KXIP"],
};

export function findClubTeamOutcome(
  season: LeagueHistorySeason | undefined,
  teamId: string,
): LeagueHistoryTeamOutcome | undefined {
  const aliases = CLUB_TEAM_ALIASES[teamId] ?? [teamId];
  for (const alias of aliases) {
    const outcome = season?.teamOutcomes?.[alias];
    if (outcome) return outcome;
  }
  return undefined;
}

function ordinal(position: number): string {
  const mod100 = position % 100;
  const suffix = mod100 >= 11 && mod100 <= 13
    ? "th"
    : position % 10 === 1 ? "st" : position % 10 === 2 ? "nd" : position % 10 === 3 ? "rd" : "th";
  return `${position}${suffix}`;
}

export function formatClubSeasonOutcome(outcome: LeagueHistoryTeamOutcome | undefined): ClubSeasonOutcome {
  if (!outcome) return "Did not participate";
  switch (outcome.playoffOutcome) {
    case "champion": return "Champions";
    case "runner-up": return "Runners-up";
    case "semi-final": return "Eliminated in semi-final";
    case "eliminator": return "Eliminated in eliminator";
    case "qualifier-2": return "Eliminated in Qualifier 2";
    default: return `${ordinal(outcome.leaguePosition)} place`;
  }
}
