import type { Player } from "../types";
import type { CareerStaffState } from "./staffContracts";
import { PERSON_DYNAMICS_SEEDS } from "../data/personDynamicsSeeds";

export type RelationshipPerson = { kind: "player" | "staff"; id: string; name: string };
export type RelationshipStatus = "active" | "dormant" | "historical";
export interface CareerRelationship {
  id: string;
  type: string;
  subject: RelationshipPerson;
  partner: RelationshipPerson;
  rating: number;
  source: "documented" | "career";
  reason: string;
  evidenceUrl?: string;
  status: RelationshipStatus;
  createdSeason: number;
  lastActiveSeason: number;
  exposure: number;
}
export interface CareerRelationshipState {
  records: Record<string, CareerRelationship>;
  activeSeasons: Record<string, number>;
  pending: Record<string, number>;
  seasonGains: Record<string, { season: number; amount: number }>;
  processedSeasons: number[];
  processedEvents: string[];
}
export interface RelationshipMatchTeam {
  teamId: string;
  playerIds: string[];
  openingIds: string[];
  bowlerIds: string[];
  paceIds: string[];
  spinIds: string[];
  captainId?: string | null;
  roleMismatchIds?: string[];
}
export interface RelationshipMatch { id: string; teams: RelationshipMatchTeam[]; rivalryPairs?: Array<[string, string]> }
export interface RelationshipEvent {
  id: string;
  season: number;
  type: string;
  subject: RelationshipPerson;
  partner: RelationshipPerson;
  reason: string;
  strength?: number;
}

export const emptyCareerRelationshipState = (): CareerRelationshipState => ({ records: {}, activeSeasons: {}, pending: {}, seasonGains: {}, processedSeasons: [], processedEvents: [] });
const personKey = (person: RelationshipPerson) => `${person.kind}:${person.id}`;
const directional = new Set(["idol", "mentor_protege", "mentor_coach", "talent_champion", "preferred_assistant", "essential_staff", "inner_circle_assistant"]);
export function relationshipId(type: string, a: RelationshipPerson, b: RelationshipPerson): string {
  const first = personKey(a), second = personKey(b);
  return `${type}:${directional.has(type) ? `${first}>${second}` : [first, second].sort().join("|")}`;
}
const roleFamily = (player: Player) => player.role === "Pace Bowler" ? "pace" : player.role === "Spin Bowler" ? "spin" : player.role === "WK-Batsman" ? "keeper" : player.role === "All-Rounder" ? "allrounder" : "bat";
const chance = (key: string) => {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return (hash >>> 0) / 4294967296;
};
const names: Record<string, string> = {
  idol: "Idol", franchise_teammates: "Longtime Teammates", national_teammates: "National Compatriots",
  opening_partners: "Opening Partners", spin_twins: "Spin Bowling Tandem", pace_tandem: "Pace Bowling Tandem",
  mentor_protege: "Mentor & Protégé", domestic_roots: "State / Domestic Roots", personal_bond: "Close Personal Friends",
  on_field_rivalry: "Fierce Rivals / Tension", coached: "Coached by / Mentored",
  former_teammates: "Former Teammate (Now Coach)", captain_coach_synergy: "Captain & Coach Brain Trust",
  specialist_tutelage: "Specialist Tutelage", talent_champion: "Backed / Discovered by",
  tactical_friction: "Tactical Disagreement", inner_circle_assistant: "Inner Circle Assistant",
  trusted_colleague: "Trusted Coaching Colleague", mentor_coach: "Senior Mentor & Coach",
  philosophical_clash: "Contrasting Philosophies", preferred_assistant: "Preferred Assistant", essential_staff: "Essential Staff",
};
const label = (type: string) => names[type] ?? type.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
export { label as relationshipLabel };

