"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const handleNavigation = () => {
      const { saveId, userTeamId, auction } = useGameStore.getState();
      if (saveId && userTeamId) {
        if (auction && auction.phase !== "completed") {
          router.replace("/game/auction");
        } else {
          router.replace("/game/overview");
        }
      } else {
        router.replace("/game/overview");
      }
    };

    if (useGameStore.persist?.hasHydrated?.()) {
      handleNavigation();
    } else {
      const unsub = useGameStore.persist?.onFinishHydration?.(() => {
        handleNavigation();
      });
      return () => {
        unsub?.();
      };
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="font-space-mono text-text-secondary text-[11px] tracking-widest uppercase animate-pulse">
        Loading IPL Manager...
      </div>
    </div>
  );
}
