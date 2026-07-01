"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

export default function RootPage() {
  const router = useRouter();
  const { saveId } = useGameStore();

  useEffect(() => {
    if (saveId) {
      router.replace("/game/auction");
    } else {
      router.replace("/setup");
    }
  }, []);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="font-space-mono text-text-secondary text-[11px] tracking-widest">Loading...</div>
    </div>
  );
}
