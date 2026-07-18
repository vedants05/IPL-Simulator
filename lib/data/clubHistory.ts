export type ClubSeasonOutcome = "Champions" | "Runners-up" | "League season" | "Did not participate";

export interface ClubSeasonHistoryEntry {
  season: number;
  clubName: string;
  outcome: ClubSeasonOutcome;
}

export const LAST_HISTORICAL_CLUB_SEASON = 2026;

interface ClubHistoryDefinition {
  firstSeason: number;
  names?: Array<{ from: number; name: string }>;
  champions: number[];
  runnersUp: number[];
  didNotParticipate?: number[];
}

const CLUB_HISTORY: Record<string, ClubHistoryDefinition> = {
  MI: {
    firstSeason: 2008,
    champions: [2013, 2015, 2017, 2019, 2020],
    runnersUp: [2010],
  },
  CSK: {
    firstSeason: 2008,
    champions: [2010, 2011, 2018, 2021, 2023],
    runnersUp: [2008, 2012, 2013, 2015, 2019],
    didNotParticipate: [2016, 2017],
  },
  KKR: {
    firstSeason: 2008,
    champions: [2012, 2014, 2024],
    runnersUp: [2021],
  },
  RCB: {
    firstSeason: 2008,
    names: [
      { from: 2008, name: "Royal Challengers Bangalore" },
      { from: 2024, name: "Royal Challengers Bengaluru" },
    ],
    champions: [2025, 2026],
    runnersUp: [2009, 2011, 2016],
  },
  SRH: {
    firstSeason: 2013,
    champions: [2016],
    runnersUp: [2018, 2024],
  },
  RR: {
    firstSeason: 2008,
    champions: [2008],
    runnersUp: [2022],
    didNotParticipate: [2016, 2017],
  },
  DC: {
    firstSeason: 2008,
    names: [
      { from: 2008, name: "Delhi Daredevils" },
      { from: 2019, name: "Delhi Capitals" },
    ],
    champions: [],
    runnersUp: [2020],
  },
  PBKS: {
    firstSeason: 2008,
    names: [
      { from: 2008, name: "Kings XI Punjab" },
      { from: 2021, name: "Punjab Kings" },
    ],
    champions: [],
    runnersUp: [2014, 2025],
  },
  GT: {
    firstSeason: 2022,
    champions: [2022],
    runnersUp: [2023, 2026],
  },
  LSG: {
    firstSeason: 2022,
    champions: [],
    runnersUp: [],
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
    const outcome: ClubSeasonOutcome = definition.didNotParticipate?.includes(season)
      ? "Did not participate"
      : definition.champions.includes(season)
        ? "Champions"
        : definition.runnersUp.includes(season)
          ? "Runners-up"
          : "League season";

    return {
      season,
      clubName: clubNameForSeason(definition, fallbackName, season),
      outcome,
    };
  }).reverse();
}
