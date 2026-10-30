import type { T20IRetirement } from '../types';

export interface T20IRetirementStatus { isT20IRetired?: boolean; t20iRetirement?: T20IRetirement }
export function isT20IRetiredOn(player: T20IRetirementStatus, date: string): boolean {
  return Boolean((player.isT20IRetired || player.t20iRetirement)
    && (!player.t20iRetirement?.effectiveOn || player.t20iRetirement.effectiveOn <= date));
}
export function isT20IEligible(player: T20IRetirementStatus & { unavailable?: boolean }, date: string): boolean {
  return !player.unavailable && !isT20IRetiredOn(player, date);
}
/** Source refreshes may add historical facts, but cannot undo a save decision. */
export function mergeT20IRetirement(saved: T20IRetirementStatus, fresh: T20IRetirementStatus): T20IRetirementStatus {
  if (saved.t20iRetirement?.source === 'simulated' || saved.isT20IRetired || saved.t20iRetirement) {
    return { isT20IRetired: true, t20iRetirement: saved.t20iRetirement ?? fresh.t20iRetirement ?? { source: 'legacy', reason: 'legacy' } };
  }
  return { isT20IRetired: fresh.isT20IRetired, t20iRetirement: fresh.t20iRetirement };
}
export interface RetirementEvaluation {
  age: number; ageShift: number; ability: number; nationalStrength: number;
  inXI: boolean; inSquad: boolean; recentMatches: number; captain: boolean;
}
export function t20iRetirementProbability(input: RetirementEvaluation): number {
  const age = input.age - input.ageShift;
  if (age < 33) return 0;
  if (age >= 40) return 1;
  const base = [0.04, 0.07, 0.12, 0.18, 0.28, 0.40, 0.65][Math.floor(age) - 33];
  const activeProtection = input.inXI ? 0.15 : input.inSquad ? 0.4 : input.recentMatches > 0 ? 0.65 : 1.3;
  const quality = input.ability >= input.nationalStrength - 5 ? 0.7 : input.ability < input.nationalStrength - 18 ? 1.25 : 1;
  return Math.min(0.95, base * activeProtection * quality * (input.captain ? 0.8 : 1));
}
export function retirementRoll(seed: string, id: string, season: number): number {
  let hash = 2166136261;
  for (const char of `${seed}:${id}:${season}:t20i-retirement`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967296;
}
export function t20iRetirementDescription(player: T20IRetirementStatus): string {
  const record = player.t20iRetirement;
  const reason = record?.reason === 'selection' ? 'Stepped away after time outside the national side.' : record?.reason === 'age' ? 'Retired at the end of an international career.' : '';
  return `Retired from T20 internationals${record?.effectiveOn ? ` on ${record.effectiveOn}` : ''}. ${reason} Available for franchise cricket.`.replace(/ +/g, ' ');
}
