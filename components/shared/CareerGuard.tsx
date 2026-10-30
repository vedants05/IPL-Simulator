"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

/** Mount career screens and their background effects only after a valid save loads. */
export default function CareerGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const hasCareer = useGameStore((state) => Boolean(
    state.saveId && state.userTeamId && state.teams[state.userTeamId],
  ));

  useEffect(() => {
    let active = true;
    const finish = () => { if (active) setHydrated(true); };
    // Subscribe first so a fast IndexedDB read cannot finish between checks.
    const unsubscribe = useGameStore.persist.onFinishHydration(finish);
    if (useGameStore.persist.hasHydrated()) finish();
    else {
      void Promise.resolve(useGameStore.persist.rehydrate()).then(() => {
        if (!active) return;
        if (useGameStore.persist.hasHydrated()) finish();
        else setLoadFailed(true);
      }).catch(() => { if (active) setLoadFailed(true); });
    }
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (hydrated && !hasCareer) router.replace("/");
  }, [hydrated, hasCareer, router]);

  if (!hydrated || !hasCareer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg text-text-primary">
        <p className="font-space-mono text-[11px] uppercase tracking-widest">
          {loadFailed ? "Your career could not be loaded." : "Loading career..."}
        </p>
        {loadFailed && <Link href="/" className="border-2 border-border px-4 py-2 font-space-mono text-[11px] uppercase">Back to Home</Link>}
      </div>
    );
  }

  return <>{children}</>;
}
