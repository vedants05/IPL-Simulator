import { addDaysToDateKey, dateKeyToLocalDate, localDateToDateKey } from "./careerCalendar";

export const LEAGUE_FIXTURE_SCHEDULE_VERSION = 4;
export const LEAGUE_FIXTURE_COUNT = 70;

const TEAM_COUNT = 10;
const MATCHES_PER_TEAM = 14;
const LAST_FIXTURE_DAY_OFFSET = 61;
const BYE = "__BYE__";

interface Pairing {
  teamA: string;
  teamB: string;
}

export interface ScheduledLeagueFixture extends Pairing {
  id: string;
  matchNumber: number;
  round: number;
  played: false;
  date: string;
  time: string;
}

export interface LeagueFixtureSlot {
  dayOffset: number;
  date: string;
  time: string;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]];

  const result: T[][] = [];
  values.forEach((value, index) => {
    const remaining = [...values.slice(0, index), ...values.slice(index + 1)];
    permutations(remaining).forEach((permutation) => result.push([value, ...permutation]));
  });
  return result;
}

export function getLeagueSeasonStartDate(activeSeason: number): string {
  const startDate = new Date(activeSeason, 2, 31, 12);
  while (startDate.getDay() !== 6) {
    startDate.setDate(startDate.getDate() - 1);
  }
  startDate.setDate(startDate.getDate() - 7);
  return localDateToDateKey(startDate);
}

export function getLeagueFixtureSlot(startDate: string, slotIndex: number): LeagueFixtureSlot {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= LEAGUE_FIXTURE_COUNT) {
    throw new Error(`Invalid league fixture slot: ${slotIndex}`);
  }

  let dayOffset: number;
  let time = "19:30";

  if (slotIndex < 7) {
    dayOffset = slotIndex;
  } else {
    const relativeSlot = slotIndex - 7;
    const weekIndex = Math.floor(relativeSlot / 8) + 1;
    const intraWeekSlot = relativeSlot % 8;

    if (intraWeekSlot === 0) {
      dayOffset = weekIndex * 7;
    } else if (intraWeekSlot === 1) {
      dayOffset = weekIndex * 7 + 1;
      time = "15:30";
    } else if (intraWeekSlot === 2) {
      dayOffset = weekIndex * 7 + 1;
    } else {
      dayOffset = weekIndex * 7 + intraWeekSlot - 1;
    }
  }

  return {
    dayOffset,
    date: addDaysToDateKey(startDate, dayOffset),
    time,
  };
}

function buildOddGroupRounds(group: readonly string[]): Pairing[][] {
  let rotation = [...group, BYE];
  const rounds: Pairing[][] = [];

  for (let roundIndex = 0; roundIndex < group.length; roundIndex++) {
    const round: Pairing[] = [];
    for (let pairIndex = 0; pairIndex < rotation.length / 2; pairIndex++) {
      const left = rotation[pairIndex];
      const right = rotation[rotation.length - 1 - pairIndex];
      if (left === BYE || right === BYE) continue;

      const leftIndex = group.indexOf(left);
      const rightIndex = group.indexOf(right);
      const clockwiseDistance = (rightIndex - leftIndex + group.length) % group.length;
      round.push(clockwiseDistance <= group.length / 2
        ? { teamA: left, teamB: right }
        : { teamA: right, teamB: left });
    }
    rounds.push(round);
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }

  return rounds;
}

function buildBalancedStages(teamIds: readonly string[], seed: number): Pairing[][] {
  const random = createSeededRandom(seed);
  const shuffledTeams = shuffle(teamIds, random);
  const groupA = shuffledTeams.slice(0, 5);
  const groupB = shuffledTeams.slice(5);

  const firstCrossGroupStages: Pairing[][] = [];
  const returnCrossGroupStages: Pairing[][] = [];

  for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
    const firstStage: Pairing[] = [];
    const returnStage: Pairing[] = [];
    for (let teamIndex = 0; teamIndex < 5; teamIndex++) {
      const teamA = groupA[teamIndex];
      const teamB = groupB[(teamIndex + roundIndex) % 5];
      const firstPairing = random() < 0.5
        ? { teamA, teamB }
        : { teamA: teamB, teamB: teamA };
      firstStage.push(firstPairing);
      returnStage.push({ teamA: firstPairing.teamB, teamB: firstPairing.teamA });
    }
    firstCrossGroupStages.push(firstStage);
    returnCrossGroupStages.push(returnStage);
  }

  const groupARounds = buildOddGroupRounds(groupA);
  const groupBRounds = buildOddGroupRounds(groupB);
  const inGroupStages = groupARounds.map((round, index) => [...round, ...groupBRounds[index]]);
  const crossGroupStages = [...firstCrossGroupStages, ...returnCrossGroupStages];

  // Ten five-match cross-group stages and five four-match in-group stages are
  // interleaved across the season. Every club plays once in each cross-group
  // stage and has exactly one bye among the in-group stages.
  const stagePattern = ["cross", "group", "cross", "cross", "group", "cross", "cross", "group", "cross", "cross", "group", "cross", "cross", "group", "cross"] as const;
  let crossIndex = 0;
  let groupIndex = 0;

  return stagePattern.map((stageType) => stageType === "cross"
    ? crossGroupStages[crossIndex++]
    : inGroupStages[groupIndex++]);
}

function canPlayOnDay(previousDays: readonly number[], dayOffset: number, enforceRollingWindow: boolean): boolean {
  const lastPlayedDay = previousDays[previousDays.length - 1] ?? -10;
  if (dayOffset - lastPlayedDay <= 1) return false;
  if (!enforceRollingWindow) return true;

  return previousDays.filter((playedDay) => playedDay >= dayOffset - 4).length < 2;
}