export function documentedRelationships(players: Record<string, Player>, staff: CareerStaffState): Record<string, CareerRelationship> {
  const playersByName = new Map(Object.values(players).map((player) => [player.name.toLowerCase(), player]));
  const staffBySlug = new Map(Object.values(staff.contracts).map((contract) => [contract.staffSlug, contract]));
  const result: Record<string, CareerRelationship> = {};
  for (const seed of PERSON_DYNAMICS_SEEDS) {
    const resolve = (kind: "player" | "staff", value: string): RelationshipPerson | null => {
      if (kind === "player") {
        const player = playersByName.get(value.toLowerCase());
        return player ? { kind, id: player.id, name: player.name } : null;
      }
      const contract = staffBySlug.get(value);
      return { kind, id: value, name: contract?.fullName ?? value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) };
    };
    const subject = resolve(seed.category === "staff_staff" ? "staff" : "player", seed.person1);
    const partner = resolve(seed.category === "player_player" ? "player" : "staff", seed.person2);
    if (!subject || !partner) continue;
    const id = relationshipId(seed.type, subject, partner);
    if (result[id] && result[id].rating >= seed.rating) continue;
    result[id] = {
      id, type: seed.type, subject, partner, rating: seed.rating, source: "documented",
      reason: seed.reason, evidenceUrl: seed.evidenceUrl, status: "active", createdSeason: 2026,
      lastActiveSeason: 2026, exposure: 0,
    };
  }
  return result;
}

export function relationshipsForPerson(
  state: CareerRelationshipState,
  players: Record<string, Player>,
  staff: CareerStaffState,
  person: RelationshipPerson,
): Array<{ record: CareerRelationship; partner: RelationshipPerson }> {
  const records = { ...documentedRelationships(players, staff), ...state.records };
  const key = personKey(person);
  return Object.values(records).flatMap((record) => {
    if (personKey(record.subject) === key) return [{ record, partner: record.partner }];
    if (record.type !== "idol" && personKey(record.partner) === key) return [{ record, partner: record.subject }];
    return [];
  }).sort((a, b) => b.record.rating - a.record.rating);
}

export function relationshipSoftCap(activeSeasons: number): number {
  if (activeSeasons <= 1) return 2;
  if (activeSeasons <= 4) return 3;
  if (activeSeasons <= 8) return 5;
  if (activeSeasons <= 12) return 7;
  return 8 + Math.floor((activeSeasons - 13) / 4);
}
function grow(record: CareerRelationship, requested: number, season: number, gains: CareerRelationshipState["seasonGains"]): CareerRelationship {
  if (record.type === "idol" || record.type === "domestic_roots") return record;
  const previous = gains[record.id]?.season === season ? gains[record.id].amount : 0;
  const applied = Math.max(0, Math.min(12 - previous, requested));
  gains[record.id] = { season, amount: previous + applied };
  return { ...record, rating: Math.min(100, Math.round(record.rating + applied)) };
}

type Evidence = { type: string; a: RelationshipPerson; b: RelationshipPerson; count: number; reason: string; score: number };
const pairwise = (ids: string[], fn: (a: string, b: string) => void) => {
  const unique = Array.from(new Set(ids)).sort();
  for (let i = 0; i < unique.length; i += 1) for (let j = i + 1; j < unique.length; j += 1) fn(unique[i], unique[j]);
};
const minimumExposure: Record<string, number> = {
  franchise_teammates: 16, opening_partners: 4, pace_tandem: 6, spin_twins: 6, on_field_rivalry: 3,
  former_teammates: 1, domestic_roots: 1, mentor_protege: 2,
  personal_bond: 2, tactical_friction: 2, philosophical_clash: 2, talent_champion: 1, essential_staff: 1,
  coached: 2, specialist_tutelage: 2, captain_coach_synergy: 8,
  trusted_colleague: 2, mentor_coach: 2, preferred_assistant: 1, inner_circle_assistant: 1,
};

