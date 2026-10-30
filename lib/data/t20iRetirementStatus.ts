import historical from './t20iRetirements.json';
import type { T20IRetirement } from '../types';
export function sourceT20IRetirement(id: string, flagged: boolean, effectiveOn?: string): { isT20IRetired?: boolean; t20iRetirement?: T20IRetirement } {
  const fact = historical.find(record => record.id === id);
  if (!fact && !flagged && !effectiveOn) return { isT20IRetired: false };
  return { isT20IRetired: true, t20iRetirement: { source: 'historical', reason: 'historical', effectiveOn: effectiveOn || fact?.effectiveOn } };
}
