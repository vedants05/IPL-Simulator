"use client";

import { Award, MessageCircle, Shield, Users, Zap } from "lucide-react";
import type { Player, Team } from "@/lib/types";
import { SOCIAL_POST_TEMPLATES, type SeasonPhase, type SocialPostTopic } from "@/lib/data/socialMediaPosts";
import { SOCIAL_OPINION_TEMPLATES, type SocialOpinionTrigger } from "@/lib/data/socialMediaOpinions";
import { getTriggeredTeamSocialComments } from "@/lib/data/socialMediaTeamComments";

interface SocialPlayerStats {
  id: string; runs: number; balls: number; wickets: number; runsConceded: number; oversBowled: number; matches: number;
}
interface SocialFixture {
  id: string; matchNumber: number; teamA: string; teamB: string; played: boolean; winner?: string; date?: string;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  scorecard?: {
    inningsA: { batting: SocialScorecardPlayer[]; bowling: SocialScorecardPlayer[] };
    inningsB: { batting: SocialScorecardPlayer[]; bowling: SocialScorecardPlayer[] };
  };
  stage?: string;
}
interface SocialScorecardPlayer {
  id: string; runs?: number; balls?: number; fours?: number; sixes?: number; wickets?: number; runsConceded?: number; overs?: number;
}
interface SocialMediaPageProps {
  team: Team; players: Record<string, Player>; playerStats: Record<string, SocialPlayerStats>;
  battingFirstXI: string[]; bowlingFirstXI: string[]; fixtures: SocialFixture[];
  captainId: string | null; impactPlayerIds: Array<string | null>; currentDate: string; currentSeason: number;
}
interface FanPost {
  id: string; username: string; comment: string; topic: SocialPostTopic; tag: string; publishedAt: string;
}

const displayGameDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
};

const sortPostsChronologically = (posts: FanPost[]) => [...posts].sort((left, right) => (
  left.publishedAt.localeCompare(right.publishedAt) || left.id.localeCompare(right.id)
));

const playerRating = (player: Player) => Math.max(player.currentBatting, player.currentBowling);
const isPrimaryBatter = (player: Player) => (
  player.role === "Batsman"
  || player.role === "WK-Batsman"
  || Boolean(player.isWicketkeeper)
  || (player.role === "All-Rounder" && player.currentBatting >= player.currentBowling)
);
const isPrimaryBowler = (player: Player) => (
  player.role === "Pace Bowler"
  || player.role === "Spin Bowler"
  || (player.role === "All-Rounder" && player.currentBowling > player.currentBatting)
);
const battingAverage = (stats?: SocialPlayerStats) => stats?.matches ? stats.runs / stats.matches : 0;
const economy = (stats?: SocialPlayerStats) => stats?.oversBowled ? stats.runsConceded / stats.oversBowled : 0;
const formatAuctionPrice = (price: number) => price >= 100
  ? `₹${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)} Cr`
  : `₹${price} Lakhs`;
const inningsEconomy = (runs: number, overs: number) => {
  const wholeOvers = Math.floor(overs);
  const balls = wholeOvers * 6 + Math.round((overs - wholeOvers) * 10);
  return balls > 0 ? runs / balls * 6 : 0;
};
const isCloseFixture = (fixture: SocialFixture) => {
  if (!fixture.scoreA || !fixture.scoreB || !fixture.winner) return false;
  if (fixture.winner === fixture.teamB) return fixture.scoreB.overs >= 19;
  return Math.abs(fixture.scoreA.runs - fixture.scoreB.runs) <= 15;
};
const TEAM_COLOUR_NAMES: Record<string, string> = {
  MI: "blue and gold", CSK: "yellow", KKR: "purple and gold", RCB: "red and black", DC: "red and blue",
  SRH: "orange and black", PBKS: "red and silver", RR: "pink and blue", GT: "navy and gold", LSG: "blue and orange",
};

function positionSuitability(player: Player, lineup: string[]) {
  const slot = Math.max(0, lineup.indexOf(player.id));
  if (slot <= 1) return { positionName: "Opening", isSuitable: Boolean(player.isOpener), reason: player.isOpener ? "is a recognised opener" : "is normally a middle-order batter" };
  if (slot === 2) return { positionName: "#3", isSuitable: Boolean(player.hasBattedAt3), reason: player.hasBattedAt3 ? "has experience at number three" : "has rarely batted at number three" };
  if (slot === 3) return { positionName: "#4", isSuitable: Boolean(player.hasBattedAt4), reason: player.hasBattedAt4 ? "is comfortable at number four" : "is being used outside a familiar role" };
  if (slot === 4) return { positionName: "#5", isSuitable: Boolean(player.hasBattedAt5), reason: player.hasBattedAt5 ? "has experience at number five" : "has limited experience in that position" };
  if (slot <= 6) return { positionName: `#${slot + 1}`, isSuitable: Boolean(player.isFinisher || player.hasBattedAt6 || player.hasBattedAt7), reason: player.isFinisher ? "is a recognised finisher" : "is being asked to finish without a proven history there" };
  return { positionName: `#${slot + 1}`, isSuitable: true, reason: "has a conventional lower-order role" };
}

function derivePhase(teamId: string, fixtures: SocialFixture[], currentDate: string): { phase: SeasonPhase; label: string; recent?: SocialFixture } {
  const teamFixtures = fixtures.filter((fixture) => fixture.teamA === teamId || fixture.teamB === teamId);
  const played = teamFixtures.filter((fixture) => fixture.played).sort((a, b) => a.matchNumber - b.matchNumber);
  const regularPlayed = played.filter((fixture) => !fixture.stage).length;
  const recent = played.at(-1);
  const month = Number(currentDate.slice(5, 7));
  const hasFutureMatch = teamFixtures.some((fixture) => !fixture.played);
  const champion = played.some((fixture) => fixture.stage === "final" && fixture.winner === teamId);
  const eliminatedInPlayoff = Boolean(
    recent?.stage
    && recent.winner
    && recent.winner !== teamId
    && ["eliminator", "qualifier2", "final"].includes(recent.stage),
  );
  let phase: SeasonPhase;
  if (regularPlayed === 0) phase = month <= 1 || month >= 11 ? "post_auction" : "pre_season";
  else if (eliminatedInPlayoff) phase = "knocked_out";
  else if (regularPlayed <= 4) phase = "early_season";
  else if (regularPlayed <= 10) phase = "mid_season";
  else if (regularPlayed < 14 || hasFutureMatch || champion) phase = "late_season";
  else phase = month >= 6 ? "next_season" : "knocked_out";
  const lastThree = played.slice(-3).map((fixture) => fixture.winner === teamId ? "W" : "L").join("–");
  return {
    phase,
    recent,
    label: recent ? `After Match ${recent.matchNumber}${lastThree ? ` · ${lastThree}` : ""}` : phase === "post_auction" ? "Post-auction reaction" : "Pre-season discussion",
  };
}