export function progressCareerRelationships(input: {
  state: CareerRelationshipState; season: number; players: Record<string, Player>;
  developedPlayers?: Record<string, Player>;
  seasonPlayerStats?: Record<string, { runs?: number; wickets?: number; matches?: number }>;
  teamRanks?: Record<string, number>;
  staff: CareerStaffState; matches: RelationshipMatch[];
}): CareerRelationshipState {
  const { state, season, players, staff } = input;
  if (state.processedSeasons.includes(season)) return state;
  const records = { ...documentedRelationships(players, staff), ...state.records };
  const activeSeasons = { ...state.activeSeasons };
  const pending = { ...(state.pending ?? {}) };
  const seasonGains = { ...(state.seasonGains ?? {}) };
  const processedEvents = [...state.processedEvents];
  const evidence = new Map<string, Evidence>();
  const seen = new Set<string>();
  const add = (type: string, a: RelationshipPerson, b: RelationshipPerson, matchId: string, reason: string, score = 1) => {
    const id = relationshipId(type, a, b);
    const eventId = `${matchId}:${id}`;
    if (seen.has(eventId)) return;
    seen.add(eventId);
    const item = evidence.get(id) ?? { type, a, b, count: 0, reason, score: 0 };
    item.count += 1;
    item.score += score;
    evidence.set(id, item);
  };
  const p = (id: string): RelationshipPerson | null => players[id] ? { kind: "player", id, name: players[id].name } : null;
  const activePlayerIds = new Set<string>();
  for (const match of input.matches) for (const team of match.teams) {
    const ids = team.playerIds.filter((id) => Boolean(players[id]));
    ids.forEach((id) => activePlayerIds.add(id));
    pairwise(ids, (left, right) => add("franchise_teammates", p(left)!, p(right)!, match.id, "Regularly played together in the same franchise side."));
    pairwise(team.openingIds.filter((id) => Boolean(players[id])), (left, right) => add("opening_partners", p(left)!, p(right)!, match.id, "Opened the batting together repeatedly.", 2));
    pairwise(team.paceIds.filter((id) => Boolean(players[id])), (left, right) => add("pace_tandem", p(left)!, p(right)!, match.id, "Bowled together in the same pace attack.", 1.5));
    pairwise(team.spinIds.filter((id) => Boolean(players[id])), (left, right) => add("spin_twins", p(left)!, p(right)!, match.id, "Bowled together in the same spin attack.", 1.5));
  }
  for (const match of input.matches) for (const [batterId, bowlerId] of match.rivalryPairs ?? []) {
    if (p(batterId) && p(bowlerId)) add("on_field_rivalry", p(batterId)!, p(bowlerId)!, match.id, "Repeated significant batting and bowling contests.", 1.5);
  }
  const pathwayGroups = new Map<string, Player[]>();
  Object.values(players).filter((player) => player.careerState?.origin === "generated" && player.youthPathwayId).forEach((player) => {
    const group = pathwayGroups.get(player.youthPathwayId!) ?? [];
    group.push(player);
    pathwayGroups.set(player.youthPathwayId!, group);
  });
  Array.from(pathwayGroups.values()).forEach((group) => pairwise(group.map((player) => player.id), (left, right) => {
    const a = players[left], b = players[right];
    if (Math.abs(a.age - b.age) <= 2) add("domestic_roots", p(left)!, p(right)!, `${season}:pathway`, "Came through the same state youth cohort.", 2);
  }));
  const mentorCandidates = new Map<string, { senior: Player; score: number }>();
  Array.from(evidence.values()).filter((item) => item.type === "franchise_teammates" && item.count >= 8).forEach((item) => {
    const first = players[item.a.id], second = players[item.b.id];
    if (first?.careerState?.origin === "generated" && second?.careerState?.origin === "generated"
      && Math.abs(first.age - second.age) <= 3
      && (state.activeSeasons[`player:${first.id}`] ?? 0) >= 1
      && (state.activeSeasons[`player:${second.id}`] ?? 0) >= 1
      && chance(`${season}:${item.a.id}:${item.b.id}:bond`) < 0.12) {
      add("personal_bond", item.a, item.b, `${season}:bond`, "A close friendship formed during repeated seasons together in this career.", 2);
    }
    for (const [juniorId, seniorId] of [[item.a.id, item.b.id], [item.b.id, item.a.id]]) {
      const junior = players[juniorId], senior = players[seniorId];
      if (!junior || !senior || junior.careerState?.origin !== "generated" || senior.age < junior.age + 8 || roleFamily(junior) !== roleFamily(senior) || (senior.reputation ?? 0) < 7 || (senior.iplStats?.matches ?? 0) < 70) continue;
      const score = (senior.reputation ?? 0) * 10 + Math.max(senior.currentBatting, senior.currentBowling);
      if (score > (mentorCandidates.get(juniorId)?.score ?? -1)) mentorCandidates.set(juniorId, { senior, score });
    }
  });
  Array.from(mentorCandidates.entries()).forEach(([juniorId, { senior }]) => add("mentor_protege", p(juniorId)!, p(senior.id)!, `${season}:mentor`, "A senior player in the same role has guided this youngster through a shared season.", 2));
  activePlayerIds.forEach((id) => {
    const key = `player:${id}`;
    const historyYears = new Set(players[id].iplHistory.filter((entry) => (entry.seasonStats?.matches ?? 0) >= 5).map((entry) => entry.season)).size;
    const seasonKey = `active-season:${season}:${key}`;
    if (!processedEvents.includes(seasonKey)) {
      activeSeasons[key] = Math.max((activeSeasons[key] ?? 0) + 1, historyYears);
      processedEvents.push(seasonKey);
    } else activeSeasons[key] = Math.max(activeSeasons[key] ?? 0, historyYears);
  });
  const staffByTeam = new Map<string, typeof staff.contracts[string][]>();
  Object.values(staff.contracts).filter((contract) => contract.status === "contracted" && contract.teamId).forEach((contract) => {
    const members = staffByTeam.get(contract.teamId!) ?? [];
    members.push(contract);
    staffByTeam.set(contract.teamId!, members);
    const key = `staff:${contract.staffSlug}`;
    activeSeasons[key] = Math.max((activeSeasons[key] ?? 0) + 1, season - Math.max(2027, contract.startSeason ?? season) + 1);
  });
  const playerTeams = new Map<string, Map<string, number>>();
  input.matches.forEach((match) => match.teams.forEach((team) => team.playerIds.forEach((id) => {
    const teams = playerTeams.get(id) ?? new Map<string, number>();
    teams.set(team.teamId, (teams.get(team.teamId) ?? 0) + 1);
    playerTeams.set(id, teams);
  })));
  for (const [teamId, members] of Array.from(staffByTeam.entries())) {
    const head = members.find((member) => member.roles.includes("head_coach"));
    const headPerson: RelationshipPerson | null = head ? { kind: "staff", id: head.staffSlug, name: head.fullName } : null;
    if (head && headPerson) {
      const mismatchCounts = new Map<string, number>();
      input.matches.forEach((match) => match.teams.filter((team) => team.teamId === teamId).forEach((team) => team.roleMismatchIds?.forEach((id) => mismatchCounts.set(id, (mismatchCounts.get(id) ?? 0) + 1))));
      Array.from(mismatchCounts.entries()).filter(([, count]) => count >= 5).forEach(([id]) => {
        if (players[id] && chance(`${season}:${id}:${head.staffSlug}:friction`) < 0.35) add("tactical_friction", p(id)!, headPerson, `${season}:${teamId}:friction`, "Repeatedly played outside a preferred opening role under this coach.");
      });
      for (const [playerId, teams] of Array.from(playerTeams.entries())) {
        const prospect = players[playerId];
        const stats = input.seasonPlayerStats?.[playerId];
        if ((teams.get(teamId) ?? 0) < 8 || !prospect || prospect.careerState?.origin !== "generated" || (prospect.careerState.generatedSeason ?? 0) < season - 2 || Math.max(prospect.currentBatting, prospect.currentBowling) > 80 || Math.max(prospect.potentialBatting, prospect.potentialBowling) < 84 || ((stats?.runs ?? 0) < 200 && (stats?.wickets ?? 0) < 8)) continue;
        add("talent_champion", p(playerId)!, headPerson, `${season}:${teamId}:backed`, "The head coach's side gave this productive young prospect a regular role.", 2);
      }
    }
    for (const member of members) {
      const coach: RelationshipPerson = { kind: "staff", id: member.staffSlug, name: member.fullName };
      const years = Math.max(1, season - Math.max(2027, member.startSeason ?? season) + 1);
      if (head && member !== head) {
        const leader: RelationshipPerson = { kind: "staff", id: head.staffSlug, name: head.fullName };
        add("trusted_colleague", leader, coach, `${season}:${teamId}:staff`, "Worked together on the same coaching staff.", years);
        const headAppointments = staff.employmentHistory.filter((event) => event.staffId === head.staffId && event.kind === "appointed");
        const colleagueAppointments = staff.employmentHistory.filter((event) => event.staffId === member.staffId && event.kind === "appointed");
        const sharedAppointments = colleagueAppointments.filter((event) => headAppointments.some((headEvent) => headEvent.teamId === event.teamId && headEvent.season <= event.season));
        const sharedClubs = new Set(sharedAppointments.map((event) => event.teamId));
        if (sharedClubs.size >= 2) {
          add("inner_circle_assistant", leader, coach, `${season}:${teamId}:reunion`, "Reunited after appointments together at more than one club.", sharedClubs.size);
        } else {
          const renewalsTogether = staff.employmentHistory.filter((event) => event.staffId === member.staffId && event.kind === "contract_renewed" && event.teamId === teamId && event.season >= (head.startSeason ?? season)).length;
          if (renewalsTogether >= 2) add("preferred_assistant", leader, coach, `${season}:${teamId}:renewal`, "Repeatedly retained in the head coach's staff structure.", renewalsTogether);
        }
        if (head.coachingPhilosophy && member.coachingPhilosophy && head.coachingPhilosophy !== member.coachingPhilosophy && (input.teamRanks?.[teamId] ?? 0) >= 7 && years >= 2 && chance(`${season}:${head.staffSlug}:${member.staffSlug}:clash`) < 0.45) {
          add("philosophical_clash", leader, coach, `${season}:${teamId}:clash`, "Different coaching philosophies came into conflict during a disappointing season.");
        }
      }
      if (member.roles.includes("mentor") && member.experienceYears >= 12) {
        for (const colleague of members) {
          if (colleague === member || colleague.experienceYears > member.experienceYears - 8) continue;
          add("mentor_coach", coach, { kind: "staff", id: colleague.staffSlug, name: colleague.fullName }, `${season}:${teamId}:mentor-coach`, "An experienced staff mentor worked alongside a developing coach.");
        }
      }
      if (!member.roles.some((role) => /batting_coach|pace_bowling_coach|spin_bowling_coach/.test(role))) continue;
      for (const [playerId, teams] of Array.from(playerTeams.entries())) {
        if ((teams.get(teamId) ?? 0) < 8 || !players[playerId]) continue;
        const family = roleFamily(players[playerId]);
        const suitable = member.roles.includes("batting_coach") && ["bat", "keeper", "allrounder"].includes(family)
          || member.roles.includes("pace_bowling_coach") && family === "pace"
          || member.roles.includes("spin_bowling_coach") && family === "spin";
        if (!suitable) continue;
        add("coached", p(playerId)!, coach, `${season}:${teamId}:coached`, "Worked with a relevant specialist coach during the season.", 2);
        const developed = input.developedPlayers?.[playerId];
        const relevantGain = developed && (member.roles.includes("batting_coach")
          ? developed.currentBatting - players[playerId].currentBatting
          : developed.currentBowling - players[playerId].currentBowling);
        if (relevantGain !== undefined && relevantGain >= 2) {
          add("specialist_tutelage", p(playerId)!, coach, `${season}:${teamId}:specialist`, "Improved the relevant skill while working with this specialist coach.", 2);
        }
      }
    }
  }
  for (const match of input.matches) for (const team of match.teams) {
    const captain = team.captainId && p(team.captainId);
    const head = staffByTeam.get(team.teamId)?.find((member) => member.roles.includes("head_coach"));
    if (captain && head) add("captain_coach_synergy", captain, { kind: "staff", id: head.staffSlug, name: head.fullName }, match.id, "Captained matches under this head coach.");
  }
  for (const profile of Object.values(staff.generatedProfiles)) {
    if (profile.converted_in_season !== season) continue;
    const source = players[profile.source_player_id];
    if (!source) continue;
    const coach: RelationshipPerson = { kind: "staff", id: profile.slug, name: profile.full_name };
    const sourceTeams = new Set(source.iplHistory.map((entry) => `${entry.season}:${entry.teamId}`));
    for (const teammate of Object.values(players)) {
      if (teammate.id === source.id) continue;
      const shared = teammate.iplHistory.filter((entry) => sourceTeams.has(`${entry.season}:${entry.teamId}`));
      if (shared.length >= 2) add("former_teammates", { kind: "player", id: teammate.id, name: teammate.name }, coach, `${season}:former:${teammate.id}:${profile.id}`, "Previously played together before one became a coach.", shared.length);
    }
  }
  const createdThisSeason = new Map<string, number>();
  const candidates = Array.from(evidence.values()).sort((a, b) => b.score - a.score || relationshipId(a.type, a.a, a.b).localeCompare(relationshipId(b.type, b.a, b.b)));
  for (const item of candidates) {
    const id = relationshipId(item.type, item.a, item.b);
    const existing = records[id];
    const minimum = minimumExposure[item.type] ?? 2;
    if (!existing) {
      const accumulated = (pending[id] ?? 0) + item.count;
      pending[id] = accumulated;
      const members = [personKey(item.a), personKey(item.b)];
      if (members.some((key) => (createdThisSeason.get(key) ?? 0) >= 1)) continue;
      const atCap = members.some((key) => Object.values(records).filter((record) => record.status === "active" && record.type !== "idol" && (personKey(record.subject) === key || personKey(record.partner) === key)).length >= relationshipSoftCap(activeSeasons[key] ?? 1));
      if (accumulated < minimum * (atCap ? 1.5 : 1)) continue;
      records[id] = { id, type: item.type, subject: item.a, partner: item.b, rating: Math.min(50, 35 + Math.floor(item.score / 4)), source: "career", reason: item.reason, status: "active", createdSeason: season, lastActiveSeason: season, exposure: accumulated };
      delete pending[id];
      members.forEach((key) => createdThisSeason.set(key, (createdThisSeason.get(key) ?? 0) + 1));
    } else if (existing.type !== "idol" && existing.type !== "domestic_roots") {
      const gain = Math.min(12, Math.max(1, Math.floor(item.score / 3))) * (1 - existing.rating / 130);
      records[id] = { ...grow(existing, gain, season, seasonGains), status: "active", lastActiveSeason: season, exposure: existing.exposure + item.count, reason: item.reason };
    }
  }
  for (const [id, record] of Object.entries(records)) {
    if (["idol", "domestic_roots", "personal_bond", "former_teammates"].includes(record.type) || record.lastActiveSeason === season) continue;
    if (record.lastActiveSeason < season && record.status !== "historical") {
      const age = season - record.lastActiveSeason;
      records[id] = { ...record, status: age >= 3 ? "historical" : "dormant", rating: Math.max(record.source === "documented" ? 25 : 20, record.rating - (age === 1 ? 2 : 3)) };
    }
  }
  const seasonalTypes = new Set(["franchise_teammates", "opening_partners", "pace_tandem", "spin_twins", "on_field_rivalry", "coached", "specialist_tutelage", "captain_coach_synergy", "trusted_colleague", "mentor_coach", "mentor_protege", "domestic_roots", "former_teammates", "preferred_assistant", "inner_circle_assistant", "personal_bond", "tactical_friction", "philosophical_clash", "talent_champion"]);
  Object.keys(pending).forEach((id) => { if (seasonalTypes.has(id.split(":")[0]) && !evidence.has(id)) delete pending[id]; });
  return { ...state, records, activeSeasons, pending, seasonGains, processedEvents, processedSeasons: [...state.processedSeasons, season] };
}

