export const GAME_OVERVIEW_TABS = {
  home: {
    label: "Home",    subtabs: ["overview", "inbox", "social", "news", "calendar", "smat", "international"]
  },
  squad: {
    label: "Squad",    subtabs: ["overview", "roster", "analysis", "playingxi", "captaincy", "tactics", "injuryhub"]
  },
  club: {
    label: "Club",    subtabs: ["overview", "supporters", "board", "office", "staffmanagement", "pitchcurator", "stadiummanagement", "stadiumbuilder"]
  },
  commercial: {
    label: "Commercial",    subtabs: ["overview", "matchday", "partnerships", "retail", "operations", "finance"]
  },
  scouting: {
    label: "Scouting",    subtabs: ["overview", "assignments", "search", "playeranalysis", "leaguescouting", "planner"]
  },
  season: {
    label: "Season",    subtabs: ["overview", "fixtures", "standings", "stats", "playerstats"]
  },
  league: {
    label: "League",    subtabs: ["overview", "legacy", "staff", "trades", "injuries", "seasonanalysis", "minorrecords"]
  },
  history: {
    label: "History",    subtabs: ["overview", "records", "clubhistory", "clubfigures", "leaguehistory", "leaguehalloffame"]
  }
} as const;

export type GameOverviewTab = keyof typeof GAME_OVERVIEW_TABS;

export const PLAYER_PROFILE_PARAM = "playerProfile";
export const STAFF_PROFILE_PARAM = "staffProfile";

export function gameProfileHref(
  pathname: string,
  search: string,
  profile?: { kind: "player" | "staff"; id: string },
): string {
  const params = new URLSearchParams(search);
  params.delete(PLAYER_PROFILE_PARAM);
  params.delete(STAFF_PROFILE_PARAM);
  if (profile) {
    params.set(profile.kind === "player" ? PLAYER_PROFILE_PARAM : STAFF_PROFILE_PARAM, profile.id);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getGameSubTabs(tab: GameOverviewTab, editorEnabled: boolean): readonly string[] {
  const { subtabs } = GAME_OVERVIEW_TABS[tab];
  return tab === "home" && editorEnabled ? [...subtabs, "rules"] : subtabs;
}

export const getSubTabLabel = (subtab: string): string => {
  if (subtab === "overview") return "Overview";
  if (subtab === "board") return "Board & Ownership";
  if (subtab === "supporters") return "Supporters";
  if (subtab === "roster") return "Roster Overview";
  if (subtab === "analysis") return "Squad Analysis";
  if (subtab === "playingxi") return "Playing XIs";
  if (subtab === "captaincy") return "Captaincy";
  if (subtab === "tactics") return "Team Tactics";
  if (subtab === "injuryhub") return "Injury Hub";
  if (subtab === "search") return "Player Search";
  if (subtab === "assignments") return "Scouting Assignments";
  if (subtab === "playeranalysis") return "Player Analysis";
  if (subtab === "leaguescouting") return "League Scouting";
  if (subtab === "seasonanalysis") return "Season Data Analysis";
  if (subtab === "legacy") return "Legacy";
  if (subtab === "reports") return "Scout Reports";
  if (subtab === "planner") return "Auction Planner";
  if (subtab === "trades") return "Trade Hub";
  if (subtab === "injuries") return "Injuries";
  if (subtab === "fixtures") return "Fixtures & Results";
  if (subtab === "standings") return "Standings";
  if (subtab === "stats") return "Season Player Awards";
  if (subtab === "playerstats") return "Player Stats";
  if (subtab === "office") return "Manager Office";
  if (subtab === "staffmanagement") return "Staff Management";
  if (subtab === "staff") return "Staff";
  if (subtab === "pitchcurator") return "Pitch Curator";
  if (subtab === "stadiummanagement") return "Stadium Management";
  if (subtab === "stadiumbuilder") return "Stadium Builder";
  if (subtab === "ticketing") return "Ticketing";
  if (subtab === "matchdayops") return "Matchday Ops";
  if (subtab === "hospitality") return "Hospitality";
  if (subtab === "sponsorships") return "Sponsors";
  if (subtab === "merchandising") return "Retail";
  if (subtab === "marketing") return "Marketing";
  if (subtab === "facilities") return "High-Performance";
  if (subtab === "broadcast") return "Broadcast";
  if (subtab === "operatingcosts") return "Costs";
  if (subtab === "finance") return "Finance";
  if (subtab === "matchday") return "Matchday Revenue";
  if (subtab === "partnerships") return "Partnerships";
  if (subtab === "retail") return "Retail & Marketing";
  if (subtab === "operations") return "Club Operations";
  if (subtab === "calendar") return "Season Calendar";
  if (subtab === "smat") return "SMAT";
  if (subtab === "rules") return "World Rules";
  if (subtab === "international") return "International";
  if (subtab === "social") return "Social Media";
  if (subtab === "news") return "News";
  if (subtab === "records") return "Records";
  if (subtab === "minorrecords") return "Minor Records";
  if (subtab === "clubhistory") return "Club History";
  if (subtab === "clubfigures") return "Club Figures";
  if (subtab === "leaguehistory") return "League History";
  if (subtab === "leaguehalloffame") return "League Hall of Fame";
  return subtab.toUpperCase();
};
