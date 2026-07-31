import { OtherLeagueRecord } from "@/lib/data/leagueRecords";
import type { Player, Team } from "@/lib/types";

export interface FixtureRecordSource {
  id: string;
  played: boolean;
  teamA: string;
  teamB: string;
  winner?: string;
  date?: string;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  scorecard?: {
    inningsA: {
      batting: Array<{ id: string; name: string; runs: number; balls: number; fours: number; sixes: number; notOut: boolean }>;
      bowling: Array<{ id: string; name: string; overs: number; maidens: number; runsConceded: number; wickets: number }>;
    };
    inningsB: {
      batting: Array<{ id: string; name: string; runs: number; balls: number; fours: number; sixes: number; notOut: boolean }>;
      bowling: Array<{ id: string; name: string; overs: number; maidens: number; runsConceded: number; wickets: number }>;
    };
  };
  simulation?: {
    battingFirstTeamId?: string;
    partnerships?: Array<{ runs: number; batterA: string; batterB: string }>;
  };
}

export function computeDynamicLeagueRecords(
  fixtures: FixtureRecordSource[],
  players: Record<string, Player>,
  teams: Record<string, Team>,
  initialRecords?: OtherLeagueRecord[],
): OtherLeagueRecord[] {
  // Parse initial benchmark values from initialRecords if passed
  const getInitialVal = (id: string, defaultVal: number): number => {
    const rec = initialRecords?.find((r) => r.id === id);
    if (!rec) return defaultVal;
    const match = rec.value.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : defaultVal;
  };

  let highestTotal = {
    runs: getInitialVal("highest-total", 287),
    wickets: 3,
    holder: initialRecords?.find((r) => r.id === "highest-total")?.holder ?? "Sunrisers Hyderabad",
    detail: initialRecords?.find((r) => r.id === "highest-total")?.detail ?? "vs RCB · 2024",
  };
  let lowestTotal = {
    runs: getInitialVal("lowest-total", 49),
    wickets: 10,
    holder: initialRecords?.find((r) => r.id === "lowest-total")?.holder ?? "Royal Challengers Bengaluru",
    detail: initialRecords?.find((r) => r.id === "lowest-total")?.detail ?? "vs KKR · 2017",
  };
  let highestChase = {
    runs: getInitialVal("highest-chase", 265),
    wickets: 4,
    holder: initialRecords?.find((r) => r.id === "highest-chase")?.holder ?? "Punjab Kings",
    detail: initialRecords?.find((r) => r.id === "highest-chase")?.detail ?? "vs DC · 2026",
  };
  let individualScore = {
    runs: getInitialVal("individual-score", 175),
    notOut: true,
    holder: initialRecords?.find((r) => r.id === "individual-score")?.holder ?? "Chris Gayle",
    detail: initialRecords?.find((r) => r.id === "individual-score")?.detail ?? "RCB vs PWI · 2013",
    playerNames: initialRecords?.find((r) => r.id === "individual-score")?.playerNames ?? ["Chris Gayle"],
  };
  let bowlingFigures = {
    wickets: getInitialVal("bowling-figures", 6),
    runsConceded: 12,
    holder: initialRecords?.find((r) => r.id === "bowling-figures")?.holder ?? "Alzarri Joseph",
    detail: initialRecords?.find((r) => r.id === "bowling-figures")?.detail ?? "MI vs SRH · 2019",
    playerNames: initialRecords?.find((r) => r.id === "bowling-figures")?.playerNames ?? ["Alzarri Joseph"],
  };
  let battingSeason = {
    runs: getInitialVal("batting-season", 973),
    holder: initialRecords?.find((r) => r.id === "batting-season")?.holder ?? "Virat Kohli",
    detail: initialRecords?.find((r) => r.id === "batting-season")?.detail ?? "RCB · 2016",
    playerNames: initialRecords?.find((r) => r.id === "batting-season")?.playerNames ?? ["Virat Kohli"],
  };
  let bowlingSeason = {
    wickets: getInitialVal("bowling-season", 32),
    holder: initialRecords?.find((r) => r.id === "bowling-season")?.holder ?? "D. Bravo / H. Patel",
    detail: initialRecords?.find((r) => r.id === "bowling-season")?.detail ?? "2013 / 2021",
    playerNames: initialRecords?.find((r) => r.id === "bowling-season")?.playerNames ?? ["Dwayne Bravo", "Harshal Patel"],
  };
  let highestPartnership = {
    runs: getInitialVal("partnership", 229),
    holder: initialRecords?.find((r) => r.id === "partnership")?.holder ?? "Kohli & de Villiers",
    detail: initialRecords?.find((r) => r.id === "partnership")?.detail ?? "RCB vs GL · 2016",
    playerNames: initialRecords?.find((r) => r.id === "partnership")?.playerNames ?? ["Virat Kohli", "AB de Villiers"],
  };

  const seasonPlayerRuns: Record<string, { runs: number; name: string; teamId?: string }> = {};
  const seasonPlayerWickets: Record<string, { wickets: number; name: string; teamId?: string }> = {};

  fixtures.forEach((fixture) => {
    if (!fixture.played || !fixture.scorecard) return;

    const teamAName = teams[fixture.teamA]?.name ?? fixture.teamA;
    const teamBName = teams[fixture.teamB]?.name ?? fixture.teamB;
    const teamAShort = teams[fixture.teamA]?.shortName ?? fixture.teamA;
    const teamBShort = teams[fixture.teamB]?.shortName ?? fixture.teamB;
    const matchYear = fixture.date ? new Date(fixture.date).getFullYear().toString() : "Career";

    // 1. Team Totals & Lowest Totals
    if (fixture.scoreA) {
      if (
        fixture.scoreA.runs > highestTotal.runs ||
        (fixture.scoreA.runs === highestTotal.runs && fixture.scoreA.wickets < highestTotal.wickets)
      ) {
        highestTotal = {
          runs: fixture.scoreA.runs,
          wickets: fixture.scoreA.wickets,
          holder: teamAName,
          detail: `vs ${teamBShort} · ${matchYear}`,
        };
      }
      if (fixture.scoreA.wickets === 10 && fixture.scoreA.runs < lowestTotal.runs) {
        lowestTotal = {
          runs: fixture.scoreA.runs,
          wickets: 10,
          holder: teamAName,
          detail: `vs ${teamBShort} · ${matchYear}`,
        };
      }
    }

    if (fixture.scoreB) {
      if (
        fixture.scoreB.runs > highestTotal.runs ||
        (fixture.scoreB.runs === highestTotal.runs && fixture.scoreB.wickets < highestTotal.wickets)
      ) {
        highestTotal = {
          runs: fixture.scoreB.runs,
          wickets: fixture.scoreB.wickets,
          holder: teamBName,
          detail: `vs ${teamAShort} · ${matchYear}`,
        };
      }
      if (fixture.scoreB.wickets === 10 && fixture.scoreB.runs < lowestTotal.runs) {
        lowestTotal = {
          runs: fixture.scoreB.runs,
          wickets: 10,
          holder: teamBName,
          detail: `vs ${teamAShort} · ${matchYear}`,
        };
      }
    }

    // 2. Highest Chase
    const battingFirstTeamId = fixture.simulation?.battingFirstTeamId ?? fixture.teamA;
    const chasingTeamId = battingFirstTeamId === fixture.teamA ? fixture.teamB : fixture.teamA;
    const chasingScore = chasingTeamId === fixture.teamA ? fixture.scoreA : fixture.scoreB;
    const chasingTeamName = chasingTeamId === fixture.teamA ? teamAName : teamBName;
    const defendingTeamShort = chasingTeamId === fixture.teamA ? teamBShort : teamAShort;
    if (fixture.winner === chasingTeamId && chasingScore) {
      if (chasingScore.runs > highestChase.runs) {
        highestChase = {
          runs: chasingScore.runs,
          wickets: chasingScore.wickets,
          holder: chasingTeamName,
          detail: `vs ${teamAShort} · ${matchYear}`,
        };
      }
    }

    // 3. Individual Scores & Season Runs Accumulation
    [
      { innings: fixture.scorecard.inningsA, team: teamAShort, opp: teamBShort, teamId: fixture.teamA },
      { innings: fixture.scorecard.inningsB, team: teamBShort, opp: teamAShort, teamId: fixture.teamB },
    ].forEach(({ innings, team, opp, teamId }) => {
      innings.batting.forEach((b) => {
        if (b.runs > individualScore.runs) {
          individualScore = {
            runs: b.runs,
            notOut: b.notOut,
            holder: b.name,
            detail: `${team} vs ${opp} · ${matchYear}`,
            playerNames: [b.name],
          };
        }

        if (!seasonPlayerRuns[b.id]) {
          seasonPlayerRuns[b.id] = { runs: 0, name: b.name, teamId };
        }
        seasonPlayerRuns[b.id].runs += b.runs;
      });

      innings.bowling.forEach((bw) => {
        const isBetterBowling =
          bw.wickets > bowlingFigures.wickets ||
          (bw.wickets === bowlingFigures.wickets && bw.runsConceded < bowlingFigures.runsConceded);

        if (isBetterBowling) {
          bowlingFigures = {
            wickets: bw.wickets,
            runsConceded: bw.runsConceded,
            holder: bw.name,
            detail: `${team} vs ${opp} · ${matchYear}`,
            playerNames: [bw.name],
          };
        }

        if (!seasonPlayerWickets[bw.id]) {
          seasonPlayerWickets[bw.id] = { wickets: 0, name: bw.name, teamId };
        }
        seasonPlayerWickets[bw.id].wickets += bw.wickets;
      });
    });

    // 4. Partnerships
    if (fixture.simulation?.partnerships) {
      fixture.simulation.partnerships.forEach((p) => {
        if (p.runs > highestPartnership.runs) {
          highestPartnership = {
            runs: p.runs,
            holder: `${p.batterA} & ${p.batterB}`,
            detail: `${teamAShort} vs ${teamBShort} · ${matchYear}`,
            playerNames: [p.batterA, p.batterB],
          };
        }
      });
    }
  });

  // 5. Evaluate Season Records
  Object.values(seasonPlayerRuns).forEach((record) => {
    if (record.runs > battingSeason.runs) {
      const teamShort = record.teamId && teams[record.teamId] ? teams[record.teamId].shortName : "IPL";
      battingSeason = {
        runs: record.runs,
        holder: record.name,
        detail: `${teamShort} · Current Season`,
        playerNames: [record.name],
      };
    }
  });

  Object.values(seasonPlayerWickets).forEach((record) => {
    if (record.wickets > bowlingSeason.wickets) {
      const teamShort = record.teamId && teams[record.teamId] ? teams[record.teamId].shortName : "IPL";
      bowlingSeason = {
        wickets: record.wickets,
        holder: record.name,
        detail: `${teamShort} · Current Season`,
        playerNames: [record.name],
      };
    }
  });

  return [
    {
      id: "highest-total",
      label: "Highest team total",
      value: `${highestTotal.runs}/${highestTotal.wickets}`,
      holder: highestTotal.holder,
      detail: highestTotal.detail,
    },
    {
      id: "lowest-total",
      label: "Lowest team total",
      value: `${lowestTotal.runs}`,
      holder: lowestTotal.holder,
      detail: lowestTotal.detail,
    },
    {
      id: "highest-chase",
      label: "Highest successful chase",
      value: `${highestChase.runs}/${highestChase.wickets}`,
      holder: highestChase.holder,
      detail: highestChase.detail,
    },
    {
      id: "individual-score",
      label: "Highest individual score",
      value: `${individualScore.runs}${individualScore.notOut ? "*" : ""}`,
      holder: individualScore.holder,
      detail: individualScore.detail,
      playerNames: individualScore.playerNames,
    },
    {
      id: "bowling-figures",
      label: "Best bowling figures",
      value: `${bowlingFigures.wickets}/${bowlingFigures.runsConceded}`,
      holder: bowlingFigures.holder,
      detail: bowlingFigures.detail,
      playerNames: bowlingFigures.playerNames,
    },
    {
      id: "batting-season",
      label: "Best batting season",
      value: `${battingSeason.runs} runs`,
      holder: battingSeason.holder,
      detail: battingSeason.detail,
      playerNames: battingSeason.playerNames,
    },
    {
      id: "bowling-season",
      label: "Most wickets in a season",
      value: `${bowlingSeason.wickets}`,
      holder: bowlingSeason.holder,
      detail: bowlingSeason.detail,
      playerNames: bowlingSeason.playerNames,
    },
    {
      id: "partnership",
      label: "Highest partnership",
      value: `${highestPartnership.runs}`,
      holder: highestPartnership.holder,
      detail: highestPartnership.detail,
      playerNames: highestPartnership.playerNames,
    },
  ];
}