/** Explicit logged events cover relationship types that cannot be inferred from a scorecard. */
export function applyCareerRelationshipEvent(state: CareerRelationshipState, event: RelationshipEvent): CareerRelationshipState {
  if (state.processedEvents.includes(event.id) || event.type === "idol") return state;
  const explicitThresholds: Record<string, number> = {
    national_teammates: 5, mentor_protege: 1, domestic_roots: 1, personal_bond: 2,
    former_teammates: 1, specialist_tutelage: 3, talent_champion: 1,
    tactical_friction: 2, inner_circle_assistant: 2, mentor_coach: 1,
    philosophical_clash: 2, preferred_assistant: 2, essential_staff: 1,
    coached: 2, captain_coach_synergy: 8, on_field_rivalry: 3,
  };
  if (!(event.type in explicitThresholds)) return state;
  const id = relationshipId(event.type, event.subject, event.partner);
  const prior = state.records[id];
  const pending = { ...(state.pending ?? {}) };
  if (!prior) {
    pending[id] = (pending[id] ?? 0) + 1;
    if (pending[id] < explicitThresholds[event.type]) return { ...state, pending, processedEvents: [...state.processedEvents, event.id] };
    const activeKeys = [personKey(event.subject), personKey(event.partner)];
    const atCap = activeKeys.some((key) => Object.values(state.records).filter((record) => record.status === "active" && record.type !== "idol" && (personKey(record.subject) === key || personKey(record.partner) === key)).length >= relationshipSoftCap(state.activeSeasons[key] ?? 1));
    if (atCap && pending[id] < explicitThresholds[event.type] * 1.5) return { ...state, pending, processedEvents: [...state.processedEvents, event.id] };
    if (activeKeys.some((key) => Object.values(state.records).filter((record) => record.source === "career" && record.createdSeason === event.season && (personKey(record.subject) === key || personKey(record.partner) === key)).length >= 1)) return { ...state, pending, processedEvents: [...state.processedEvents, event.id] };
    delete pending[id];
  }
  const seasonGains = { ...(state.seasonGains ?? {}) };
  const grown = prior ? grow(prior, Math.min(12, event.strength ?? 4), event.season, seasonGains) : null;
  const rating = grown?.rating ?? Math.min(50, Math.max(35, event.strength ?? 40));
  return { ...state, pending, seasonGains, processedEvents: [...state.processedEvents, event.id], records: {
    ...state.records,
    [id]: prior ? { ...prior, rating, reason: event.reason, status: "active", lastActiveSeason: event.season, exposure: prior.exposure + 1 }
      : { id, type: event.type, subject: event.subject, partner: event.partner, rating, source: "career", reason: event.reason, status: "active", createdSeason: event.season, lastActiveSeason: event.season, exposure: 1 },
  } };
}

