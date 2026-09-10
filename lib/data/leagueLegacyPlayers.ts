import type { Player } from "@/lib/types";

export type LeagueLegacyPlayer = Pick<Player, "id" | "name" | "role" | "nationality" | "iplHistory">;

const seasons = (teamId: string, from: number, to: number, excluded: number[] = []) => (
  Array.from({ length: to - from + 1 }, (_, index) => from + index)
    .filter((season) => !excluded.includes(season))
    .map((season) => ({ teamId, season: String(season), price: 0 }))
);

// Players absent from the active database but required by the all-time legacy
// view. Only team-season membership is needed for finals and award attribution.
export const HISTORICAL_RETIRED_LEGACY_PLAYERS: LeagueLegacyPlayer[] = [
  { id: "legacy-ambati-rayudu", name: "Ambati Rayudu", role: "Batsman", nationality: "Indian", iplHistory: [...seasons("MI", 2010, 2017), ...seasons("CSK", 2018, 2023)] },
  { id: "legacy-kieron-pollard", name: "Kieron Pollard", role: "All-Rounder", nationality: "Overseas", iplHistory: seasons("MI", 2010, 2022) },
  { id: "legacy-lasith-malinga", name: "Lasith Malinga", role: "Pace Bowler", nationality: "Overseas", iplHistory: seasons("MI", 2008, 2019, [2018]) },
  { id: "legacy-harbhajan-singh", name: "Harbhajan Singh", role: "Spin Bowler", nationality: "Indian", iplHistory: [...seasons("MI", 2008, 2017), ...seasons("CSK", 2018, 2020), ...seasons("KKR", 2021, 2021)] },
  { id: "legacy-suresh-raina", name: "Suresh Raina", role: "Batsman", nationality: "Indian", iplHistory: [...seasons("CSK", 2008, 2015), ...seasons("GL", 2016, 2017), ...seasons("CSK", 2018, 2021, [2020])] },
  { id: "legacy-chris-gayle", name: "Chris Gayle", role: "Batsman", nationality: "Overseas", iplHistory: [...seasons("KKR", 2009, 2010), ...seasons("RCB", 2011, 2017), ...seasons("KXIP", 2018, 2021)] },
  { id: "legacy-david-warner", name: "David Warner", role: "Batsman", nationality: "Overseas", iplHistory: [...seasons("DD", 2009, 2013), ...seasons("SRH", 2014, 2021), ...seasons("DC", 2022, 2024)] },
  { id: "legacy-shane-watson", name: "Shane Watson", role: "All-Rounder", nationality: "Overseas", iplHistory: [...seasons("RR", 2008, 2015, [2009]), ...seasons("RCB", 2016, 2017), ...seasons("CSK", 2018, 2020)] },
  { id: "legacy-sachin-tendulkar", name: "Sachin Tendulkar", role: "Batsman", nationality: "Indian", iplHistory: seasons("MI", 2008, 2013) },
  { id: "legacy-dwayne-bravo", name: "Dwayne Bravo", role: "All-Rounder", nationality: "Overseas", iplHistory: [...seasons("MI", 2008, 2010), ...seasons("CSK", 2011, 2015), ...seasons("GL", 2016, 2016), ...seasons("CSK", 2018, 2022)] },
];