function arrangementScore(playedDays: ReadonlyMap<string, readonly number[]>): number {
  let score = 0;
  playedDays.forEach((days) => {
    days.forEach((day, matchIndex) => {
      const idealDay = matchIndex * LAST_FIXTURE_DAY_OFFSET / (MATCHES_PER_TEAM - 1);
      score += (day - idealDay) ** 2;
    });

    for (let index = 1; index < days.length; index++) {
      const gap = days[index] - days[index - 1];
      const idealGap = LAST_FIXTURE_DAY_OFFSET / (MATCHES_PER_TEAM - 1);
      score += (gap - idealGap) ** 2 * 4;
      if (gap > 8) score += (gap - 8) ** 2 * 10_000;
    }
  });
  return score;
}

function arrangeStages(
  stages: readonly Pairing[][],
  startDate: string,
  teamIds: readonly string[],
  seed: number,
  enforceRollingWindow: boolean,
  reigningChampionTeamId: string,
): Pairing[] | null {
  let bestArrangement: Pairing[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const stageOrders = stages.map((stage) => permutations(stage));

  for (let attempt = 0; attempt < 40; attempt++) {
    const random = createSeededRandom(seed + attempt * 7919 + (enforceRollingWindow ? 0 : 104729));
    const playedDays = new Map(teamIds.map((teamId) => [teamId, [] as number[]]));
    const arrangement: Pairing[] = [];
    let slotIndex = 0;
    let failed = false;

    for (const orders of stageOrders) {
      const possibleOrders = orders
        .filter((order) => slotIndex !== 0
          || order[0].teamA === reigningChampionTeamId
          || order[0].teamB === reigningChampionTeamId)
        .map((order) => {
          let score = 0;
          const valid = order.every((match, orderIndex) => {
            const slot = getLeagueFixtureSlot(startDate, slotIndex + orderIndex);
            const teamADays = playedDays.get(match.teamA)!;
            const teamBDays = playedDays.get(match.teamB)!;
            if (!canPlayOnDay(teamADays, slot.dayOffset, enforceRollingWindow)
              || !canPlayOnDay(teamBDays, slot.dayOffset, enforceRollingWindow)) {
              return false;
            }

            const teamATarget = teamADays.length * LAST_FIXTURE_DAY_OFFSET / (MATCHES_PER_TEAM - 1);
            const teamBTarget = teamBDays.length * LAST_FIXTURE_DAY_OFFSET / (MATCHES_PER_TEAM - 1);
            score += (slot.dayOffset - teamATarget) ** 2 + (slot.dayOffset - teamBTarget) ** 2;
            return true;
          });
          return { order, score, valid };
        })
        .filter(({ valid }) => valid)
        .sort((left, right) => left.score - right.score);

      if (possibleOrders.length === 0) {
        failed = true;
        break;
      }

      // Exploring a few near-optimal stage orders avoids a locally ideal choice
      // creating a poor boundary at a later stage.
      const candidateCount = Math.min(6, possibleOrders.length);
      const chosenOrder = possibleOrders[Math.floor(random() * candidateCount)].order;
      chosenOrder.forEach((match) => {
        const slot = getLeagueFixtureSlot(startDate, slotIndex);
        playedDays.get(match.teamA)!.push(slot.dayOffset);
        playedDays.get(match.teamB)!.push(slot.dayOffset);
        arrangement.push(match);
        slotIndex++;
      });
    }

    if (!failed && arrangement.length === LEAGUE_FIXTURE_COUNT) {
      const score = arrangementScore(playedDays);
      if (score < bestScore) {
        bestScore = score;
        bestArrangement = arrangement;
      }
    }
  }

  return bestArrangement;
}

export function generateBalancedLeagueFixtures(
  teamIds: readonly string[],
  activeSeason: number,
  reigningChampionTeamId: string,
  fixtureSeed: string,
): ScheduledLeagueFixture[] {
  if (teamIds.length !== TEAM_COUNT || new Set(teamIds).size !== TEAM_COUNT) {
    throw new Error(`League fixture generation requires ${TEAM_COUNT} unique teams`);
  }
  if (!teamIds.includes(reigningChampionTeamId)) {
    throw new Error(`Reigning champion ${reigningChampionTeamId} is not in the league`);
  }
  if (!fixtureSeed) {
    throw new Error("League fixture generation requires a career fixture seed");
  }

  const seed = hashString(`${activeSeason}:${reigningChampionTeamId}:${[...teamIds].sort().join("|")}:${fixtureSeed}`);
  const stages = buildBalancedStages(teamIds, seed);
  const startDate = getLeagueSeasonStartDate(activeSeason);
  const arrangement = arrangeStages(stages, startDate, teamIds, seed, true, reigningChampionTeamId)
    ?? arrangeStages(stages, startDate, teamIds, seed, false, reigningChampionTeamId);

  if (!arrangement) {
    throw new Error("Unable to create a balanced league fixture schedule");
  }

  return arrangement.map((match, slotIndex) => {
    const slot = getLeagueFixtureSlot(startDate, slotIndex);
    return {
      id: `match_${slotIndex}_${activeSeason}_${match.teamA}_${match.teamB}`,
      matchNumber: slotIndex + 1,
      round: Math.floor(slotIndex / 5) + 1,
      teamA: match.teamA,
      teamB: match.teamB,
      played: false,
      date: slot.date,
      time: slot.time,
    };
  });
}
