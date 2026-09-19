"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let navigated = false;
    const handleNavigation = () => {
      if (navigated) return;
      navigated = true;
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

    // Subscribe before checking the flag. IndexedDB can finish hydration
    // between a flag check and listener registration, which used to leave the
    // root loading screen mounted forever on fast reads or an empty database.
    const unsub = useGameStore.persist?.onFinishHydration?.(handleNavigation);
    if (useGameStore.persist?.hasHydrated?.()) {
      handleNavigation();
    } else {
      // A dev refresh can preserve the store module while cancelling its
      // original asynchronous read. Resume it instead of waiting forever.
      void Promise.resolve(useGameStore.persist?.rehydrate?.()).then(handleNavigation);
    }

    return () => {
      navigated = true;
      unsub?.();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="font-space-mono text-text-secondary text-[11px] tracking-widest uppercase animate-pulse">
        Loading IPL Manager...
      </div>
    </div>
  );
}