function buildFeed(props: SocialMediaPageProps): { posts: FanPost[]; phase: SeasonPhase; label: string } {
  const { team, players, playerStats, battingFirstXI, bowlingFirstXI, fixtures } = props;
  const squad = team.squad.map((id) => players[id]).filter((player): player is Player => Boolean(player));
  const fallback = [...squad].sort((a, b) => playerRating(b) - playerRating(a));
  const selectedIds = new Set([...battingFirstXI, ...bowlingFirstXI]);
  const selected = squad.filter((player) => selectedIds.has(player.id));
  const bench = squad.filter((player) => !selectedIds.has(player.id)).sort((a, b) => playerRating(b) - playerRating(a));
  const batters = squad.filter((player) => player.currentBatting >= 68).sort((a, b) => battingAverage(playerStats[b.id]) - battingAverage(playerStats[a.id]));
  const bowlers = squad.filter((player) => player.currentBowling >= 68).sort((a, b) => (playerStats[b.id]?.wickets ?? 0) - (playerStats[a.id]?.wickets ?? 0));
  const underperformers = [...selected].filter((player) => (playerStats[player.id]?.matches ?? 0) >= 2).sort((a, b) => {
    const form = (player: Player) => player.currentBatting >= player.currentBowling
      ? battingAverage(playerStats[player.id])
      : (playerStats[player.id]?.wickets ?? 0) * 12 - economy(playerStats[player.id]);
    return form(a) - form(b);
  });
  const keepers = selected.filter((player) => player.isWicketkeeper || player.role === "WK-Batsman");
  const keeper = keepers[0] ?? squad.find((player) => player.isWicketkeeper || player.role === "WK-Batsman");
  const captain = (props.captainId ? players[props.captainId] : undefined) ?? selected.find((player) => (player.captaincy ?? 0) >= 80);
  const impactPlayers = props.impactPlayerIds.map((id) => id ? players[id] : undefined).filter((player): player is Player => Boolean(player));
  const youngsters = squad.filter((player) => player.age <= 23);
  const veterans = squad.filter((player) => player.age >= 33);
  const openers = squad.filter((player) => player.isOpener || player.onlyOpensOrBenched);
  const finishers = squad.filter((player) => player.isFinisher || player.hasBattedAt6 || player.hasBattedAt7);
  const latestPrice = (player?: Player) => player?.iplHistory.filter((entry) => entry.teamId === team.id && entry.price > 0)
    .sort((a, b) => Number(b.season) - Number(a.season))[0]?.price;
  const pricedPlayers = squad.filter((player) => latestPrice(player) !== undefined).sort((a, b) => (latestPrice(b) ?? 0) - (latestPrice(a) ?? 0));
  const orangeCapCandidates = squad.filter((player) => player.currentBatting >= 80 && (
    player.isOpener || player.onlyOpensOrBenched || player.hasBattedAt3 || player.role === "Batsman" || player.role === "WK-Batsman"
  )).sort((a, b) => b.currentBatting - a.currentBatting || (b.reputation ?? 0) - (a.reputation ?? 0));
  const breakoutCandidates = squad.filter((player) => (
    player.age <= 25 && playerRating(player) >= 74 && playerRating(player) <= 84 && player.iplStats.matches <= 25
  )).sort((a, b) => playerRating(b) - playerRating(a));
  const iplDebutants = selected.filter((player) => player.iplStats.matches === 0);
  const phaseContext = derivePhase(team.id, fixtures, props.currentDate);
  const playedTeamFixtures = fixtures.filter((fixture) => fixture.played && (fixture.teamA === team.id || fixture.teamB === team.id));
  const recent = phaseContext.recent;
  const closeRecentMatch = Boolean(recent && isCloseFixture(recent));
  const recentMatchStats: Record<string, SocialPlayerStats> = {};
  if (recent?.scorecard) {
    const userBatting = recent.teamA === team.id ? recent.scorecard.inningsA.batting : recent.scorecard.inningsB.batting;
    const userBowling = recent.teamA === team.id ? recent.scorecard.inningsB.bowling : recent.scorecard.inningsA.bowling;
    userBatting.forEach((entry) => {
      if (!entry.id || (entry.balls ?? 0) <= 0) return;
      recentMatchStats[entry.id] = {
        id: entry.id, runs: entry.runs ?? 0, balls: entry.balls ?? 0,
        wickets: 0, runsConceded: 0, oversBowled: 0, matches: 1,
      };
    });
    userBowling.forEach((entry) => {
      if (!entry.id || (entry.overs ?? 0) <= 0) return;
      const current = recentMatchStats[entry.id] ?? {
        id: entry.id, runs: 0, balls: 0, wickets: 0, runsConceded: 0, oversBowled: 0, matches: 1,
      };
      recentMatchStats[entry.id] = {
        ...current,
        wickets: entry.wickets ?? 0,
        runsConceded: entry.runsConceded ?? 0,
        oversBowled: entry.overs ?? 0,
      };
    });
  }
  const recentPerformers = Object.keys(recentMatchStats)
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player))
    .sort((left, right) => {
      const leftStats = recentMatchStats[left.id];
      const rightStats = recentMatchStats[right.id];
      const impact = (stats: SocialPlayerStats) => stats.runs + stats.wickets * 22 - economy(stats) * (stats.oversBowled > 0 ? 1 : 0);
      return impact(rightStats) - impact(leftStats);
    });

  if (["early_season", "mid_season", "late_season", "knocked_out"].includes(phaseContext.phase) && recent?.scorecard) {
    const userWon = recent.winner === team.id;
    const opponentId = recent.teamA === team.id ? recent.teamB : recent.teamA;
    const userScore = recent.teamA === team.id ? recent.scoreA : recent.scoreB;
    const opponentScore = recent.teamA === team.id ? recent.scoreB : recent.scoreA;
    const userBatting = recent.teamA === team.id ? recent.scorecard.inningsA.batting : recent.scorecard.inningsB.batting;
    const userBowling = recent.teamA === team.id ? recent.scorecard.inningsB.bowling : recent.scorecard.inningsA.bowling;
    const opponentBatting = recent.teamA === team.id ? recent.scorecard.inningsB.batting : recent.scorecard.inningsA.batting;
    const opponentBowling = recent.teamA === team.id ? recent.scorecard.inningsA.bowling : recent.scorecard.inningsB.bowling;
    const currentParticipantIds = new Set<string>([
      ...userBatting.map((entry) => entry.id),
      ...userBowling.map((entry) => entry.id),
    ].filter((id): id is string => Boolean(id)));
    const participantsFor = (fixture: SocialFixture): Set<string> => {
      if (!fixture.scorecard) return new Set<string>();
      const batting = fixture.teamA === team.id ? fixture.scorecard.inningsA.batting : fixture.scorecard.inningsB.batting;
      const bowling = fixture.teamA === team.id ? fixture.scorecard.inningsB.bowling : fixture.scorecard.inningsA.bowling;
      return new Set<string>([...batting, ...bowling].map((entry) => entry.id).filter((id): id is string => Boolean(id)));
    };
    const previousFixture = playedTeamFixtures
      .filter((fixture) => fixture.matchNumber < recent.matchNumber && fixture.scorecard)
      .sort((a, b) => b.matchNumber - a.matchNumber)[0];
    const previousParticipantIds = previousFixture ? participantsFor(previousFixture) : new Set<string>();
    const priorSeasonParticipantIds = new Set<string>(
      playedTeamFixtures
        .filter((fixture) => fixture.matchNumber < recent.matchNumber && fixture.scorecard)
        .flatMap((fixture) => Array.from(participantsFor(fixture))),
    );
    const battingPerformances = userBatting.filter((entry) => (
      (entry.balls ?? 0) > 0 && Boolean(players[entry.id] && isPrimaryBatter(players[entry.id]))
    ))
      .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0));
    const bowlingPerformances = userBowling.filter((entry) => (
      (entry.overs ?? 0) > 0 && Boolean(players[entry.id] && isPrimaryBowler(players[entry.id]))
    ))
      .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.runsConceded ?? 0) - (b.runsConceded ?? 0));
    const topBat = battingPerformances[0];
    const secondBat = battingPerformances[1];
    const topBowler = bowlingPerformances[0];
    const economicalBowler = [...bowlingPerformances].sort((a, b) => (
      inningsEconomy(a.runsConceded ?? 0, a.overs ?? 0) - inningsEconomy(b.runsConceded ?? 0, b.overs ?? 0)
    ))[0];
    const expensiveBowler = [...bowlingPerformances].sort((a, b) => (
      inningsEconomy(b.runsConceded ?? 0, b.overs ?? 0) - inningsEconomy(a.runsConceded ?? 0, a.overs ?? 0)
    ))[0];
    const quietBat = [...battingPerformances].filter((entry) => (
      (entry.balls ?? 0) >= 8 && Boolean(players[entry.id] && isPrimaryBatter(players[entry.id]))
    ))
      .sort((a, b) => (a.runs ?? 0) - (b.runs ?? 0))[0];
    const seasonBat = [...squad].filter((player) => (playerStats[player.id]?.balls ?? 0) > 0)
      .sort((a, b) => (playerStats[b.id]?.runs ?? 0) - (playerStats[a.id]?.runs ?? 0))[0];
    const seasonBowler = [...squad].filter((player) => (playerStats[player.id]?.oversBowled ?? 0) > 0)
      .sort((a, b) => (playerStats[b.id]?.wickets ?? 0) - (playerStats[a.id]?.wickets ?? 0))[0];
    const wins = playedTeamFixtures.filter((fixture) => fixture.winner === team.id).length;
    const losses = playedTeamFixtures.filter((fixture) => Boolean(fixture.winner) && fixture.winner !== team.id).length;
    const reactions: Array<{ text: string; topic: SocialPostTopic; publishedAt?: string }> = [];
    const add = (text: string, topic: SocialPostTopic = "individual_match", publishedAt?: string) => reactions.push({ text, topic, publishedAt });
    add(`${userWon ? "That is a valuable win" : "That defeat hurts"} against ${opponentId}. ${team.shortName} now have ${wins} win${wins === 1 ? "" : "s"} and ${losses} loss${losses === 1 ? "" : "es"}.`, "team_form");
    if (userScore && opponentScore) add(`${team.shortName} made ${userScore.runs}/${userScore.wickets}, while ${opponentId} finished on ${opponentScore.runs}/${opponentScore.wickets}. The result reflects what actually happened, not pre-season expectations.`);
    if (topBat && (topBat.runs ?? 0) >= 25) {
      const name = players[topBat.id]?.name ?? "Our leading batter";
      const sr = (topBat.balls ?? 0) > 0 ? ((topBat.runs ?? 0) / (topBat.balls ?? 1) * 100).toFixed(1) : "0.0";
      add(`${name}'s ${topBat.runs ?? 0} from ${topBat.balls ?? 0} balls at a strike rate of ${sr} was ${userWon ? "a major part of the win" : "one of the few positives in the defeat"}.`);
    }
    if (secondBat && (secondBat.runs ?? 0) >= 30) add(`${players[secondBat.id]?.name ?? "Another batter"} also contributed ${secondBat.runs} from ${secondBat.balls} balls. That support mattered alongside the leading score.`);
    if (topBowler && (topBowler.wickets ?? 0) >= 2) add(`${players[topBowler.id]?.name ?? "Our leading bowler"} led the attack with ${topBowler.wickets}/${topBowler.runsConceded}. That is the bowling performance supporters should be discussing.`);
    if (economicalBowler && (economicalBowler.overs ?? 0) >= 3 && inningsEconomy(economicalBowler.runsConceded ?? 0, economicalBowler.overs ?? 0) <= 7.5) {
      const econ = inningsEconomy(economicalBowler.runsConceded ?? 0, economicalBowler.overs ?? 0).toFixed(1);
      add(`${players[economicalBowler.id]?.name ?? "The most economical bowler"} conceded ${economicalBowler.runsConceded} in ${economicalBowler.overs} overs—an economy of ${econ}. That spell gave the attack control.`);
    }
    if (expensiveBowler && (expensiveBowler.overs ?? 0) >= 2 && inningsEconomy(expensiveBowler.runsConceded ?? 0, expensiveBowler.overs ?? 0) >= 11) add(`${players[expensiveBowler.id]?.name ?? "One bowler"} went for ${expensiveBowler.runsConceded} in ${expensiveBowler.overs} overs. The role and matchups need reviewing before the next game.`);
    if (quietBat && (quietBat.runs ?? 0) <= 15) add(`${players[quietBat.id]?.name ?? "One batter"} managed ${quietBat.runs} from ${quietBat.balls} balls. It is fair for supporters to expect a stronger contribution next time.`);
    if (seasonBat) {
      const stats = playerStats[seasonBat.id];
      add(`${seasonBat.name} currently leads ${team.shortName}'s season scoring with ${stats.runs} runs from ${stats.matches} match${stats.matches === 1 ? "" : "es"}.`, "team_form");
    }
    if (seasonBowler) {
      const stats = playerStats[seasonBowler.id];
      add(`${seasonBowler.name} is the team's leading wicket-taker so far with ${stats.wickets} wicket${stats.wickets === 1 ? "" : "s"}.`, "team_form");
    }
    if (isCloseFixture(recent)) add(`That match went deep enough for small moments to decide it. ${team.shortName} and ${opponentId} were still under pressure at the end.`, "clutch");
    if (phaseContext.phase === "knocked_out") {
      const stageName = recent.stage === "eliminator"
        ? "the Eliminator"
        : recent.stage === "qualifier2"
          ? "Qualifier 2"
          : recent.stage === "final"
            ? "the Final"
            : "the league phase";
      const scoreDetail = userScore && opponentScore
        ? ` We made ${userScore.runs}/${userScore.wickets} and ${opponentId} made ${opponentScore.runs}/${opponentScore.wickets}.`
        : "";
      const eliminationLead = recent.stage
        ? `${team.shortName} have been knocked out by ${opponentId} in ${stageName}.`
        : `${team.shortName} have been eliminated at the end of the league phase after today's match against ${opponentId}.`;
      add(
        `${eliminationLead}${scoreDetail} That is the result ending our season today.`,
        "team_form",
        recent.date ?? props.currentDate,
      );
      add(`${team.shortName}'s season is over after ${wins} win${wins === 1 ? "" : "s"} and ${losses} loss${losses === 1 ? "" : "es"}. Any review now has to be based on the players who actually appeared this season.`, "team_form", recent.date ?? props.currentDate);
    }

    // An ex-player reaction requires all three facts: the player previously
    // represented this club, played for today's opponent, and did something
    // notable in this actual match.
    const opponentBattingById = new Map(opponentBatting.map((entry) => [entry.id, entry]));
    const opponentBowlingById = new Map(opponentBowling.map((entry) => [entry.id, entry]));
    const opponentParticipantIds = new Set<string>([
      ...opponentBatting.map((entry) => entry.id),
      ...opponentBowling.map((entry) => entry.id),
    ].filter((id): id is string => Boolean(id)));
    Array.from(opponentParticipantIds).forEach((playerId) => {
      const formerPlayer = players[playerId];
      if (!formerPlayer || formerPlayer.currentTeamId !== opponentId) return;
      const previouslyRepresentedClub = formerPlayer.iplHistory.some((entry) => (
        entry.teamId === team.id && entry.teamId !== formerPlayer.currentTeamId
      ));
      if (!previouslyRepresentedClub) return;
      const batting = opponentBattingById.get(playerId);
      const bowling = opponentBowlingById.get(playerId);
      if ((batting?.runs ?? 0) >= 40) {
        add(`${formerPlayer.name}, a former ${team.shortName} player, actually scored ${batting?.runs ?? 0} from ${batting?.balls ?? 0} balls against us today. That is the kind of ex-player performance supporters are entitled to discuss.`, "ex_player");
      } else if ((bowling?.wickets ?? 0) >= 2) {
        add(`${formerPlayer.name}, who previously represented ${team.shortName}, actually took ${bowling?.wickets ?? 0}/${bowling?.runsConceded ?? 0} against us today. This one genuinely was an ex-player influencing the match.`, "ex_player");
      }
    });
    if (playedTeamFixtures.length <= 4) {
      add(`${playedTeamFixtures.length} match${playedTeamFixtures.length === 1 ? "" : "es"} is still a small sample, so selection debates should use the evidence without pretending the season is already settled.`, "team_form");
    }

    const opinionSeed = recent.matchNumber * 31 + (userWon ? 11 : 5);
    const addOpinions = (trigger: SocialOpinionTrigger, player: Player | undefined, alternative: Player | undefined, count = 2) => {
      if (!player && trigger !== "selection_patience" && trigger !== "promote_bench") return;
      const available = SOCIAL_OPINION_TEMPLATES.filter((template) => template.trigger === trigger);
      for (let offset = 0; offset < Math.min(count, available.length); offset += 1) {
        const template = available[(opinionSeed + offset * 7 + (player?.id.length ?? 0)) % available.length];
        add(
          template.text
            .replaceAll("{player}", player?.name ?? "this player")
            .replaceAll("{alternative}", alternative?.name ?? "a bench option"),
          trigger.includes("bowler") || trigger === "match_bowling" ? "individual_match" : "team_form",
        );
      }
    };
    // Ordinary form comments must concern somebody who actually played in the
    // latest match. Selection changes receive their own explicit reactions.
    const seasonBatters = squad.filter((player) => (
      currentParticipantIds.has(player.id)
      && isPrimaryBatter(player)
      && (playerStats[player.id]?.balls ?? 0) > 0
    ));
    const seasonBowlers = squad.filter((player) => (
      currentParticipantIds.has(player.id)
      && isPrimaryBowler(player)
      && (playerStats[player.id]?.oversBowled ?? 0) > 0
    ));
    const poorBatters = seasonBatters.filter((player) => {
      const stats = playerStats[player.id];
      const average = stats.runs / Math.max(1, stats.matches);
      const strikeRate = stats.runs / Math.max(1, stats.balls) * 100;
      return stats.matches >= 2 && (average < 22 || (stats.balls >= 30 && strikeRate < 115));
    }).sort((a, b) => battingAverage(playerStats[a.id]) - battingAverage(playerStats[b.id]));
    const poorBowlers = seasonBowlers.filter((player) => {
      const stats = playerStats[player.id];
      return stats.oversBowled >= 6 && economy(stats) > 10.5 && stats.wickets < Math.max(2, stats.matches);
    }).sort((a, b) => economy(playerStats[b.id]) - economy(playerStats[a.id]));
    const strongBatters = seasonBatters.filter((player) => {
      const stats = playerStats[player.id];
      return stats.runs >= 80 && (battingAverage(stats) >= 35 || stats.runs / Math.max(1, stats.balls) * 100 >= 145);
    }).sort((a, b) => (playerStats[b.id]?.runs ?? 0) - (playerStats[a.id]?.runs ?? 0));
    const strongBowlers = seasonBowlers.filter((player) => {
      const stats = playerStats[player.id];
      return stats.wickets >= 3 && economy(stats) <= 9;
    }).sort((a, b) => (playerStats[b.id]?.wickets ?? 0) - (playerStats[a.id]?.wickets ?? 0));

    // Auction value is assessed only after a meaningful, phase-sensitive
    // sample and every claim prints the statistics that triggered it.
    const minimumPriceSample = phaseContext.phase === "early_season" ? 2
      : phaseContext.phase === "mid_season" ? 4
        : 6;
    const priceReactions: Array<{ player: Player; price: number; text: string }> = [];
    pricedPlayers.forEach((player) => {
      const price = latestPrice(player);
      const stats = playerStats[player.id];
      if (price === undefined || !stats || stats.matches < minimumPriceSample) return;
      if (isPrimaryBatter(player) && stats.balls >= minimumPriceSample * 10) {
        const average = stats.runs / Math.max(1, stats.matches);
        const strikeRate = stats.runs / Math.max(1, stats.balls) * 100;
        const strong = average >= 35 && strikeRate >= 135;
        const poor = average < 22 || strikeRate < 115;
        if (price >= 800 && strong) {
          priceReactions.push({ player, price, text: `${player.name} cost ${formatAuctionPrice(price)}, but ${stats.runs} runs at ${average.toFixed(1)} per match and a ${strikeRate.toFixed(1)} strike rate is backing up that investment.` });
        } else if (price >= 800 && poor) {
          priceReactions.push({ player, price, text: `${formatAuctionPrice(price)} created major expectations for ${player.name}. After ${stats.matches} matches, ${stats.runs} runs at ${average.toFixed(1)} per match and a ${strikeRate.toFixed(1)} strike rate is not enough for that price.` });
        } else if (price <= 300 && strong) {
          priceReactions.push({ player, price, text: `${player.name} is outperforming a ${formatAuctionPrice(price)} fee: ${stats.runs} runs at ${average.toFixed(1)} per match with a ${strikeRate.toFixed(1)} strike rate looks like genuine auction value.` });
        }
      } else if (isPrimaryBowler(player) && stats.oversBowled >= minimumPriceSample * 2) {
        const bowlingEconomy = economy(stats);
        const wicketsPerMatch = stats.wickets / Math.max(1, stats.matches);
        const strong = wicketsPerMatch >= 1 && bowlingEconomy <= 8.5;
        const poor = wicketsPerMatch < 0.5 || bowlingEconomy >= 10;
        if (price >= 800 && strong) {
          priceReactions.push({ player, price, text: `${player.name}'s ${formatAuctionPrice(price)} fee is being justified by ${stats.wickets} wickets in ${stats.matches} matches at an economy of ${bowlingEconomy.toFixed(1)}.` });
        } else if (price >= 800 && poor) {
          priceReactions.push({ player, price, text: `${player.name} cost ${formatAuctionPrice(price)}, so ${stats.wickets} wickets in ${stats.matches} matches at an economy of ${bowlingEconomy.toFixed(1)} is a fair reason for supporters to expect more.` });
        } else if (price <= 300 && strong) {
          priceReactions.push({ player, price, text: `${stats.wickets} wickets at an economy of ${bowlingEconomy.toFixed(1)} makes ${player.name} outstanding value at ${formatAuctionPrice(price)}.` });
        }
      }
    });
    pricedPlayers.forEach((player) => {
      const price = latestPrice(player);
      if (price === undefined || priceReactions.some((reaction) => reaction.player.id === player.id)) return;
      const batting = userBatting.find((entry) => entry.id === player.id);
      const bowling = userBowling.find((entry) => entry.id === player.id);
      if (isPrimaryBatter(player) && batting && (batting.balls ?? 0) > 0) {
        const runs = batting.runs ?? 0;
        const balls = batting.balls ?? 0;
        const strikeRate = runs / Math.max(1, balls) * 100;
        const exceptional = runs >= 80 || (runs >= 65 && strikeRate >= 145);
        const disastrous = runs <= 10 && balls >= 8;
        if (price >= 800 && exceptional) {
          priceReactions.push({ player, price, text: `${player.name} looked worth the ${formatAuctionPrice(price)} fee today: ${runs} from ${balls} at a ${strikeRate.toFixed(1)} strike rate is a premium performance.` });
        } else if (price >= 800 && disastrous) {
          priceReactions.push({ player, price, text: `${player.name}'s ${formatAuctionPrice(price)} fee brings scrutiny after ${runs} from ${balls} today. One innings does not define the signing, but that performance was well below premium expectations.` });
        } else if (price <= 300 && exceptional) {
          priceReactions.push({ player, price, text: `${runs} from ${balls} makes ${player.name}'s ${formatAuctionPrice(price)} price look exceptional value after today's match.` });
        }
      } else if (isPrimaryBowler(player) && bowling && (bowling.overs ?? 0) > 0) {
        const wicketsTaken = bowling.wickets ?? 0;
        const oversBowled = bowling.overs ?? 0;
        const spellEconomy = inningsEconomy(bowling.runsConceded ?? 0, oversBowled);
        const exceptional = wicketsTaken >= 3 && spellEconomy <= 8.5;
        const disastrous = oversBowled >= 3 && wicketsTaken === 0 && spellEconomy >= 11.5;
        if (price >= 800 && exceptional) {
          priceReactions.push({ player, price, text: `${player.name} delivered a premium spell for a premium ${formatAuctionPrice(price)} fee: ${wicketsTaken}/${bowling.runsConceded} at ${spellEconomy.toFixed(1)} economy.` });
        } else if (price >= 800 && disastrous) {
          priceReactions.push({ player, price, text: `${formatAuctionPrice(price)} means ${player.name}'s ${wicketsTaken}/${bowling.runsConceded} from ${oversBowled} overs will be criticised. That was far below the expected impact.` });
        } else if (price <= 300 && exceptional) {
          priceReactions.push({ player, price, text: `${player.name}'s ${wicketsTaken}/${bowling.runsConceded} makes a ${formatAuctionPrice(price)} fee look like outstanding value today.` });
        }
      }
    });
    priceReactions
      .sort((left, right) => right.price - left.price || left.player.name.localeCompare(right.player.name))
      .slice(0, 3)
      .forEach((reaction) => add(reaction.text, "price_tag", recent.date ?? props.currentDate));
    const bestBenchAlternative = (player?: Player) => bench
      .filter((candidate) => player ? (
        player.currentBatting >= player.currentBowling
          ? candidate.currentBatting >= 68
          : candidate.currentBowling >= 68
      ) : true)
      .sort((a, b) => playerRating(b) - playerRating(a))[0];
    poorBatters.slice(0, 2).forEach((player) => {
      const alternative = bestBenchAlternative(player);
      addOpinions("drop_batter", player, alternative, playerRating(player) >= 82 ? 1 : 3);
      if (playerRating(player) >= 80 || (player.reputation ?? 0) >= 8) addOpinions("back_batter", player, alternative, 2);
      if (alternative) addOpinions("promote_bench", player, alternative, 1);
    });
    poorBowlers.slice(0, 2).forEach((player) => {
      const alternative = bestBenchAlternative(player);
      addOpinions("drop_bowler", player, alternative, playerRating(player) >= 82 ? 1 : 3);
      if (playerRating(player) >= 80 || (player.reputation ?? 0) >= 8) addOpinions("back_bowler", player, alternative, 2);
      if (alternative) addOpinions("promote_bench", player, alternative, 1);
    });
    strongBatters.slice(0, 2).forEach((player) => addOpinions("praise_batter", player, undefined, 2));
    strongBowlers.slice(0, 2).forEach((player) => addOpinions("praise_bowler", player, undefined, 2));
    if (topBat && (topBat.runs ?? 0) >= 40 && players[topBat.id] && isPrimaryBatter(players[topBat.id])) {
      addOpinions("match_batting", players[topBat.id], undefined, 2);
    }
    if (topBowler && (topBowler.wickets ?? 0) >= 2 && players[topBowler.id] && isPrimaryBowler(players[topBowler.id])) {
      addOpinions("match_bowling", players[topBowler.id], undefined, 2);
    }

    const droppedPlayers = Array.from(previousParticipantIds)
      .filter((id) => !currentParticipantIds.has(id))
      .map((id) => players[id])
      .filter((player): player is Player => Boolean(player));
    droppedPlayers.forEach((player) => {
      const stats = playerStats[player.id];
      if (!stats || stats.matches < 2) return;
      const poorBattingRun = isPrimaryBatter(player) && (
        stats.runs / Math.max(1, stats.matches) < 22
        || (stats.balls >= 30 && stats.runs / Math.max(1, stats.balls) * 100 < 115)
      );
      const poorBowlingRun = isPrimaryBowler(player)
        && stats.oversBowled >= 6
        && economy(stats) > 10.5
        && stats.wickets < Math.max(2, stats.matches);
      if (poorBattingRun) {
        add(`${player.name} has finally been left out after that poor run with the bat. It is a big selection call, but the recent returns made a change understandable.`, "team_form");
      } else if (poorBowlingRun) {
        add(`${player.name} has been dropped after a difficult run with the ball. The attack needed a change, and now the replacement has to justify it.`, "team_form");
      }
    });

    if (previousFixture) {
      const firstSeasonAppearances = Array.from(currentParticipantIds)
        .filter((id) => !priorSeasonParticipantIds.has(id))
        .map((id) => players[id])
        .filter((player): player is Player => Boolean(player));
      firstSeasonAppearances.slice(0, 2).forEach((player) => {
        add(`${player.name} has come into the XI for a first appearance of the season. Fresh opportunity now—supporters will be watching how ${isPrimaryBowler(player) ? "the bowling role" : "the batting role"} is used.`, "team_form");
      });
    }
    // Build at most one club-history reaction for each distinct match. This
    // gives the feed a season-long timeline instead of three legend references
    // all prompted by today's innings.
    const chronologicalFixtures = playedTeamFixtures
      .filter((fixture) => Boolean(fixture.winner && fixture.scorecard))
      .sort((a, b) => a.matchNumber - b.matchNumber);
    chronologicalFixtures.forEach((fixture, fixtureIndex) => {
      if (!fixture.scorecard) return;
      const fixtureOpponent = fixture.teamA === team.id ? fixture.teamB : fixture.teamA;
      const fixtureScore = fixture.teamA === team.id ? fixture.scoreA : fixture.scoreB;
      const fixtureOpponentScore = fixture.teamA === team.id ? fixture.scoreB : fixture.scoreA;
      const resultWasWin = fixture.winner === team.id;
      const fixtureDate = fixture.date ?? (fixture.id === recent.id ? props.currentDate : undefined);
      if (!fixtureDate) return;
      const fixtureBatting = fixture.teamA === team.id ? fixture.scorecard.inningsA.batting : fixture.scorecard.inningsB.batting;
      const fixtureBowling = fixture.teamA === team.id ? fixture.scorecard.inningsB.bowling : fixture.scorecard.inningsA.bowling;
      const historyBat = [...fixtureBatting]
        .filter((entry) => Boolean(players[entry.id] && isPrimaryBatter(players[entry.id])))
        .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))[0];
      const historyBowler = [...fixtureBowling]
        .filter((entry) => Boolean(players[entry.id] && isPrimaryBowler(players[entry.id])))
        .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.runsConceded ?? 0) - (b.runsConceded ?? 0))[0];
      const allRoundPerformances = fixtureBatting
        .map((battingEntry) => {
          const player = players[battingEntry.id];
          const bowlingEntry = fixtureBowling.find((entry) => entry.id === battingEntry.id);
          if (!player || player.role !== "All-Rounder" || !bowlingEntry) return null;
          return { name: player.name, runs: battingEntry.runs ?? 0, wickets: bowlingEntry.wickets ?? 0 };
        })
        .filter((performance): performance is { name: string; runs: number; wickets: number } => Boolean(performance))
        .sort((a, b) => (b.runs + b.wickets * 22) - (a.runs + a.wickets * 22));
      if (fixture.id !== recent.id) {
        if (fixtureScore && fixtureOpponentScore) {
          add(
            `${resultWasWin ? "A win" : "A defeat"} against ${fixtureOpponent}: ${team.shortName} made ${fixtureScore.runs}/${fixtureScore.wickets} and ${fixtureOpponent} made ${fixtureOpponentScore.runs}/${fixtureOpponentScore.wickets}.`,
            "individual_match",
            fixtureDate,
          );
        }
        const standoutBat = [...fixtureBatting]
          .filter((entry) => (entry.runs ?? 0) >= 40 && Boolean(players[entry.id] && isPrimaryBatter(players[entry.id])))
          .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))[0];
        const standoutBowler = [...fixtureBowling]
          .filter((entry) => (entry.wickets ?? 0) >= 2 && Boolean(players[entry.id] && isPrimaryBowler(players[entry.id])))
          .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.runsConceded ?? 0) - (b.runsConceded ?? 0))[0];
        if (standoutBat) {
          add(`${players[standoutBat.id].name}'s ${standoutBat.runs} from ${standoutBat.balls} was the batting performance worth discussing against ${fixtureOpponent}.`, "individual_match", fixtureDate);
        }
        if (standoutBowler) {
          add(`${players[standoutBowler.id].name} took ${standoutBowler.wickets}/${standoutBowler.runsConceded} against ${fixtureOpponent}. That spell earned a reaction on the day it happened.`, "individual_match", fixtureDate);
        }
      }
      let streak = 0;
      for (let index = fixtureIndex; index >= 0; index -= 1) {
        if ((chronologicalFixtures[index].winner === team.id) !== resultWasWin) break;
        streak += 1;
      }
      const comments = getTriggeredTeamSocialComments(team.id, {
        won: resultWasWin,
        opponent: fixtureOpponent,
        score: fixtureScore?.runs ?? 0,
        wickets: fixtureScore?.wickets ?? 0,
        chased: fixture.teamB === team.id,
        closeMatch: isCloseFixture(fixture),
        consecutiveWins: resultWasWin ? streak : 0,
        consecutiveLosses: resultWasWin ? 0 : streak,
        stage: fixture.stage,
        battingPerformance: historyBat ? {
          name: players[historyBat.id].name,
          runs: historyBat.runs ?? 0,
          balls: historyBat.balls ?? 0,
        } : undefined,
        bowlingPerformance: historyBowler ? {
          name: players[historyBowler.id].name,
          wickets: historyBowler.wickets ?? 0,
          runsConceded: historyBowler.runsConceded ?? 0,
          overs: historyBowler.overs ?? 0,
        } : undefined,
        allRoundPerformance: allRoundPerformances[0],
        seed: fixture.matchNumber * 31 + (resultWasWin ? 11 : 5),
      });
      comments.forEach((comment) => add(comment, "team_form", fixtureDate));
    });
    return {
      phase: phaseContext.phase,
      label: phaseContext.label,
      posts: sortPostsChronologically(reactions.map((reaction, index) => ({
        id: `event_${recent.id}_${index}`,
        username: `Fan ${recent.matchNumber * 20 + index + 1}`,
        comment: reaction.text,
        topic: reaction.topic,
        tag: reaction.topic.replaceAll("_", " "),
        publishedAt: reaction.publishedAt ?? recent.date ?? props.currentDate,
      }))),
    };
  }

  const pools: Record<SocialPostTopic, Player[]> = {
    post_auction: squad, pre_season: squad, early_season: selected, mid_season: selected,
    late_season: selected, knocked_out: squad, next_season: squad,
    individual_match: recentPerformers, role_misuse: selected,
    team_form: underperformers.length ? underperformers : selected, yoy_comparison: [],
    ex_player: [], price_tag: pricedPlayers, youngsters: breakoutCandidates,
    impact_sub: impactPlayers, captaincy: captain ? [captain] : [], venue: selected,
    veteran_vs_youngster: veterans.concat(youngsters), clutch: recentPerformers, balance: selected,
  };
  const topicEligible = (topic: SocialPostTopic) => {
    if (topic === phaseContext.phase) return true;
    if (topic === "individual_match") return recentPerformers.length > 0;
    if (topic === "role_misuse" || topic === "balance") return selected.length === 11;
    if (topic === "team_form") return playedTeamFixtures.length >= 3;
    if (topic === "yoy_comparison") return false;
    // Generic ex-player templates contain claims that cannot be verified from
    // this context. Verified reactions are built from scorecards above.
    if (topic === "ex_player") return false;
    if (topic === "price_tag") return pricedPlayers.length > 0;
    if (topic === "youngsters") return breakoutCandidates.length > 0;
    if (topic === "impact_sub") return impactPlayers.length > 0;
    if (topic === "captaincy") return Boolean(captain && recent);
    if (topic === "venue") return Boolean(recent);
    if (topic === "veteran_vs_youngster") return veterans.length > 0 && youngsters.length > 0;
    if (topic === "clutch") return closeRecentMatch && recentPerformers.length > 0;
    return false;
  };
  const isTrainingComment = (text: string) => /\b(training|practice|nets?|net sessions?|practice drills?|intra-squad)\b/i.test(text);
  const referencesUnsupportedFeature = (text: string) => /\b(injur(?:y|ies|ed)|fitness test|medical replacement|concussion substitute)\b/i.test(text);
  const isUnverifiedPreSeasonClaim = (text: string) => (
    phaseContext.phase === "pre_season"
    && /\b(pre-season form|looks? (intense|sharp|fit|lethal|settled|unplayable|in unbelievable touch)|camp|fitness levels?|interviews?|media day|no injury|arrived early|acclimatized|dressing room|coaching staff|tactical meetings?|preparation has been|squad bond)\b/i.test(text)
  );
  const candidates = SOCIAL_POST_TEMPLATES.filter((template) => (
    !isTrainingComment(template.text)
    && !referencesUnsupportedFeature(template.text)
    && !isUnverifiedPreSeasonClaim(template.text)
    && topicEligible(template.topic)
    && (template.topic === phaseContext.phase || template.phases.includes(phaseContext.phase))
  ));
  const seed = playedTeamFixtures.reduce((sum, fixture) => sum + fixture.matchNumber * 17 + (fixture.winner === team.id ? 7 : 3), team.id.length * 19);
  const rotated = candidates.length ? [...candidates.slice(seed % candidates.length), ...candidates.slice(0, seed % candidates.length)] : [];
  const pick = (pool: Player[], index: number) => pool[index % Math.max(1, pool.length)] ?? fallback[index % Math.max(1, fallback.length)];
  const output: FanPost[] = [];

  const semanticPools = (text: string, defaultPool: Player[]) => {
    const lower = text.toLowerCase();
    const isCaptainComment = /\b(captain|captaincy|leadership)\b/.test(lower);
    const isKeeperComment = /\b(keeper|wicketkeeper|glovework|stumping)\b/.test(lower);
    const isOpeningComment = /\b(opening with|open the batting|opening the batting|at the top|opening pair)\b/.test(lower);
    const isFinishingComment = /\b(finisher|finishing|finish games|death-over hitting)\b/.test(lower);
    const isBowlingComment = /\b(bowl|bowler|bowling|wicket|yorker|economy|spinner|spin attack|pacer|pace attack|death overs?|slower ball)\b/.test(lower);
    const isBattingComment = /\b(bat|batter|batting|runs?|innings|strike rate|orange cap|sixes|boundary hitter|top order|middle order)\b/.test(lower);
    let primary = defaultPool;
    const requiresOrangeCapCandidate = /orange cap/i.test(text);
    const requiresDebutant = /\b(make (his|their) debut|ipl debut|first ipl)\b/i.test(text);
    const requiresBreakoutCandidate = /\b(breakout player|breakout season|surprise package|star in the making)\b/i.test(text);
    if (requiresOrangeCapCandidate) primary = orangeCapCandidates;
    else if (requiresDebutant) primary = iplDebutants;
    else if (requiresBreakoutCandidate) primary = breakoutCandidates;
    else if (isCaptainComment && captain) primary = [captain];
    else if (isKeeperComment && keeper) primary = [keeper];
    else if (isOpeningComment) primary = openers.length ? openers : batters;
    else if (isFinishingComment) primary = finishers.length ? finishers : batters;
    else if (isBowlingComment) primary = bowlers;
    else if (isBattingComment) primary = batters;

    let secondary = primary;
    if (/\b(young|youngster|uncapped)\s+\{b\}/i.test(text)) secondary = youngsters;
    else if (/\b(senior|veteran)\s+\{b\}/i.test(text)) secondary = veterans;
    else if (/\{b\}[^.]{0,45}\b(bowl|bowling|wicket|yorker)/i.test(text)) secondary = bowlers;
    else if (/\{b\}[^.]{0,45}\b(bat|runs?|score|hit|anchor|floater|opening)/i.test(text)) secondary = batters;
    const requiresSpecialCandidate = requiresOrangeCapCandidate || requiresDebutant || requiresBreakoutCandidate;
    return {
      primary: primary.length ? primary : requiresSpecialCandidate ? [] : defaultPool,
      secondary: secondary.length ? secondary : defaultPool,
    };
  };

  for (let index = 0; index < rotated.length && output.length < (recent ? 24 : 18); index += 1) {
    let template = rotated[index];
    const pool = pools[template.topic];
    const rolePools = semanticPools(template.text, pool.length ? pool : fallback);
    if (rolePools.primary.length === 0) continue;
    let subject = template.topic === "captaincy" ? captain : pick(rolePools.primary, index);
    if (!subject) continue;
    let alternative = pick(rolePools.secondary, index + 1);
    if (alternative?.id === subject.id) alternative = pick(rolePools.secondary, index + 2);
    const usesMatchStats = template.topic === "individual_match" || template.topic === "clutch";
    const stats = usesMatchStats ? recentMatchStats[subject.id] : playerStats[subject.id];
    const price = latestPrice(subject);
    if (template.text.includes("{runs}") && !stats?.runs) continue;
    if (template.text.includes("{sr}") && !stats?.balls) continue;
    if (template.text.includes("{econ}") && !stats?.oversBowled) continue;
    if (template.text.includes("{price}") && price === undefined) continue;
    if (["individual_match", "team_form", "clutch"].includes(template.topic) && !(stats?.matches > 0)) continue;
    const position = positionSuitability(subject, battingFirstXI.length ? battingFirstXI : bowlingFirstXI);
    if (template.topic === "role_misuse" && Boolean(template.isPraiseVariant) !== position.isSuitable) continue;
    const priceText = price === undefined ? "the recorded fee" : price >= 100
      ? `₹${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)} Cr`
      : `₹${price} Lakhs`;
    let comment = template.text
      .replaceAll("{a}", subject.name).replaceAll("{b}", alternative?.name ?? "another squad player")
      .replaceAll("{keeper}", keeper?.name ?? "our wicketkeeper").replaceAll("{captain}", captain?.name ?? "our captain")
      .replaceAll("{team}", team.shortName).replaceAll("{rival}", recent ? (recent.teamA === team.id ? recent.teamB : recent.teamA) : "the opposition")
      .replaceAll("{price}", priceText).replaceAll("{venue}", team.homeGround)
      .replaceAll("{colours}", TEAM_COLOUR_NAMES[team.id] ?? "the club colours")
      .replaceAll("{pos}", position.positionName).replaceAll("{reason}", position.reason)
      .replaceAll("{runs}", `${stats?.runs ?? 0}`).replaceAll("{sr}", stats?.balls ? `${Math.round(stats.runs / stats.balls * 100)}` : "")
      .replaceAll("{econ}", stats?.oversBowled ? economy(stats).toFixed(1) : "");
    const referencedSeason = phaseContext.phase === "next_season" ? props.currentSeason + 1 : props.currentSeason;
    comment = comment.replaceAll("2026", String(referencedSeason)).replaceAll("2027", String(referencedSeason));
    if (/keeper|glovework|stumping/i.test(comment) && keeper) comment = comment.replaceAll(subject.name, keeper.name);
    output.push({
      id: `${template.id}_${seed}_${output.length}`,
      username: `Fan ${seed + output.length + 1}`,
      comment,
      topic: template.topic,
      tag: template.topic.replaceAll("_", " "),
      publishedAt: recent?.date ?? props.currentDate,
    });
  }
  return { posts: sortPostsChronologically(output), phase: phaseContext.phase, label: phaseContext.label };
}