export function progressInternationalRelationships(input: {
  state: CareerRelationshipState;
  fixtures: Array<{ id: string; played: boolean; xiA?: string[]; xiB?: string[] }>;
  players: Record<string, Player>;
  staff: CareerStaffState;
  season: number;
}): CareerRelationshipState {
  const unseen = input.fixtures.filter((fixture) => fixture.played && !input.state.processedEvents.includes(`international:${fixture.id}`));
  if (unseen.length === 0) return input.state;
  const records = { ...documentedRelationships(input.players, input.staff), ...input.state.records };
  const pending = { ...(input.state.pending ?? {}) };
  const seasonGains = { ...(input.state.seasonGains ?? {}) };
  const activeSeasons = { ...input.state.activeSeasons };
  const processedEvents = [...input.state.processedEvents];
  const exposure = new Map<string, { a: RelationshipPerson; b: RelationshipPerson; count: number }>();
  for (const fixture of unseen) {
    processedEvents.push(`international:${fixture.id}`);
    for (const xi of [fixture.xiA, fixture.xiB]) {
      if (!xi) continue;
      pairwise(xi.filter((id) => Boolean(input.players[id])), (left, right) => {
        const a: RelationshipPerson = { kind: "player", id: left, name: input.players[left].name };
        const b: RelationshipPerson = { kind: "player", id: right, name: input.players[right].name };
        const id = relationshipId("national_teammates", a, b);
        const item = exposure.get(id) ?? { a, b, count: 0 };
        item.count += 1;
        exposure.set(id, item);
      });
      xi.forEach((id) => {
        if (!input.players[id]) return;
        const key = `active-season:${input.season}:player:${id}`;
        if (processedEvents.includes(key)) return;
        processedEvents.push(key);
        activeSeasons[`player:${id}`] = (activeSeasons[`player:${id}`] ?? 0) + 1;
      });
    }
  }
  const newBonds = new Map<string, number>();
  for (const [id, item] of Array.from(exposure.entries()).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))) {
    const prior = records[id];
    if (prior) {
      if (prior.type !== "idol") records[id] = { ...grow(prior, item.count * 2, input.season, seasonGains), status: "active", lastActiveSeason: input.season, exposure: prior.exposure + item.count, reason: "Played international matches together." };
      continue;
    }
    pending[id] = (pending[id] ?? 0) + item.count;
    const members = [personKey(item.a), personKey(item.b)];
    if (members.some((key) => (newBonds.get(key) ?? 0) >= 1)) continue;
    const atCap = members.some((key) => Object.values(records).filter((record) => record.status === "active" && record.type !== "idol" && (personKey(record.subject) === key || personKey(record.partner) === key)).length >= relationshipSoftCap(activeSeasons[key] ?? 1));
    if (pending[id] < 5 * (atCap ? 1.5 : 1)) continue;
    records[id] = { id, type: "national_teammates", subject: item.a, partner: item.b, rating: 38, source: "career", reason: "Played international matches together.", status: "active", createdSeason: input.season, lastActiveSeason: input.season, exposure: pending[id] };
    delete pending[id];
    members.forEach((key) => newBonds.set(key, (newBonds.get(key) ?? 0) + 1));
  }
  return { ...input.state, records, pending, seasonGains, activeSeasons, processedEvents };
}
