import assert from 'node:assert/strict';
import { createInternationalCareer, reconcileInternationalCareer, internationalCareerNeedsReconcile, INTERNATIONAL_TEAMS, type InternationalCareerState } from '../lib/logic/international';
import { t20iRetirementProbability, isT20IEligible, mergeT20IRetirement, retirementRoll } from '../lib/logic/internationalRetirements';
import { buildInternationalRetirementNews } from '../lib/logic/internationalRetirementNews';
import { sourceT20IRetirement } from '../lib/data/t20iRetirementStatus';
import type { Player } from '../lib/types';

const makePlayer = (id = 'veteran', age = 38): Player => ({
  id, name: id, country: 'India', nationality: 'Indian', role: 'Batsman', age,
  currentBatting: 95, currentBowling: 20, captaincy: 99, isOpener: true,
  isCapped: true, internationalDebutDate: '2020-01-01', currentTeamId: 'RR',
  careerStats: { batting: {}, bowling: {} }, iplStats: { matches: 100, runs: 4000 },
  iplHistory: [], isRetained: true, retainedByTeamId: 'RR',
} as unknown as Player);
const odds = { age: 37, ageShift: 0, ability: 85, nationalStrength: 91, inXI: false, inSquad: false, recentMatches: 0, captain: false };
const fringe = t20iRetirementProbability(odds);
assert.ok(t20iRetirementProbability({ ...odds, inXI: true }) < fringe * .2);
assert.ok(t20iRetirementProbability({ ...odds, inSquad: true }) < fringe * .4);
assert.ok(t20iRetirementProbability({ ...odds, recentMatches: 8 }) < fringe);
assert.equal(t20iRetirementProbability({ ...odds, age: 32 }), 0);
assert.equal(t20iRetirementProbability({ ...odds, age: 40, inXI: true }), 1);
assert.equal(t20iRetirementProbability({ ...odds, age: 40, ageShift: 5 }), t20iRetirementProbability({ ...odds, age: 35 }));
const fact = sourceT20IRetirement('virat-kohli', false);
assert.equal(isT20IEligible(fact, '2024-06-28'), true);
assert.equal(isT20IEligible(fact, '2024-07-01'), false);
assert.equal(isT20IEligible({ isT20IRetired: true }, '2020-01-01'), false);

const veteran = makePlayer();
const players = { veteran };
let seedIndex = 0;
while (retirementRoll(`retire-${seedIndex}`, 'full:veteran', 2027) > .001) seedIndex++;
const seed = `retire-${seedIndex}`;
const start = createInternationalCareer(2026, players, seed);
const retired = reconcileInternationalCareer(start, 2026, '2026-06-01', players, seed);
const updated = retired.playerUpdates.veteran;
assert.ok(updated?.isT20IRetired, 'annual evaluator must retire a qualifying seeded veteran');
assert.equal(updated.currentTeamId, 'RR');
assert.equal(updated.isRetained, true);
assert.deepEqual(updated.iplStats, veteran.iplStats);
assert.equal(updated.internationalDebutDate, veteran.internationalDebutDate);
assert.ok(!retired.state.teams.IND.squad.includes('full:veteran'));
assert.notEqual(retired.state.teams.IND.captainId, 'full:veteran');
assert.notEqual(retired.state.teams.IND.viceCaptainId, 'full:veteran');
const preserved = mergeT20IRetirement(updated, { isT20IRetired: false });
assert.equal(preserved.isT20IRetired, true);
assert.deepEqual(preserved.t20iRetirement, updated.t20iRetirement);
const repeat = reconcileInternationalCareer(retired.state, 2026, '2026-06-01', { veteran: updated }, seed);
assert.equal(repeat.state.retirements!.filter(e => e.playerId === 'veteran').length, 1);
assert.equal(buildInternationalRetirementNews(repeat.state, { veteran: updated }, '2026-06-01').filter(a => a.playerId === 'veteran').length, 1);
assert.equal(internationalCareerNeedsReconcile(repeat.state, 2026, '2026-06-01', { veteran: updated }), false, 'reconciliation must settle');
assert.ok(retired.state.retirements!.some(e => !e.playerId), 'lightweight internationals follow the same policy');

