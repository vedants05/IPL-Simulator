"use client";
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { internationalCareerNeedsReconcile, internationalStorageKey, reconcileInternationalCareer, type InternationalCareerState } from '@/lib/logic/international';
import { loadInternationalCareer, saveInternationalCareer } from '@/lib/storage/internationalStorage';
import { progressInternationalRelationships } from '@/lib/logic/careerRelationships';

/** One game-wide owner: calendar progression works on every career screen. */
export default function InternationalLifecycle() {
  const date = useGameStore(s => s.currentDate), season = useGameStore(s => s.currentSeason);
  const players = useGameStore(s => s.players), saveId = useGameStore(s => s.saveId);
  const seed = useGameStore(s => s.fixtureSeed), teamId = useGameStore(s => s.userTeamId);
  const loaded = useRef<{ key: string; state: InternationalCareerState | null } | null>(null);
  const key = internationalStorageKey(saveId || seed || teamId || 'career');
  useEffect(() => {
    if (!saveId || !Object.keys(players).length) return;
    let cancelled = false;
    void (async () => {
      const saved = loaded.current?.key === key ? loaded.current.state : await loadInternationalCareer(key);
      if (cancelled) return;
      const live = useGameStore.getState();
      loaded.current = { key, state: saved };
      if (saved && !internationalCareerNeedsReconcile(saved, season, date, live.players)) return;
      const result = reconcileInternationalCareer(saved, season, date, live.players, seed || saveId);
      if (cancelled) return;
      loaded.current = { key, state: result.state };
      useGameStore.setState(state => {
        const nextPlayers = Object.keys(result.playerUpdates).length ? { ...state.players, ...result.playerUpdates } : state.players;
        const careerRelationships = progressInternationalRelationships({ state: state.careerRelationships,
          fixtures: result.state.fixtures, players: nextPlayers, staff: state.careerStaff, season: result.state.season });
        return nextPlayers === state.players && careerRelationships === state.careerRelationships ? state : { players: nextPlayers, careerRelationships };
      });
      await saveInternationalCareer(key, result.state);
    })().catch(error => console.error('Unable to progress international career:', error));
    return () => { cancelled = true; };
  }, [date, season, players, key, saveId, seed]);
  return null;
}
