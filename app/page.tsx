"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const { saveId, userTeamId } = useGameStore.getState();
    if (saveId && userTeamId) {
      router.replace("/game/auction");
    } else {
      router.replace("/setup");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="font-space-mono text-text-secondary text-[11px] tracking-widest uppercase">Loading IPL Manager...</div>
    </div>
  );
}
