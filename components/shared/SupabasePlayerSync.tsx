"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";

export default function SupabasePlayerSync() {
  const saveId = useGameStore((state) => state.saveId);
  const refreshPlayersFromSupabase = useGameStore((state) => state.refreshPlayersFromSupabase);

  useEffect(() => {
    if (!saveId) return;
    refreshPlayersFromSupabase().catch((error) => {
      console.error("Failed to refresh saved player data from Supabase:", error);
    });
  }, [saveId, refreshPlayersFromSupabase]);

  return null;
}