// Existing cached squad: retire its captain between two matches in a series.
const young = makePlayer('young', 29);
const initial = createInternationalCareer(2026, { young });
const fixtures = initial.fixtures.filter(f => f.teamA === 'IND' || f.teamB === 'IND').sort((a,b) => a.date.localeCompare(b.date));
const first = reconcileInternationalCareer(initial, 2026, fixtures[0].date, { young });
const retiredYoung: Player = { ...young, isT20IRetired: true,
  t20iRetirement: { source: 'historical', reason: 'historical', effectiveOn: fixtures[1].date } };
assert.ok(internationalCareerNeedsReconcile(first.state, 2026, fixtures[0].date, { young: retiredYoung }), 'source change must reconcile before any new fixture is due');
const second = reconcileInternationalCareer(first.state, 2026, fixtures[1].date, { young: retiredYoung });
const played = second.state.fixtures.find(f => f.id === fixtures[1].id)!;
assert.ok(![...(played.xiA ?? []), ...(played.xiB ?? [])].includes('full:young'), 'cached series cannot restore retired captain');
assert.ok(!second.state.teams.IND.pendingDebuts['full:young']);
assert.deepEqual(second.state.fixtures.find(f => f.id === fixtures[0].id), first.state.fixtures.find(f => f.id === fixtures[0].id), 'played history must remain unchanged');
const catchup = reconcileInternationalCareer(createInternationalCareer(2026, { young: retiredYoung }), 2026, fixtures[1].date, { young: retiredYoung });
const earlier = catchup.state.fixtures.find(f => f.id === fixtures[0].id)!;
assert.ok([...(earlier.xiA ?? []), ...(earlier.xiB ?? [])].includes('full:young'), 'catch-up before effective date must retain eligibility');

const legacy = reconcileInternationalCareer(null, 2026, '2025-05-01', { young: { ...young, isT20IRetired: true } });
assert.equal(legacy.playerUpdates.young.t20iRetirement?.source, 'legacy');
assert.equal(legacy.playerUpdates.young.t20iRetirement?.effectiveOn, undefined);

// Persistence and multi-period progression: each boundary versus one jump.
const years = Number(process.env.T20I_RETIREMENT_YEARS ?? 3);
const comparisonYears = Math.min(years, 3);
let stepped: InternationalCareerState = start;
let checkpoint = start;
let stepPlayers = { ...players };
const appearances: Record<string, number> = {};
for (let year = 2026; year <= 2026 + years; year++) {
  const result = reconcileInternationalCareer(JSON.parse(JSON.stringify(stepped)), 2026, `${year}-05-31`, stepPlayers, seed);
  stepped = result.state; stepPlayers = { ...stepPlayers, ...result.playerUpdates };
  if (year === 2026 + comparisonYears) checkpoint = structuredClone(stepped);
  for (const [id, stats] of Object.entries(stepped.seasonStats)) appearances[id] = (appearances[id] ?? 0) + stats.matches;
  for (const team of Object.values(stepped.teams)) {
    assert.equal(team.preferredXI.length, 11);
    const xi = team.preferredXI.map(id => stepped.profiles[id]);
    assert.ok(xi.some(p => p.isWicketkeeper));
    const floor = Math.min(70, Math.max(50, INTERNATIONAL_TEAMS.find(n => n.id === team.countryId)!.strength - 10));
    assert.ok(xi.filter(p => p.bowling >= floor && ['Pace Bowler', 'Spin Bowler', 'All-Rounder'].includes(p.role)).length >= 5);
    assert.ok(xi.every(p => isT20IEligible(p, `${year}-05-31`)));
  }
  if (years > 3 && (year - 2026) % 5 === 0) console.log(`Validated year ${year}: ${stepped.retirements!.length} retirements, legal national XIs.`);
}
const jumped = reconcileInternationalCareer(start, 2026, `${2026 + comparisonYears}-05-31`, players, seed);
assert.deepEqual(JSON.parse(JSON.stringify(jumped.state.retirements)), JSON.parse(JSON.stringify(checkpoint.retirements)), 'yearly and multi-year retirement decisions must match');
assert.deepEqual(jumped.state.careerStats, checkpoint.careerStats, 'multi-year fast-forward must preserve chronological results');
assert.equal(new Set(stepped.retirements!.map(e => e.id)).size, stepped.retirements!.length);
for (const [id, matches] of Object.entries(appearances)) assert.equal(stepped.careerStats[id]?.matches, matches, 'appearance totals must survive archive pruning');
console.log(`T20I retirements verified across ${years} years: ${stepped.retirements!.length} retirements, ${Object.keys(stepped.profiles).length} profiles, ${JSON.stringify(stepped).length} bytes.`);