export default function SocialMediaPage(props: SocialMediaPageProps) {
  const feed = buildFeed(props);
  return (
    <div className="h-full overflow-y-auto bg-bg px-6 py-5">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-anton text-xl uppercase tracking-wide text-text-primary">{props.team.shortName} Supporter Feed</h2>
            <p className="mt-1 font-barlow text-sm capitalize text-text-secondary">{feed.label} · {feed.phase.replaceAll("_", " ")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 font-space-mono text-[10px] font-bold uppercase tracking-wide text-accent">
            <Users size={13} aria-hidden="true" /> {feed.posts.length} relevant posts
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 font-space-mono text-[10px] text-text-secondary"><Shield size={12} className="text-accent" /> Event filtered</div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 font-space-mono text-[10px] text-text-secondary"><Award size={12} className="text-accent" /> Actual captain</div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 font-space-mono text-[10px] text-text-secondary"><Zap size={12} className="text-accent" /> Real stats only</div>
        </div>
        {feed.posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center font-barlow text-sm text-text-secondary">No supporter reactions have been triggered yet.</div>
        ) : (
          <div className="space-y-2.5">
            {feed.posts.map((post) => (
              <article key={post.id} className="rounded-lg border border-border bg-surface px-4 py-3.5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/12 font-space-mono text-[10px] font-bold text-accent">F</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate font-barlow text-sm font-bold text-text-primary">{post.username}</span>
                        <time dateTime={post.publishedAt} className="shrink-0 font-space-mono text-[9px] uppercase text-text-secondary">
                          {displayGameDate(post.publishedAt)}
                        </time>
                      </div>
                      <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 font-space-mono text-[9px] uppercase text-accent">#{post.tag}</span>
                    </div>
                    <p className="mt-1.5 font-barlow text-[15px] leading-6 text-text-primary/90">{post.comment}</p>
                    <div className="mt-2 flex items-center gap-1 font-space-mono text-[9px] uppercase text-text-secondary/70"><MessageCircle size={12} /> Comment</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
